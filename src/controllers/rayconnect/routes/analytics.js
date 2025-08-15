const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   GET api/analytics/overview
// @desc    Get overall platform performance analytics (Admin only)
// @access  Private (Admin)
router.get('/overview', auth, authorize('admin'), async (req, res) => {
  try {
    const totalPayments = await query('SELECT SUM(amount) FROM payments WHERE status = $1',['completed']);
    const totalLoans = await query('SELECT COUNT(*) FROM loans');
    const activeLoans = await query('SELECT COUNT(*) FROM loans WHERE status = $1', ['active']);
    const totalCustomers = await query('SELECT COUNT(*) FROM users WHERE role = $1', ['customer']);
    const totalAgents = await query('SELECT COUNT(*) FROM users WHERE role = $1', ['agent']);
    const totalDevices = await query('SELECT COUNT(*) FROM devices');
    const assignedDevices = await query('SELECT COUNT(*) FROM devices WHERE status = $1', ['assigned']);
    const availableDevices = await query('SELECT COUNT(*) FROM devices WHERE status = $1', ['available']);

    res.json({
      totalPayments: parseFloat(totalPayments.rows[0].sum || 0),
      totalLoans: parseInt(totalLoans.rows[0].count || 0),
      activeLoans: parseInt(activeLoans.rows[0].count || 0),
      totalCustomers: parseInt(totalCustomers.rows[0].count || 0),
      totalAgents: parseInt(totalAgents.rows[0].count || 0),
      totalDevices: parseInt(totalDevices.rows[0].count || 0),
      assignedDevices: parseInt(assignedDevices.rows[0].count || 0),
      availableDevices: parseInt(availableDevices.rows[0].count || 0),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/analytics/agent-performance
// @desc    Get performance metrics for all agents (Admin only)
// @access  Private (Admin)
router.get('/agent-performance', auth, authorize('admin'), async (req, res) => {
  try {
    const agents = await query('SELECT id, username, email, commission_rate FROM users WHERE role = agent');

    const agentPerformance = await Promise.all(agents.rows.map(async (agent) => {
      const totalCommissions = await query('SELECT SUM(amount) FROM commissions WHERE agent_id = $1', [agent.id]);
      const assignedDevicesCount = await query('SELECT COUNT(*) FROM devices WHERE assigned_by = $1', [agent.id]);
      const customersCount = await query('SELECT COUNT(DISTINCT customer_id) FROM commissions WHERE agent_id = $1', [agent.id]);

      return {
        agentId: agent.id,
        username: agent.username,
        email: agent.email,
        commissionRate: agent.commission_rate,
        totalCommissionsEarned: parseFloat(totalCommissions.rows[0].sum || 0),
        devicesAssigned: parseInt(assignedDevicesCount.rows[0].count || 0),
        customersServed: parseInt(customersCount.rows[0].count || 0),
      };
    }));

    res.json(agentPerformance);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
