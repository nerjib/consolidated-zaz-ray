const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const can = require('../middleware/can');
const { query, pool } = require('../config/database');

// @route   GET api/agents
// @desc    Get all agents information for the business
// @access  Private (agent:read)
router.get('/', auth, can('agent:read'), async (req, res) => {
  const { business_id } = req.user;
  const { status } = req.query;
  try {
    let queryText = `
      SELECT 
        u.id, 
        u.username AS name, 
        u.email, 
        u.phone_number AS phone, 
        u.state AS region, 
        u.status,
        u.credit_balance,
        u.paystack_dedicated_account_number as "accountNumber",
        u.profile_picture_base64 as profile_img,
        u.commission_rate AS "commissionRate",
        (SELECT COUNT(*) FROM ray_devices WHERE assigned_by = u.id AND business_id = $1) AS "devicesManaged",
        (SELECT COUNT(*) FROM ray_users WHERE created_by = u.id AND role = 'customer' AND business_id = $1) AS "totalCustomers",
        (SELECT SUM(p.amount) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = u.id AND p.business_id = $1) AS "totalSales",
        (SELECT COALESCE(SUM(c.amount), 0) FROM ray_commissions c WHERE c.agent_id = u.id AND c.business_id = $1) AS "totalCommissionsEarned",
        u.commission_paid AS "commissionPaid",
        ((SELECT COALESCE(SUM(c.amount), 0) FROM ray_commissions c WHERE c.agent_id = u.id AND c.business_id = $1) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        u.last_active
      FROM ray_users u
      WHERE u.role = 'agent' AND u.business_id = $1
    `;
    const queryParams = [business_id];
    if (status) {
      queryText += ` AND u.status = $2`;
      queryParams.push(status);
    }
    queryText += ' ORDER BY u.created_at DESC';
    const agents = await query(queryText, queryParams);
    res.json(agents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/me
// @desc    Get current agent's profile with comprehensive details
// @access  Private (Authenticated Agent)
router.get('/me', auth, async (req, res) => {
  const { id, business_id } = req.user;
  try {
    const agent = await query(`
      SELECT
        u.id,
        u.username AS name,
        u.email,
        u.phone_number AS phone,
        u.state AS region,
        u.city,
        u.address,
        u.landmark,
        u.gps,
        u.paystack_dedicated_account_number as "accountNumber",
        u.status,
        u.credit_balance,
        u.created_at AS "joinDate",
        u.last_active,
        u.commission_rate AS "commissionRate",
        COALESCE(SUM(c.amount), 0) AS "totalCommissionsEarned",
        u.commission_paid AS "commissionPaid",
        ((SELECT COALESCE(SUM(comm.amount), 0) FROM ray_commissions comm WHERE comm.agent_id = u.id AND comm.business_id = $2) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        (SELECT COUNT(*) FROM ray_devices WHERE assigned_by = u.id AND business_id = $2) AS "devicesManaged",
        (SELECT SUM(p.amount) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = u.id AND p.business_id = $2) AS "totalSales",
        (SELECT json_agg(json_build_object(
          'id', d.id,
          'serialNumber', d.serial_number,
          'status', d.status,
          'customerName', (SELECT username FROM ray_users WHERE id = d.assigned_to AND business_id = $2),
          'installDate', d.created_at
        )) FROM ray_devices d WHERE d.assigned_by = u.id AND d.business_id = $2) AS "assignedDevices",
        (SELECT json_agg(json_build_object(
          'id', w.id,
          'amount', w.amount,
          'date', w.withdrawal_date,
          'transactionId', w.transaction_id
        ) ORDER BY w.withdrawal_date DESC) FROM ray_agent_withdrawals w WHERE w.agent_id = u.id AND w.business_id = $2) AS "withdrawalHistory"
      FROM ray_users u
      LEFT JOIN ray_commissions c ON c.agent_id = u.id AND c.business_id = $2
      WHERE u.id = $1 AND u.role = 'agent' AND u.business_id = $2
      GROUP BY u.id
    `, [id, business_id]);

    if (agent.rows.length === 0) {
      return res.status(404).json({ msg: 'Agent profile not found.' });
    }
    res.json(agent.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/dashboard
// @desc    Get agent dashboard data
// @access  Private (Authenticated Agent)
router.get('/dashboard', auth, async (req, res) => {
  const { id: agentId, business_id } = req.user;
  try {
    const totalCustomersResult = await query(
      'SELECT COUNT(*) FROM ray_users WHERE created_by = $1 AND role = $2 AND business_id = $3',
      [agentId, 'customer', business_id]
    );
    const totalCustomers = parseInt(totalCustomersResult.rows[0].count, 10);

    const totalLoansResult = await query(
      'SELECT COUNT(*) FROM ray_loans WHERE agent_id = $1 AND business_id = $2',
      [agentId, business_id]
    );
    const totalLoans = parseInt(totalLoansResult.rows[0].count, 10);

    const totalPaymentsCollectedResult = await query(
      'SELECT COALESCE(SUM(p.amount), 0) AS total_payments FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = $1 AND p.business_id = $2',
      [agentId, business_id]
    );
    const totalPaymentsCollected = parseFloat(totalPaymentsCollectedResult.rows[0].total_payments).toFixed(2);

    const totalCommissionsEarnedResult = await query(
      'SELECT COALESCE(SUM(amount), 0) AS total_commissions FROM ray_commissions WHERE agent_id = $1 AND business_id = $2',
      [agentId, business_id]
    );
    const totalCommissionsEarned = parseFloat(totalCommissionsEarnedResult.rows[0].total_commissions).toFixed(2);

    res.json({
      totalCustomers,
      totalLoans,
      totalPaymentsCollected,
      totalCommissionsEarned,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/customers
// @desc    Get customers onboarded by the current agent
// @access  Private (Authenticated Agent)
router.get('/customers', auth, async (req, res) => {
  const { id: agentId, business_id } = req.user;
  try {
    const customers = await query(`
      SELECT 
        id, 
        username AS name, 
        phone_number AS phone, 
        state AS region, 
        status,
        (SELECT username FROM ray_users WHERE id = u.created_by AND business_id = $2) AS "onboardedBy"
      FROM ray_users u
      WHERE created_by = $1 AND role = 'customer' AND business_id = $2
    `, [agentId, business_id]);
    res.json(customers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/devices
// @desc    Get devices assigned by the current agent
// @access  Private (Authenticated Agent)
router.get('/devices', auth, async (req, res) => {
  const { id: agentId, business_id } = req.user;
  try {
    const devices = await query(`
      SELECT 
        id, 
        serial_number AS "serialNumber", 
        status, 
        model as type, 
        model,
        assigned_to AS "assignedToCustomerId",
        (SELECT username FROM ray_users WHERE id = d.assigned_to AND business_id = $2) AS "assignedToCustomerName"
      FROM ray_devices d
      WHERE assigned_by = $1 AND business_id = $2
    `, [agentId, business_id]);
    res.json(devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/available-devices
// @desc    Get available devices for assignment by the current agent
// @access  Private (Authenticated Agent)
router.get('/available-devices', auth, async (req, res) => {
  const { id: agentId, business_id } = req.user;
  try {
    const devices = await query(`
      SELECT 
        d.id, 
        d.serial_number AS "serialNumber", 
        d.status,
        dt.device_name AS type,
        dt.device_model AS model,
        dt.pricing->>'one-time' AS price,
        dt.pricing AS plan,
        dt.default_down_payment AS downPayment,
        COALESCE(json_agg(DISTINCT deal.allowed_payment_frequencies) FILTER (WHERE deal.id IS NOT NULL), '["monthly", "weekly", "daily"]'::json) AS "allowedPaymentFrequencies",
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
      WHERE d.status = 'available' AND d.assigned_by = $1 AND d.business_id = $2
      GROUP BY d.id, dt.id
    `, [agentId, business_id]);
    res.json(devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/payments
// @desc    Get payments related to loans originated by the current agent
// @access  Private (Authenticated Agent)
router.get('/payments', auth, async (req, res) => {
  const { id: agentId, business_id } = req.user;
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
        d.serial_number AS device_serial_number,
        dt.device_name AS device_type,
        t.token
      FROM ray_payments p
      JOIN ray_loans l ON p.loan_id = l.id
      JOIN ray_users u ON l.customer_id = u.id
      JOIN ray_devices d ON l.device_id = d.id
      JOIN ray_device_types dt ON d.device_type_id = dt.id
      LEFT JOIN ray_tokens t ON t.payment_id = p.id
      WHERE l.agent_id = $1 AND p.business_id = $2
      ORDER BY p.payment_date DESC
    `, [agentId, business_id]);
    res.json(payments.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/agents/assign-device
// @desc    Assign a device to a customer
// @access  Private (device:update)
router.post('/assign-device', auth, can('device:update'), async (req, res) => {
  const { device_id, customer_id } = req.body;
  const { id: agentId, business_id } = req.user;

  try {
    let device = await query('SELECT * FROM ray_devices WHERE id = $1 AND status = $2 AND business_id = $3', [device_id, 'available', business_id]);
    if (device.rows.length === 0) {
      return res.status(400).json({ msg: 'Device not found, not available, or not in your business.' });
    }

    let customer = await query('SELECT * FROM ray_users WHERE id = $1 AND role = $2 AND business_id = $3', [customer_id, 'customer', business_id]);
    if (customer.rows.length === 0) {
      return res.status(400).json({ msg: 'Customer not found in your business.' });
    }

    const assignedDevice = await query(
      'UPDATE ray_devices SET assigned_to = $1, assigned_by = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND business_id = $5 RETURNING *;',
      [customer_id, agentId, 'assigned', device_id, business_id]
    );

    res.json({ msg: 'Device assigned successfully', device: assignedDevice.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/:id
// @desc    Get single agent data with all details
// @access  Private (agent:read)
router.get('/:id', auth, can('agent:read', ['super-agent', 'agent']), async (req, res) => {
  const { id: agentIdParam } = req.params;
  const { id: requesterId, business_id, role } = req.user;

  // Internal logic still prevents an agent from seeing another agent's profile
  // This check can be enhanced later with more granular permissions
  if (!req.user.permissions.includes('agent:read') && requesterId !== agentIdParam && role !== 'super-agent') {
      return res.status(403).json({ msg: 'Access denied: You can only view your own profile.' });
  }

  try {
    const agent = await query(
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
        u.profile_picture_base64 as profile_img,
        u.status,
        u.created_at AS "joinDate",
        u.last_active,
        u.credit_balance,
        u.commission_rate AS "commissionRate",
        COALESCE(SUM(c.amount), 0) AS "totalCommissionsEarned",
        u.paystack_dedicated_account_number as "accountNumber",
        u.commission_paid AS "commissionPaid",
        ((SELECT COALESCE(SUM(comm.amount), 0) FROM ray_commissions comm WHERE comm.agent_id = u.id AND comm.business_id = $2) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        (SELECT COUNT(*) FROM ray_devices WHERE assigned_by = u.id AND business_id = $2) AS "devicesManaged",
        (SELECT SUM(p.amount) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = u.id AND p.business_id = $2) AS "totalSales",
        (SELECT json_agg(json_build_object(
          'id', d.id,
          'serialNumber', d.serial_number,
          'status', d.status,
          'customerName', (SELECT username FROM ray_users WHERE id = d.assigned_to AND business_id = $2),
          'installDate', d.created_at
        )) FROM ray_devices d WHERE d.assigned_by = u.id AND d.business_id = $2) AS "assignedDevices",
        (SELECT json_agg(json_build_object(
          'id', w.id,
          'amount', w.amount,
          'date', w.withdrawal_date,
          'transactionId', w.transaction_id
        ) ORDER BY w.withdrawal_date DESC) FROM ray_agent_withdrawals w WHERE w.agent_id = u.id AND w.business_id = $2) AS "withdrawalHistory"
      FROM ray_users u
      LEFT JOIN ray_commissions c ON c.agent_id = u.id AND c.business_id = $2
      WHERE u.id = $1 AND u.role = 'agent' AND u.business_id = $2
      GROUP BY u.id
      `,
      [agentIdParam, business_id]
    );
    console.log({mmmm: agent.rows[0]})
    if (agent.rows.length === 0) {
      return res.status(404).json({ msg: 'Agent not found in your business.' });
    }

    res.json(agent.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/agents/:id
// @desc    Update agent information
// @access  Private (user:update)
router.put('/:id', auth, can('user:update'), async (req, res) => {
  const { id: agentIdToUpdate } = req.params;
  const { username, email, phone_number, state, city, address, landmark, gps, commission_rate, status } = req.body;
  const { id: requesterId, permissions, business_id } = req.user;

  try {
    // Allow user to update their own profile
    if (requesterId !== agentIdToUpdate && !permissions.includes('user:manage')) {
        return res.status(403).json({ msg: 'Access denied: You can only update your own profile.' });
    }

    // Only users with specific permission can update sensitive fields
    if ((commission_rate !== undefined || status !== undefined) && !permissions.includes('agent:set:commission')) {
      return res.status(403).json({ msg: 'Access denied: You do not have permission to update commission rate or status.' });
    }

    const updatedAgent = await query(
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
      [username, email, phone_number, state, city, address, landmark, gps, commission_rate, status, agentIdToUpdate, business_id]
    );

    if (updatedAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Agent not found in your business.' });
    }

    res.json({ msg: 'Agent updated successfully', agent: updatedAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/agents/withdraw-commission
// @desc    Agent withdraws commission
// @access  Private (agent:withdraw:commission)
router.post('/withdraw-commission', auth, can('agent:withdraw:commission', ['agent']), async (req, res) => {
  const { amount, transaction_id } = req.body;
  const { id: agentId, business_id } = req.user;
  let client;

    try {
      const agentResult = await query(
        `SELECT 
          COALESCE(SUM(c.amount), 0) AS total_earned,
          COALESCE(u.commission_paid, 0) AS total_paid,
          u.last_withdrawal_date
        FROM ray_users u
        LEFT JOIN ray_commissions c ON c.agent_id = u.id AND c.business_id = $2
        WHERE u.id = $1 AND u.business_id = $2
        GROUP BY u.commission_paid, u.last_withdrawal_date`,
        [agentId, business_id]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({ msg: 'Agent not found in your business.' });
      }

      const { total_earned, total_paid, last_withdrawal_date } = agentResult.rows[0];
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

      const finalTransactionId = transaction_id || `AW-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const newWithdrawal = await client.query(
        'INSERT INTO ray_agent_withdrawals (agent_id, amount, transaction_id, business_id) VALUES ($1, $2, $3, $4) RETURNING *;',
        [agentId, amount, finalTransactionId, business_id]
      );

      const updatedAgent = await client.query(
        'UPDATE ray_users SET commission_paid = commission_paid + $1, last_withdrawal_date = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3 RETURNING *;',
        [amount, agentId, business_id]
      );

      await client.query('COMMIT');

      res.json({ msg: 'Commission withdrawn successfully', withdrawal: newWithdrawal.rows[0], agent: updatedAgent.rows[0] });
    } catch (err) {
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error(err.message);
      res.status(500).send('Server Error');
    } finally {
        if(client){
            client.release();
        }
    }
  });

// @route   PUT api/agents/profile-picture
// @desc    Upload agent's profile picture as Base64
// @access  Private (Authenticated Agent)
router.put('/profile-picture', auth, async (req, res) => {
  const { profile_picture_base64 } = req.body;
  const { id: agentId, business_id } = req.user;

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
      [profile_picture_base64, agentId, business_id]
    );

    res.json({ msg: 'Profile picture updated successfully.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;