const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   GET api/super-agents
// @desc    Get all super agents information
// @access  Private (Admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const superAgents = await query(`
      SELECT 
        u.id, 
        u.username AS name, 
        u.email, 
        u.phone_number AS phone, 
        u.state AS region, 
        u.status,
        u.commission_rate AS "commissionRate",
        (SELECT COUNT(*) FROM users WHERE super_agent_id = u.id) AS "agentsManaged",
        (SELECT COALESCE(SUM(sac.amount), 0) FROM super_agent_commissions sac WHERE sac.super_agent_id = u.id) AS "totalCommissionsEarned",
        u.commission_paid AS "commissionPaid",
        ((SELECT COALESCE(SUM(sac.amount), 0) FROM super_agent_commissions sac WHERE sac.super_agent_id = u.id) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        u.last_active
      FROM users u
      WHERE u.role = 'super-agent'
    `);
    res.json(superAgents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/my-agents
// @desc    Get all agents for the current super-agent
// @access  Private (Super-Agent only)
router.get('/my-agents', auth, authorize('super-agent'), async (req, res) => {
  try {
    const agents = await query(`
      SELECT 
        u.id, 
        u.username AS name, 
        u.email, 
        u.phone_number AS phone, 
        u.state AS region, 
        u.status,
        (SELECT COUNT(*) FROM devices WHERE assigned_by = u.id) AS "devicesManaged",
        (SELECT SUM(p.amount) FROM payments p JOIN loans l ON p.loan_id = l.id WHERE l.agent_id = u.id) AS "totalSales"
      FROM users u
      WHERE u.role = 'agent' AND u.super_agent_id = $1
    `, [req.user.id]);
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
  try {
    const superAgentId = req.user.id;

    const dashboardData = await query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE super_agent_id = $1) AS "agentsManaged",
        (SELECT COUNT(DISTINCT l.customer_id) FROM loans l WHERE l.agent_id IN (SELECT id FROM users WHERE super_agent_id = $1)) AS "totalCustomers",
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN loans l ON p.loan_id = l.id WHERE l.agent_id IN (SELECT id FROM users WHERE super_agent_id = $1)) AS "totalSalesVolume",
        (SELECT COALESCE(SUM(sac.amount), 0) FROM super_agent_commissions sac WHERE sac.super_agent_id = $1) AS "totalCommissionsEarned"
    `, [superAgentId]);

    res.json(dashboardData.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/customers
// @desc    Get all customers for the current super-agent's agents
// @access  Private (Super-Agent only)
router.get('/mycustomers', auth, authorize('super-agent'), async (req, res) => {
  try {
    const superAgentId = req.user.id;
    const customers = await query(`
      SELECT 
        u.id, 
        u.username AS name, 
        u.email, 
        u.phone_number AS phone, 
        u.state AS region, 
        u.status FROM users u
        WHERE created_by = $1
    `, [superAgentId]);
    res.json(customers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/customers
// @desc    Get all customers for the current super-agent's agents
// @access  Private (Super-Agent only)
router.get('/customers', auth, authorize('super-agent'), async (req, res) => {
  try {
    const superAgentId = req.user.id;
    const customers = await query(`
      SELECT 
        u.id, 
        u.username AS name, 
        u.email, 
        u.phone_number AS phone, 
        u.state AS region, 
        u.status,
        (SELECT username FROM users WHERE id = u.super_agent_id) AS "onboardedBy"
      FROM users u
      WHERE u.id IN (
        SELECT l.customer_id FROM loans l WHERE l.agent_id IN (SELECT id FROM users WHERE super_agent_id = $1)
      )
    `, [superAgentId]);
    res.json(customers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/devices
// @desc    Get all devices assigned to the current super-agent
// @access  Private (Super-Agent only)
router.get('/devices', auth, authorize('super-agent'), async (req, res) => {
  try {
    const superAgentId = req.user.id;
    const devices = await query(`
      SELECT
        d.id,
        d.serial_number AS "serialNumber",
        d.status,
        dt.device_name AS type,
        dt.device_model AS model,
        dt.amount
      FROM devices d
      JOIN device_types dt ON d.device_type_id = dt.id
      WHERE d.super_agent_id = $1
    `, [superAgentId]);
    res.json(devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/super-agents/assign-device
// @desc    Assign a device to an agent
// @access  Private (Super-Agent only)
router.post('/assign-device', auth, authorize('super-agent'), async (req, res) => {
  const { device_id, agent_id } = req.body;
  const superAgentId = req.user.id;

  try {
    // 1. Check if device exists, is available, and belongs to the super-agent
    const deviceResult = await query('SELECT * FROM devices WHERE id = $1 AND status = $2 AND super_agent_id = $3', [device_id, 'available', superAgentId]);
    if (deviceResult.rows.length === 0) {
      return res.status(400).json({ msg: 'Device not found, is not available, or you do not have permission to assign it.' });
    }

    // 2. Check if the target agent exists and is managed by this super-agent
    const agentResult = await query('SELECT * FROM users WHERE id = $1 AND role = $2 AND super_agent_id = $3', [agent_id, 'agent', superAgentId]);
    if (agentResult.rows.length === 0) {
      return res.status(400).json({ msg: 'Target agent not found or not managed by you.' });
    }

    // 3. Assign device to the agent
    const assignedDevice = await query(
      'UPDATE devices SET assigned_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;',
      [agent_id, device_id]
    );

    res.json({ msg: 'Device assigned successfully to agent', device: assignedDevice.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/me
// @desc    Get super agent data with all details
// @access  Private (Admin, Super-Agent - can only view their own profile)
router.get('/me', auth, async (req, res) => {
  const id = req.user.id;

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
        u.commission_rate AS "commissionRate",
        COALESCE(SUM(sac.amount), 0) AS "totalCommissionsEarned",
        u.commission_paid AS "commissionPaid",
        ((SELECT COALESCE(SUM(sac2.amount), 0) FROM super_agent_commissions sac2 WHERE sac2.super_agent_id = u.id) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        (SELECT COUNT(*) FROM users WHERE super_agent_id = u.id) AS "agentsManaged",
        (SELECT json_agg(json_build_object(
          'id', a.id,
          'name', a.username,
          'email', a.email,
          'phone', a.phone_number,
          'status', a.status,
          'devicesManaged', (SELECT COUNT(*) FROM devices WHERE assigned_by = a.id)
        )) FROM users a WHERE a.super_agent_id = u.id) AS "managedAgents",
        (SELECT json_agg(json_build_object(
          'id', w.id,
          'amount', w.amount,
          'date', w.withdrawal_date,
          'transactionId', w.transaction_id
        ) ORDER BY w.withdrawal_date DESC) FROM super_agent_withdrawals w WHERE w.super_agent_id = u.id) AS "withdrawalHistory"
      FROM users u
      LEFT JOIN super_agent_commissions sac ON sac.super_agent_id = u.id
      WHERE u.id = $1 AND u.role = 'super-agent'
      GROUP BY u.id
      `,
      [id]
    );

    if (superAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Super Agent not found' });
    }

    // Authorize: Admin can view any super agent, Super-Agent can only view their own profile
    if (req.user.role === 'super-agent' && req.user.id !== id) {
      return res.status(403).json({ msg: 'Access denied: You can only view your own profile.' });
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
router.get('/payments', auth, authorize('super-agent'), async (req, res) => {
  try {
    const superAgentId = req.user.id;
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
        dt.device_name AS device_type
      FROM payments p
      JOIN loans l ON p.loan_id = l.id
      JOIN users u ON p.user_id = u.id
      JOIN users a ON l.agent_id = a.id
      JOIN devices d ON l.device_id = d.id
      JOIN device_types dt ON d.device_type_id = dt.id
      WHERE d.super_agent_id = $1
      ORDER BY p.payment_date DESC
    `, [superAgentId]);
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
        u.commission_rate AS "commissionRate",
        COALESCE(SUM(sac.amount), 0) AS "totalCommissionsEarned",
        u.commission_paid AS "commissionPaid",
        ((SELECT COALESCE(SUM(sac2.amount), 0) FROM super_agent_commissions sac2 WHERE sac2.super_agent_id = u.id) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        (SELECT COUNT(*) FROM users WHERE super_agent_id = u.id) AS "agentsManaged",
        (SELECT json_agg(json_build_object(
          'id', a.id,
          'name', a.username,
          'email', a.email,
          'phone', a.phone_number,
          'status', a.status,
          'devicesManaged', (SELECT COUNT(*) FROM devices WHERE assigned_by = a.id)
        )) FROM users a WHERE a.super_agent_id = u.id) AS "managedAgents",
        (SELECT json_agg(json_build_object(
          'id', w.id,
          'amount', w.amount,
          'date', w.withdrawal_date,
          'transactionId', w.transaction_id
        ) ORDER BY w.withdrawal_date DESC) FROM super_agent_withdrawals w WHERE w.super_agent_id = u.id) AS "withdrawalHistory"
      FROM users u
      LEFT JOIN super_agent_commissions sac ON sac.super_agent_id = u.id
      WHERE u.id = $1 AND u.role = 'super-agent'
      GROUP BY u.id
      `,
      [id]
    );

    if (superAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Super Agent not found' });
    }

    // Authorize: Admin can view any super agent, Super-Agent can only view their own profile
    if (req.user.role === 'super-agent' && req.user.id !== id) {
      return res.status(403).json({ msg: 'Access denied: You can only view your own profile.' });
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

  try {
    // Authorize: Admin can update any super agent, Super-Agent can only update their own profile
    if (req.user.role === 'super-agent' && req.user.id !== id) {
      return res.status(403).json({ msg: 'Access denied: You can only update your own profile.' });
    }

    // Only admin can update commission_rate and status
    if (req.user.role !== 'admin' && (commission_rate !== undefined || status !== undefined)) {
      return res.status(403).json({ msg: 'Access denied: Only administrators can update commission rate or status.' });
    }

    const updatedSuperAgent = await query(
      `UPDATE users SET
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
      WHERE id = $11 RETURNING id, username, email, phone_number, state, city, address, landmark, gps, commission_rate, status, created_at, last_active, commission_paid;
      `,
      [username, email, phone_number, state, city, address, landmark, gps, commission_rate, status, id]
    );

    if (updatedSuperAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Super Agent not found' });
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
router.post('/withdraw-commission', auth, authorize('super-agent', 'admin'), async (req, res) => {
  const { amount } = req.body;
  const superAgentId = req.user.id;

  try {
    // Fetch super agent's current commission details
    const superAgentResult = await query(
      `SELECT 
        COALESCE(SUM(sac.amount), 0) AS total_earned,
        COALESCE(u.commission_paid, 0) AS total_paid,
        u.last_withdrawal_date
      FROM users u
      LEFT JOIN super_agent_commissions sac ON sac.super_agent_id = u.id
      WHERE u.id = $1
      GROUP BY u.commission_paid, u.last_withdrawal_date`,
      [superAgentId]
    );

    if (superAgentResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Super Agent not found.' });
    }

    const { total_earned, total_paid, last_withdrawal_date } = superAgentResult.rows[0];
    const availableBalance = parseFloat(total_earned) - parseFloat(total_paid);

    // Check if withdrawal is allowed this month
    const now = new Date();
    if (last_withdrawal_date) {
      const lastWithdrawal = new Date(last_withdrawal_date);
      if (lastWithdrawal.getMonth() === now.getMonth() && lastWithdrawal.getFullYear() === now.getFullYear()) {
        return res.status(400).json({ msg: 'You can only withdraw commission once a month.' });
      }
    }

    // Validate withdrawal amount
    if (amount <= 0 || amount > availableBalance) {
      return res.status(400).json({ msg: 'Invalid withdrawal amount or insufficient balance.' });
    }

    // Generate a unique transaction ID if not provided
    const finalTransactionId = `SAW-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Record withdrawal
    const newWithdrawal = await query(
      'INSERT INTO super_agent_withdrawals (super_agent_id, amount, transaction_id) VALUES ($1, $2, $3) RETURNING *;',
      [superAgentId, amount, finalTransactionId]
    );

    // Update super agent's commission_paid and last_withdrawal_date
    const updatedSuperAgent = await query(
      'UPDATE users SET commission_paid = commission_paid + $1, last_withdrawal_date = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;',
      [amount, superAgentId]
    );

    res.json({ msg: 'Commission withdrawn successfully', withdrawal: newWithdrawal.rows[0], superAgent: updatedSuperAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/super-agents/messages
// @desc    Get all messages/notifications for the current super-agent
// @access  Private (Super-Agent only)
router.get('/messages', auth, authorize('super-agent'), async (req, res) => {
  try {
    const superAgentId = req.user.id;
    // Fetch messages where the super-agent is either the sender or the receiver
    const messages = await query(`
      SELECT
        m.id,
        m.sender_id,
        s.username AS sender_name,
        m.receiver_id,
        r.username AS receiver_name,
        m.message_type,
        m.content,
        m.read_status,
        m.created_at,
        m.parent_message_id
      FROM messages m
      LEFT JOIN users s ON m.sender_id = s.id
      LEFT JOIN users r ON m.receiver_id = r.id
      WHERE m.receiver_id = $1 OR m.sender_id = $1
      ORDER BY m.created_at DESC
    `, [superAgentId]);
    res.json(messages.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/super-agents/messages
// @desc    Send a message/reply from the super-agent
// @access  Private (Super-Agent only)
router.post('/messages', auth, authorize('super-agent'), async (req, res) => {
  const { receiver_id, message_type, content, parent_message_id } = req.body;
  const sender_id = req.user.id;

  try {
    // Basic validation
    if (!receiver_id || !content) {
      return res.status(400).json({ msg: 'Receiver ID and content are required.' });
    }

    // Check if receiver exists
    const receiver = await query('SELECT id FROM users WHERE id = $1', [receiver_id]);
    if (receiver.rows.length === 0) {
      return res.status(404).json({ msg: 'Receiver not found.' });
    }

    const newMessage = await query(
      'INSERT INTO messages (sender_id, receiver_id, message_type, content, parent_message_id) VALUES ($1, $2, $3, $4, $5) RETURNING *;',
      [sender_id, receiver_id, message_type || 'message', content, parent_message_id || null]
    );

    res.json({ msg: 'Message sent successfully', message: newMessage.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/super-agents/messages/:id/read
// @desc    Mark a message as read
// @access  Private (Super-Agent only)
router.put('/messages/:id/read', auth, authorize('super-agent'), async (req, res) => {
  const { id } = req.params;
  const superAgentId = req.user.id;

  try {
    const updatedMessage = await query(
      'UPDATE messages SET read_status = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND receiver_id = $2 RETURNING *;',
      [id, superAgentId]
    );

    if (updatedMessage.rows.length === 0) {
      return res.status(404).json({ msg: 'Message not found or you are not the receiver.' });
    }

    res.json({ msg: 'Message marked as read', message: updatedMessage.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;