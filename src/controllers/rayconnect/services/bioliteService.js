const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const BIOLITE_API_URL = process.env.BIOLITE_API_URL;

/**
 * Authenticates with the BioLite API to obtain an access token using per-business credentials.
 * @param {object} credentials - The decrypted credentials for the business.
 * @returns {Promise<string>} The BioLite access token.
 * @throws {Error} If authentication with BioLite API fails.
 */
const getBioliteAccessToken = async (credentials) => {
  if (!credentials || !credentials.biolite_client_key || !credentials.biolite_private_key || !credentials.biolite_public_key) {
    throw new Error('BioLite credentials are not fully configured for this business.');
  }

  try {
    const payload = {
      iss: credentials.biolite_client_key,
      iat: Math.floor(Date.now() / 1000),
      jti: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      sub: credentials.biolite_public_key,
    };

    const token = jwt.sign(payload, credentials.biolite_private_key, { algorithm: 'ES256' });

    const response = await axios.post(`${BIOLITE_API_URL}/auth`, {
      token: token,
      tokenType: 'auth',
    });

    return response.data; // Returns the access token object
  } catch (error) {
    console.error('Error getting BioLite access token:', error.response ? error.response.data : error.message);
    throw new Error('Failed to authenticate with BioLite API');
  }
};

/**
 * Generates an activation code using the BioLite API.
 * @param {string} serialNum - The serial number of the BioLite product.
 * @param {string} codeType - The type of code to generate (e.g., 'add_time').
 * @param {number} arg - The argument for the code type (e.g., number of days).
 * @param {object} credentials - The decrypted credentials for the business.
 * @returns {Promise<object>} The response data from the BioLite API.
 * @throws {Error} If code generation fails.
 */
const generateBioliteCode = async (serialNum, codeType, arg, credentials) => {
  try {
    const accessTokenData = await getBioliteAccessToken(credentials);
    
    const response = await axios.post(`${BIOLITE_API_URL}/codes`, {
      serialNum: Number(serialNum),
      codeType,
      arg
    }, {
      headers: {
        'Authorization': `Bearer ${accessTokenData.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error generating BioLite code:', error.response ? error.response.data : error.message);
    throw new Error('Failed to generate BioLite code');
  }
};


module.exports = {
  generateBioliteCode,
};
