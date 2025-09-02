const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   GET api/inventory/agent/:agentId
// @desc    Get devices assigned by a specific agent in the business (Admin only)
// @access  Private (Admin)
router.get('/agent/:agentId', auth, authorize('admin'), async (req, res) => {
  const { agentId } = req.params;
  const { business_id } = req.user;
  try {
    // Optional: Verify the agent belongs to the admin's business first
    const agentCheck = await query('SELECT id FROM ray_users WHERE id = $1 AND role = \'agent\' AND business_id = $2', [agentId, business_id]);
    if (agentCheck.rows.length === 0) {
        return res.status(404).json({ msg: 'Agent not found in your business.' });
    }

    const devices = await query('SELECT * FROM ray_devices WHERE assigned_by = $1 AND business_id = $2', [agentId, business_id]);
    res.json(devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/inventory/status/:status
// @desc    Get devices by status in the business (Admin only)
// @access  Private (Admin)
router.get('/status/:status', auth, authorize('admin'), async (req, res) => {
  const { status } = req.params;
  const { business_id } = req.user;
  try {
    const devices = await query('SELECT * FROM ray_devices WHERE status = $1 AND business_id = $2', [status, business_id]);
    res.json(devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
