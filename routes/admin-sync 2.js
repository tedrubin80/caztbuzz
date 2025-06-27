// routes/admin-sync.js - Manual RSS sync trigger for admin
import express from 'express';
import { verifyAdmin } from './auth.js';

const router = express.Router();

// POST /api/admin/sync-rss - Manual RSS sync trigger (Admin only)
router.post('/sync-rss', verifyAdmin, async (req, res) => {
  try {
    console.log('🔄 Manual RSS sync triggered by admin');
    
    // Call the RSS sync endpoint internally
    const syncModule = await import('./rss-sync.js');
    
    // Create a mock request/response for the RSS sync
    const mockReq = {
      headers: {
        'x-cron-secret': process.env.JWT_SECRET // Use JWT secret as cron secret
      },
      method: 'POST'
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          res.status(code).json({
            success: true,
            message: 'Manual RSS sync completed',
            trigger: 'admin',
            ...data
          });
        }
      })
    };
    
    // Trigger the sync
    const syncHandler = syncModule.default.stack.find(layer => 
      layer.route && layer.route.methods.post
    ).route.stack[0].handle;
    
    await syncHandler(mockReq, mockRes);
    
  } catch (error) {
    console.error('Manual RSS sync error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Manual RSS sync failed',
      message: error.message,
      trigger: 'admin'
    });
  }
});

// GET /api/admin/sync-status - Get last sync status
router.get('/sync-status', verifyAdmin, async (req, res) => {
  try {
    const { query } = await import('../lib/mysql.js');
    
    // Get last sync log
    const lastSync = await query(`
      SELECT created_at, details 
      FROM activity_logs 
      WHERE action = 'rss_sync' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    // Get shows with RSS URLs
    const showsWithRSS = await query(`
      SELECT id, name, rss_url, updated_at
      FROM shows 
      WHERE rss_url IS NOT NULL 
      AND rss_url != '' 
      AND is_active = TRUE
    `);
    
    res.json({
      success: true,
      lastSync: lastSync.length > 0 ? {
        date: lastSync[0].created_at,
        details: JSON.parse(lastSync[0].details || '{}')
      } : null,
      rssFeedsCount: showsWithRSS.length,
      showsWithRSS: showsWithRSS.map(show => ({
        id: show.id,
        name: show.name,
        rssUrl: show.rss_url,
        lastUpdated: show.updated_at
      })),
      nextScheduledSync: getNextMondaySync()
    });
    
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status'
    });
  }
});

// Helper function to calculate next Monday 6 AM UTC
function getNextMondaySync() {
  const now = new Date();
  const nextMonday = new Date(now);
  
  // Calculate days until next Monday
  const daysUntilMonday = (1 + 7 - now.getUTCDay()) % 7;
  if (daysUntilMonday === 0 && now.getUTCHours() < 6) {
    // If it's Monday and before 6 AM, sync is today
    nextMonday.setUTCHours(6, 0, 0, 0);
  } else {
    // Otherwise, next Monday
    nextMonday.setUTCDate(now.getUTCDate() + (daysUntilMonday || 7));
    nextMonday.setUTCHours(6, 0, 0, 0);
  }
  
  return nextMonday.toISOString();
}

export default router;