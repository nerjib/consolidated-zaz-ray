const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');
const axios = require('axios');
const { handleSuccessfulPayment } = require('../services/paymentService');
const { sendPaymentReceiptMessage, sendVirtualAccountCreationLoanMessage, sendAgentCreditTopUpMessage } = require('../services/whatsappService');
const crypto = require('crypto');
const { getBusinessCredentials } = require('../services/utils');
const can = require('../middleware/can');

// @route   GET api/payments
// @desc    Get all payments for the business
// @access  Private (Admin)
router.get('/', auth, can('payment:read'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const payments = await query('SELECT p.*, u.username as customer FROM ray_payments p JOIN ray_users u ON p.user_id = u.id WHERE p.business_id = $1 ORDER BY p.payment_date DESC', [business_id]);
    res.json(payments.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/payments/manual
// @desc    Record a manual payment in the business
// @access  Private (Admin, Super-Agent, Agent)
router.post('/manual', auth, can('payment:create:manual'), async (req, res) => {
  const { user_id, amount, currency, payment_method, transaction_id, loan_id } = req.body;
  const { business_id } = req.user;

  const { pool } = require('../config/database');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!loan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'Loan ID is required for manual payments.' });
    }

    const loanResult = await client.query('SELECT payment_cycle_amount, current_cycle_accumulated_payment FROM ray_loans WHERE id = $1 AND business_id = $2 FOR UPDATE', [loan_id, business_id]);
    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Loan not found in your business.' });
    }
    const loan = loanResult.rows[0];

    const user = await client.query('SELECT id FROM ray_users WHERE id = $1 AND role = $2 AND business_id = $3', [user_id, 'customer', business_id]);
    if (user.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Customer not found in your business.' });
    }

    const newPayment = await client.query(
      'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;',
      [user_id, amount, currency || 'NGN', payment_method || 'manual', transaction_id || null, 'completed', loan_id, business_id]
    );

    const newAccumulatedPayment = parseFloat(loan.current_cycle_accumulated_payment) + amount;

    if (newAccumulatedPayment >= loan.payment_cycle_amount) {
      // const excessAmount = newAccumulatedPayment - loan.payment_cycle_amount;
      // if (newAccumulatedPayment % loan.payment_cycle_amount !== 0) {
        const highestMultiple = Math.floor(newAccumulatedPayment / loan.payment_cycle_amount) * loan.payment_cycle_amount;
        const excessAmount = newAccumulatedPayment - highestMultiple;
        await handleSuccessfulPayment(client, user_id, highestMultiple, newPayment.rows[0].id, loan_id, business_id, false,amount);
        await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [excessAmount, loan_id]);
        // res.json({ msg: 'Manual payment recorded successfully. Full cycle payment processed.', payment: newPayment.rows[0], excessAmount });
      // await handleSuccessfulPayment(client, user_id, loan.payment_cycle_amount, newPayment.rows[0].id, loan_id, business_id);
      // await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [excessAmount, loan_id]);
      res.json({ msg: 'Manual payment recorded successfully. Full cycle payment processed.', payment: newPayment.rows[0], excessAmount });
    } else {
      await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [newAccumulatedPayment, loan_id]);
      const remainingAmount = loan.payment_cycle_amount - newAccumulatedPayment;

      // Asynchronously send WhatsApp message
      (async () => {
        try {
          const userResult = await query('SELECT username, phone_number FROM ray_users WHERE id = $1', [user_id]);
          const businessResult = await query('SELECT name FROM businesses WHERE id = $1', [business_id]);
          const user = userResult.rows[0];
          const business = businessResult.rows[0];

          if (user && business) {
            await sendPaymentReceiptMessage(user.phone_number, user.username, amount, loan.payment_cycle_amount, business.name);
          }
        } catch (err) {
          console.error(`Error sending WhatsApp receipt for payment ${newPayment.rows[0].id}:`, err);
        }
      })();

      res.json({ msg: `Manual payment recorded successfully. Partial payment received. ${remainingAmount.toFixed(2)} needed for next cycle.`, payment: newPayment.rows[0], remainingAmount });
    }

    await client.query('COMMIT');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
});

