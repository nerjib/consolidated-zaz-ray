
const { query } = require('../config/database');
// const { decrypt } = require('./encryptionService');

/**
 * Retrieves and decrypts the credentials for a given business.
 * @param {string} business_id - The UUID of the business.
 * @returns {object | null} An object containing the decrypted credentials, or null if not found.
 */
async function getBusinessCredentials(business_id) {

  return {
    paystack_secret_key: process.env.PAYSTACK_SECRET_KEY,
    paystack_public_key: process.env.PAYSTACK_PUBLIC_KEY,
    africastalking_api_key: process.env.africastalking_api_key,
    africastalking_username: process.env.username,
    biolite_client_key: process.env.biolite_client_key,
    biolite_private_key: process.env.biolite_private_key,
    biolite_public_key: process.env.biolite_public_key,
  };

  //this will later be implemented per business
  if (!business_id) {
    return null;
  }

  try {
    const result = await query(
      'SELECT * FROM businesses WHERE id = $1',
      [business_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const business = result.rows[0];

    // return {
    //   paystack_secret_key: decrypt(business.paystack_secret_key_encrypted),
    //   paystack_public_key: decrypt(business.paystack_public_key_encrypted),
    //   africastalking_api_key: decrypt(business.africastalking_api_key_encrypted),
    //   africastalking_username: decrypt(business.africastalking_username_encrypted),
    //   biolite_client_key: decrypt(business.biolite_client_key_encrypted),
    //   biolite_private_key: decrypt(business.biolite_private_key_encrypted),
    //   biolite_public_key: decrypt(business.biolite_public_key_encrypted),
    // };
  } catch (error) {
    console.error('Failed to get or decrypt business credentials:', error);
    return null;
  }
}

module.exports = { getBusinessCredentials };
