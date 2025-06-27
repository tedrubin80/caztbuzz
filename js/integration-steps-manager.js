// js/integration-steps-manager.js
// Parses integration guide steps and makes them actionable in admin panel

class IntegrationStepsManager {
  constructor() {
    this.steps = this.parseIntegrationSteps();
    this.appliedSteps = this.loadAppliedSteps();
  }

  // Parse the integration guide into actionable steps
  parseIntegrationSteps() {
    return [
      {
        id: 'load-scripts',
        category: 'Setup',
        title: 'Load Analytics Scripts',
        description: 'Add Chart.js and analytics tracker scripts to your site',
        code: `<!-- Add to your HTML files (before closing </body> tag) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
<script src="/js/analytics-tracker.js"></script>
<script src="/js/analytics-dashboard.js"></script>`,
        action: () => this.loadAnalyticsScripts(),
        validation: () => typeof Chart !== 'undefined' && typeof window.podcastAnalytics !== 'undefined',
        rollback: () => this.removeAnalyticsScripts(),
        dependencies: [],
        impact: 'low'
      },

      {
        id: 'episode-data-attributes',
        category: 'Episode Tracking',
        title: 'Add Episode Data Attributes',
        description: 'Update episode HTML structure to include tracking data',
        code: `<!-- Add data attributes to episode items -->
<div class="episode-item" 
     data-episode-id="1" 
     data-show-id="tech" 
     data-audio-url="/audio/episode-1.mp3">
  <button class="play-btn" onclick="handleEpisodePlay(this)">
    <i class="fas fa-play"></i>
  </button>
  <!-- episode content -->
</div>`,
        action: () => this.addEpisodeDataAttributes(),
        validation: () => document.querySelectorAll('[data-episode-id]').length > 0,
        rollback: () => this.removeEpisodeDataAttributes(),
        dependencies: [],
        impact: 'medium'
      },

      {
        id: 'play-button-tracking',
        category: 'Episode Tracking',
        title: 'Enhance Play Button Tracking',
        description: 'Add analytics tracking to episode play buttons',
        code: `function handleEpisodePlay(button) {
  const episodeElement = button.closest('[data-episode-id]');
  const episodeId = episodeElement.dataset.episodeId;
  const showId = episodeElement.dataset.showId;
  const audioUrl = episodeElement.dataset.audioUrl;
  
  enhancePlayButton(button, episodeId, showId, audioUrl);
}`,
        action: () => this.enhancePlayButtons(),
        validation: () => this.validatePlayButtonTracking(),
        rollback: () => this.removePlayButtonTracking(),
        dependencies: ['episode-data-attributes'],
        impact: 'medium'
      },

      {
        id: 'download-tracking',
        category: 'Download Tracking',
        title: 'Add Download Button Tracking',
        description: 'Track episode downloads and RSS subscriptions',
        code: `<button class="btn btn-sm btn-outline-primary" 
        onclick="trackEpisodeDownload('1', 'tech', '/audio/episode-1.mp3')">
  <i class="fas fa-download"></i> Download
</button>

<a href="/api/rss/tech" 
   onclick="trackShowSubscribe('tech')" 
   class="btn btn-primary">
  <i class="fas fa-rss"></i> Subscribe to RSS
</a>`,
        action: () => this.addDownloadTracking(),
        validation: () => this.validateDownloadTracking(),
        rollback: () => this.removeDownloadTracking(),
        dependencies: [],
        impact: 'low'
      },

      {
        id: 'social-share-tracking',
        category: 'Social Tracking',
        title: 'Add Social Share Tracking',
        description: 'Track social media shares and interactions',
        code: `<button class="btn btn-sm btn-outline-secondary" 
        onclick="trackSocialShare('1', 'tech', 'twitter')">
  <i class="fab fa-twitter"></i> Share
</button>`,
        action: () => this.addSocialShareTracking(),
        validation: () => this.validateSocialTracking(),
        rollback: () => this.removeSocialTracking(),
        dependencies: [],
        impact: 'low'
      },

      {
        id: 'search-tracking',
        category: 'Search Tracking',
        title: 'Add Search Tracking',
        description: 'Track search queries and results',
        code: `document.getElementById('searchInput').addEventListener('input', debounce(function(e) {
  const query = e.target.value;
  if (query.length >= 3) {
    const results = document.querySelectorAll('.episode-item:not([style*="display: none"])').length;
    trackCustomEvent('search', {
      query: query,
      resultsCount: results
    });
  }
}, 500));`,
        action: () => this.addSearchTracking(),
        validation: () => this.validateSearchTracking(),
        rollback: () => this.removeSearchTracking(),
        dependencies: ['load-scripts'],
        impact: 'low'
      },

      {
        id: 'admin-analytics-section',
        category: 'Admin Panel',
        title: 'Add Analytics to Admin Navigation',
        description: 'Add analytics section to admin panel navigation',
        code: `<a href="#" class="admin-nav-link" data-section="analytics">
  <i class="fas fa-chart-bar me-3"></i>Analytics
</a>`,
        action: () => this.addAnalyticsToAdminNav(),
        validation: () => document.querySelector('[data-section="analytics"]') !== null,
        rollback: () => this.removeAnalyticsFromAdminNav(),
        dependencies: [],
        impact: 'low'
      },

      {
        id: 'custom-event-tracking',
        category: 'Advanced Tracking',
        title: 'Add Custom Event Tracking',
        description: 'Track newsletter signups, contact forms, and theme changes',
        code: `// Track newsletter signups
document.querySelector('#newsletter-form').addEventListener('submit', function(e) {
  trackCustomEvent('newsletter_signup', {
    source: 'website',
    section: 'hero'
  });
});

// Track theme changes
document.getElementById('themeToggle').addEventListener('click', function() {
  const newTheme = document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'dark' : 'light';
  trackCustomEvent('theme_change', { newTheme: newTheme });
});`,
        action: () => this.addCustomEventTracking(),
        validation: () => this.validateCustomEventTracking(),
        rollback: () => this.removeCustomEventTracking(),
        dependencies: ['load-scripts'],
        impact: 'low'
      },

      {
        id: 'episode-analytics-modal',
        category: 'Admin Panel',
        title: 'Add Episode Analytics Modal',
        description: 'Add detailed analytics view for individual episodes',
        code: `function showEpisodeAnalytics(episodeId) {
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  // ... modal content
  document.body.appendChild(modal);
  const modalInstance = new bootstrap.Modal(modal);
  modalInstance.show();
}`,
        action: () => this.addEpisodeAnalyticsModal(),
        validation: () => typeof window.showEpisodeAnalytics === 'function',
        rollback: () => this.removeEpisodeAnalyticsModal(),
        dependencies: ['admin-analytics-section'],
        impact: 'medium'
      },

      {
        id: 'realtime-widget',
        category: 'Dashboard',
        title: 'Add Real-time Listener Widget',
        description: 'Show live listener count for admin users',
        code: `function createRealtimeWidget() {
  const widget = document.createElement('div');
  widget.id = 'realtimeWidget';
  widget.className = 'position-fixed top-0 end-0 m-3 p-3 bg-primary text-white rounded shadow';
  // ... widget content
  document.body.appendChild(widget);
}`,
        action: () => this.addRealtimeWidget(),
        validation: () => document.getElementById('realtimeWidget') !== null,
        rollback: () => this.removeRealtimeWidget(),
        dependencies: ['load-scripts'],
        impact: 'low'
      },

      {
        id: 'analytics-dashboard',
        category: 'Dashboard',
        title: 'Initialize Analytics Dashboard',
        description: 'Add complete analytics dashboard with charts and metrics',
        code: `function initAnalyticsDashboard() {
  if (window.analyticsDashboard) {
    window.analyticsDashboard.init();
    window.analyticsDashboard.loadCharts();
  }
}`,
        action: () => this.initializeAnalyticsDashboard(),
        validation: () => typeof window.analyticsDashboard !== 'undefined',
        rollback: () => this.removeAnalyticsDashboard(),
        dependencies: ['load-scripts', 'admin-analytics-section'],
        impact: 'high'
      }
    ];
  }

