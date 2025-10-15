const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');
const can = require('../middleware/can');

// @route   GET api/analytics/overview
// @desc    Get overall platform performance analytics for the business (Admin only)
// @access  Private (Admin)
router.get('/overview', auth, can('analytics:read:business'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const totalPayments = await query('SELECT SUM(amount) FROM ray_payments WHERE status = $1 AND business_id = $2',['completed', business_id]);
    const totalLoans = await query('SELECT COUNT(*) FROM ray_loans WHERE business_id = $1', [business_id]);
    const activeLoans = await query('SELECT COUNT(*) FROM ray_loans WHERE status = $1 AND business_id = $2', ['active', business_id]);
    const totalCustomers = await query('SELECT COUNT(*) FROM ray_users WHERE role = $1 AND business_id = $2', ['customer', business_id]);
    const totalAgents = await query('SELECT COUNT(*) FROM ray_users WHERE role = $1 AND business_id = $2', ['agent', business_id]);
    const totalDevices = await query('SELECT COUNT(*) FROM ray_devices WHERE business_id = $1', [business_id]);
    const assignedDevices = await query('SELECT COUNT(*) FROM ray_devices WHERE status = $1 AND business_id = $2', ['assigned', business_id]);
    const availableDevices = await query('SELECT COUNT(*) FROM ray_devices WHERE status = $1 AND business_id = $2', ['available', business_id]);

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
// @desc    Get performance metrics for all agents in the business (Admin only)
// @access  Private (Admin)
router.get('/agent-performance', auth, authorize('admin'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const agents = await query('SELECT id, username, email, commission_rate FROM ray_users WHERE role = $1 AND business_id = $2', ['agent', business_id]);

    const agentPerformance = await Promise.all(agents.rows.map(async (agent) => {
      const totalCommissions = await query('SELECT SUM(amount) FROM ray_commissions WHERE agent_id = $1 AND business_id = $2', [agent.id, business_id]);
      const assignedDevicesCount = await query('SELECT COUNT(*) FROM ray_devices WHERE assigned_by = $1 AND business_id = $2', [agent.id, business_id]);
      const customersCount = await query('SELECT COUNT(DISTINCT customer_id) FROM ray_loans WHERE agent_id = $1 AND business_id = $2', [agent.id, business_id]);

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

// @route   GET api/analytics/revenue-overview
// @desc    Get revenue overview for the current month
// @access  Private (analytics:read:business)
router.get('/revenue-overview', auth, can('analytics:read:business'), async (req, res) => {
  const { business_id } = req.user;
  try {
    // Expected revenue for the current month from active and overdue loans
    const expectedRevenueQuery = `
      SELECT COALESCE(SUM(payment_cycle_amount), 0) as total
      FROM ray_loans
      WHERE business_id = $1
        AND status IN ('active', 'overdue');
    `;
    const expectedRevenueResult = await query(expectedRevenueQuery, [business_id]);
    const expectedRevenue = parseFloat(expectedRevenueResult.rows[0].total);

    // Amount collected in the current month
    const collectedAmountQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM ray_payments
      WHERE business_id = $1
        AND status = 'completed'
        AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE);
    `;
    const collectedAmountResult = await query(collectedAmountQuery, [business_id]);
    const amountCollected = parseFloat(collectedAmountResult.rows[0].total);

    // Pending amount
    const pendingAmount = expectedRevenue - amountCollected;

    res.json({
      expectedRevenue: expectedRevenue.toFixed(2),
      amountCollected: amountCollected.toFixed(2),
      pendingAmount: pendingAmount.toFixed(2),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/analytics/revenue-overview/previous-month
// @desc    Get revenue overview for the previous month
// @access  Private (analytics:read:business)
router.get('/revenue-overview/previous-month', auth, can('analytics:read:business'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const expectedRevenueQuery = `
      SELECT COALESCE(SUM(payment_amount_per_cycle), 0) as total
      FROM ray_loans
      WHERE business_id = $1
        AND status IN ('active', 'overdue')
        AND DATE_TRUNC('month', next_payment_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
    `;
    const expectedRevenueResult = await query(expectedRevenueQuery, [business_id]);
    const expectedRevenue = parseFloat(expectedRevenueResult.rows[0].total);

    const collectedAmountQuery = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM ray_payments
      WHERE business_id = $1
        AND status = 'completed'
        AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
    `;
    const collectedAmountResult = await query(collectedAmountQuery, [business_id]);
    const amountCollected = parseFloat(collectedAmountResult.rows[0].total);

    const pendingAmount = expectedRevenue - amountCollected;

    res.json({
      month: 'previous',
      expectedRevenue: expectedRevenue.toFixed(2),
      amountCollected: amountCollected.toFixed(2),
      pendingAmount: pendingAmount.toFixed(2),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
