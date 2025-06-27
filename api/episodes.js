// api/episodes.js - MySQL version for episodes management
import { query } from '../lib/mysql.js';
import { verifyAdmin } from './auth.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetEpisodes(req, res);
      case 'POST':
        return await handleCreateEpisode(req, res);
      case 'PUT':
        return await handleUpdateEpisode(req, res);
      case 'DELETE':
        return await handleDeleteEpisode(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Episodes API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/episodes - Get episodes
async function handleGetEpisodes(req, res) {
  const { show, limit = 50, search, published = 'true' } = req.query;
  
  let sql = `
    SELECT 
      e.id,
      e.title,
      e.slug,
      e.description,
      e.audio_url,
      e.image_url,
      e.duration,
      e.season,
      e.episode_number,
      e.publish_date,
      e.is_published,
      e.play_count,
      e.download_count,
      e.created_at,
      s.id as show_id,
      s.name as show_name,
      s.slug as show_slug,
      s.color as show_color
    FROM episodes e 
    LEFT JOIN shows s ON e.show_id = s.id
    WHERE 1=1
  `;
  
  const params = [];

  // Filter by published status
  if (published === 'true') {
    sql += ' AND e.is_published = TRUE';
  }

  // Filter by show
  if (show) {
    sql += ' AND s.slug = ?';
    params.push(show);
  }

  // Search functionality
  if (search) {
    sql += ' AND (e.title LIKE ? OR e.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY e.publish_date DESC LIMIT ?';
  params.push(parseInt(limit));

  const episodes = await query(sql, params);
  
  return res.status(200).json({ 
    episodes: episodes || [],
    count: episodes ? episodes.length : 0
  });
}

// POST /api/episodes - Create new episode (Admin only)
async function handleCreateEpisode(req, res) {
  const adminCheck = await verifyAdmin(req);
  if (!adminCheck.valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { 
    title, 
    show_id, 
    description, 
    audio_url, 
    image_url, 
    duration, 
    season, 
    episode_number,
    is_published = false 
  } = req.body;
  
  if (!title || !show_id || !audio_url) {
    return res.status(400).json({ 
      error: 'Missing required fields: title, show_id, audio_url' 
    });
  }

  try {
    // Check if show exists
    const shows = await query('SELECT id FROM shows WHERE id = ?', [show_id]);
    if (shows.length === 0) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Generate slug from title
    const slug = title.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug exists in this show
    const existingEpisodes = await query(
      'SELECT id FROM episodes WHERE slug = ? AND show_id = ?',
      [slug, show_id]
    );

    let finalSlug = slug;
    if (existingEpisodes.length > 0) {
      finalSlug = `${slug}-${Date.now()}`;
    }

    // Insert new episode
    const insertResult = await query(`
      INSERT INTO episodes (
        title, slug, show_id, description, audio_url, image_url, 
        duration, season, episode_number, is_published, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title, finalSlug, show_id, description, audio_url, image_url,
      duration, season, episode_number, is_published, adminCheck.user.id
    ]);

    // Get the created episode with show details
    const episodes = await query(`
      SELECT 
        e.*,
        s.name as show_name,
        s.slug as show_slug,
        s.color as show_color
      FROM episodes e 
      LEFT JOIN shows s ON e.show_id = s.id
      WHERE e.id = ?
    `, [insertResult.insertId]);

    // Update show episode count
    await query(
      'UPDATE shows SET episode_count = (SELECT COUNT(*) FROM episodes WHERE show_id = ? AND is_published = TRUE) WHERE id = ?',
      [show_id, show_id]
    );

    return res.status(201).json({ 
      success: true,
      message: 'Episode created successfully',
      episode: episodes[0] 
    });

  } catch (error) {
    console.error('Create episode error:', error);
    return res.status(500).json({ error: 'Failed to create episode' });
  }
}

// PUT /api/episodes - Update episode (Admin only)
async function handleUpdateEpisode(req, res) {
  const adminCheck = await verifyAdmin(req);
  if (!adminCheck.valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  const updates = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Episode ID required' });
  }

  try {
    // Check if episode exists
    const episodes = await query('SELECT * FROM episodes WHERE id = ?', [parseInt(id)]);
    if (episodes.length === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const episode = episodes[0];

    // Build dynamic update query
    const allowedFields = [
      'title', 'description', 'audio_url', 'image_url', 
      'duration', 'season', 'episode_number', 'is_published'
    ];
    
    const updateFields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Update slug if title changed
    if (updates.title && updates.title !== episode.title) {
      const newSlug = updates.title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      updateFields.push('slug = ?');
      values.push(newSlug);
    }

    updateFields.push('updated_at = NOW()');
    values.push(parseInt(id));

    const sql = `UPDATE episodes SET ${updateFields.join(', ')} WHERE id = ?`;
    await query(sql, values);

    // Get updated episode
    const updatedEpisodes = await query(`
      SELECT 
        e.*,
        s.name as show_name,
        s.slug as show_slug,
        s.color as show_color
      FROM episodes e 
      LEFT JOIN shows s ON e.show_id = s.id
      WHERE e.id = ?
    `, [parseInt(id)]);

    // Update show episode count if published status changed
    if (updates.is_published !== undefined) {
      await query(
        'UPDATE shows SET episode_count = (SELECT COUNT(*) FROM episodes WHERE show_id = ? AND is_published = TRUE) WHERE id = ?',
        [episode.show_id, episode.show_id]
      );
    }

    return res.status(200).json({ 
      success: true,
      message: 'Episode updated successfully',
      episode: updatedEpisodes[0] 
    });

  } catch (error) {
    console.error('Update episode error:', error);
    return res.status(500).json({ error: 'Failed to update episode' });
  }
}

// DELETE /api/episodes - Delete episode (Admin only)
async function handleDeleteEpisode(req, res) {
  const adminCheck = await verifyAdmin(req);
  if (!adminCheck.valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Episode ID required' });
  }

  try {
    // Check if episode exists and get show_id
    const episodes = await query('SELECT show_id FROM episodes WHERE id = ?', [parseInt(id)]);
    if (episodes.length === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const showId = episodes[0].show_id;

    // Delete episode
    await query('DELETE FROM episodes WHERE id = ?', [parseInt(id)]);

    // Update show episode count
    await query(
      'UPDATE shows SET episode_count = (SELECT COUNT(*) FROM episodes WHERE show_id = ? AND is_published = TRUE) WHERE id = ?',
      [showId, showId]
    );

    return res.status(200).json({ 
      success: true, 
      message: 'Episode deleted successfully' 
    });

  } catch (error) {
    console.error('Delete episode error:', error);
    return res.status(500).json({ error: 'Failed to delete episode' });
  }
}