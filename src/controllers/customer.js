const express = require('express');
const moment = require ('moment')
const router = express.Router();
const db = require('../db/index');
const dotenv = require('dotenv');
const upload = require('./multer')
const cloudinary = require('./cloudinary')


  
router.get('/', async (req, res) => {
    const getAllQ = `SELECT * FROM custome WHERE isadmin=$1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[true]);
      return res.status(201).send(rows);
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  

  router.put('/updatecustomer',  async(req, res) => {
    
    const updateUser = `UPDATE zazzauusers set ippis=$1, updatedby=$2, "updatedAt"=$3, "phoneNumber"=$4, address=$5, site=$6, status=$7 where id=$8  RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.ippis,
    req.body.adminId,
    moment(new Date()),
    req.body.phoneNumber,
    req.body.address,
    req.body.site,
    req.body.status,
    req.body.userId
      ];
    try {
    const { rows } = await db.query(updateUser, values);
    // console.log(rows);
    return res.status(201).send({
      status:true,
      message: 'Updated successful',
      data:rows
    });
    } catch (error) {
    return res.status(400).send(error);
    }


  });

  router.get('/all', async (req, res) => {
    const getAllQ = `SELECT *FROM zazzauusers  where isadmin=$1 order by "createdAt" asc`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[false]);
      return res.status(201).send({status:true, data:rows});
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  

  router.get('/profile/:id', async (req, res) => {
    const getAllQ = `SELECT * FROM zazzauusers left join profileimg on zazzauusers.ippis=profileimg.userid where zazzauusers.ippis=$1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[req.params.id]);
      return res.status(201).send({status:true, data:rows});
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });
  router.get('/userdetails/:id', async (req, res) => {
    const getAllQ = `SELECT * FROM zazzauusers where zazzauusers.ippis=$1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[req.params.id]);
      return res.status(201).send({status:true, data:rows});
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  

  router.get('/plots/:id', async (req, res) => {
    const getAllQ = `SELECT *FROM zazzauplots where customerid=$1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[req.params.id]);
      return res.status(201).send({status:true, data:rows});
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  

  router.get('/stats', async (req, res) => {
    const getAllQ = `SELECT count(*) FROM zazzauusers `;
    const getMJos = `SELECT count(*) FROM zazzauusers where site='MARABAN JOS' `;
    const getDamishi = `SELECT count(*) FROM zazzauusers where site='DAMISHI' `;
    const getMcity = `SELECT count(*) FROM zazzauusers where site='MILLENIUM CITY' `;


    try {
      // const { rows } = qr.query(getAllQ);
     let k1  =  await db.query(getAllQ);
     let k2  =  await db.query(getMJos);
     let k3  =  await db.query(getDamishi);
     let k4  =  await db.query(getMcity);



      return res.status(201).send({
        status:true, 
        data:{
          allCustomers:k1.rows[0].count,
          maraba: k2.rows[0].count,
          mCity: k4.rows[0].count,
          damishi: k3.rows[0].count,

        }});
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  

  router.get('/plotcount', async (req, res) => {
    const getAllQ = `SELECT *, (select count(*) as nofoplots from plots where plots.customerid=customers.id) FROM customers where isadmin=false order by id asc`;
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

  router.get('/sites/:phone', async (req, res) => {
    const getAllQ = `SELECT customers.id as customerid, customers.name, plots.plotno, sites.id as siteid, sites.name as site  FROM customers left join plots on customers.id=plots.customerid left join sites on sites.id=plots.siteid where customers.phone=$1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[req.params.phone]);
      return res.status(201).send(
        {
          status:true,
          data:rows
        }
        
        );
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  





  router.get('/details/:id', async (req, res) => {
    const getAllQ = `SELECT * FROM customer where id=$1`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[req.params.id]);
      return res.status(201).send(rows);
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  
 
  


  router.get('/layouts/:id', async (req, res) => {
    const getAllQ = `select *,(select sum(amount) from payments where plot=plots.plotno and customerid=layouts.customerid) from plots left join layouts on layouts.proposedlayout=plots.layout where layouts.customerid=$1 and layouts.plotno=plots.plotno;`;
    try {
      // const { rows } = qr.query(getAllQ);
      const { rows } = await db.query(getAllQ,[req.params.id]);
      return res.status(201).send(rows);
    } catch (error) {
      if (error.routine === '_bt_check_unique') {
        return res.status(400).send({ message: 'User with that EMAIL already exist' });
      }
      return res.status(400).send(`${error} jsh`);
    }
  });  

  router.post('/', upload.single('file'),  async(req, res) => {
    const uploader = async (path) => await cloudinary.uploads(path,'customer', req.body.name+'_'+(new Date()).getTime());

    if (req.method === 'POST') {
        const urls = []
        const file = req.file.path;
    //    for (const file of files) {
       //   const { path } = file;
          const newPath = await uploader(file)
          urls.push(newPath.url)
        //  console.log()
         // fs.unlinkSync(path)
      //  }
    
   // cloudinary.uploader.upload(req.file.path, async (result)=> {
    
    const createUser = `INSERT INTO zazzauusers
        (name,ippis,"phoneNumber",site,beacon, address, "createdAt", "updatedAt", "isAdmin","updatedBy")
      VALUES ($1, $2, $3, $4, $5, $6, $7,$8, $9, $10) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.name,
    req.body.ippis,
    req.body.phone,
    req.body.site,
    req.body.beacon,
    req.body.address,
     moment(new Date()),
     moment(new Date()),
    false,
    req.body.updatedBy
    ];
    try {
    const { rows } = await db.query(createUser, values);
    // console.log(rows);
    return res.status(201).send({status: true, message: 'successful', data: rows });
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

  router.post('/guarantor', upload.single('file'),  async(req, res) => {
    const uploader = async (path) => await cloudinary.uploads(path,'guarantor', req.body.name+'_'+(new Date()).getTime());

    if (req.method === 'POST') {
        const urls = []
        const file = req.file.path;
    //    for (const file of files) {
       //   const { path } = file;
          const newPath = await uploader(file)
          urls.push(newPath.url)
         // fs.unlinkSync(path)
      //  }
    
   // cloudinary.uploader.upload(req.file.path, async (result)=> {
    
    const createUser = `INSERT guarantor
      (name,custormerid,department,phone,date, imgurl)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.name,
    req.body.customerid,
    req.body.department,
    req.body.phone,
    moment(new Date()),
    urls[0] ?urls[0]:''
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


  router.post('/nok', upload.single('file'),  async(req, res) => {
    const uploader = async (path) => await cloudinary.uploads(path,'nok', req.body.name+'_'+(new Date()).getTime());

    if (req.method === 'POST') {
        const urls = []
        const file = req.file.path;
    //    for (const file of files) {
       //   const { path } = file;
          const newPath = await uploader(file)
          urls.push(newPath.url)
         // fs.unlinkSync(path)
      //  }
    
   // cloudinary.uploader.upload(req.file.path, async (result)=> {
    
    const createUser = `INSERT nok
      (name,customerid,department,phone,date, imgurl)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    console.log(req.body)
    const values = [
    req.body.name,
    req.body.customerid,
    req.body.department,
    req.body.phone,
    moment(new Date()),
    urls[0] ?urls[0]:''
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
