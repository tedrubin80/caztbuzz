// api/analytics.js
// Analytics and reporting API

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { requireAuth, requirePermission } = require('../middleware/auth');
const db = require('../lib/database');

// GET /api/analytics/dashboard - Dashboard overview stats
router.get('/dashboard', requireAuth, requirePermission('view_analytics'), async (req, res) => {
    try {
        const stats = await Promise.all([
            getContentStats(),
            getEngagementStats(),
            getUserStats(),
            getRecentActivity()
        ]);

        res.json({
            success: true,
            content: stats[0],
            engagement: stats[1],
            users: stats[2],
            recent_activity: stats[3]
        });
    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
    }
});

// GET /api/analytics/episodes - Episode performance
router.get('/episodes', [
    query('show_id').optional().isInt({ min: 1 }),
    query('days').optional().isInt({ min: 1, max: 365 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], requireAuth, requirePermission('view_analytics'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { show_id, days = 30, limit = 20 } = req.query;
        
        let sql = `
            SELECT e.id, e.title, e.play_count, e.download_count, e.publish_date,
                   s.name as show_name, s.color as show_color,
                   (e.play_count + e.download_count) as total_engagement
            FROM episodes e
            LEFT JOIN shows s ON e.show_id = s.id
            WHERE e.is_published = TRUE
        `;
        
        const params = [];
        
        if (show_id) {
            sql += ' AND e.show_id = ?';
            params.push(show_id);
        }
        
        if (days) {
            sql += ' AND e.publish_date >= DATE_SUB(NOW(), INTERVAL ? DAY)';
            params.push(days);
        }
        
        sql += ' ORDER BY total_engagement DESC, e.publish_date DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const episodes = await db.query(sql, params);
        
        res.json({
            success: true,
            episodes,
            period_days: days
        });
    } catch (error) {
        console.error('Episode analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch episode analytics' });
    }
});

// GET /api/analytics/shows - Show performance
router.get('/shows', [
    query('days').optional().isInt({ min: 1, max: 365 })
], requireAuth, requirePermission('view_analytics'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { days = 30 } = req.query;
        
        const sql = `
            SELECT s.id, s.name, s.color, s.episode_count,
                   COUNT(DISTINCT e.id) as published_episodes,
                   SUM(e.play_count) as total_plays,
                   SUM(e.download_count) as total_downloads,
                   AVG(e.play_count) as avg_plays_per_episode,
                   MAX(e.publish_date) as latest_episode
            FROM shows s
            LEFT JOIN episodes e ON s.id = e.show_id 
                AND e.is_published = TRUE
                AND e.publish_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
            WHERE s.is_active = TRUE
            GROUP BY s.id
            ORDER BY total_plays DESC, total_downloads DESC
        `;
        
        const shows = await db.query(sql, [days]);
        
        res.json({
            success: true,
            shows,
            period_days: days
        });
    } catch (error) {
        console.error('Show analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch show analytics' });
    }
});

// GET /api/analytics/trends - Time-based trends
router.get('/trends', [
    query('metric').isIn(['plays', 'downloads', 'episodes']),
    query('period').isIn(['7d', '30d', '90d', '1y']),
    query('show_id').optional().isInt({ min: 1 })
], requireAuth, requirePermission('view_analytics'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { metric, period, show_id } = req.query;
        
        const periodDays = {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '1y': 365
        };
        
        const days = periodDays[period];
        const groupBy = days <= 7 ? 'DAY' : days <= 30 ? 'DAY' : 'WEEK';
        
        let sql = `
            SELECT 
                DATE(e.publish_date) as date,
                ${metric === 'plays' ? 'SUM(e.play_count)' : 
                  metric === 'downloads' ? 'SUM(e.download_count)' : 
                  'COUNT(*)'}
                as value
            FROM episodes e
            WHERE e.is_published = TRUE
            AND e.publish_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `;
        
        const params = [days];
        
        if (show_id) {
            sql += ' AND e.show_id = ?';
            params.push(show_id);
        }
        
        sql += ` GROUP BY DATE(e.publish_date) ORDER BY date ASC`;
        
        const trends = await db.query(sql, params);
        
        res.json({
            success: true,
            metric,
            period,
            trends
        });
    } catch (error) {
        console.error('Trends analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch trend analytics' });
    }
});

// GET /api/analytics/activity - User activity logs
router.get('/activity', [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('user_id').optional().isInt({ min: 1 }),
    query('action').optional().trim()
], requireAuth, requirePermission('view_analytics'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { limit = 50, user_id, action } = req.query;
        
        let sql = `
            SELECT al.*, u.first_name, u.last_name, u.email
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (user_id) {
            sql += ' AND al.user_id = ?';
            params.push(user_id);
        }
        
        if (action) {
            sql += ' AND al.action LIKE ?';
            params.push(`%${action}%`);
        }
        
        sql += ' ORDER BY al.created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const activities = await db.query(sql, params);
        
        res.json({
            success: true,
            activities
        });
    } catch (error) {
        console.error('Activity analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch activity analytics' });
    }
});

// Helper functions
async function getContentStats() {
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM shows WHERE is_active = TRUE) as total_shows,
            (SELECT COUNT(*) FROM episodes WHERE is_published = TRUE) as published_episodes,
            (SELECT COUNT(*) FROM episodes WHERE is_published = FALSE) as draft_episodes,
            (SELECT SUM(file_size) FROM file_uploads WHERE upload_status = 'completed') as total_storage_used
    `;
    
    const [stats] = await db.query(sql);
    return stats;
}

async function getEngagementStats() {
    const sql = `
        SELECT 
            SUM(play_count) as total_plays,
            SUM(download_count) as total_downloads,
            AVG(play_count) as avg_plays_per_episode,
            (SELECT COUNT(*) FROM episodes WHERE play_count > 0) as episodes_with_plays
        FROM episodes 
        WHERE is_published = TRUE
    `;
    
    const [stats] = await db.query(sql);
    return stats;
}

async function getUserStats() {
    const sql = `
        SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
            COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_users,
            COUNT(CASE WHEN role IN ('super_admin', 'admin') THEN 1 END) as admin_users
        FROM users
    `;
    
    const [stats] = await db.query(sql);
    return stats;
}

async function getRecentActivity() {
    const sql = `
        SELECT al.action, al.created_at, u.first_name, u.last_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 10
    `;
    
    return await db.query(sql);
}

module.exports = router;