// models/Show.js
// Show model for database operations

const db = require('../lib/database');
const User = require('./User');

class Show {
    static async findAll(filters = {}) {
        let sql = `
            SELECT s.*, 
                   COUNT(DISTINCT e.id) as episode_count,
                   u.first_name as creator_first_name,
                   u.last_name as creator_last_name
            FROM shows s
            LEFT JOIN episodes e ON s.id = e.show_id AND e.is_published = TRUE
            LEFT JOIN users u ON s.created_by = u.id
        `;
        
        const conditions = [];
        const params = [];
        
        if (filters.search) {
            conditions.push('(s.name LIKE ? OR s.description LIKE ?)');
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        if (filters.is_active !== undefined) {
            conditions.push('s.is_active = ?');
            params.push(filters.is_active);
        }
        
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        
        sql += ' GROUP BY s.id ORDER BY s.created_at DESC';
        
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(filters.limit));
        }
        
        return await db.query(sql, params);
    }
    
    static async findById(id) {
        const sql = `
            SELECT s.*, 
                   COUNT(DISTINCT e.id) as episode_count,
                   u.first_name as creator_first_name,
                   u.last_name as creator_last_name
            FROM shows s
            LEFT JOIN episodes e ON s.id = e.show_id
            LEFT JOIN users u ON s.created_by = u.id
            WHERE s.id = ?
            GROUP BY s.id
        `;
        
        const [show] = await db.query(sql, [id]);
        return show || null;
    }
    
    static async findBySlug(slug) {
        const sql = `
            SELECT s.*, 
                   COUNT(DISTINCT e.id) as episode_count,
                   u.first_name as creator_first_name,
                   u.last_name as creator_last_name
            FROM shows s
            LEFT JOIN episodes e ON s.id = e.show_id AND e.is_published = TRUE
            LEFT JOIN users u ON s.created_by = u.id
            WHERE s.slug = ?
            GROUP BY s.id
        `;
        
        const [show] = await db.query(sql, [slug]);
        return show || null;
    }
    
    static async create(showData, userId) {
        const { name, description, color, imageUrl } = showData;
        
        // Generate slug from name
        const slug = this.generateSlug(name);
        
        // Check if slug already exists
        const existingShow = await this.findBySlug(slug);
        if (existingShow) {
            throw new Error('A show with this name already exists');
        }
        
        const sql = `
            INSERT INTO shows (name, slug, description, image_url, color, created_by, is_active)
            VALUES (?, ?, ?, ?, ?, ?, TRUE)
        `;
        
        const result = await db.query(sql, [
            name,
            slug,
            description || null,
            imageUrl || null,
            color || '#6366f1',
            userId
        ]);
        
        // Log activity
        await User.logActivity(userId, 'show_created', {
            entityType: 'show',
            entityId: result.insertId,
            data: { name, slug }
        });
        
        return this.findById(result.insertId);
    }
    
    static async update(id, updateData, userId) {
        const allowedFields = ['name', 'description', 'image_url', 'color', 'is_active'];
        const updates = [];
        const values = [];
        
        // Handle name change (update slug)
        if (updateData.name) {
            const newSlug = this.generateSlug(updateData.name);
            
            // Check if new slug conflicts with existing show
            const existingShow = await this.findBySlug(newSlug);
            if (existingShow && existingShow.id !== parseInt(id)) {
                throw new Error('A show with this name already exists');
            }
            
            updates.push('name = ?', 'slug = ?');
            values.push(updateData.name, newSlug);
        }
        
        // Handle other fields
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key) && key !== 'name') {
                const dbField = key === 'imageUrl' ? 'image_url' : key;
                updates.push(`${dbField} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }
        
        values.push(id);
        const sql = `UPDATE shows SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
        
        const result = await db.query(sql, values);
        
        if (result.affectedRows === 0) {
            throw new Error('Show not found');
        }
        
        // Log activity
        await User.logActivity(userId, 'show_updated', {
            entityType: 'show',
            entityId: id,
            data: updateData
        });
        
        return this.findById(id);
    }
    
    static async delete(id, userId) {
        return await db.transaction(async (connection) => {
            // Get show details for logging
            const show = await this.findById(id);
            if (!show) {
                throw new Error('Show not found');
            }
            
            // Delete all episodes first (cascade)
            await connection.execute('DELETE FROM episodes WHERE show_id = ?', [id]);
            
            // Delete the show
            const result = await connection.execute('DELETE FROM shows WHERE id = ?', [id]);
            
            if (result[0].affectedRows === 0) {
                throw new Error('Show not found');
            }
            
            // Log activity
            await User.logActivity(userId, 'show_deleted', {
                entityType: 'show',
                entityId: id,
                data: { 
                    name: show.name, 
                    slug: show.slug,
                    episodes_deleted: show.episode_count
                }
            });
            
            return true;
        });
    }
    
    static async updateEpisodeCount(showId) {
        const sql = `
            UPDATE shows 
            SET episode_count = (
                SELECT COUNT(*) 
                FROM episodes 
                WHERE show_id = ? AND is_published = TRUE
            )
            WHERE id = ?
        `;
        
        await db.query(sql, [showId, showId]);
    }
    
    static async getStats() {
        const sql = `
            SELECT 
                COUNT(*) as total_shows,
                COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_shows,
                COUNT(CASE WHEN is_active = FALSE THEN 1 END) as inactive_shows,
                AVG(episode_count) as avg_episodes_per_show
            FROM shows
        `;
        
        const [stats] = await db.query(sql);
        return stats;
    }
    
    static async getRecentShows(limit = 5) {
        const sql = `
            SELECT s.id, s.name, s.slug, s.color, s.created_at,
                   COUNT(DISTINCT e.id) as episode_count
            FROM shows s
            LEFT JOIN episodes e ON s.id = e.show_id AND e.is_published = TRUE
            WHERE s.is_active = TRUE
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT ?
        `;
        
        return await db.query(sql, [limit]);
    }
    
    static async getShowsWithEpisodes() {
        const sql = `
            SELECT s.*, 
                   COUNT(DISTINCT e.id) as episode_count,
                   MAX(e.publish_date) as latest_episode_date
            FROM shows s
            LEFT JOIN episodes e ON s.id = e.show_id AND e.is_published = TRUE
            WHERE s.is_active = TRUE
            GROUP BY s.id
            HAVING episode_count > 0
            ORDER BY latest_episode_date DESC
        `;
        
        return await db.query(sql);
    }
    
    static generateSlug(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    }
    
    static async validateSlug(slug, excludeId = null) {
        let sql = 'SELECT id FROM shows WHERE slug = ?';
        const params = [slug];
        
        if (excludeId) {
            sql += ' AND id != ?';
            params.push(excludeId);
        }
        
        const [existing] = await db.query(sql, params);
        return !existing; // Returns true if slug is available
    }
    
    static async updateRSSUrl(showId, rssUrl) {
        const sql = 'UPDATE shows SET rss_url = ?, updated_at = NOW() WHERE id = ?';
        const result = await db.query(sql, [rssUrl, showId]);
        return result.affectedRows > 0;
    }
    
    static async toggleStatus(id, userId) {
        const show = await this.findById(id);
        if (!show) {
            throw new Error('Show not found');
        }
        
        const newStatus = !show.is_active;
        await this.update(id, { is_active: newStatus }, userId);
        
        // Log activity
        await User.logActivity(userId, newStatus ? 'show_activated' : 'show_deactivated', {
            entityType: 'show',
            entityId: id,
            data: { name: show.name, new_status: newStatus }
        });
        
        return newStatus;
    }
}

module.exports = Show;