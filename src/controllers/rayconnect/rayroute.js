require('dotenv').config();
const express = require('express');
const app = express();
const router = express.Router();

// Basic route
router.get('/', (req, res) => {
  res.send('rayKonet Backend API is running!');
});

// Define Routes
router.use('/api/auth', require('./routes/auth'));
router.use('/api/agents', require('./routes/agents'));
router.use('/api/customers', require('./routes/customers'));
router.use('/api/admin', require('./routes/admin'));
router.use('/api/devices', require('./routes/devices'));
router.use('/api/payments', require('./routes/payments'));
router.use('/api/loans', require('./routes/loans'));
router.use('/api/analytics', require('./routes/analytics'));
router.use('/api/inventory', require('./routes/inventory'));
router.use('/api/device-types', require('./routes/deviceTypes'));
router.use('/api/super-agents', require('./routes/super-agents'));
router.use('/api/users', require('./routes/users'));
router.use('/api/deals', require('./routes/deals'));
router.use('/api/businesses', require('./routes/businesses'));
router.use('/api/integrations', require('./routes/integrations'));
router.use('/api/platform', require('./routes/platform'));

module.exports = router;
