// api/s3-config.js
// S3 upload management API

const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
const { body, validationResult } = require('express-validator');
const { requireAuth, requirePermission, logActivity } = require('../middleware/auth');
const db = require('../lib/database');
const config = require('../config/app.config');

// Configure AWS SDK for S3 or DigitalOcean Spaces
let s3Client = null;

// Initialize S3 client with current configuration
async function initializeS3Client() {
    try {
        const sql = 'SELECT * FROM s3_config WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1';
        const [s3Config] = await db.query(sql);
        
        if (!s3Config) {
            throw new Error('S3 configuration not found');
        }
        
        s3Client = new AWS.S3({
            endpoint: s3Config.endpoint,
            region: s3Config.region,
            accessKeyId: s3Config.access_key_id,
            secretAccessKey: s3Config.secret_access_key,
            s3ForcePathStyle: s3Config.use_path_style,
            signatureVersion: 'v4'
        });
        
        return s3Client;
    } catch (error) {
        console.error('Failed to initialize S3 client:', error);
        throw error;
    }
}

// GET /api/s3/config - Get current S3 configuration status
router.get('/config', requireAuth, requirePermission('view_dashboard'), async (req, res) => {
    try {
        const sql = `
            SELECT id, endpoint, region, bucket, use_path_style, is_active, created_at, updated_at
            FROM s3_config 
            WHERE is_active = TRUE 
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        const [config] = await db.query(sql);
        
        if (!config) {
            return res.json({
                configured: false,
                message: 'S3 storage not configured'
            });
        }
        
        res.json({
            configured: true,
            config: {
                endpoint: config.endpoint,
                region: config.region,
                bucket: config.bucket,
                usePathStyle: config.use_path_style,
                lastUpdated: config.updated_at
            }
        });
    } catch (error) {
        console.error('Get S3 config error:', error);
        res.status(500).json({ error: 'Failed to get S3 configuration' });
    }
});

// POST /api/s3/config - Save S3 configuration
router.post('/config', [
    body('endpoint').isURL().withMessage('Valid endpoint URL required'),
    body('region').notEmpty().trim().withMessage('Region is required'),
    body('bucket').notEmpty().trim().withMessage('Bucket name is required'),
    body('accessKeyId').notEmpty().trim().withMessage('Access key is required'),
    body('secretAccessKey').notEmpty().trim().withMessage('Secret key is required'),
    body('usePathStyle').optional().isBoolean()
], requireAuth, requirePermission('manage_storage'), logActivity('s3_config_save'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { endpoint, region, bucket, accessKeyId, secretAccessKey, usePathStyle = false } = req.body;
        
        // Deactivate existing configurations
        await db.query('UPDATE s3_config SET is_active = FALSE');
        
        // Insert new configuration
        const sql = `
            INSERT INTO s3_config (endpoint, region, bucket, access_key_id, secret_access_key, use_path_style, created_by, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
        `;
        
        await db.query(sql, [endpoint, region, bucket, accessKeyId, secretAccessKey, usePathStyle, req.user.id]);
        
        res.json({
            success: true,
            message: 'S3 configuration saved successfully'
        });
    } catch (error) {
        console.error('Save S3 config error:', error);
        res.status(500).json({ error: 'Failed to save S3 configuration' });
    }
});

// POST /api/s3/test - Test S3 connection
router.post('/test', requireAuth, requirePermission('manage_storage'), async (req, res) => {
    try {
        const s3 = await initializeS3Client();
        const sql = 'SELECT bucket FROM s3_config WHERE is_active = TRUE LIMIT 1';
        const [config] = await db.query(sql);
        
        if (!config) {
            return res.status(400).json({ error: 'S3 not configured' });
        }
        
        // Test bucket access
        await s3.headBucket({ Bucket: config.bucket }).promise();
        
        res.json({
            success: true,
            message: 'S3 connection successful',
            bucket: config.bucket
        });
    } catch (error) {
        console.error('S3 test error:', error);
        res.status(400).json({
            error: 'S3 connection failed',
            details: error.message
        });
    }
});

// POST /api/s3/upload-url - Generate presigned upload URL
router.post('/upload-url', [
    body('filename').notEmpty().trim().withMessage('Filename is required'),
    body('contentType').notEmpty().withMessage('Content type is required'),
    body('size').isInt({ min: 1 }).withMessage('Valid file size required'),
    body('entityType').isIn(['episode', 'show_cover', 'user_avatar']).withMessage('Invalid entity type'),
    body('entityId').optional().isInt({ min: 1 })
], requireAuth, requirePermission('upload_files'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { filename, contentType, size, entityType, entityId } = req.body;
        
        // Validate file size
        if (size > config.s3.maxFileSize) {
            return res.status(400).json({
                error: 'File too large',
                maxSize: config.s3.maxFileSize
            });
        }
        
        // Validate content type
        if (!config.s3.allowedMimeTypes.includes(contentType)) {
            return res.status(400).json({
                error: 'File type not allowed',
                allowedTypes: config.s3.allowedMimeTypes
            });
        }
        
        const s3 = await initializeS3Client();
        const s3Config = await db.query('SELECT bucket FROM s3_config WHERE is_active = TRUE LIMIT 1');
        const bucket = s3Config[0].bucket;
        
        // Generate unique key
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const extension = filename.split('.').pop();
        const key = `${entityType}/${timestamp}-${randomString}.${extension}`;
        
        // Generate presigned URL
        const params = {
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
            Expires: 3600, // 1 hour
            Conditions: [
                ['content-length-range', 0, size]
            ]
        };
        
        const presignedPost = s3.createPresignedPost(params);
        
        // Log upload request
        const logSql = `
            INSERT INTO file_uploads (user_id, filename, original_name, mime_type, file_size, s3_key, s3_bucket, entity_type, entity_id, upload_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `;
        
        const result = await db.query(logSql, [
            req.user.id,
            key,
            filename,
            contentType,
            size,
            key,
            bucket,
            entityType,
            entityId || null
        ]);
        
        res.json({
            success: true,
            uploadId: result.insertId,
            url: presignedPost.url,
            fields: presignedPost.fields,
            key: key
        });
    } catch (error) {
        console.error('Generate upload URL error:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
});

// POST /api/s3/upload-complete - Mark upload as complete
router.post('/upload-complete', [
    body('uploadId').isInt({ min: 1 }).withMessage('Valid upload ID required'),
    body('key').notEmpty().trim().withMessage('S3 key is required')
], requireAuth, requirePermission('upload_files'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { uploadId, key } = req.body;
        
        // Verify upload exists and belongs to user
        const sql = `
            SELECT * FROM file_uploads 
            WHERE id = ? AND user_id = ? AND s3_key = ?
        `;
        const [upload] = await db.query(sql, [uploadId, req.user.id, key]);
        
        if (!upload) {
            return res.status(404).json({ error: 'Upload not found' });
        }
        
        // Verify file exists in S3
        const s3 = await initializeS3Client();
        const s3Config = await db.query('SELECT bucket FROM s3_config WHERE is_active = TRUE LIMIT 1');
        const bucket = s3Config[0].bucket;
        
        try {
            await s3.headObject({ Bucket: bucket, Key: key }).promise();
        } catch (error) {
            return res.status(400).json({ error: 'File not found in storage' });
        }
        
        // Mark upload as complete
        const updateSql = `
            UPDATE file_uploads 
            SET upload_status = 'completed', completed_at = NOW() 
            WHERE id = ?
        `;
        await db.query(updateSql, [uploadId]);
        
        // Generate public URL
        const publicUrl = `${s3Config[0].endpoint}/${bucket}/${key}`;
        
        res.json({
            success: true,
            url: publicUrl,
            key: key
        });
    } catch (error) {
        console.error('Upload complete error:', error);
        res.status(500).json({ error: 'Failed to complete upload' });
    }
});

// DELETE /api/s3/file/:key - Delete file from S3
router.delete('/file/:key', requireAuth, requirePermission('delete_files'), async (req, res) => {
    try {
        const { key } = req.params;
        
        // Check if user owns this file or has admin permissions
        const sql = `
            SELECT * FROM file_uploads 
            WHERE s3_key = ? AND (user_id = ? OR ? IN ('super_admin', 'admin'))
        `;
        const [upload] = await db.query(sql, [key, req.user.id, req.user.role]);
        
        if (!upload) {
            return res.status(404).json({ error: 'File not found or access denied' });
        }
        
        const s3 = await initializeS3Client();
        const s3Config = await db.query('SELECT bucket FROM s3_config WHERE is_active = TRUE LIMIT 1');
        const bucket = s3Config[0].bucket;
        
        // Delete from S3
        await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
        
        // Mark as deleted in database
        await db.query('DELETE FROM file_uploads WHERE s3_key = ?', [key]);
        
        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// GET /api/s3/uploads - Get user's upload history
router.get('/uploads', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const sql = `
            SELECT id, filename, original_name, mime_type, file_size, entity_type, entity_id, 
                   upload_status, created_at, completed_at
            FROM file_uploads 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `;
        
        const uploads = await db.query(sql, [req.user.id, limit, offset]);
        
        res.json({
            success: true,
            uploads
        });
    } catch (error) {
        console.error('Get uploads error:', error);
        res.status(500).json({ error: 'Failed to get uploads' });
    }
});

// GET /api/s3/storage-stats - Get storage usage statistics
router.get('/storage-stats', requireAuth, requirePermission('view_analytics'), async (req, res) => {
    try {
        const sql = `
            SELECT 
                COUNT(*) as total_files,
                SUM(file_size) as total_size,
                COUNT(CASE WHEN upload_status = 'completed' THEN 1 END) as completed_uploads,
                COUNT(CASE WHEN upload_status = 'failed' THEN 1 END) as failed_uploads,
                entity_type,
                COUNT(*) as count_by_type
            FROM file_uploads 
            GROUP BY entity_type
        `;
        
        const stats = await db.query(sql);
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get storage stats error:', error);
        res.status(500).json({ error: 'Failed to get storage statistics' });
    }
});

module.exports = router;