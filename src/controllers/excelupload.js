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
const Plots = db2.plots;



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

        if(rowss[0][0] !=='name' || rowss[0][1] !=='phone'|| rowss[0][2] !=='ippis' || rowss[0][3] !=='location'|| rowss[0][4] !=='beacon'|| rowss[0][5] !=='address' ){
          return  res.status(500).send({
            status:false,
            message: `Wrong excel format `,
          });
        }else{
         
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

        }
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
        readXlsxFile(path).then((rowss) => {


          if( rowss[3][1] !=='Staff ID'|| rowss[3][2] !=='Legacy Id' || rowss[3][3] !=='Full Name'|| rowss[3][4] !=='Element'|| rowss[3][5] !=='Amount'|| rowss[3][6] !=='Period'|| rowss[3][7] !=='Command' ){
            return  res.status(500).send({
              status:false,
              message: `Wrong excel format `,
            });
          }else{                

          // skip header
          rowss.shift();
          rowss.shift();
          rowss.shift();
          rowss.shift();

          let payments = [];
          rowss.forEach((row) => {

            let payment = {
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
        }
      });
    } catch (error) {
      console.log(error);
      res.status(500).send({
        status:false,
        message: "Could not upload the file: " + req.file.originalname,
      });
    }
  });  


  router.post('/plots', async (req, res) => {
    try {
        if (req.file == undefined) {
          return res.status(400).send("Please upload an excel file!");
        }
      //  return console.log(JSON.stringify(req.file.originalname))
        let path = `${req.file.destination}/${req.file.originalname}`;
        readXlsxFile(path).then(async(rowss) => {
          // skip header
          //return      res.status(500).send(rowss[0])

        if(rowss[0][0] !=='id' || rowss[0][1] !=='name'|| rowss[0][2] !=='phone' || rowss[0][3] !=='location'|| rowss[0][4] !=='block'|| rowss[0][5] !=='plot no' ){
          return  res.status(500).send({
            status:false,
            message: `Wrong excel format `,
          });
        }else{        
        
          rowss.shift();          
          let tutorials = [];
          rowss.forEach(async(row) => {
            let tutorial = {
              customerid: row[0],
              customername: row[1],
              phonenumber: row[2],
              location: row[3],
              block: row[4],
              plotno: row[5],

            };           
          
              tutorials.push(tutorial);           

          });
         //console.log('tttttt',tutorials)
          Plots.bulkCreate(tutorials, {ignoreDuplicates: true})
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
        }
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
