 ALTER TABLE ray_loans
      RENAME COLUMN monthly_payment TO payment_amount_per_cycle;

CREATE TABLE IF NOT EXISTS ray_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    
INSERT INTO ray_settings (setting_key, setting_value)
      VALUES
        ('general_agent_commission_rate', '5'),
        ('general_super_agent_commission_rate', '2')
      ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

 DROP TRIGGER IF EXISTS set_timestamp ON ray_settings;
      CREATE TRIGGER set_timestamp
      BEFORE UPDATE ON ray_settings
      FOR EACH ROW
      EXECUTE PROCEDURE update_updated_at_column();
      
    ALTER TABLE ray_device_types ADD COLUMN pricing JSONB;

-- Update the new pricing column with data from the old amount column
-- This assumes the old amount was for a "one-time" payment plan
UPDATE ray_device_types SET pricing = jsonb_build_object('one-time', amount);

-- Remove the old amount column
ALTER TABLE ray_device_types DROP COLUMN amount;
