// /config/database.config.js
// MySQL database configuration file
// This file should be in your .gitignore to keep credentials secure

module.exports = {
    // Development environment
    development: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'castbuzz_dev',
        password: process.env.DB_PASSWORD || 'your_dev_password_here',
        database: process.env.DB_NAME || 'castbuzz_development',
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        timezone: 'Z', // UTC
        charset: 'utf8mb4',
        // SSL configuration for secure connections
        ssl: process.env.DB_SSL === 'true' ? {
            rejectUnauthorized: true,
            ca: process.env.DB_SSL_CA || null
        } : false
    },
    
    // Production environment
    production: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 20,
        waitForConnections: true,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        timezone: 'Z',
        charset: 'utf8mb4',
        ssl: {
            rejectUnauthorized: true,
            ca: process.env.DB_SSL_CA
        }
    },
    
    // Test environment
    test: {
        host: 'localhost',
        port: 3306,
        user: 'castbuzz_test',
        password: 'test_password',
        database: 'castbuzz_test',
        connectionLimit: 5,
        waitForConnections: true,
        queueLimit: 0,
        timezone: 'Z',
        charset: 'utf8mb4'
    }
};

// /config/app.config.js
// General application configuration

module.exports = {
    app: {
        name: 'CastBuzz Admin Panel',
        version: '1.0.0',
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        url: process.env.APP_URL || 'http://localhost:3000',
        adminEmail: process.env.ADMIN_EMAIL || 'admin@castbuzz.com'
    },
    
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        jwtExpiry: process.env.JWT_EXPIRY || '24h',
        refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 86400000, // 24 hours in ms
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
        lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 900000 // 15 minutes in ms
    },
    
    s3: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'us-east-1',
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        bucket: process.env.S3_BUCKET,
        usePathStyle: process.env.S3_USE_PATH_STYLE === 'true'
    },
    
    email: {
        smtp: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        },
        from: {
            name: process.env.EMAIL_FROM_NAME || 'CastBuzz',
            address: process.env.EMAIL_FROM_ADDRESS || 'noreply@castbuzz.com'
        }
    },
    
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        credentials: true,
        optionsSuccessStatus: 200
    },
    
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.'
    }
};

// /config/.env.example
// Example environment variables file
// Copy this to .env and fill in your actual values

/*
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=castbuzz_user
DB_PASSWORD=your_secure_password_here
DB_NAME=castbuzz_production
DB_SSL=false
DB_SSL_CA=

# Application Configuration
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.com
ADMIN_EMAIL=admin@your-domain.com

# Authentication
JWT_SECRET=your-very-long-random-string-here
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d
BCRYPT_ROUNDS=10
SESSION_TIMEOUT=86400000
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900000

# S3 Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-s3-access-key
S3_SECRET_ACCESS_KEY=your-s3-secret-key
S3_BUCKET=castbuzz-podcasts
S3_USE_PATH_STYLE=false

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM_NAME=CastBuzz
EMAIL_FROM_ADDRESS=noreply@castbuzz.com

# CORS Configuration
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
*/

// /lib/database.js
// Database connection manager using the config

const mysql = require('mysql2/promise');
const dbConfig = require('../config/database.config');
const appConfig = require('../config/app.config');

class Database {
    constructor() {
        this.pool = null;
        this.config = dbConfig[appConfig.app.env];
    }
    
    async connect() {
        try {
            if (!this.pool) {
                this.pool = await mysql.createPool(this.config);
                
                // Test the connection
                const connection = await this.pool.getConnection();
                await connection.ping();
                connection.release();
                
                console.log(`✅ MySQL connected successfully to ${this.config.database}`);
            }
            return this.pool;
        } catch (error) {
            console.error('❌ MySQL connection failed:', error.message);
            throw error;
        }
    }
    
    async query(sql, params) {
        try {
            const pool = await this.connect();
            const [results] = await pool.execute(sql, params);
            return results;
        } catch (error) {
            console.error('Query error:', error);
            throw error;
        }
    }
    
    async transaction(callback) {
        const pool = await this.connect();
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            console.log('MySQL connection pool closed');
        }
    }
}

// Export singleton instance
module.exports = new Database();

// /lib/db-schema.sql
// MySQL schema for CastBuzz admin panel

-- Create database
CREATE DATABASE IF NOT EXISTS castbuzz_production CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE castbuzz_production;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP NULL,
    login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    payload TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_last_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shows table
CREATE TABLE IF NOT EXISTS shows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    color VARCHAR(7),
    rss_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    episode_count INT DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_slug (slug),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Episodes table
CREATE TABLE IF NOT EXISTS episodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    show_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    audio_url VARCHAR(500) NOT NULL,
    image_url VARCHAR(500),
    duration VARCHAR(20),
    season INT,
    episode_number INT,
    publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT TRUE,
    play_count INT DEFAULT 0,
    download_count INT DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_show_slug (show_id, slug),
    INDEX idx_show_id (show_id),
    INDEX idx_publish_date (publish_date),
    INDEX idx_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- S3 configuration table
CREATE TABLE IF NOT EXISTS s3_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    endpoint VARCHAR(500),
    region VARCHAR(50),
    bucket VARCHAR(255),
    access_key_id VARCHAR(255),
    secret_access_key VARCHAR(500),
    use_path_style BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default roles
