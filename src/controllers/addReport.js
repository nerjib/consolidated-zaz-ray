/* eslint-disable no-console */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable object-shorthand */
const express = require('express');
const moment = require('moment');
const dotenv = require('dotenv');
const router = express.Router();
const db = require('../db/index');


async function addReport(req, res, imgurl) {
    const createProfilePic = `INSERT INTO
    reports (absent,challenges,date,lga,mentor,present,reason, recomendation,school,session,success,ward,img,createdat)
    VALUES ($1, $2,$3,$4,$5, $6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`;  
  const values = [
  req.body.absent,
  req.body.challenges,
  req.body.date,
  req.body.lga,
  req.body.mentor,
  req.body.present,
  req.body.reason,
  req.body.recomendation,
  req.body.school,
  req.body.session,
  req.body.success,
  req.body.ward,
  imgurl,
  moment(new Date())
  ];
  try {
  const { rows } = await db.query(createProfilePic, values);
  // console.log(rows);
  const data = {
    status: 'success',
    data: {
      message: 'Picture added successfully​',
      Name: rows[0].name,
      Email: rows[0].imgurl,
    },
  };
  return res.status(201).send({
    status: true,
    message: "Uploaded Successful",
    data
}
    );
  } catch (error) {
  return res.status(400).send({
    status: false,
    message: 'failed',
    error
  });
  }
}

dotenv.config();

module.exports = {
  addReport,
};
