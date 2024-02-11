/* eslint-disable no-console */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable object-shorthand */
const express = require('express');
const moment = require('moment');
const dotenv = require('dotenv');
const router = express.Router();
const db = require('../db/index');


async function addProduct(req, res, imgurl) {
    const createProduct = `INSERT INTO beauproducts
        (name,datecreated, category,description, price,status,imgurl, nga, uk)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.name,
    moment(new Date()),
    req.body.category,
    req.body.description,
    req.body.price,
    true,
    imgurl,
    req.body.nga,
    req.body.uk
      ];
  try {
  const { rows } = await db.query(createProduct, values);
  // console.log(rows);
  const data = {
    status: 'success',
    message: 'Product added successfully​',
    data: rows,
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
async function updateProduct(req, res, imgurl) {
    const createProduct = `INSERT INTO beauproducts
        (name,datecreated, category,description, price,status,imgurl, nga, uk, ngprice, ukprice)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.name,
    moment(new Date()),
    req.body.category,
    req.body.description,
    req.body.price,
    req.body.status,
    imgurl,
    req.body.nga,
    req.body.uk,
    req.body.ngprice,
    req.body.ukprice
      ];
  try {
  const { rows } = await db.query(createProduct, values);
  // console.log(rows);
  const data = {
    status: 'success',
    message: 'Product added successfully​',
    data: rows,
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
    addProduct,
    updateProduct,
};
