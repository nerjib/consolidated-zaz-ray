const express = require('express');
const moment = require ('moment')
const router = express.Router();
const db = require('../db/index');
const dotenv = require('dotenv');
const readXlsxFile = require("read-excel-file/node");
//const upload = require('./multer')
const cloudinary = require('./cloudinary')
const db2 = require("../../models");
const Tutorial = db2.tutorials;
const Payment = db2.payments;



const upload = async (req, res) => {
  try {
    if (req.file == undefined) {
      return res.status(400).send("Please upload an excel file!");
    }
    let path =
      __basedir + "/resources/static/assets/uploads/" + req.file.filename;
    readXlsxFile(path).then((rows) => {
      // skip header
      rows.shift();
      let tutorials = [];
      rows.forEach((row) => {
        let tutorial = {
          name: row[0],
          rank: row[1],
          phoneNumber: row[2],
        };
        tutorials.push(tutorial);
      });
      console.log('data',tutorials.shift())
     /* Tutorial.bulkCreate(tutorials)
      .then(() => {
        res.status(200).send({
          message: "Uploaded the file successfully: " + req.file.originalname,
        });
      })
      .catch((error) => {
        res.status(500).send({
          message: "Fail to import data into database!",
          error: error.message,
        });
      });*/
  });
} catch (error) {
  console.log(error);
  res.status(500).send({
    message: "Could not upload the file: " + req.file.originalname,
  });
}
};


const checkUser = async (ippis)=>{
  const getAllQ = `SELECT * FROM zazzauusers where ippis=$1`;
  // const { rows } = qr.que  ry(getAllQ);
 const { rows } = await db.query(getAllQ,[ippis]);
 return rows;
}
  
router.post('/customers', async (req, res) => {
    try {
        if (req.file == undefined) {
          return res.status(400).send("Please upload an excel file!");
        }
      //  return console.log(JSON.stringify(req.file.originalname))
        let path = `${req.file.destination}/${req.file.originalname}`;
        readXlsxFile(path).then(async(rowss) => {
          // skip header
          //return      res.status(500).send(rowss[0])

        if(rowss[0] !=='name' || rowss[1] !=='phone'|| rowss[2] !=='ippis' || rowss[3] !=='location' ){
          return  res.status(500).send({
            status:false,
            message: "Wrong excel format",
          });
        }else{
          return res.status(200).send({
            status:true,
            message: "format good",
            data: rowss
          })
        }
          rowss.shift();          
          let tutorials = [];
          rowss.forEach(async(row) => {
            let tutorial = {
              name: row[0],
              phoneNumber: row[1],
              ippis: row[2],
              site: row[3],
              beacon: row[4],
              address: row[5],

            };
           
          
              tutorials.push(tutorial);
           

          });
         //console.log('tttttt',tutorials)
          Tutorial.bulkCreate(tutorials, {ignoreDuplicates: true})
          .then(() => {
            res.status(200).send({
              status: true,
              message: "Uploaded the file successfully: " + req.file.originalname,
            });
          })
          .catch((error) => {
            res.status(500).send({
              status: false,
              message: "Fail to import data into database!",
              error: error.message,
            });
          });
      });
    } catch (error) {
      console.log(error);
      res.status(500).send({
        status:false,
        message: "Could not upload the file: " + req.file.originalname,
      });
    }
  });  

  router.post('/payments', async (req, res) => {
    try {
        if (req.file == undefined) {
          return res.status(400).send("Please upload an excel file!");
        }
      //  return console.log(JSON.stringify(req.file.originalname))
        let path = `${req.file.destination}/${req.file.originalname}`;
        readXlsxFile(path).then((rows) => {
          // skip header
          rows.shift();
          let payments = [];
          rows.forEach((row) => {

            let payment = {
              ref: row[0],
              ippis: row[1],
              legacyid: row[2],
              name: row[3],
              element: row[4],
              amount: row[5],
              period: row[6],
              command: row[7]


            };
            payments.push(payment);
          });
         // console.log(tutorials.shift())
          Payment.bulkCreate(payments)
          .then(() => {
            res.status(200).send({
              status: true,
              message: "Uploaded the file successfully: " + req.file.originalname,
            });
          })
          .catch((error) => {
            res.status(500).send({
              status: false,
              message: "Fail to import data into database!",
              error: error.message,
            });
          });
      });
    } catch (error) {
      console.log(error);
      res.status(500).send({
        status:false,
        message: "Could not upload the file: " + req.file.originalname,
      });
    }
  });  


  module.exports = router;
