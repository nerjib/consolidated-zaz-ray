const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');
const axios = require('axios');
const { handleSuccessfulPayment } = require('../services/paymentService');
const crypto = require('crypto'); // Added crypto import


// @route   GET api/payments
// @desc    Get all payments
// @access  Private (Admin)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const payments = await query('SELECT p.*, u.username as customer FROM ray_payments p JOIN ray_users u ON p.user_id = u.id ORDER BY p.payment_date DESC');
    res.json(payments.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/payments/manual
// @desc    Record a manual payment (Admin, Super-Agent, Agent)
// @access  Private (Admin, Super-Agent, Agent)
router.post('/manual', auth, authorize('admin', 'super-agent', 'agent'), async (req, res) => {
  const { user_id, amount, currency, payment_method, transaction_id, loan_id } = req.body;

  const { pool } = require('../config/database'); // Assuming database.js exports a 'pool'
  const client = await pool.connect(); // Get a client from the pool

  try {
    await client.query('BEGIN'); // Start the transaction

    if (!loan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'Loan ID is required for manual payments.' });
    }

    const loanResult = await client.query('SELECT payment_cycle_amount, current_cycle_accumulated_payment FROM ray_loans WHERE id = $1 FOR UPDATE', [loan_id]); // FOR UPDATE
    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Loan not found.' });
    }
    const loan = loanResult.rows[0];

    // Check if user exists and is a customer
    const user = await client.query('SELECT id, role FROM ray_users WHERE id = $1 AND role = $2', [user_id, 'customer']);
    if (user.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Customer not found' });
    }

    const newPayment = await client.query(
      'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;',
      [user_id, amount, currency || 'NGN', payment_method || 'manual', transaction_id || null, 'completed', loan_id]
    );

    const newAccumulatedPayment = parseFloat(loan.current_cycle_accumulated_payment) + amount;

    if (newAccumulatedPayment >= loan.payment_cycle_amount) {
      const excessAmount = newAccumulatedPayment - loan.payment_cycle_amount;
      await handleSuccessfulPayment(client, user_id, loan.payment_cycle_amount, newPayment.rows[0].id, loan_id); // Pass client
      await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [excessAmount, loan_id]);
      res.json({ msg: 'Manual payment recorded successfully. Full cycle payment processed.', payment: newPayment.rows[0], excessAmount });
    } else {
      await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [newAccumulatedPayment, loan_id]);
      const remainingAmount = loan.payment_cycle_amount - newAccumulatedPayment;
      res.json({ msg: `Manual payment recorded successfully. Partial payment received. ${remainingAmount.toFixed(2)} needed for next cycle.`, payment: newPayment.rows[0], remainingAmount });
    }

    await client.query('COMMIT'); // Commit the transaction

  } catch (err) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error(err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release(); // Release the client
  }
});

