require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const { createDedicatedAccount } = require('../services/paystackService');
const { createDedicatedAccountForUser } = require('../services/paystackService');

const pool = new Pool({
  user: process.env.DB_USER || 'user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'zazzau_db',
  password: process.env.DB_PASSWORD || '    ',
  port: process.env.DB_PORT || 5432,
});

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false
//   }
// });
const query = (text, params) => pool.query(text, params);

// Delay function to avoid hitting API rate limits
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function backfillLoanAccounts() {
  console.log('Starting backfill for existing loans...');
  const loansResult = await query('SELECT * FROM ray_loans WHERE paystack_dedicated_account_number IS NULL');
  const loans = loansResult.rows;

  if (loans.length === 0) {
    console.log('No loans found that need a dedicated account.');
    return;
  }

  console.log(`Found ${loans.length} loans to process.`);

  for (const [index, loan] of loans.entries()) {
    try {
      console.log(`Processing loan ${index + 1}/${loans.length} (ID: ${loan.id})...`);

      const customerResult = await query('SELECT * FROM ray_users WHERE id = $1', [loan.customer_id]);
      const businessResult = await query('SELECT * FROM businesses WHERE id = $1', [loan.business_id]);

      if (customerResult.rows.length > 0 && businessResult.rows.length > 0) {
        await createDedicatedAccount(loan, customerResult.rows[0], businessResult.rows[0]);
      } else {
        console.error(`Could not find customer or business for loan ${loan.id}. Skipping.`);
      }

      await delay(500); // 0.5 second delay between API calls
    } catch (err) {
      console.error(`An error occurred while processing loan ${loan.id}:`, err.message);
    }
  }

  console.log('Loan backfill process complete.');
}

async function backfillUserAccounts() {
  console.log('Starting backfill for existing agents and super-agents...');
  const usersResult = await query("SELECT * FROM ray_users WHERE role IN ('agent', 'super-agent') AND paystack_dedicated_account_number IS NULL");
  const users = usersResult.rows;

  if (users.length === 0) {
    console.log('No agents or super-agents found that need a dedicated account.');
    return;
  }

  console.log(`Found ${users.length} users to process.`);

  for (const [index, user] of users.entries()) {
    try {
      console.log(`Processing user ${index + 1}/${users.length} (ID: ${user.id})...`);

      if (!user.business_id) {
        console.warn(`User ${user.id} is not associated with a business. Skipping.`);
        continue;
      }

      const businessResult = await query('SELECT * FROM businesses WHERE id = $1', [user.business_id]);

      if (businessResult.rows.length > 0) {
        await createDedicatedAccountForUser(user, businessResult.rows[0]);
      } else {
        console.error(`Could not find business for user ${user.id}. Skipping.`);
      }

      await delay(500); // 0.5 second delay between API calls
    } catch (err) {
      console.error(`An error occurred while processing user ${user.id}:`, err.message);
    }
  }

  console.log('User backfill process complete.');
}

async function main() {
  try {
    await backfillLoanAccounts();
    await backfillUserAccounts();
  } catch (err) {
    console.error('The backfill script encountered a fatal error:', err);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

main();
