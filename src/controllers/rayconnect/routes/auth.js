const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Register User
router.post('/register', async (req, res) => {
  const { username, email, password, role, phone_number, state, city, address, landmark, gps, name } = req.body;

  try {
    // Check if user already exists
    let user = await query('SELECT * FROM ray_users WHERE username = $1 OR email = $2', [username, email]);
    if (user.rows.length > 0) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user to database
    const newUser = await query(
      'INSERT INTO ray_users (username, email, password, role, phone_number, state, city, address, landmark, gps, name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, username, email, role, phone_number, state, city, address, landmark, gps, name',
      [username, email, hashedPassword, role, phone_number, state, city, address, landmark, gps, name]
    );

    // Generate JWT
    const payload = {
      user: {
        id: newUser.rows[0].id,
        role: newUser.rows[0].role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '48h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login User
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
console.log({username})
  try {
    // Check if user exists
    let user = await query('SELECT * FROM ray_users WHERE username = $1', [username]);
    if (user.rows.length === 0) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }
    console.log(user.rows[0])
    // Check password
    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Generate JWT
    const payload = {
      user: {
        id: user.rows[0].id,
        role: user.rows[0].role,
        email: user.rows[0].email
      },
    };
    await  query('UPDATE ray_users SET last_active = CURRENT_TIMESTAMP WHERE id = $1', [user.rows[0].id]);
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: user.rows[0] });
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
