ALTER TABLE ray_users
ADD COLUMN IF NOT EXISTS profile_picture_base64 TEXT;
