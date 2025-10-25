const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const can = require('../middleware/can');
const { query, pool } = require('../config/database'); // Import pool for transactions
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const { generateDeviceTokenForReplacement } = require('../services/paymentService'); // Import the new helper

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, './uploads'); // Temporary directory for upload
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
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
// @desc    Add a new device to the business
// @access  Private (device:create)
router.post('/', auth, can('device:create'), async (req, res) => {
  const { serial_number, device_type_id, paygo_key } = req.body;
  const { business_id } = req.user;

  try {
    const deviceType = await query('SELECT device_name, manufacturer, device_model, pricing FROM ray_device_types WHERE id = $1 AND business_id = $2', [device_type_id, business_id]);
    if (deviceType.rows.length === 0) {
      return res.status(400).json({ msg: 'Invalid device type ID for your business.' });
    }

    const { device_model, pricing } = deviceType.rows[0];
    const oneTimePrice = pricing['one-time'];

    let device = await query('SELECT * FROM ray_devices WHERE serial_number = $1 AND business_id = $2', [serial_number, business_id]);
    if (device.rows.length > 0) {
      return res.status(400).json({ msg: 'Device with this serial number already exists in your business.' });
    }

    const newDevice = await query(
      'INSERT INTO ray_devices (serial_number, model, price, device_type_id, status, business_id, openpaygo_secret_key) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;',
      [serial_number, device_model, oneTimePrice, device_type_id, 'available', business_id, paygo_key || null]
    );
    res.json({ msg: 'Device added successfully', device: newDevice.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/devices/:id/approve
// @desc    Approve a device in the business
// @access  Private (device:approve)
router.put('/:id/approve', auth, can('device:approve'), async (req, res) => {
  const { id } = req.params;
  const { business_id } = req.user;

  try {
    const device = await query('UPDATE ray_devices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3 RETURNING *;',
      ['available', id, business_id]
    );

    if (device.rows.length === 0) {
      return res.status(404).json({ msg: 'Device not found in your business.' });
    }
    res.json({ msg: 'Device approved and is now available', device: device.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/devices
// @desc    Get all devices for the business
// @access  Private (device:read)
router.get('/', auth, can('device:read'), async (req, res) => {
  const { business_id } = req.user;
  try {
    const devices = await query(`
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
        cu.name AS "assignedToCustomerName",
        cu.username AS "assignedToCustomerUsername",
        d.assigned_by AS "assignedById",
        ag.name AS "assignedByAgentName",
        d.super_agent_id AS "superAgentId",
        sa.name AS "superAgentName",
        l.id as loanId,
        l.status
        COALESCE(json_agg(DISTINCT deal.allowed_payment_frequencies) FILTER (WHERE deal.id IS NOT NULL), '["monthly", "weekly", "daily"]'::json) AS "allowedPaymentFrequencies",
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
      LEFT JOIN ray_loans l ON l.device_id = d.id
      WHERE d.business_id = $1 AND l.status != 'paused'
      GROUP BY d.id, dt.id, cu.name, cu.username, ag.name, sa.name, l.id, l.status
    `, [business_id]);
    res.json(devices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/devices/upload-excel
// @desc    Upload devices from an Excel file for the business
// @access  Private (device:create)
router.post('/upload-excel', auth, can('device:create'), upload.single('excelFile'), async (req, res) => {
  const { business_id } = req.user;
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded.' });
  }
  let filePath = req.file.path;
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const row of data) {
      const { serial_number, device_type_id, paygo_key } = row;

      if (!serial_number || !device_type_id) {
        errorCount++;
        errors.push({ row: row, msg: 'Missing serial_number or device_type_id' });
        continue;
      }

      try {
        const deviceType = await query('SELECT device_model, pricing FROM ray_device_types WHERE id = $1 AND business_id = $2', [device_type_id, business_id]);
        if (deviceType.rows.length === 0) {
          errorCount++;
          errors.push({ row: row, msg: 'Invalid device_type_id for your business.' });
          continue;
        }

        const { device_model, pricing } = deviceType.rows[0];
        const oneTimePrice = pricing['one-time'];

        const existingDevice = await query('SELECT id FROM ray_devices WHERE serial_number = $1 AND business_id = $2', [serial_number, business_id]);
        if (existingDevice.rows.length > 0) {
          errorCount++;
          errors.push({ row: row, msg: 'Device with this serial number already exists in your business.' });
          continue;
        }

        await query(
          'INSERT INTO ray_devices (serial_number, model, price, device_type_id, status, business_id, openpaygo_secret_key) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [serial_number, device_model, oneTimePrice, device_type_id, 'available', business_id, paygo_key || null]
        );
        successCount++;
      } catch (dbErr) {
        errorCount++;
        errors.push({ row: row, msg: dbErr.message });
      }
    }

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

// @route   PUT api/devices/replace
// @desc    Replace an old device with a new one on an existing loan
// @access  Private (device:manage)
router.put('/replace', auth, can('loan:update'), async (req, res) => {
  const { old_device_id, new_device_serial_number } = req.body;
  const { business_id, id: userId } = req.user; // Get userId for logging

  let client; // Declare client here for finally block

  try {
    // 1. Validate Input
    if (!old_device_id || !new_device_serial_number) {
      return res.status(400).json({ msg: 'Old device ID and new device serial number are required.' });
    }

    client = await pool.connect(); // Get client from pool for transaction
    await client.query('BEGIN');

    // 2. Fetch Old Device
    const oldDeviceResult = await client.query( // Use client for transaction
      `SELECT
         d.id, d.status, d.assigned_to, d.assigned_by, d.super_agent_id, d.first_time_commission_paid,
         l.id AS loan_id, l.customer_id
       FROM ray_devices d
       LEFT JOIN ray_loans l ON d.id = l.device_id
       WHERE d.id = $1 AND d.business_id = $2 FOR UPDATE OF d`, // FOR UPDATE to lock rows
      [old_device_id, business_id]
    );

    if (oldDeviceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Old device not found in your business.' });
    }
    const oldDevice = oldDeviceResult.rows[0];

    if (oldDevice.status !== 'assigned' || !oldDevice.loan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'Old device is not assigned or does not have an active loan.' });
    }

    // 3. Fetch New Device
    const newDeviceResult = await client.query( // Use client for transaction
      'SELECT id, status FROM ray_devices WHERE serial_number = $1 AND business_id = $2 FOR UPDATE', // FOR UPDATE to lock rows
      [new_device_serial_number, business_id]
    );

    if (newDeviceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'New device not found in your business.' });
    }
    const newDevice = newDeviceResult.rows[0];

    if (newDevice.status !== 'available') {
      await client.query('ROLLBACK');
      return res.status(400).json({ msg: 'New device is not available for assignment.' });
    }

    // 4. Update Loan Record: Link the existing loan to the new device
    await client.query( // Use client for transaction
      'UPDATE ray_loans SET device_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newDevice.id, oldDevice.loan_id]
    );

    // 5. Update Old Device Status
    await client.query( // Use client for transaction
      `UPDATE ray_devices
       SET status = $1, assigned_to = NULL, assigned_by = NULL, super_agent_id = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      ['replaced', oldDevice.id]
    );

    // 6. Update New Device Assignment and transfer first_time_commission_paid
    await client.query( // Use client for transaction
      `UPDATE ray_devices
       SET status = $1, assigned_to = $2, assigned_by = $3, super_agent_id = $4, first_time_commission_paid = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      ['assigned', oldDevice.assigned_to, oldDevice.assigned_by, oldDevice.super_agent_id, oldDevice.first_time_commission_paid, newDevice.id]
    );

    // 7. Generate new token for the new device
    const generatedToken = await generateDeviceTokenForReplacement(client, newDevice.id, business_id, oldDevice.loan_id);

    // 8. Log Device Replacement Event
    await client.query( // Use client for transaction
      `INSERT INTO ray_device_history (device_id, business_id, changed_by, previous_status, new_status, reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [oldDevice.id, business_id, userId, oldDevice.status, 'replaced', 'Device Replacement', `Old device ${oldDevice.id} replaced by new device ${newDevice.id}. Loan ${oldDevice.loan_id} transferred.`]
    );
    await client.query( // Log for the new device as well
      `INSERT INTO ray_device_history (device_id, business_id, changed_by, previous_status, new_status, reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newDevice.id, business_id, userId, newDevice.status, 'assigned', 'Device Replacement', `New device ${newDevice.id} replaced old device ${oldDevice.id}. Loan ${oldDevice.loan_id} transferred. Generated token: ${generatedToken}`]
    );


    // Commit the transaction
    await client.query('COMMIT');

    res.json({
      msg: 'Device replaced successfully',
      old_device_id: oldDevice.id,
      new_device_id: newDevice.id,
      loan_id: oldDevice.loan_id,
      generated_token: generatedToken,
    });

  } catch (err) {
    if (client) {
      await client.query('ROLLBACK'); // Rollback on any error
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  } finally {
    if (client) {
      client.release(); // Release client back to pool
    }
  }
});

module.exports = router;