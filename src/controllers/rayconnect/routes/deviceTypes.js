const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   POST api/device-types
// @desc    Add a new device type
// @access  Private (Admin only)
router.post('/', auth, authorize('admin'), async (req, res) => {
  const { device_name, manufacturer, device_model, amount } = req.body;

  try {
    let deviceType = await query('SELECT * FROM device_types WHERE device_model = $1', [device_model]);
    if (deviceType.rows.length > 0) {
      return res.status(400).json({ msg: 'Device type with this model already exists' });
    }

    const newDeviceType = await query(
      'INSERT INTO device_types (device_name, manufacturer, device_model, amount) VALUES ($1, $2, $3, $4) RETURNING *;',
      [device_name, manufacturer, device_model, amount]
    );
    res.json({ msg: 'Device type added successfully', deviceType: newDeviceType.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/device-types
// @desc    Get all device types
// @access  Private (Admin, Agent)
router.get('/', auth, authorize('admin', 'agent'), async (req, res) => {
  try {
    const deviceTypes = await query('SELECT * FROM device_types');
    res.json(deviceTypes.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/device-types/:id
// @desc    Update a device type
// @access  Private (Admin only)
router.put('/:id', auth, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { device_name, manufacturer, device_model, amount } = req.body;

  try {
    const updatedDeviceType = await query(
      'UPDATE device_types SET device_name = $1, manufacturer = $2, device_model = $3, amount = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *;',
      [device_name, manufacturer, device_model, amount, id]
    );

    if (updatedDeviceType.rows.length === 0) {
      return res.status(404).json({ msg: 'Device type not found' });
    }
    res.json({ msg: 'Device type updated successfully', deviceType: updatedDeviceType.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/device-types/:id
// @desc    Delete a device type
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const deletedDeviceType = await query('DELETE FROM device_types WHERE id = $1 RETURNING *;', [id]);

    if (deletedDeviceType.rows.length === 0) {
      return res.status(404).json({ msg: 'Device type not found' });
    }
    res.json({ msg: 'Device type deleted successfully', deviceType: deletedDeviceType.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
