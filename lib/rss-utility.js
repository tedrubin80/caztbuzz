// lib/rss-utils.js
// RSS feed utility functions

const RSS = require('rss');
const config = require('../config/app.config');

class RSSManager {
    static generatePodcastFeed(show, episodes) {
        const feed = new RSS({
            title: show.name,
            description: show.description || `Podcast episodes from ${show.name}`,
            feed_url: `${config.app.url}/api/rss/${show.slug}`,
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
                'podcast': 'https://podcastindex.org/namespace/1.0',
                'googleplay': 'http://www.google.com/schemas/play-podcasts/1.0'
            },
            custom_elements: this.getShowMetadata(show)
        });

        // Add episodes
        episodes.forEach(episode => {
            feed.item(this.getEpisodeItem(show, episode));
        });

        return feed;
    }

    static getShowMetadata(show) {
        return [
            {'itunes:subtitle': show.description?.substring(0, 255) || ''},
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
            {'itunes:complete': 'no'},
            {'googleplay:author': show.name},
            {'googleplay:description': show.description || ''},
            {'googleplay:category': {_attr: {text: 'Technology'}}},
            {'googleplay:image': {
                _attr: {
                    href: show.image_url || `${config.app.url}/default-podcast-image.jpg`
                }
            }},
            {'language': 'en-us'}
        ];
    }

    static getEpisodeItem(show, episode) {
        const episodeUrl = `${config.app.url}/episode/${show.slug}/${episode.slug}`;
        
        return {
            title: episode.title,
            description: this.formatDescription(episode.description),
            url: episodeUrl,
            guid: `${config.app.url}/episode/${episode.id}`,
            date: episode.publish_date,
            enclosure: {
                url: episode.audio_url,
                type: this.getAudioMimeType(episode.audio_url),
                size: episode.file_size || 0
            },
            custom_elements: [
                {'itunes:title': episode.title},
                {'itunes:subtitle': episode.description ? episode.description.substring(0, 255) : ''},
                {'itunes:summary': episode.description || ''},
                {'itunes:duration': this.formatDuration(episode.duration)},
                {'itunes:image': {
                    _attr: {
                        href: episode.image_url || show.image_url || `${config.app.url}/default-episode-image.jpg`
                    }
                }},
                {'itunes:explicit': 'false'},
                {'itunes:episodeType': 'full'},
                {'content:encoded': this.formatDescription(episode.description, true)},
                {'googleplay:description': episode.description || ''},
                {'googleplay:image': {
                    _attr: {
                        href: episode.image_url || show.image_url || `${config.app.url}/default-episode-image.jpg`
                    }
                }},
                ...(episode.season && [{'itunes:season': episode.season}]),
                ...(episode.episode_number && [{'itunes:episode': episode.episode_number}])
            ]
        };
    }

    static formatDescription(description, isHTML = false) {
        if (!description) return '';
        
        if (isHTML) {
            // Convert line breaks to HTML
            return description.replace(/\n/g, '<br/>');
        }
        
        // Strip HTML for plain text fields
        return description.replace(/<[^>]*>/g, '');
    }

    static formatDuration(duration) {
        if (!duration) return '00:00:00';
        
        // If duration is in seconds
        if (typeof duration === 'number') {
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration % 3600) / 60);
            const seconds = Math.floor(duration % 60);
            
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // If duration is already formatted
        if (typeof duration === 'string') {
            const parts = duration.split(':');
            if (parts.length === 2) {
                return `00:${duration}`;
            }
            return duration;
        }
        
        return '00:00:00';
    }

    static getAudioMimeType(audioUrl) {
        const extension = audioUrl.split('.').pop().toLowerCase();
        
        const mimeTypes = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'm4a': 'audio/mp4',
            'aac': 'audio/aac',
            'flac': 'audio/flac'
        };
        
        return mimeTypes[extension] || 'audio/mpeg';
    }

    static validateFeed(show, episodes) {
        const validation = {
            valid: true,
            warnings: [],
            errors: []
        };

        // Required fields
        if (!show.name) {
            validation.errors.push('Show title is required');
            validation.valid = false;
        }

        if (!show.description) {
            validation.warnings.push('Show description improves discoverability');
        }

        if (!show.image_url) {
            validation.errors.push('Show artwork is required for podcast directories');
            validation.valid = false;
        }

        // Episode validation
        episodes.forEach(episode => {
            if (!episode.audio_url) {
                validation.errors.push(`Episode "${episode.title}" missing audio file`);
                validation.valid = false;
            }

            if (!episode.title) {
                validation.errors.push('Episode title is required');
                validation.valid = false;
            }

            if (!episode.duration) {
                validation.warnings.push(`Episode "${episode.title}" missing duration`);
            }
        });

        return validation;
    }

    static generateSubmissionUrls(feedUrl) {
        return {
            apple_podcasts: `https://podcastsconnect.apple.com/my-podcasts/new-feed?url=${encodeURIComponent(feedUrl)}`,
            spotify: 'https://podcasters.spotify.com/submit',
            google_podcasts: 'https://podcastsmanager.google.com/add-feed',
            podcast_index: `https://api.podcastindex.org/api/1.0/add/byfeedurl?url=${encodeURIComponent(feedUrl)}`,
            overcast: 'https://overcast.fm/podcasterinfo',
            pocket_casts: 'https://pocketcasts.com/submit/',
            castbox: 'https://castbox.fm/va/podcast-submit',
            stitcher: 'https://partners.stitcher.com/join'
        };
    }
}

module.exports = RSSManager;