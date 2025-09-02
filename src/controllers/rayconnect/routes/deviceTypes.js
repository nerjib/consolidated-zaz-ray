const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   POST api/device-types
// @desc    Add a new device type to the business
// @access  Private (Admin only)
router.post('/', auth, authorize('admin'), async (req, res) => {
  const { device_name, manufacturer, device_model, pricing } = req.body;
  const { business_id } = req.user;

  try {
    let deviceType = await query('SELECT * FROM ray_device_types WHERE device_model = $1 AND business_id = $2', [device_model, business_id]);
    if (deviceType.rows.length > 0) {
      return res.status(400).json({ msg: 'Device type with this model already exists in your business.' });
    }

    const newDeviceType = await query(
      'INSERT INTO ray_device_types (device_name, manufacturer, device_model, pricing, business_id) VALUES ($1, $2, $3, $4, $5) RETURNING *;',
      [device_name, manufacturer, device_model, pricing, business_id]
    );
    res.json({ msg: 'Device type added successfully', deviceType: newDeviceType.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/device-types
// @desc    Get all device types for the business
// @access  Private (Admin, Agent)
router.get('/', auth, authorize('admin', 'agent'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const deviceTypes = await query('SELECT * FROM ray_device_types WHERE business_id = $1', [business_id]);
    res.json(deviceTypes.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/device-types/:id
// @desc    Update a device type in the business
// @access  Private (Admin only)
router.put('/:id', auth, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { device_name, manufacturer, device_model, pricing } = req.body;
  const { business_id } = req.user;

  try {
    const updatedDeviceType = await query(
      'UPDATE ray_device_types SET device_name = $1, manufacturer = $2, device_model = $3, pricing = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND business_id = $6 RETURNING *;',
      [device_name, manufacturer, device_model, pricing, id, business_id]
    );

    if (updatedDeviceType.rows.length === 0) {
      return res.status(404).json({ msg: 'Device type not found in your business.' });
    }
    res.json({ msg: 'Device type updated successfully', deviceType: updatedDeviceType.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/device-types/:id
// @desc    Delete a device type from the business
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { business_id } = req.user;

  try {
    const deletedDeviceType = await query('DELETE FROM ray_device_types WHERE id = $1 AND business_id = $2 RETURNING *;', [id, business_id]);

    if (deletedDeviceType.rows.length === 0) {
      return res.status(404).json({ msg: 'Device type not found in your business.' });
    }
    res.json({ msg: 'Device type deleted successfully', deviceType: deletedDeviceType.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
