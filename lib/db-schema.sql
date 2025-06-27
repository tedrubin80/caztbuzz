-- CastBuzz Podcast Management System - Complete Database Schema
-- MySQL 8.0+ compatible schema with UTF8MB4 support

-- Set character set and collation
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ==============================================
-- USERS & AUTHENTICATION
-- ==============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('super_admin', 'admin', 'editor', 'user') DEFAULT 'user',
    status ENUM('active', 'inactive', 'suspended', 'pending') DEFAULT 'pending',
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    avatar_url VARCHAR(500),
    bio TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status),
    INDEX idx_email_verified (email_verified),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INT PRIMARY KEY,
    theme ENUM('light', 'dark', 'auto') DEFAULT 'light',
    notifications JSON,
    dashboard_layout JSON,
    email_notifications BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Two-factor authentication
CREATE TABLE IF NOT EXISTS user_2fa (
    user_id INT PRIMARY KEY,
    secret VARCHAR(255) NOT NULL,
    backup_codes JSON,
    is_enabled BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User sessions for session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    payload TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_last_activity (last_activity),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- ROLES & PERMISSIONS
-- ==============================================

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

-- ==============================================
-- PODCAST CONTENT
-- ==============================================

-- Shows table
CREATE TABLE IF NOT EXISTS shows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    long_description LONGTEXT,
    image_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    color VARCHAR(7) DEFAULT '#6366F1',
    category VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    explicit BOOLEAN DEFAULT FALSE,
    author VARCHAR(255),
    owner_name VARCHAR(255),
    owner_email VARCHAR(255),
    copyright VARCHAR(255),
    website_url VARCHAR(500),
    rss_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    episode_count INT DEFAULT 0,
    total_duration INT DEFAULT 0, -- Total duration in seconds
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_plays INT DEFAULT 0,
    total_downloads INT DEFAULT 0,
    subscribers_count INT DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_slug (slug),
    INDEX idx_active (is_active),
    INDEX idx_featured (is_featured),
    INDEX idx_category (category),
    INDEX idx_created_by (created_by),
    INDEX idx_created_at (created_at),
    FULLTEXT idx_search (name, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Episodes table
CREATE TABLE IF NOT EXISTS episodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    show_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    content LONGTEXT,
    audio_url VARCHAR(500) NOT NULL,
    image_url VARCHAR(500),
    duration VARCHAR(20), -- Format: HH:MM:SS
    duration_seconds INT,
    file_size BIGINT, -- File size in bytes
    mime_type VARCHAR(100) DEFAULT 'audio/mpeg',
    season INT,
    episode_number INT,
    episode_type ENUM('full', 'trailer', 'bonus') DEFAULT 'full',
    explicit BOOLEAN DEFAULT FALSE,
    transcript_url VARCHAR(500),
    chapter_marks JSON, -- Array of chapter timestamps and titles
    publish_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    play_count INT DEFAULT 0,
    download_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    share_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_show_slug (show_id, slug),
    INDEX idx_show_id (show_id),
    INDEX idx_published (is_published),
    INDEX idx_featured (is_featured),
    INDEX idx_publish_date (publish_date),
    INDEX idx_season_episode (season, episode_number),
    INDEX idx_created_by (created_by),
    FULLTEXT idx_search (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Episode tags (many-to-many relationship)
CREATE TABLE IF NOT EXISTS tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    usage_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS episode_tags (
    episode_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (episode_id, tag_id),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- FILE MANAGEMENT
-- ==============================================

-- File uploads tracking (S3 integration)
CREATE TABLE IF NOT EXISTS file_uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type ENUM('audio', 'image', 'document', 'other') NOT NULL,
    entity_type ENUM('episode', 'show', 'user', 'other'),
    entity_id INT,
    storage_provider ENUM('s3', 'local', 'cdn') DEFAULT 's3',
    metadata JSON,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_file_type (file_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- ANALYTICS & TRACKING
-- ==============================================

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type ENUM('play', 'pause', 'complete', 'download', 'share', 'subscribe', 'like', 'comment', 'search', 'page_view') NOT NULL,
    user_id INT,
    session_id VARCHAR(128),
    show_id INT,
    episode_id INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referer VARCHAR(500),
    country VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    device_type ENUM('desktop', 'mobile', 'tablet', 'unknown') DEFAULT 'unknown',
    browser VARCHAR(100),
    os VARCHAR(100),
    metadata JSON, -- Additional event-specific data
    duration INT, -- For play events: how long listened
    position INT, -- For play events: position in episode
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    INDEX idx_event_type (event_type),
    INDEX idx_user_id (user_id),
    INDEX idx_show_id (show_id),
    INDEX idx_episode_id (episode_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_session_id (session_id),
    INDEX idx_country (country),
    INDEX idx_device_type (device_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User listening history
CREATE TABLE IF NOT EXISTS listening_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    episode_id INT NOT NULL,
    listen_duration INT NOT NULL, -- Duration in seconds
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    last_position INT DEFAULT 0, -- Last listening position in seconds
    device_type ENUM('desktop', 'mobile', 'tablet', 'unknown') DEFAULT 'unknown',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_episode (user_id, episode_id),
    INDEX idx_user_id (user_id),
    INDEX idx_episode_id (episode_id),
    INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- SUBSCRIPTIONS & NOTIFICATIONS
-- ==============================================

-- Show subscriptions
CREATE TABLE IF NOT EXISTS show_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    show_id INT NOT NULL,
    email VARCHAR(255), -- For anonymous subscriptions
    subscription_type ENUM('rss', 'email', 'web') DEFAULT 'web',
    is_active BOOLEAN DEFAULT TRUE,
    notification_preferences JSON,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_show_id (show_id),
    INDEX idx_email (email),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email subscribers (for newsletter)
CREATE TABLE IF NOT EXISTS email_subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    status ENUM('pending', 'confirmed', 'unsubscribed', 'bounced') DEFAULT 'pending',
    preferences JSON,
    confirmation_token VARCHAR(255),
    confirmed_at TIMESTAMP NULL,
    unsubscribed_at TIMESTAMP NULL,
    source VARCHAR(100), -- Where they subscribed from
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- SOCIAL FEATURES
-- ==============================================

-- Comments on episodes
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    episode_id INT NOT NULL,
    user_id INT,
    parent_id INT, -- For nested comments
    author_name VARCHAR(100),
    author_email VARCHAR(255),
    content TEXT NOT NULL,
    status ENUM('pending', 'approved', 'spam', 'rejected') DEFAULT 'pending',
    like_count INT DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    INDEX idx_episode_id (episode_id),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_id (parent_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ratings for episodes
CREATE TABLE IF NOT EXISTS episode_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    episode_id INT NOT NULL,
    user_id INT,
    rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_episode_rating (user_id, episode_id),
    INDEX idx_episode_id (episode_id),
    INDEX idx_user_id (user_id),
    INDEX idx_rating (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Social shares tracking
CREATE TABLE IF NOT EXISTS social_shares (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content_type ENUM('episode', 'show') NOT NULL,
    content_id INT NOT NULL,
    platform ENUM('twitter', 'facebook', 'linkedin', 'instagram', 'whatsapp', 'email', 'other') NOT NULL,
    user_id INT,
    ip_address VARCHAR(45),
    shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_content (content_type, content_id),
    INDEX idx_platform (platform),
    INDEX idx_user_id (user_id),
    INDEX idx_shared_at (shared_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- SYSTEM CONFIGURATION
-- ==============================================

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    category VARCHAR(50),
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_key (setting_key),
    INDEX idx_category (category),
    INDEX idx_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity logs for admin actions
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================
-- INSERT DEFAULT DATA
-- ==============================================

-- Insert default roles
INSERT IGNORE INTO roles (name, display_name, description, is_system) VALUES
('super_admin', 'Super Administrator', 'Full system access with all permissions', TRUE),
('admin', 'Administrator', 'Administrative access to manage users and content', TRUE),
('editor', 'Editor', 'Can create and manage podcast content', TRUE),
('user', 'User', 'Basic user with listening and subscription capabilities', TRUE);

-- Insert default permissions
INSERT IGNORE INTO permissions (name, category, description) VALUES
-- User management
('view_users', 'users', 'View user accounts'),
('create_users', 'users', 'Create new user accounts'),
('edit_users', 'users', 'Edit user accounts'),
('delete_users', 'users', 'Delete user accounts'),

-- Show management
('view_shows', 'shows', 'View podcast shows'),
('create_shows', 'shows', 'Create new podcast shows'),
('edit_shows', 'shows', 'Edit podcast shows'),
('delete_shows', 'shows', 'Delete podcast shows'),

-- Episode management
('view_episodes', 'episodes', 'View podcast episodes'),
('create_episodes', 'episodes', 'Create new podcast episodes'),
('edit_episodes', 'episodes', 'Edit podcast episodes'),
('delete_episodes', 'episodes', 'Delete podcast episodes'),

-- Analytics
('view_analytics', 'analytics', 'View analytics and reports'),
('export_analytics', 'analytics', 'Export analytics data'),

-- System
('view_dashboard', 'system', 'Access admin dashboard'),
('manage_settings', 'system', 'Manage system settings'),
('view_logs', 'system', 'View system logs'),

-- Comments and moderation
('moderate_comments', 'moderation', 'Moderate user comments'),
('manage_subscriptions', 'subscriptions', 'Manage email subscriptions');

-- Insert default system settings
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public) VALUES
('site_name', 'CastBuzz', 'string', 'general', 'Site name', TRUE),
('site_description', 'Podcast Management System', 'string', 'general', 'Site description', TRUE),
('site_url', 'https://localhost:3000', 'string', 'general', 'Site URL', FALSE),
('admin_email', 'admin@castbuzz.com', 'string', 'general', 'Administrator email', FALSE),
('timezone', 'UTC', 'string', 'general', 'Default timezone', TRUE),
('date_format', 'Y-m-d', 'string', 'general', 'Date format', TRUE),
('analytics_enabled', 'true', 'boolean', 'analytics', 'Enable analytics tracking', FALSE),
('comments_enabled', 'true', 'boolean', 'features', 'Enable comments on episodes', TRUE),
('comments_require_approval', 'true', 'boolean', 'features', 'Comments require approval', FALSE),
('subscriptions_enabled', 'true', 'boolean', 'features', 'Enable email subscriptions', TRUE),
('max_file_size', '524288000', 'number', 'uploads', 'Maximum file size in bytes (500MB)', FALSE),
('allowed_file_types', '["audio/mpeg", "audio/wav", "audio/m4a", "image/jpeg", "image/png"]', 'json', 'uploads', 'Allowed file types', FALSE);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Create a view for episode statistics
CREATE OR REPLACE VIEW episode_stats AS
SELECT 
    e.id,
    e.title,
    e.show_id,
    s.name as show_name,
    e.play_count,
    e.download_count,
    e.like_count,
    e.comment_count,
    COALESCE(AVG(r.rating), 0) as average_rating,
    COUNT(r.id) as rating_count,
    e.created_at,
    e.publish_date
FROM episodes e
LEFT JOIN shows s ON e.show_id = s.id
LEFT JOIN episode_ratings r ON e.id = r.episode_id
GROUP BY e.id;

-- Create a view for show statistics
CREATE OR REPLACE VIEW show_stats AS
SELECT 
    s.id,
    s.name,
    s.episode_count,
    s.total_plays,
    s.total_downloads,
    s.subscribers_count,
    COUNT(DISTINCT sub.id) as active_subscribers,
    COALESCE(AVG(r.rating), 0) as average_rating,
    COUNT(DISTINCT r.id) as total_ratings,
    s.created_at
FROM shows s
LEFT JOIN show_subscriptions sub ON s.id = sub.show_id AND sub.is_active = TRUE
LEFT JOIN episodes e ON s.id = e.show_id
LEFT JOIN episode_ratings r ON e.id = r.episode_id
GROUP BY s.id;

COMMIT;