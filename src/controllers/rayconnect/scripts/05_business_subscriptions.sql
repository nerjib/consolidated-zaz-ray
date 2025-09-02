
-- Add columns to the businesses table for status and subscription management

ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active', -- e.g., active, suspended, deactivated
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50), -- e.g., monthly, yearly, free_tier
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50), -- e.g., active, past_due, canceled
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255); -- For future integration with payment gateways



-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_subscription_plan ON businesses(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_businesses_subscription_status ON businesses(subscription_status);

ALTER TABLE b2b_api_tokens ADD COLUMN IF NOT EXISTS token VARCHAR(250); -- token