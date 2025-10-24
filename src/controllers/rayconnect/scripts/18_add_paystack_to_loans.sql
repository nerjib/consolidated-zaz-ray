-- Add columns to store Paystack Dedicated Virtual Account details for each loan
ALTER TABLE ray_loans
ADD COLUMN IF NOT EXISTS paystack_dedicated_account_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS paystack_dedicated_bank_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS paystack_dedicated_account_name VARCHAR(255);

-- Add an index for faster lookups on the account number
CREATE INDEX IF NOT EXISTS idx_ray_loans_paystack_dedicated_account_number ON ray_loans(paystack_dedicated_account_number);
