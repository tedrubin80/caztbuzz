-- Migration: Add user avatar field
-- Created: 2025-06-27T00:00:01.000Z

-- Add avatar_url field to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) AFTER bio;

-- Create index for faster avatar queries
CREATE INDEX IF NOT EXISTS idx_users_avatar ON users(avatar_url);