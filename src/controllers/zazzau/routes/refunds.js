const express = require('express');
const router = express.Router();
const refundController = require('../../refund.controller');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  });

const upload = multer({ storage: storage });

router.get('/', refundController.getAllRefunds);
router.get('/:ippis', refundController.getRefundsByUser);
router.post('/', refundController.createRefund);
router.post('/bulk', upload.single('file'), refundController.bulkRefund);

module.exports = router;
