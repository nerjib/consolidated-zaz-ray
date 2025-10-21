

const {getActivationCode} = require('../services/beebeeService');

// Example usage
const sn = '01-01-00147001'; // Serial number
const day = 30; // Number of days for the activation code

const getBebe = async() =>{
  try {
const beebeeResponse =  await  getActivationCode(sn, `ForeverCode`);
               console.log({beebeeResponse})
                console.log('Generated Token:', beebeeResponse?.data?.activationCode);
  } catch(e){
    console.log(e)
  }
}

getBebe();