const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

module.exports = async function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  
  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    // Update last_active timestamp
    await query('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1', [req.user.id]);

    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
