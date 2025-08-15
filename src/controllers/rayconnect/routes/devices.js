const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');

// @route   POST api/devices
// @desc    Add a new device (Admin only)
// @access  Private (Admin)
router.post('/', auth, authorize('admin'), async (req, res) => {
  const { serial_number, device_type_id } = req.body;

  try {
    // Check if device type exists and get its details
    const deviceType = await query('SELECT device_name, manufacturer, device_model, amount FROM ray_device_types WHERE id = $1', [device_type_id]);
    if (deviceType.rows.length === 0) {
      return res.status(400).json({ msg: 'Invalid device type ID' });
    }

    const { device_name, manufacturer, device_model, amount } = deviceType.rows[0];

    let device = await query('SELECT * FROM ray_devices WHERE serial_number = $1', [serial_number]);
    if (device.rows.length > 0) {
      return res.status(400).json({ msg: 'Device with this serial number already exists' });
    }

    const newDevice = await query(
      'INSERT INTO ray_devices (serial_number, model, price, device_type_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *;',
      [serial_number, device_model, amount, device_type_id, 'available']
    );
    res.json({ msg: 'Device added successfully', device: newDevice.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/devices/:id/approve
// @desc    Approve a device (Admin only)
// @access  Private (Admin)
router.put('/:id/approve', auth, authorize('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const device = await query('UPDATE ray_devices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;',
      ['available', id]
    );

    if (device.rows.length === 0) {
      return res.status(404).json({ msg: 'Device not found' });
    }
    res.json({ msg: 'Device approved and is now available', device: device.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/devices
// @desc    Get all devices (Admin and Agent only)
// @access  Private (Admin, Agent)
router.get('/', auth, authorize('admin', 'agent'), async (req, res) => {
  try {
    const ray_devices = await query(`
      SELECT
        d.id,
        d.serial_number AS "serialNumber",
        d.status,
        d.created_at AS "installDate",
        dt.device_name AS type,
        dt.device_model AS model,
        dt.amount AS price,
        d.assigned_to AS "assignedToId",
        cu.username AS "assignedToCustomerName",
        d.assigned_by AS "assignedById",
        ag.username AS "assignedByAgentName",
        d.super_agent_id AS "superAgentId",
        sa.username AS "superAgentName"
      FROM ray_devices d
      JOIN ray_device_types dt ON d.device_type_id = dt.id
      LEFT JOIN ray_users cu ON d.assigned_to = cu.id
      LEFT JOIN ray_users ag ON d.assigned_by = ag.id
      LEFT JOIN ray_users sa ON d.super_agent_id = sa.id
    `);
    res.json(ray_devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
