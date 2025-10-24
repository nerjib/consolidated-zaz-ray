-- Add column to store Paystack Subaccount code for each business
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS paystack_subaccount_code VARCHAR(255);

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_businesses_paystack_subaccount_code ON businesses(paystack_subaccount_code);