// @route   POST api/payments/agent-credit
// @desc    Agent makes a payment using their credit balance
// @access  Private (Agent, Super-Agent, Admin)
router.post('/agent-credit', auth, can('payment:create:manual', ['super-agent', 'agent']), async (req, res) => {
  const { user_id, amount, loan_id } = req.body;
  const { id: agentId, business_id } = req.user;

  const { pool } = require('../config/database');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!user_id || typeof amount !== 'number' || amount <= 0 || !loan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'Customer ID, positive amount, and Loan ID are required.' });
    }

    const loanResult = await client.query('SELECT payment_cycle_amount, current_cycle_accumulated_payment FROM ray_loans WHERE id = $1 AND business_id = $2 FOR UPDATE', [loan_id, business_id]);
    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Loan not found in your business.' });
    }
    const loan = loanResult.rows[0];

    const user = await client.query('SELECT id FROM ray_users WHERE id = $1 AND role = $2 AND business_id = $3', [user_id, 'customer', business_id]);
    if (user.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Customer not found in your business.' });
    }

    const agent = await client.query('SELECT credit_balance FROM ray_users WHERE id = $1 AND business_id = $2 FOR UPDATE', [agentId, business_id]);
    if (agent.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Agent not found in your business.' });
    }

    const currentCredit = parseFloat(agent.rows[0].credit_balance);
    if (currentCredit < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'Insufficient credit balance.' });
    }

    const newCreditBalance = currentCredit - amount;
    await client.query('UPDATE ray_users SET credit_balance = $1 WHERE id = $2 AND business_id = $3', [newCreditBalance, agentId, business_id]);

    const newPayment = await client.query(
      'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;',
      [user_id, amount, 'NGN', 'agent_credit', `AGENT_CREDIT-${Date.now()}`, 'completed', loan_id, business_id]
    );

    await client.query(
      'INSERT INTO ray_credit_transactions (user_id, transaction_type, amount, new_balance, reference_id, description, created_by, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [agentId, 'payment', amount, newCreditBalance, newPayment.rows[0].id, `Payment for loan ${loan_id}`, agentId, business_id]
    );

    const newAccumulatedPayment = parseFloat(loan.current_cycle_accumulated_payment) + amount;
    if (newAccumulatedPayment >= loan.payment_cycle_amount) {
      const highestMultiple = Math.floor(newAccumulatedPayment / loan.payment_cycle_amount) * loan.payment_cycle_amount;
      const excessAmount = newAccumulatedPayment - highestMultiple;
      await handleSuccessfulPayment(client, user_id, highestMultiple, newPayment.rows[0].id, loan_id, business_id, false,amount);
      await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [excessAmount, loan_id]);
      res.json({ msg: 'Payment made successfully using agent credit. Full cycle payment processed.', payment: newPayment.rows[0], newCreditBalance, excessAmount: excessAmount ?? 0});
    } else {
      await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [newAccumulatedPayment, loan_id]);
      res.json({ msg: 'Payment made successfully using agent credit. Partial payment received.', payment: newPayment.rows[0], newCreditBalance });
    }

    await client.query('COMMIT');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
});

