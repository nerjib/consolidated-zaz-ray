const axios = require('axios');
const crypto = require('crypto');

// Configuration
// const API_URL = 'http://activecodes.beebeejump.com:8889/api/bbj/activecode/getActiceCode'; // Replace with actual API URL
// const API_KEY = '9c9397471c9862dc8ab31ff6427e5e51';
// const API_SECRET = 'dc62557e092268e136fdfd074f9b4893';
const API_URL = 'http://beximak.beebeejump.com/api/bbj/activecode/getActiceCode'; // Replace with actual API URL
const API_KEY = 'ce4691fcdc9b2a1c';
const API_SECRET = 'b893a32469ddbb7e1638fe08e2ed47e9';
const IV = 'hamiton202506162'; // Initialization vector
const KEY = 'd25ccecd7ee2b847a41c5259fafbced1'; // Secret key

// AES Encryption/Decryption Utility
class AESCipher {
  constructor(key, iv) {
    // Key is 32 bytes for AES-256.
    this.key = Buffer.from(key, 'utf-8');
    // IV must be 16 bytes for cbc
    this.iv = Buffer.from(iv, 'utf-8').slice(0, 16);
  }

  // Encrypt the text
  encrypt(text) {
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
    let encrypted = cipher.update(text, 'utf-8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  // Decrypt the encrypted text
  decrypt(encryptedText) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
      let decrypted = decipher.update(encryptedText, 'base64', 'utf-8');
      decrypted += decipher.final('utf-8');
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error.message);
      return null;
    }
  }
}

// Function to request activation code
async function getActivationCode(sn, day) {
  const payload = {
    sn: sn,
    day: day,
    apiKey: API_KEY,
    apiSecret: API_SECRET
  };

  try {
    const response = await axios.post(API_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    // console.log({response})
    const { returnCode, returnMessage, data } = response.data;

    if (returnCode === 0 && data && data.encrypt) {
      const aes = new AESCipher(KEY, IV);
      const decryptedCode = aes.decrypt(data.encrypt);
      return {
        returnCode,
        returnMessage,
        data: {
          sn: data.sn,
          days: data.days,
          activationCode: decryptedCode,
          yearOfUse: data.yearOfUse,
          conversionCode: data.conversionCode
        }
      };
    } else {
      return {
        returnCode,
        returnMessage,
        data: null
      };
    }
  } catch (error) {
    console.error('API request error:', error.message);
    return {
      returnCode: 4,
      returnMessage: 'Request failed: ' + error.message,
      data: null
    };
  }
}
// async function main() {
//   const sn = '01-01-00127779';
//   const day = '7Days';

//   // Test encryption
//   const aes = new AESCipher(KEY, IV);
//   const testText = 'beebeejump!';
//   const encrypted = aes.encrypt(testText);
//   console.log('Encrypted:', encrypted);
//   const decrypted = aes.decrypt(encrypted);
//   console.log('Decrypted:', decrypted);

//   // Test API request
//   const result = await getActivationCode(sn, day);
//   console.log('API Response:', result);
// }
module.exports = {
  getActivationCode,
};