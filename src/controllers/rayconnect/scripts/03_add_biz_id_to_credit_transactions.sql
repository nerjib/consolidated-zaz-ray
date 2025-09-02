
-- Add business_id to ray_credit_transactions to scope credit operations to a business
ALTER TABLE ray_credit_transactions ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ray_credit_transactions_business_id ON ray_credit_transactions(business_id);