// @route   POST api/payments/agent-credit
// @desc    Agent makes a payment using their credit balance
// @access  Private (Agent, Super-Agent, Admin)
router.post('/agent-credit', auth, authorize('agent', 'super-agent', 'admin'), async (req, res) => {
  const { user_id, amount, loan_id } = req.body; // user_id is the customer ID
  const agentId = req.user.id; // The agent making the payment

  // Import the database pool directly for transaction management
  const { pool } = require('../config/database'); // Assuming database.js exports a 'pool'

  const client = await pool.connect(); // Get a client from the pool

  try {
    await client.query('BEGIN'); // Start the transaction

    // Validate input
    if (!user_id || typeof amount !== 'number' || amount <= 0 || !loan_id) {
      await client.query('ROLLBACK'); // Rollback before returning
      return res.status(400).json({ msg: 'Customer ID, positive amount, and Loan ID are required.' });
    }

    // Check if loan exists and get payment cycle amount
    // Use client.query instead of global query
    const loanResult = await client.query('SELECT payment_cycle_amount, current_cycle_accumulated_payment FROM ray_loans WHERE id = $1 FOR UPDATE', [loan_id]); // FOR UPDATE to prevent race conditions
    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Loan not found.' });
    }
    const loan = loanResult.rows[0];

    // Check if user exists and is a customer
    const user = await client.query('SELECT id, role FROM ray_users WHERE id = $1 AND role = $2', [user_id, 'customer']);
    if (user.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Customer not found' });
    }

    // Check if agent has sufficient credit
    // Use client.query
    const agent = await client.query('SELECT credit_balance FROM ray_users WHERE id = $1 FOR UPDATE', [agentId]); // FOR UPDATE
    if (agent.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Agent not found.' });
    }

    const currentCredit = parseFloat(agent.rows[0].credit_balance);
    if (currentCredit < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'Insufficient credit balance.' });
    }

    // Deduct amount from agent's credit balance
    // Use client.query
    const newCreditBalance = currentCredit - amount;
    await client.query('UPDATE ray_users SET credit_balance = $1 WHERE id = $2', [newCreditBalance, agentId]);

    // Record the payment in ray_payments
    // Use client.query
    const newPayment = await client.query(
      'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;',
      [user_id, amount, 'NGN', 'agent_credit', `AGENT_CREDIT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 'completed', loan_id]
    );

    // Record the credit transaction
    // Use client.query
    await client.query(
      'INSERT INTO ray_credit_transactions (user_id, transaction_type, amount, new_balance, reference_id, description, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [agentId, 'payment', amount, newCreditBalance, newPayment.rows[0].id, `Payment for loan ${loan_id} on behalf of customer ${user_id}`, agentId]
    );

    const newAccumulatedPayment = parseFloat(loan.current_cycle_accumulated_payment) + amount;
    let excessAmount;
    if (newAccumulatedPayment >= loan.payment_cycle_amount) {
      excessAmount = newAccumulatedPayment - loan.payment_cycle_amount;
      // handleSuccessfulPayment might also do queries, so it should ideally be transaction-aware or its queries should be part of this transaction
      // For now, assuming it's safe or its operations are idempotent/non-critical for this transaction's atomicity
      await handleSuccessfulPayment(client, user_id, loan.payment_cycle_amount, newPayment.rows[0].id, loan_id);
      await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [excessAmount, loan_id]);
    } else {
      await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [newAccumulatedPayment, loan_id]);
    }

    await client.query('COMMIT'); // Commit the transaction if all succeeded
    res.json({ msg: 'Payment made successfully using agent credit. Full cycle payment processed.', payment: newPayment.rows[0], newCreditBalance, excessAmount: excessAmount ?? 0});

  } catch (err) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error(err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release(); // Release the client back to the pool
  }
});

// @route   POST api/payments/paystack/verify
// @desc    Verify a Paystack payment
// @access  Private (Customer, Admin)
router.post('/paystack/verify', auth, authorize('customer', 'admin'), async (req, res) => {
  const { reference, user_id, amount, loan_id } = req.body; // user_id is the customer making the payment

  const { pool } = require('../config/database'); // Assuming database.js exports a 'pool'
  const client = await pool.connect(); // Get a client from the pool

  try {
    await client.query('BEGIN'); // Start the transaction

    if (!reference) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'Payment reference is required' });
    }

    if (!loan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'Loan ID is required for Paystack verification.' });
    }

    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer kkkk`, // IMPORTANT: This should be process.env.PAYSTACK_SECRET_KEY
        },
      }
    );

    const { status, data } = paystackResponse.data;

    if (status && data.status === 'success') {
      const loanResult = await client.query('SELECT payment_cycle_amount, current_cycle_accumulated_payment FROM ray_loans WHERE id = $1 FOR UPDATE', [loan_id]); // FOR UPDATE
      if (loanResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ msg: 'Loan not found.' });
      }
      const loan = loanResult.rows[0];

      // Payment is successful, record it in your database
      const newPayment = await client.query(
        'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;',
        [user_id, data.amount / 100, data.currency, 'paystack', data.reference, 'completed', loan_id] // Paystack amount is in kobo/cents
      );

      const newAccumulatedPayment = parseFloat(loan.current_cycle_accumulated_payment) + (data.amount / 100);

      if (newAccumulatedPayment >= loan.payment_cycle_amount) {
        const excessAmount = newAccumulatedPayment - loan.payment_cycle_amount;
        await handleSuccessfulPayment(client, user_id, loan.payment_cycle_amount, newPayment.rows[0].id, loan_id); // Pass client
        await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [excessAmount, loan_id]);
        res.json({ msg: 'Paystack payment verified and recorded. Full cycle payment processed.', payment: newPayment.rows[0], excessAmount });
      } else {
        await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [newAccumulatedPayment, loan_id]);
        const remainingAmount = loan.payment_cycle_amount - newAccumulatedPayment;
        res.json({ msg: `Paystack payment verified and recorded. Partial payment received. ${remainingAmount.toFixed(2)} needed for next cycle.`, payment: newPayment.rows[0], remainingAmount });
      }
    } else {
      await client.query('ROLLBACK'); // Rollback if Paystack verification fails
      res.status(400).json({ msg: 'Paystack payment verification failed', details: data });
    }

    await client.query('COMMIT'); // Commit the transaction

  } catch (err) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error(err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release(); // Release the client
  }
});

