-- This script creates a table to log the history of device status changes for auditing purposes.

CREATE TABLE IF NOT EXISTS ray_device_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES ray_devices(id) ON DELETE CASCADE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    changed_by UUID REFERENCES ray_users(id) ON DELETE SET NULL, -- The admin who made the change
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    reason TEXT, -- e.g., 'End of Loan', 'Customer Return', 'Repaired'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ray_loans ADD COLUMN IF NOT EXISTS customer_geocode TEXT;
ALTER TABLE ray_loans ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE ray_loans ADD COLUMN IF NOT EXISTS device_return_date TIMESTAMP WITH TIME ZONE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_history_device_id ON ray_device_history(device_id);
CREATE INDEX IF NOT EXISTS idx_device_history_business_id ON ray_device_history(business_id);
