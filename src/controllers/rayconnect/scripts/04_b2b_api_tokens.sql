
-- Create a table to store API tokens for B2B integrations
CREATE TABLE IF NOT EXISTS b2b_api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL, -- e.g., 'Odyssey Integration Token'
    token_sha256_hash TEXT NOT NULL, -- Store a SHA-256 hash of the token for fast lookups
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Create an index on business_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_b2b_api_tokens_business_id ON b2b_api_tokens(business_id);

-- Create a unique index on the token hash for authentication lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_api_tokens_token_hash ON b2b_api_tokens(token_sha256_hash);
