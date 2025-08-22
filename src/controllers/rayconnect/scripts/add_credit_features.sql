
-- Add credit_balance column to ray_users table
ALTER TABLE ray_users ADD COLUMN credit_balance DECIMAL(10, 2) DEFAULT 0.00;

-- Create ray_credit_transactions table
CREATE TABLE IF NOT EXISTS ray_credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES ray_users(id) ON DELETE CASCADE NOT NULL, -- Agent/Super-Agent whose credit is affected
    transaction_type VARCHAR(50) NOT NULL, -- 'add', 'deduct', 'reconcile', 'payment'
    amount DECIMAL(10, 2) NOT NULL,
    new_balance DECIMAL(10, 2) NOT NULL, -- Balance after this transaction
    reference_id UUID, -- Optional: e.g., payment_id if credit is used for payment
    description TEXT,
    created_by UUID REFERENCES ray_users(id) ON DELETE SET NULL, -- Admin who initiated (if applicable)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add a trigger to update the updated_at timestamp for ray_credit_transactions (optional, but good practice)
CREATE OR REPLACE FUNCTION update_updated_at_column_credit_transactions()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = NOW(); -- Assuming created_at is the only timestamp to update on insert
  RETURN NEW;
END;
$$ language 'plpgsql';

-- No trigger for UPDATE on this table, as created_at should be immutable for transactions.
