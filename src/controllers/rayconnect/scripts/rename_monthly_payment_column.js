
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'bexpay_db',
  password: process.env.DB_PASSWORD || '    ',
  port: process.env.DB_PORT || 5432,
});

const renameMonthlyPaymentColumn = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE ray_loans
      RENAME COLUMN monthly_payment TO payment_amount_per_cycle;
    `);
    console.log('Successfully renamed monthly_payment to payment_amount_per_cycle in ray_loans table.');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error renaming column:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
};

renameMonthlyPaymentColumn();
