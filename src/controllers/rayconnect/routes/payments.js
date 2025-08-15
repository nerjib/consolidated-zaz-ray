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

    if (!loan_id) {
      return res.status(400).json({ msg: 'Loan ID is required for manual payments.' });
    }

    const loan = await query('SELECT payment_cycle_amount FROM ray_loans WHERE id = $1', [loan_id]);
    if (loan.rows.length === 0) {
      return res.status(404).json({ msg: 'Loan not found.' });
    }

    if (amount < loan.rows[0].payment_cycle_amount) {
      return res.status(400).json({ msg: `Payment amount must be at least the payment cycle amount of ${loan.rows[0].payment_cycle_amount}.` });
    }

  try {
    // Check if user exists and is a customer
    const user = await query('SELECT id, role FROM ray_users WHERE id = $1 AND role = $2', [user_id, 'customer']);
    if (user.rows.length === 0) {
      return res.status(404).json({ msg: 'Customer not found' });
    }

    const newPayment = await query(
      'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;',
      [user_id, amount, currency || 'NGN', payment_method || 'manual', transaction_id || null, 'completed', loan_id]
    );

    await handleSuccessfulPayment(user_id, amount, newPayment.rows[0].id, loan_id);

    res.json({ msg: 'Manual payment recorded successfully', payment: newPayment.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/payments/paystack/verify
// @desc    Verify a Paystack payment
// @access  Private (Customer, Admin)
router.post('/paystack/verify', auth, authorize('customer', 'admin'), async (req, res) => {
  const { reference, user_id, amount } = req.body; // user_id is the customer making the payment

  if (!reference) {
    return res.status(400).json({ msg: 'Payment reference is required' });
  }

  try {
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer kkkk`,
        },
      }
    );

    const { status, data } = paystackResponse.data;

    if (status && data.status === 'success') {
      // Payment is successful, record it in your database
      const newPayment = await query(
        'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;',
        [user_id, data.amount / 100, data.currency, 'paystack', data.reference, 'completed'] // Paystack amount is in kobo/cents
      );

      await handleSuccessfulPayment(user_id, data.amount / 100, newPayment.rows[0].id);

      res.json({ msg: 'Paystack payment verified and recorded', payment: newPayment.rows[0] });
    } else {
      res.status(400).json({ msg: 'Paystack payment verification failed', details: data });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
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

      if (!user_id || !loan_id) {
        console.error('Webhook: Missing user_id or loan_id in metadata');
        return res.status(400).send('Missing metadata');
      }

      try {
        // Check if payment already recorded to prevent duplicates
        const existingPayment = await query('SELECT id FROM ray_payments WHERE transaction_id = $1', [reference]);
        if (existingPayment.rows.length > 0) {
          return res.status(200).send('Payment already processed');
        }

        const newPayment = await query(
          'INSERT INTO ray_payments (user_id, amount, currency, payment_method, transaction_id, status, loan_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;',
          [user_id, amount / 100, currency, 'paystack', reference, 'completed', loan_id]
        );

        await handleSuccessfulPayment(user_id, amount / 100, newPayment.rows[0].id, loan_id);
        res.status(200).send('Webhook received and payment processed');
      } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(500).send('Internal Server Error');
      }
    }
  } else {
    res.status(400).send('Invalid signature');
  }
});

// @route   POST api/payments/paystack/initiate
// @desc    Initiate a Paystack transaction
// @access  Private (Customer)
router.post('/paystack/initiate', auth, authorize('customer'), async (req, res) => {
  const { amount, email, reference, metadata } = req.body; // metadata should contain user_id and loan_id

  try {
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
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

module.exports = router;
