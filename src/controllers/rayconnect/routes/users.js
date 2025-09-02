
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   POST api/users/create-customer
// @desc    Create a new customer within the business
// @access  Private (Agent, Super-Agent)
router.post('/create-customer', auth, authorize('agent', 'super-agent'), async (req, res) => {
  const { username, email, password, phone_number, state, city, address, landmark, name, id_number } = req.body;
  const creator = req.user;
  const { business_id } = creator;

  if (!business_id) {
    return res.status(400).json({ msg: 'User is not associated with a business.' });
  }

  try {
    let user = await query('SELECT * FROM ray_users WHERE (username = $1 OR email = $2) AND business_id = $3', [username, email, business_id]);
    if (user.rows.length > 0) {
      return res.status(400).json({ msg: 'User with this username or email already exists in this business.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const superAgentResult = await query('SELECT super_agent_id FROM ray_users WHERE id = $1 AND business_id = $2', [creator.id, business_id]);
    const super_agent_id = creator.role === 'super-agent' ? creator.id : (superAgentResult.rows[0] ? superAgentResult.rows[0].super_agent_id : null);

    const newCustomer = await query(
      `INSERT INTO ray_users (username, email, password, role, phone_number, state, city, address, landmark, created_by, super_agent_id, name, id_number, business_id) 
       VALUES ($1, $2, $3, 'customer', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING id, username, email, role, phone_number, state, city, address, landmark, created_by, super_agent_id, business_id`,
      [username, email, hashedPassword, phone_number, state, city, address, landmark, creator.id, super_agent_id, name, id_number, business_id]
    );

    res.json({ msg: 'Customer created successfully', customer: newCustomer.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/users/:id
// @desc    Update user details within the business
// @access  Private (Admin, Super-Agent, Agent, or the user themselves)
router.put('/:id', auth, authorize('admin', 'super-agent', 'agent', 'customer'), async (req, res) => {
  const { id } = req.params;
  const { username, email, phone_number, state, city, address, landmark, name, id_number } = req.body;
  const updater = req.user;
  const { business_id } = updater;

  if (updater.role === 'customer' && updater.id !== id) {
    return res.status(403).json({ msg: 'Not authorized to update this user' });
  }

  try {
    let user = await query('SELECT * FROM ray_users WHERE id = $1 AND business_id = $2', [id, business_id]);
    if (user.rows.length === 0) {
      return res.status(404).json({ msg: 'User not found in your business.' });
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (username !== undefined) { fields.push(`username = \${paramIndex++}`); values.push(username); }
    if (id_number !== undefined) { fields.push(`id_number = \${paramIndex++}`); values.push(id_number); }
    if (email !== undefined) { fields.push(`email = \${paramIndex++}`); values.push(email); }
    if (phone_number !== undefined) { fields.push(`phone_number = \${paramIndex++}`); values.push(phone_number); }
    if (state !== undefined) { fields.push(`state = \${paramIndex++}`); values.push(state); }
    if (city !== undefined) { fields.push(`city = \${paramIndex++}`); values.push(city); }
    if (address !== undefined) { fields.push(`address = \${paramIndex++}`); values.push(address); }
    if (landmark !== undefined) { fields.push(`landmark = \${paramIndex++}`); values.push(landmark); }
    if (name !== undefined) { fields.push(`name = \${paramIndex++}`); values.push(name); }

    if (fields.length === 0) {
      return res.status(400).json({ msg: 'No fields provided for update' });
    }

    values.push(id, business_id);

    const updatedUser = await query(
      `UPDATE ray_users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = \${paramIndex++} AND business_id = \${paramIndex++} RETURNING id, username, email, role, phone_number, state, city, address, landmark, created_by, super_agent_id, name, business_id`,
      values
    );

    res.json({ msg: 'User updated successfully', user: updatedUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
