// api/users.js
// User management CRUD API

const express = require('express');
const router = express.Router();
const { body, validationResult, param, query } = require('express-validator');
const User = require('../models/User');
const { requireAuth, requirePermission, logActivity, auditAction } = require('../middleware/auth');
const { validateUser } = require('../middleware/validation');

// GET /api/users - Get all users
router.get('/', [
    query('role').optional().isIn(['super_admin', 'admin', 'editor', 'author', 'viewer']),
    query('status').optional().isIn(['active', 'inactive', 'suspended']),
    query('search').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 })
], requireAuth, requirePermission('manage_users'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const filters = {
            role: req.query.role,
            status: req.query.status,
            search: req.query.search,
            limit: req.query.limit || 50
        };

        const users = await User.getAllUsers(filters);
        
        res.json({
            success: true,
            users,
            count: users.length
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// GET /api/users/:id - Get single user
router.get('/:id', [
    param('id').isInt({ min: 1 })
], requireAuth, requirePermission('manage_users'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove sensitive data
        delete user.password_hash;
        
        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// POST /api/users - Create new user
router.post('/', validateUser, requireAuth, requirePermission('create_users'), logActivity('user_create'), auditAction('user_create'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userData = {
            email: req.body.email,
            password: req.body.password,
            firstName: req.body.first_name,
            lastName: req.body.last_name,
            role: req.body.role || 'viewer'
        };

        const user = await User.create(userData);
        
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PUT /api/users/:id - Update user
router.put('/:id', [
    param('id').isInt({ min: 1 }),
    body('first_name').optional().notEmpty().trim(),
    body('last_name').optional().notEmpty().trim(),
    body('role').optional().isIn(['super_admin', 'admin', 'editor', 'author', 'viewer']),
    body('status').optional().isIn(['active', 'inactive', 'suspended'])
], requireAuth, requirePermission('edit_users'), logActivity('user_update'), auditAction('user_update'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Prevent users from editing super_admin unless they are super_admin
        if (req.user.role !== 'super_admin') {
            const targetUser = await User.findById(req.params.id);
            if (targetUser?.role === 'super_admin') {
                return res.status(403).json({ error: 'Cannot modify super admin users' });
            }
            
            if (req.body.role === 'super_admin') {
                return res.status(403).json({ error: 'Cannot assign super admin role' });
            }
        }

        const allowedFields = ['first_name', 'last_name', 'role', 'avatar'];
        const updateData = {};
        
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        const success = await User.update(req.params.id, updateData);
        
        if (!success) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await User.findById(req.params.id);
        delete updatedUser.password_hash;
        
        res.json({
            success: true,
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', [
    param('id').isInt({ min: 1 })
], requireAuth, requirePermission('delete_users'), logActivity('user_delete'), auditAction('user_delete'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Prevent deletion of super_admin unless deleter is super_admin
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Cannot delete super admin users' });
        }

        // Prevent self-deletion
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        await User.delete(req.params.id);
        
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// POST /api/users/:id/reset-password - Reset user password
router.post('/:id/reset-password', [
    param('id').isInt({ min: 1 }),
    body('new_password').isLength({ min: 8 }).trim()
], requireAuth, requirePermission('edit_users'), logActivity('password_reset'), auditAction('password_reset'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const targetUser = await User.findById(req.params.id);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Only super_admin can reset other admin passwords
        if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Cannot reset super admin password' });
        }

        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(req.body.new_password, 10);
        
        await User.update(req.params.id, { password_hash: hashedPassword });
        
        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;