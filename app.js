const express = require('express')
const http = require('http')
const dotenv = require('dotenv');
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const app = express();
// Ensure 'uploads' directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const multer = require('multer');
const cloudinary = require('cloudinary');
const moment = require('moment');

const Sites = require('./src/controllers/sites')
const Folders = require('./src/controllers/folders')
const Files = require('./src/controllers/files')
const Categories = require('./src/controllers/categories')
const Customer = require('./src/controllers/customer')
const Payments = require('./src/controllers/payments')
// const Orphund = require('./src/controllers/orphund')
const Excel = require('./src/controllers/excelupload')
const Tutorial = require('./src/controllers/tutorial.controller.js')
const Login = require('./src/controllers/auth/authsignin')
const Reports = require('./src/controllers/reports')
const Commerce = require('./src/controllers/commerce')
const Beauty = require('./src/controllers/beau.js')
const BeuLogin = require('./src/controllers/auth/beuSignIn.js')
const BeuSignUp = require('./src/controllers/auth/beuSignup.js')
const RayRoutes = require('./src/controllers/rayconnect/rayroute.js')
const RefundRoutes = require('./src/controllers/zazzau/routes/refunds.js')



const AddProfilePic = require('./src/controllers/addProfilePic')
const AddIncidentReport = require('./src/controllers/addReport')
const AddBeuProducts = require('./src/controllers/beauAddProducts.js')


const db = require("./models");



const Authsignin = require('./src/controllers/auth/authsignin')





app.use(cors())

http.createServer(app);

//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.json({limit: '20mb'}));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));



app.use(express.static(path.join(__dirname, 'public')));


dotenv.config();


app.use(express.static(path.join(__dirname, 'public')));


const storage = multer.diskStorage({
    distination: function (req, file, cb) {
      cb(null, './src');
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  });
  cloudinary.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret,
  });
  const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/gif'||'image/png') {
      cb(null, true);
    }else if (
      file.mimetype.includes("excel") ||
      file.mimetype.includes("spreadsheetml")
    ) {
      cb(null, true);
    } else {
      cb(new Error('Wrong file type'), false);
    }
  };
  
  const upload = multer({
    storage,
    fileFilter,
  });
  

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
      res.headers('Access-Control-Allow-Methods', 'POST, PUT, GET, DELETE');
      return res.status(200).json({});
    }
    next();
  });
  
db.sequelize.sync()
  .then(() => {
    console.log("Synced db.>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<");
  })
  .catch((err) => {
    console.log("Failed to sync db:))))))))))))))))))) " + err.message);
  });

     
app.get('/', function(req,res){
res.json({
    m:'Welcome to zazzau'
})
})

app.use('/api/v1/sites', Sites)
app.use('/api/v1/folders', Folders)
app.use('/api/v1/files', Files)
app.use('/api/v1/categories', Categories)
app.use('/api/v1/customers', Customer)
app.use('/api/v1/payments', Payments)
app.use('/api/v1/reports', Reports)
app.use('/api/v1/auth/signin', Authsignin)
// app.use('/api/v1/orphund', Orphund)
app.use('/api/v1/excel', upload.single("file"), Excel)
app.use('/api/v1/tutorials', Tutorial)
app.use('/api/v1/commerce', Commerce)
app.use('/api/v1/login', Login)
app.use('/api/v1/beauty', Beauty)
app.use('/api/v1/beauty/login', BeuLogin);
app.use('/api/v1/beauty/signup', BeuSignUp);
app.use('/ray-services', RayRoutes)
app.use('/api/v1/refunds', RefundRoutes)



app.post('/api/v1/addprofile', upload.single('file'), (req, res) => {
  // console.log(req.body)
    cloudinary.uploader.upload(req.file.path, function (result) {
       console.log(result.secure_url)
      // res.send({imgurl:result.secure_url})
      AddProfilePic.addProfile(req,res,result.secure_url);
     },{ resource_type: "auto", public_id: `profile-img/${req.body.userid}` });
   });

   app.post('/api/v1/agilereport', upload.single('file'), (req, res) => {
    // console.log(req.body)
      cloudinary.uploader.upload(req.file.path, function (result) {
         console.log(result.secure_url)
        // res.send({imgurl:result.secure_url})
        AddIncidentReport.addReport(req,res,result.secure_url);
       },{ resource_type: "auto", public_id: `agile/${req.body.school}_${moment(req.body.date).unix()}` });
     });
  
    //  app.post('/api/v1/beauty/addproduct', upload.single('file'), (req, res) => {
    //   // console.log(req.body)
    //     cloudinary.uploader.upload(req.file.path, function (result) {
    //        console.log(result.secure_url)
    //       // res.send({imgurl:result.secure_url})
    //       AddBeuProducts.addProduct(req,res,result.secure_url);
    //      },{ resource_type: "auto", public_id: `beauty/${req.body.name}/${req.body.name}_${moment(new Date()).unix()}` });
    //    });
    app.post('/api/v1/beauty/addproduct', (req, res) => {
      // console.log(req.body)
       
          AddBeuProducts.addProduct(req,res,req.body.file);
       });
    
       app.put('/api/v1/beauty/updateproduct', upload.single('file'), (req, res) => {
        // console.log(req.body)
        if (req.file){
          cloudinary.uploader.upload(req.file.path, function (result) {
             console.log(result.secure_url)
            // res.send({imgurl:result.secure_url})
            AddBeuProducts.updateProduct(req,res,result.secure_url);
           },{ resource_type: "auto", public_id: `beauty/${req.body.name}/${req.body.name}_${moment(new Date()).unix()}` });
        } else {
          AddBeuProducts.updateProduct(req,res,req.body.imgurl);
        }
         });
    

   app.post('/api/v1/updateprofile', upload.single('file'), (req, res) => {
    // console.log(req.body)
      cloudinary.uploader.upload(req.file.path, function (result) {
         console.log(result.secure_url)
        // res.send({imgurl:result.secure_url})
        AddProfilePic.updateProfile(req,res,result.secure_url);
       },{ resource_type: "auto", public_id: `profile-img/${req.body.userid}` });
     });
  








// ussd feedback


    
module.exports = app;