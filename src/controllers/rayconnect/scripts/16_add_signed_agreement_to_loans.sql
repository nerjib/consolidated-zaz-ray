ALTER TABLE ray_loans
ADD COLUMN IF NOT EXISTS signed_agreement_base64 TEXT;
