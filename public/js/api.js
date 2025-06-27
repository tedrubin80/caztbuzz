// public/js/api.js
// Enhanced frontend API client to replace all mock functions

class CastBuzzAPI {
    constructor() {
        this.baseUrl = window.location.origin;
        this.token = localStorage.getItem('authToken');
        this.refreshToken = localStorage.getItem('refreshToken');
        this.user = null;
        this.permissions = [];
        
        // Auto-refresh token 5 minutes before expiry
        this.setupTokenRefresh();
    }

    // Generic request handler with automatic token refresh
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token && options.requireAuth !== false) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
                ...options,
                headers
            });

            // Handle token expiry
            if (response.status === 401 && this.refreshToken && !endpoint.includes('/auth/')) {
                const refreshed = await this.refreshAuthToken();
                if (refreshed) {
                    headers['Authorization'] = `Bearer ${this.token}`;
                    return fetch(`${this.baseUrl}/api${endpoint}`, {
                        ...options,
                        headers
                    });
                } else {
                    this.logout();
                    throw new Error('Session expired. Please log in again.');
                }
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || error.message || `HTTP ${response.status}`);
            }

            return response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Setup automatic token refresh
    setupTokenRefresh() {
        if (this.token) {
            try {
                const payload = JSON.parse(atob(this.token.split('.')[1]));
                const expiryTime = payload.exp * 1000;
                const refreshTime = expiryTime - (5 * 60 * 1000); // 5 minutes before expiry
                const timeUntilRefresh = refreshTime - Date.now();

                if (timeUntilRefresh > 0) {
                    setTimeout(() => this.refreshAuthToken(), timeUntilRefresh);
                }
            } catch (error) {
                console.warn('Failed to parse token for auto-refresh:', error);
            }
        }
    }

    // Authentication Methods
    async login(email, password, twoFAToken = null) {
        const payload = { email, password };
        if (twoFAToken) payload.twoFAToken = twoFAToken;

        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload),
            requireAuth: false
        });

        if (response.requiresTwoFA) {
            return response; // Frontend should prompt for 2FA
        }

        if (response.token) {
            this.token = response.token;
            this.refreshToken = response.refreshToken;
            this.user = response.user;
            this.permissions = response.permissions;
            
            localStorage.setItem('authToken', this.token);
            localStorage.setItem('refreshToken', this.refreshToken);
            localStorage.setItem('user', JSON.stringify(this.user));
            
            this.setupTokenRefresh();
        }

        return response;
    }

    async logout() {
        try {
            if (this.token) {
                await this.request('/auth/logout', { method: 'POST' });
            }
        } catch (error) {
            console.warn('Logout request failed:', error);
        } finally {
            this.clearAuth();
            window.location.reload();
        }
    }

    async verifyAuth() {
        try {
            const response = await this.request('/auth/verify');
            this.user = response.user;
            this.permissions = response.permissions;
            return response;
        } catch (error) {
            this.clearAuth();
            throw error;
        }
    }

    async refreshAuthToken() {
        try {
            if (!this.refreshToken) return false;

            const response = await this.request('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({ refreshToken: this.refreshToken }),
                requireAuth: false
            });

            this.token = response.token;
            localStorage.setItem('authToken', this.token);
            this.setupTokenRefresh();
            return true;
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.clearAuth();
            return false;
        }
    }

    async changePassword(currentPassword, newPassword) {
        return this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }

    async forgotPassword(email) {
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
            requireAuth: false
        });
    }

    async resetPassword(token, password) {
        return this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password }),
            requireAuth: false
        });
    }

    // 2FA Methods
    async setup2FA() {
        return this.request('/auth/2fa/setup', { method: 'POST' });
    }

    async verify2FA(token) {
        return this.request('/auth/2fa/verify', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    }

    async disable2FA() {
        return this.request('/auth/2fa', { method: 'DELETE' });
    }

    // API Key Methods
    async createApiKey(name, permissions = []) {
        return this.request('/auth/api-keys', {
            method: 'POST',
            body: JSON.stringify({ name, permissions })
        });
    }

    async getApiKeys() {
        return this.request('/auth/api-keys');
    }

    async deleteApiKey(id) {
        return this.request(`/auth/api-keys/${id}`, { method: 'DELETE' });
    }

    // User Preferences
    async updatePreferences(preferences) {
        return this.request('/auth/preferences', {
            method: 'PUT',
            body: JSON.stringify(preferences)
        });
    }

    async getActivityLog(limit = 50) {
        return this.request(`/auth/activity?limit=${limit}`);
    }

    // User Management (Admin only)
    async getUsers(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/users${params.toString() ? '?' + params : ''}`);
    }

    async createUser(userData) {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updateUser(userId, userData) {
        return this.request(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(userId) {
        return this.request(`/users/${userId}`, { method: 'DELETE' });
    }

    // Shows Management
    async getShows(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/shows${params.toString() ? '?' + params : ''}`);
    }

    async createShow(showData) {
        return this.request('/shows', {
            method: 'POST',
            body: JSON.stringify(showData)
        });
    }

    async updateShow(showId, showData) {
        return this.request(`/shows/${showId}`, {
            method: 'PUT',
            body: JSON.stringify(showData)
        });
    }

    async deleteShow(showId) {
        return this.request(`/shows/${showId}`, { method: 'DELETE' });
    }

    // Episodes Management
    async getEpisodes(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/episodes${params.toString() ? '?' + params : ''}`);
    }

    async createEpisode(episodeData) {
        return this.request('/episodes', {
            method: 'POST',
            body: JSON.stringify(episodeData)
        });
    }

    async updateEpisode(episodeId, episodeData) {
        return this.request(`/episodes/${episodeId}`, {
            method: 'PUT',
            body: JSON.stringify(episodeData)
        });
    }

    async deleteEpisode(episodeId) {
        return this.request(`/episodes/${episodeId}`, { method: 'DELETE' });
    }

    async publishEpisode(episodeId) {
        return this.request(`/episodes/${episodeId}/publish`, { method: 'POST' });
    }

    async unpublishEpisode(episodeId) {
        return this.request(`/episodes/${episodeId}/unpublish`, { method: 'POST' });
    }

    // File Upload
    async uploadFile(file, entityType, entityId = null, onProgress = null) {
        // Get pre-signed URL
        const uploadRequest = await this.request('/s3/upload-url', {
            method: 'POST',
            body: JSON.stringify({
                filename: file.name,
                contentType: file.type,
                size: file.size,
                entityType,
                entityId
            })
        });

        // Upload to S3 with progress tracking
        const formData = new FormData();
        Object.entries(uploadRequest.fields).forEach(([key, value]) => {
            formData.append(key, value);
        });
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && onProgress) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    onProgress(percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 204) {
                    resolve({
                        success: true,
                        url: uploadRequest.url + uploadRequest.fields.key,
                        key: uploadRequest.fields.key
                    });
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });

            xhr.open('POST', uploadRequest.url);
            xhr.send(formData);
        });
    }

    // RSS Feeds
    async getRSSFeed(showId) {
        return this.request(`/rss/${showId}`, { requireAuth: false });
    }

    async regenerateRSSFeed(showId) {
        return this.request(`/rss/${showId}/regenerate`, { method: 'POST' });
    }

    // Analytics
    async getAnalytics(type, filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/analytics/${type}${params.toString() ? '?' + params : ''}`);
    }

    // Settings
    async getSettings() {
        return this.request('/settings');
    }

    async updateSettings(settings) {
        return this.request('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }

    // Utility Methods
    hasPermission(permission) {
        return this.permissions.includes(permission) || this.user?.role === 'super_admin';
    }

    isLoggedIn() {
        return !!this.token && !!this.user;
    }

    getCurrentUser() {
        return this.user;
    }

    clearAuth() {
        this.token = null;
        this.refreshToken = null;
        this.user = null;
        this.permissions = [];
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
    }

    // Initialize from localStorage on page load
    async initialize() {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                this.user = JSON.parse(storedUser);
            } catch (error) {
                console.warn('Failed to parse stored user:', error);
            }
        }

        if (this.token) {
            try {
                await this.verifyAuth();
                return true;
            } catch (error) {
                console.warn('Auth verification failed:', error);
                this.clearAuth();
                return false;
            }
        }
        return false;
    }
}

// Initialize global API instance
const api = new CastBuzzAPI();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await api.initialize();
    } catch (error) {
        console.warn('API initialization failed:', error);
    }
});

// Export for use in other scripts
window.CastBuzzAPI = CastBuzzAPI;
window.api = api;