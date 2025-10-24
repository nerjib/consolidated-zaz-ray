const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const can = require('../middleware/can');
const { query, pool } = require('../config/database');
const { handleSuccessfulPayment } = require('../services/paymentService');
const { handleOnetimePayment } = require('../services/unlockService');
const { createDedicatedAccount } = require('../services/paystackService');

// @route   POST api/loans
// @desc    Create a new loan for a customer within the business
// @access  Private (loan:create)
router.post('/', auth, can('loan:create', ['super-agent', 'agent']), async (req, res) => {
  console.log({bod: req.body})
  const { customer_id, device_id, term_months, customer_address, customer_geocode, down_payment = 0, guarantor_details, agent_id, payment_frequency = 'monthly', signed_agreement_base64 } = req.body;
  const { business_id, id: creatorId } = req.user;
  let client;

  try {
    if (!customer_id || !device_id || term_months === undefined || !signed_agreement_base64) {
      return res.status(400).json({ msg: 'Please provide customer_id, device_id, signed agreement and term_months' });
    }

    // Validate signed_agreement_base64 size if provided
    if (signed_agreement_base64 && (typeof signed_agreement_base64 !== 'string' || signed_agreement_base64.length > 500 * 1024)) {
      return res.status(400).json({ msg: 'Invalid or excessively large signed agreement Base64 string (max 500KB).' });
    }

    const customer = await query(`SELECT id FROM ray_users WHERE id = $1 AND role= 'customer' AND business_id = $2`, [customer_id, business_id]);
    if (customer.rows.length === 0) {
      return res.status(404).json({ msg: 'Customer not found in your business.' });
    }

    const deviceResult = await query('SELECT id, status, device_type_id FROM ray_devices WHERE id = $1 AND business_id = $2', [device_id, business_id]);
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Device not found in your business.' });
    }
    const device = deviceResult.rows[0];
    if (device.status !== 'available') {
      return res.status(400).json({ msg: 'Device is not available for assignment. Current status: ' + device.status });
    }

    const deviceTypeResult = await query('SELECT pricing, default_down_payment, onetime_commission_rate FROM ray_device_types WHERE id = $1 AND business_id = $2', [device.device_type_id, business_id]);
    if (deviceTypeResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Device type not found for this device in your business.' });
    }

    const deviceType = deviceTypeResult.rows[0];
    const pricing = deviceType.pricing;
    const default_down_payment = deviceType.default_down_payment;

    // if (down_payment !== undefined && down_payment !== null) {
    //     if (parseFloat(down_payment) !== parseFloat(default_down_payment)) {
    //         return res.status(400).json({ msg: `The provided down payment (${down_payment}) does not match the required down payment (${default_down_payment}) for this device type.` });
    //     }
    // } else {
    //     down_payment = default_down_payment || 0;
    // }
    let selectedPrice;
    if (term_months === 0) {
        selectedPrice = pricing['one-time'];
    } else {
        selectedPrice = pricing[`${term_months}-month`];
    }

    if (selectedPrice === undefined || selectedPrice === null) {
      return res.status(400).json({ msg: `Price for ${term_months}-month plan not found for this device type.` });
    }

    const loanAgentId = agent_id || creatorId;

    client = await pool.connect();
    await client.query('BEGIN');

    if (term_months === 0) {
        if (down_payment !== selectedPrice) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(400).json({ msg: `For a one-time purchase, the down_payment of ${down_payment} must match the device price of ${selectedPrice}.` });
        }

        const agentResult = await client.query('SELECT credit_balance FROM ray_users WHERE id = $1 AND business_id = $2 FOR UPDATE', [creatorId, business_id]);
        if (agentResult.rows.length === 0) throw new Error('Loan creator (agent) not found.');
        if (agentResult.rows[0].credit_balance < down_payment) throw new Error('Insufficient agent credit for the payment.');
        
        await client.query('UPDATE ray_users SET credit_balance = credit_balance - $1 WHERE id = $2', [down_payment, creatorId]);

        await client.query(
          'UPDATE ray_devices SET assigned_to = $1, assigned_by = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND business_id = $5;',
          [customer_id, loanAgentId, 'assigned', device_id, business_id]
        );

        const newLoanResult = await client.query(
          'INSERT INTO ray_loans (customer_id, device_id, total_amount, amount_paid, balance, term_months, status, down_payment, agent_id, business_id, signed_agreement_base64, end_date, payment_frequency) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12) RETURNING *;',
          [customer_id, device_id, selectedPrice, selectedPrice, 0, 0, 'completed', down_payment, loanAgentId, business_id, signed_agreement_base64, payment_frequency]
        );
        const newLoan = newLoanResult.rows[0];

        const transaction_id = `FP-${Date.now()}-${newLoan.id}`;
        const paymentResult = await client.query(
          'INSERT INTO ray_payments (loan_id, user_id, amount, payment_method, status, business_id, transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, (SELECT credit_balance FROM ray_users WHERE id = $8)',
          [newLoan.id, customer_id, down_payment, 'agent-credit', 'completed', business_id, transaction_id, creatorId]
        );
        const newPaymentId = paymentResult.rows[0].id;
        const agentNewBalance = paymentResult.rows[0].credit_balance;

        await client.query(
          'INSERT INTO ray_credit_transactions (user_id, transaction_type, amount, new_balance, reference_id, description, created_by, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [creatorId, 'payment', down_payment, agentNewBalance, newPaymentId, `Full payment for loan ${newLoan.id}`, creatorId, business_id]
        );

        const token = await handleOnetimePayment(client, {
            customer_id,
            device_id,
            business_id,
            amount: down_payment,
            payment_id: newPaymentId,
            onetime_commission_rate: Number(deviceType?.onetime_commission_rate),
            agent_id: creatorId
        });

        await client.query('COMMIT');
        res.json({ msg: 'Device purchased successfully', loan: newLoan, token });

    } else {
        const activeDeal = await query(
          'SELECT allowed_payment_frequencies FROM ray_deals WHERE device_type_id = $1 AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE AND business_id = $2',
          [device.device_type_id, business_id]
        );
        if (activeDeal.rows.length > 0 && !activeDeal.rows[0].allowed_payment_frequencies.includes(payment_frequency)) {
          return res.status(400).json({ msg: `Payment frequency '${payment_frequency}' is not allowed for this device type due to an active deal.` });
        }

        if (down_payment > 0) {
          const agentResult = await client.query('SELECT credit_balance FROM ray_users WHERE id = $1 AND business_id = $2 FOR UPDATE', [creatorId, business_id]);
          if (agentResult.rows.length === 0) {
            throw new Error('Loan creator (agent) not found.');
          }
          const agentCredit = agentResult.rows[0].credit_balance;
          if (agentCredit < down_payment) {
            throw new Error('Insufficient agent credit for down payment.');
          }
          await client.query('UPDATE ray_users SET credit_balance = credit_balance - $1 WHERE id = $2 AND business_id = $3', [down_payment, creatorId, business_id]);
        }

        await client.query(
          'UPDATE ray_devices SET assigned_to = $1, assigned_by = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND business_id = $5;',
          [customer_id, loanAgentId, 'assigned', device_id, business_id]
        );

        const financed_amount = selectedPrice - down_payment;
        let payment_cycle_amount = 0;
        let next_payment_date = new Date();
        if (term_months > 0) {
            switch (payment_frequency) {
              case 'daily':
                payment_cycle_amount = financed_amount / (term_months * 30);
                next_payment_date.setDate(next_payment_date.getDate() + 1);
                break;
              case 'weekly':
                payment_cycle_amount = financed_amount / (term_months * 4);
                next_payment_date.setDate(next_payment_date.getDate() + 7);
                break;
              default: // monthly
                payment_cycle_amount = financed_amount / term_months;
                next_payment_date.setMonth(next_payment_date.getMonth() + 1);
                break;
            }
        }

        const newLoanResult = await client.query(
          'INSERT INTO ray_loans (customer_id, device_id, total_amount, amount_paid, balance, term_months, payment_amount_per_cycle, down_payment, next_payment_date, guarantor_details, agent_id, status, payment_frequency, payment_cycle_amount, business_id, customer_geocode, customer_address, signed_agreement_base64) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *;',
          [customer_id, device_id, financed_amount, 0, financed_amount, term_months, payment_cycle_amount, down_payment, next_payment_date, guarantor_details, loanAgentId, 'active', payment_frequency, payment_cycle_amount, business_id, customer_geocode, customer_address, signed_agreement_base64]
        );
        const newLoan = newLoanResult.rows[0];

        if (down_payment > 0) {
          const transaction_id = `DP-${Date.now()}-${newLoan.id}`;
          const paymentResult = await client.query(
            'INSERT INTO ray_payments (loan_id, user_id, amount, payment_method, status, business_id, transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, (SELECT credit_balance FROM ray_users WHERE id = $8)',
            [newLoan.id, customer_id, down_payment, 'agent-credit', 'completed', business_id, transaction_id, creatorId]
          );
          const newPaymentId = paymentResult.rows[0].id;
          const agentNewBalance = paymentResult.rows[0].credit_balance;

          await client.query(
            'INSERT INTO ray_credit_transactions (user_id, transaction_type, amount, new_balance, reference_id, description, created_by, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [creatorId, 'down_payment', down_payment, agentNewBalance, newPaymentId, `Down payment for loan ${newLoan.id}`, creatorId, business_id]
          );

          await handleSuccessfulPayment(client, customer_id, down_payment, newPaymentId, newLoan.id, business_id, true);
        }

        await client.query('COMMIT');
        res.json({ msg: 'Loan created successfully', loan: newLoan });

        // Asynchronously create Paystack dedicated account without blocking the response
        (async () => {
          try {
            const customerResult = await query('SELECT * FROM ray_users WHERE id = $1', [customer_id]);
            const businessResult = await query('SELECT * FROM businesses WHERE id = $1', [business_id]);

            if (customerResult.rows.length > 0 && businessResult.rows.length > 0) {
              await createDedicatedAccount(newLoan, customerResult.rows[0], businessResult.rows[0]);
            } else {
                console.error(`Could not find customer or business to create dedicated account for loan ${newLoan.id}`);
            }
          } catch (err) {
            console.error(`Error creating dedicated account for loan ${newLoan.id}:`, err);
          }
        })();
    }
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error(err.message);
    if (err.message === 'Insufficient agent credit for down payment.') {
        return res.status(400).json({ msg: err.message });
    }
    res.status(500).send('Server Error');
  } finally {
    if (client) {
      client.release();
    }
  }
});

