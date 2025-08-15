const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   GET api/inventory/agent/:agentId
// @desc    Get devices assigned by a specific agent (Admin only)
// @access  Private (Admin)
router.get('/agent/:agentId', auth, authorize('admin'), async (req, res) => {
  const { agentId } = req.params;
  try {
    const devices = await query('SELECT * FROM devices WHERE assigned_by = $1', [agentId]);
    res.json(devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/inventory/status/:status
// @desc    Get devices by status (Admin only)
// @access  Private (Admin)
router.get('/status/:status', auth, authorize('admin'), async (req, res) => {
  const { status } = req.params;
  try {
    const devices = await query('SELECT * FROM devices WHERE status = $1', [status]);
    res.json(devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
