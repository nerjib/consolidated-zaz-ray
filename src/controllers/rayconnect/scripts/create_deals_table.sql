
CREATE TABLE IF NOT EXISTS ray_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_name VARCHAR(255) NOT NULL,
    device_type_id UUID REFERENCES ray_device_types(id) ON DELETE CASCADE NOT NULL,
    allowed_payment_frequencies JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g., ["monthly", "weekly"]
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add a trigger to update the updated_at timestamp for ray_deals
CREATE OR REPLACE FUNCTION update_updated_at_column_deals()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;n 
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_timestamp_deals ON ray_deals;
CREATE TRIGGER set_timestamp_deals
BEFORE UPDATE ON ray_deals
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column_deals();
