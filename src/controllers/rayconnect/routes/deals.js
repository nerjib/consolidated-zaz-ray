const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');
const can = require('../middleware/can');

// @route   POST api/deals
// @desc    Create a new deal for the business
// @access  Private (Admin only)
router.post('/', auth, can('deals:create'), async (req, res) => {
  const { deal_name, device_type_id, allowed_payment_frequencies, start_date, end_date } = req.body;
  const { business_id } = req.user;

  try {
    if (!deal_name || !device_type_id || !allowed_payment_frequencies || !Array.isArray(allowed_payment_frequencies) || allowed_payment_frequencies.length === 0 || !start_date || !end_date) {
      return res.status(400).json({ msg: 'Please provide deal_name, device_type_id, allowed_payment_frequencies (as a non-empty array), start_date, and end_date.' });
    }

    const deviceType = await query('SELECT id FROM ray_device_types WHERE id = $1 AND business_id = $2', [device_type_id, business_id]);
    if (deviceType.rows.length === 0) {
      return res.status(404).json({ msg: 'Device type not found in your business.' });
    }

    const newDeal = await query(
      'INSERT INTO ray_deals (deal_name, device_type_id, allowed_payment_frequencies, start_date, end_date, business_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;',
      [deal_name, device_type_id, JSON.stringify(allowed_payment_frequencies), start_date, end_date, business_id]
    );
    res.json({ msg: 'Deal created successfully', deal: newDeal.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/deals
// @desc    Get all deals for the business 
// @access  Private (Admin only)
router.get('/', auth, can('deals:read'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const deals = await query('SELECT * FROM ray_deals WHERE business_id = $1', [business_id]);
    res.json(deals.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/deals/:id
// @desc    Get a specific deal by ID for the business
// @access  Private (Admin only)
router.get('/:id', auth, can('deals:read'), async (req, res) => {
  const { id } = req.params;
  const { business_id } = req.user;
  try {
    const deal = await query('SELECT * FROM ray_deals WHERE id = $1 AND business_id = $2', [id, business_id]);
    if (deal.rows.length === 0) {
      return res.status(404).json({ msg: 'Deal not found in your business.' });
    }
    res.json(deal.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/deals/:id
// @desc    Update an existing deal for the business
// @access  Private (Admin only)
router.put('/:id', auth, can('deals:update'), async (req, res) => {
  const { id } = req.params;
  const { deal_name, device_type_id, allowed_payment_frequencies, start_date, end_date } = req.body;
  const { business_id } = req.user;

  try {
    const updatedDeal = await query(
      `UPDATE ray_deals SET
        deal_name = COALESCE($1, deal_name),
        device_type_id = COALESCE($2, device_type_id),
        allowed_payment_frequencies = COALESCE($3, allowed_payment_frequencies),
        start_date = COALESCE($4, start_date),
        end_date = COALESCE($5, end_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND business_id = $7 RETURNING *;`,
      [deal_name, device_type_id, allowed_payment_frequencies ? JSON.stringify(allowed_payment_frequencies) : undefined, start_date, end_date, id, business_id]
    );

    if (updatedDeal.rows.length === 0) {
      return res.status(404).json({ msg: 'Deal not found in your business.' });
    }
    res.json({ msg: 'Deal updated successfully', deal: updatedDeal.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/deals/:id
// @desc    Delete a deal from the business
// @access  Private (Admin only)
router.delete('/:id', auth, can('deals:delete'), async (req, res) => {
  const { id } = req.params;
  const { business_id } = req.user;
  try {
    const deletedDeal = await query('DELETE FROM ray_deals WHERE id = $1 AND business_id = $2 RETURNING *;', [id, business_id]);
    if (deletedDeal.rows.length === 0) {
      return res.status(404).json({ msg: 'Deal not found in your business.' });
    }
    res.json({ msg: 'Deal deleted successfully', deal: deletedDeal.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
