const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   GET api/agents
// @desc    Get all agents information
// @access  Private (Admin only)
router.get('/', auth, authorize('admin'), async (req, res) => {
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
        u.commission_rate AS "commissionRate",
        (SELECT COUNT(*) FROM ray_devices WHERE assigned_by = u.id) AS "devicesManaged",
        (SELECT COUNT(*) FROM ray_users WHERE created_by = u.id AND role = 'customer') AS "totalCustomers",
        (SELECT SUM(p.amount) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = u.id) AS "totalSales",
        (SELECT COALESCE(SUM(c.amount), 0) FROM ray_commissions c WHERE c.agent_id = u.id) AS "totalCommissionsEarned",
        u.commission_paid AS "commissionPaid",
        ((SELECT COALESCE(SUM(c.amount), 0) FROM ray_commissions c WHERE c.agent_id = u.id) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        u.last_active
      FROM ray_users u
      WHERE u.role = 'agent'
    `);
    res.json(agents.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/me
// @desc    Get current agent's profile with comprehensive details
// @access  Private (Agent and Admin only)
router.get('/me', auth, authorize('agent', 'admin'), async (req, res) => {
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
        u.status,
        u.credit_balance,
        u.created_at AS "joinDate",
        u.last_active,
        u.commission_rate AS "commissionRate",
        COALESCE(SUM(c.amount), 0) AS "totalCommissionsEarned",
        u.commission_paid AS "commissionPaid",
        ((SELECT COALESCE(SUM(comm.amount), 0) FROM ray_commissions comm WHERE comm.agent_id = u.id) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        (SELECT COUNT(*) FROM ray_devices WHERE assigned_by = u.id) AS "devicesManaged",
        (SELECT SUM(p.amount) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = u.id) AS "totalSales",
        (SELECT json_agg(json_build_object(
          'id', d.id,
          'serialNumber', d.serial_number,
          'status', d.status,
          'customerName', (SELECT username FROM ray_users WHERE id = d.assigned_to),
          'installDate', d.created_at
        )) FROM ray_devices d WHERE d.assigned_by = u.id) AS "assignedDevices",
        (SELECT json_agg(json_build_object(
          'id', w.id,
          'amount', w.amount,
          'date', w.withdrawal_date,
          'transactionId', w.transaction_id
        ) ORDER BY w.withdrawal_date DESC) FROM ray_agent_withdrawals w WHERE w.agent_id = u.id) AS "withdrawalHistory"
      FROM ray_users u
      LEFT JOIN ray_commissions c ON c.agent_id = u.id
      WHERE u.id = $1 AND u.role = 'agent'
      GROUP BY u.id
    `, [req.user.id]);

    if (agent.rows.length === 0) {
      return res.status(404).json({ msg: 'Agent not found' });
    }
    res.json(agent.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/dashboard
// @desc    Get agent dashboard data
// @access  Private (Agent only)
router.get('/dashboard', auth, authorize('agent'), async (req, res) => {
  try {
    const agentId = req.user.id;

    // Total Customers managed by this agent
    const totalCustomersResult = await query(
      'SELECT COUNT(*) FROM ray_users WHERE created_by = $1 AND role = $2',
      [agentId, 'customer']
    );
    const totalCustomers = parseInt(totalCustomersResult.rows[0].count, 10);

    // Total Loans created by this agent
    const totalLoansResult = await query(
      'SELECT COUNT(*) FROM ray_loans WHERE agent_id = $1',
      [agentId]
    );
    const totalLoans = parseInt(totalLoansResult.rows[0].count, 10);

    // Total Payments Collected by this agent
    const totalPaymentsCollectedResult = await query(
      'SELECT COALESCE(SUM(p.amount), 0) AS total_payments FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = $1',
      [agentId]
    );
    const totalPaymentsCollected = parseFloat(totalPaymentsCollectedResult.rows[0].total_payments).toFixed(2);

    // Total Commissions Earned by this agent
    const totalCommissionsEarnedResult = await query(
      'SELECT COALESCE(SUM(amount), 0) AS total_commissions FROM ray_commissions WHERE agent_id = $1',
      [agentId]
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
// @access  Private (Agent only)
router.get('/customers', auth, authorize('agent'), async (req, res) => {
  try {
    const agentId = req.user.id;
    const customers = await query(`
      SELECT 
        id, 
        username AS name, 
        phone_number AS phone, 
        state AS region, 
        status,
        (SELECT username FROM ray_users WHERE id = u.created_by) AS "onboardedBy"
      FROM ray_users u
      WHERE created_by = $1 AND role = 'customer'
    `, [agentId]);
    res.json(customers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/devices
// @desc    Get devices assigned by the current agent
// @access  Private (Agent only)
router.get('/devices', auth, authorize('agent'), async (req, res) => {
  try {
    const agentId = req.user.id;
    const devices = await query(`
      SELECT 
        id, 
        serial_number AS "serialNumber", 
        status, 
        model as type, 
        model,
        assigned_to AS "assignedToCustomerId",
        (SELECT username FROM ray_users WHERE id = d.assigned_to) AS "assignedToCustomerName"
      FROM ray_devices d
      WHERE assigned_by = $1
    `, [agentId]);
    res.json(devices.rows);
    console.log(devices.rows[0])
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/available-devices
// @desc    Get available devices for assignment by the current agent
// @access  Private (Agent only)
router.get('/available-devices', auth, authorize('agent'), async (req, res) => {
  try {
    const agentId = req.user.id; // Get the ID of the authenticated agent
    const devices = await query(`
      SELECT 
        d.id, 
        d.serial_number AS "serialNumber", 
        d.model as type,
        d.status,
         dt.device_name AS type,
        dt.device_model AS model,
        dt.pricing->>'one-time' AS price,
        dt.pricing AS plan,
         COALESCE(json_agg(DISTINCT deal.allowed_payment_frequencies) FILTER (WHERE deal.id IS NOT NULL), '["monthly", "weekly", "daily"]') AS "allowedPaymentFrequencies",
        json_agg(json_build_object(
          'id', deal.id,
          'dealName', deal.deal_name,
          'startDate', deal.start_date,
          'endDate', deal.end_date,
          'allowedPaymentFrequencies', deal.allowed_payment_frequencies
        )) FILTER (WHERE deal.id IS NOT NULL) AS "activeDeals"
      FROM ray_devices d
      JOIN ray_device_types dt ON d.device_type_id = dt.id
        LEFT JOIN ray_deals deal ON dt.id = deal.device_type_id AND deal.start_date <= CURRENT_DATE AND deal.end_date >= CURRENT_DATE
      WHERE d.status = 'available' AND d.assigned_by = $1
      GROUP BY d.id, dt.id
    `, [agentId]); // Filter by agent's ID (assuming assigned_to temporarily holds agent's ID)
    res.json(devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/agents/payments
// @desc    Get payments related to ray_loans originated by the current agent
// @access  Private (Agent only)
router.get('/payments', auth, authorize('agent'), async (req, res) => {
  try {
    const agentId = req.user.id;
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
      WHERE l.agent_id = $1
      ORDER BY p.payment_date DESC
    `, [agentId]);
    res.json(payments.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/agents/assign-device
// @desc    Assign a device to a customer
// @access  Private (Agent and Admin only)
router.post('/assign-device', auth, authorize('agenta', 'super-agenta', 'admina'), async (req, res) => {
  const { device_id, customer_id } = req.body;

  try {
    // Check if device exists and is available
    let device = await query('SELECT * FROM ray_devices WHERE id = $1 AND status = $2', [device_id, 'available']);
    if (device.rows.length === 0) {
      return res.status(400).json({ msg: 'Device not found or not available for assignment' });
    }

    // Check if customer exists and is a customer role
    let customer = await query('SELECT * FROM ray_users WHERE id = $1 AND role = $2', [customer_id, 'customer']);
    if (customer.rows.length === 0) {
      return res.status(400).json({ msg: 'Customer not found' });
    }

    // Assign device
    const assignedDevice = await query(
      'UPDATE ray_devices SET assigned_to = $1, assigned_by = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *;',
      [customer_id, req.user.id, 'assigned', device_id]
    );

    res.json({ msg: 'Device assigned successfully', device: assignedDevice.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Add more agent-specific routes here (e.g., assign device to customer)

// @route   GET api/agents/:id
// @desc    Get single agent data with all details
// @access  Private (Admin, Agent - can only view their own profile)
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;

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
        u.status,
        u.created_at AS "joinDate",
        u.last_active,
        u.credit_balance,
        u.commission_rate AS "commissionRate",
        COALESCE(SUM(c.amount), 0) AS "totalCommissionsEarned",
        u.commission_paid AS "commissionPaid",
        ((SELECT COALESCE(SUM(comm.amount), 0) FROM ray_commissions comm WHERE comm.agent_id = u.id) - COALESCE(u.commission_paid, 0)) AS "commissionBalance",
        (SELECT COUNT(*) FROM ray_devices WHERE assigned_by = u.id) AS "devicesManaged",
        (SELECT SUM(p.amount) FROM ray_payments p JOIN ray_loans l ON p.loan_id = l.id WHERE l.agent_id = u.id) AS "totalSales",
        (SELECT json_agg(json_build_object(
          'id', d.id,
          'serialNumber', d.serial_number,
          'status', d.status,
          'customerName', (SELECT username FROM ray_users WHERE id = d.assigned_to),
          'installDate', d.created_at
        )) FROM ray_devices d WHERE d.assigned_by = u.id) AS "assignedDevices",
        (SELECT json_agg(json_build_object(
          'id', w.id,
          'amount', w.amount,
          'date', w.withdrawal_date,
          'transactionId', w.transaction_id
        ) ORDER BY w.withdrawal_date DESC) FROM ray_agent_withdrawals w WHERE w.agent_id = u.id) AS "withdrawalHistory"
      FROM ray_users u
      LEFT JOIN ray_commissions c ON c.agent_id = u.id
      WHERE u.id = $1 AND u.role = 'agent'
      GROUP BY u.id
      `,
      [id]
    );

    if (agent.rows.length === 0) {
      return res.status(404).json({ msg: 'Agent not found' });
    }

    // Authorize: Admin can view any agent, Agent can only view their own profile
    if (req.user.role === 'agent' && req.user.id !== id) {
      return res.status(403).json({ msg: 'Access denied: You can only view your own profile.' });
    }

    res.json(agent.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server Error');
//   }
// });

// @route   PUT api/agents/:id
// @desc    Update agent information
// @access  Private (Admin, Agent - can only update their own profile)
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { username, email, phone_number, state, city, address, landmark, gps, commission_rate, status } = req.body;

  try {
    // Authorize: Admin can update any agent, Agent can only update their own profile
    if (req.user.role === 'agent' && req.user.id !== id) {
      return res.status(403).json({ msg: 'Access denied: You can only update your own profile.' });
    }

    // Only admin can update commission_rate and status
    if (req.user.role !== 'admin' && (commission_rate !== undefined || status !== undefined)) {
      return res.status(403).json({ msg: 'Access denied: Only administrators can update commission rate or status.' });
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
      WHERE id = $11 RETURNING id, username, email, phone_number, state, city, address, landmark, gps, commission_rate, status, created_at, last_active, commission_paid;
      `,
      [username, email, phone_number, state, city, address, landmark, gps, commission_rate, status, id]
    );

    if (updatedAgent.rows.length === 0) {
      return res.status(404).json({ msg: 'Agent not found' });
    }

    res.json({ msg: 'Agent updated successfully', agent: updatedAgent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

// @route   POST api/agents/withdraw-commission
// @desc    Agent withdraws commission
// @access  Private (Agent, Admin)
router.post('/withdraw-commission', auth, authorize('agent', 'admin'), async (req, res) => {
  const { amount, transaction_id } = req.body;
    const agentId = req.user.id;

    try {
      // Fetch agent's current commission details
      const agentResult = await query(
        `SELECT 
          COALESCE(SUM(c.amount), 0) AS total_earned,
          COALESCE(u.commission_paid, 0) AS total_paid,
          u.last_withdrawal_date
        FROM ray_users u
        LEFT JOIN ray_commissions c ON c.agent_id = u.id
        WHERE u.id = $1
        GROUP BY u.commission_paid, u.last_withdrawal_date`,
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({ msg: 'Agent not found.' });
      }

      const { total_earned, total_paid, last_withdrawal_date } = agentResult.rows[0];
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
      const finalTransactionId = transaction_id || `AW-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Record withdrawal
      const newWithdrawal = await query(
        'INSERT INTO ray_agent_withdrawals (agent_id, amount, transaction_id) VALUES ($1, $2, $3) RETURNING *;',
        [agentId, amount, finalTransactionId]
      );

      // Update agent's commission_paid and last_withdrawal_date
      const updatedAgent = await query(
        'UPDATE ray_users SET commission_paid = commission_paid + $1, last_withdrawal_date = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;',
        [amount, agentId]
      );

      res.json({ msg: 'Commission withdrawn successfully', withdrawal: newWithdrawal.rows[0], agent: updatedAgent.rows[0] });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });
