const express = require('express');

//const CokokieParser = require('cookie-parser');
const Helper = require('../helpers/helpers');

const router = express.Router();
//router.use(CokokieParser());
const db = require('../../db/index');

router.post('/', async (req, res) => {
 /* if (!req.body.email || !req.body.password) {
    return res.status(400).send({ message: 'Some values are missing' });
  }
  if (!Helper.isValidEmail(req.body.email)) {
    return res.status(401).send({ message: 'Please enter a valid email address' });
  }*/
  const text = 'SELECT * FROM zazzauusers WHERE ippis = $1';
  try {
    let userId;
    if(req.body.email!='admin@nms.com.ng'){
     userId = req.body.email.toUpperCase().replace(/\s/g, '');
    }else{
      userId = req.body.email.replace(/\s/g, '');

    }
    const { rows } = await db.query(text, [userId]);
    console.log({rows: rows[0]})
    if (!rows[0]) {
      // console.log('user not');
      return res.status(402).send({ status:false, message: 'Bad Credentials' });
    }
    // console.log(rows[0].pword);
   /* if (!Helper.comparePassword(rows[0].password, req.body.password)) {
      return res.status(403).send({ message: 'The credentials you provided is incorrect' });
    }*/
    const token = Helper.generateToken(rows[0].id, rows[0].name);
    const response = {  
      status: true,
      data: {
        token,
        userId: rows[0].id,
        fullName: rows[0].name,
        emailStatus: rows[0].email,
        roleId: rows[0].roleid,
        isAdmin: rows[0].isadmin,
        ippis: rows[0].ippis,
        phoneNumber: rows[0].phoneNumber

      },
    };

    res.cookie('token', token, { maxAge: 90000000, httpOnly: true }).status(200);
    // res.set('token1', token);
    // console.log(token);
    // res.send({ message: 'token send' });

    return res.status(200).send(response);
  } catch (error) {
    return res.status(405).send(error.message);
  }
});

module.exports = router;