  // Load applied steps from localStorage
  loadAppliedSteps() {
    const saved = localStorage.getItem('appliedIntegrationSteps');
    return saved ? JSON.parse(saved) : [];
  }

  // Save applied steps to localStorage
  saveAppliedSteps() {
    localStorage.setItem('appliedIntegrationSteps', JSON.stringify(this.appliedSteps));
  }

  // Generate the integration steps UI
  generateStepsUI() {
    const categories = [...new Set(this.steps.map(step => step.category))];
    
    let html = '';
    
    categories.forEach(category => {
      const categorySteps = this.steps.filter(step => step.category === category);
      
      html += `
        <div class="integration-category mb-4">
          <h6 class="text-primary mb-3">
            <i class="fas fa-${this.getCategoryIcon(category)} me-2"></i>
            ${category}
          </h6>
          
          <div class="row">
            ${categorySteps.map(step => this.generateStepCard(step)).join('')}
          </div>
        </div>
      `;
    });
    
    return html;
  }

  // Generate individual step card
  generateStepCard(step) {
    const isApplied = this.appliedSteps.includes(step.id);
    const canApply = this.canApplyStep(step);
    const isValid = isApplied ? step.validation() : false;
    
    return `
      <div class="col-md-6 mb-3">
        <div class="card integration-step-card ${isApplied ? 'border-success' : ''}" data-step-id="${step.id}">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h6 class="card-title mb-0">${step.title}</h6>
              <div class="step-status">
                ${isApplied ? 
                  `<span class="badge bg-${isValid ? 'success' : 'warning'}">
                    <i class="fas fa-${isValid ? 'check' : 'exclamation-triangle'}"></i>
                    ${isValid ? 'Applied' : 'Needs Fix'}
                  </span>` :
                  `<span class="badge bg-secondary">Not Applied</span>`
                }
              </div>
            </div>
            
            <p class="card-text small text-muted mb-3">${step.description}</p>
            
            ${step.dependencies.length > 0 ? `
              <div class="mb-2">
                <small class="text-muted">Requires: ${step.dependencies.join(', ')}</small>
              </div>
            ` : ''}
            
            <div class="step-impact mb-3">
              <small class="text-muted">Impact: </small>
              <span class="badge bg-${step.impact === 'high' ? 'danger' : step.impact === 'medium' ? 'warning' : 'info'}">
                ${step.impact}
              </span>
            </div>
            
            <div class="step-actions">
              ${!isApplied ? 
                `<button class="btn btn-sm btn-primary ${!canApply ? 'disabled' : ''}" 
                         onclick="integrationManager.applyStep('${step.id}')"
                         ${!canApply ? 'disabled title="Dependencies not met"' : ''}>
                  <i class="fas fa-play me-1"></i> Apply
                </button>` :
                `<button class="btn btn-sm btn-warning" 
                         onclick="integrationManager.rollbackStep('${step.id}')">
                  <i class="fas fa-undo me-1"></i> Rollback
                </button>`
              }
              
              <button class="btn btn-sm btn-outline-secondary ms-1" 
                      onclick="integrationManager.showStepCode('${step.id}')">
                <i class="fas fa-code me-1"></i> View Code
              </button>
              
              ${isApplied ? 
                `<button class="btn btn-sm btn-outline-info ms-1" 
                         onclick="integrationManager.testStep('${step.id}')">
                  <i class="fas fa-flask me-1"></i> Test
                </button>` : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Check if step can be applied (dependencies met)
  canApplyStep(step) {
    return step.dependencies.every(depId => this.appliedSteps.includes(depId));
  }

  // Get icon for category
  getCategoryIcon(category) {
    const icons = {
      'Setup': 'cogs',
      'Episode Tracking': 'play-circle',
      'Download Tracking': 'download',
      'Social Tracking': 'share-alt',
      'Search Tracking': 'search',
      'Admin Panel': 'user-cog',
      'Advanced Tracking': 'chart-line',
      'Dashboard': 'tachometer-alt'
    };
    return icons[category] || 'circle';
  }

  // Apply a specific step
  async applyStep(stepId) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    if (!this.canApplyStep(step)) {
      this.showError('Cannot apply step: dependencies not met');
      return;
    }

    try {
      // Show loading state
      this.setStepLoading(stepId, true);
      
      // Apply the step
      await step.action();
      
      // Validate the step
      const isValid = step.validation();
      if (!isValid) {
        throw new Error('Step validation failed');
      }
      
      // Mark as applied
      this.appliedSteps.push(stepId);
      this.saveAppliedSteps();
      
      // Update UI
      this.refreshStepCard(stepId);
      this.showSuccess(`${step.title} applied successfully!`);
      
    } catch (error) {
      this.showError(`Failed to apply ${step.title}: ${error.message}`);
    } finally {
      this.setStepLoading(stepId, false);
    }
  }

  // Rollback a specific step
  async rollbackStep(stepId) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    if (!confirm(`Are you sure you want to rollback "${step.title}"?`)) return;

    try {
      this.setStepLoading(stepId, true);
      
      // Rollback the step
      await step.rollback();
      
      // Remove from applied steps
      this.appliedSteps = this.appliedSteps.filter(id => id !== stepId);
      this.saveAppliedSteps();
      
      // Update UI
      this.refreshStepCard(stepId);
      this.showWarning(`${step.title} rolled back successfully!`);
      
    } catch (error) {
      this.showError(`Failed to rollback ${step.title}: ${error.message}`);
    } finally {
      this.setStepLoading(stepId, false);
    }
  }

  // Test a specific step
  async testStep(stepId) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    try {
      const isValid = await step.validation();
      if (isValid) {
        this.showSuccess(`${step.title} is working correctly!`);
      } else {
        this.showWarning(`${step.title} validation failed - may need reapplication`);
      }
      
      this.refreshStepCard(stepId);
      
    } catch (error) {
      this.showError(`Test failed for ${step.title}: ${error.message}`);
    }
  }

  // Show step code in modal
  showStepCode(stepId) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${step.title} - Code</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted">${step.description}</p>
            <pre><code class="language-javascript">${step.code}</code></pre>
            
            <div class="mt-3">
              <h6>Dependencies:</h6>
              ${step.dependencies.length > 0 ? 
                `<ul>${step.dependencies.map(dep => `<li>${dep}</li>`).join('')}</ul>` :
                '<p class="text-muted">No dependencies</p>'
              }
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" onclick="integrationManager.copyStepCode('${stepId}')">
              <i class="fas fa-copy me-1"></i> Copy Code
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    modal.addEventListener('hidden.bs.modal', () => modal.remove());
  }

  // Copy step code to clipboard
  async copyStepCode(stepId) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    try {
      await navigator.clipboard.writeText(step.code);
      this.showSuccess('Code copied to clipboard!');
    } catch (error) {
      this.showError('Failed to copy code');
    }
  }

  // UI Helper methods
  setStepLoading(stepId, loading) {
    const card = document.querySelector(`[data-step-id="${stepId}"]`);
    if (card) {
      const actions = card.querySelector('.step-actions');
      if (loading) {
        actions.style.opacity = '0.5';
        actions.style.pointerEvents = 'none';
      } else {
        actions.style.opacity = '1';
        actions.style.pointerEvents = 'auto';
      }
    }
  }

  refreshStepCard(stepId) {
    const step = this.steps.find(s => s.id === stepId);
    const card = document.querySelector(`[data-step-id="${stepId}"]`);
    if (card && step) {
      const newCard = document.createElement('div');
      newCard.innerHTML = this.generateStepCard(step);
      card.replaceWith(newCard.firstElementChild);
    }
  }

  // Notification methods
  showSuccess(message) {
    if (window.showAdminAlert) {
      window.showAdminAlert(message, 'success');
    } else {
      alert(message);
    }
  }

  showError(message) {
    if (window.showAdminAlert) {
      window.showAdminAlert(message, 'danger');
    } else {
      alert('Error: ' + message);
    }
  }

  showWarning(message) {
    if (window.showAdminAlert) {
      window.showAdminAlert(message, 'warning');
    } else {
      alert('Warning: ' + message);
    }
  }

  // Step Implementation Methods
  async loadAnalyticsScripts() {
    const scripts = [
      'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
      '/js/analytics-tracker.js',
      '/js/analytics-dashboard.js'
    ];

    for (const src of scripts) {
      await this.loadScript(src);
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  removeAnalyticsScripts() {
    const scripts = [
      'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
      '/js/analytics-tracker.js',
      '/js/analytics-dashboard.js'
    ];

    scripts.forEach(src => {
      const script = document.querySelector(`script[src="${src}"]`);
      if (script) script.remove();
    });
  }

  addEpisodeDataAttributes() {
    document.querySelectorAll('.episode-item').forEach((episode, index) => {
      if (!episode.dataset.episodeId) {
        episode.dataset.episodeId = index + 1;
        episode.dataset.showId = this.detectShowId(episode);
        episode.dataset.audioUrl = this.detectAudioUrl(episode, index);
      }
    });
  }

  removeEpisodeDataAttributes() {
    document.querySelectorAll('[data-episode-id]').forEach(episode => {
      delete episode.dataset.episodeId;
      delete episode.dataset.showId;
      delete episode.dataset.audioUrl;
    });
  }

  enhancePlayButtons() {
    document.querySelectorAll('.play-btn').forEach(button => {
      if (!button.dataset.analyticsEnhanced) {
        button.dataset.analyticsEnhanced = 'true';
        button.addEventListener('click', this.handlePlayButtonClick.bind(this));
      }
    });
  }

  handlePlayButtonClick(event) {
    const button = event.target.closest('.play-btn');
    const episodeElement = button.closest('[data-episode-id]');
    
    if (episodeElement && window.podcastAnalytics) {
      const episodeId = episodeElement.dataset.episodeId;
      const showId = episodeElement.dataset.showId;
      const audioUrl = episodeElement.dataset.audioUrl;
      
      // Create or get audio element
      let audio = document.getElementById(`audio-${episodeId}`);
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = `audio-${episodeId}`;
        audio.src = audioUrl;
        document.body.appendChild(audio);
      }
      
      if (audio.paused) {
        window.podcastAnalytics.trackPlay(episodeId, showId, audio);
      } else {
        window.podcastAnalytics.trackPause();
      }
    }
  }

  // Helper methods for step implementations
  detectShowId(episodeElement) {
    const showBadge = episodeElement.querySelector('.show-badge');
    if (showBadge) {
      if (showBadge.classList.contains('show1-badge')) return 'tech';
      if (showBadge.classList.contains('show2-badge')) return 'life';
      if (showBadge.classList.contains('show3-badge')) return 'business';
    }
    return 'tech'; // default
  }

  detectAudioUrl(episodeElement, index) {
    const audioLink = episodeElement.querySelector('a[href*=".mp3"]');
    if (audioLink) return audioLink.href;
    return `/audio/episode-${index + 1}.mp3`;
  }

  // Additional step implementations would go here...
  // (addDownloadTracking, addSocialShareTracking, etc.)
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  window.integrationManager = new IntegrationStepsManager();
});