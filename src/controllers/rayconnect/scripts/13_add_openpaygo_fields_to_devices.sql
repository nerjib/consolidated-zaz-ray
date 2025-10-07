ALTER TABLE ray_devices
ADD COLUMN IF NOT EXISTS openpaygo_secret_key TEXT,
ADD COLUMN IF NOT EXISTS openpaygo_token_count INTEGER DEFAULT 0;