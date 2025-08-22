const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorization');
const { query } = require('../config/database');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, './uploads'); // Temporary directory for upload
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname); // Unique filename
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'), false);
    }
  },
});

// @route   POST api/devices
// @desc    Add a new device (Admin only)
// @access  Private (Admin)
router.post('/', auth, authorize('admin'), async (req, res) => {
  const { serial_number, device_type_id } = req.body;

  try {
    // Check if device type exists and get its details
    const deviceType = await query('SELECT device_name, manufacturer, device_model, pricing FROM ray_device_types WHERE id = $1', [device_type_id]);
    if (deviceType.rows.length === 0) {
      return res.status(400).json({ msg: 'Invalid device type ID' });
    }

    const { device_name, manufacturer, device_model, pricing } = deviceType.rows[0];
    const oneTimePrice = pricing['one-time'];

    let device = await query('SELECT * FROM ray_devices WHERE serial_number = $1', [serial_number]);
    if (device.rows.length > 0) {
      return res.status(400).json({ msg: 'Device with this serial number already exists' });
    }

    const newDevice = await query(
      'INSERT INTO ray_devices (serial_number, model, price, device_type_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *;',
      [serial_number, device_model, oneTimePrice, device_type_id, 'available']
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
        dt.pricing->>'one-time' AS price,
        dt.pricing AS plan,
        d.assigned_to AS "assignedToId",
        cu.username AS "assignedToCustomerName",
        d.assigned_by AS "assignedById",
        ag.username AS "assignedByAgentName",
        d.super_agent_id AS "superAgentId",
        sa.username AS "superAgentName",
        COALESCE(json_agg(DISTINCT deal.allowed_payment_frequencies) FILTER (WHERE deal.id IS NOT NULL), '["monthly", "weekly", "daily"]') AS "allowedPaymentFrequencies",
        json_agg(json_build_object(
          'id', deal.id,
          'dealName', deal.deal_name,
          'startDate', deal.start_date,
          'endDate', deal.end_date,
          'allowedPaymentFrequencies', deal.allowed_payment_frequencies
        )) FILTER (WHERE deal.id IS NOT NULL) AS "activeDeals"
      FROM ray_devices d
      JOIN ray_device_types dt ON d.device_type_id = dt.id
      LEFT JOIN ray_users cu ON d.assigned_to = cu.id
      LEFT JOIN ray_users ag ON d.assigned_by = ag.id
      LEFT JOIN ray_users sa ON d.super_agent_id = sa.id
      LEFT JOIN ray_deals deal ON dt.id = deal.device_type_id AND deal.start_date <= CURRENT_DATE AND deal.end_date >= CURRENT_DATE
      GROUP BY d.id, dt.id, cu.username, ag.username, sa.username
    `);
    res.json(ray_devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/devices/upload-excel
// @desc    Upload devices from an Excel file
// @access  Private (Admin only)
router.post('/upload-excel', auth, authorize('admin'), upload.single('excelFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded.' });
  }
  let filePath = req.file.path; // Use req.file.path for the absolute path
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const row of data) {
      const { serial_number, device_type_id } = row; // Assuming column names in Excel match these keys

      if (!serial_number || !device_type_id) {
        errorCount++;
        errors.push({ row: row, msg: 'Missing serial_number or device_type_id' });
        continue;
      }

      try {
        // Check if device type exists and get its details
        const deviceType = await query('SELECT device_name, manufacturer, device_model, pricing FROM ray_device_types WHERE id = $1', [device_type_id]);
        if (deviceType.rows.length === 0) {
          errorCount++;
          errors.push({ row: row, msg: 'Invalid device_type_id' });
          continue;
        }

        const { device_model, pricing } = deviceType.rows[0];
        const oneTimePrice = pricing['one-time'];

        // Check if device with serial number already exists
        const existingDevice = await query('SELECT id FROM ray_devices WHERE serial_number = $1', [serial_number]);
        if (existingDevice.rows.length > 0) {
          errorCount++;
          errors.push({ row: row, msg: 'Device with this serial number already exists' });
          continue;
        }

        await query(
          'INSERT INTO ray_devices (serial_number, model, price, device_type_id, status) VALUES ($1, $2, $3, $4, $5)',
          [serial_number, device_model, oneTimePrice, device_type_id, 'available']
        );
        successCount++;
      } catch (dbErr) {
        errorCount++;
        errors.push({ row: row, msg: dbErr.message });
      }
    }

    // Clean up the uploaded file
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    res.json({
      msg: 'Excel upload processed',
      totalRows: data.length,
      successCount,
      errorCount,
      errors,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
