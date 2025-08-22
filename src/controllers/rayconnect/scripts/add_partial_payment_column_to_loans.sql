
-- Add current_cycle_accumulated_payment column to ray_loans table
ALTER TABLE ray_loans ADD COLUMN current_cycle_accumulated_payment DECIMAL(10, 2) DEFAULT 0.00;
