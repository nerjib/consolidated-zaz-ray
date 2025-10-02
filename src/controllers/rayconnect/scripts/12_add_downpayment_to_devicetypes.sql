ALTER TABLE ray_device_types ADD COLUMN IF NOT EXISTS default_down_payment DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE ray_device_types ADD COLUMN IF NOT EXISTS token_validity_days INTEGER;