// @route   GET api/loans
// @desc    Get all loans for the business
// @access  Private (loan:read)
router.get('/', auth, can('loan:read'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const loans = await query(`
      SELECT
        l.id AS loan_id,
        l.created_at AS start_date,
        u.username AS customer_name,
        l.total_amount AS loan_amount,
        (l.amount_paid / l.total_amount) * 100 AS payment_progress,
        l.status,
        l.next_payment_date AS next_payment,
        l.payment_cycle_amount
      FROM ray_loans l
      JOIN ray_users u ON l.customer_id = u.id
      WHERE l.business_id = $1
      ORDER BY l.id ASC
    `, [business_id]);
    res.json(loans.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/loans/:id
// @desc    Get loan by ID from the business
// @access  Private (loan:read)
router.get('/:id', auth, can('loan:read'), async (req, res) => {
  const { id } = req.params;
  const { id: requesterId, permissions, business_id } = req.user;

  try {
    const loanResult = await query(`
      SELECT 
      l.id AS loan_id,
        l.customer_id,
        l.total_amount AS "totalAmount",
        l.amount_paid AS "paidAmount",
        l.balance AS "remainingAmount",
        l.agent_id,
        l.status,
        l.signed_agreement_base64 AS "signedAgreement",
        l.created_at AS "startDate",
        l.end_date AS "endDate",
        l.next_payment_date AS "nextPaymentDate",
        l.payment_amount_per_cycle AS "paymentAmountPerCycle",
        l.down_payment AS "downPayment",
        l.term_months AS "termMonths",
        l.guarantor_details AS "guarantorDetails",
        (l.amount_paid / l.total_amount) * 100 AS progress,
        json_build_object(
          'id', c.id,
          'name', c.username,
          'phone', c.phone_number,
          'email', c.email
        ) AS customer,
        json_build_object(
          'id', d.id,
          'serialNumber', d.serial_number
        ) AS device,
        json_build_object(
          'id', a.id,
          'username', a.username
        ) AS agent,
        (SELECT json_agg(p.*) FROM ray_payments p WHERE p.loan_id = l.id) AS "paymentHistory"
      FROM ray_loans l
      JOIN ray_users c ON l.customer_id = c.id
      JOIN ray_devices d ON l.device_id = d.id
      LEFT JOIN ray_users a ON l.agent_id = a.id
      WHERE l.id = $1 AND l.business_id = $2
    `, [id, business_id]);

    if (loanResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Loan not found in your business.' });
    }

    const loan = loanResult.rows[0];

    // Allow access if user is an admin or if they are the customer who owns the loan
    if (loan.customer_id !== requesterId && !permissions.includes('loan:read')) {
      return res.status(403).json({ msg: 'Access denied: You do not have permission to view this loan.' });
    }

    res.json(loan);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/loans/customer/:customerId
// @desc    Get all loans for a specific customer in the business
// @access  Private (loan:read)
router.get('/customer/:customerId', auth, can('loan:read', ['super-agent', 'agent']), async (req, res) => {
  const { customerId } = req.params;
  const { id: requesterId, permissions, business_id } = req.user;

  try {
    // Allow access if user is an admin or if they are the customer being queried
    // if (customerId !== requesterId && !permissions.includes('loan:read')) {
    //   return res.status(403).json({ msg: 'Access denied: You can only view your own loans.' });
    // }

    const loans = await query(`
      SELECT
        l.id,
        l.total_amount AS "totalAmount",
        l.amount_paid AS "amountPaid",
        l.balance AS "remainingAmount",
        l.status,
        l.next_payment_date AS "nextPaymentDate",
        l.payment_amount_per_cycle AS "paymentAmountPerCycle",
        dt.device_name AS "deviceType",
        d.serial_number AS "deviceId",
        (l.amount_paid / l.total_amount) * 100 AS progress
      FROM ray_loans l
      JOIN ray_devices d ON l.device_id = d.id
      JOIN ray_device_types dt ON d.device_type_id = dt.id
      WHERE l.customer_id = $1 AND l.business_id = $2
      ORDER BY l.next_payment_date ASC
    `, [customerId, business_id]);

    res.json(loans.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/loans/:id
// @desc    Update loan information in the business
// @access  Private (loan:update)
router.put('/:id', auth, can('loan:update'), async (req, res) => {
  const { id } = req.params;
  let { total_amount, term_months, status, next_payment_date, guarantor_details } = req.body;
  const { business_id } = req.user;

  try {
    const loanResult = await query('SELECT total_amount, term_months, payment_frequency FROM ray_loans WHERE id = $1 AND business_id = $2', [id, business_id]);
    if (loanResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Loan not found in your business.' });
    }
    const existingLoan = loanResult.rows[0];

    total_amount = total_amount !== undefined ? total_amount : existingLoan.total_amount;
    term_months = term_months !== undefined ? term_months : existingLoan.term_months;

    let payment_amount_per_cycle;
    switch (existingLoan.payment_frequency) {
      case 'daily': payment_amount_per_cycle = total_amount / (term_months * 30.4375); break;
      case 'weekly': payment_amount_per_cycle = total_amount / (term_months * 4.3482); break;
      default: payment_amount_per_cycle = total_amount / term_months; break;
    }

    const updatedLoan = await query(
      `UPDATE ray_loans SET
        total_amount = COALESCE($1, total_amount),
        term_months = COALESCE($2, term_months),
        payment_amount_per_cycle = $3,
        status = COALESCE($4, status),
        next_payment_date = COALESCE($5, next_payment_date),
        guarantor_details = COALESCE($6, guarantor_details),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND business_id = $8 RETURNING *`,
      [total_amount, term_months, payment_amount_per_cycle, status, next_payment_date, guarantor_details, id, business_id]
    );

    res.json({ msg: 'Loan updated successfully', loan: updatedLoan.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/loans/:id/approve
// @desc    Approve a pending loan in the business
// @access  Private (loan:approve)
router.put('/:id/approve', auth, can('loan:approve'), async (req, res) => {
  const { id } = req.params;
  const { business_id } = req.user;

  try {
    const loan = await query('SELECT id, status FROM ray_loans WHERE id = $1 AND business_id = $2', [id, business_id]);
    if (loan.rows.length === 0) {
      return res.status(404).json({ msg: 'Loan not found in your business.' });
    }
    if (loan.rows[0].status !== 'pending') {
      return res.status(400).json({ msg: 'Loan is not pending approval. Current status: ' + loan.rows[0].status });
    }

    const approvedLoan = await query(
      'UPDATE ray_loans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3 RETURNING *;',
      ['active', id, business_id]
    );

    res.json({ msg: 'Loan approved successfully', loan: approvedLoan.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/loans/:id/pause
// @desc    Pause a loan
// @access  Private (loan:update)
router.put('/:id/pause', auth, can('loan:update'), async (req, res) => {
  const { id } = req.params;
  const { business_id } = req.user;
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const loanResult = await client.query('SELECT id, status, device_id FROM ray_loans WHERE id = $1 AND business_id = $2 FOR UPDATE', [id, business_id]);
    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Loan not found in your business.' });
    }
    const loan = loanResult.rows[0];

    if (loan.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: `Loan is not active. Current status: ${loan.status}` });
    }

    await client.query(
      'UPDATE ray_loans SET status = $1, paused_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3;',
      ['paused', id, business_id]
    );

    await client.query(
      'UPDATE ray_devices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3;',
      ['faulty', loan.device_id, business_id]
    );

    await client.query('COMMIT');
    res.json({ msg: 'Loan paused successfully' });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  } finally {
    if (client) {
      client.release();
    }
  }
});

// @route   PUT api/loans/:id/resume
// @desc    Resume a loan
// @access  Private (loan:update)
router.put('/:id/resume', auth, can('loan:update'), async (req, res) => {
  const { id } = req.params;
  const { business_id } = req.user;
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const loanResult = await client.query('SELECT id, status, device_id, paused_at, next_payment_date FROM ray_loans WHERE id = $1 AND business_id = $2 FOR UPDATE', [id, business_id]);
    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Loan not found in your business.' });
    }
    const loan = loanResult.rows[0];

    if (loan.status !== 'paused') {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: `Loan is not paused. Current status: ${loan.status}` });
    }

    const pausedAt = new Date(loan.paused_at);
    const now = new Date();
    const pausedDuration = now.getTime() - pausedAt.getTime();

    const nextPaymentDate = new Date(loan.next_payment_date);
    const newNextPaymentDate = new Date(nextPaymentDate.getTime() + pausedDuration);

    await client.query(
      'UPDATE ray_loans SET status = $1, resumed_at = CURRENT_TIMESTAMP, next_payment_date = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND business_id = $4;',
      ['active', newNextPaymentDate, id, business_id]
    );

    await client.query(
      'UPDATE ray_devices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3;',
      ['assigned', loan.device_id, business_id]
    );

    await client.query('COMMIT');
    res.json({ msg: 'Loan resumed successfully' });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  } finally {
    if (client) {
      client.release();
    }
  }
});


// const  backfillLoanAccounts  = require('../scripts/backfill_dedicated_accounts');

// @route   POST api/loans/backfill-accounts
// @desc    Trigger backfill of dedicated accounts for loans
// @access  Private (loan:create)
router.post('/backfill-accounts', auth, can('loan:create'), async (req, res) => {
  try {
    // await backfillLoanAccounts();
    res.json({ msg: 'Backfill of dedicated accounts initiated successfully.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;