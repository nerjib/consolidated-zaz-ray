
const { query } = require('../config/database');
const crypto = require('crypto');

module.exports = async function (req, res, next) {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ errors: ['No token, authorization denied'] });
  }

  const token = authHeader.substring(7, authHeader.length);

  if (!token) {
    return res.status(401).json({ errors: ['No token, authorization denied'] });
  }

  try {
    const token_sha256_hash = crypto.createHash('sha256').update(token).digest('hex');

    const tokenResult = await query(
      'SELECT business_id, id FROM b2b_api_tokens WHERE token_sha256_hash = $1',
      [token_sha256_hash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ errors: ['Token is not valid'] });
    }

    // Attach the business_id to the request for use in the endpoint
    req.business_id = tokenResult.rows[0].business_id;

    // Update the last_used_at timestamp asynchronously
    query('UPDATE b2b_api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [tokenResult.rows[0].id]);

    next();
  } catch (err) {
    console.error('B2B authentication error:', err.message);
    res.status(500).send('Server error');
  }
};
