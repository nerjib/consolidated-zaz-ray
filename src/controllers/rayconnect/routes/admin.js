const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

// @route   POST api/admin/create-agent
// @desc    Create a new agent
// @access  Private (Admin, Super-Agent)
router.post('/create-agent', auth, authorize('admin', 'super-agent'), async (req, res) => {
  const { username, role, email, password, phone_number, state, city, address, landmark, gps, name } = req.body;

  try {
    let user = await query('SELECT * FROM ray_users WHERE username = $1 OR email = $2', [username, email]);
    if (user.rows.length > 0) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const superAgentId = req.user.role === 'super-agent' ? req.user.id : null;

    const newAgent = await query(
      'INSERT INTO ray_users (username, email, password, role, phone_number, state, city, address, landmark, gps, super_agent_id, name, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, username, email, role, phone_number, state, city, address, landmark, gps, super_agent_id, name',
      [username, email, hashedPassword, req.user.role === 'super-agent' ? 'agent' : role, phone_number, state, city, address, landmark, gps, superAgentId, name, req.user.role === 'admin' ? 'active' : 'pending']
    );

    res.json({ msg: 'Agent created successfully', agent: newAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/admin/create-super-agent
// @desc    Create a new super-agent
// @access  Private (Admin only)
router.post('/create-super-agent', auth, authorize('admin'), async (req, res) => {
  const { username, email, password, phone_number, state, city, address, landmark, gps } = req.body;

  try {
    let user = await query('SELECT * FROM ray_users WHERE username = $1 OR email = $2', [username, email]);
    if (user.rows.length > 0) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newSuperAgent = await query(
      'INSERT INTO ray_users (username, email, password, role, phone_number, state, city, address, landmark, gps, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, username, email, role, phone_number, state, city, address, landmark, gps',
      [username, email, hashedPassword, 'super-agent', phone_number, state, city, address, landmark, gps, 'active']
    );

    res.json({ msg: 'Super-agent created successfully', superAgent: newSuperAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/set-agent-commission/:id
// @desc    Set commission rate for an agent
// @access  Private (Admin only)
router.put('/set-agent-commission/:id', auth, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { commission_rate } = req.body;

  try {
    // Validate commission_rate
    if (typeof commission_rate !== 'number' || commission_rate < 0 || commission_rate > 100) {
      return res.status(400).json({ msg: 'Commission rate must be a number between 0 and 100.' });
    }

    // Check if user exists and is an agent
    const agent = await query("SELECT id, role FROM ray_users WHERE id = $1 AND role = 'agent'", [id]);
    if (agent.rows.length === 0) {
      return res.status(404).json({ msg: 'Agent not found' });
    }

    const updatedAgent = await query(
      'UPDATE ray_users SET commission_rate = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, role, commission_rate;',
      [commission_rate, id]
    );

    res.json({ msg: 'Agent commission rate updated successfully', agent: updatedAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/super-agent/:id
// @desc    Update super-agent information
// @access  Private (Admin only)
router.put('/super-agent/:id', auth, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { username, email, phone_number, state, city, address, landmark, gps, commission_rate, status } = req.body;

  try {
    // Check if user exists and is a super-agent
    const userCheck = await query("SELECT * FROM ray_users WHERE id = $1 AND role = 'super-agent'", [id]);
    if (userCheck.rows.length === 0) {
        return res.status(404).json({ msg: 'Super-agent not found' });
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
        super_commission_rate = COALESCE($9, commission_rate),
        status = COALESCE($10, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 AND role = 'super-agent'
      RETURNING id, username, email, phone_number, state, city, address, landmark, gps, super_commission_rate, status;
      `,
      [username, email, phone_number, state, city, address, landmark, gps, commission_rate, status, id]
    );

    if (updatedSuperAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Super-agent not found or not updated' });
    }

    res.json({ msg: 'Super-agent updated successfully', superAgent: updatedSuperAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/admin/settings/commission
// @desc    Get general commission rates
// @access  Private (Admin only)
router.get('/settings/commission', auth, authorize('admin'), async (req, res) => {
  try {
    const rates = await query("SELECT setting_key, setting_value FROM ray_settings WHERE setting_key IN ('general_agent_commission_rate', 'general_super_agent_commission_rate')");
    const commissionRates = rates.rows.reduce((acc, rate) => {
      acc[rate.setting_key] = parseFloat(rate.setting_value);
      return acc;
    }, {});
    res.json(commissionRates);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/settings/commission
// @desc    Update general commission rates
// @access  Private (Admin only)
router.put('/settings/commission', auth, authorize('admin'), async (req, res) => {
  const { agent_rate, super_agent_rate } = req.body;

  try {
    if (agent_rate !== undefined) {
      await query("UPDATE ray_settings SET setting_value = $1 WHERE setting_key = 'general_agent_commission_rate'", [agent_rate]);
    }
    if (super_agent_rate !== undefined) {
      await query("UPDATE ray_settings SET setting_value = $1 WHERE setting_key = 'general_super_agent_commission_rate'", [super_agent_rate]);
    }
    res.json({ msg: 'General commission rates updated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/assign-device-to-super-agent
// @desc    Assign a device to a super-agent
// @access  Private (Admin only)
router.put('/assign-device-to-super-agent', auth, authorize('admin'), async (req, res) => {
  const { deviceIds, superAgentId } = req.body;

  try {
    // Validate input
    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0 || !superAgentId) {
      return res.status(400).json({ msg: 'Device IDs (array) and Super-Agent ID are required.' });
    }

    // Check if super-agent exists and has the role 'super-agent'
    const superAgent = await query(`SELECT id FROM ray_users WHERE id = $1 AND role = 'super-agent'`, [superAgentId]);
    if (superAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Super-agent not found or is not a super-agent.' });
    }

    // Assign ray_devices to super-agent
    const updatedDevices = await query(
      'UPDATE ray_devices SET super_agent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2::uuid[]) RETURNING *;',
      [superAgentId, deviceIds]
    );

    if (updatedDevices.rows.length === 0) {
      return res.status(404).json({ msg: 'No ray_devices found or updated.' });
    }

    res.json({ msg: 'Devices assigned successfully', ray_devices: updatedDevices.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/admin/add-credit
// @desc    Admin adds credit to an agent or super-agent
// @access  Private (Admin only)
router.post('/add-credit', auth, authorize('admin'), async (req, res) => {
  const { user_id, amount, description } = req.body; // user_id is the agent/super-agent to add credit to

  try {
    // Validate input
    if (!user_id || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ msg: 'User ID and a positive amount are required.' });
    }

    // Check if user exists and is an agent or super-agent
    const targetUser = await query("SELECT id, role, credit_balance FROM ray_users WHERE id = $1 AND (role = 'agent' OR role = 'super-agent')", [user_id]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ msg: 'Target user not found or is not an agent/super-agent.' });
    }

    const oldBalance = parseFloat(targetUser.rows[0].credit_balance);
    const newBalance = oldBalance + amount;

    // Update user's credit balance
    await query('UPDATE ray_users SET credit_balance = $1 WHERE id = $2', [newBalance, user_id]);

    // Record the transaction
    await query(
      'INSERT INTO ray_credit_transactions (user_id, transaction_type, amount, new_balance, description, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [user_id, 'add', amount, newBalance, description || 'Admin added credit', req.user.id]
    );

    res.json({ msg: 'Credit added successfully', newBalance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/admin/reconcile-credit
// @desc    Admin reconciles (deducts) credit from an agent or super-agent
// @access  Private (Admin only)
router.post('/reconcile-credit', auth, authorize('admin'), async (req, res) => {
  const { user_id, amount, description } = req.body; // user_id is the agent/super-agent to deduct credit from

  try {
    // Validate input
    if (!user_id || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ msg: 'User ID and a positive amount are required.' });
    }

    // Check if user exists and is an agent or super-agent
    const targetUser = await query("SELECT id, role, credit_balance FROM ray_users WHERE id = $1 AND (role = 'agent' OR role = 'super-agent')", [user_id]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ msg: 'Target user not found or is not an agent/super-agent.' });
    }

    const oldBalance = parseFloat(targetUser.rows[0].credit_balance);
    const newBalance = oldBalance - amount; // Deduct credit

    // Prevent negative balance if not explicitly allowed (optional, depending on business logic)
    // if (newBalance < 0) {
    //   return res.status(400).json({ msg: 'Cannot reconcile more credit than available balance.' });
    // }

    // Update user's credit balance
    await query('UPDATE ray_users SET credit_balance = $1 WHERE id = $2', [newBalance, user_id]);

    // Record the transaction
    await query(
      'INSERT INTO ray_credit_transactions (user_id, transaction_type, amount, new_balance, description, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [user_id, 'reconcile', amount, newBalance, description || 'Admin reconciled credit', req.user.id]
    );

    res.json({ msg: 'Credit reconciled successfully', newBalance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
