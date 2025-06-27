// models/User.js
// Enhanced User model with full authentication and permission support

const db = require('../lib/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require('../config/app.config');

class User {
    static async findByEmail(email) {
        const sql = `
            SELECT u.*, GROUP_CONCAT(p.name) as permissions
            FROM users u
            LEFT JOIN roles r ON u.role = r.name
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE u.email = ?
            GROUP BY u.id
        `;
        
        const [user] = await db.query(sql, [email]);
        if (!user) return null;
        
        user.permissions = user.permissions ? user.permissions.split(',') : [];
        return user;
    }
    
    static async findById(id) {
        return this.getUserWithPermissions(id);
    }
    
    static async getUserWithPermissions(userId) {
        const sql = `
            SELECT 
                u.*,
                up.timezone, up.language, up.theme, up.notifications, up.dashboard_layout,
                GROUP_CONCAT(DISTINCT p.name) as permissions,
                COUNT(DISTINCT us.id) as active_sessions,
                u2fa.is_enabled as has_2fa
            FROM users u
            LEFT JOIN user_preferences up ON u.id = up.user_id
            LEFT JOIN roles r ON u.role = r.name
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            LEFT JOIN user_sessions us ON u.id = us.user_id 
                AND us.last_activity > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            LEFT JOIN user_2fa u2fa ON u.id = u2fa.user_id
            WHERE u.id = ? AND u.status = 'active'
            GROUP BY u.id
        `;
        
        const [user] = await db.query(sql, [userId]);
        if (!user) return null;
        
        user.permissions = user.permissions ? user.permissions.split(',') : [];
        user.has_2fa = Boolean(user.has_2fa);
        
        // Parse JSON fields
        if (user.notifications) {
            try {
                user.notifications = JSON.parse(user.notifications);
            } catch (e) {
                user.notifications = { email: true, push: false, desktop: false };
            }
        }
        
        if (user.dashboard_layout) {
            try {
                user.dashboard_layout = JSON.parse(user.dashboard_layout);
            } catch (e) {
                user.dashboard_layout = { layout: 'default', widgets: [] };
            }
        }
        
        return user;
    }
    
    static async create(userData) {
        const { email, password, firstName, lastName, role = 'viewer' } = userData;
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        const sql = `
            INSERT INTO users (email, password_hash, first_name, last_name, role)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const result = await db.query(sql, [email, passwordHash, firstName, lastName, role]);
        const userId = result.insertId;
        
        // Create default preferences
        await this.createDefaultPreferences(userId);
        
        return this.findById(userId);
    }
    
    static async createDefaultPreferences(userId) {
        const sql = `
            INSERT INTO user_preferences (user_id, notifications, dashboard_layout)
            VALUES (?, ?, ?)
        `;
        
        const defaultNotifications = JSON.stringify({
            email: true,
            push: false,
            desktop: false
        });
        
        const defaultLayout = JSON.stringify({
            layout: 'default',
            widgets: ['stats', 'recent_episodes']
        });
        
        await db.query(sql, [userId, defaultNotifications, defaultLayout]);
    }
    
    static async update(id, updateData) {
        const allowedFields = ['first_name', 'last_name', 'avatar', 'role'];
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) return false;
        
        values.push(id);
        const sql = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
        
        const result = await db.query(sql, values);
        return result.affectedRows > 0;
    }
    
    static async updatePreferences(userId, preferences) {
        const sql = `
            INSERT INTO user_preferences (user_id, timezone, language, theme, notifications, dashboard_layout)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                timezone = VALUES(timezone),
                language = VALUES(language),
                theme = VALUES(theme),
                notifications = VALUES(notifications),
                dashboard_layout = VALUES(dashboard_layout),
                updated_at = NOW()
        `;
        
        await db.query(sql, [
            userId,
            preferences.timezone || 'UTC',
            preferences.language || 'en',
            preferences.theme || 'light',
            JSON.stringify(preferences.notifications || {}),
            JSON.stringify(preferences.dashboard_layout || {})
        ]);
    }
    
    static async delete(id) {
        const sql = 'UPDATE users SET status = "inactive" WHERE id = ?';
        const result = await db.query(sql, [id]);
        return result.affectedRows > 0;
    }
    
    static async authenticate(email, password) {
        const user = await this.findByEmail(email);
        if (!user) return null;
        
        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            throw new Error('Account is locked. Please try again later.');
        }
        
        // Check password
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            // Increment login attempts
            await this.incrementLoginAttempts(user.id);
            return null;
        }
        
        // Reset login attempts and update last login
        await db.query(
            'UPDATE users SET login_attempts = 0, last_login = NOW(), locked_until = NULL WHERE id = ?',
            [user.id]
        );
        
        // Remove sensitive data
        delete user.password_hash;
        delete user.login_attempts;
        delete user.locked_until;
        
        return user;
    }
    
    static async incrementLoginAttempts(userId) {
        await db.query(
            'UPDATE users SET login_attempts = login_attempts + 1 WHERE id = ?',
            [userId]
        );
        
        // Check if we should lock the account
        const [user] = await db.query(
            'SELECT login_attempts FROM users WHERE id = ?',
            [userId]
        );
        
        if (user && user.login_attempts >= (config.auth?.maxLoginAttempts || 5)) {
            const lockDuration = config.auth?.lockoutDuration || 30 * 60 * 1000; // 30 minutes
            const lockUntil = new Date(Date.now() + lockDuration);
            await db.query(
                'UPDATE users SET locked_until = ? WHERE id = ?',
                [lockUntil, userId]
            );
        }
    }
    
    static async changePassword(userId, currentPassword, newPassword) {
        const user = await this.findById(userId);
        if (!user) return false;
        
        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValid) return false;
        
        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        
        // Update password
        const sql = 'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?';
        const result = await db.query(sql, [newPasswordHash, userId]);
        
        return result.affectedRows > 0;
    }
    
    static async setPasswordResetToken(email, token) {
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        const sql = `
            UPDATE users 
            SET password_reset_token = ?, password_reset_expires = ? 
            WHERE email = ?
        `;
        
        await db.query(sql, [token, expires, email]);
    }
    
    static async resetPassword(email, newPassword, token) {
        const sql = `
            SELECT id, password_reset_token, password_reset_expires 
            FROM users 
            WHERE email = ? AND password_reset_token = ?
        `;
        
        const [user] = await db.query(sql, [email, token]);
        
        if (!user || new Date() > user.password_reset_expires) {
            return false;
        }
        
        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        // Update password and clear reset token
        const updateSql = `
            UPDATE users 
            SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL 
            WHERE id = ?
        `;
        
        const result = await db.query(updateSql, [passwordHash, user.id]);
        return result.affectedRows > 0;
    }
    
    static async createApiKey(userId, name, permissions = []) {
        const keyPrefix = 'cb_' + Math.random().toString(36).substring(7);
        const fullKey = keyPrefix + '_' + crypto.randomBytes(32).toString('hex');
        const keyHash = await bcrypt.hash(fullKey, 10);
        
        const sql = `
            INSERT INTO api_keys (user_id, name, key_hash, key_prefix, permissions)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        await db.query(sql, [userId, name, keyHash, keyPrefix, JSON.stringify(permissions)]);
        
        // Return full key only once
        return { key: fullKey, prefix: keyPrefix };
    }
    
    static async validateApiKey(keyPrefix, fullKey) {
        const sql = `
            SELECT ak.*, u.id as user_id, u.email, u.role, u.status
            FROM api_keys ak
            JOIN users u ON ak.user_id = u.id
            WHERE ak.key_prefix = ? AND ak.is_active = TRUE AND u.status = 'active'
        `;
        
        const [apiKey] = await db.query(sql, [keyPrefix]);
        if (!apiKey) return null;
        
        // Check if key has expired
        if (apiKey.expires_at && new Date() > apiKey.expires_at) {
            return null;
        }
        
        // Verify key hash
        const isValid = await bcrypt.compare(fullKey, apiKey.key_hash);
        if (!isValid) return null;
        
        // Update last used
        await db.query('UPDATE api_keys SET last_used = NOW() WHERE id = ?', [apiKey.id]);
        
        return {
            user_id: apiKey.user_id,
            email: apiKey.email,
            role: apiKey.role,
            permissions: JSON.parse(apiKey.permissions || '[]')
        };
    }
    
    static async registerDevice(userId, deviceId, deviceType, pushToken = null) {
        const sql = `
            INSERT INTO user_devices (user_id, device_id, device_type, push_token, last_seen)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                push_token = VALUES(push_token),
                last_seen = NOW(),
                is_active = TRUE
        `;
        
        await db.query(sql, [userId, deviceId, deviceType, pushToken]);
    }
    
    static async setup2FA(userId, secret) {
        const sql = `
            INSERT INTO user_2fa (user_id, secret, backup_codes)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                secret = VALUES(secret),
                backup_codes = VALUES(backup_codes),
                is_enabled = FALSE,
                verified_at = NULL
        `;
        
        // Generate backup codes
        const backupCodes = Array.from({ length: 10 }, () => 
            crypto.randomBytes(4).toString('hex').toUpperCase()
        );
        
        await db.query(sql, [userId, secret, JSON.stringify(backupCodes)]);
        return backupCodes;
    }
    
    static async verify2FA(userId, token) {
        const speakeasy = require('speakeasy');
        
        const sql = 'SELECT secret FROM user_2fa WHERE user_id = ?';
        const [twoFA] = await db.query(sql, [userId]);
        
        if (!twoFA) return false;
        
        const verified = speakeasy.totp.verify({
            secret: twoFA.secret,
            encoding: 'base32',
            token: token,
            window: 1
        });
        
        if (verified) {
            await db.query(
                'UPDATE user_2fa SET is_enabled = TRUE, verified_at = NOW() WHERE user_id = ?',
                [userId]
            );
        }
        
        return verified;
    }
    
    static async getAllUsers(filters = {}) {
        let sql = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, 
                   u.last_login, u.created_at,
                   COUNT(DISTINCT us.id) as active_sessions
            FROM users u
            LEFT JOIN user_sessions us ON u.id = us.user_id 
                AND us.last_activity > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `;
        
        const conditions = [];
        const params = [];
        
        if (filters.role) {
            conditions.push('u.role = ?');
            params.push(filters.role);
        }
        
        if (filters.status) {
            conditions.push('u.status = ?');
            params.push(filters.status);
        }
        
        if (filters.search) {
            conditions.push('(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)');
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
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
    
    static async logActivity(userId, action, details = {}) {
        const sql = `
            INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        await db.query(sql, [
            userId,
            action,
            details.entityType || null,
            details.entityId || null,
            JSON.stringify(details.data || {}),
            details.ipAddress || null,
            details.userAgent || null
        ]);
    }
    
    static async getActivityLog(userId, limit = 50) {
        const sql = `
            SELECT action, entity_type, entity_id, details, ip_address, created_at
            FROM activity_logs
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `;
        
        return await db.query(sql, [userId, limit]);
    }
}

module.exports = User;