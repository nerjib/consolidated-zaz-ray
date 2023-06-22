const express = require('express');
const moment = require ('moment')
const router = express.Router();
const db = require('../db/index');
const dotenv = require('dotenv');
const upload = require('./multer')
const cloudinary = require('./cloudinary')





router.get('/allreports', async (req, res) => {
  const getAllQ = `SELECT * FROM reports`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ);
    return res.status(201).send({
      status: true,
      messgae: 'successful',
      data: rows,
    
    });
  } catch (error) {
    if (error.routine === '_bt_check_unique') {
      return res.status(400).send({ message: 'something is wrong' });
    }
    return res.status(400).send(`${error} jsh`);
  }
});



  module.exports = router;
