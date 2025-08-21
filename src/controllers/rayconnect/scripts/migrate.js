require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'bexpay_db',
  password: process.env.DB_PASSWORD || '    ',
  port: process.env.DB_PORT || 5432,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Starting database migration...');

    // Users table (for Admin, Agents, Customers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ray_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        role VARCHAR(50) NOT NULL, -- 'admin', 'agent', 'customer'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        commission_rate DECIMAL(5, 2) DEFAULT 0.00, -- For agents
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        super_agent_id UUID REFERENCES ray_users(id) ON DELETE SET NULL
      );
    `);
    // Devices table
   console.log('Table "ray_devices" created or already exists.');

    // Payments table
   // table (for tracking device ray_loans/payment plans)
   
    // Device Types table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ray_device_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_name VARCHAR(255) NOT NULL,
        manufacturer VARCHAR(255),
        device_model VARCHAR(255) UNIQUE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "ray_device_types" created or already exists.');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ray_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        serial_number VARCHAR(255) UNIQUE NOT NULL,
        model VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'available', -- 'available', 'assigned', 'faulty', 'pending_approval'
        assigned_to UUID REFERENCES ray_users(id) ON DELETE SET NULL, -- Customer ID
        assigned_by UUID REFERENCES ray_users(id) ON DELETE SET NULL, -- Agent ID
        price DECIMAL(10, 2), -- Price of the device
        device_type_id UUID REFERENCES ray_device_types(id) ON DELETE SET NULL, -- New column for device type
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ray_loans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NOT NULL,
        device_id UUID REFERENCES ray_devices(id) ON DELETE CASCADE NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        amount_paid DECIMAL(10, 2) DEFAULT 0.00,
        balance DECIMAL(10, 2) NOT NULL,
        start_date DATE DEFAULT CURRENT_DATE,
        end_date DATE,
        status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'defaulted'
        term_months INTEGER, -- Term of the loan in months
        payment_amount_per_cycle DECIMAL(10, 2), -- Calculated payment per cycle
        down_payment DECIMAL(10, 2) DEFAULT 0.00, -- Down payment made by customer
        next_payment_date DATE,
        guarantor_details JSONB, -- Store guarantor information as JSON
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "ray_loans" created or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ray_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NOT NULL, -- Customer ID
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        payment_method VARCHAR(50), -- 'manual', 'paystack'
        transaction_id VARCHAR(255) UNIQUE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
        payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        loan_id UUID REFERENCES ray_loans(id) ON DELETE SET NULL, -- New column for loan ID
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "ray_payments" created or already exists.');

    // Loans 
    // Commissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ray_commissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NOT NULL,
        customer_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NOT NULL,
        payment_id UUID REFERENCES ray_payments(id) ON DELETE CASCADE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        commission_percentage DECIMAL(5, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "ray_commissions" created or already exists.');

    
    // Tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ray_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NOT NULL,
        token VARCHAR(255) NOT NULL,
        payment_id UUID REFERENCES ray_payments(id) ON DELETE CASCADE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "ray_tokens" created or already exists.');


    // Add new columns to ray_users table if they don't exist
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS state VARCHAR(255);`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS city VARCHAR(255);`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS address TEXT;`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS landmark TEXT;`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS gps VARCHAR(255);`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP;`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS status VARCHAR(50);`);
    await client.query(`ALTER TABLE ray_payments ADD COLUMN IF NOT EXISTS loan_id UUID REFERENCES ray_loans(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE ray_devices ADD COLUMN IF NOT EXISTS device_type_id UUID REFERENCES ray_device_types(id) ON DELETE SET NULL;`);

    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS last_withdrawal_date TIMESTAMP WITH TIME ZONE;`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS commission_paid DECIMAL(10, 2) DEFAULT 0.00;`);
    await client.query(`ALTER TABLE ray_loans ADD COLUMN IF NOT EXISTS agent_id UUID;`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS id_number varchar(255);`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS credit_score varchar(255);`);


    // Agent Withdrawals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ray_agent_withdrawals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        withdrawal_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        transaction_id VARCHAR(255) UNIQUE
      );
    `);
    console.log('Table "ray_agent_withdrawals" created or already exists.');

    // Super Agent Withdrawals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ray_super_agent_withdrawals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        super_agent_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        withdrawal_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        transaction_id VARCHAR(255) UNIQUE
      );
    `);
    console.log('Table "ray_super_agent_withdrawals" created or already exists.');
   
    await client.query(`ALTER TABLE ray_devices ADD COLUMN IF NOT EXISTS  customer_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NULL;`);
    await client.query(`ALTER TABLE ray_devices ADD COLUMN IF NOT EXISTS  install_date TIMESTAMP NULL;`);
     await client.query(`ALTER TABLE ray_payments ADD COLUMN IF NOT EXISTS  loan_id UUID REFERENCES ray_loans(id) ON DELETE SET NULL;`)
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS super_agent_id UUID REFERENCES ray_users(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS super_commission_rate DECIMAL(5, 2);`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS name varchar(256);`);
    await client.query(`ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES ray_users(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE ray_devices ADD COLUMN IF NOT EXISTS super_agent_id UUID REFERENCES ray_users(id) ON DELETE SET NULL;`);

    // Super Agent Commissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ray_super_agent_commissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        super_agent_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NOT NULL,
        agent_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NOT NULL,
        original_commission_id UUID REFERENCES ray_commissions(id) ON DELETE CASCADE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        commission_percentage DECIMAL(5, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "ray_super_agent_commissions" created or already exists.');

    // Run additional migration scripts
    const migrationsDir = path.join(__dirname, '.');
    const migrationFiles = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql'));

    for (const file of migrationFiles) {
      console.log(`Running migration script: ${file}`);
      const script = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(script);
    }

    await client.query('COMMIT');
    console.log('Database migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
