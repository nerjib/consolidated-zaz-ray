
-- Add the new pricing column with JSONB type
ALTER TABLE ray_device_types ADD COLUMN pricing JSONB;

-- Update the new pricing column with data from the old amount column
-- This assumes the old amount was for a "one-time" payment plan
UPDATE ray_device_types SET pricing = jsonb_build_object('one-time', amount);

-- Remove the old amount column
ALTER TABLE ray_device_types DROP COLUMN amount;