INSERT INTO roles (name, display_name, description, is_system) VALUES
('super_admin', 'Super Admin', 'Full system access', TRUE),
('admin', 'Admin', 'Administrative access', TRUE),
('editor', 'Editor', 'Content management access', TRUE),
('author', 'Author', 'Content creation access', TRUE),
('viewer', 'Viewer', 'Read-only access', TRUE);

-- Insert default permissions
INSERT INTO permissions (name, category, description) VALUES
-- Dashboard
('view_dashboard', 'dashboard', 'View dashboard'),
-- Users
('manage_users', 'users', 'Full user management'),
('create_users', 'users', 'Create new users'),
('edit_users', 'users', 'Edit user details'),
('delete_users', 'users', 'Delete users'),
('manage_roles', 'users', 'Manage roles and permissions'),
-- Content
('manage_shows', 'content', 'Full show management'),
('create_shows', 'content', 'Create new shows'),
('edit_shows', 'content', 'Edit show details'),
('delete_shows', 'content', 'Delete shows'),
('manage_episodes', 'content', 'Full episode management'),
('create_episodes', 'content', 'Create new episodes'),
('edit_own_episodes', 'content', 'Edit own episodes'),
('edit_all_episodes', 'content', 'Edit all episodes'),
('delete_episodes', 'content', 'Delete episodes'),
-- Storage
('manage_storage', 'storage', 'Manage S3 storage configuration'),
('upload_files', 'storage', 'Upload files to storage'),
('delete_files', 'storage', 'Delete files from storage'),
-- Analytics
('view_analytics', 'analytics', 'View analytics data'),
('export_analytics', 'analytics', 'Export analytics data'),
-- Settings
('manage_settings', 'settings', 'Manage system settings'),
('manage_appearance', 'settings', 'Manage appearance settings'),
('manage_integrations', 'settings', 'Manage third-party integrations');

-- Map permissions to roles
-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'super_admin'),
    id
FROM permissions;

-- Admin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'admin'),
    id
FROM permissions
WHERE name IN (
    'view_dashboard', 'manage_users', 'create_users', 'edit_users',
    'manage_shows', 'manage_episodes', 'manage_storage', 'view_analytics',
    'manage_settings'
);

-- Editor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'editor'),
    id
FROM permissions
WHERE name IN (
    'view_dashboard', 'manage_shows', 'manage_episodes', 'view_analytics'
);

-- Author permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'author'),
    id
FROM permissions
WHERE name IN (
    'view_dashboard', 'create_episodes', 'edit_own_episodes', 'view_analytics'
);

-- Viewer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'viewer'),
    id
FROM permissions
WHERE name IN ('view_dashboard', 'view_analytics');

-- Create default super admin user (password: ChangeMe123!)
INSERT INTO users (email, password_hash, first_name, last_name, role, status, email_verified)
VALUES (
    'admin@castbuzz.com',
    '$2b$10$YourHashedPasswordHere', -- You'll need to generate this with bcrypt
    'Super',
    'Admin',
    'super_admin',
    'active',
    TRUE
);

// /models/User.js
// User model for database operations

const db = require('../lib/database');
const bcrypt = require('bcrypt');
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
        
        const results = await db.query(sql, [email]);
        if (results.length === 0) return null;
        
        const user = results[0];
        user.permissions = user.permissions ? user.permissions.split(',') : [];
        return user;
    }
    
    static async findById(id) {
        const sql = `
            SELECT u.*, GROUP_CONCAT(p.name) as permissions
            FROM users u
            LEFT JOIN roles r ON u.role = r.name
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE u.id = ?
            GROUP BY u.id
        `;
        
        const results = await db.query(sql, [id]);
        if (results.length === 0) return null;
        
        const user = results[0];
        user.permissions = user.permissions ? user.permissions.split(',') : [];
        return user;
    }
    
    static async create(userData) {
        const {
            email,
            password,
            firstName,
            lastName,
            role = 'viewer',
            status = 'active'
        } = userData;
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
        
        const sql = `
            INSERT INTO users (email, password_hash, first_name, last_name, role, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.query(sql, [
            email,
            passwordHash,
            firstName,
            lastName,
            role,
            status
        ]);
        
        return result.insertId;
    }
    
    static async update(id, userData) {
        const updates = [];
        const values = [];
        
        // Build dynamic update query
        Object.entries(userData).forEach(([key, value]) => {
            if (value !== undefined && key !== 'id') {
                // Convert camelCase to snake_case
                const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                updates.push(`${dbKey} = ?`);
                values.push(value);
            }
        });
        
        if (updates.length === 0) return false;
        
        values.push(id); // Add id for WHERE clause
        
        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        const result = await db.query(sql, values);
        
        return result.affectedRows > 0;
    }
    
    static async delete(id) {
        const sql = 'DELETE FROM users WHERE id = ?';
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
            'UPDATE users SET login_attempts = 0, last_login = NOW() WHERE id = ?',
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
        
        if (user && user.login_attempts >= config.auth.maxLoginAttempts) {
            const lockUntil = new Date(Date.now() + config.auth.lockoutDuration);
            await db.query(
                'UPDATE users SET locked_until = ? WHERE id = ?',
                [lockUntil, userId]
            );
        }
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
}

module.exports = User;