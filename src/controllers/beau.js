const express = require('express');
const moment = require ('moment')
//const stripe = require('stripe')('sk_test_51KPk4hG3qtUfMBk1g045CSDKbRInzr7aAC8pKMPzXUZzq1LJgADNGlmg1t5Odty74vcCVXScVopX5t2WAJLZfzYk00j0207GVb');
const router = express.Router();
const db = require('../db/index');
const dotenv = require('dotenv');
const upload = require('./multer')
const cloudinary = require('./cloudinary')



router.get('/products', async (req, res) => {
  const getAllQ = `SELECT * FROM beauproducts`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ);
    return res.status(201).send({
      status: true,
      data: rows,
      message: 'successful'
    });
  } catch (error) {
    if (error.routine === '_bt_check_unique') {
      return res.status(400).send({ message: 'Error' });
    }
    return res.status(400).send(`${error} jsh`);
  }
});

router.get('/products/:qry', async (req, res) => {
    const getAllQ = `SELECT * FROM beauproducts where name ILIKE $1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,['%'+req.params.qry+'%']);
      return res.status(201).send({
        status: true,
        data: rows,
        message: 'successful'
      });
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'Error' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });


router.get('/carts', async (req, res) => {
  const getAllQ = `SELECT * FROM cart`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ);
    return res.status(201).send({
      status: true,
      data: rows,
      message: 'successful'
    });
  } catch (error) {
    if (error.routine === '_bt_check_unique') {
      return res.status(400).send({ message: 'User with that EMAIL already exist' });
    }
    return res.status(400).send(`${error} jsh`);
  }
});

//get plots and it owner and total payments received
router.get('/users', async (req, res) => {
  const getAllQ = `SELECT * from beauusers`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ);
    return res.status(201).send({
      status:true,
      message: 'Successful',
      data:rows
    });
  } catch (error) {
    if (error.routine === '_bt_check_unique') {
      return res.status(400).send({ message: 'User with that EMAIL already exist' });
    }
    return res.status(400).send(`${error} jsh`);
  }
});

router.get('/transactions', async (req, res) => {
  const getAllQ = `SELECT * from beautransactions`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ);
    return res.status(201).send(
      {
        status: true,
        message: 'Successful',
        data:rows
      });
  } catch (error) {
    if (error.routine === '_bt_check_unique') {
      return res.status(400).send({ message: 'User with that EMAIL already exist' });
    }
    return res.status(400).send(`${error} jsh`);
  }
});
  

  router.post('/addproduct',   async(req, res) => {

    if (req.method === 'POST') {
    
    const createUser = `INSERT INTO beauproducts
        (name,datecreated, category,description, price,status,imgurl)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.name,
    moment(new Date()),
    req.body.category,
    req.body.description,
    req.body.price,
    req.body.status,
    req.body.imgurl,
      ];
    try {
    const { rows } = await db.query(createUser, values);
    // console.log(rows);
    //  return res.status(201).send(rows);
    return res.status(201).send({status:true, message: 'successful', data:rows});
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

  router.post('/addcart',   async(req, res) => {

    if (req.method === 'POST') {
    
    const createUser = `INSERT INTO cart
        (transactionid,datecreated, customerid, productid,status, amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.transactionid,
    moment(new Date()),
    req.body.category,
    req.body.customerid,
    req.body.productid,
    req.body.status,
    req.body.amount,
      ];
    try {
    const { rows } = await db.query(createUser, values);
    // console.log(rows);
    //  return res.status(201).send(rows);
    return res.status(201).send({status:true, message: 'successful', data:rows});
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

  router.post('/addtransactions',   async(req, res) => {

    if (req.method === 'POST') {
    
    const createUser = `INSERT INTO beautransactions
        (transactionid,datecreated, status, customerid, amount)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.transactionid,
    moment(new Date()),
    req.body.status,
    req.body.customerid,
    req.body.amount,
      ];
    try {
    const { rows } = await db.query(createUser, values);
    // console.log(rows);
    //  return res.status(201).send(rows);
    return res.status(201).send({status:true, message: 'successful', data:rows});
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

  router.post('/addusers',   async(req, res) => {

    if (req.method === 'POST') {
    
    const createUser = `INSERT INTO beauusers
        (name,datecreated, email, phone)
      VALUES ($1, $2, $3, $4) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.name,
    moment(new Date()),
    req.body.email,
    req.body.phone,
      ];
    try {
    const { rows } = await db.query(createUser, values);
    // console.log(rows);
    //  return res.status(201).send(rows);
    return res.status(201).send({status:true, message: 'successful', data:rows});
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

  router.post('/create-checkout',   async(req, res) => {

    if (req.method === 'POST') {
    const { products } = req.body;

    const lineItems = products.map((product) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: product.name,
          images: [product.imgurl],
          price: product.price,
        },
        unit_amount: Math.round(product.price *100),        
      },
      quantity: product.qty,      
    }));

    // const session = await stripe.checkout.session.create({
    //     payment_method: 'card',
    //     line_items: lineItems,
    //     mode: 'payment',
    //     success_url: 'nerjib.github.io/beu/',
    //     cancel_url: ''
    // })
    // res.json({id: session.id});
    
  //   const createUser = `INSERT INTO cart
  //       (transactionid,datecreated, customerid, productid,status, amount)
  //     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
  //   console.log(req.body)
  //   const values = [
  //   req.body.transactionid,
  //   moment(new Date()),
  //   req.body.category,
  //   req.body.customerid,
  //   req.body.productid,
  //   req.body.status,
  //   req.body.amount,
  //     ];
  //   try {
  //   const { rows } = await db.query(createUser, values);
  //   // console.log(rows);
  //   //  return res.status(201).send(rows);
  //   return res.status(201).send({status:true, message: 'successful', data:rows});
  //   } catch (error) {
  //   return res.status(400).send(error);
  //   }  
  // //  },{ resource_type: "auto", public_id: `ridafycovers/${req.body.title}` })
} else {
    res.status(405).json({
      err: `${req.method} method not allowed`
    })
  }

  });


  module.exports = router;
