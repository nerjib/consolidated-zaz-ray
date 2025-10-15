

const {getActivationCode} = require('../services/beebeeService');

// Example usage
const sn = '01-01-00144646'; // Serial number
const day = 30; // Number of days for the activation code

const getBebe = async() =>{
  try {
const beebeeResponse =  await  getActivationCode(sn, `${day}Days`);
               console.log({beebeeResponse})
                console.log('Generated Token:', beebeeResponse?.data?.activationCode);
  } catch(e){
    console.log(e)
  }
}

getBebe();