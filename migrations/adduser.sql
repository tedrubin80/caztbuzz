-- Rollback for: Add user avatar field
-- Created: 2025-06-27T00:00:01.000Z

-- Remove the avatar index
DROP INDEX IF EXISTS idx_users_avatar ON users;

-- Remove the avatar_url column
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;