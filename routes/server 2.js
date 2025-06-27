// server.js - CastBuzz Express server for Railway deployment
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './lib/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
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

// Serve static files
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    database: 'mysql',
    platform: 'railway'
  });
});

// Test database endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await query('SELECT 1 as test');
    const tables = await query('SHOW TABLES');
    
    res.json({
      success: true,
      message: 'Database connection successful',
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      tablesCount: tables.length,
      tables: tables.map(t => Object.values(t)[0])
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// Auth routes
import('./routes/auth.js').then(authModule => {
  app.use('/api/auth', authModule.default);
});

// Episodes routes  
import('./routes/episodes.js').then(episodesModule => {
  app.use('/api/episodes', episodesModule.default);
});

// Shows routes
import('./routes/shows.js').then(showsModule => {
  app.use('/api/shows', showsModule.default);
});

// Analytics routes
import('./routes/analytics.js').then(analyticsModule => {
  app.use('/api/analytics', analyticsModule.default);
});

// RSS Sync cron route
import('./routes/rss-sync.js').then(rssSyncModule => {
  app.use('/api/rss-sync', rssSyncModule.default);
});

// Admin sync route
import('./routes/admin-sync.js').then(adminSyncModule => {
  app.use('/api/admin', adminSyncModule.default);
});

// RSS routes
app.get('/api/rss/:showSlug', async (req, res) => {
  try {
    const { showSlug } = req.params;
    
    // Get show
    const shows = await query('SELECT * FROM shows WHERE slug = ? AND is_active = TRUE', [showSlug]);
    if (shows.length === 0) {
      return res.status(404).send('Show not found');
    }
    
    const show = shows[0];
    
    // Get episodes
    const episodes = await query(
      'SELECT * FROM episodes WHERE show_id = ? AND is_published = TRUE ORDER BY publish_date DESC LIMIT 50',
      [show.id]
    );
    
    // Generate RSS feed
    const rss = generateRSSFeed(show, episodes);
    
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(rss);
  } catch (error) {
    console.error('RSS generation error:', error);
    res.status(500).send('RSS feed generation failed');
  }
});

// Basic RSS feed generator
function generateRSSFeed(show, episodes) {
  const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  
  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeXml(show.name)}</title>
    <description>${escapeXml(show.description || 'Podcast episodes')}</description>
    <link>${baseUrl}</link>
    <language>en-us</language>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <itunes:author>${escapeXml(show.name)}</itunes:author>
    <itunes:summary>${escapeXml(show.description || 'Podcast episodes')}</itunes:summary>
    <itunes:category text="Technology"/>
    ${show.image_url ? `<itunes:image href="${show.image_url}"/>` : ''}
    <itunes:explicit>false</itunes:explicit>
`;

  episodes.forEach(episode => {
    rss += `
    <item>
      <title>${escapeXml(episode.title)}</title>
      <description>${escapeXml(episode.description || '')}</description>
      <pubDate>${new Date(episode.publish_date).toUTCString()}</pubDate>
      <guid>${baseUrl}/episode/${episode.id}</guid>
      ${episode.audio_url ? `<enclosure url="${episode.audio_url}" type="audio/mpeg"/>` : ''}
      <itunes:duration>${episode.duration || '00:00'}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
    </item>`;
  });

  rss += `
  </channel>
</rss>`;

  return rss;
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Main app route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    res.status(404).send('<h1>404 - Page Not Found</h1><p>CastBuzz page not found</p>');
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CastBuzz server running on port ${PORT}`);
  console.log(`📱 Admin: http://localhost:${PORT}/admin`);
  console.log(`🎙️ Frontend: http://localhost:${PORT}`);
  console.log(`🔧 Health: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ Database: ${process.env.DB_HOST}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});