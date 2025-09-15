require('dotenv').config({ path: '../.env' });
// const { Pool } = require('pg');
// const { pool } = require('../config/database');
const { pool } = require('../src/controllers/rayconnect/config/database'); // Adjust path as needed

//   const client = await pool.connect();

// const pool = new Pool({
//   user: process.env.DB_USER || 'user',
//   host: process.env.DB_HOST || 'localhost',
//   database: process.env.DB_NAME || 'bexpay_db',
//   password: process.env.DB_PASSWORD || '    ',
//   port: process.env.DB_PORT || 5432,
// });

const migrateData = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Starting RBAC data migration...');

        // 1. Fetch all permissions into a map for easy lookup
        const permissionsResult = await client.query('SELECT id, name FROM permissions');
        const permissionMap = new Map(permissionsResult.rows.map(p => [p.name, p.id]));
        console.log(`Loaded ${permissionMap.size} permissions.`);

        // Define permissions for default roles
        const adminPermissions = Array.from(permissionMap.keys()); // All permissions
        const agentPermissions = ['device:read', 'loan:read', 'loan:create', 'payment:read', 'payment:create:manual', 'user:manage'];

        // 2. Handle Platform Owner role (global role)
        console.log('Setting up Platform Owner role...');
        const platformOwnerRoleResult = await client.query(
            `INSERT INTO roles (name, description, is_default) VALUES ($1, $2, $3)
             ON CONFLICT (name) WHERE business_id IS NULL DO UPDATE SET description = $2 RETURNING id`,
            ['Platform Owner', 'Has super-user access to the entire platform.', true]
        );
        const platformOwnerRoleId = platformOwnerRoleResult.rows[0].id;

        // Assign all permissions to Platform Owner
        for (const permName of adminPermissions) {
            const permId = permissionMap.get(permName);
            await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [platformOwnerRoleId, permId]);
        }
        console.log('Assigned all permissions to Platform Owner role.');

        // Update existing platform_owner users
        const platformUpdateResult = await client.query("UPDATE ray_users SET role_id = $1 WHERE role = 'platform_owner'", [platformOwnerRoleId]);
        console.log(`Migrated ${platformUpdateResult.rowCount} platform owner users.`);

        // 3. Fetch all distinct business IDs
        const businessesResult = await client.query('SELECT DISTINCT business_id FROM ray_users WHERE business_id IS NOT NULL');
        const businessIds = businessesResult.rows.map(r => r.business_id);
        console.log(`Found ${businessIds.length} businesses to migrate.`);

        // 4. Loop through each business and create/assign roles
        for (const business_id of businessIds) {
            console.log(`-- Migrating business ${business_id} --`);

            // Create default roles for the business
            const adminRole = await client.query('INSERT INTO roles (business_id, name, description, is_default) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, name) DO NOTHING RETURNING id', [business_id, 'Business Admin', 'Full access within the business', true]);
            const agentRole = await client.query('INSERT INTO roles (business_id, name, description, is_default) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, name) DO NOTHING RETURNING id', [business_id, 'Agent', 'Standard agent access', true]);
            const customerRole = await client.query('INSERT INTO roles (business_id, name, description, is_default) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, name) DO NOTHING RETURNING id', [business_id, 'Customer', 'Standard customer access', true]);

            const adminRoleId = adminRole.rows[0]?.id;
            const agentRoleId = agentRole.rows[0]?.id;
            const customerRoleId = customerRole.rows[0]?.id;

            if (!adminRoleId || !agentRoleId || !customerRoleId) {
                console.log(`Roles already existed for business ${business_id}, skipping permission assignment.`);
            } else {
                 // Assign permissions to Business Admin role
                for (const permName of adminPermissions) {
                    const permId = permissionMap.get(permName);
                    await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [adminRoleId, permId]);
                }

                // Assign permissions to Agent role
                for (const permName of agentPermissions) {
                    const permId = permissionMap.get(permName);
                    await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [agentRoleId, permId]);
                }
            }

            // Update users in the current business
            await client.query("UPDATE ray_users SET role_id = $1 WHERE role = 'admin' AND business_id = $2", [adminRoleId, business_id]);
            await client.query("UPDATE ray_users SET role_id = $1 WHERE role = 'agent' AND business_id = $2", [agentRoleId, business_id]);
            await client.query("UPDATE ray_users SET role_id = $1 WHERE role = 'customer' AND business_id = $2", [customerRoleId, business_id]);
            console.log(`Updated users for business ${business_id}`);
        }

        await client.query('COMMIT');
        console.log('RBAC data migration completed successfully.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Database migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrateData();
