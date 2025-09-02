
const express = require('express');
const router = express.Router();
const b2bAuth = require('../middleware/b2bAuth');
const { query } = require('../config/database');

// @route   GET /api/integrations/odyssey/payments
// @desc    Provide payment data for the Odyssey platform integration
// @access  Private (B2B API Token)
router.get('/odyssey/payments', b2bAuth, async (req, res) => {
  const { business_id } = req;
  const { FROM, TO, FINANCING_ID } = req.query;

  if (!FROM || !TO) {
    return res.status(400).json({ errors: ['FROM and TO date parameters are required.'] });
  }

  try {
    const fromDate = new Date(FROM);
    const toDate = new Date(TO);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({ errors: ['Invalid date format for FROM or TO parameters.'] });
    }

    const paymentData = await query(`
        SELECT
            p.payment_date AS "timestamp",
            p.amount,
            p.currency,
            p.transaction_id AS "transactionId",
            d.serial_number AS "serialNumber",
            c.id AS "customerId",
            c.name AS "customerName",
            c.phone_number AS "customerPhone",
            l.agent_id AS "agentId",
            c.gps
        FROM ray_payments p
        JOIN ray_users c ON p.user_id = c.id
        JOIN ray_loans l ON p.loan_id = l.id
        JOIN ray_devices d ON l.device_id = d.id
        WHERE p.business_id = $1
        AND p.payment_date >= $2
        AND p.payment_date <= $3
    `, [business_id, fromDate, toDate]);

    const formattedPayments = paymentData.rows.map(p => {
        let latitude = null;
        let longitude = null;
        if (p.gps) {
            const gpsParts = p.gps.split(',');
            if (gpsParts.length === 2) {
                latitude = gpsParts[0].trim();
                longitude = gpsParts[1].trim();
            }
        }

        return {
            timestamp: p.timestamp.toISOString(),
            amount: p.amount,
            currency: p.currency,
            transactionType: 'INSTALLMENT_PAYMENT', // Assumption based on previous discussion
            serialNumber: p.serialNumber || 'N/A',
            customerId: p.customerId || 'N/A',
            customerName: p.customerName,
            customerPhone: p.customerPhone,
            transactionId: p.transactionId,
            financingId: FINANCING_ID, // Include if passed in the request
            agentId: p.agentId,
            latitude: latitude,
            longitude: longitude,
            customerAccountId: p.customerId, // Assumption based on previous discussion
            utilityId: null,
            customerCategory: null,
            failedBatteryCapacityCount: 0,
            transactionKwh: null
        };
    });

    res.json({ payments: formattedPayments });

  } catch (err) {
    console.error('Odyssey integration error:', err.message);
    res.status(500).json({ errors: ['Server error'], description: err.message });
  }
});

module.exports = router;
