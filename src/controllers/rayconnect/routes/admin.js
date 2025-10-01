const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const can = require('../middleware/can');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

// @route   POST api/admin/create-agent
// @desc    Create a new agent for the business
// @access  Private (user:manage)
router.post('/create-agent', auth, can('user:manage'), async (req, res) => {
  const { username, role, email, password, phone_number, state, city, address, landmark, gps, name } = req.body;
  console.log({role});
  const { id: creatorId, business_id, role: creatorRole } = req.user;
  const customerRole = await query('SELECT * FROM  roles WHERE  business_id = $1 AND name = $2', [business_id, 'Agent']);
  const role_id = customerRole.rows.length > 0 ? customerRole.rows[0].id : null;
  if (!business_id) {
    return res.status(400).json({ msg: 'User is not associated with a business.' });
  }
  if (!role_id) {
    return res.status(400).json({ msg: 'Role not available' });
  }
  try {
    let user = await query('SELECT * FROM ray_users WHERE (username = $1 OR email = $2) AND business_id = $3', [username, email, business_id]);
    if (user.rows.length > 0) {
      return res.status(400).json({ msg: 'User with this username or email already exists in this business.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const superAgentId = creatorRole === 'super-agent' ? creatorId : null;

    const newAgent = await query(
      'INSERT INTO ray_users (username, email, password, role, phone_number, state, city, address, landmark, gps, super_agent_id, name, status, business_id, role_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id, username, email, role, phone_number, state, city, address, landmark, gps, super_agent_id, name, business_id',
      [username, email, hashedPassword, creatorRole === 'super-agent' ? 'agent' : role, phone_number, state, city, address, landmark, gps, superAgentId, name, creatorRole === 'admin' ? 'active' : 'pending', business_id, role_id]
    );

    res.json({ msg: 'Agent created successfully', agent: newAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/admin/create-super-agent
// @desc    Create a new super-agent for the business
// @access  Private (user:manage)
router.post('/create-super-agent', auth, can('user:manage'), async (req, res) => {
  const { username, email, password, phone_number, state, city, address, landmark, gps } = req.body;
  const { business_id } = req.user;
  const customerRole = await query('SELECT * FROM  roles WHERE  business_id = $1 AND name = $2', [business_id, role.toLowerCase() === 'agent' ? 'Agent': role.toLowerCase() === 'super-agent' ? 'Super Agent' : '']);
  const role_id = customerRole.rows.length > 0 ? customerRole.rows[0].id : null;

  if (!business_id) {
    return res.status(400).json({ msg: 'User is not associated with a business.' });
  }
  if (!role_id) {
    return res.status(400).json({ msg: 'Role not available' });
  }

  try {
    let user = await query('SELECT * FROM ray_users WHERE (username = $1 OR email = $2) AND business_id = $3', [username, email, business_id]);
    if (user.rows.length > 0) {
      return res.status(400).json({ msg: 'User with this username or email already exists in this business.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newSuperAgent = await query(
      'INSERT INTO ray_users (username, email, password, role, phone_number, state, city, address, landmark, gps, status, business_id, role_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, username, email, role, phone_number, state, city, address, landmark, gps, business_id',
      [username, email, hashedPassword, 'super-agent', phone_number, state, city, address, landmark, gps, 'active', business_id, role_id]
    );

    res.json({ msg: 'Super-agent created successfully', superAgent: newSuperAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/set-agent-commission/:id
// @desc    Set commission rate for an agent in the business
// @access  Private (agent:set:commission)
router.put('/set-agent-commission/:id', auth, can('agent:set:commission'), async (req, res) => {
  const { id } = req.params;
  const { commission_rate } = req.body;
  const { business_id } = req.user;

  try {
    if (typeof commission_rate !== 'number' || commission_rate < 0 || commission_rate > 100) {
      return res.status(400).json({ msg: 'Commission rate must be a number between 0 and 100.' });
    }

    const agent = await query("SELECT id FROM ray_users WHERE id = $1 AND role = 'agent' AND business_id = $2", [id, business_id]);
    if (agent.rows.length === 0) {
      return res.status(404).json({ msg: 'Agent not found in your business.' });
    }

    const updatedAgent = await query(
      'UPDATE ray_users SET commission_rate = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3 RETURNING id, username, email, role, commission_rate;',
      [commission_rate, id, business_id]
    );

    res.json({ msg: 'Agent commission rate updated successfully', agent: updatedAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/super-agent/:id
// @desc    Update super-agent information in the business
// @access  Private (user:manage)
router.put('/super-agent/:id', auth, can('user:manage'), async (req, res) => {
  const { id } = req.params;
  const { username, email, phone_number, state, city, address, landmark, gps, commission_rate, status } = req.body;
  const { business_id } = req.user;

  try {
    const userCheck = await query("SELECT * FROM ray_users WHERE id = $1 AND role = 'super-agent' AND business_id = $2", [id, business_id]);
    if (userCheck.rows.length === 0) {
        return res.status(404).json({ msg: 'Super-agent not found in your business.' });
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
      WHERE id = $11 AND role = 'super-agent' AND business_id = $12
      RETURNING id, username, email, phone_number, state, city, address, landmark, gps, super_commission_rate, status;
      `,
      [username, email, phone_number, state, city, address, landmark, gps, commission_rate, status, id, business_id]
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
// @desc    Get general commission rates for the business
// @access  Private (business:update)
router.get('/settings/commission', auth, can('business:update'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const rates = await query("SELECT setting_key, setting_value FROM ray_settings WHERE business_id = $1 AND setting_key IN ('general_agent_commission_rate', 'general_super_agent_commission_rate')", [business_id]);
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
// @desc    Update general commission rates for the business
// @access  Private (business:update)
router.put('/settings/commission', auth, can('business:update'), async (req, res) => {
  const { agent_rate, super_agent_rate } = req.body;
  const { business_id } = req.user;

  try {
    if (agent_rate !== undefined) {
      await query("INSERT INTO ray_settings (setting_key, setting_value, business_id) VALUES ($1, $2, $3) ON CONFLICT (business_id, setting_key) DO UPDATE SET setting_value = $2", ['general_agent_commission_rate', agent_rate, business_id]);
    }
    if (super_agent_rate !== undefined) {
      await query("INSERT INTO ray_settings (setting_key, setting_value, business_id) VALUES ($1, $2, $3) ON CONFLICT (business_id, setting_key) DO UPDATE SET setting_value = $2", ['general_super_agent_commission_rate', super_agent_rate, business_id]);
    }
    res.json({ msg: 'General commission rates updated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/admin/assign-device-to-super-agent
// @desc    Assign a device to a super-agent within the business
// @access  Private (device:update)
router.put('/assign-device-to-super-agent', auth, can('device:update'), async (req, res) => {
  const { deviceIds, superAgentId } = req.body;
  const { business_id } = req.user;

  try {
    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0 || !superAgentId) {
      return res.status(400).json({ msg: 'Device IDs (array) and Super-Agent ID are required.' });
    }

    const superAgent = await query(`SELECT id FROM ray_users WHERE id = $1 AND role = 'super-agent' AND business_id = $2`, [superAgentId, business_id]);
    if (superAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Super-agent not found in your business.' });
    }

    const updatedDevices = await query(
      'UPDATE ray_devices SET super_agent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2::uuid[]) AND business_id = $3 RETURNING *;',
      [superAgentId, deviceIds, business_id]
    );

    if (updatedDevices.rows.length !== deviceIds.length) {
      console.warn('Not all devices were found or belonged to the business during assignment.');
    }
    if (updatedDevices.rows.length === 0) {
      return res.status(404).json({ msg: 'No devices found or updated. Ensure they belong to your business.' });
    }

    res.json({ msg: 'Devices assigned successfully', devices: updatedDevices.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/admin/add-credit
// @desc    Admin adds credit to an agent or super-agent in the business
// @access  Private (agent:manage:credit)
router.post('/add-credit', auth, can('agent:manage:credit'), async (req, res) => {
  const { user_id, amount, description } = req.body;
  const { business_id, id: adminId } = req.user;

  try {
    if (!user_id || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ msg: 'User ID and a positive amount are required.' });
    }

    const targetUser = await query("SELECT id, role, credit_balance FROM ray_users WHERE id = $1 AND (role = 'agent' OR role = 'super-agent') AND business_id = $2", [user_id, business_id]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ msg: 'Target user not found in your business.' });
    }

    const oldBalance = parseFloat(targetUser.rows[0].credit_balance);
    const newBalance = oldBalance + amount;

    await query('UPDATE ray_users SET credit_balance = $1 WHERE id = $2 AND business_id = $3', [newBalance, user_id, business_id]);

    await query(
      'INSERT INTO ray_credit_transactions (user_id, transaction_type, amount, new_balance, description, created_by, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [user_id, 'add', amount, newBalance, description || 'Admin added credit', adminId, business_id]
    );

    res.json({ msg: 'Credit added successfully', newBalance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/admin/reconcile-credit
// @desc    Admin reconciles (deducts) credit from an agent or super-agent in the business
// @access  Private (agent:manage:credit)
router.post('/reconcile-credit', auth, can('agent:manage:credit'), async (req, res) => {
  const { user_id, amount, description } = req.body;
  const { business_id, id: adminId } = req.user;

  try {
    if (!user_id || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ msg: 'User ID and a positive amount are required.' });
    }

    const targetUser = await query("SELECT id, role, credit_balance FROM ray_users WHERE id = $1 AND (role = 'agent' OR role = 'super-agent') AND business_id = $2", [user_id, business_id]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ msg: 'Target user not found in your business.' });
    }

    const oldBalance = parseFloat(targetUser.rows[0].credit_balance);
    const newBalance = oldBalance - amount;

    await query('UPDATE ray_users SET credit_balance = $1 WHERE id = $2 AND business_id = $3', [newBalance, user_id, business_id]);

    await query(
      'INSERT INTO ray_credit_transactions (user_id, transaction_type, amount, new_balance, description, created_by, business_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [user_id, 'reconcile', amount, newBalance, description || 'Admin reconciled credit', adminId, business_id]
    );

    res.json({ msg: 'Credit reconciled successfully', newBalance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/admin/credit-transactions
// @desc    Get credit transactions for the business
// @access  Private (agent:read)
router.get('/credit-transactions', auth, can('agent:read'), async (req, res) => {
    const { business_id } = req.user;
    const { user_id, transaction_type } = req.query;

    try {
        let queryText = `
            SELECT 
                ct.*, 
                u.username as user_username, 
                creator.username as creator_username 
            FROM ray_credit_transactions ct
            JOIN ray_users u ON ct.user_id = u.id
            LEFT JOIN ray_users creator ON ct.created_by = creator.id
            WHERE ct.business_id = $1
        `;
        const queryParams = [business_id];

        if (user_id) {
            queryParams.push(user_id);
            queryText += ` AND ct.user_id = $${queryParams.length}`;
        }

        if (transaction_type) {
            queryParams.push(transaction_type);
            queryText += ` AND ct.transaction_type = $${queryParams.length}`;
        }

        queryText += ' ORDER BY ct.created_at DESC';

        const transactions = await query(queryText, queryParams);
        res.json(transactions.rows);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route   GET api/admin/agent/:id/credit-summary
// @desc    Get a summary of credit activities for a specific agent
// @access  Private (agent:read)
router.get('/agent/:id/credit-summary', auth, can('agent:read'), async (req, res) => {
    const { id: agent_id } = req.params;
    const { business_id } = req.user;

    try {
        // 1. Verify agent exists in the business and get current balance
        const agentQuery = query("SELECT credit_balance FROM ray_users WHERE id = $1 AND (role = 'agent' OR role = 'super-agent') AND business_id = $2", [agent_id, business_id]);
        
        // 2. Get transaction summaries
        const summaryQueryText = `
            SELECT
                COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'add'), 0) AS total_credit_added,
                COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'payment'), 0) AS total_credit_spent_on_payments,
                COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'reconcile'), 0) AS total_credit_reconciled
            FROM
                ray_credit_transactions
            WHERE
                user_id = $1 AND business_id = $2;
        `;
        const summaryQuery = query(summaryQueryText, [agent_id, business_id]);

        const [agentResult, summaryResult] = await Promise.all([agentQuery, summaryQuery]);

        if (agentResult.rows.length === 0) {
            return res.status(404).json({ msg: 'Agent not found in your business.' });
        }

        const summary = summaryResult.rows[0];
        const current_credit_balance = agentResult.rows[0].credit_balance;

        res.json({
            agent_id: agent_id,
            total_credit_added: parseFloat(summary.total_credit_added),
            total_credit_spent_on_payments: parseFloat(summary.total_credit_spent_on_payments),
            total_credit_reconciled: parseFloat(summary.total_credit_reconciled),
            current_credit_balance: parseFloat(current_credit_balance)
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/admin/devices/:id/reprocess
// @desc    Reprocess a device to make it available again, with logging.
// @access  Private (device:reprocess)
router.put('/devices/:id/reprocess', auth, can('device:reprocess'), async (req, res) => {
    const { id: device_id } = req.params;
    const { business_id, id: admin_id } = req.user;
    const { reason, notes } = req.body;

    if (!reason) {
        return res.status(400).json({ msg: 'A reason for reprocessing is required.' });
    }

    const { pool } = require('../config/database');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Get the device's current state
        const deviceResult = await client.query('SELECT status FROM ray_devices WHERE id = $1 AND business_id = $2 FOR UPDATE', [device_id, business_id]);
        if (deviceResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ msg: 'Device not found in your business.' });
        }
        const previous_status = deviceResult.rows[0].status;

        // 2. Safety check: Ensure the device is not tied to an active loan
        const activeLoan = await client.query(
            "SELECT id FROM ray_loans WHERE device_id = $1 AND status = 'active' AND business_id = $2",
            [device_id, business_id]
        );
        if (activeLoan.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ msg: 'Device cannot be reprocessed. It is still tied to an active loan.', loan_id: activeLoan.rows[0].id });
        }

        // 3. Update the device
        const updatedDevice = await client.query(
            `UPDATE ray_devices
             SET
                status = 'available',
                assigned_to = NULL,
                assigned_by = NULL,
                super_agent_id = NULL,
                install_date = NULL,
                updated_at = CURRENT_TIMESTAMP
             WHERE
                id = $1 AND business_id = $2
             RETURNING *;`,
            [device_id, business_id]
        );

        // 4. Log the change in the history table
        await client.query(
            `INSERT INTO ray_device_history (device_id, business_id, changed_by, previous_status, new_status, reason, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [device_id, business_id, admin_id, previous_status, 'available', reason, notes]
        );

        await client.query('COMMIT');
        res.json({ msg: 'Device has been successfully reprocessed and is now available.', device: updatedDevice.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

// @route   GET api/admin/devices/:id/history
// @desc    Get the history log for a specific device
// @access  Private (device:read)
router.get('/devices/:id/history', auth, can('device:read'), async (req, res) => {
    const { id: device_id } = req.params;
    const { business_id } = req.user;

    try {
        const history = await query(
            `SELECT h.*, u.username as changed_by_username
             FROM ray_device_history h
             LEFT JOIN ray_users u ON h.changed_by = u.id
             WHERE h.device_id = $1 AND h.business_id = $2
             ORDER BY h.created_at DESC`,
            [device_id, business_id]
        );

        res.json(history.rows);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route   PUT api/admin/agents/:id/approval
// @desc    Approve or reject an agent's registration request
// @access  Private (user:manage)
router.put('/agents/:id/approval', auth, can('user:manage'), async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body; // status: 'active' or 'rejected'
  const { business_id } = req.user;

  if (!status || !['active', 'rejected'].includes(status)) {
    return res.status(400).json({ msg: "Invalid status. Must be 'active' or 'rejected'." });
  }

  if (status === 'rejected' && !reason) {
    return res.status(400).json({ msg: 'A reason is required for rejection.' });
  }

  try {
    const agent = await query("SELECT id, status FROM ray_users WHERE id = $1 AND role = 'agent' AND business_id = $2", [id, business_id]);
    if (agent.rows.length === 0) {
      return res.status(404).json({ msg: 'Agent not found in your business.' });
    }

    if (agent.rows[0].status !== 'pending') {
      return res.status(400).json({ msg: `Agent is not pending approval. Current status: ${agent.rows[0].status}` });
    }

    let updatedAgent;
    if (status === 'rejected') {
      updatedAgent = await query(
        'UPDATE ray_users SET status = $1, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND business_id = $4 RETURNING id, username, email, role, status, rejection_reason;',
        [status, reason, id, business_id]
      );
    } else { // 'active'
      updatedAgent = await query(
        'UPDATE ray_users SET status = $1, rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3 RETURNING id, username, email, role, status;',
        [status, id, business_id]
      );
    }

    res.json({ msg: `Agent request ${status}.`, agent: updatedAgent.rows[0] });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;