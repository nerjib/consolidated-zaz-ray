ALTER TABLE ray_loans ADD COLUMN paused_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE ray_loans ADD COLUMN resumed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE ray_loans DROP CONSTRAINT IF EXISTS ray_loans_status_check;
ALTER TABLE ray_loans ADD CONSTRAINT ray_loans_status_check CHECK (status IN ('active', 'completed', 'defaulted', 'paused', 'overdue'));