// @route   POST api/payments/paystack/webhook
// @desc    Paystack webhook for verifying payments
// @access  Public (Paystack only)
router.post('/paystack/webhook', async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY; // Use environment variable for secret key
  const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');

  if (hash == req.headers['x-paystack-signature']) {
    const event = req.body;
    // Do something with event
    if (event.event === 'charge.success') {
      const { reference, amount, currency, status, customer } = event.data;
      const user_id = customer.metadata ? customer.metadata.user_id : null; // Assuming you pass user_id in metadata
      const loan_id = customer.metadata ? customer.metadata.loan_id : null; // Assuming you pass loan_id in metadata

      const { pool } = require('../config/database'); // Assuming database.js exports a 'pool'
      const client = await pool.connect(); // Get a client from the pool

      try {
        await client.query('BEGIN'); // Start the transaction

        if (!user_id || !loan_id) {
          await client.query('ROLLBACK');
          console.error('Webhook: Missing user_id or loan_id in metadata');
          return res.status(400).send('Missing metadata');
        }

        // Check if payment already recorded to prevent duplicates
        const existingPayment = await client.query('SELECT id FROM ray_payments WHERE transaction_id = $1', [reference]);
        if (existingPayment.rows.length > 0) {
          await client.query('ROLLBACK'); // Rollback if duplicate
          return res.status(200).send('Payment already processed');
        }

        const newPayment = await client.query(
          'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;',
          [user_id, amount / 100, currency, 'paystack', reference, 'completed', loan_id]
        );

        const loanResult = await client.query('SELECT payment_cycle_amount, current_cycle_accumulated_payment FROM ray_loans WHERE id = $1 FOR UPDATE', [loan_id]); // FOR UPDATE
        if (loanResult.rows.length === 0) {
          await client.query('ROLLBACK');
          console.error('Webhook: Loan not found for ID:', loan_id);
          return res.status(404).send('Loan not found');
        }
        const loan = loanResult.rows[0];

        const newAccumulatedPayment = parseFloat(loan.current_cycle_accumulated_payment) + (amount / 100);

        if (newAccumulatedPayment >= loan.payment_cycle_amount) {
          const excessAmount = newAccumulatedPayment - loan.payment_cycle_amount;
          await handleSuccessfulPayment(client, user_id, loan.payment_cycle_amount, newPayment.rows[0].id, loan_id);
          await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [excessAmount, loan_id]);
          console.log('Webhook: Full cycle payment processed for loan', loan_id);
        } else {
          await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [newAccumulatedPayment, loan_id]);
          const remainingAmount = loan.payment_cycle_amount - newAccumulatedPayment;
          console.log(`Webhook: Partial payment received for loan ${loan_id}. ${remainingAmount.toFixed(2)} needed for next cycle.`);
        }
        res.status(200).send('Webhook received and payment processed');

        await client.query('COMMIT'); // Commit the transaction

      } catch (err) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Webhook processing error:', err);
        res.status(500).send('Internal Server Error');
      } finally {
        client.release(); // Release the client
      }
    }
  } else {
    res.status(400).send('Invalid signature');
  }
});

// @route   POST api/payments/paystack/initiate
// @desc    Initiate a Paystack transaction
// @access  Private (Customer)
router.post('/paystack/initiate', auth, authorize('customer', 'super-agent', 'agent'), async (req, res) => {
  const { amount, reference, metadata } = req.body; // metadata should contain user_id and loan_id

  try {
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: req.user.email,
        amount: amount * 100, // Paystack expects amount in kobo/cents
        reference,
        callback_url: process.env.PAYSTACK_CALLBACK_URL, // Your frontend or backend callback URL
        metadata,
      },
      {
        headers: {
          Authorization: `Bearer sk_test_c2ae19298b4abf5dae6d428e2e6b4cf312c825b9`, // Use environment variable
          'Content-Type': 'application/json',
        },
      }
    );

    res.json(paystackResponse.data); // Contains authorization_url
  } catch (err) {
    console.error('Paystack initiation error:', err.response ? err.response.data : err.message);
    res.status(500).json({ msg: 'Failed to initiate Paystack transaction', error: err.response ? err.response.data : err.message });
  }
});

