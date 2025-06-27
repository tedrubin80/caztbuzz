// server.js - Railway-compatible Express server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Initialize Express app first
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting CastBuzz server...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔗 Port:', PORT);

// Basic middleware first
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

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['*'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint - MUST be first
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    memory: process.memoryUsage(),
    pid: process.pid
  };

  console.log('✅ Health check passed:', health);
  res.status(200).json(health);
});

// Test database endpoint (with error handling)
app.get('/api/test-db', async (req, res) => {
  try {
    // Only try to load database if config exists
    if (process.env.DB_HOST) {
      console.log('🔍 Testing database connection...');
      const db = require('./lib/database');
      const result = await db.query('SELECT 1 as test');
      
      res.json({
        success: true,
        message: 'Database connection successful',
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        result: result
      });
    } else {
      res.json({
        success: false,
        message: 'Database not configured - missing DB_HOST',
        environment: process.env.NODE_ENV
      });
    }
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Load API routes with error handling
try {
  console.log('📡 Loading API routes...');
  
  // Only load routes if files exist
  const fs = require('fs');
  
  if (fs.existsSync('./api/auth.js')) {
    app.use('/api/auth', require('./api/auth'));
    console.log('✅ Auth routes loaded');
  }
  
  if (fs.existsSync('./api/episodes.js')) {
    app.use('/api/episodes', require('./api/episodes'));
    console.log('✅ Episodes routes loaded');
  }
  
  if (fs.existsSync('./api/shows.js')) {
    app.use('/api/shows', require('./api/shows'));
    console.log('✅ Shows routes loaded');
  }
  
  if (fs.existsSync('./api/analytics.js')) {
    app.use('/api/analytics', require('./api/analytics'));
    console.log('✅ Analytics routes loaded');
  }
  
} catch (error) {
  console.warn('⚠️ Some API routes failed to load:', error.message);
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Basic routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CastBuzz</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .error { background: #ffe8e8; }
        code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>🎙️ CastBuzz Server</h1>
      <div class="status">
        <h3>✅ Server is running!</h3>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
        <p><strong>Port:</strong> ${PORT}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
      </div>
      
      <h3>Available Endpoints:</h3>
      <ul>
        <li><a href="/api/health">Health Check</a></li>
        <li><a href="/api/test-db">Database Test</a></li>
        <li><a href="/admin">Admin Panel</a></li>
      </ul>
      
      <h3>Environment Check:</h3>
      <ul>
        <li>Database Host: ${process.env.DB_HOST ? '✅ Configured' : '❌ Missing'}</li>
        <li>JWT Secret: ${process.env.JWT_SECRET ? '✅ Configured' : '❌ Missing'}</li>
        <li>Node Version: ${process.version}</li>
      </ul>
    </body>
    </html>
  `);
});

app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, 'public', 'admin.html');
  if (require('fs').existsSync(adminPath)) {
    res.sendFile(adminPath);
  } else {
    res.send(`
      <h1>Admin Panel</h1>
      <p>Admin panel file not found at: ${adminPath}</p>
      <p><a href="/">← Back to home</a></p>
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
      availableEndpoints: ['/api/health', '/api/test-db']
    });
  } else {
    res.status(404).send(`
      <h1>404 - Page Not Found</h1>
      <p>The page <code>${req.originalUrl}</code> was not found.</p>
      <p><a href="/">← Back to home</a></p>
    `);
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
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
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🎉 CastBuzz server started successfully!');
  console.log(`📍 Server running at: http://0.0.0.0:${PORT}`);
  console.log(`🏥 Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`📊 Admin panel: http://0.0.0.0:${PORT}/admin`);
  console.log('📋 Process ID:', process.pid);
  console.log('🔗 Environment variables loaded:', {
    NODE_ENV: process.env.NODE_ENV || 'not set',
    DB_HOST: process.env.DB_HOST ? 'configured' : 'missing',
    JWT_SECRET: process.env.JWT_SECRET ? 'configured' : 'missing'
  });
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

module.exports = app;