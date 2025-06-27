// models/User.js
// User model for database operations and authentication

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../lib/database');
const config = require('../config/app.config');

class User {
    static async findAll(filters = {}) {
        let sql = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status,
                   u.email_verified, u.last_login, u.created_at, u.updated_at,
                   COUNT(DISTINCT s.id) as shows_count,
                   COUNT(DISTINCT e.id) as episodes_count
            FROM users u
            LEFT JOIN shows s ON u.id = s.created_by
            LEFT JOIN episodes e ON u.id = e.created_by
        `;
        
        const conditions = [];
        const params = [];
        
        if (filters.search) {
            conditions.push('(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)');
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        if (filters.role) {
            conditions.push('u.role = ?');
            params.push(filters.role);
        }
        
        if (filters.status) {
            conditions.push('u.status = ?');
            params.push(filters.status);
        }
        
        if (filters.email_verified !== undefined) {
            conditions.push('u.email_verified = ?');
            params.push(filters.email_verified);
        }
        
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        
        sql += ' GROUP BY u.id ORDER BY u.created_at DESC';
        
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(filters.limit));
        }
        
        return await db.query(sql, params);
    }
    
    static async findById(id) {
        const sql = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status,
                   u.email_verified, u.last_login, u.created_at, u.updated_at,
                   COUNT(DISTINCT s.id) as shows_count,
                   COUNT(DISTINCT e.id) as episodes_count
            FROM users u
            LEFT JOIN shows s ON u.id = s.created_by
            LEFT JOIN episodes e ON u.id = e.created_by
            WHERE u.id = ?
            GROUP BY u.id
        `;
        
        const [user] = await db.query(sql, [id]);
        return user || null;
    }
    
    static async findByEmail(email) {
        const sql = `
            SELECT u.*, 
                   COUNT(DISTINCT s.id) as shows_count,
                   COUNT(DISTINCT e.id) as episodes_count
            FROM users u
            LEFT JOIN shows s ON u.id = s.created_by
            LEFT JOIN episodes e ON u.id = e.created_by
            WHERE u.email = ?
            GROUP BY u.id
        `;
        
        const [user] = await db.query(sql, [email]);
        return user || null;
    }
    
    static async create(userData) {
        const {
            email,
            password,
            firstName,
            lastName,
            role = 'user'
        } = userData;
        
        // Check if user already exists
        const existingUser = await this.findByEmail(email);
        if (existingUser) {
            throw new Error('User with this email already exists');
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
        
        const sql = `
            INSERT INTO users (email, password_hash, first_name, last_name, role, status, email_verified)
            VALUES (?, ?, ?, ?, ?, 'active', FALSE)
        `;
        
        const result = await db.query(sql, [
            email,
            passwordHash,
            firstName,
            lastName,
            role
        ]);
        
        return await this.findById(result.insertId);
    }
    
    static async update(id, userData) {
        const updateFields = [];
        const params = [];
        
        if (userData.email) {
            // Check if email is already taken by another user
            const existingUser = await this.findByEmail(userData.email);
            if (existingUser && existingUser.id !== parseInt(id)) {
                throw new Error('Email is already taken by another user');
            }
            updateFields.push('email = ?');
            params.push(userData.email);
        }
        
        if (userData.firstName) {
            updateFields.push('first_name = ?');
            params.push(userData.firstName);
        }
        
        if (userData.lastName) {
            updateFields.push('last_name = ?');
            params.push(userData.lastName);
        }
        
        if (userData.role) {
            updateFields.push('role = ?');
            params.push(userData.role);
        }
        
        if (userData.status) {
            updateFields.push('status = ?');
            params.push(userData.status);
        }
        
        if (userData.emailVerified !== undefined) {
            updateFields.push('email_verified = ?');
            params.push(userData.emailVerified);
        }
        
        if (updateFields.length === 0) {
            throw new Error('No fields to update');
        }
        
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);
        
        const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        await db.query(sql, params);
        
        return await this.findById(id);
    }
    
