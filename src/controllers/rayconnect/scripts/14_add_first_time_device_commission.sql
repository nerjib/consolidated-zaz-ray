CREATE TABLE IF NOT EXISTS first_time_commission_settings (
    business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    commission_amount DECIMAL(10, 2) NOT NULL
);

ALTER TABLE ray_devices
ADD COLUMN IF NOT EXISTS first_time_commission_paid BOOLEAN DEFAULT FALSE;
