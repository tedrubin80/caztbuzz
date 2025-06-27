// api/rss/[showId].js
// RSS Feed Generator for individual podcast shows

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { showId } = req.query;
  
  if (!showId) {
    return res.status(400).json({ error: 'Show ID is required' });
  }

  try {
    // Get show and episodes data
    const shows = await kv.get('shows') || [];
    const episodes = await kv.get('episodes') || [];
    
    const show = shows.find(s => s.id === showId);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }
    
    const showEpisodes = episodes
      .filter(ep => ep.show === showId)
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first
    
    // Generate RSS XML
    const rssXml = generateRSSFeed(show, showEpisodes, req);
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    return res.status(200).send(rssXml);
  } catch (error) {
    console.error('RSS Generation Error:', error);
    return res.status(500).json({ error: 'Failed to generate RSS feed' });
  }
}

function generateRSSFeed(show, episodes, req) {
  const baseUrl = `https://${req.headers.host}`;
  const currentDate = new Date().toUTCString();
  
  // Escape XML special characters
  const escapeXml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Generate episode items
  const episodeItems = episodes.map(episode => {
    const pubDate = new Date(episode.date).toUTCString();
    const audioUrl = episode.audioUrl || `${baseUrl}/audio/${episode.id}.mp3`;
    const episodeUrl = `${baseUrl}/episode/${episode.id}`;
    
    return `
    <item>
      <title>${escapeXml(episode.title)}</title>
      <description><![CDATA[${episode.description}]]></description>
      <link>${episodeUrl}</link>
      <guid isPermaLink="true">${episodeUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${audioUrl}" type="audio/mpeg" />
      <itunes:author>CastBuzz</itunes:author>
      <itunes:subtitle>${escapeXml(episode.title)}</itunes:subtitle>
      <itunes:summary><![CDATA[${episode.description}]]></itunes:summary>
      <itunes:duration>${episode.duration || '00:00'}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      ${episode.imageUrl ? `<itunes:image href="${episode.imageUrl}" />` : ''}
    </item>`;
  }).join('');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(show.name)} - CastBuzz</title>
    <description><![CDATA[${show.description}]]></description>
    <link>${baseUrl}/show/${show.id}</link>
    <language>en-us</language>
    <copyright>© ${new Date().getFullYear()} CastBuzz</copyright>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <pubDate>${episodes.length > 0 ? new Date(episodes[0].date).toUTCString() : currentDate}</pubDate>
    <ttl>60</ttl>
    <generator>CastBuzz Podcast Network</generator>
    
    <!-- Self-referencing URL -->
    <atom:link href="${baseUrl}/api/rss/${show.id}" rel="self" type="application/rss+xml" />
    
    <!-- iTunes-specific tags -->
    <itunes:author>CastBuzz</itunes:author>
    <itunes:summary><![CDATA[${show.description}]]></itunes:summary>
    <itunes:owner>
      <itunes:name>CastBuzz</itunes:name>
      <itunes:email>hello@castbuzz.com</itunes:email>
    </itunes:owner>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="Technology" />
    <itunes:category text="Business" />
    <itunes:category text="Society &amp; Culture">
      <itunes:category text="Personal Journals" />
    </itunes:category>
    ${show.imageUrl ? `<itunes:image href="${show.imageUrl}" />` : `<itunes:image href="${baseUrl}/images/show-${show.id}.jpg" />`}
    
    <!-- Channel image for non-iTunes clients -->
    <image>
      <url>${show.imageUrl || `${baseUrl}/images/show-${show.id}.jpg`}</url>
      <title>${escapeXml(show.name)} - CastBuzz</title>
      <link>${baseUrl}/show/${show.id}</link>
    </image>
    
    ${episodeItems}
  </channel>
</rss>`;

  return rssXml;
}