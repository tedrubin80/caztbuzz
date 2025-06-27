// api/shows.js
// Shows CRUD API endpoints

const express = require('express');
const router = express.Router();
const { body, validationResult, param, query } = require('express-validator');
const Show = require('../models/Show');
const { requireAuth, requirePermission, logActivity, auditAction } = require('../middleware/auth');

// GET /api/shows - Get all shows
router.get('/', [
    query('search').optional().trim(),
    query('is_active').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 })
], requireAuth, requirePermission('view_dashboard'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const filters = {
            search: req.query.search,
            is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
            limit: req.query.limit
        };

        const shows = await Show.findAll(filters);
        
        res.json({
            success: true,
            shows,
            count: shows.length
        });
    } catch (error) {
        console.error('Get shows error:', error);
        res.status(500).json({ error: 'Failed to fetch shows' });
    }
});

// GET /api/shows/stats - Get show statistics
router.get('/stats', requireAuth, requirePermission('view_dashboard'), async (req, res) => {
    try {
        const stats = await Show.getStats();
        const recentShows = await Show.getRecentShows(5);
        
        res.json({
            success: true,
            stats,
            recent_shows: recentShows
        });
    } catch (error) {
        console.error('Get show stats error:', error);
        res.status(500).json({ error: 'Failed to fetch show statistics' });
    }
});

// GET /api/shows/with-episodes - Get shows that have episodes
router.get('/with-episodes', requireAuth, requirePermission('view_dashboard'), async (req, res) => {
    try {
        const shows = await Show.getShowsWithEpisodes();
        
        res.json({
            success: true,
            shows
        });
    } catch (error) {
        console.error('Get shows with episodes error:', error);
        res.status(500).json({ error: 'Failed to fetch shows with episodes' });
    }
});

// GET /api/shows/:id - Get single show
router.get('/:id', [
    param('id').isInt({ min: 1 })
], requireAuth, requirePermission('view_dashboard'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const show = await Show.findById(req.params.id);
        
        if (!show) {
            return res.status(404).json({ error: 'Show not found' });
        }
        
        res.json({
            success: true,
            show
        });
    } catch (error) {
        console.error('Get show error:', error);
        res.status(500).json({ error: 'Failed to fetch show' });
    }
});

// POST /api/shows - Create new show
router.post('/', [
    body('name').notEmpty().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('color').optional().matches(/^#[0-9A-F]{6}$/i),
    body('imageUrl').optional().isURL()
], requireAuth, requirePermission('create_shows'), logActivity('show_create'), auditAction('show_create'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const showData = {
            name: req.body.name,
            description: req.body.description,
            color: req.body.color || '#6366f1',
            imageUrl: req.body.imageUrl
        };

        const show = await Show.create(showData, req.user.id);
        
        res.status(201).json({
            success: true,
            message: 'Show created successfully',
            show
        });
    } catch (error) {
        console.error('Create show error:', error);
        
        if (error.message === 'A show with this name already exists') {
            return res.status(409).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Failed to create show' });
    }
});

// PUT /api/shows/:id - Update show
router.put('/:id', [
    param('id').isInt({ min: 1 }),
    body('name').optional().notEmpty().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('color').optional().matches(/^#[0-9A-F]{6}$/i),
    body('imageUrl').optional().isURL(),
    body('is_active').optional().isBoolean()
], requireAuth, requirePermission('edit_shows'), logActivity('show_update'), auditAction('show_update'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const allowedFields = ['name', 'description', 'color', 'imageUrl', 'is_active'];
        const updateData = {};
        
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        const show = await Show.update(req.params.id, updateData, req.user.id);
        
        res.json({
            success: true,
            message: 'Show updated successfully',
            show
        });
    } catch (error) {
        console.error('Update show error:', error);
        
        if (error.message === 'Show not found') {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === 'A show with this name already exists') {
            return res.status(409).json({ error: error.message });
        }
        
        if (error.message === 'No valid fields to update') {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Failed to update show' });
    }
});

// PATCH /api/shows/:id/toggle - Toggle show active status
router.patch('/:id/toggle', [
    param('id').isInt({ min: 1 })
], requireAuth, requirePermission('edit_shows'), logActivity('show_toggle'), auditAction('show_toggle'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const newStatus = await Show.toggleStatus(req.params.id, req.user.id);
        
        res.json({
            success: true,
            message: `Show ${newStatus ? 'activated' : 'deactivated'} successfully`,
            is_active: newStatus
        });
    } catch (error) {
        console.error('Toggle show status error:', error);
        
        if (error.message === 'Show not found') {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Failed to toggle show status' });
    }
});

// DELETE /api/shows/:id - Delete show (with cascade to episodes)
router.delete('/:id', [
    param('id').isInt({ min: 1 })
], requireAuth, requirePermission('delete_shows'), logActivity('show_delete'), auditAction('show_delete'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        await Show.delete(req.params.id, req.user.id);
        
        res.json({
            success: true,
            message: 'Show and all associated episodes deleted successfully'
        });
    } catch (error) {
        console.error('Delete show error:', error);
        
        if (error.message === 'Show not found') {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Failed to delete show' });
    }
});

// POST /api/shows/:id/duplicate - Duplicate a show
router.post('/:id/duplicate', [
    param('id').isInt({ min: 1 }),
    body('name').notEmpty().trim().isLength({ min: 1, max: 255 })
], requireAuth, requirePermission('create_shows'), logActivity('show_duplicate'), auditAction('show_duplicate'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const originalShow = await Show.findById(req.params.id);
        if (!originalShow) {
            return res.status(404).json({ error: 'Original show not found' });
        }

        const duplicateData = {
            name: req.body.name,
            description: originalShow.description,
            color: originalShow.color,
            imageUrl: originalShow.image_url
        };

        const newShow = await Show.create(duplicateData, req.user.id);
        
        res.status(201).json({
            success: true,
            message: 'Show duplicated successfully',
            show: newShow
        });
    } catch (error) {
        console.error('Duplicate show error:', error);
        
        if (error.message === 'A show with this name already exists') {
            return res.status(409).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Failed to duplicate show' });
    }
});

// GET /api/shows/:id/episodes - Get episodes for a specific show
router.get('/:id/episodes', [
    param('id').isInt({ min: 1 }),
    query('published').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
], requireAuth, requirePermission('view_dashboard'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Verify show exists
        const show = await Show.findById(req.params.id);
        if (!show) {
            return res.status(404).json({ error: 'Show not found' });
        }

        // This would need Episode model - placeholder for now
        res.json({
            success: true,
            message: 'Episodes endpoint - requires Episode model implementation',
            show_id: req.params.id
        });
    } catch (error) {
        console.error('Get show episodes error:', error);
        res.status(500).json({ error: 'Failed to fetch show episodes' });
    }
});

// PUT /api/shows/:id/rss-url - Update RSS URL
router.put('/:id/rss-url', [
    param('id').isInt({ min: 1 }),
    body('rssUrl').isURL()
], requireAuth, requirePermission('edit_shows'), logActivity('show_rss_update'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const success = await Show.updateRSSUrl(req.params.id, req.body.rssUrl);
        
        if (!success) {
            return res.status(404).json({ error: 'Show not found' });
        }
        
        res.json({
            success: true,
            message: 'RSS URL updated successfully'
        });
    } catch (error) {
        console.error('Update RSS URL error:', error);
        res.status(500).json({ error: 'Failed to update RSS URL' });
    }
});

module.exports = router;