// @route   POST api/payments/paystack/initiate
// @desc    Initiate a Paystack transaction for the business
// @access  Private (Customer)
router.post('/paystack/initiate', auth,  async (req, res) => {
  const { amount, reference, metadata } = req.body;
  const { business_id, email } = req.user;

  try {
    const credentials = await getBusinessCredentials(business_id);
    if (!credentials || !credentials.paystack_secret_key) {
      return res.status(400).json({ msg: 'Paystack is not configured for this business.' });
    }

    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: email,
        amount: amount * 100, // Paystack amount is in kobo/cents
        reference,
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
        metadata: { ...metadata, business_id } // Inject business_id into metadata
      },
      {
        headers: {
          Authorization: `Bearer ${credentials.paystack_secret_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json(paystackResponse.data);
  } catch (err) {
    console.error('Paystack initiation error:', err.response ? err.response.data : err.message);
    res.status(500).json({ msg: 'Failed to initiate Paystack transaction', error: err.response ? err.response.data : err.message });
  }
});

// @route   POST api/payments/paystack/webhook
// @desc    Paystack webhook for verifying payments (used by Paystack, not clients)
// @access  Public
router.post('/paystack/webhook', async (req, res) => {
  const event = req.body;
  const business_id = event.data.metadata ? event.data.metadata.business_id : null;
  console.log({event});
  if (!business_id) {
    console.error('Webhook Error: business_id not found in metadata');
    return res.status(400).send('Webhook error: Missing business identifier.');
  }

  const credentials = await getBusinessCredentials(business_id);
  if (!credentials || !credentials.paystack_secret_key) {
    console.error(`Webhook Error: Paystack not configured for business ${business_id}`);
    return res.status(400).send('Webhook error: Business configuration not found.');
  }

  const hash = crypto.createHmac('sha512', credentials.paystack_secret_key).update(JSON.stringify(req.body)).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).send('Invalid signature');
  }

  if (event.event === 'charge.success') {
    const { reference, amount, currency, customer, metadata } = event.data;
    const { user_id, loan_id } = metadata;

    const { pool } = require('../config/database');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (!user_id || !loan_id) {
        await client.query('ROLLBACK');
        console.error('Webhook: Missing user_id or loan_id in metadata');
        return res.status(400).send('Missing metadata');
      }

      const existingPayment = await client.query('SELECT id FROM ray_payments WHERE transaction_id = $1 AND business_id = $2', [reference, business_id]);
      if (existingPayment.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(200).send('Payment already processed');
      }

      const newPayment = await client.query(
        'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;',
        [user_id, amount / 100, currency, 'paystack', reference, 'completed', loan_id, business_id]
      );

      const loanResult = await client.query('SELECT payment_cycle_amount, current_cycle_accumulated_payment FROM ray_loans WHERE id = $1 AND business_id = $2 FOR UPDATE', [loan_id, business_id]);
      if (loanResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).send('Loan not found');
      }
      const loan = loanResult.rows[0];

      const newAccumulatedPayment = parseFloat(loan.current_cycle_accumulated_payment) + (amount / 100);

      if (newAccumulatedPayment >= loan.payment_cycle_amount) {
        const highestMultiple = Math.floor(newAccumulatedPayment / loan.payment_cycle_amount) * loan.payment_cycle_amount;
        const excessAmount = newAccumulatedPayment - highestMultiple;
        await handleSuccessfulPayment(client, user_id, highestMultiple, newPayment.rows[0].id, loan_id, business_id, false,amount / 100);
        await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [excessAmount, loan_id]);
      } else {
        await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [newAccumulatedPayment, loan_id]);
      }

      await client.query('COMMIT');
      res.status(200).send('Webhook received and payment processed');

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Webhook processing error:', err);
      res.status(500).send('Internal Server Error');
    } finally {
      client.release();
    }
  }
});

// @route   POST api/payments/paystack/dedicated-webhook
// @desc    Paystack webhook for Dedicated Virtual Account payments
// @access  Public
router.post('/paystack/dedicated-webhook', async (req, res) => {
  const event = req.body;
  console.log({event, customer: event.data.customer, dedicated_account: event.data.dedicated_account});
  // data: { customer: [Object], dedicated_account: [Object] }
  // It's crucial to get business_id from a reliable source in the payload.
  // Assuming it's in metadata as we designed.
  const business_id = event.data.customer.metadata ? event.data.customer.metadata.business_id : null;
  const type = event.data.customer.metadata ? event?.data?.customer?.metadata?.type : null;
  const userId = event.data.customer.metadata ? event?.data?.customer?.metadata?.user_id : null;
  const loanId = event.data.customer.metadata ? event?.data?.customer?.metadata?.loan_id : null;


  // agent_credit_topup

  if (!business_id) {
    console.error('Webhook Error: business_id not found in dedicated account webhook metadata');
    return res.status(400).send('Webhook error: Missing business identifier.');
  }

  // const credentials = await getBusinessCredentials(business_id);
  // if (!credentials || !credentials.paystack_secret_key) {
  //   console.error(`Webhook Error: Paystack not configured for business ${business_id}`);
  //   return res.status(400).send('Webhook error: Business configuration not found.');
  // }

  // Verify the webhook signature
  // const hash = crypto.createHmac('sha512', credentials.paystack_secret_key).update(JSON.stringify(req.body)).digest('hex');
  // if (hash !== req.headers['x-paystack-signature']) {
  //   console.warn(`Invalid Paystack signature for business ${business_id}`);
  //   return res.status(400).send('Invalid signature');
  // }

  if (event.event === 'dedicatedaccount.assign.success' && type === 'agent_credit_topup') {
    const account = event.data.dedicated_account;
    if (account && account.account_number) {
      await query(
        'UPDATE ray_users SET paystack_dedicated_account_number = $1, paystack_dedicated_bank_name = $2, paystack_dedicated_account_name = $3 WHERE id = $4',
        [account.account_number, account.bank.name, account.account_name, userId]
      );

      if (account.customer && account.customer.customer_code) {
        await query(
          'UPDATE ray_users SET paystack_customer_code = $1 WHERE id = $2',
          [account.customer.customer_code, userId]
        );
      }
      const customerResult = await query('SELECT * FROM ray_users WHERE id = $1', [userId]);
      const businessResult = await query('SELECT * FROM businesses WHERE id = $1', [business_id]);
       // Send WhatsApp message
      //  console.log({vvvvvvvvv: customerResult.rows[0], business: businessResult.rows[0]});
       (async () => {
        try {
          await sendAgentCreditTopUpMessage(
            customerResult.rows[0].phone_number,
            customerResult.rows[0].name || customerResult.rows[0].username,
            account?.account_number,
            account?.bank.name,
            account?.account_name,
            businessResult?.rows[0]?.name
          );
        } catch (err) {
          console.error(`Error sending WhatsApp message for user ${userId}:`, err);
        }
      })();
      console.log(`Created dedicated account .jjjjjj ${account.account_number} for user ${userId}`);
    }
  } else if (event.event === 'dedicatedaccount.assign.success' && type === 'loan_account') {
    const account = event.data.dedicated_account;
    if (account && account.account_number) {
      await query(
        'UPDATE ray_loans SET paystack_dedicated_account_number = $1, paystack_dedicated_bank_name = $2, paystack_dedicated_account_name = $3 WHERE id = $4',
        [account.account_number, account.bank.name, account.account_name, loanId]
      );

      if (account.customer && account.customer.customer_code) {
        await query(
          'UPDATE ray_loans SET paystack_customer_code = $1 WHERE id = $2',
          [account.customer.customer_code, loanId]
        );
      }
      const customerResult = await query('SELECT * FROM ray_users WHERE id = $1', [userId]);
      const businessResult = await query('SELECT * FROM businesses WHERE id = $1', [business_id]);
      console.log(`Created dedicated account l ${account.account_number} for loan ${loanId}`);
      (async () => {
        try {
          await sendVirtualAccountCreationLoanMessage(
            customerResult.rows[0].phone_number,
            customerResult.rows[0].name || customerResult.rows[0].username,
            account.account_number,
            account.bank.name,
            account.account_name,
            businessResult.rows[0].name
          );
        } catch (err) {
          console.error(`Error sending WhatsApp message for loan ${loanId}:`, err);
        }
      })();
    }
  }

  // Process only successful charges
  if (event.event === 'charge.success') {
    const { reference, amount, currency, authorization, metadata } = event.data;
    const accountNumber = authorization.receiver_bank_account_number;

    if (!accountNumber) {
        console.error('Webhook Error: Could not find receiver_bank_account_number in payload.');
        return res.status(400).send('Payload missing account number.');
    }

    const { pool } = require('../config/database');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if this transaction has already been processed
      const existingPayment = await client.query('SELECT id FROM ray_payments WHERE transaction_id = $1 AND business_id = $2', [reference, business_id]);
      if (existingPayment.rows.length > 0) {
        await client.query('ROLLBACK');
        console.log(`Webhook Info: Payment reference ${reference} already processed.`);
        return res.status(200).send('Payment already processed');
      }

      // Determine if the account belongs to a loan or a user (agent)
      const loanResult = await client.query(
        'SELECT id, customer_id, payment_cycle_amount, current_cycle_accumulated_payment FROM ray_loans WHERE paystack_dedicated_account_number = $1 AND business_id = $2 FOR UPDATE',
        [accountNumber, business_id]
      );

      if (loanResult.rows.length > 0) {
        // It's a LOAN REPAYMENT
        const loan = loanResult.rows[0];
        const user_id = loan.customer_id;
        const loan_id = loan.id;
        const paymentAmount = amount / 100;
        const userDetails = await client.query('SELECT id FROM ray_users WHERE id = $1 AND business_id = $2', [user_id, business_id]);
        const businessDetails = await client.query('SELECT id FROM businesses WHERE id = $1', [business_id]);

        const newPayment = await client.query(
          'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;',
          [user_id, paymentAmount, currency, 'paystack_dedicated', reference, 'completed', loan_id, business_id]
        );

        const newAccumulatedPayment = parseFloat(loan.current_cycle_accumulated_payment) + paymentAmount;
        if (newAccumulatedPayment >= loan.payment_cycle_amount) {
          const numCyclesPaid = Math.floor(newAccumulatedPayment / loan.payment_cycle_amount);
          const amountForCycles = numCyclesPaid * loan.payment_cycle_amount;
          const excessAmount = newAccumulatedPayment - amountForCycles;

          await handleSuccessfulPayment(client, user_id, amountForCycles, newPayment.rows[0].id, loan_id, business_id, false, paymentAmount);
          await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [excessAmount, loan_id]);
        } else {
          await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [newAccumulatedPayment, loan_id]);
          sendPaymentReceiptMessage(
            userDetails.rows[0].phone_number,
            userDetails.rows[0].name || userDetails.rows[0].username,
            paymentAmount,
            loan.payment_cycle_amount,
            businessDetails.rows[0].name
          );
        }
        console.log(`Successfully processed dedicated account payment ${reference} for loan ${loan_id}`);

      } else {
        // Check if it's an AGENT CREDIT TOP-UP
        const userResult = await client.query(
          'SELECT id, credit_balance FROM ray_users WHERE paystack_dedicated_account_number = $1 AND business_id = $2 FOR UPDATE',
          [accountNumber, business_id]
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          const topUpAmount = amount / 100;
          const newBalance = parseFloat(user.credit_balance) + topUpAmount;

          await client.query('UPDATE ray_users SET credit_balance = $1 WHERE id = $2', [newBalance, user.id]);

          await client.query(
            'INSERT INTO ray_credit_transactions (user_id, transaction_type, amount, new_balance, description, created_by, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [user.id, 'credit_topup', topUpAmount, newBalance, `Paystack top-up via dedicated account. Ref: ${reference}`, user.id, business_id]
          );
           console.log(`Successfully processed credit top-up of ${topUpAmount} for user ${user.id}`);

        } else {
          await client.query('ROLLBACK');
          console.error(`Webhook Error: No loan or user found for dedicated account number ${accountNumber}`);
          return res.status(404).send('No loan or user found for dedicated account.');
        }
      }

      await client.query('COMMIT');
      res.status(200).send('Webhook received and payment processed');

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Webhook processing error for dedicated account:', err);
      res.status(500).send('Internal Server Error');
    } finally {
      client.release();
    }
  } else {
    // Acknowledge other events without processing
    res.status(200).send('Webhook received');
  }
});

module.exports = router;