    static async updatePassword(id, newPassword) {
        const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
        
        const sql = `
            UPDATE users 
            SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        await db.query(sql, [passwordHash, id]);
        return true;
    }
    
    static async delete(id) {
        // Check if user exists
        const user = await this.findById(id);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Check if user has created content
        if (user.shows_count > 0 || user.episodes_count > 0) {
            throw new Error('Cannot delete user with existing shows or episodes');
        }
        
        const sql = 'DELETE FROM users WHERE id = ?';
        await db.query(sql, [id]);
        
        return true;
    }
    
    static async authenticate(email, password) {
        const sql = `
            SELECT id, email, password_hash, first_name, last_name, role, status, 
                   email_verified, login_attempts, locked_until
            FROM users 
            WHERE email = ?
        `;
        
        const [user] = await db.query(sql, [email]);
        
        if (!user) {
            throw new Error('Invalid email or password');
        }
        
        // Check if account is locked
        if (user.locked_until && new Date() < new Date(user.locked_until)) {
            throw new Error('Account is temporarily locked due to too many failed login attempts');
        }
        
        // Check if account is active
        if (user.status !== 'active') {
            throw new Error('Account is not active');
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            await this.incrementLoginAttempts(user.id);
            throw new Error('Invalid email or password');
        }
        
        // Reset login attempts on successful login
        await this.resetLoginAttempts(user.id);
        await this.updateLastLogin(user.id);
        
        // Remove sensitive fields
        delete user.password_hash;
        delete user.login_attempts;
        delete user.locked_until;
        
        return user;
    }
    
    static async incrementLoginAttempts(userId) {
        const sql = `
            UPDATE users 
            SET login_attempts = COALESCE(login_attempts, 0) + 1,
                locked_until = CASE 
                    WHEN COALESCE(login_attempts, 0) + 1 >= ? 
                    THEN DATE_ADD(NOW(), INTERVAL ? MICROSECOND)
                    ELSE NULL 
                END
            WHERE id = ?
        `;
        
        await db.query(sql, [
            config.auth.maxLoginAttempts,
            config.auth.lockoutDuration * 1000, // Convert to microseconds
            userId
        ]);
    }
    
    static async resetLoginAttempts(userId) {
        const sql = `
            UPDATE users 
            SET login_attempts = 0, locked_until = NULL 
            WHERE id = ?
        `;
        
        await db.query(sql, [userId]);
    }
    
    static async updateLastLogin(userId) {
        const sql = `
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        await db.query(sql, [userId]);
    }
    
    static async verifyEmail(userId) {
        const sql = `
            UPDATE users 
            SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        await db.query(sql, [userId]);
        return await this.findById(userId);
    }
    
    static generateToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role
        };
        
        return jwt.sign(payload, config.auth.jwtSecret, {
            expiresIn: config.auth.jwtExpiry
        });
    }
    
    static generateRefreshToken(user) {
        const payload = {
            id: user.id,
            type: 'refresh'
        };
        
        return jwt.sign(payload, config.auth.jwtSecret, {
            expiresIn: config.auth.refreshTokenExpiry
        });
    }
    
    static verifyToken(token) {
        return jwt.verify(token, config.auth.jwtSecret);
    }
    
    static async getStats() {
        const sql = `
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
                SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_users,
                SUM(CASE WHEN email_verified = TRUE THEN 1 ELSE 0 END) as verified_users,
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users,
                SUM(CASE WHEN role = 'super_admin' THEN 1 ELSE 0 END) as super_admin_users,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as users_today,
                SUM(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as users_this_week,
                SUM(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as users_this_month
            FROM users
        `;
        
        const [stats] = await db.query(sql);
        return stats;
    }
    
    static async getRecentUsers(limit = 5) {
        const sql = `
            SELECT id, email, first_name, last_name, role, status, created_at
            FROM users 
            ORDER BY created_at DESC 
            LIMIT ?
        `;
        
        return await db.query(sql, [limit]);
    }
    
    static async getUsersWithContent() {
        const sql = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.role,
                   COUNT(DISTINCT s.id) as shows_count,
                   COUNT(DISTINCT e.id) as episodes_count
            FROM users u
            LEFT JOIN shows s ON u.id = s.created_by
            LEFT JOIN episodes e ON u.id = e.created_by
            GROUP BY u.id
            HAVING shows_count > 0 OR episodes_count > 0
            ORDER BY (shows_count + episodes_count) DESC
        `;
        
        return await db.query(sql);
    }
    
    static async changePassword(userId, currentPassword, newPassword) {
        // Get user with password hash
        const sql = 'SELECT password_hash FROM users WHERE id = ?';
        const [user] = await db.query(sql, [userId]);
        
        if (!user) {
            throw new Error('User not found');
        }
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Current password is incorrect');
        }
        
        // Update password
        await this.updatePassword(userId, newPassword);
        return true;
    }
    
    static hasPermission(user, permission) {
        const rolePermissions = {
            super_admin: ['*'], // All permissions
            admin: [
                'view_dashboard',
                'manage_users',
                'manage_shows',
                'manage_episodes',
                'view_analytics',
                'manage_settings'
            ],
            editor: [
                'view_dashboard',
                'manage_shows',
                'manage_episodes',
                'view_analytics'
            ],
            user: [
                'view_dashboard'
            ]
        };
        
        const permissions = rolePermissions[user.role] || [];
        return permissions.includes('*') || permissions.includes(permission);
    }
    
    static async bulkUpdate(userIds, updateData) {
        if (!Array.isArray(userIds) || userIds.length === 0) {
            throw new Error('User IDs must be a non-empty array');
        }
        
        const updateFields = [];
        const params = [];
        
        if (updateData.status) {
            updateFields.push('status = ?');
            params.push(updateData.status);
        }
        
        if (updateData.role) {
            updateFields.push('role = ?');
            params.push(updateData.role);
        }
        
        if (updateFields.length === 0) {
            throw new Error('No fields to update');
        }
        
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        
        const placeholders = userIds.map(() => '?').join(',');
        params.push(...userIds);
        
        const sql = `
            UPDATE users 
            SET ${updateFields.join(', ')} 
            WHERE id IN (${placeholders})
        `;
        
        const result = await db.query(sql, params);
        return result.affectedRows;
    }
}

module.exports = User;