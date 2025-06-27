// js/api.js
// Frontend API integration to replace localStorage calls

class PodcastAPI {
  constructor() {
    this.baseUrl = window.location.origin;
    this.token = localStorage.getItem('adminToken');
    this.sessionId = localStorage.getItem('adminSessionId');
  }

  // Set authentication headers
  getHeaders(includeAuth = false) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (includeAuth && this.sessionId) {
      headers['X-Session-ID'] = this.sessionId;
    }

    return headers;
  }

  // Generic API request handler
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(options.requireAuth),
          ...options.headers
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Authentication Methods
  async login(username, password) {
    const response = await this.request('/auth', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (response.token) {
      this.token = response.token;
      this.sessionId = response.sessionId;
      localStorage.setItem('adminToken', this.token);
      localStorage.setItem('adminSessionId', this.sessionId);
    }

    return response;
  }

  async logout() {
    await this.request('/auth', {
      method: 'DELETE',
      requireAuth: true
    });

    this.token = null;
    this.sessionId = null;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSessionId');
  }

  async verifyAuth() {
    try {
      return await this.request('/auth', {
        method: 'GET',
        requireAuth: true
      });
    } catch (error) {
      // Clear invalid tokens
      this.logout();
      throw error;
    }
  }

  // Episodes API
  async getEpisodes(options = {}) {
    const params = new URLSearchParams();
    
    if (options.show) params.append('show', options.show);
    if (options.search) params.append('search', options.search);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);

    const query = params.toString() ? `?${params.toString()}` : '';
    return await this.request(`/episodes${query}`);
  }

  async createEpisode(episodeData) {
    return await this.request('/episodes', {
      method: 'POST',
      body: JSON.stringify(episodeData),
      requireAuth: true
    });
  }

  async updateEpisode(episodeId, updates) {
    return await this.request(`/episodes?id=${episodeId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
      requireAuth: true
    });
  }

  async deleteEpisode(episodeId) {
    return await this.request(`/episodes?id=${episodeId}`, {
      method: 'DELETE',
      requireAuth: true
    });
  }

  // Shows API
  async getShows(activeOnly = false) {
    const query = activeOnly ? '?active=true' : '';
    return await this.request(`/shows${query}`);
  }

  async createShow(showData) {
    return await this.request('/shows', {
      method: 'POST',
      body: JSON.stringify(showData),
      requireAuth: true
    });
  }

  async updateShow(showId, updates) {
    return await this.request(`/shows?id=${showId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
      requireAuth: true
    });
  }

  async deleteShow(showId) {
    return await this.request(`/shows?id=${showId}`, {
      method: 'DELETE',
      requireAuth: true
    });
  }

  // RSS Feed URL
  getRSSUrl(showId) {
    return `${this.baseUrl}/api/rss/${showId}`;
  }
}

// Initialize API instance
const api = new PodcastAPI();

// Updated functions to replace localStorage calls
async function loadEpisodes() {
  try {
    const response = await api.getEpisodes({ limit: 50 });
    return response.episodes || [];
  } catch (error) {
    console.error('Failed to load episodes:', error);
    showAlert('Failed to load episodes', 'error');
    return [];
  }
}

async function loadShows() {
  try {
    const response = await api.getShows();
    return response.shows || [];
  } catch (error) {
    console.error('Failed to load shows:', error);
    showAlert('Failed to load shows', 'error');
    return [];
  }
}

// Admin authentication
async function loginAdmin() {
  const username = document.getElementById('adminUsername').value;
  const password = document.getElementById('adminPassword').value;
  
  try {
    const response = await api.login(username, password);
    
    // Close login modal and show admin panel
    closeAdminLogin();
    showAdminPanel();
    await loadAdminData();
    
    showAdminAlert('Welcome to CastBuzz Admin Panel!', 'success');
  } catch (error) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = error.message || 'Login failed';
    errorDiv.style.display = 'block';
  }
}

