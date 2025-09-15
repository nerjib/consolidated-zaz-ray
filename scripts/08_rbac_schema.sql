-- Phase 1 of RBAC Implementation: Schema Setup (Corrected)
-- This script creates the necessary tables for Role-Based Access Control
-- and populates the initial set of permissions.

-- Step 1: Create the master 'permissions' table
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

-- Step 2: Create the 'roles' table, with a nullable business_id for global roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE, -- Null for global roles
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add constraints to ensure role name is unique within a business, and also unique for global roles
ALTER TABLE roles ADD CONSTRAINT unique_business_role_name UNIQUE (business_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS unique_global_role_name_idx ON roles (name) WHERE business_id IS NULL;


-- Step 3: Create the join table 'role_permissions'
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

-- Step 4: Add the new 'role_id' column to the users table
ALTER TABLE ray_users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- Step 5: Populate the master list of permissions
INSERT INTO permissions (name, description) VALUES
    ('role:manage', 'Full access to create, update, and delete roles and assign permissions.'),
    ('user:manage', 'Full access to create, update, and deactivate users within the business.'),
    ('device:read', 'View devices and their details.'),
    ('device:create', 'Add new devices to inventory.'),
    ('device:update', 'Update device details.'),
    ('device:reprocess', 'Reprocess a returned or faulty device to make it available again.'),
    ('device:approve', 'Approve a newly added device.'),
    ('device-type:read', 'View device types.'),
    ('device-type:create', 'Create new device types.'),
    ('device-type:update', 'Update existing device types.'),
    ('device-type:delete', 'Delete device types.'),
    ('loan:read', 'View loan information.'),
    ('loan:create', 'Create new loans for customers.'),
    ('loan:update', 'Update loan details.'),
    ('loan:approve', 'Approve pending loans.'),
    ('payment:read', 'View payment history.'),
    ('payment:create:manual', 'Manually record a payment.'),
    ('agent:read', 'View agent profiles and performance.'),
    ('agent:manage:credit', 'Add or reconcile credit for agents.'),
    ('agent:set:commission', 'Set commission rates for agents.'),
    ('super:agent:read', 'View Super agent profiles and performance.'),
    ('super:agent:manage:credit', 'Add or reconcile credit for super agents.'),
    ('super:agent:set:commission', 'Set commission rates for super agents.'),
    ('analytics:read:business', 'View the main analytics dashboard for the business.'),
    ('business:update', 'Manage business-wide settings like API credentials.'),
    ('agent:withdraw:commission', 'Allows an agent to withdraw their earned commission.'),
    ('super:agent:withdraw:commission', 'Allows an super agent to withdraw their earned commission.'),
    ('deals:create', 'Allows admin to create deals.'),
    ('deals:read', 'Allows viewing all deals.'),
    ('deals:update', 'Allows updating existing deals.'),
    ('deals:delete', 'Allows deleting deals.')
ON CONFLICT (name) DO NOTHING;

-- Note: The next step will be a data migration script (09_rbac_data_migration.js)
-- to create default roles for existing businesses and migrate existing users.
-- insert into permissions (name, description) values ('deals:create', 'Allows admin to create deals.'),
--     ('deals:read', 'Allows viewing all deals.'),
--     ('deals:update', 'Allows updating existing deals.'),
--     ('deals:delete', 'Allows deleting deals.');