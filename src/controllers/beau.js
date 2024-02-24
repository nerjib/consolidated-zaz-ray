const express = require('express');
const moment = require ('moment')
const stripe = require('stripe')('sk_test_51KPk4hG3qtUfMBk1g045CSDKbRInzr7aAC8pKMPzXUZzq1LJgADNGlmg1t5Odty74vcCVXScVopX5t2WAJLZfzYk00j0207GVb');
const router = express.Router();
const db = require('../db/index');
const dotenv = require('dotenv');
const upload = require('./multer')
const cloudinary = require('./cloudinary')
const referralCodeGenerator = require('referral-code-generator')
const db2 = require("../../models");
const Cart = db2.cart;
const Wholesale = db2.wholesales;




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

  router.get('/products/category/:qry', async (req, res) => {
    const getAllQ = `SELECT * FROM beauproducts where category=$1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[req.params.qry]);
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

router.get('/admin/allorder', async (req, res) => {
  const getAllQ = `SELECT * from beucheckoutcarts order by "createdAt" asc`;
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
router.get('/admin/orderbyref/:id', async (req, res) => {
  const getAllQ = `SELECT * from beucheckoutcarts where reference=$1 order by "createdAt" asc`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ, [req.params.id]);
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

router.get('/product-review/:id', async (req, res) => {
  const getAllQ = `SELECT * from beaureviews where productid=$1 order by "createdAt" asc`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ, [req.params.id]);
    return res.status(201).send(
      {
        status: true,
        message: 'Successful',
        data:rows
      });
  } catch (error) {
    if (error.routine === '_bt_check_unique') {
      return res.status(400).send({ message: 'User with that' });
    }
    return res.status(400).send(`${error} jsh`);
  }
});

router.get('/admin/orderbystatus/:status', async (req, res) => {
  const getAllQ = `SELECT * from beucheckoutcarts where status=$1 order by "createdAt" asc`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ, [req.params.status]);
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

router.get('/admin/wholesellers-req', async (req, res) => {
  const getAllQ = `SELECT distinct(referenceid), customername, customerid, status, "createdAt" from beauwholesales order by "createdAt" desc`;
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

router.get('/wholesellers-cart/:id', async (req, res) => {
  const getAllQ = `SELECT distinct(referenceid), customername, customerid, status, "createdAt" from beauwholesales where customerid=$1 order by "createdAt" desc`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ, [req.params.id]);
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

router.get('/admin/wholesale/:ref', async (req, res) => {
  const getAllQ = `SELECT * from beauwholesales where referenceid=$1 order by "createdAt" asc`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ, [req.params.ref]);
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

router.get('/myorder/:id', async (req, res) => {
  const getAllQ = `SELECT * from beucheckoutcarts where customerid=$1 order by "createdAt" asc`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ, [req.params.id]);
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
  
router.get('/consults/:id', async (req, res) => {
  const getAllQ = `SELECT * from beauconsults where customerid=$1 order by "createdAt" asc`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ, [req.params.id]);
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
router.get('/consults/active/:id/:code', async (req, res) => {
  const getAllQ = `SELECT * from beauconsults where customerid=$1 and code=$2`;
  try {
    // const { rows } = qr.query(getAllQ);
    const { rows } = await db.query(getAllQ, [req.params.id, req.params.code]);
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
  
router.get('/admin/consults', async (req, res) => {
  const getAllQ = `SELECT * from beauconsults order by "createdAt" asc`;
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

  router.post('/addproducts',   async(req, res) => {

    if (req.method === 'POST') {
    
    const createUser = `INSERT INTO beauproducts
        (name,datecreated, category,description, price,status, ngprice,imgurl, nga, uk, ukprice, sex, skintype)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.name,
    moment(new Date()),
    req.body.category,
    req.body.description,
    req.body.ukprice,
    req.body.status,
    req.body.ngprice,
    req.body.imgurl,
    req.body.nga,
    req.body.uk,
    req.body.ukprice,
    req.body.sex,
    req.body.skintype
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

  router.post('/updatecheckout',   async(req, res) => {
    if (req.body.status !== 'DELIVERED' || req.body.status !== 'PENDING') res.status(405).json({err: `status not allowed`})
    if (req.method === 'POST') {
    
    const createUser = `UPDATE beucheckoutcarts set status=$1, updatedat=$2 where id=$3 RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.status,
    moment(new Date()),
    req.body.checkoutid,
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
    //  const { products } = req.body;

    // const lineItems = products.map((product) => ({
    //   price_data: {
    //     currency: 'usd',
    //     product_data: {
    //       name: product.name,
    //       images: [product.imgurl],
    //       price: product.price,
    //     },
    //     unit_amount: Math.round(product.price *100),        
    //   },
    //   quantity: product.qty,      
    // }));
    try {
      const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(req.body.amount *100),
      currency: req.body.currency,
      });
      if (req.body.reference) {
      const up = `update beauwholesales set paymentreference=$1 where referenceid=$2`;
      const {rows} = await db.query(up, [`pi_${paymentIntent.client_secret.split('_')[1]}`, req.body.reference]);
      }
      res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
      res.status(500).json({ error: error.message });
      }
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

  router.post('/consult-checkout',   async(req, res) => {

    if (req.method === 'POST') {
  
    try {
      const up = `INSERT INTO beauconsults (customername, customerid, paymentref, status, paymentstatus, paymentdate, updatedat, code )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
      const {customername, customerid, paymentref, paymentdate, updatedat} = req.body;
      const referenceid = referralCodeGenerator.alphaNumeric('uppercase', 2, 2);
      const values = [
        customername,
        customerid,
        paymentref,
        'ACTIVE',
        'PAID',
        moment(new Date()),
        moment(new Date()),
        referenceid
      ]
      const {rows} = await db.query(up, values);
      return res.status(201).send({status:true, message: 'successful', data:rows});
      } catch (error) {
      return res.status(400).send(error);
      } 
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

  router.post('/addcart-checkoutb',   async(req, res) => {

    if (req.method === 'POST') {
    //  const { products } = req.body;

    // const lineItems = products.map((product) => ({
    //   price_data: {
    //     currency: 'usd',
    //     product_data: {
    //       name: product.name,
    //       images: [product.imgurl],
    //       price: product.price,
    //     },
    //     unit_amount: Math.round(product.price *100),        
    //   },
    //   quantity: product.qty,      
    // }));
   
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

  router.post('/addcart-checkout', async (req, res) => {
    try {
      const { products, customername, customerid, referenceid, address } = req.body;
      let dataP = [];
      products.map((product) => (
          dataP.push({
            productid: product.id,
            productname: product.name,
            customername,
            customerid,
            price: product.price * product.rate,
            qty: product.qty,
            status: 'PENDING',
            referenceid,
            address,
          })
      ));
      
          Cart.bulkCreate(dataP, {ignoreDuplicates: true})
          .then(() => {
            res.status(200).send({
              status: true,
              message: "cart updated successfully",
            });
          })
          .catch((error) => {
            res.status(500).send({
              status: false,
              message: "Failed",
              error: error.message,
            });
          });
        
    } catch (error) {
      console.log(error);
      res.status(500).send({
        status:false,
        message: "Could not upload the file: ",
      });
    }
  });

  router.post('/review', async (req, res) => {
      const { productid, userid, customername, review } = req.body;
      const createUser = `INSERT INTO beaureviews
        (productid,userid,customername, review, "createdAt")
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    console.log(req.body)
    const values = [
    productid,
    userid,
    customername,
    review,
    moment(new Date())
    ];
    try {
    const { rows } = await db.query(createUser, values);
    // console.log(rows);
    //  return res.status(201).send(rows);
    return res.status(201).send({status:true, message: 'successful', data:rows});
    } catch (error) {
    return res.status(400).send(error);
    }    
  });

  router.post('/addwholesale', async (req, res) => {
    try {
      const { products, customername, customerid, address } = req.body;
      let dataP = [];
      const referenceid = referralCodeGenerator.alphaNumeric('uppercase', 2, 2);
      products.map((product) => (
          dataP.push({
            productid: product.id,
            productname: product.name,
            customername,
            customerid,
            qty: product.qty ?? 1,
            status: 'PENDING',
            referenceid,
            address,
            createdat: moment(new Date())
          })
      ));
      
          Wholesale.bulkCreate(dataP, {ignoreDuplicates: true})
          .then(() => {
            res.status(200).send({
              status: true,
              message: "cart updated successfully",
            });
          })
          .catch((error) => {
            res.status(500).send({
              status: false,
              message: "Failed",
              error: error.message,
            });
          });
        
    } catch (error) {
      console.log(error);
      res.status(500).send({
        status:false,
        message: "Could not upload the file: ",
      });
    }
  });

  router.put('/addwholesale', async (req, res) => {
      const { products, adminid } = req.body;
      let dataP = [];
      products.map((product) => (
          dataP.push({
            id: product.productid,
            price: product.price,
            status: 'REVIEWED',
            referenceid: product.referenceid,
            adminid,
            updatedat: moment(new Date())
          })
      ));
    try {
      for (let i = 0; i < dataP.length; i++) {
            await Wholesale.update(
              dataP[i],
              { where: { productid: dataP[i].id, referenceid: dataP[i].referenceid } }
            );
          }
          // .catch((error) => {
          //   res.status(500).send({
          //     status: false,
          //     message: "Failed",
          //     error: error.message,
          //   });
          // });
          res.status(200).send({
            status: true,
            message: "cart updated successfully",
          });
    } catch (error) {
      console.log(error);
      res.status(500).send({
        status:false,
        message: "Could not he file: ",
      });
    }
  });

  router.put('/wholesale-checkout',   async(req, res) => {

    if (req.method === 'PUT') {
    
    const createUser = `UPDATE beauwholesales set status=$1, paymentdate=$2, updatedat=$2, paymentstatus=$3 where paymentreference=$4 RETURNING *`;
    const values = [
    req.body.status,
    moment(new Date()),
    'PAID',
    req.body.paymentref
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
  module.exports = router;
