const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();


// Ensure these environment variables are set in your .env file
const BIOLITE_API_URL = process.env.BIOLITE_API_URL;
const BIOLITE_CLIENT_KEY = process.env.BIOLITE_CLIENT_KEY;
const BIOLITE_PRIVATE_KEY = process.env.BIOLITE_PRIVATE_KEY;
const BIOLITE_PUBLIC_KEY = process.env.BIOLITE_PUBLIC_KEY; // This is the 'sub' claim in the JWT

let bioliteAccessToken = null;
let tokenExpiryTime = 0; // Timestamp when the token expires

/**
 * Authenticates with the BioLite API to obtain an access token.
 * Caches the token and reuses it until it expires.
 * @returns {Promise<string>} The BioLite access token.
 * @throws {Error} If authentication with BioLite API fails.
 */
const getBioliteAccessToken = async () => {
  // Return cached token if it's still valid
  // if (bioliteAccessToken && Date.now() < tokenExpiryTime) {
  //   console.log('Reusing cached BioLite access token.', bioliteAccessToken);
  //   return bioliteAccessToken;
  // }

  try {
    // JWT payload for BioLite authentication
    // const authJwtPayload = {
    //   iss: BIOLITE_CLIENT_KEY, // Client key provided by BioLite
    //   iat: Math.floor(Date.now() / 1000), // Issued at timestamp (seconds since epoch)
    //   jti: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), // Unique ID
    //   sub: BIOLITE_PUBLIC_KEY, // Public key registered with BioLite
    // };

    // // Sign the JWT with your private key using ES256 algorithm
    // const signedAuthJwt = jwt.sign(authJwtPayload, BIOLITE_PRIVATE_KEY, { algorithm: 'ES256' });
    // console.log('Signed BioLite authentication JWT:', signedAuthJwt);

    //  Token payload
    const payload = {
      iss: BIOLITE_CLIENT_KEY, // Client key provided by BioLite
      iat: Math.floor(Date.now() / 1000), // Issued at timestamp (seconds since epoch)
      jti: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), // Unique ID
      sub: BIOLITE_PUBLIC_KEY
    };
    // Sign the token
    const token = jwt.sign(payload, BIOLITE_PRIVATE_KEY, { algorithm: 'ES256' });
    
    console.log('Generated JWT token:');
    console.log(token);
    
    
    // Make the authentication request to BioLite API
    const response = await axios.post(`${BIOLITE_API_URL}/auth`, {
      token: token,
      tokenType: 'auth',
    });

    bioliteAccessToken = response.data;
    tokenExpiryTime = Date.now() + (55 * 60 * 1000);
    console.log('Received new BioLite access token.', bioliteAccessToken);
    return bioliteAccessToken;
  } catch (error) {
    console.log({error})
    console.error('Error getting BioLite access token:', error.response ? error.response.data : error.message);
    throw new Error('Failed to authenticate with BioLite API');
  }
};

/**
 * Generates an activation code using the BioLite API.
 * @param {string} serialNum - The serial number of the BioLite product.
 * @param {string} codeType - The type of code to generate (e.g., 'add_time', 'set_time').
 * @param {number} arg - The argument for the code type (e.g., number of days for 'add_time').
 * @returns {Promise<object>} The response data from the BioLite API, including the generated code.
 * @throws {Error} If code generation fails.
 */
const generateBioliteCode = async (serialNum, codeType, arg) => {
  try {
    const accessToken = await getBioliteAccessToken();

    const response = await axios.post(`${BIOLITE_API_URL}/codes`, {
      serialNum,
      codeType,
      arg,
      data: 1
    }, {
      headers: {
        Authorization: accessToken,
        'Content-Type': 'application/json',
      },
    });

    return response.data; // the generated code and other details
  } catch (error) {
    console.error('Error generating BioLite code:', error.response ? error.response.data : error.message);
    throw new Error('Failed to generate BioLite code');
  }
};

module.exports = {
  generateBioliteCode,
};
