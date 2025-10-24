const axios = require('axios');
const { getBusinessCredentials } = require('./utils');
const { query } = require('../config/database');

const PAYSTACK_API_URL = 'https://api.paystack.co';

/**
 * Creates a Paystack Subaccount for a business.
 * This requires the business to have bank details stored.
 * @param {object} business - The business object from the database.
 * @returns {Promise<string>} The Paystack subaccount code.
 */
const createSubaccount = async (business) => {
  const credentials = await getBusinessCredentials(business.id);
  if (!credentials || !credentials.paystack_secret_key) {
    throw new Error('Paystack secret key is not configured for this business.');
  }

  if (!business.bank_code || !business.account_number) {
      throw new Error('Business bank code and account number are required to create a subaccount.');
  }

  try {
    const response = await axios.post(
      `${PAYSTACK_API_URL}/subaccount`,
      {
        business_name: business.name,
        settlement_bank: business.bank_code,
        account_number: business.account_number,
        percentage_charge: process.env.PAYSTACK_PLATFORM_FEE || 1.5,
      },
      {
        headers: {
          Authorization: `Bearer ${credentials.paystack_secret_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const subaccount_code = response.data.data.subaccount_code;
    await query('UPDATE businesses SET paystack_subaccount_code = $1 WHERE id = $2', [subaccount_code, business.id]);
    return subaccount_code;
  } catch (error) {
    console.error('Paystack error creating subaccount:', error.response ? error.response.data : error.message);
    throw new Error('Failed to create Paystack subaccount.');
  }
};

/**
 * Creates a Dedicated Virtual Account for a loan.
 * @param {object} loan - The loan object from the database.
 * @param {object} customer - The customer user object.
 * @param {object} business - The business object.
 */
const createDedicatedAccount = async (loan, customer, business) => {
  const credentials = await getBusinessCredentials(business.id);
  console.log({credentials})
  if (!credentials || !credentials.paystack_secret_key) {
    console.error(`Paystack is not configured for business ${business.id}. Cannot create dedicated account.`);
    return;
  }

  let subaccount_code = business.paystack_subaccount_code;
  if (!subaccount_code) {
    console.warn(`Business ${business.id} does not have a Paystack subaccount code. Payments will be routed to the main account.`);
  }

  try {
    const customerPayload = customer.paystack_customer_code || {
      email: `${loan.id}@raykonet.com`,
      first_name: customer.name ? business?.name.split(' ')[0] + '-' +customer.name.split(' ')[0] : business?.name.split(' ')[0] + '-' +customer.username,
      last_name: customer.name ? customer.name.split(' ').slice(1).join(' ') || customer.name.split(' ')[0] : customer.username,
      phone: customer.phone_number,
    };

    const response = await axios.post(
      `${PAYSTACK_API_URL}/dedicated_account/assign`,
      {
        ...customerPayload,
        preferred_bank: 'test-bank',
        subaccount: subaccount_code,
        metadata: {
            loan_id: loan.id,
            business_id: business.id,
            type: 'loan_account'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${credentials.paystack_secret_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const account = response.data.data;
    if (account && account.account_number) {
      await query(
        'UPDATE ray_loans SET paystack_dedicated_account_number = $1, paystack_dedicated_bank_name = $2, paystack_dedicated_account_name = $3 WHERE id = $4',
        [account.account_number, account.bank.name, account.account_name, loan.id]
      );

      if (account.customer && account.customer.customer_code && !customer.paystack_customer_code) {
        await query(
          'UPDATE ray_users SET paystack_customer_code = $1 WHERE id = $2',
          [account.customer.customer_code, customer.id]
        );
      }
      console.log(`Created dedicated account ${account.account_number} for loan ${loan.id}`);
    }
  } catch (error) {
    console.error(`Paystack error creating dedicated account for loan ${loan.id}:`, error.response ? error.response.data : error.message);
  }
};

const createDedicatedAccountForUser = async (user, business) => {
  const credentials = await getBusinessCredentials(business.id);
  if (!credentials || !credentials.paystack_secret_key) {
    console.error(`Paystack is not configured for business ${business.id}. Cannot create dedicated account for user.`);
    return;
  }

  try {
    const customerPayload = user.paystack_customer_code || {
      email: `${user.id}@raykonet.com`,
      first_name: user.name ? business?.name.split(' ')[0] + '-' +user.name.split(' ')[0] : business?.name.split(' ')[0] + '-' +user.username,
      last_name: user.name ? user.name.split(' ').slice(1).join(' ') || user.name.split(' ')[0] : user.username,
      phone: user.phone_number,
    };
    // console.log({...customerPayload, ...business, pay: business.paystack_subaccount_code,})
    const response = await axios.post(
      `${PAYSTACK_API_URL}/dedicated_account/assign`,
      {
        ...customerPayload,
        preferred_bank: 'test-bank',
        subaccount: business.paystack_subaccount_code,
        metadata: {
            user_id: user.id,
            business_id: business.id,
            type: 'agent_credit_topup'
        }
      },
      {
        headers: {
          Authorization: `Bearer ${credentials.paystack_secret_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const account = response.data.data;
    if (account && account.account_number) {
      await query(
        'UPDATE ray_users SET paystack_dedicated_account_number = $1, paystack_dedicated_bank_name = $2, paystack_dedicated_account_name = $3 WHERE id = $4',
        [account.account_number, account.bank.name, account.account_name, user.id]
      );

      if (account.customer && account.customer.customer_code && !user.paystack_customer_code) {
        await query(
          'UPDATE ray_users SET paystack_customer_code = $1 WHERE id = $2',
          [account.customer.customer_code, user.id]
        );
      }
      console.log(`Created dedicated account ${account.account_number} for user ${user.id}`);
    }
  } catch (error) {
    console.error(`Paystack error creating dedicated account for user ${user.id}:`, error.response ? error.response.data : error.message);
  }
};

module.exports = {
  createSubaccount,
  createDedicatedAccount,
  createDedicatedAccountForUser,
};