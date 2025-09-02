
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');
const { encrypt, decrypt } = require('../services/encryptionService');

// @route   POST api/businesses
// @desc    Create a new business
// @access  Private (Authenticated users)
router.post('/', auth, async (req, res) => {
  const { name } = req.body;
  const owner_id = req.user.id;

  const { pool } = require('../config/database');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if the user is already part of a business
    const userBusinessCheck = await client.query('SELECT business_id FROM ray_users WHERE id = $1', [owner_id]);
    if (userBusinessCheck.rows.length > 0 && userBusinessCheck.rows[0].business_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'User is already associated with a business.' });
    }

    // Create the new business
    const newBusiness = await client.query(
      'INSERT INTO businesses (name, owner_id) VALUES ($1, $2) RETURNING id',
      [name, owner_id]
    );
    const business_id = newBusiness.rows[0].id;

    // Assign the user to the new business and make them an admin
    await client.query(
      'UPDATE ray_users SET business_id = $1, role = $2 WHERE id = $3',
      [business_id, 'admin', owner_id]
    );

    await client.query('COMMIT');
    res.json({ msg: 'Business created successfully', business_id });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
});

// @route   PUT api/businesses/credentials
// @desc    Update credentials for the business
// @access  Private (Admin of the business)
router.put('/credentials/:id', auth, authorize('admin', 'platform_owner'), async (req, res) => {
  const { 
    paystack_secret_key, 
    paystack_public_key, 
    africastalking_api_key, 
    africastalking_username, 
    biolite_client_key, 
    biolite_private_key, 
    biolite_public_key
  } = req.body;
  const { id: business_id} = req.params;
  // const business_id = req.user.business_id; // This will be set by the updated auth middleware

  if (!business_id) {
    return res.status(400).json({ msg: 'User is not associated with a business.' });
  }

  try {
    await query(
      `UPDATE businesses SET 
        paystack_secret_key_encrypted = $1,
        paystack_public_key_encrypted = $2,
        africastalking_api_key_encrypted = $3,
        africastalking_username_encrypted = $4,
        biolite_client_key_encrypted = $5,
        biolite_private_key_encrypted = $6,
        biolite_public_key_encrypted = $7
      WHERE id = $8`,
      [
        encrypt(paystack_secret_key),
        encrypt(paystack_public_key),
        encrypt(africastalking_api_key),
        encrypt(africastalking_username),
        encrypt(biolite_client_key),
        encrypt(biolite_private_key),
        encrypt(biolite_public_key),
        business_id
      ]
    );

    res.json({ msg: 'Business credentials updated successfully.' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/businesses/api-tokens
// @desc    Generate a B2B API token for the business
// @access  Private (Admin of the business)
router.post('/api-tokens', auth, authorize('admin', 'platform_owner'), async (req, res) => {
  const { name, business_id } = req.body; // e.g., "Odyssey Integration Token"
  // const { business_id } = req.user;

  if (!name) {
    return res.status(400).json({ msg: 'A name for the token is required.' });
  }

  try {
    const crypto = require('crypto');
    const bcrypt = require('bcryptjs');

    // Generate a new random token
    const apiToken = crypto.randomBytes(24).toString('hex');

    // Hash the token using SHA-256 for storage. This allows for direct lookups.
    const token_sha256_hash = crypto.createHash('sha256').update(apiToken).digest('hex');

    // Store the hashed token
    await query(
      'INSERT INTO b2b_api_tokens (business_id, name, token_sha256_hash, token) VALUES ($1, $2, $3, $4)',
      [business_id, name, token_sha256_hash, apiToken]
    );
    // 7035d2923ab07281872680b0708044bfee318ee183818feb
    // Return the plaintext token to the user ONCE.
    res.json({ msg: `API Token generated successfully. Please store this token securely, it will not be shown again.`, token: apiToken });

  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') { // unique_violation
        return res.status(400).json({ msg: 'A token with this name already exists.' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
