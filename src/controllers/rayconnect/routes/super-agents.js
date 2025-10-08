const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query, pool } = require('../config/database');
const can = require('../middleware/can');

// @route   GET api/super-agents
// @desc    Get all super agents information for the business
// @access  Private (Admin only)
router.get('/', auth, can('super:agent:read'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const superAgents = await query(`
      SELECT 
        u.id, 
        u.username AS name, 
        u.email, 
        u.phone_number AS phone, 
        u.state AS region, 
        u.status,
        u.credit_balance,
        u.commission_rate AS "commissionRate",
        (SELECT COUNT(*) FROM ray_devices WHERE (assigned_by = u.id OR super_agent_id = u.id) AND business_id = $1) AS "devicesManaged",
        (SELECT COUNT(*) FROM ray_users WHERE created_by = u.id AND role = 'customer' AND business_id = $1) AS "totalCustomers",
        (SELECT COUNT(*) FROM ray_users WHERE super_agent_id = u.id AND role = 'agent' AND business_id = $1) AS "agentsManaged",
        (SELECT COALESCE(SUM(sac.amount), 0) FROM ray_super_agent_commissions sac WHERE sac.super_agent_id = u.id AND sac.business_id = $1) AS "totalCommissionsEarned",
        (SELECT SUM(p.amount) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = u.id AND p.business_id = $1) AS "totalSales",
        u.commission_paid AS "commissionPaid",
        ((SELECT COALESCE(SUM(sac.amount), 0) FROM ray_super_agent_commissions sac WHERE sac.super_agent_id = u.id AND sac.business_id = $1) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        u.last_active
      FROM ray_users u
      WHERE u.role = 'super-agent' AND u.business_id = $1
    `, [business_id]);
    res.json(superAgents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/my-agents
// @desc    Get all agents for the current super-agent
// @access  Private (Super-Agent only)
router.get('/my-agents', auth, can('agent:read',['super-agent']), async (req, res) => {
  const { id: superAgentId, business_id } = req.user;
  try {
    const agents = await query(`
      SELECT 
        u.id, 
        u.username AS name, 
        u.email, 
        u.phone_number AS phone, 
        u.state AS region, 
        u.status,
        u.credit_balance,
        (SELECT COUNT(*) FROM ray_devices WHERE assigned_by = u.id AND business_id = $2) AS "devicesManaged",
        (SELECT SUM(p.amount) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = u.id AND p.business_id = $2) AS "totalSales"
      FROM ray_users u
      WHERE u.role = 'agent' AND u.super_agent_id = $1 AND u.business_id = $2
    `, [superAgentId, business_id]);
    res.json(agents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/dashboard
// @desc    Get dashboard data for the current super-agent
// @access  Private (Super-Agent only)
router.get('/dashboard', auth, authorize('super-agent'), async (req, res) => {
  const { id: superAgentId, business_id } = req.user;
  try {
    const dashboardData = await query(`
      SELECT
        (SELECT COUNT(*) FROM ray_users WHERE super_agent_id = $1 AND role = 'agent' AND business_id = $2) AS "agentsManaged",
        (SELECT COUNT(DISTINCT l.customer_id) FROM ray_loans l WHERE l.status != 'complete' AND l.business_id = $2 AND l.agent_id IN (SELECT id FROM ray_users WHERE super_agent_id = $1 AND business_id = $2)) AS "totalCustomers",
        (SELECT COALESCE(SUM(p.amount), 0) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = $1 AND p.business_id = $2) AS "mySalesVolume",
        (SELECT COALESCE(SUM(p.amount), 0) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE p.business_id = $2 AND l.agent_id IN (SELECT id FROM ray_users WHERE super_agent_id = $1 AND business_id = $2)) AS "networkSalesVolume",
        (SELECT COALESCE(SUM(p.amount), 0) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE p.business_id = $2 AND (l.agent_id = $1 OR l.agent_id IN (SELECT id FROM ray_users WHERE super_agent_id = $1 AND business_id = $2))) AS "totalSalesVolume",
        ((SELECT COALESCE(SUM(sac.amount), 0) FROM ray_super_agent_commissions sac WHERE sac.super_agent_id = $1 AND sac.business_id = $2) + (SELECT COALESCE(SUM(rc.amount), 0) FROM ray_commissions rc WHERE rc.agent_id = $1 AND rc.business_id = $2)) - (SELECT COALESCE(u.commission_paid, 0) FROM ray_users u where u.id =$1 AND u.business_id=$2) AS "totalCommissionsEarned"
    `, [superAgentId, business_id]);
    res.json(dashboardData.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/customers
// @desc    Get all customers for the current super-agent's agents
// @access  Private (Super-Agent only)
router.get('/customers', auth, async (req, res) => {
  const { id: superAgentId, business_id } = req.user;
  try {
    const customers = await query(`
      SELECT 
        u.id, 
        u.username AS name, 
        u.email, 
        u.phone_number AS phone, 
        u.state AS region, 
        u.status,
        (SELECT username FROM ray_users WHERE id = u.created_by AND business_id = $2) AS "onboardedBy"
      FROM ray_users u
      WHERE u.business_id = $2 AND u.id IN (
        SELECT l.customer_id FROM ray_loans l WHERE l.business_id = $2 AND l.agent_id IN (SELECT id FROM ray_users WHERE super_agent_id = $1 AND business_id = $2)
      )
    `, [superAgentId, business_id]);
    res.json(customers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/mycustomers', auth, async (req, res) => {
  const { id: superAgentId, business_id } = req.user;
  try {
    const customers = await query(`
      SELECT 
        u.id, 
        u.username AS name, 
        u.email, 
        u.phone_number AS phone, 
        u.state AS region, 
        u.status,
        (SELECT username FROM ray_users WHERE id = u.created_by AND business_id = $2) AS "onboardedBy"
      FROM ray_users u
      WHERE u.business_id = $2 AND u.created_by = $1;
    `, [superAgentId, business_id]);
    res.json(customers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/devices
// @desc    Get all devices assigned to the current super-agent
// @access  Private (Super-Agent only)
router.get('/devices', auth, async (req, res) => {
  const { id: superAgentId, business_id } = req.user;
  try {
    const devices = await query(`
      SELECT
        d.id,
        d.serial_number AS "serialNumber",
        d.status,
        d.assigned_by As "assignedBy",
        dt.device_name AS type,
        dt.default_down_payment AS downPayment,
        dt.device_model AS model,
        dt.pricing->>'one-time' AS price,
        dt.pricing AS plan,
         (SELECT name FROM ray_users WHERE id = d.assigned_by  AND business_id = $2) AS "deviceManager",
        json_agg(json_build_object(
          'id', deal.id,
          'dealName', deal.deal_name,
          'startDate', deal.start_date,
          'endDate', deal.end_date,
          'allowedPaymentFrequencies', deal.allowed_payment_frequencies
        )) FILTER (WHERE deal.id IS NOT NULL) AS "activeDeals"
      FROM ray_devices d
      JOIN ray_device_types dt ON d.device_type_id = dt.id
      LEFT JOIN ray_deals deal ON dt.id = deal.device_type_id AND deal.start_date <= CURRENT_DATE AND deal.end_date >= CURRENT_DATE AND deal.business_id = $2
      WHERE d.super_agent_id = $1 AND d.business_id = $2
      GROUP BY d.id, dt.id
    `, [superAgentId, business_id]);
    res.json(devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/super-agents/assign-device
// @desc    Assign a device to an agent
// @access  Private (Super-Agent only)
router.post('/assign-device', auth, can('devices:assign', ['super-agent']), async (req, res) => {
  const { device_id, agent_id } = req.body;
  const { id: superAgentId, business_id } = req.user;

  try {
    const deviceResult = await query('SELECT * FROM ray_devices WHERE id = $1 AND status = $2 AND super_agent_id = $3 AND business_id = $4', [device_id, 'available', superAgentId, business_id]);
    if (deviceResult.rows.length === 0) {
      return res.status(400).json({ msg: 'Device not found, not available, or you do not have permission to assign it.' });
    }

    const agentResult = await query('SELECT * FROM ray_users WHERE id = $1 AND role = $2 AND super_agent_id = $3 AND business_id = $4', [agent_id, 'agent', superAgentId, business_id]);
    if (agentResult.rows.length === 0) {
      return res.status(400).json({ msg: 'Target agent not found or not managed by you.' });
    }

    const assignedDevice = await query(
      'UPDATE ray_devices SET assigned_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3 RETURNING *;',
      [agent_id, device_id, business_id]
    );

    res.json({ msg: 'Device assigned successfully to agent', device: assignedDevice.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/me
// @desc    Get super agent data with all details
// @access  Private (Super-Agent only)
router.get('/me', auth,  async (req, res) => {
  const { id, business_id } = req.user;

  try {
    const superAgent = await query(
      `SELECT
        u.id,
        u.username AS name,
        u.email,
        u.phone_number AS phone,
        u.state AS region,
        u.city,
        u.address,
        u.landmark,
        u.gps,
        u.status,
        u.created_at AS "joinDate",
        u.last_active,
        u.credit_balance,
        u.commission_rate AS "commissionRate",
        COALESCE(SUM(sac.amount), 0) AS "totalCommissionsEarned",
        u.commission_paid AS "commissionPaid",
        (((SELECT COALESCE(SUM(sac2.amount), 0) FROM ray_super_agent_commissions sac2 WHERE sac2.super_agent_id = u.id AND sac2.business_id = $2) + (SELECT COALESCE(SUM(rc.amount), 0) FROM ray_commissions rc WHERE rc.agent_id = u.id AND rc.business_id = $2)) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        (SELECT COUNT(*) FROM ray_users WHERE super_agent_id = u.id AND business_id = $2) AS "agentsManaged",
        (SELECT json_agg(json_build_object(
          'id', a.id,
          'name', a.username,
          'email', a.email,
          'phone', a.phone_number,
          'status', a.status,
          'devicesManaged', (SELECT COUNT(*) FROM ray_devices WHERE assigned_by = a.id AND business_id = $2)
        )) FROM ray_users a WHERE a.super_agent_id = u.id AND a.business_id = $2) AS "managedAgents",
        (SELECT json_agg(json_build_object(
          'id', w.id,
          'amount', w.amount,
          'date', w.withdrawal_date,
          'transactionId', w.transaction_id
        ) ORDER BY w.withdrawal_date DESC) FROM ray_super_agent_withdrawals w WHERE w.super_agent_id = u.id AND w.business_id = $2) AS "withdrawalHistory"
      FROM ray_users u
      LEFT JOIN ray_super_agent_commissions sac ON sac.super_agent_id = u.id AND sac.business_id = $2
      WHERE u.id = $1 AND u.role = 'super-agent' AND u.business_id = $2
      GROUP BY u.id
      `,
      [id, business_id]
    );

    if (superAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Super Agent not found' });
    }

    res.json(superAgent.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/payments
// @desc    Get all payments related to the current super-agent's network
// @access  Private (Super-Agent only)
router.get('/payments', auth, async (req, res) => {
  const { id: superAgentId, business_id } = req.user;
  try {
    const payments = await query(`
      SELECT
        p.id,
        p.amount,
        p.payment_date,
        p.payment_method,
        p.transaction_id,
        p.status,
        u.username AS customer_name,
        l.id AS loan_id,
        a.username AS agent_name,
        d.serial_number AS device_serial_number,
        dt.device_name AS device_type,
        t.token
      FROM ray_payments p
      JOIN ray_loans l ON p.loan_id = l.id
      JOIN ray_users u ON p.user_id = u.id
      JOIN ray_users a ON l.agent_id = a.id
      JOIN ray_devices d ON l.device_id = d.id
      JOIN ray_device_types dt ON d.device_type_id = dt.id
      LEFT JOIN ray_tokens t ON t.payment_id = p.id
      WHERE d.super_agent_id = $1 AND p.business_id = $2
      ORDER BY p.payment_date DESC
    `, [superAgentId, business_id]);
    res.json(payments.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/:id
// @desc    Get single super agent data with all details
// @access  Private (Admin, Super-Agent - can only view their own profile)
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { id: requesterId, role: requesterRole, business_id } = req.user;

  try {
    if (requesterRole === 'super-agent' && requesterId !== id) {
      return res.status(403).json({ msg: 'Access denied: You can only view your own profile.' });
    }

    const superAgent = await query(
      `SELECT
        u.id,
        u.username AS name,
        u.email,
        u.phone_number AS phone,
        u.state AS region,
        u.city,
        u.address,
        u.landmark,
        u.gps,
        u.credit_balance,
        u.status,
        u.created_at AS "joinDate",
        u.last_active,
        u.commission_rate AS "commissionRate",
        COALESCE(SUM(sac.amount), 0) AS "totalCommissionsEarned",
        u.commission_paid AS "commissionPaid",
        (((SELECT COALESCE(SUM(sac2.amount), 0) FROM ray_super_agent_commissions sac2 WHERE sac2.super_agent_id = u.id AND sac2.business_id = $2) + (SELECT COALESCE(SUM(rc.amount), 0) FROM ray_commissions rc WHERE rc.agent_id = u.id AND rc.business_id = $2)) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        (SELECT COUNT(*) FROM ray_users WHERE super_agent_id = u.id AND role = 'agent' AND business_id = $2) AS "agentsManaged",
        (SELECT json_agg(json_build_object(
          'id', a.id,
          'name', a.username,
          'email', a.email,
          'phone', a.phone_number,
          'status', a.status,
          'devicesManaged', (SELECT COUNT(*) FROM ray_devices WHERE assigned_by = a.id AND business_id = $2)
        )) FROM ray_users a WHERE a.super_agent_id = u.id AND role = 'agent' AND business_id = $2) AS "managedAgents",
        (SELECT json_agg(json_build_object(
          'id', w.id,
          'amount', w.amount,
          'date', w.withdrawal_date,
          'transactionId', w.transaction_id
        ) ORDER BY w.withdrawal_date DESC) FROM ray_super_agent_withdrawals w WHERE w.super_agent_id = u.id AND w.business_id = $2) AS "withdrawalHistory"
      FROM ray_users u
      LEFT JOIN ray_super_agent_commissions sac ON sac.super_agent_id = u.id AND sac.business_id = $2
      WHERE u.id = $1 AND u.role = 'super-agent' AND u.business_id = $2
      GROUP BY u.id
      `,
      [id, business_id]
    );

    if (superAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Super Agent not found in your business.' });
    }

    res.json(superAgent.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/super-agents/:id
// @desc    Update super agent information
// @access  Private (Admin, Super-Agent - can only update their own profile)
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { username, email, phone_number, state, city, address, landmark, gps, commission_rate, status } = req.body;
  const { id: requesterId, role: requesterRole, business_id } = req.user;

  try {
    if (requesterRole === 'super-agent' && requesterId !== id) {
      return res.status(403).json({ msg: 'Access denied: You can only update your own profile.' });
    }

    if (requesterRole !== 'admin' && (commission_rate !== undefined || status !== undefined)) {
      return res.status(403).json({ msg: 'Access denied: Only administrators can update commission rate or status.' });
    }

    const updatedSuperAgent = await query(
      `UPDATE ray_users SET
        username = COALESCE($1, username),
        email = COALESCE($2, email),
        phone_number = COALESCE($3, phone_number),
        state = COALESCE($4, state),
        city = COALESCE($5, city),
        address = COALESCE($6, address),
        landmark = COALESCE($7, landmark),
        gps = COALESCE($8, gps),
        commission_rate = COALESCE($9, commission_rate),
        status = COALESCE($10, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 AND business_id = $12 RETURNING id, username, email, phone_number, state, city, address, landmark, gps, commission_rate, status, created_at, last_active, commission_paid;
      `,
      [username, email, phone_number, state, city, address, landmark, gps, commission_rate, status, id, business_id]
    );

    if (updatedSuperAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Super Agent not found in your business.' });
    }

    res.json({ msg: 'Super Agent updated successfully', superAgent: updatedSuperAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/super-agents/withdraw-commission
// @desc    Super Agent withdraws commission
// @access  Private (Super-Agent, Admin)
router.post('/withdraw-commission', auth, can('super:agent:withdraw:commission', ['super-agent']), async (req, res) => {
  const { amount } = req.body;
  const { id: superAgentId, business_id } = req.user;
  let client;

  try {
    const superAgentResult = await query(
      `SELECT
        (
            (SELECT COALESCE(SUM(amount), 0) FROM ray_super_agent_commissions WHERE super_agent_id = $1 AND business_id = $2) +
            (SELECT COALESCE(SUM(amount), 0) FROM ray_commissions WHERE agent_id = $1 AND business_id = $2)
        ) AS total_earned,
        u.commission_paid AS total_paid,
        u.last_withdrawal_date
      FROM ray_users u
      WHERE u.id = $1 AND u.business_id = $2`,
      [superAgentId, business_id]
    );

    if (superAgentResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Super Agent not found in your business.' });
    }

    const { total_earned, total_paid, last_withdrawal_date } = superAgentResult.rows[0];
    const availableBalance = parseFloat(total_earned) - parseFloat(total_paid);

    const now = new Date();
    if (last_withdrawal_date) {
      const lastWithdrawal = new Date(last_withdrawal_date);
      if (lastWithdrawal.getMonth() === now.getMonth() && lastWithdrawal.getFullYear() === now.getFullYear()) {
        return res.status(400).json({ msg: 'You can only withdraw commission once a month.' });
      }
    }

    if (amount <= 0 || amount > availableBalance) {
      return res.status(400).json({ msg: 'Invalid withdrawal amount or insufficient balance.' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const finalTransactionId = `SAW-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newWithdrawal = await client.query(
      'INSERT INTO ray_super_agent_withdrawals (super_agent_id, amount, transaction_id, business_id) VALUES ($1, $2, $3, $4) RETURNING *;',
      [superAgentId, amount, finalTransactionId, business_id]
    );

    const updatedSuperAgent = await client.query(
      'UPDATE ray_users SET commission_paid = commission_paid + $1, last_withdrawal_date = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3 RETURNING *;',
      [amount, superAgentId, business_id]
    );

    await client.query('COMMIT');
    res.json({ msg: 'Commission withdrawn successfully', withdrawal: newWithdrawal.rows[0], superAgent: updatedSuperAgent.rows[0] });
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

// @route   PUT api/super-agents/profile-picture
// @desc    Upload super agent's profile picture as Base64
// @access  Private (Authenticated Super Agent)
router.put('/profile-picture', auth, async (req, res) => {
  const { profile_picture_base64 } = req.body;
  const { id: superAgentId, business_id } = req.user;

  try {
    if (!profile_picture_base64) {
      return res.status(400).json({ msg: 'Profile picture Base64 string is required.' });
    }

    // Basic validation: check if it's a string and not excessively long (500KB limit)
    if (typeof profile_picture_base64 !== 'string' || profile_picture_base64.length > 500 * 1024) {
      return res.status(400).json({ msg: 'Invalid or excessively large Base64 string (max 500KB).' });
    }

    await query(
      'UPDATE ray_users SET profile_picture_base64 = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3 RETURNING id, username;',
      [profile_picture_base64, superAgentId, business_id]
    );

    res.json({ msg: 'Profile picture updated successfully.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;