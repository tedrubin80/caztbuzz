// api/settings.js
// Application settings and configuration API

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { requireAuth, requirePermission, logActivity } = require('../middleware/auth');
const db = require('../lib/database');

// GET /api/settings - Get all settings
router.get('/', requireAuth, requirePermission('manage_settings'), async (req, res) => {
    try {
        const sql = 'SELECT setting_key, setting_value, category, description FROM settings ORDER BY category, setting_key';
        const settings = await db.query(sql);
        
        // Group by category
        const grouped = {};
        settings.forEach(setting => {
            if (!grouped[setting.category]) {
                grouped[setting.category] = {};
            }
            grouped[setting.category][setting.setting_key] = {
                value: setting.setting_value,
                description: setting.description
            };
        });
        
        res.json({
            success: true,
            settings: grouped
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// PUT /api/settings - Update settings
router.put('/', [
    body('settings').isObject()
], requireAuth, requirePermission('manage_settings'), logActivity('settings_update'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { settings } = req.body;
        
        // Update each setting
        for (const [category, categorySettings] of Object.entries(settings)) {
            for (const [key, value] of Object.entries(categorySettings)) {
                await updateSetting(category, key, value, req.user.id);
            }
        }
        
        res.json({
            success: true,
            message: 'Settings updated successfully'
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// GET /api/settings/email - Get email configuration
router.get('/email', requireAuth, requirePermission('manage_settings'), async (req, res) => {
    try {
        const sql = `
            SELECT setting_key, setting_value 
            FROM settings 
            WHERE category = 'email' 
            ORDER BY setting_key
        `;
        const emailSettings = await db.query(sql);
        
        const config = {};
        emailSettings.forEach(setting => {
            config[setting.setting_key] = setting.setting_value;
        });
        
        res.json({
            success: true,
            email_config: config
        });
    } catch (error) {
        console.error('Get email settings error:', error);
        res.status(500).json({ error: 'Failed to fetch email settings' });
    }
});

// POST /api/settings/email - Save email configuration
router.post('/email', [
    body('email_host').notEmpty().trim(),
    body('email_port').isInt({ min: 1, max: 65535 }),
    body('email_username').isEmail(),
    body('email_password').notEmpty(),
    body('email_protocol').isIn(['IMAP', 'POP']),
    body('email_secure').isBoolean(),
    body('from_name').notEmpty().trim(),
    body('from_email').isEmail()
], requireAuth, requirePermission('manage_settings'), logActivity('email_config_update'), async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const emailConfig = {
            email_host: req.body.email_host,
            email_port: req.body.email_port.toString(),
            email_username: req.body.email_username,
            email_password: req.body.email_password,
            email_protocol: req.body.email_protocol,
            email_secure: req.body.email_secure.toString(),
            from_name: req.body.from_name,
            from_email: req.body.from_email,
            enabled: 'true'
        };

        // Save email settings
        for (const [key, value] of Object.entries(emailConfig)) {
            await updateSetting('email', key, value, req.user.id);
        }
        
        res.json({
            success: true,
            message: 'Email configuration saved successfully'
        });
    } catch (error) {
        console.error('Save email config error:', error);
        res.status(500).json({ error: 'Failed to save email configuration' });
    }
});

// POST /api/settings/email/test - Test email configuration
router.post('/email/test', requireAuth, requirePermission('manage_settings'), async (req, res) => {
    try {
        const emailConfig = await getEmailConfig();
        
        if (!emailConfig.enabled) {
            return res.status(400).json({ error: 'Email not configured' });
        }

        // Test email connection
        const testResult = await testEmailConnection(emailConfig);
        
        if (testResult.success) {
            res.json({
                success: true,
                message: 'Email connection successful'
            });
        } else {
            res.status(400).json({
                error: 'Email connection failed',
                details: testResult.error
            });
        }
    } catch (error) {
        console.error('Email test error:', error);
        res.status(500).json({ error: 'Failed to test email connection' });
    }
});

// Helper functions
async function updateSetting(category, key, value, userId) {
    const sql = `
        INSERT INTO settings (category, setting_key, setting_value, updated_by, updated_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            setting_value = VALUES(setting_value),
            updated_by = VALUES(updated_by),
            updated_at = NOW()
    `;
    
    await db.query(sql, [category, key, value, userId]);
}

async function getEmailConfig() {
    const sql = 'SELECT setting_key, setting_value FROM settings WHERE category = "email"';
    const settings = await db.query(sql);
    
    const config = {};
    settings.forEach(setting => {
        config[setting.setting_key] = setting.setting_value;
    });
    
    return config;
}

async function testEmailConnection(config) {
    const nodemailer = require('nodemailer');
    
    try {
        const transporter = nodemailer.createTransporter({
            host: config.email_host,
            port: parseInt(config.email_port),
            secure: config.email_secure === 'true',
            auth: {
                user: config.email_username,
                pass: config.email_password
            }
        });
        
        await transporter.verify();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = router;