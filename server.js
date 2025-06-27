// server.js - Fixed Railway-compatible main server file
// Place this in ROOT directory (same level as package.json)

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting CastBuzz server...');
console.log('📂 Working directory:', process.cwd());
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔗 Port:', PORT);

// Basic security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['*'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CRITICAL: Health check endpoint for Railway (must be first)
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  });
});

// Test database connection (if environment variables exist)
app.get('/api/test-db', async (req, res) => {
  try {
    if (!process.env.DB_HOST) {
      return res.json({
        success: false,
        message: 'Database not configured - missing environment variables',
        environment: process.env.NODE_ENV || 'development',
        hint: 'Set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in Railway environment variables'
      });
    }

    // Only try to connect if we have the config files
    const fs = require('fs');
    if (fs.existsSync('./lib/database.js')) {
      console.log('🔍 Testing database connection...');
      const db = require('./lib/database');
      const result = await db.query('SELECT 1 as test, NOW() as timestamp');
      
      res.json({
        success: true,
        message: 'Database connection successful',
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        timestamp: result[0]?.timestamp
      });
    } else {
      res.json({
        success: false,
        message: 'Database module not found - lib/database.js missing',
        environment: process.env.NODE_ENV || 'development'
      });
    }
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'DATABASE_ERROR',
      hint: 'Check database credentials in Railway environment variables'
    });
  }
});

// Load API routes conditionally (only if files exist)
try {
  console.log('📡 Loading API routes...');
  const fs = require('fs');
  
  // Load routes only if they exist
  if (fs.existsSync('./api/auth.js')) {
    try {
      app.use('/api/auth', require('./api/auth'));
      console.log('✅ Auth routes loaded');
    } catch (error) {
      console.warn('⚠️ Auth routes failed to load:', error.message);
    }
  }
  
  if (fs.existsSync('./api/shows.js')) {
    try {
      app.use('/api/shows', require('./api/shows'));
      console.log('✅ Shows routes loaded');
    } catch (error) {
      console.warn('⚠️ Shows routes failed to load:', error.message);
    }
  }
  
  if (fs.existsSync('./api/episodes.js')) {
    try {
      app.use('/api/episodes', require('./api/episodes'));
      console.log('✅ Episodes routes loaded');
    } catch (error) {
      console.warn('⚠️ Episodes routes failed to load:', error.message);
    }
  }
  
  if (fs.existsSync('./api/analytics.js')) {
    try {
      app.use('/api/analytics', require('./api/analytics'));
      console.log('✅ Analytics routes loaded');
    } catch (error) {
      console.warn('⚠️ Analytics routes failed to load:', error.message);
    }
  }
  
} catch (error) {
  console.warn('⚠️ Some API routes failed to load:', error.message);
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Home page with status
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CastBuzz - Podcast Management</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          color: #333;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          background: white;
          margin-top: 50px;
          border-radius: 15px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .header h1 {
          color: #667eea;
          font-size: 2.5rem;
          margin-bottom: 10px;
        }
        .status {
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .endpoints {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
          margin: 30px 0;
        }
        .endpoint {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }
        .endpoint a {
          color: #667eea;
          text-decoration: none;
          font-weight: 500;
        }
        .endpoint a:hover {
          text-decoration: underline;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin: 20px 0;
        }
        .info-item {
          background: #f1f3f4;
          padding: 15px;
          border-radius: 8px;
        }
        .info-item strong {
          color: #667eea;
        }
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: bold;
        }
        .badge.success {
          background: #d4edda;
          color: #155724;
        }
        .badge.warning {
          background: #fff3cd;
          color: #856404;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎙️ CastBuzz</h1>
          <p>Podcast Management System</p>
        </div>
        
        <div class="status">
          <h3>✅ Server Running Successfully</h3>
          <div class="info-grid">
            <div><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</div>
            <div><strong>Port:</strong> ${PORT}</div>
            <div><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</div>
            <div><strong>Time:</strong> ${new Date().toLocaleString()}</div>
          </div>
        </div>
        
        <h3>🔗 Available Endpoints</h3>
        <div class="endpoints">
          <div class="endpoint">
            <strong>Health Check:</strong><br>
            <a href="/api/health" target="_blank">/api/health</a>
          </div>
          <div class="endpoint">
            <strong>Database Test:</strong><br>
            <a href="/api/test-db" target="_blank">/api/test-db</a>
          </div>
          <div class="endpoint">
            <strong>Admin Panel:</strong><br>
            <a href="/admin" target="_blank">/admin</a>
          </div>
        </div>
        
        <h3>🔧 System Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <strong>Node.js:</strong> ${process.version}
          </div>
          <div class="info-item">
            <strong>Platform:</strong> ${process.platform}
          </div>
          <div class="info-item">
            <strong>Memory:</strong> ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
          </div>
          <div class="info-item">
            <strong>PID:</strong> ${process.pid}
          </div>
        </div>
        
        <h3>📋 Configuration Status</h3>
        <div class="info-grid">
          <div class="info-item">
            <strong>Database:</strong> 
            <span class="badge ${process.env.DB_HOST ? 'success' : 'warning'}">
              ${process.env.DB_HOST ? '✅ Configured' : '⚠️ Not Set'}
            </span>
          </div>
          <div class="info-item">
            <strong>JWT Secret:</strong> 
            <span class="badge ${process.env.JWT_SECRET ? 'success' : 'warning'}">
              ${process.env.JWT_SECRET ? '✅ Configured' : '⚠️ Not Set'}
            </span>
          </div>
          <div class="info-item">
            <strong>CORS:</strong> 
            <span class="badge success">
              ${process.env.CORS_ORIGIN || '✅ Default (*)'}
            </span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Admin panel route
app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, 'public', 'admin.html');
  
  // Check if admin.html exists
  const fs = require('fs');
  if (fs.existsSync(adminPath)) {
    res.sendFile(adminPath);
  } else {
    res.send(`
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center;">
        <h1>🔧 Admin Panel</h1>
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Admin panel file not found</strong></p>
          <p>Looking for: <code>${adminPath}</code></p>
          <p>Please ensure <code>public/admin.html</code> exists in your project.</p>
        </div>
        <p><a href="/" style="color: #667eea;">← Back to home</a></p>
      </div>
    `);
  }
});

// 404 handler
app.use('*', (req, res) => {
  console.log('❓ 404 Not Found:', req.originalUrl);
  
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({ 
      error: 'API endpoint not found',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      availableEndpoints: ['/api/health', '/api/test-db']
    });
  } else {
    res.status(404).send(`
      <div style="font-family: system-ui, sans-serif; text-align: center; margin-top: 100px;">
        <h1>404 - Page Not Found</h1>
        <p>The page <code>${req.originalUrl}</code> was not found.</p>
        <p><a href="/" style="color: #667eea;">← Back to home</a></p>
      </div>
    `);
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully');  
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// CRITICAL: Start server with Railway-compatible binding
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🎉 CastBuzz server started successfully!');
  console.log(`📍 Server running at: http://0.0.0.0:${PORT}`);
  console.log(`🏥 Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`📊 Admin panel: http://0.0.0.0:${PORT}/admin`);
  console.log(`🌐 Home page: http://0.0.0.0:${PORT}`);
  console.log('📋 Server ready to receive requests!');
});

// Handle server startup errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
});

module.exports = app;