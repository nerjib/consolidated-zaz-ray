
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   POST api/users/create-customer
// @desc    Create a new customer
// @access  Private (Agent, Super-Agent)
router.post('/create-customer', auth, authorize('agent', 'super-agent'), async (req, res) => {
  const { username, email, password, phone_number, state, city, address, landmark } = req.body;
  const creator = req.user;
  try {
    // Check if user already exists
    let user = await query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    console.log({user: user.rows[0]})
    if (user.rows.length > 0) {
      return res.status(400).json({ msg: 'User with this username or email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newCustomer = await query(
      `INSERT INTO users (username, email, password, role, phone_number, state, city, address, landmark, created_by, super_agent_id) 
       VALUES ($1, $2, $3, 'customer', $4, $5, $6, $7, $8, $9, $10) 
       RETURNING id, username, email, role, phone_number, state, city, address, landmark, created_by, super_agent_id`,
      [
        username, 
        email, 
        hashedPassword, 
        phone_number, 
        state, 
        city, 
        address, 
        landmark, 
        creator.id, 
        creator.role === 'super-agent' ? creator.id : (await query('SELECT super_agent_id FROM users WHERE id = $1', [creator.id])).rows[0].super_agent_id
      ]
    );

    res.json({ msg: 'Customer created successfully', customer: newCustomer.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
