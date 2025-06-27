// api/rss.js
// RSS feed generation API for podcast distribution

const express = require('express');
const router = express.Router();
const RSS = require('rss');
const { param, validationResult } = require('express-validator');
const Show = require('../models/Show');
const Episode = require('../models/Episode');
const config = require('../config/app.config');

// GET /api/rss/:showSlug - Generate RSS feed for show
router.get('/:showSlug', [
    param('showSlug').notEmpty().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { showSlug } = req.params;
        
        // Find show by slug
        const show = await Show.findBySlug(showSlug);
        if (!show || !show.is_active) {
            return res.status(404).json({ error: 'Show not found' });
        }

        // Get published episodes
        const episodes = await Episode.getEpisodesByShow(show.id, true);

        // Generate RSS feed
        const feed = new RSS({
            title: show.name,
            description: show.description || `Podcast episodes from ${show.name}`,
            feed_url: `${config.app.url}/api/rss/${showSlug}`,
            site_url: config.app.url,
            image_url: show.image_url,
            managingEditor: config.app.adminEmail,
            webMaster: config.app.adminEmail,
            copyright: `© ${new Date().getFullYear()} ${show.name}`,
            language: 'en-us',
            categories: ['Technology', 'Education'],
            pubDate: episodes[0]?.publish_date || new Date(),
            ttl: 60,
            custom_namespaces: {
                'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
                'content': 'http://purl.org/rss/1.0/modules/content/',
                'podcast': 'https://podcastindex.org/namespace/1.0'
            },
            custom_elements: [
                {'itunes:subtitle': show.description || ''},
                {'itunes:author': show.name},
                {'itunes:summary': show.description || ''},
                {'itunes:owner': [
                    {'itunes:name': show.name},
                    {'itunes:email': config.app.adminEmail}
                ]},
                {'itunes:image': {
                    _attr: {
                        href: show.image_url || `${config.app.url}/default-podcast-image.jpg`
                    }
                }},
                {'itunes:category': [
                    {_attr: {text: 'Technology'}},
                    {'itunes:category': {_attr: {text: 'Podcasting'}}}
                ]},
                {'itunes:explicit': 'false'},
                {'itunes:type': 'episodic'},
                {'language': 'en-us'}
            ]
        });

        // Add episodes to feed
        episodes.forEach(episode => {
            const episodeUrl = `${config.app.url}/episode/${show.slug}/${episode.slug}`;
            
            feed.item({
                title: episode.title,
                description: episode.description || '',
                url: episodeUrl,
                guid: `${config.app.url}/episode/${episode.id}`,
                date: episode.publish_date,
                enclosure: {
                    url: episode.audio_url,
                    type: 'audio/mpeg'
                },
                custom_elements: [
                    {'itunes:title': episode.title},
                    {'itunes:subtitle': episode.description ? episode.description.substring(0, 255) : ''},
                    {'itunes:summary': episode.description || ''},
                    {'itunes:duration': episode.duration || '00:00:00'},
                    {'itunes:image': {
                        _attr: {
                            href: episode.image_url || show.image_url || `${config.app.url}/default-episode-image.jpg`
                        }
                    }},
                    {'itunes:explicit': 'false'},
                    {'itunes:episodeType': 'full'},
                    ...(episode.season && [{'itunes:season': episode.season}]),
                    ...(episode.episode_number && [{'itunes:episode': episode.episode_number}])
                ]
            });
        });

        // Set proper headers
        res.set({
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'Last-Modified': new Date(show.updated_at).toUTCString()
        });

        res.send(feed.xml({ indent: true }));
    } catch (error) {
        console.error('RSS generation error:', error);
        res.status(500).json({ error: 'Failed to generate RSS feed' });
    }
});

// GET /api/rss/:showSlug/validate - Validate RSS feed
router.get('/:showSlug/validate', [
    param('showSlug').notEmpty().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { showSlug } = req.params;
        
        const show = await Show.findBySlug(showSlug);
        if (!show || !show.is_active) {
            return res.status(404).json({ error: 'Show not found' });
        }

        const episodes = await Episode.getEpisodesByShow(show.id, true);
        
        const validation = {
            valid: true,
            warnings: [],
            errors: [],
            info: {
                show_name: show.name,
                episode_count: episodes.length,
                feed_url: `${config.app.url}/api/rss/${showSlug}`
            }
        };

        // Validate required fields
        if (!show.name) {
            validation.errors.push('Show name is required');
            validation.valid = false;
        }

        if (!show.description) {
            validation.warnings.push('Show description is recommended for better discoverability');
        }

        if (!show.image_url) {
            validation.warnings.push('Show artwork is required for iTunes/Apple Podcasts');
        }

        // Validate episodes
        episodes.forEach((episode, index) => {
            if (!episode.audio_url) {
                validation.errors.push(`Episode "${episode.title}" missing audio URL`);
                validation.valid = false;
            }

            if (!episode.duration) {
                validation.warnings.push(`Episode "${episode.title}" missing duration`);
            }

            if (!episode.description) {
                validation.warnings.push(`Episode "${episode.title}" missing description`);
            }
        });

        if (episodes.length === 0) {
            validation.warnings.push('No published episodes found');
        }

        res.json(validation);
    } catch (error) {
        console.error('RSS validation error:', error);
        res.status(500).json({ error: 'Failed to validate RSS feed' });
    }
});

// POST /api/rss/:showSlug/regenerate - Force regenerate RSS feed
router.post('/:showSlug/regenerate', [
    param('showSlug').notEmpty().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { showSlug } = req.params;
        
        const show = await Show.findBySlug(showSlug);
        if (!show) {
            return res.status(404).json({ error: 'Show not found' });
        }

        // Update RSS URL in show
        const rssUrl = `${config.app.url}/api/rss/${showSlug}`;
        await Show.updateRSSUrl(show.id, rssUrl);

        res.json({
            success: true,
            message: 'RSS feed regenerated successfully',
            feed_url: rssUrl
        });
    } catch (error) {
        console.error('RSS regeneration error:', error);
        res.status(500).json({ error: 'Failed to regenerate RSS feed' });
    }
});

// GET /api/rss - List all available RSS feeds
router.get('/', async (req, res) => {
    try {
        const shows = await Show.getShowsWithEpisodes();
        
        const feeds = shows.map(show => ({
            show_id: show.id,
            show_name: show.name,
            show_slug: show.slug,
            episode_count: show.episode_count,
            feed_url: `${config.app.url}/api/rss/${show.slug}`,
            last_updated: show.latest_episode_date
        }));

        res.json({
            success: true,
            feeds,
            count: feeds.length
        });
    } catch (error) {
        console.error('List RSS feeds error:', error);
        res.status(500).json({ error: 'Failed to list RSS feeds' });
    }
});

module.exports = router;