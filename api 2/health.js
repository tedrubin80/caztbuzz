// api/health.js
const express = require('express');
const router = express.Router();
const db = require('../lib/database');
const os = require('os');
const config = require('../config/app.config');

// GET /api/health - Basic health check
router.get('/', async (req, res) => {
    try {
        // Check database connection
        await db.query('SELECT 1');
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: config.app.env,
            version: config.app.version
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Database connection failed'
        });
    }
});

// GET /api/health/detailed - Detailed health check (requires auth)
router.get('/detailed', async (req, res) => {
    // Simple auth check - you might want to use a special health check token
    const authToken = req.headers['x-health-token'];
    if (authToken !== process.env.HEALTH_CHECK_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        // Database check
        const dbStart = Date.now();
        await db.query('SELECT 1');
        const dbLatency = Date.now() - dbStart;
        
        // Get database stats
        const [dbStats] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as userCount,
                (SELECT COUNT(*) FROM shows) as showCount,
                (SELECT COUNT(*) FROM episodes) as episodeCount,
                (SELECT COUNT(*) FROM user_sessions WHERE last_activity > DATE_SUB(NOW(), INTERVAL 1 HOUR)) as activeSessions
        `);
        
        // System info
        const systemInfo = {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
                usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%'
            },
            cpu: {
                model: os.cpus()[0].model,
                cores: os.cpus().length,
                loadAverage: os.loadavg()
            },
            uptime: {
                system: os.uptime(),
                process: process.uptime()
            }
        };
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            application: {
                name: config.app.name,
                version: config.app.version,
                environment: config.app.env,
                url: config.app.url
            },
            database: {
                status: 'connected',
                latency: `${dbLatency}ms`,
                stats: dbStats
            },
            system: systemInfo,
            services: {
                s3: await checkS3Health(),
                email: await checkEmailHealth()
            }
        });
    } catch (error) {
        console.error('Detailed health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Helper function to check S3 health
async function checkS3Health() {
    try {
        // TODO: Implement actual S3 health check
        // For now, just check if credentials are configured
        const isConfigured = !!(
            process.env.S3_ACCESS_KEY_ID && 
            process.env.S3_SECRET_ACCESS_KEY && 
            process.env.S3_BUCKET
        );
        
        return {
            status: isConfigured ? 'configured' : 'not_configured',
            bucket: process.env.S3_BUCKET || 'not_set'
        };
    } catch (error) {
        return {
            status: 'error',
            error: error.message
        };
    }
}

// Helper function to check email service health
async function checkEmailHealth() {
    try {
        // TODO: Implement actual SMTP health check
        // For now, just check if SMTP is configured
        const isConfigured = !!(
            process.env.SMTP_HOST && 
            process.env.SMTP_USER && 
            process.env.SMTP_PASS
        );
        
        return {
            status: isConfigured ? 'configured' : 'not_configured',
            provider: process.env.SMTP_HOST || 'not_set'
        };
    } catch (error) {
        return {
            status: 'error',
            error: error.message
        };
    }
}

module.exports = router;