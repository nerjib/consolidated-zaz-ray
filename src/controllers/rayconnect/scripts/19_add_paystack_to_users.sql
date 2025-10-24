-- Add columns to store Paystack Dedicated Virtual Account details for users (agents/super-agents)
ALTER TABLE ray_users
ADD COLUMN IF NOT EXISTS paystack_dedicated_account_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS paystack_dedicated_bank_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS paystack_dedicated_account_name VARCHAR(255);

-- Add an index for faster lookups on the account number
CREATE INDEX IF NOT EXISTS idx_ray_users_paystack_dedicated_account_number ON ray_users(paystack_dedicated_account_number);
