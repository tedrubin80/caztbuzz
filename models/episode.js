// models/Episode.js
// Episode model for database operations

const db = require('../lib/database');
const User = require('./User');

class Episode {
    static async findAll(filters = {}) {
        let sql = `
            SELECT e.*, s.name as show_name, s.color as show_color,
                   u.first_name as creator_first_name, u.last_name as creator_last_name
            FROM episodes e
            LEFT JOIN shows s ON e.show_id = s.id
            LEFT JOIN users u ON e.created_by = u.id
        `;
        
        const conditions = [];
        const params = [];
        
        if (filters.show_id) {
            conditions.push('e.show_id = ?');
            params.push(filters.show_id);
        }
        
        if (filters.is_published !== undefined) {
            conditions.push('e.is_published = ?');
            params.push(filters.is_published);
        }
        
        if (filters.search) {
            conditions.push('(e.title LIKE ? OR e.description LIKE ?)');
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        
        sql += ' ORDER BY e.publish_date DESC, e.created_at DESC';
        
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(filters.limit));
        }
        
        return await db.query(sql, params);
    }
    
    static async findById(id) {
        const sql = `
            SELECT e.*, s.name as show_name, s.color as show_color,
                   u.first_name as creator_first_name, u.last_name as creator_last_name
            FROM episodes e
            LEFT JOIN shows s ON e.show_id = s.id
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.id = ?
        `;
        
        const [episode] = await db.query(sql, [id]);
        return episode || null;
    }
    
    static async findBySlug(showId, slug) {
        const sql = `
            SELECT e.*, s.name as show_name, s.color as show_color
            FROM episodes e
            LEFT JOIN shows s ON e.show_id = s.id
            WHERE e.show_id = ? AND e.slug = ?
        `;
        
        const [episode] = await db.query(sql, [showId, slug]);
        return episode || null;
    }
    
    static async create(episodeData, userId) {
        const { 
            show_id, title, description, audio_url, image_url, 
            duration, season, episode_number, is_published = false 
        } = episodeData;
        
        // Generate slug from title
        const slug = this.generateSlug(title);
        
        // Check if slug exists for this show
        const existingEpisode = await this.findBySlug(show_id, slug);
        if (existingEpisode) {
            throw new Error('An episode with this title already exists in this show');
        }
        
        const sql = `
            INSERT INTO episodes (
                show_id, title, slug, description, audio_url, image_url, 
                duration, season, episode_number, is_published, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.query(sql, [
            show_id, title, slug, description || null, audio_url,
            image_url || null, duration || null, season || null,
            episode_number || null, is_published, userId
        ]);
        
        // Update show episode count
        await this.updateShowEpisodeCount(show_id);
        
        // Log activity
        await User.logActivity(userId, 'episode_created', {
            entityType: 'episode',
            entityId: result.insertId,
            data: { title, show_id, is_published }
        });
        
        return this.findById(result.insertId);
    }
    
    static async update(id, updateData, userId) {
        const allowedFields = [
            'title', 'description', 'audio_url', 'image_url', 'duration',
            'season', 'episode_number', 'is_published'
        ];
        const updates = [];
        const values = [];
        
        // Handle title change (update slug)
        if (updateData.title) {
            const episode = await this.findById(id);
            if (!episode) throw new Error('Episode not found');
            
            const newSlug = this.generateSlug(updateData.title);
            
            // Check if new slug conflicts with existing episode in same show
            const existingEpisode = await this.findBySlug(episode.show_id, newSlug);
            if (existingEpisode && existingEpisode.id !== parseInt(id)) {
                throw new Error('An episode with this title already exists in this show');
            }
            
            updates.push('title = ?', 'slug = ?');
            values.push(updateData.title, newSlug);
        }
        
        // Handle other fields
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key) && key !== 'title') {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }
        
        values.push(id);
        const sql = `UPDATE episodes SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
        
        const result = await db.query(sql, values);
        
        if (result.affectedRows === 0) {
            throw new Error('Episode not found');
        }
        
        // Update show episode count if publication status changed
        if (updateData.is_published !== undefined) {
            const episode = await this.findById(id);
            await this.updateShowEpisodeCount(episode.show_id);
        }
        
        // Log activity
        await User.logActivity(userId, 'episode_updated', {
            entityType: 'episode',
            entityId: id,
            data: updateData
        });
        
        return this.findById(id);
    }
    
    static async delete(id, userId) {
        return await db.transaction(async (connection) => {
            // Get episode details for logging
            const episode = await this.findById(id);
            if (!episode) {
                throw new Error('Episode not found');
            }
            
            // Delete the episode
            const result = await connection.execute('DELETE FROM episodes WHERE id = ?', [id]);
            
            if (result[0].affectedRows === 0) {
                throw new Error('Episode not found');
            }
            
            // Update show episode count
            await this.updateShowEpisodeCount(episode.show_id);
            
            // Log activity
            await User.logActivity(userId, 'episode_deleted', {
                entityType: 'episode',
                entityId: id,
                data: { 
                    title: episode.title, 
                    show_id: episode.show_id,
                    show_name: episode.show_name
                }
            });
            
            return true;
        });
    }
    
    static async publish(id, userId) {
        const sql = 'UPDATE episodes SET is_published = TRUE, publish_date = NOW(), updated_at = NOW() WHERE id = ?';
        const result = await db.query(sql, [id]);
        
        if (result.affectedRows === 0) {
            throw new Error('Episode not found');
        }
        
        const episode = await this.findById(id);
        await this.updateShowEpisodeCount(episode.show_id);
        
        await User.logActivity(userId, 'episode_published', {
            entityType: 'episode',
            entityId: id,
            data: { title: episode.title }
        });
        
        return episode;
    }
    
    static async unpublish(id, userId) {
        const sql = 'UPDATE episodes SET is_published = FALSE, updated_at = NOW() WHERE id = ?';
        const result = await db.query(sql, [id]);
        
        if (result.affectedRows === 0) {
            throw new Error('Episode not found');
        }
        
        const episode = await this.findById(id);
        await this.updateShowEpisodeCount(episode.show_id);
        
        await User.logActivity(userId, 'episode_unpublished', {
            entityType: 'episode',
            entityId: id,
            data: { title: episode.title }
        });
        
        return episode;
    }
    
    static async incrementPlayCount(id) {
        const sql = 'UPDATE episodes SET play_count = play_count + 1 WHERE id = ?';
        await db.query(sql, [id]);
    }
    
    static async incrementDownloadCount(id) {
        const sql = 'UPDATE episodes SET download_count = download_count + 1 WHERE id = ?';
        await db.query(sql, [id]);
    }
    
    static async updateShowEpisodeCount(showId) {
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
                COUNT(*) as total_episodes,
                COUNT(CASE WHEN is_published = TRUE THEN 1 END) as published_episodes,
                COUNT(CASE WHEN is_published = FALSE THEN 1 END) as draft_episodes,
                SUM(play_count) as total_plays,
                SUM(download_count) as total_downloads,
                AVG(play_count) as avg_plays_per_episode
            FROM episodes
        `;
        
        const [stats] = await db.query(sql);
        return stats;
    }
    
    static async getRecentEpisodes(limit = 10) {
        const sql = `
            SELECT e.id, e.title, e.publish_date, e.play_count,
                   s.name as show_name, s.color as show_color
            FROM episodes e
            LEFT JOIN shows s ON e.show_id = s.id
            WHERE e.is_published = TRUE
            ORDER BY e.publish_date DESC
            LIMIT ?
        `;
        
        return await db.query(sql, [limit]);
    }
    
    static async getPopularEpisodes(limit = 10) {
        const sql = `
            SELECT e.id, e.title, e.play_count, e.download_count,
                   s.name as show_name, s.color as show_color
            FROM episodes e
            LEFT JOIN shows s ON e.show_id = s.id
            WHERE e.is_published = TRUE
            ORDER BY e.play_count DESC, e.download_count DESC
            LIMIT ?
        `;
        
        return await db.query(sql, [limit]);
    }
    
    static async getEpisodesByShow(showId, published = null) {
        let sql = `
            SELECT e.*, s.name as show_name
            FROM episodes e
            LEFT JOIN shows s ON e.show_id = s.id
            WHERE e.show_id = ?
        `;
        
        const params = [showId];
        
        if (published !== null) {
            sql += ' AND e.is_published = ?';
            params.push(published);
        }
        
        sql += ' ORDER BY e.episode_number ASC, e.publish_date DESC';
        
        return await db.query(sql, params);
    }
    
    static generateSlug(title) {
        return title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    
    static async validateSlug(showId, slug, excludeId = null) {
        let sql = 'SELECT id FROM episodes WHERE show_id = ? AND slug = ?';
        const params = [showId, slug];
        
        if (excludeId) {
            sql += ' AND id != ?';
            params.push(excludeId);
        }
        
        const [existing] = await db.query(sql, params);
        return !existing; // Returns true if slug is available
    }
    
    static parseDuration(duration) {
        if (!duration) return null;
        
        const parts = duration.split(':').map(Number);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1]; // MM:SS
        } else if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
        }
        
        return null;
    }
    
    static formatDuration(seconds) {
        if (!seconds) return null;
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
}

module.exports = Episode;