async function logoutAdmin() {
  if (confirm('Are you sure you want to logout?')) {
    try {
      await api.logout();
      
      // Hide admin panel and reset state
      document.getElementById('adminPanel').style.display = 'none';
      isLoggedIn = false;
      currentAdminSection = 'dashboard';
      
      showAlert('Logged out successfully', 'info');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

// Episode management functions
async function addNewEpisode() {
  const title = prompt('Episode Title:');
  const description = prompt('Episode Description:');
  const show = prompt('Show ID (tech, life, business):');
  
  if (!title || !description || !show) {
    showAdminAlert('All fields are required', 'error');
    return;
  }

  try {
    const showData = await api.getShows();
    const selectedShow = showData.shows.find(s => s.id === show);
    
    if (!selectedShow) {
      showAdminAlert('Invalid show ID', 'error');
      return;
    }

    const episodeData = {
      title: title.trim(),
      description: description.trim(),
      show: show.trim(),
      showName: selectedShow.name,
      duration: '30:00', // Default duration
    };

    await api.createEpisode(episodeData);
    await refreshAdminData();
    showAdminAlert('Episode added successfully!', 'success');
  } catch (error) {
    showAdminAlert(error.message || 'Failed to add episode', 'error');
  }
}

async function editEpisode(episodeId) {
  const newTitle = prompt('Episode Title:');
  const newDescription = prompt('Episode Description:');
  
  if (!newTitle || !newDescription) return;

  try {
    await api.updateEpisode(episodeId, {
      title: newTitle.trim(),
      description: newDescription.trim()
    });
    
    await refreshAdminData();
    showAdminAlert('Episode updated successfully!', 'success');
  } catch (error) {
    showAdminAlert(error.message || 'Failed to update episode', 'error');
  }
}

async function deleteEpisode(episodeId) {
  if (!confirm('Are you sure you want to delete this episode?')) return;

  try {
    await api.deleteEpisode(episodeId);
    await refreshAdminData();
    showAdminAlert('Episode deleted successfully!', 'warning');
  } catch (error) {
    showAdminAlert(error.message || 'Failed to delete episode', 'error');
  }
}

// Show management functions
async function addNewShow() {
  const name = prompt('Show Name:');
  const description = prompt('Show Description:');
  const color = prompt('Show Color (hex):', '#6366f1');
  
  if (!name || !description) {
    showAdminAlert('Name and description are required', 'error');
    return;
  }

  try {
    await api.createShow({
      name: name.trim(),
      description: description.trim(),
      color: color.trim()
    });
    
    await refreshAdminData();
    showAdminAlert('Show added successfully!', 'success');
  } catch (error) {
    showAdminAlert(error.message || 'Failed to add show', 'error');
  }
}

async function editShow(showId) {
  const newName = prompt('Show Name:');
  const newDescription = prompt('Show Description:');
  
  if (!newName || !newDescription) return;

  try {
    await api.updateShow(showId, {
      name: newName.trim(),
      description: newDescription.trim()
    });
    
    await refreshAdminData();
    showAdminAlert('Show updated successfully!', 'success');
  } catch (error) {
    showAdminAlert(error.message || 'Failed to update show', 'error');
  }
}

async function deleteShow(showId) {
  if (!confirm('Are you sure you want to delete this show? This will also remove all episodes.')) return;

  try {
    await api.deleteShow(showId);
    await refreshAdminData();
    showAdminAlert('Show deleted successfully!', 'warning');
  } catch (error) {
    showAdminAlert(error.message || 'Failed to delete show', 'error');
  }
}

// Utility functions
async function refreshAdminData() {
  await loadAdminData();
  if (currentAdminSection === 'shows') {
    loadShowsManager();
  } else if (currentAdminSection === 'episodes') {
    loadEpisodesManager();
  }
}

function showAlert(message, type) {
  // Create alert element
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  // Add to page
  document.body.insertBefore(alertDiv, document.body.firstChild);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Check if user is already authenticated
    await api.verifyAuth();
    isLoggedIn = true;
  } catch (error) {
    isLoggedIn = false;
  }
  
  // Load initial data
  await loadInitialData();
});

async function loadInitialData() {
  try {
    const [episodes, shows] = await Promise.all([
      loadEpisodes(),
      loadShows()
    ]);
    
    window.episodes = episodes;
    window.shows = shows;
    
    // Update UI
    updateEpisodesList();
    updateAllEpisodesList();
  } catch (error) {
    console.error('Failed to load initial data:', error);
    showAlert('Failed to load data. Please refresh the page.', 'error');
  }
}