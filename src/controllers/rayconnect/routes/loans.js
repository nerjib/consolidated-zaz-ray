const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   POST api/loans
// @desc    Create a new loan (Admin/Agent)
// @access  Private (Admin, Agent)
router.post('/', auth, authorize('admin', 'agent', 'super-agent'), async (req, res) => {
  const { customer_id, device_id, device_price, term_months, down_payment = 0, guarantor_details, agent_id, payment_frequency = 'monthly' } = req.body;

  try {
    // Basic validation
    if (!customer_id || !device_id || !device_price || !term_months) {
      return res.status(400).json({ msg: 'Please provide customer_id, device_id, device_price, and term_months' });
    }

    // Check if customer and device exist
    const customer = await query(`SELECT id FROM users WHERE id = $1 AND role= $2`, [customer_id, 'customer']);
    // console.log(customer);
    if (customer.rows.length === 0) {
      return res.status(404).json({ msg: 'Customer not found' });
    }

    const device = await query('SELECT id, status FROM devices WHERE id = $1', [device_id]);
    if (device.rows.length === 0) {
      return res.status(404).json({ msg: 'Device not found' });
    }

    if (device.rows[0].status !== 'available') {
      return res.status(400).json({ msg: 'Device is not available for assignment. Current status: ' + device.rows[0].status });
    }

    console.log('>>>>>>>>>', req.user.id, '££££££', device_id, 'cid', customer_id);
    // Assign device
    const assignedDevice = await query(
      'UPDATE devices SET assigned_to = $1, assigned_by = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *;',
      [customer_id, req.user.id, 'assigned', device_id]
    );
    console.log('lllllllll', assignedDevice.rows[0]);
    const total_amount = device_price - down_payment;
    let payment_cycle_amount;
    let next_payment_date = new Date();

    switch (payment_frequency) {
      case 'daily':
        payment_cycle_amount = total_amount / (term_months * 30);
        next_payment_date.setDate(next_payment_date.getDate() + 1);
        break;
      case 'weekly':
        payment_cycle_amount = total_amount / (term_months * 4);
        next_payment_date.setDate(next_payment_date.getDate() + 7);
        break;
      default: // monthly
        payment_cycle_amount = total_amount / term_months;
        next_payment_date.setMonth(next_payment_date.getMonth() + 1);
        break;
    }

    const loanStatus = req.user.role === 'admin' ? 'active' : 'active'; // Determine status based on user role

    const newLoan = await query(
      'INSERT INTO loans (customer_id, device_id, total_amount, amount_paid, balance, term_months, payment_amount_per_cycle, down_payment, next_payment_date, guarantor_details, agent_id, status, payment_frequency, payment_cycle_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *;',
      [customer_id, device_id, total_amount, down_payment, total_amount, term_months, payment_cycle_amount, down_payment, next_payment_date, guarantor_details, agent_id ?? req.user.id, loanStatus, payment_frequency, payment_cycle_amount]
    );

    res.json({ msg: 'Loan created successfully', loan: newLoan.rows[0] });

    // Update device status and assign to customer/agent
    await query(
      `
      UPDATE devices 
      SET status = 'assigned', customer_id = $1, install_date = $2, assigned_by = $3
      WHERE id = $4
    `,
      [customer_id, next_payment_date, req.user.id, device_id]
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/loans
// @desc    Get all loans (Admin)
// @access  Private (Admin)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const loans = await query(`
      SELECT
        l.id AS loan_id,
        u.username AS customer_name,
        l.total_amount AS loan_amount,
        (l.amount_paid / l.total_amount) * 100 AS payment_progress,
        l.status,
        l.next_payment_date AS next_payment,
        l.payment_cycle_amount
      FROM loans l
      JOIN users u ON l.customer_id = u.id
      ORDER BY l.id ASC
    `);
    res.json(loans.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/loans/:id
// @desc    Get loan by ID (Admin, Agent, Customer if it's their loan)
// @access  Private
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const loan = await query(`
      SELECT
        l.id AS loan_id,
        l.total_amount AS "totalAmount",
        l.amount_paid AS "paidAmount",
        l.balance AS "remainingAmount",
        l.agent_id,
        l.status,
        l.start_date AS "startDate",
        l.end_date AS "endDate",
        l.next_payment_date AS "nextPaymentDate",
        l.payment_cycle_amount AS "paymentAmountPerCycle",
        l.down_payment AS "downPayment",
        l.term_months AS "termMonths",
        l.guarantor_details AS "guarantorDetails",
        (l.amount_paid / l.total_amount) * 100 AS progress,
        json_build_object(
          'id', c.id,
          'name', c.username,
          'phone', c.phone_number,
          'email', c.email,
          'location', c.state,
          'idNumber', c.id_number,
          'creditScore', c.credit_score
        ) AS customer,
        json_build_object(
          'id', d.id,
          'serialNumber', d.serial_number,
          'assignedBy', d.assigned_by,
          'assignedTo', d.customer_id,
          'type', dt.device_name,
          'model', dt.device_model,
          'status', d.status
        ) AS device,
        json_build_object(
          'id', a.id,
          'username', a.username,
          'email', a.email
        ) AS agent,
        (SELECT json_agg(json_build_object(
          'id', p.id,
          'date', p.payment_date,
          'amount', p.amount,
          'method', p.payment_method,
          'reference', p.transaction_id,
          'status', p.status,
          'lateFee', 0 -- Placeholder for now
        ) ORDER BY p.payment_date DESC) FROM payments p WHERE p.loan_id = l.id) AS "paymentHistory"
      FROM loans l
      JOIN users c ON l.customer_id = c.id
      JOIN devices d ON l.device_id = d.id
      JOIN device_types dt ON d.device_type_id = dt.id
      LEFT JOIN users a ON l.agent_id = a.id
      WHERE l.id = $1
    `, [id]);

    if (loan.rows.length === 0) {
      return res.status(404).json({ msg: 'Loan not found' });
    }

    // Authorize: Admin can view any loan, Agent can view any loan, Customer can only view their own loan
    if (req.user.role === 'customer' && loan.rows[0].customer.id !== req.user.id) {
      return res.status(403).json({ msg: 'Access denied: You can only view your own loans.' });
    }

    res.json(loan.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/loans/customer/:customerId
// @desc    Get all loans for a specific customer
// @access  Private (Admin, Agent, Customer - can only view their own loans)
router.get('/customer/:customerId', auth, async (req, res) => {
  const { customerId } = req.params;

  try {
    // Authorize: Admin and Agent can view any customer's loans, Customer can only view their own loans
    if (req.user.role === 'customer' && req.user.id !== customerId) {
      return res.status(403).json({ msg: 'Access denied: You can only view your own loans.' });
    }

    const loans = await query(`
      SELECT
        l.id,
        l.total_amount AS "totalAmount",
        l.amount_paid AS "amountPaid",
        l.balance AS "remainingAmount",
        l.status,
        l.next_payment_date AS "nextPaymentDate",
        dt.device_name AS "deviceType",
        d.serial_number AS "deviceId",
        (l.amount_paid / l.total_amount) * 100 AS progress
      FROM loans l
      JOIN devices d ON l.device_id = d.id
      JOIN device_types dt ON d.device_type_id = dt.id
      WHERE l.customer_id = $1
      ORDER BY l.next_payment_date ASC
    `, [customerId]);

    res.json(loans.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/loans/:id
// @desc    Update loan information
// @access  Private (Admin, Agent)
router.put('/:id', auth, authorize('admin', 'agent'), async (req, res) => {
  const { id } = req.params;
  let { total_amount, term_months, status, next_payment_date, guarantor_details } = req.body;

  try {
    const loanResult = await query('SELECT total_amount, term_months FROM loans WHERE id = $1', [id]);
    if (loanResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Loan not found' });
    }

    const existingLoan = loanResult.rows[0];

    // Use existing values if not provided in the request
    total_amount = total_amount !== undefined ? total_amount : existingLoan.total_amount;
    term_months = term_months !== undefined ? term_months : existingLoan.term_months;

        // Recalculate payment_amount_per_cycle based on payment_frequency
    let payment_amount_per_cycle;
    switch (existingLoan.payment_frequency) {
      case 'daily':
        payment_amount_per_cycle = total_amount / (term_months * 30.4375);
        break;
      case 'weekly':
        payment_amount_per_cycle = total_amount / (term_months * 4.3482);
        break;
      default: // monthly
        payment_amount_per_cycle = total_amount / term_months;
        break;
    }

    const updatedLoan = await query(
      `UPDATE loans SET
        total_amount = COALESCE($1, total_amount),
        term_months = COALESCE($2, term_months),
        payment_amount_per_cycle = $3,
        status = COALESCE($4, status),
        next_payment_date = COALESCE($5, next_payment_date),
        guarantor_details = COALESCE($6, guarantor_details),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 RETURNING *`,
      [total_amount, term_months, payment_amount_per_cycle, status, next_payment_date, guarantor_details, id]
    );

    res.json({ msg: 'Loan updated successfully', loan: updatedLoan.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/loans/:id/approve
// @desc    Approve a pending loan (Admin only)
// @access  Private (Admin)
router.put('/:id/approve', auth, authorize('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const loan = await query('SELECT id, status FROM loans WHERE id = $1', [id]);

    if (loan.rows.length === 0) {
      return res.status(404).json({ msg: 'Loan not found' });
    }

    if (loan.rows[0].status !== 'pending') {
      return res.status(400).json({ msg: 'Loan is not pending approval. Current status: ' + loan.rows[0].status });
    }

    const approvedLoan = await query(
      'UPDATE loans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;',
      ['active', id]
    );

    res.json({ msg: 'Loan approved successfully', loan: approvedLoan.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
