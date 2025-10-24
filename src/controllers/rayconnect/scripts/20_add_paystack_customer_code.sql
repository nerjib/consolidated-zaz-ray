-- Add column to store the Paystack Customer Code for each user
ALTER TABLE ray_users
ADD COLUMN IF NOT EXISTS paystack_customer_code VARCHAR(255);

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ray_users_paystack_customer_code ON ray_users(paystack_customer_code);
