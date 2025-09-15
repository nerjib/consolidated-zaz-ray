
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// Note: All endpoints in this file should be protected by authorize('platform_owner')

// @route   GET api/platform/businesses
// @desc    Get a list of all businesses on the platform
// @access  Private (Platform Owner only)
router.get('/businesses', auth, authorize('platform_owner'), async (req, res) => {
  try {
    const businesses = await query('SELECT * FROM businesses ORDER BY created_at DESC');
    res.json({status: true, data: businesses.rows});
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/platform/businesses/:id
// @desc    Get details for a specific business, including API tokens
// @access  Private (Platform Owner only)
router.get('/businesses/:id', auth, authorize('platform_owner'), async (req, res) => {
    const { id } = req.params;
    try {
        const businessQuery = query('SELECT * FROM businesses WHERE id = $1', [id]);
        const tokensQuery = query('SELECT id, name, created_at, last_used_at FROM b2b_api_tokens WHERE business_id = $1 ORDER BY created_at DESC', [id]);

        const [businessResult, tokensResult] = await Promise.all([businessQuery, tokensQuery]);

        if (businessResult.rows.length === 0) {
            return res.status(404).json({ msg: 'Business not found.' });
        }

        const businessDetails = businessResult.rows[0];
        // Remove sensitive encrypted keys before sending the response
        // delete businessDetails.paystack_secret_key_encrypted;
        // delete businessDetails.paystack_public_key_encrypted;
        // delete businessDetails.africastalking_api_key_encrypted;
        // delete businessDetails.africastalking_username_encrypted;
        // delete businessDetails.biolite_client_key_encrypted;
        // delete businessDetails.biolite_private_key_encrypted;
        // delete businessDetails.biolite_public_key_encrypted;

        res.json({
            ...businessDetails,
            api_tokens: tokensResult.rows
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/platform/businesses/:id
// @desc    Update a business's status or name
// @access  Private (Platform Owner only)
router.put('/businesses/:id', auth, authorize('platform_owner'), async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;

    try {
        const updatedBusiness = await query(
            `UPDATE businesses SET 
                name = COALESCE($1, name),
                status = COALESCE($2, status)
             WHERE id = $3 RETURNING *`,
            [name, status, id]
        );

        if (updatedBusiness.rows.length === 0) {
            return res.status(404).json({ msg: 'Business not found.' });
        }
        res.json({ msg: 'Business updated successfully', business: updatedBusiness.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/platform/businesses/:id/subscription
// @desc    Update a business's subscription details
// @access  Private (Platform Owner only)
router.put('/businesses/:id/subscription', auth, authorize('platform_owner'), async (req, res) => {
    const { id } = req.params;
    const { subscription_plan, subscription_status, subscription_end_date } = req.body;

    try {
        const updatedBusiness = await query(
            `UPDATE businesses SET 
                subscription_plan = COALESCE($1, subscription_plan),
                subscription_status = COALESCE($2, subscription_status),
                subscription_end_date = COALESCE($3, subscription_end_date)
             WHERE id = $4 RETURNING *`,
            [subscription_plan, subscription_status, subscription_end_date, id]
        );

        if (updatedBusiness.rows.length === 0) {
            return res.status(404).json({ msg: 'Business not found.' });
        }
        res.json({ msg: 'Business subscription updated successfully', business: updatedBusiness.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/platform/businesses
// @desc    Platform Owner creates a new business and its owner user in one transaction
// @access  Private (Platform Owner only)
router.post('/businesses', auth, authorize('platform_owner'), async (req, res) => {
    const { business_name, owner_details } = req.body;
    const { username, email, password, name, phone_number, state, city, address, landmark, gps } = owner_details;

    if (!business_name || !owner_details || !username || !email || !password || !name) {
        return res.status(400).json({ msg: 'Business name and full owner details (username, email, password, name) are required.' });
    }

    const { pool } = require('../config/database');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const permissionsResult = await client.query('SELECT id, name FROM permissions');
        const permissionMap = new Map(permissionsResult.rows.map(p => [p.name, p.id]));
        console.log(`Loaded ${permissionMap.size} permissions.`);

        // Define permissions for default roles
        const adminPermissions = Array.from(permissionMap.keys()); // All permissions
        const agentPermissions = ['device:read', 'loan:read', 'loan:create', 'payment:read', 'payment:create:manual', 'user:manage'];
        const superAgentPermissions = ['device:read', 'loan:read', 'loan:create', 'payment:read', 'payment:create:manual', 'user:manage'];

    

        // Step 1: Check if user already exists globally
        const existingUser = await client.query('SELECT id FROM ray_users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ msg: 'User with this username or email already exists on the platform.' });
        }

        // Step 2: Create the new user (owner)
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUserResult = await client.query(
            `INSERT INTO ray_users (username, email, password, role, name, phone_number, state, city, address, landmark, gps) 
             VALUES ($1, $2, $3, 'admin', $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [username, email, hashedPassword, name, phone_number, state, city, address, landmark, gps]
        );
        const newOwnerId = newUserResult.rows[0].id;

        // Step 3: Create the new business
        const newBusinessResult = await client.query(
            'INSERT INTO businesses (name, owner_id) VALUES ($1, $2) RETURNING id',
            [business_name, newOwnerId]
        );
        const newBusinessId = newBusinessResult.rows[0].id;

        // Create default roles for the business
        const adminRole = await client.query('INSERT INTO roles (business_id, name, description, is_default) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, name) DO NOTHING RETURNING id', [newBusinessId, 'Business Admin', 'Full access within the business', true]);
        const agentRole = await client.query('INSERT INTO roles (business_id, name, description, is_default) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, name) DO NOTHING RETURNING id', [newBusinessId, 'Agent', 'Standard agent access', true]);
        const customerRole = await client.query('INSERT INTO roles (business_id, name, description, is_default) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, name) DO NOTHING RETURNING id', [newBusinessId, 'Customer', 'Standard customer access', true]);
        const superAgentRole = await client.query('INSERT INTO roles (business_id, name, description, is_default) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, name) DO NOTHING RETURNING id', [newBusinessId, 'Super Agent', 'Standard agent access', true]);


        const adminRoleId = adminRole.rows[0]?.id;
        const agentRoleId = agentRole.rows[0]?.id;
        const customerRoleId = customerRole.rows[0]?.id;
        const superAgentRoleId = superAgentRole.rows[0]?.id;


        if (!adminRoleId || !agentRoleId || !customerRoleId || !superAgentRoleId) {
            console.log(`Roles already existed for business ${business_id}, skipping permission assignment.`);
        } else {
             // Assign permissions to Business Admin role
            for (const permName of adminPermissions) {
                const permId = permissionMap.get(permName);
                await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [adminRoleId, permId]);
            }

            // Assign permissions to Agent role
            for (const permName of agentPermissions) {
                const permId = permissionMap.get(permName);
                await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [agentRoleId, permId]);
            }
            for (const permName of superAgentPermissions) {
                const permId = permissionMap.get(permName);
                await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [superAgentRoleId, permId]);
            }
        }


        // Step 4: Assign the business to the new user
        await client.query('UPDATE ray_users SET business_id = $1, role_id = $3 WHERE id = $2', [newBusinessId, newOwnerId, adminRoleId]);

        await client.query('COMMIT');

        const finalBusiness = await query('SELECT * FROM businesses WHERE id = $1', [newBusinessId]);
        const finalUser = await query('SELECT id, username, email, role, name, business_id FROM ray_users WHERE id = $1', [newOwnerId]);

        res.status(201).json({ 
            msg: 'Business and owner created successfully', 
            business: finalBusiness.rows[0],
            owner: finalUser.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

// @route   GET api/platform/businesses/:id/api-tokens
// @desc    Get all B2B API tokens for a specific business
// @access  Private (Platform Owner only)
router.get('/businesses/:id/api-tokens', auth, authorize('platform_owner'), async (req, res) => {
    const { id } = req.params; // This is the business_id
    try {
        // First, verify the business exists
        const business = await query('SELECT id FROM businesses WHERE id = $1', [id]);
        if (business.rows.length === 0) {
            return res.status(404).json({ msg: 'Business not found.' });
        }

        const tokens = await query(
            'SELECT id, name, created_at, last_used_at FROM b2b_api_tokens WHERE business_id = $1 ORDER BY created_at DESC',
            [id]
        );

        res.json(tokens.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route   GET api/platform/analytics/businesses
// @desc    Get high-level platform-wide analytics
// @access  Private (Platform Owner only)
router.get('/analytics/businesses', auth, authorize('platform_owner'), async (req, res) => {
  try {
    const totalBusinessesQuery = query('SELECT COUNT(*) FROM businesses');
    const totalSubscriptionsQuery = query('SELECT COUNT(*) FROM businesses WHERE subscription_plan IS NOT NULL');
    const activeSubscriptionsQuery = query("SELECT COUNT(*) FROM businesses WHERE subscription_status = 'active'");
    const totalRevenueQuery = query("SELECT SUM(amount) FROM ray_payments WHERE status = 'completed'");
    const recentBusinessesQuery = query('SELECT id, name, owner_id, created_at, status FROM businesses ORDER BY created_at DESC LIMIT 5');

    const [
        totalBusinessesResult,
        totalSubscriptionsResult,
        activeSubscriptionsResult,
        totalRevenueResult,
        recentBusinessesResult
    ] = await Promise.all([
        totalBusinessesQuery,
        totalSubscriptionsQuery,
        activeSubscriptionsQuery,
        totalRevenueQuery,
        recentBusinessesQuery
    ]);

    res.json({
        total_businesses: parseInt(totalBusinessesResult.rows[0].count, 10),
        total_subscriptions: parseInt(totalSubscriptionsResult.rows[0].count, 10),
        total_active_subscriptions: parseInt(activeSubscriptionsResult.rows[0].count, 10),
        total_revenue: parseFloat(totalRevenueResult.rows[0].sum || 0),
        recently_registered_businesses: recentBusinessesResult.rows
    });

  } catch (err) {
    console.error('Platform analytics error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/platform/analytics/businesses/:id
// @desc    Get key analytics for a single business
// @access  Private (Platform Owner only)
router.get('/analytics/businesses/:id', auth, authorize('platform_owner'), async (req, res) => {
  const { id: business_id } = req.params;
  try {
    // Check if business exists
    const businessCheck = await query('SELECT id FROM businesses WHERE id = $1', [business_id]);
    if (businessCheck.rows.length === 0) {
        return res.status(404).json({ msg: 'Business not found.' });
    }

    const totalPayments = await query('SELECT SUM(amount) FROM ray_payments WHERE status = $1 AND business_id = $2', ['completed', business_id]);
    const totalLoans = await query('SELECT COUNT(*) FROM ray_loans WHERE business_id = $1', [business_id]);
    const activeLoans = await query('SELECT COUNT(*) FROM ray_loans WHERE status = $1 AND business_id = $2', ['active', business_id]);
    const totalCustomers = await query('SELECT COUNT(*) FROM ray_users WHERE role = $1 AND business_id = $2', ['customer', business_id]);
    const totalAgents = await query('SELECT COUNT(*) FROM ray_users WHERE role = $1 AND business_id = $2', ['agent', business_id]);
    const totalDevices = await query('SELECT COUNT(*) FROM ray_devices WHERE business_id = $1', [business_id]);
    const assignedDevices = await query('SELECT COUNT(*) FROM ray_devices WHERE status = $1 AND business_id = $2', ['assigned', business_id]);
    const availableDevices = await query('SELECT COUNT(*) FROM ray_devices WHERE status = $1 AND business_id = $2', ['available', business_id]);

    res.json({
      business_id: business_id,
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
    console.error(`Analytics error for business ${business_id}:`, err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
