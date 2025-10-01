const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const auth = require('../middleware/auth');
const can = require('../middleware/can');

// @route   POST api/auth/register
// @desc    Create a new user within a business
// @access  Private (user:manage)
router.post('/register', auth, can('user:manage'), async (req, res) => {
  const { username, email, password, role, phone_number, state, city, address, landmark, gps, name } = req.body;
  const { business_id } = req.user;

  const customerRole = await query('SELECT * FROM  roles WHERE  business_id = $1 AND name = $2', [business_id, role.toLowerCase() === 'customer' ? 'Customer': role.toLowerCase() === 'agent' ? 'Agent' : '']);
  const role_id = customerRole.rows.length > 0 ? customerRole.rows[0].id : null;
  if (!business_id) {
    return res.status(400).json({ msg: 'Admin user is not associated with a business.' });
  }
  if (!role_id) {
      return res.status(400).json({ msg: 'A role_id is required to create a new user.' });
  }

  try {
    // Check if user already exists in the business
    let user = await query('SELECT * FROM ray_users WHERE (username = $1 OR email = $2) AND business_id = $3', [username, email, business_id]);
    if (user.rows.length > 0) {
      return res.status(400).json({ msg: 'User with this username or email already exists in this business.' });
    }

    // Verify the provided role_id belongs to the admin's business
    const roleCheck = await query('SELECT id FROM roles WHERE id = $1 AND business_id = $2', [role_id, business_id]);
    if (roleCheck.rows.length === 0) {
        return res.status(400).json({ msg: 'Invalid role_id for this business.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user to database
    const newUser = await query(
      `INSERT INTO ray_users (username, email, password, role_id, phone_number, state, city, address, landmark, gps, name, business_id, role) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING id, username, email, role_id, business_id, role`,
      [username, email, hashedPassword, role_id, phone_number, state, city, address, landmark, gps, name, business_id, role]
    );

    res.json({ msg: 'User created successfully', user: newUser.rows[0] });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/register-admin
// @desc    Create a new  admin user within a business
// @access  Private (user:manage)
router.post('/register-admin', auth, can('user:manage'), async (req, res) => {
  const { username, email, password, role_id, phone_number, state, city, address, landmark, gps, name } = req.body;
  const { business_id } = req.user;

  // const customerRole = await query('SELECT * FROM  roles WHERE  business_id = $1 AND name = $2', [business_id, role.toLowerCase() === 'customer' ? 'Customer': role.toLowerCase() === 'agent' ? 'Agent' : '']);
  // const role_id = customerRole.rows.length > 0 ? customerRole.rows[0].id : null;
  if (!business_id) {
    return res.status(400).json({ msg: 'Admin user is not associated with a business.' });
  }
  if (!role_id) {
      return res.status(400).json({ msg: 'A role_id is required to create a new user.' });
  }

  try {
    // Check if user already exists in the business
    let user = await query('SELECT * FROM ray_users WHERE (username = $1 OR email = $2) AND business_id = $3', [username, email, business_id]);
    if (user.rows.length > 0) {
      return res.status(400).json({ msg: 'User with this username or email already exists in this business.' });
    }

    // Verify the provided role_id belongs to the admin's business
    const roleCheck = await query('SELECT id FROM roles WHERE id = $1 AND business_id = $2', [role_id, business_id]);
    if (roleCheck.rows.length === 0) {
        return res.status(400).json({ msg: 'Invalid role_id for this business.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user to database
    const newUser = await query(
      `INSERT INTO ray_users (username, email, password, role_id, phone_number, state, city, address, landmark, gps, name, business_id, role) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING id, username, email, role_id, business_id, role`,
      [username, email, hashedPassword, role_id, phone_number, state, city, address, landmark, gps, name, business_id, 'admin']
    );

    res.json({ msg: 'User created successfully', user: newUser.rows[0] });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
// Login User
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Check if user exists
    let userResult = await query('SELECT * FROM ray_users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const user = userResult.rows[0];

    // Check for active subscription if the user is an admin or platform_owner
    if ((user.role === 'admin' || user.role === 'platform_owner') && user.business_id) {
        const businessResult = await query('SELECT subscription_status FROM businesses WHERE id = $1', [user.business_id]);
        if (businessResult.rows.length === 0 || businessResult.rows[0].subscription_status !== 'active') {
            return res.status(403).json({ msg: 'Business subscription is not active. Please contact support.' });
        }
    }
    if (user.role === 'agent' && user.status !== 'active') {
          return res.status(403).json({ msg: 'Account is not active. Please contact support.' });
  }
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Get user's permissions from their role
    let permissions = [];
    if (user.role_id) {
        const permissionsResult = await query(
            `SELECT p.name FROM permissions p
             JOIN role_permissions rp ON p.id = rp.permission_id
             WHERE rp.role_id = $1`,
            [user.role_id]
        );
        permissions = permissionsResult.rows.map(p => p.name);
    }

    // Generate JWT with permissions
    const payload = {
      user: {
        id: user.id,
        role: user.role,
        business_id: user.business_id,
        role_id: user.role_id,
        permissions: permissions
      },
    };
    await query('UPDATE ray_users SET last_active = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        // Return user object without the password hash
        delete user.password;
        res.json({ token, user: user, permissions});
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/auth/check-username/:username
// @desc    Check if username is available
// @access  Public
router.get('/check-username/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await query('SELECT id FROM ray_users WHERE username = $1', [username]);
    if (user.rows.length > 0) {
      return res.json({ available: false, msg: 'Username is already taken' });
    } else {
      return res.json({ available: true, msg: 'Username is available' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;