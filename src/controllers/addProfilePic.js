/* eslint-disable no-console */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable object-shorthand */
const express = require('express');
const moment = require('moment');
const dotenv = require('dotenv');
const router = express.Router();
const db = require('../db/index');


async function addProfile(req, res, imgurl) {
    const createProfilePic = `INSERT INTO
    profileimg (name,imgurl,userid,createdat)
    VALUES ($1, $2,$3,$4) RETURNING *`;  
  const values = [
  req.body.name,
  imgurl,
  req.body.userid,
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

async function updateProfile(req, res, imgurl) {
    const createProfilePic = `UPDATE profileimg SET imgurl=$1, updatedat=$2 WHERE userid=$3`;  
  const values = [
  imgurl,
  moment(new Date()),
  req.body.userid
  ];
  try {
  const { rows } = await db.query(createProfilePic, values);
  // console.log(rows);
  const data = {
    status: 'success',
    data: {
      message: 'Picture added successfully​',     
    },
  };
  return res.status(201).send({
    status: true,
    message: "Update Successful",
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
  addProfile,
  updateProfile
};
