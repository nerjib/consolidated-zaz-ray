
-- Add business_id to ray_settings to allow for per-business settings
ALTER TABLE ray_settings ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

-- Drop the old unique constraint on setting_key as it will be replaced.
ALTER TABLE ray_settings DROP CONSTRAINT IF EXISTS ray_settings_setting_key_key;

-- Create a new composite unique constraint on (business_id, setting_key).
-- This ensures a setting key is unique within a specific business, but different businesses can have the same setting key.
ALTER TABLE ray_settings DROP CONSTRAINT IF EXISTS unique_business_setting;
ALTER TABLE ray_settings ADD CONSTRAINT unique_business_setting UNIQUE (business_id, setting_key);

-- Create an index for faster lookups on the new business_id column.
CREATE INDEX IF NOT EXISTS idx_ray_settings_business_id ON ray_settings(business_id);
