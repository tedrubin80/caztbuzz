// js/analytics-dashboard.js
// Analytics dashboard for the admin panel

class AnalyticsDashboard {
  constructor() {
    this.api = window.api; // Use existing API instance
    this.currentPeriod = '30d';
    this.currentView = 'overview';
    this.charts = {};
    this.refreshInterval = null;
  }

  // Initialize the analytics dashboard
  async init() {
    await this.loadOverviewData();
    this.setupEventListeners();
    this.startAutoRefresh();
  }

  // Load overview analytics data
  async loadOverviewData() {
    try {
      const data = await this.api.request(`/analytics?type=overview&period=${this.currentPeriod}`, {
        requireAuth: true
      });
      
      this.updateOverviewCards(data);
      this.updateOverviewCharts(data);
    } catch (error) {
      console.error('Failed to load overview data:', error);
      this.showError('Failed to load analytics data');
    }
  }

  // Update overview statistics cards
  updateOverviewCards(data) {
    const cards = {
      totalPlays: data.totalPlays || 0,
      totalDownloads: data.totalDownloads || 0,
      totalListeners: data.totalListeners || 0,
      avgListenTime: this.formatDuration(data.averageListenTime || 0)
    };

    // Update the dashboard cards
    Object.keys(cards).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        element.textContent = cards[key];
      }
    });

    // Update growth indicators
    this.updateGrowthIndicators(data.growth || {});
  }

  // Update growth indicators
  updateGrowthIndicators(growth) {
    const indicators = ['plays', 'downloads', 'listeners'];
    
    indicators.forEach(metric => {
      const element = document.getElementById(`${metric}Growth`);
      if (element && growth[metric] !== undefined) {
        const value = growth[metric];
        const isPositive = value >= 0;
        const icon = isPositive ? 'fa-arrow-up' : 'fa-arrow-down';
        const colorClass = isPositive ? 'text-success' : 'text-danger';
        
        element.innerHTML = `
          <i class="fas ${icon} me-1"></i>
          <span class="${colorClass}">${Math.abs(value)}%</span>
        `;
      }
    });
  }

  // Update charts with overview data
  updateOverviewCharts(data) {
    // Create plays over time chart
    this.createPlaysChart(data.dailyPlays || []);
    
    // Create top episodes chart
    this.createTopEpisodesChart(data.topEpisodes || []);
    
    // Create listener demographics chart
    this.createDemographicsChart(data.demographics || {});
  }

  // Create plays over time chart
  createPlaysChart(dailyData) {
    const ctx = document.getElementById('playsChart');
    if (!ctx) return;

    // Destroy existing chart
    if (this.charts.plays) {
      this.charts.plays.destroy();
    }

    this.charts.plays = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailyData.map(d => this.formatDate(d.date)),
        datasets: [{
          label: 'Plays',
          data: dailyData.map(d => d.plays),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4
        }, {
          label: 'Downloads',
          data: dailyData.map(d => d.downloads),
          borderColor: '#ec4899',
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  }

  // Create top episodes chart
  createTopEpisodesChart(topEpisodes) {
    const ctx = document.getElementById('topEpisodesChart');
    if (!ctx) return;

    if (this.charts.topEpisodes) {
      this.charts.topEpisodes.destroy();
    }

    this.charts.topEpisodes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topEpisodes.slice(0, 10).map(ep => this.truncateText(ep.title, 30)),
        datasets: [{
          label: 'Plays',
          data: topEpisodes.slice(0, 10).map(ep => ep.plays),
          backgroundColor: [
            '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444',
            '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#64748b'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true
          }
        }
      }
    });
  }

  // Create demographics chart
  createDemographicsChart(demographics) {
    const ctx = document.getElementById('demographicsChart');
    if (!ctx) return;

    if (this.charts.demographics) {
      this.charts.demographics.destroy();
    }

    const countries = Object.keys(demographics.countries || {}).slice(0, 8);
    const counts = countries.map(country => demographics.countries[country]);

    this.charts.demographics = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: countries,
        datasets: [{
          data: counts,
          backgroundColor: [
            '#6366f1', '#ec4899', '#10b981', '#f59e0b',
            '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });
  }

  // Load episode-specific analytics
  async loadEpisodeAnalytics(episodeId) {
    try {
      const data = await this.api.request(`/analytics?type=episode&episodeId=${episodeId}&period=${this.currentPeriod}`, {
        requireAuth: true
      });
      
      this.displayEpisodeAnalytics(data);
    } catch (error) {
      console.error('Failed to load episode analytics:', error);
      this.showError('Failed to load episode analytics');
    }
  }

  // Display episode analytics
  displayEpisodeAnalytics(data) {
    const container = document.getElementById('episodeAnalyticsContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="row mb-4">
        <div class="col-md-3">
          <div class="stats-card">
            <div class="stats-number text-primary">${data.totalPlays || 0}</div>
            <h6>Total Plays</h6>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stats-card">
            <div class="stats-number text-success">${data.totalDownloads || 0}</div>
            <h6>Downloads</h6>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stats-card">
            <div class="stats-number text-info">${data.uniqueListeners || 0}</div>
            <h6>Unique Listeners</h6>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stats-card">
            <div class="stats-number text-warning">${Math.round(data.completionRate || 0)}%</div>
            <h6>Completion Rate</h6>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col-md-8">
          <div class="settings-card">
            <div class="card-header">
              <h5>Listener Retention</h5>
            </div>
            <div class="card-body">
              <canvas id="retentionChart" height="200"></canvas>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="settings-card">
            <div class="card-header">
              <h5>Episode Stats</h5>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <strong>Average Listen Time:</strong><br>
                ${this.formatDuration(data.averageListenTime || 0)}
              </div>
              <div class="mb-3">
                <strong>Social Shares:</strong><br>
                ${data.socialShares || 0}
              </div>
              <div class="mb-3">
                <strong>First Played:</strong><br>
                ${this.formatDate(data.firstPlayed)}
              </div>
              <div class="mb-3">
                <strong>Last Played:</strong><br>
                ${this.formatDate(data.lastPlayed)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Create retention chart
    this.createRetentionChart(data.listenerRetention || []);
  }

  // Create listener retention chart
  createRetentionChart(retentionData) {
    const ctx = document.getElementById('retentionChart');
    if (!ctx) return;

    // Process retention data into percentage buckets
    const buckets = Array(10).fill(0); // 0-10%, 10-20%, etc.
    retentionData.forEach(percent => {
      const bucket = Math.min(9, Math.floor(percent / 10));
      buckets[bucket]++;
    });

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [
          '0-10%', '10-20%', '20-30%', '30-40%', '40-50%',
          '50-60%', '60-70%', '70-80%', '80-90%', '90-100%'
        ],
        datasets: [{
          label: 'Listeners',
          data: buckets,
          backgroundColor: '#6366f1',
          borderColor: '#4f46e5',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  // Load real-time analytics
  async loadRealtimeAnalytics() {
    try {
      const data = await this.api.request('/analytics?type=realtime', {
        requireAuth: true
      });
      
      this.updateRealtimeData(data);
    } catch (error) {
      console.error('Failed to load realtime analytics:', error);
    }
  }

  // Update real-time data display
  updateRealtimeData(data) {
    const realtimeContainer = document.getElementById('realtimeContainer');
    if (!realtimeContainer) return;

    realtimeContainer.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5>Live Activity</h5>
        <span class="badge bg-success">
          <i class="fas fa-circle me-1" style="font-size: 8px;"></i>
          ${data.activeListeners || 0} listening now
        </span>
      </div>
      
      <div class="list-group">
        ${(data.recentActivity || []).map(activity => `
          <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <strong>${activity.eventType}</strong> - ${activity.episodeTitle}
              <br><small class="text-muted">${this.formatTimeAgo(activity.timestamp)}</small>
            </div>
            <span class="badge bg-${this.getEventBadgeColor(activity.eventType)}">
              ${activity.platform || 'Web'}
            </span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Setup event listeners for the dashboard
  setupEventListeners() {
    // Period selector
    document.querySelectorAll('[data-period]').forEach(button => {
      button.addEventListener('click', (e) => {
        this.currentPeriod = e.target.dataset.period;
        this.updatePeriodButtons();
        this.loadOverviewData();
      });
    });

    // View selector
    document.querySelectorAll('[data-view]').forEach(button => {
      button.addEventListener('click', (e) => {
        this.currentView = e.target.dataset.view;
        this.updateViewButtons();
        this.loadViewData();
      });
    });

    // Refresh button
    const refreshButton = document.getElementById('refreshAnalytics');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        this.loadOverviewData();
        this.showSuccess('Analytics refreshed');
      });
    }
  }

  // Update period buttons
  updatePeriodButtons() {
    document.querySelectorAll('[data-period]').forEach(button => {
      button.classList.remove('active');
      if (button.dataset.period === this.currentPeriod) {
        button.classList.add('active');
      }
    });
  }

  // Start auto-refresh for real-time data
  startAutoRefresh() {
    // Refresh real-time data every 30 seconds
    this.refreshInterval = setInterval(() => {
      if (this.currentView === 'realtime') {
        this.loadRealtimeAnalytics();
      }
    }, 30000);
  }

  // Stop auto-refresh
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Utility functions
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  formatTimeAgo(dateString) {
    if (!dateString) return 'Unknown';
    
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  getEventBadgeColor(eventType) {
    const colors = {
      play: 'primary',
      pause: 'secondary',
      complete: 'success',
      download: 'info',
      share: 'warning',
      subscribe: 'success'
    };
    return colors[eventType] || 'secondary';
  }

  showSuccess(message) {
    this.showAlert(message, 'success');
  }

  showError(message) {
    this.showAlert(message, 'danger');
  }

  showAlert(message, type) {
    // Create alert (reuse existing showAdminAlert if available)
    if (typeof showAdminAlert === 'function') {
      showAdminAlert(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  // Cleanup when dashboard is destroyed
  destroy() {
    this.stopAutoRefresh();
    
    // Destroy all charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    
    this.charts = {};
  }
}

// Initialize analytics dashboard when admin panel loads
function initAnalyticsDashboard() {
  // Load Chart.js if not already loaded
  if (typeof Chart === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
    script.onload = () => {
      window.analyticsDashboard = new AnalyticsDashboard();
      window.analyticsDashboard.init();
    };
    document.head.appendChild(script);
  } else {
    window.analyticsDashboard = new AnalyticsDashboard();
    window.analyticsDashboard.init();
  }
}

// Add analytics section to admin panel
function addAnalyticsToAdmin() {
  const adminContent = document.querySelector('.admin-content');
  if (!adminContent) return;

  // Add analytics section HTML
  const analyticsHTML = `
    <div id="analytics" class="admin-section" style="display: none;">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="page-title mb-0">
          <i class="fas fa-chart-bar me-3"></i>Analytics & Insights
        </h1>
        <div class="btn-group" role="group">
          <button type="button" class="btn btn-outline-primary active" data-period="7d">7 Days</button>
          <button type="button" class="btn btn-outline-primary" data-period="30d">30 Days</button>
          <button type="button" class="btn btn-outline-primary" data-period="90d">90 Days</button>
        </div>
      </div>
      
      <!-- Overview Stats -->
      <div class="row mb-4">
        <div class="col-md-3 mb-3">
          <div class="stats-card">
            <i class="fas fa-play text-primary fs-2"></i>
            <div class="stats-number text-primary" id="totalPlays">0</div>
            <h6>Total Plays</h6>
            <small id="playsGrowth"></small>
          </div>
        </div>
        <div class="col-md-3 mb-3">
          <div class="stats-card">
            <i class="fas fa-download text-success fs-2"></i>
            <div class="stats-number text-success" id="totalDownloads">0</div>
            <h6>Downloads</h6>
            <small id="downloadsGrowth"></small>
          </div>
        </div>
        <div class="col-md-3 mb-3">
          <div class="stats-card">
            <i class="fas fa-users text-info fs-2"></i>
            <div class="stats-number text-info" id="totalListeners">0</div>
            <h6>Unique Listeners</h6>
            <small id="listenersGrowth"></small>
          </div>
        </div>
        <div class="col-md-3 mb-3">
          <div class="stats-card">
            <i class="fas fa-clock text-warning fs-2"></i>
            <div class="stats-number text-warning" id="avgListenTime">0</div>
            <h6>Avg. Listen Time</h6>
          </div>
        </div>
      </div>

      <!-- Charts -->
      <div class="row mb-4">
        <div class="col-md-8">
          <div class="settings-card">
            <div class="card-header">
              <h5>Plays & Downloads Over Time</h5>
            </div>
            <div class="card-body">
              <canvas id="playsChart" height="300"></canvas>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="settings-card">
            <div class="card-header">
              <h5>Top Countries</h5>
            </div>
            <div class="card-body">
              <canvas id="demographicsChart" height="300"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Episodes -->
      <div class="settings-card">
        <div class="card-header">
          <h5>Most Popular Episodes</h5>
        </div>
        <div class="card-body">
          <canvas id="topEpisodesChart" height="400"></canvas>
        </div>
      </div>
    </div>
  `;

  adminContent.insertAdjacentHTML('beforeend', analyticsHTML);
}