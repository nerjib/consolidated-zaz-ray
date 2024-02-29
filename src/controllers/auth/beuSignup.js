const { Resend } =  require('resend');
const express = require('express');
const moment = require('moment');
const nodemailer = require("nodemailer");
let referralCodeGenerator = require('referral-code-generator')


const resend = new Resend("753993e7-cdaf-4f0c-b4f5-89b288b1562b");

const Helper = require('../helpers/helpers');

const router = express.Router();
const db = require('../../db/index');
    router.get('/kk', async (req, res) => {
      const { data, error } = await resend.emails.send({
        from: "Acme <onboarding@resend.dev>",
        to: ["kabirnajib0@gmail.com"],
        subject: "hello world",
        html: "<strong>it works!</strong>",
      });
    
      if (error) {
        return res.status(400).json({ error });
      }
    
      res.status(200).json({ data })

    // let kkk= []
    //  /*     const text = 'SELECT email FROM users';
    //       const { rows } = await db.query(text);
    //       const rowlength = rows.length
    //       Object.keys(rows).map(async(e,i)=>{
    //           await main(rows[e].email)
    //       })*/
    //       //  return res.json(rowlength)
    //         await   main('kabirnajib0@gmail.com')


            });
            
            router.get('/authmail/:id', async (req, res) => {
       const decoded = await      Helper.decodedEmail(req.params.id)
             // await   main('kabirnajib0@gmail.com')
             const text = 'SELECT * FROM users WHERE email = $1';

             try {
              const { rows } = await db.query(text, [decoded.email]);
              if (!rows[0]) {
                // console.log('user not');
                return res.status(402).send({ message: 'email not found' });
              }
              // console.log(rows[0].pword);
              const response = {  
                status: 'Account verified',
                            };
             
                            await updateUserEmail(decoded.email)
              return res.status(200).send(response);
            } catch (error) {
              return res.status(405).send(error);
            }

     
    
                });

                const    updateUserEmail =async(email) =>{
                  const text1 = `update users set email_status=$1, email_verified_at=$2 where email=$3`;
                  values=[
                    'verified',
                    moment(new Date()),
                    email
                  ]
                  const { rows } = await db.query(text1, values);
                }
    

async function main(kk) {
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
           user: 'ridafyinfp@gmail.com',
           pass: 'xhhikfcbdgssaplw'
       }
   });
   var hashEmail = await Helper.emailToken(kk);
   let message = {
    from: 'Ridafy App <verify@ridafyapp.ng>',
    to: `${kk} <${kk}>`,
    subject: 'Account Verification',
    html: `Thanks for signing up to Ridafy! 
    <p>We want to make sure that we got your email right. Verifying your email will enable you to access  our content. Please verify your email by clicking the link below.
    </p>
    <p><b>Complete Verification<b/></p>        
    <p><b><a href='https://ridafyapp.herokuapp.com/api/v1/auth/signup/authmail/${hashEmail}'><h3>Click here</h3></a></b></p>`,

};

await transporter.sendMail(message, function (err, info) {
  if(err)
    console.log(err)
  else
    console.log(info);
});
  //  const { data, error } = await resend.emails.send({
  //       from: 'Ridafy App <verify@ridafyapp.ng>',
  //       to: [kk],
  //       subject: 'Account Verification',
  //       html: `Thanks for signing up to Ridafy! 
  //       <p>We want to make sure that we got your email right. Verifying your email will enable you to access  our content. Please verify your email by clicking the link below.
  //       </p>
  //       <p><b>Complete Verification<b/></p>        
  //       <p><b><a href='https://ridafyapp.herokuapp.com/api/v1/auth/signup/authmail/${hashEmail}'><h3>Click here</h3></a></b></p>`,

  //     });

  //     if (error) {
  //       return res.status(400).json({ error });
  //     }
  //     console.log({data});
  //     res.status(200).json({ data });

 }




router.get('/maill',async(req,res)=>{
  
  mg.messages().send(data, function (error, body) {
    console.log(body);
    return res.send('sent');

  });
})


router.post('/', async (req, res) => {
  if (!req.body.email || !req.body.password) {
    return res.status(402).send({ message: 'Some values are missing' });
  }
  if (!Helper.isValidEmail(req.body.email)) {
    return res.status(401).send({ message: 'Please enter a valid email address' });
  }
  const hashPassword = Helper.hashPassword(req.body.password);
  const rC = referralCodeGenerator.alphaNumeric('uppercase', 2, 2);
  const createQuery = `INSERT INTO
    beauusers(name, email, password, phone, address, country,datecreated, referralcode, referrer)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`;
  const values = [
    req.body.name,
    req.body.email,
    hashPassword,
    req.body.phone,
    req.body.address,
    req.body.country,
    moment(new Date()),
    rC,
    req.body.referrer
  ];

  try {
    const { rows } = await db.query(createQuery, values);
    const token = Helper.generateToken(rows[0].id,'user');

    const response = {
      status: 'success',
      data: {
        message: 'User account successfully created waiting for email cofirmation',
        token,
        referralCode: rows[0].referralcode,
        userId: rows[0].id,
      },
    };
    await   main(req.body.email )

    return res.status(201).send(response);
  } catch (error) {
    if (error.routine === '_bt_check_unique') {
      return res.status(404).send({ message: 'User with that username already exist' });
    }
    return res.status(400).send(error);
  }
});

module.exports = router;
