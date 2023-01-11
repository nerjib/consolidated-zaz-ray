const express = require('express');
const moment = require ('moment')
const router = express.Router();
const db = require('../db/index');
const dotenv = require('dotenv');
const upload = require('./multer')
const cloudinary = require('./cloudinary');
const db2 = require("../../models");
const Payment = db2.payments;


const getPagination = (page, size) => {
  const limit = size ? +size : 3;
  const offset = page ? page * limit : 0;

  return { limit, offset };
};

const getPagingData = (data, page, limit) => {
  const { count: totalItems, rows: data } = data;
  const currentPage = page ? +page : 0;
  const totalPages = Math.ceil(totalItems / limit);

  return { totalItems, tutorials, totalPages, currentPage };
};

router.get('/', async (req, res) => {
    const getAllQ = `SELECT * FROM payments`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ);
      return res.status(201).send(rows);
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  
  router.get('/allpayments', async (req, res) => {
    const getAllQ = `SELECT payments.reference,payments.amount,payments.plotno, payments.createdat,customers.name, sites.name as site FROM payments left join customers on customers.id=payments.customerid left join sites on payments.siteid=sites.id order by payments.createdat asc`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ);
      return res.status(201).send({
        status:true,
        data: rows
      });
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  

  router.get('/totalpayments', async (req, res) => {
    const getAllQ = `SELECT SUM(amount) from nmspayments`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ);
      return res.status(201).send({
        status:true,
        data: rows
      });
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  

  router.get('/all', async (req, res) => {
    const getAllQ = `SELECT nmspayments.ref,nmspayments.amount,nmspayments.ippis,  nmspayments.name, nmspayments.period, nmspayments.command FROM nmspayments `;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ);
      return res.status(201).send({
        status:true,
        data: rows
      });
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  


  router.get('/paginated', async (req,res)=>{

    const { page, size, title } = req.query;
  
    const { limit, offset } = getPagination(page, size);
  
    Payment.findAndCountAll({  limit, offset })
      .then(data => {
        const response = getPagingData(data, page, limit);
        res.send(response);
      })
      .catch(err => {
        res.status(500).send({
          message:
            err.message || "Some error occurred while retrieving payments."
        });
      });
  
  })

  router.get('/customer/:id', async (req, res) => {
    const getAllQ = `SELECT * FROM nmspayments where ippis=$1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ, [req.params.id]);
      return res.status(201).send({status:true, data:rows});
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({status:false, message: '' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  


  router.post('/',   async(req, res) => {

    if (req.method === 'POST') {
    
    const createUser = `INSERT INTO payments
        (customerid,amount,reference,createdat,siteid,plotno)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.customerid,
    req.body.amount,
    req.body.reference,
    moment(new Date()),
    req.body.siteid,
    req.body.plotno
      ];
    try {
    const { rows } = await db.query(createUser, values);
    // console.log(rows);
    return res.status(201).send(
      {
        status: true,
        message: 'Payment added successfully',
        data: rows
      }
    );
    } catch (error) {
    return res.status(400).send(error);
    }  
  //  },{ resource_type: "auto", public_id: `ridafycovers/${req.body.title}` })

} else {
    res.status(405).json({
      err: `${req.method} method not allowed`
    })
  }

  });

  module.exports = router;
