const express = require('express');
const moment = require ('moment')
const router = express.Router();
const db = require('../db/index');
const dotenv = require('dotenv');
const upload = require('./multer')
const cloudinary = require('./cloudinary')





router.get('/plots', async (req, res) => {
  const getAllQ = `SELECT * FROM plots`;
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


router.get('/allplots', async (req, res) => {
  const getAllQ = `SELECT * FROM zazzauplots`;
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

//get plots and it owner and total payments received
router.get('/customerplots', async (req, res) => {
  const getAllQ = `SELECT plots.plotno, plots.status, plots.price,plots.createdat, 
  plots.soldat,sites.name as site,customers.name as customername, (select sum(amount) from payments 
  where payments.plotno=plots.plotno and payments.siteid=plots.siteid group by siteid,plotno) as amountreceived
   FROM plots left join sites on plots.siteid=sites.id left join customers
    on plots.customerid=customers.id left join payments on plots.plotno=payments.plotno
     and plots.siteid=payments.siteid group by plots.plotno,plots.siteid,plots.status,
      plots.price,plots.createdat, plots.soldat, sites.name, customers.name order 
      by plots.plotno asc`;
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

router.get('/plots/:site', async (req, res) => {
  const getAllQ = `SELECT plots.plotno, plots.coords, plots.shape, plots.status, plots.price,plots.createdat, 
  plots.soldat,sites.name as site,customers.name as customername, (select sum(amount) from payments 
  where payments.plotno=plots.plotno and payments.siteid=plots.siteid group by siteid,plotno) as amountreceived
   FROM plots left join sites on plots.siteid=sites.id left join customers
    on plots.customerid=customers.id left join payments on plots.plotno=payments.plotno
     and plots.siteid=payments.siteid where plots.siteid=$1 group by plots.coords,plots.plotno,plots.siteid,plots.status,
      plots.price,plots.createdat, plots.soldat, plots.shape, sites.name, customers.name order 
      by plots.plotno asc`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ, [req.params.site]);
    return res.status(201).send({
      status: true,
      data: rows
    });
  } catch (error) {
    if (error.routine === '_bt_check_unique') {
      return res.status(400).send({ message: 'User with that EMAIL already exist' });
    }
    return res.status(400).send(`${error} jsh`);
  }
});  
  
router.get('/', async (req, res) => {
    const getAllQ = `SELECT * FROM sites`;
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

  router.get('/plots/:id/:layout', async (req, res) => {
    const getAllQ = `SELECT plotno FROM layouts where customerid=$1 and proposedlayout=$2`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[req.params.id,req.params.layout]);
      return res.status(201).send(rows);
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  
  router.get('/plotsdetail/:layout', async (req, res) => {
    const getAllQ = `SELECT * FROM plots where layout=$1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[req.params.layout]);
      return res.status(201).send(rows);
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  

  router.get('/blankplot/:layout', async (req, res) => {
    const getAllQ = `SELECT plotno FROM plots where status=$1 and layout=$2`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,['0',req.params.layout]);
      return res.status(201).send(rows);
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  
  

  router.post('/add',   async(req, res) => {

    if (req.method === 'POST') {
    
    const createUser = `INSERT INTO layouts
        (customerid,date, proposedlayout,plotno, formid)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.customerid,
    moment(new Date()),
    req.body.layout,
    req.body.plot,
    req.body.formid
      ];
    try {
    const { rows } = await db.query(createUser, values);
    // console.log(rows);
    return res.status(201).send(rows);
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
