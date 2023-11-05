const express = require('express');
const moment = require ('moment')
const router = express.Router();
const db = require('../db/index');

router.get('/getall', async (req, res) => {
  const getAllQ = `SELECT * FROM commerce`;
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

router.post('/add',   async(req, res) => {

    if (req.method === 'POST') {
    
    const createUser = `INSERT INTO commerce
        (name,datecreated, position,token)
      VALUES ($1, $2, $3, $4) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.name,
    moment(new Date()),
    req.body.position,
    req.body.token,
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
