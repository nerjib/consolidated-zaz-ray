-- This script sets up the necessary database schema changes for multi-tenancy.

-- Step 1: Create the businesses table to store tenant information and encrypted credentials.
-- This table will hold information about each business (tenant) on the platform.
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES ray_users(id) ON DELETE SET NULL,
    
    -- Encrypted credentials for third-party services
    paystack_secret_key_encrypted TEXT,
    paystack_public_key_encrypted TEXT,
    africastalking_api_key_encrypted TEXT,
    africastalking_username_encrypted TEXT,
    biolite_client_key_encrypted TEXT,
    biolite_private_key_encrypted TEXT,
    biolite_public_key_encrypted TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add a trigger to automatically update the updated_at timestamp for the businesses table.
CREATE OR REPLACE FUNCTION update_updated_at_column_businesses()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_timestamp_businesses ON businesses;
CREATE TRIGGER set_timestamp_businesses
BEFORE UPDATE ON businesses
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column_businesses();


-- Step 2: Add business_id to all relevant tables to scope data to a specific tenant.
-- This is the core of the data isolation strategy.
ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ray_devices ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ray_device_types ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ray_loans ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ray_payments ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ray_commissions ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ray_super_agent_commissions ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ray_tokens ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ray_deals ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ray_agent_withdrawals ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE ray_super_agent_withdrawals ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;


-- Step 3: Create indexes on the new business_id columns for performance.
-- This will speed up queries that filter by business_id.
CREATE INDEX IF NOT EXISTS idx_ray_users_business_id ON ray_users(business_id);
CREATE INDEX IF NOT EXISTS idx_ray_devices_business_id ON ray_devices(business_id);
CREATE INDEX IF NOT EXISTS idx_ray_device_types_business_id ON ray_device_types(business_id);
CREATE INDEX IF NOT EXISTS idx_ray_loans_business_id ON ray_loans(business_id);
CREATE INDEX IF NOT EXISTS idx_ray_payments_business_id ON ray_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_ray_commissions_business_id ON ray_commissions(business_id);
CREATE INDEX IF NOT EXISTS idx_ray_super_agent_commissions_business_id ON ray_super_agent_commissions(business_id);
CREATE INDEX IF NOT EXISTS idx_ray_tokens_business_id ON ray_tokens(business_id);
CREATE INDEX IF NOT EXISTS idx_ray_deals_business_id ON ray_deals(business_id);
CREATE INDEX IF NOT EXISTS idx_ray_agent_withdrawals_business_id ON ray_agent_withdrawals(business_id);
CREATE INDEX IF NOT EXISTS idx_ray_super_agent_withdrawals_business_id ON ray_super_agent_withdrawals(business_id);

