// routes/rss-sync.js - RSS sync cron job (similar to Vercel cron)
import express from 'express';
import { query } from '../lib/mysql.js';

const router = express.Router();

// POST /api/rss-sync - Weekly RSS sync cron job
router.post('/', async (req, res) => {
  // Verify this is a legitimate cron call
  const cronSecret = req.headers['x-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (cronSecret !== process.env.CRON_SECRET && cronSecret !== process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized cron job call' });
  }

  console.log('🔄 Starting RSS sync cron job...');
  const syncResults = {
    startTime: new Date().toISOString(),
    processed: 0,
    newEpisodes: 0,
    errors: [],
    feeds: []
  };

  try {
    // Get all shows with RSS URLs for syncing
    const showsWithRSS = await query(`
      SELECT id, name, slug, rss_url 
      FROM shows 
      WHERE rss_url IS NOT NULL 
      AND rss_url != '' 
      AND is_active = TRUE
    `);

    console.log(`📡 Found ${showsWithRSS.length} shows with RSS feeds to sync`);

    for (const show of showsWithRSS) {
      try {
        console.log(`🎙️ Syncing ${show.name} (${show.rss_url})`);
        
        const feedResult = await syncRSSFeed(show);
        syncResults.feeds.push(feedResult);
        syncResults.processed++;
        syncResults.newEpisodes += feedResult.newEpisodes;

      } catch (showError) {
        console.error(`❌ Error syncing ${show.name}:`, showError.message);
        syncResults.errors.push({
          show: show.name,
          error: showError.message
        });
      }
    }

    // Log the sync activity
    try {
      await query(`
        INSERT INTO activity_logs (user_id, action, entity_type, details, created_at)
        VALUES (1, 'rss_sync', 'cron', ?, NOW())
      `, [JSON.stringify(syncResults)]);
    } catch (logError) {
      console.log('Could not log sync activity:', logError.message);
    }

    syncResults.endTime = new Date().toISOString();
    syncResults.duration = new Date(syncResults.endTime) - new Date(syncResults.startTime);

    console.log('✅ RSS sync completed:', syncResults);

    return res.status(200).json({
      success: true,
      message: 'RSS sync completed successfully',
      results: syncResults
    });

  } catch (error) {
    console.error('❌ RSS sync failed:', error);
    
    syncResults.endTime = new Date().toISOString();
    syncResults.error = error.message;

    return res.status(500).json({
      success: false,
      error: 'RSS sync failed',
      results: syncResults
    });
  }
});

// GET /api/rss-sync - Manual trigger (admin only)
router.get('/', async (req, res) => {
  // Simple manual trigger for testing
  res.json({
    message: 'RSS sync endpoint ready',
    info: 'Use POST with proper authentication to trigger sync',
    lastSync: await getLastSyncTime()
  });
});

// Helper function to sync a single RSS feed
async function syncRSSFeed(show) {
  const result = {
    showId: show.id,
    showName: show.name,
    feedUrl: show.rss_url,
    newEpisodes: 0,
    updatedEpisodes: 0,
    errors: []
  };

  try {
    // Fetch RSS feed
    const response = await fetch(show.rss_url, {
      headers: {
        'User-Agent': 'CastBuzz RSS Sync Bot 1.0'
      },
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rssText = await response.text();
    
    // Parse RSS feed (basic XML parsing)
    const episodes = parseRSSFeed(rssText);
    
    console.log(`📊 Found ${episodes.length} episodes in ${show.name} RSS feed`);

    // Process each episode
    for (const episodeData of episodes) {
      try {
        // Check if episode already exists
        const existingEpisodes = await query(
          'SELECT id FROM episodes WHERE audio_url = ? AND show_id = ?',
          [episodeData.audioUrl, show.id]
        );

        if (existingEpisodes.length === 0) {
          // Create new episode
          await createEpisodeFromRSS(show.id, episodeData);
          result.newEpisodes++;
          console.log(`➕ Added new episode: ${episodeData.title}`);
        } else {
          // Optionally update existing episode
          result.updatedEpisodes++;
        }

      } catch (episodeError) {
        result.errors.push({
          episode: episodeData.title,
          error: episodeError.message
        });
      }
    }

    // Update show's last sync time
    await query(
      'UPDATE shows SET updated_at = NOW() WHERE id = ?',
      [show.id]
    );

  } catch (fetchError) {
    result.errors.push({
      type: 'fetch',
      error: fetchError.message
    });
  }

  return result;
}

// Helper function to parse RSS feed
function parseRSSFeed(rssXml) {
  const episodes = [];
  
  try {
    // Basic regex-based RSS parsing (you might want to use a proper XML parser)
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items = [...rssXml.matchAll(itemRegex)];

    for (const item of items) {
      const itemContent = item[1];
      
      const title = extractXmlTag(itemContent, 'title');
      const description = extractXmlTag(itemContent, 'description');
      const audioUrl = extractEnclosureUrl(itemContent);
      const pubDate = extractXmlTag(itemContent, 'pubDate');
      const duration = extractXmlTag(itemContent, 'itunes:duration');

      if (title && audioUrl) {
        episodes.push({
          title: cleanHtml(title),
          description: cleanHtml(description),
          audioUrl,
          pubDate: pubDate ? new Date(pubDate) : new Date(),
          duration: duration || '00:00'
        });
      }
    }

  } catch (parseError) {
    console.error('RSS parsing error:', parseError);
  }

  return episodes.slice(0, 10); // Limit to 10 most recent episodes
}

// Helper functions for XML parsing
function extractXmlTag(content, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function extractEnclosureUrl(content) {
  const enclosureRegex = /<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i;
  const match = content.match(enclosureRegex);
  return match ? match[1] : '';
}

function cleanHtml(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

// Helper function to create episode from RSS data
async function createEpisodeFromRSS(showId, episodeData) {
  // Generate slug from title
  const slug = episodeData.title.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Check for slug conflicts
  const existingSlugs = await query(
    'SELECT id FROM episodes WHERE slug LIKE ? AND show_id = ?',
    [`${slug}%`, showId]
  );

  const finalSlug = existingSlugs.length > 0 
    ? `${slug}-${Date.now()}` 
    : slug;

  // Insert episode
  const result = await query(`
    INSERT INTO episodes (
      show_id, title, slug, description, audio_url, duration,
      publish_date, is_published, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, 1)
  `, [
    showId,
    episodeData.title.substring(0, 255), // Limit title length
    finalSlug,
    episodeData.description.substring(0, 2000), // Limit description length
    episodeData.audioUrl,
    episodeData.duration,
    episodeData.pubDate
  ]);

  // Update show episode count
  await query(
    'UPDATE shows SET episode_count = (SELECT COUNT(*) FROM episodes WHERE show_id = ? AND is_published = TRUE) WHERE id = ?',
    [showId, showId]
  );

  return result.insertId;
}

// Helper function to get last sync time
async function getLastSyncTime() {
  try {
    const logs = await query(`
      SELECT created_at 
      FROM activity_logs 
      WHERE action = 'rss_sync' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    return logs.length > 0 ? logs[0].created_at : null;
  } catch (error) {
    return null;
  }
}

export default router;