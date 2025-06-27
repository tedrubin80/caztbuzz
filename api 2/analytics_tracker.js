// js/analytics-tracker.js
// Client-side analytics tracking for podcast episodes

class PodcastAnalytics {
  constructor() {
    this.baseUrl = window.location.origin;
    this.sessionId = this.getSessionId();
    this.currentEpisode = null;
    this.startTime = null;
    this.lastPosition = 0;
    this.heartbeatInterval = null;
    this.userLocation = null;
    
    // Get user location (with permission)
    this.getUserLocation();
  }

  // Generate or retrieve session ID
  getSessionId() {
    let sessionId = sessionStorage.getItem('podcast_session_id');
    if (!sessionId) {
      sessionId = this.generateSessionId();
      sessionStorage.setItem('podcast_session_id', sessionId);
    }
    return sessionId;
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Get user location for analytics (with consent)
  async getUserLocation() {
    try {
      // Try to get location from IP (privacy-friendly)
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      this.userLocation = {
        country: data.country_name || 'Unknown',
        city: data.city || 'Unknown',
        region: data.region || 'Unknown'
      };
    } catch (error) {
      console.log('Location detection failed:', error);
      this.userLocation = {
        country: 'Unknown',
        city: 'Unknown',
        region: 'Unknown'
      };
    }
  }

  // Track any analytics event
  async trackEvent(eventType, data = {}) {
    const eventData = {
      eventType,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      ...this.userLocation,
      ...data
    };

    try {
      await fetch(`${this.baseUrl}/api/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      });
    } catch (error) {
      console.error('Analytics tracking failed:', error);
    }
  }

  // Track episode play start
  trackPlay(episodeId, showId, audioElement) {
    this.currentEpisode = {
      id: episodeId,
      showId: showId,
      element: audioElement,
      duration: audioElement.duration || 0
    };
    
    this.startTime = Date.now();
    this.lastPosition = 0;
    
    this.trackEvent('play', {
      episodeId,
      showId,
      position: audioElement.currentTime,
      duration: audioElement.duration,
      quality: this.getAudioQuality(audioElement)
    });

    // Start heartbeat tracking
    this.startHeartbeat();
    
    // Add event listeners for detailed tracking
    this.addAudioEventListeners(audioElement);
  }

  // Track episode pause
  trackPause(position = null) {
    if (!this.currentEpisode) return;
    
    const currentPos = position || this.currentEpisode.element.currentTime;
    const listenTime = this.calculateListenTime();
    
    this.trackEvent('pause', {
      episodeId: this.currentEpisode.id,
      showId: this.currentEpisode.showId,
      position: currentPos,
      duration: this.currentEpisode.duration,
      listenTime: listenTime,
      completionPercent: (currentPos / this.currentEpisode.duration) * 100
    });

    this.stopHeartbeat();
  }

  // Track episode completion
  trackComplete() {
    if (!this.currentEpisode) return;
    
    const totalListenTime = this.calculateListenTime();
    
    this.trackEvent('complete', {
      episodeId: this.currentEpisode.id,
      showId: this.currentEpisode.showId,
      position: this.currentEpisode.duration,
      duration: this.currentEpisode.duration,
      totalListenTime: totalListenTime,
      completionPercent: 100
    });

    this.stopHeartbeat();
    this.currentEpisode = null;
  }

  // Track episode skip (when user jumps to different position)
  trackSkip(fromPosition, toPosition) {
    if (!this.currentEpisode) return;
    
    this.trackEvent('skip', {
      episodeId: this.currentEpisode.id,
      showId: this.currentEpisode.showId,
      fromPosition,
      toPosition,
      skipAmount: toPosition - fromPosition,
      duration: this.currentEpisode.duration
    });
  }

  // Track episode download
  trackDownload(episodeId, showId, downloadUrl) {
    this.trackEvent('download', {
      episodeId,
      showId,
      downloadUrl,
      downloadMethod: 'direct'
    });
  }

  // Track social sharing
  trackShare(episodeId, showId, platform) {
    this.trackEvent('share', {
      episodeId,
      showId,
      platform, // 'twitter', 'facebook', 'linkedin', etc.
      shareMethod: 'web'
    });
  }

  // Track subscription events
  trackSubscribe(showId, method = 'rss') {
    this.trackEvent('subscribe', {
      showId,
      method // 'rss', 'email', 'app'
    });
  }

  trackUnsubscribe(showId, method = 'rss') {
    this.trackEvent('unsubscribe', {
      showId,
      method
    });
  }

  // Track episode rating
  trackRating(episodeId, showId, rating) {
    this.trackEvent('rate', {
      episodeId,
      showId,
      rating, // 1-5 stars
      ratingMethod: 'web'
    });
  }

  // Track search queries
  trackSearch(query, resultsCount = 0) {
    this.trackEvent('search', {
      query,
      resultsCount,
      searchType: 'episode'
    });
  }

  // Track page views
  trackPageView(pageType = 'home') {
    this.trackEvent('pageview', {
      pageType, // 'home', 'episode', 'show', 'about'
      loadTime: performance.now()
    });
  }

  // Start heartbeat tracking (every 30 seconds during playback)
  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing interval
    
    this.heartbeatInterval = setInterval(() => {
      if (this.currentEpisode && !this.currentEpisode.element.paused) {
        const currentPos = this.currentEpisode.element.currentTime;
        const progress = (currentPos / this.currentEpisode.duration) * 100;
        
        this.trackEvent('heartbeat', {
          episodeId: this.currentEpisode.id,
          showId: this.currentEpisode.showId,
          position: currentPos,
          duration: this.currentEpisode.duration,
          progress: progress,
          buffered: this.getBufferedAmount(),
          quality: this.getAudioQuality(this.currentEpisode.element)
        });
        
        this.lastPosition = currentPos;
      }
    }, 30000); // Every 30 seconds
  }

  // Stop heartbeat tracking
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Add audio element event listeners
  addAudioEventListeners(audioElement) {
    // Track when user seeks to different position
    audioElement.addEventListener('seeked', (e) => {
      const newPosition = e.target.currentTime;
      if (Math.abs(newPosition - this.lastPosition) > 5) { // Skip detection threshold
        this.trackSkip(this.lastPosition, newPosition);
      }
      this.lastPosition = newPosition;
    });

    // Track playback rate changes
    audioElement.addEventListener('ratechange', (e) => {
      this.trackEvent('playback_rate_change', {
        episodeId: this.currentEpisode?.id,
        showId: this.currentEpisode?.showId,
        newRate: e.target.playbackRate,
        position: e.target.currentTime
      });
    });

    // Track volume changes
    audioElement.addEventListener('volumechange', (e) => {
      this.trackEvent('volume_change', {
        episodeId: this.currentEpisode?.id,
        showId: this.currentEpisode?.showId,
        newVolume: e.target.volume,
        muted: e.target.muted
      });
    });

    // Track buffering events
    audioElement.addEventListener('waiting', () => {
      this.trackEvent('buffering_start', {
        episodeId: this.currentEpisode?.id,
        showId: this.currentEpisode?.showId,
        position: audioElement.currentTime
      });
    });

    audioElement.addEventListener('canplay', () => {
      this.trackEvent('buffering_end', {
        episodeId: this.currentEpisode?.id,
        showId: this.currentEpisode?.showId,
        position: audioElement.currentTime
      });
    });
  }

  // Calculate total listen time
  calculateListenTime() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  // Get audio quality information
  getAudioQuality(audioElement) {
    try {
      const src = audioElement.currentSrc || audioElement.src;
      if (src.includes('128')) return '128kbps';
      if (src.includes('256')) return '256kbps';
      if (src.includes('320')) return '320kbps';
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  // Get buffered amount
  getBufferedAmount() {
    if (!this.currentEpisode) return 0;
    
    try {
      const buffered = this.currentEpisode.element.buffered;
      if (buffered.length > 0) {
        return buffered.end(buffered.length - 1);
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  // Enhanced play button integration
  enhancePlayButtons() {
    document.querySelectorAll('.play-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const episodeElement = e.target.closest('[data-episode-id]');
        const episodeId = episodeElement?.dataset.episodeId;
        const showId = episodeElement?.dataset.showId;
        
        if (episodeId && showId) {
          // Find or create audio element
          let audioElement = episodeElement.querySelector('audio');
          if (!audioElement) {
            audioElement = document.createElement('audio');
            audioElement.src = episodeElement.dataset.audioUrl || `/audio/${episodeId}.mp3`;
            episodeElement.appendChild(audioElement);
          }
          
          // Toggle play/pause and track accordingly
          if (audioElement.paused) {
            audioElement.play();
            this.trackPlay(episodeId, showId, audioElement);
          } else {
            audioElement.pause();
            this.trackPause();
          }
        }
      });
    });
  }

  // Track RSS feed subscriptions
  enhanceRSSLinks() {
    document.querySelectorAll('a[href*="/api/rss/"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const showId = e.target.href.split('/api/rss/')[1];
        this.trackSubscribe(showId, 'rss');
      });
    });
  }

  // Track social shares
  enhanceSocialSharing() {
    document.querySelectorAll('[data-share]').forEach(button => {
      button.addEventListener('click', (e) => {
        const episodeId = e.target.dataset.episodeId;
        const showId = e.target.dataset.showId;
        const platform = e.target.dataset.share;
        
        if (episodeId && showId && platform) {
          this.trackShare(episodeId, showId, platform);
        }
      });
    });
  }

  // Initialize all tracking enhancements
  init() {
    // Track initial page view
    this.trackPageView(this.getPageType());
    
    // Enhance interactive elements
    this.enhancePlayButtons();
    this.enhanceRSSLinks();
    this.enhanceSocialSharing();
    
    // Track search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          const query = e.target.value;
          const results = document.querySelectorAll('.episode-item:not([style*="display: none"])').length;
          this.trackSearch(query, results);
        }
      });
    }
    
    // Track page unload (session end)
    window.addEventListener('beforeunload', () => {
      if (this.currentEpisode && !this.currentEpisode.element.paused) {
        this.trackPause();
      }