// @route   GET api/payments/paystack/callback
// @desc    Paystack callback URL after a transaction
// @access  Public
router.get('/paystack/callback', async (req, res) => {
  const { trxref, reference } = req.query;

  const { pool } = require('../config/database'); // Assuming database.js exports a 'pool'
  const client = await pool.connect(); // Get a client from the pool

  try {
    await client.query('BEGIN'); // Start the transaction

    if (!reference) {
      await client.query('ROLLBACK');
      return res.redirect(`${process.env.FRONTEND_URL}/payment-status?status=failed&message=No reference found`);
    }

    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, // Use environment variable
        },
      }
    );

    const { status, data } = paystackResponse.data;

    if (status && data.status === 'success') {
      const user_id = data.metadata ? data.metadata.user_id : null;
      const loan_id = data.metadata ? data.metadata.loan_id : null;

      if (!user_id || !loan_id) {
        await client.query('ROLLBACK');
        console.error('Callback: Missing user_id or loan_id in metadata');
        return res.redirect(`${process.env.FRONTEND_URL}/payments/status?status=failed&message=Missing metadata`);
      }

      // Check if payment already recorded to prevent duplicates
      const existingPayment = await client.query('SELECT id FROM ray_payments WHERE transaction_id = $1', [reference]);
      if (existingPayment.rows.length > 0) {
        await client.query('ROLLBACK'); // Rollback if duplicate
        return res.redirect(`${process.env.FRONTEND_URL}/payments/status?status=success&message=Payment already processed&reference=${reference}`);
      }

      const loanResult = await client.query('SELECT payment_cycle_amount, current_cycle_accumulated_payment FROM ray_loans WHERE id = $1 FOR UPDATE', [loan_id]); // FOR UPDATE
      if (loanResult.rows.length === 0) {
        await client.query('ROLLBACK');
        console.error('Callback: Loan not found for ID:', loan_id);
        return res.redirect(`${process.env.FRONTEND_URL}/payments/status?status=failed&message=Loan not found`);
      }
      const loan = loanResult.rows[0];

      const newPayment = await client.query(
        'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;',
        [user_id, data.amount / 100, data.currency, 'paystack', reference, 'completed', loan_id]
      );

      const newAccumulatedPayment = parseFloat(loan.current_cycle_accumulated_payment) + (data.amount / 100);

      if (newAccumulatedPayment >= loan.payment_cycle_amount) {
        const excessAmount = newAccumulatedPayment - loan.payment_cycle_amount;
        await handleSuccessfulPayment(client, user_id, loan.payment_cycle_amount, newPayment.rows[0].id, loan_id); // Pass client
        await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [excessAmount, loan_id]);
        res.redirect(`${process.env.FRONTEND_URL}/payments/status?status=success&message=Full payment processed&reference=${reference}&excessAmount=${excessAmount}`);
      } else {
        await client.query('UPDATE ray_loans SET current_cycle_accumulated_payment = $1 WHERE id = $2', [newAccumulatedPayment, loan_id]);
        const remainingAmount = loan.payment_cycle_amount - newAccumulatedPayment;
        res.redirect(`${process.env.FRONTEND_URL}/payments/status?status=success&message=Partial payment received&reference=${reference}&remainingAmount=${remainingAmount.toFixed(2)}`);
      }
    } else {
      await client.query('ROLLBACK'); // Rollback if Paystack verification fails
      res.redirect(`${process.env.FRONTEND_URL}/payments/status?status=failed&message=Payment verification failed`);
    }

    await client.query('COMMIT'); // Commit the transaction

  } catch (err) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error('Paystack callback error:', err.message);
    res.redirect(`${process.env.FRONTEND_URL}/payments/status?status=failed&message=An error occurred during verification`);
  } finally {
    client.release(); // Release the client
  }
});

module.exports = router;
