const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
// TODO: Replace with new 'can' middleware once created
const authorize = require('../middleware/authorization'); 
const { query } = require('../config/database');
const can = require('../middleware/can');

// For now, we will protect these routes with the generic 'admin' role.
// Later, we will replace this with a fine-grained 'role:manage' permission.

// @route   GET api/admin/roles/permissions
// @desc    Get a list of all available permissions
// @access  Private (Admin)
router.get('/permissions', auth, can('role:manage'), async (req, res) => {
    try {
        const permissions = await query('SELECT * FROM permissions ORDER BY name');
        res.json(permissions.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/admin/roles
// @desc    Create a new role for the business
// @access  Private (Admin)
router.post('/', auth, can('role:manage'), async (req, res) => {
    const { name, description, permissions } = req.body; // permissions is an array of permission IDs
    const { business_id } = req.user;

    if (!name || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ msg: 'Please provide a name and an array of permission IDs for the role.' });
    }

    const { pool } = require('../config/database');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Create the new role
        const roleResult = await client.query(
            'INSERT INTO roles (business_id, name, description) VALUES ($1, $2, $3) RETURNING id',
            [business_id, name, description]
        );
        const role_id = roleResult.rows[0].id;

        // Assign permissions to the new role
        const permissionInserts = permissions.map(permission_id => {
            return client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [role_id, permission_id]);
        });
        await Promise.all(permissionInserts);

        await client.query('COMMIT');
        res.status(201).json({ msg: 'Role created successfully', role_id });

    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') { // unique_violation
            return res.status(400).json({ msg: 'A role with this name already exists in your business.' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

// @route   GET api/admin/roles
// @desc    Get all roles for the business
// @access  Private (Admin)
router.get('/', auth, async (req, res) => {
    const { business_id } = req.user;
    console.log({ business_id });
    try {
        const roles = await query('SELECT * FROM roles WHERE business_id = $1 ORDER BY created_at', [business_id]);
        res.json(roles.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/admin/roles/:id
// @desc    Get a single role and its permissions
// @access  Private (Admin)
router.get('/:id', auth, can('role:manage'), async (req, res) => {
    const { id } = req.params;
    const { business_id } = req.user;
    try {
        const queryText = `
            SELECT r.id, r.name, r.description, r.is_default,
                   COALESCE(json_agg(rp.permission_id) FILTER (WHERE rp.permission_id IS NOT NULL), '[]') as permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            WHERE r.id = $1 AND r.business_id = $2
            GROUP BY r.id;
        `;
        const roleResult = await query(queryText, [id, business_id]);

        if (roleResult.rows.length === 0) {
            return res.status(404).json({ msg: 'Role not found.' });
        }
        res.json(roleResult.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/admin/roles/:id
// @desc    Update a role's name, description, and permissions
// @access  Private (Admin)
router.put('/:id', auth, can('role:manage'), async (req, res) => {
    const { id: role_id } = req.params;
    const { name, description, permissions } = req.body;
    const { business_id } = req.user;

    const { pool } = require('../config/database');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Update role details
        await client.query('UPDATE roles SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND business_id = $4', [name, description, role_id, business_id]);

        // Clear existing permissions for the role
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [role_id]);

        // Assign new set of permissions
        if (permissions && Array.isArray(permissions)) {
            const permissionInserts = permissions.map(permission_id => {
                return client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [role_id, permission_id]);
            });
            await Promise.all(permissionInserts);
        }

        await client.query('COMMIT');
        res.json({ msg: 'Role updated successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

// @route   DELETE api/admin/roles/:id
// @desc    Delete a role
// @access  Private (Admin)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
    const { id: role_id } = req.params;
    const { business_id } = req.user;

    try {
        // Prevent deletion of default roles
        const roleCheck = await query('SELECT is_default FROM roles WHERE id = $1 AND business_id = $2', [role_id, business_id]);
        if (roleCheck.rows.length > 0 && roleCheck.rows[0].is_default) {
            return res.status(400).json({ msg: 'Cannot delete a default role.' });
        }

        const deleteResult = await query('DELETE FROM roles WHERE id = $1 AND business_id = $2', [role_id, business_id]);

        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ msg: 'Role not found.' });
        }

        res.json({ msg: 'Role deleted successfully' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
