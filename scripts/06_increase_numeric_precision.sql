-- This script increases the precision of various numeric columns to prevent overflow errors.
-- The error "numeric field overflow" for a NUMERIC(10, 2) column indicates that a value
-- has exceeded the maximum of 99,999,999.99.
-- We are changing these columns to NUMERIC(15, 2), which allows for values up to 999,999,999,999.99.

ALTER TABLE ray_users ALTER COLUMN commission_paid TYPE NUMERIC(15, 2);
ALTER TABLE ray_users ALTER COLUMN credit_balance TYPE NUMERIC(15, 2);

ALTER TABLE ray_devices ALTER COLUMN price TYPE NUMERIC(15, 2);

ALTER TABLE ray_loans ALTER COLUMN total_amount TYPE NUMERIC(15, 2);
ALTER TABLE ray_loans ALTER COLUMN amount_paid TYPE NUMERIC(15, 2);
ALTER TABLE ray_loans ALTER COLUMN balance TYPE NUMERIC(15, 2);
ALTER TABLE ray_loans ALTER COLUMN payment_amount_per_cycle TYPE NUMERIC(15, 2);
ALTER TABLE ray_loans ALTER COLUMN down_payment TYPE NUMERIC(15, 2);
ALTER TABLE ray_loans ALTER COLUMN current_cycle_accumulated_payment TYPE NUMERIC(15, 2);
ALTER TABLE ray_loans ALTER COLUMN payment_cycle_amount TYPE NUMERIC(15, 2);

ALTER TABLE ray_payments ALTER COLUMN amount TYPE NUMERIC(15, 2);

ALTER TABLE ray_commissions ALTER COLUMN amount TYPE NUMERIC(15, 2);

ALTER TABLE ray_super_agent_commissions ALTER COLUMN amount TYPE NUMERIC(15, 2);

ALTER TABLE ray_agent_withdrawals ALTER COLUMN amount TYPE NUMERIC(15, 2);

ALTER TABLE ray_super_agent_withdrawals ALTER COLUMN amount TYPE NUMERIC(15, 2);

ALTER TABLE ray_credit_transactions ALTER COLUMN amount TYPE NUMERIC(15, 2);
ALTER TABLE ray_credit_transactions ALTER COLUMN new_balance TYPE NUMERIC(15, 2);
