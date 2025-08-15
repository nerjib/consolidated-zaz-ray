
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  user: process.env.DB_USER || 'user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'bexpay_db',
  password: process.env.DB_PASSWORD || '    ',
  port: process.env.DB_PORT || 5432,
});

const query = (text, params) => pool.query(text, params);

const addPaymentFrequencyToLoans = async () => {
  try {
    await query(`
      ALTER TABLE ray_loans
      ADD COLUMN payment_frequency VARCHAR(10) DEFAULT 'monthly',
      ADD COLUMN payment_cycle_amount NUMERIC(10, 2)
    `);
    console.log('Successfully added payment_frequency and payment_cycle_amount to ray_loans table.');
  } catch (err) {
    console.error('Error adding columns to ray_loans table:', err);
  }
};

addPaymentFrequencyToLoans();
