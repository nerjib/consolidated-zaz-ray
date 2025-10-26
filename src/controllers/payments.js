const express = require('express');
const moment = require ('moment')
const router = express.Router();
const db = require('../db/index');
const dotenv = require('dotenv');
const upload = require('./multer')
const cloudinary = require('./cloudinary')
const Helper = require('./helpers/pagination')
const db2 = require("../../models");
const Payment = db2.payments;
const Refund = db2.refunds;



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

  router.get('/range/:amount', async (req, res) => {
    const getAllQ = `SELECT ippis, name, command, sum(amount) as amount FROM nmspayments group by ippis, name, command HAVING sum(amount) >= $1 `;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ, [req.params.amount]);
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

  const { limit, offset } = Helper.getPagination(page, size);

  Payment.findAndCountAll({  limit, offset })
    .then(data => {
      const sortedData = data.rows.sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime());
      const response = Helper.getPagingData({ ...data, rows: sortedData }, page, limit);
      res.send(response);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving tutorials."
      });
    });

})

  router.get('/customer/:id', async (req, res) => {
    const getAllQ = `SELECT * FROM nmspayments WHERE ippis=$1 ORDER BY to_date(period, 'YYYY-MM-DD') DESC`;
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

  router.get('/single/customer/:id', async (req, res) => {
    const getAllQ = `SELECT distinct(ippis),name, ref, legacyid, element, amount, period, command, "createdAt", "updatedAt" FROM nmspayments where ippis=$1 limit 1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ, [req.params.id.toUpperCase()]);
      return res.status(201).send({status:true, data:rows});
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({status:false, message: '' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  }); 
  
  router.get('/customer/total/:id', async (req, res) => {
    const getAllQ = `SELECT sum(amount) FROM nmspayments where ippis=$1`;
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

  router.post('/single',   async(req, res) => {

    if (req.method === 'POST') {
    
    const createUser = `INSERT INTO nmspayments
        (ippis,legacyid,name,element,amount,period,command, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6,$7,$8, $9) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.ippis,
    req.body.legacyid,
    req.body.name,
    req.body.element,
    req.body.amount,
    req.body.period,
    req.body.command,
    moment(new Date()),
    moment(new Date())
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


  router.get('/summary', async (req, res) => {
    try {
        const totalPaid = await Payment.sum('amount');
        const totalRefunded = await Refund.sum('amount');

        return res.status(200).send({
            status: true,
            data: {
                totalPaid: totalPaid || 0,
                totalRefunded: totalRefunded || 0,
            }
        });
    } catch (error) {
        return res.status(500).send({
            status: false,
            message: "Error retrieving payment summary.",
            error: error.message
        });
    }
});

  router.get('/summary/:ippis', async (req, res) => {
    const { ippis } = req.params;

    try {
        const totalPaid = await Payment.sum('amount', { where: { ippis } });
        const totalRefunded = await Refund.sum('amount', { where: { payment_ippis: ippis } });

        return res.status(200).send({
            status: true,
            data: {
                totalPaid: totalPaid || 0,
                totalRefunded: totalRefunded || 0,
            }
        });
    } catch (error) {
        return res.status(500).send({
            status: false,
            message: `Error retrieving payment summary for ippis: ${ippis}`,
            error: error.message
        });
    }
});


  module.exports = router;
