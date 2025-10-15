ALTER TABLE ray_loans
ADD COLUMN IF NOT EXISTS signed_agreement_base64 TEXT;

ALTER TABLE ray_device_types
ADD COLUMN IF NOT EXISTS onetime_commission_rate FLOAT;
ALTER TABLE ray_tokens ALTER COLUMN 
  expires_at DROP NOT NULL