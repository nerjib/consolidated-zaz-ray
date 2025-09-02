const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   GET api/customers
// @desc    Get all customers information for the business
// @access  Private (Admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const customers = await query(`
      SELECT
        u.id,
        u.role,
        u.username AS name,
        u.email,
        u.phone_number AS phone,
        u.address AS location,
        u.city,
        u.state,
        u.id_number AS "idNumber",
        u.created_at AS "joinDate",
        u.status,
        u.credit_score AS "creditScore",
        (SELECT COUNT(*) FROM ray_loans WHERE customer_id = u.id AND business_id = $1) AS "totalLoans",
        (SELECT COUNT(*) FROM ray_loans WHERE customer_id = u.id AND status = 'active' AND business_id = $1) AS "activeLoans",
        (SELECT SUM(total_amount) FROM ray_loans WHERE customer_id = u.id AND business_id = $1) AS "totalBorrowed",
        (SELECT SUM(amount_paid) FROM ray_loans WHERE customer_id = u.id AND business_id = $1) AS "totalPaid",
        (SELECT SUM(balance) FROM ray_loans WHERE customer_id = u.id AND business_id = $1) AS "outstandingBalance",
        (SELECT COUNT(*) FROM ray_devices WHERE assigned_to = u.id AND business_id = $1) AS devices,
        (SELECT MAX(payment_date) FROM ray_payments WHERE user_id = u.id AND business_id = $1) AS "lastPayment",
        (SELECT MIN(next_payment_date) FROM ray_loans WHERE customer_id = u.id AND status = 'active' AND business_id = $1) AS "nextPaymentDue"
      FROM ray_users u
      WHERE u.role = 'customer' AND u.business_id = $1
    `, [business_id]);
    res.json(customers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/customers/me
// @desc    Get current customer's profile with comprehensive details
// @access  Private (Customer and Admin only)
router.get('/me', auth, authorize('customer', 'admin'), async (req, res) => {
  const { id: customerId, business_id } = req.user;
  try {
    const customer = await query(`
      SELECT
        u.id,
        u.username AS name,
        u.email,
        u.phone_number AS phone,
        u.state AS location,
        u.city AS county,
        u.id_number AS "idNumber",
        u.created_at AS "joinDate",
        u.status,
        u.credit_score AS "creditScore",
        (SELECT COUNT(*) FROM ray_loans WHERE customer_id = u.id AND business_id = $2) AS "totalLoans",
        (SELECT COUNT(*) FROM ray_loans WHERE customer_id = u.id AND status = 'active' AND business_id = $2) AS "activeLoans",
        (SELECT COUNT(*) FROM ray_loans WHERE customer_id = u.id AND status = 'completed' AND business_id = $2) AS "completedLoans",
        (SELECT SUM(total_amount) FROM ray_loans WHERE customer_id = u.id AND business_id = $2) AS "totalBorrowed",
        (SELECT SUM(amount_paid) FROM ray_loans WHERE customer_id = u.id AND business_id = $2) AS "totalPaid",
        (SELECT SUM(balance) FROM ray_loans WHERE customer_id = u.id AND business_id = $2) AS "outstandingBalance",
        (SELECT COUNT(*) FROM ray_devices WHERE assigned_to = u.id AND business_id = $2) AS devices,
        (SELECT MAX(payment_date) FROM ray_payments WHERE user_id = u.id AND business_id = $2) AS "lastPayment",
        (SELECT MIN(next_payment_date) FROM ray_loans WHERE customer_id = u.id AND status = 'active' AND business_id = $2) AS "nextPaymentDue",
        (SELECT json_agg(json_build_object(
          'id', l.id,
          'deviceType', dt.device_name,
          'deviceId', l.device_id,
          'principalAmount', l.total_amount,
          'totalAmount', l.total_amount,
          'paidAmount', l.amount_paid,
          'remainingAmount', l.balance,
          'paymentAmountPerCycle', l.payment_amount_per_cycle,
          'startDate', l.start_date,
          'endDate', l.end_date,
          'status', l.status,
          'nextPaymentDate', l.next_payment_date,
          'progress', (l.amount_paid / l.total_amount) * 100
        )) FROM ray_loans l JOIN ray_devices d ON l.device_id = d.id JOIN ray_device_types dt ON d.device_type_id = dt.id WHERE l.customer_id = u.id AND l.business_id = $2) AS loans,
        (SELECT json_agg(json_build_object(
          'id', d.id,
          'serialNumber', d.serial_number,
          'type', dt.device_name,
          'model', dt.device_model,
          'status', d.status,
          'installDate', d.created_at,
          'batteryLevel', 0,
          'lastSync', d.updated_at
        )) FROM ray_devices d JOIN ray_device_types dt ON d.device_type_id = dt.id WHERE d.assigned_to = u.id AND d.business_id = $2) AS devices,
        (SELECT json_agg(json_build_object(
          'id', p.id,
          'date', p.payment_date,
          'amount', p.amount,
          'method', p.payment_method,
          'reference', p.transaction_id,
          'status', p.status,
          'loanId', p.loan_id
        )) FROM ray_payments p WHERE p.user_id = u.id AND p.business_id = $2) AS "paymentHistory",
        (SELECT json_agg(json_build_object(
          'id', a.id,
          'type', 'payment',
          'message', 'Payment received: NGN ' || a.amount,
          'timestamp', a.payment_date,
          'status', 'success'
        ) ORDER BY a.payment_date DESC) FROM (SELECT * FROM ray_payments WHERE user_id = u.id AND business_id = $2 ORDER BY payment_date DESC LIMIT 5) a) AS "recentActivities"
      FROM ray_users u
      WHERE u.id = $1 AND u.role = 'customer' AND u.business_id = $2
    `, [customerId, business_id]);

    if (customer.rows.length === 0) {
      return res.status(404).json({ msg: 'Customer not found' });
    }
    res.json(customer.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/customers/:id
// @desc    Get single customer data with all details
// @access  Private (Admin, Agent, Customer - can only view their own profile)
router.get('/:id', auth, async (req, res) => {
  const { id: customerIdParam } = req.params;
  const { id: requesterId, role: requesterRole, business_id } = req.user;

  try {
    if (requesterRole === 'customer' && requesterId !== customerIdParam) {
      return res.status(403).json({ msg: 'Access denied: You can only view your own profile.' });
    }

    const customer = await query(`
      SELECT
        u.id,
        u.username,
        u.name AS name,
        u.email,
        u.phone_number AS phone,
        u.state,
        u.city,
        u.address,
        u.id_number AS "idNumber",
        u.created_at AS "joinDate",
        u.status,
        u.credit_score AS "creditScore",
        (SELECT COUNT(*) FROM ray_loans WHERE customer_id = u.id AND business_id = $2) AS "totalLoans",
        (SELECT COUNT(*) FROM ray_loans WHERE customer_id = u.id AND status = 'active' AND business_id = $2) AS "activeLoans",
        (SELECT COUNT(*) FROM ray_loans WHERE customer_id = u.id AND status = 'completed' AND business_id = $2) AS "completedLoans",
        (SELECT SUM(total_amount) FROM ray_loans WHERE customer_id = u.id AND business_id = $2) AS "totalBorrowed",
        (SELECT SUM(amount_paid) FROM ray_loans WHERE customer_id = u.id AND business_id = $2) AS "totalPaid",
        (SELECT SUM(balance) FROM ray_loans WHERE customer_id = u.id AND business_id = $2) AS "outstandingBalance",
        (SELECT COUNT(*) FROM ray_devices WHERE assigned_to = u.id AND business_id = $2) AS devices,
        (SELECT MAX(payment_date) FROM ray_payments WHERE user_id = u.id AND business_id = $2) AS "lastPayment",
        (SELECT MIN(next_payment_date) FROM ray_loans WHERE customer_id = u.id AND status = 'active' AND business_id = $2) AS "nextPaymentDue",
        (SELECT json_agg(json_build_object(
          'id', l.id,
          'deviceType', dt.device_name,
          'deviceId', l.device_id,
          'principalAmount', l.total_amount,
          'totalAmount', l.total_amount,
          'paidAmount', l.amount_paid,
          'accumulatedPayment', l.current_cycle_accumulated_payment,
          'remainingAmount', l.balance,
          'paymentAmountPerCycle', l.payment_amount_per_cycle,
          'startDate', l.start_date,
          'endDate', l.end_date,
          'status', l.status,
          'nextPaymentDate', l.next_payment_date,
          'progress', (l.amount_paid / l.total_amount) * 100
        )) FROM ray_loans l JOIN ray_devices d ON l.device_id = d.id JOIN ray_device_types dt ON d.device_type_id = dt.id WHERE l.customer_id = u.id AND l.business_id = $2) AS loans,
        (SELECT json_agg(json_build_object(
          'id', d.id,
          'serialNumber', d.serial_number,
          'type', dt.device_name,
          'model', dt.device_model,
          'status', d.status,
          'installDate', d.created_at,
          'batteryLevel', 0,
          'lastSync', d.updated_at
        )) FROM ray_devices d JOIN ray_device_types dt ON d.device_type_id = dt.id WHERE d.assigned_to = u.id AND d.business_id = $2) AS devices,
        (SELECT json_agg(json_build_object(
          'id', p.id,
          'date', p.payment_date,
          'amount', p.amount,
          'method', p.payment_method,
          'reference', p.transaction_id,
          'status', p.status,
          'loanId', p.loan_id
        )) FROM ray_payments p WHERE p.user_id = u.id AND p.business_id = $2) AS "paymentHistory",
        (SELECT json_agg(json_build_object(
          'id', a.id,
          'type', 'payment',
          'message', 'Payment received: NGN ' || a.amount,
          'timestamp', a.payment_date,
          'status', 'success'
        ) ORDER BY a.payment_date DESC) FROM (SELECT * FROM ray_payments WHERE user_id = u.id AND business_id = $2 ORDER BY payment_date DESC LIMIT 5) a) AS "recentActivities"
      FROM ray_users u
      WHERE u.id = $1 AND u.role = 'customer' AND u.business_id = $2
    `, [customerIdParam, business_id]);

    if (customer.rows.length === 0) {
      return res.status(404).json({ msg: 'Customer not found in your business.' });
    }

    res.json(customer.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/customers/:id
// @desc    Update customer information
// @access  Private (Admin, Agent, Customer - can only update their own profile)
router.put('/:id', auth, async (req, res) => {
  const { id: customerIdToUpdate } = req.params;
  const { name, email, phone, idNumber, occupation, monthly_income, location, county, status } = req.body;
  const { id: requesterId, role: requesterRole, business_id } = req.user;

  try {
    if (requesterRole === 'customer' && requesterId !== customerIdToUpdate) {
      return res.status(403).json({ msg: 'Access denied: You can only update your own profile.' });
    }

    const updatedCustomer = await query(
      `UPDATE ray_users SET
        username = COALESCE($1, username),
        email = COALESCE($2, email),
        phone_number = COALESCE($3, phone_number),
        id_number = COALESCE($4, id_number),
        occupation = COALESCE($5, occupation),
        monthly_income = COALESCE($6, monthly_income),
        state = COALESCE($7, state),
        city = COALESCE($8, city),
        status = COALESCE($9, status)
      WHERE id = $10 AND business_id = $11 RETURNING *`,
      [name, email, phone, idNumber, occupation, monthly_income, location, county, status, customerIdToUpdate, business_id]
    );

    if (updatedCustomer.rows.length === 0) {
      return res.status(404).json({ msg: 'Customer not found in your business.' });
    }

    res.json({ msg: 'Customer updated successfully', customer: updatedCustomer.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

