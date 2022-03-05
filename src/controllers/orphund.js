const express = require('express');
const moment = require ('moment')
const router = express.Router();
const db = require('../db/index');
const dotenv = require('dotenv');
const upload = require('./multer')
const cloudinary = require('./cloudinary')
const stripe = require("stripe")('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');
//const stripe = require("stripe")('sk_test_51KPk4hG3qtUfMBk1g045CSDKbRInzr7aAC8pKMPzXUZzq1LJgADNGlmg1t5Odty74vcCVXScVopX5t2WAJLZfzYk00j0207GVb');


  
router.post("/create-account-hosted", async (req, res) => {
  const data = req.body;
  try {
    // 1: Create "blank" custom account
    var account = await stripe.accounts.create({
      type: 'custom',
      business_type: 'individual',
      requested_capabilities: ['card_payments', 'transfers'],
    }).then(async res=>{
      console.log(res.id)
    //})


    // 2: Create account link.
    var accountLink = await stripe.accountLinks.create({
      account: res.id,
      success_url: 'http://localhost:4242?success',
      failure_url: 'http://localhost:4242?failure',
      type: 'custom_account_verification',
      collect: 'eventually_due',
    });
  })
  res.send(accountLink);

} catch (err) {
    console.log(err);
    res.status(400)
    res.send({ error: err })
    return;
  }

});

router.get("/account/:id/:amount", async (req, res) => {
  //return res.send(req.params.id)
  const data = req.body;
  let accountId = req.params.id;
  /*const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: 'https://example.com/reauth',
    return_url: 'https://example.com/return',
    type: 'account_onboarding',
  }).then(resp=>{
      res.send(resp)
     // return;
  }).catch(err=>{res.send(err)
  return;
  });

  res.send(accountLink)*/

  const paymentIntent = await stripe.paymentIntents.create({
    payment_method_types: ['card'],
    amount: req.params.amount *100,
    currency: 'usd',
    application_fee_amount: 100 *100,
  }, {
    stripeAccount: accountId,
  
  }).then(resp=>{
    res.send(resp)
   return;
}).catch(err=>{res.send(err)
return;
});
/*
  const payout = await stripe.payouts.create({
    amount: 1000,
    currency: 'usd',
    method: 'instant',
  }, {
    stripeAccount: accountId,
  }).then(resp=>{
    res.send(resp)
}).catch(err=>{
  res.send(err)
});
*/
  //res.send(account);
});



// Part 2: Create custom account, add person to account
// "relationship.account_opener",
// "relationship.owner",
function now() {
  return Math.round((new Date()).getTime() / 1000);
}

router.get("/getbalance/:id", async (req, res) => {
    const balance = await stripe.balance.retrieve({
        stripeAccount: req.params.id
      }).then(respo=>{
            res.send(respo)
      }).catch(err=>{
          res.send(err)
      });


})
router.post("/create-account", async (req, res) => {
  const data = req.body;
  try {
    var account = await stripe.accounts.create({
      type: 'custom',
      business_type: 'company',
      requested_capabilities: ['card_payments', 'transfers'],
      external_account: data.external_account, // btok_xxxx
      business_profile: {
        mcc: 7623,
        url: data.url, // https://rocketrides.io
      },
      company: {
        name: data.name,
        phone: data.phone,
        tax_id: data.tax_id,
        address: {
          line1: data.line1,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
        }
      },
      tos_acceptance: {
        date: now(),
        ip: req.ip
      }
    })
  } catch (err) {
    console.log(err);
    res.status(400)
    res.send({ error: err })
    return;
  }
  res.send(account);
});

router.post("/create-person", async (req, res) => {
  const data = req.body;
  try {
    var person = await stripe.accounts.createPerson(
      data.account, {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        id_number: data.id_number,
        dob: {
          day: 1,
          month: 1,
          year: 1902,
        },
        address: {
          line1: data.line1,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
        },
        relationship: {
          representative: data.representative,
          percent_ownership: data.percent_ownership,
          owner: data.owner,
          title: data.title,
        }
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400)
    res.send({ error: err })
    return;
  }
  res.send(person);
});

router.post("/update-person-file", async (req, res) => {
  const data = req.body;
  try {
    var person = await stripe.accounts.updatePerson(
      data.account,
      data.person, {
        verification: {
          document: {
            front: data.file
          }
        }
      }
    )
  } catch (err) {
    console.log(err);
    res.status(400)
    res.send({ error: err })
    return;
  }
  res.send(person);
});


  module.exports = router;
