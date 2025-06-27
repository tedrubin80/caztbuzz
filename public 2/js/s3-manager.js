// public/js/s3-manager.js
// Frontend S3 upload and configuration management

class S3Manager {
    constructor() {
        this.isConfigured = false;
        this.uploadQueue = new Map();
    }

    async initialize() {
        await this.checkConfiguration();
        this.setupEventListeners();
    }

    async checkConfiguration() {
        try {
            const response = await api.request('/s3/config');
            this.isConfigured = response.configured;
            
            if (response.configured) {
                this.displayConfigStatus(response.config);
            } else {
                this.displayUnconfiguredStatus();
            }
        } catch (error) {
            console.error('Failed to check S3 configuration:', error);
            this.displayUnconfiguredStatus(error.message);
        }
    }

    displayConfigStatus(config) {
        const statusDiv = document.getElementById('s3Status');
        statusDiv.innerHTML = `
            <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i>
                <strong>S3 Storage Connected:</strong> ${config.bucket} at ${config.endpoint}
                <br><small>Last updated: ${new Date(config.lastUpdated).toLocaleString()}</small>
            </div>
        `;
    }

    displayUnconfiguredStatus(error = null) {
        const statusDiv = document.getElementById('s3Status');
        statusDiv.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>S3 Not Configured:</strong> Configure your S3 storage to enable file uploads.
                ${error ? `<br><small class="text-danger">Error: ${error}</small>` : ''}
            </div>
        `;
    }

    setupEventListeners() {
        // S3 Configuration Form
        const configForm = document.getElementById('s3ConfigForm');
        if (configForm) {
            configForm.addEventListener('submit', (e) => this.saveConfiguration(e));
        }

        // Test Connection Button
        const testButton = document.getElementById('testS3Connection');
        if (testButton) {
            testButton.addEventListener('click', () => this.testConnection());
        }
    }

    async saveConfiguration(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const config = {
            endpoint: formData.get('endpoint'),
            region: formData.get('region'),
            bucket: formData.get('bucket'),
            accessKeyId: formData.get('accessKey'),
            secretAccessKey: formData.get('secretKey'),
            usePathStyle: formData.get('usePathStyle') === 'on'
        };

        try {
            const response = await api.request('/s3/config', {
                method: 'POST',
                body: JSON.stringify(config)
            });

            this.showAlert('S3 configuration saved successfully', 'success');
            await this.checkConfiguration();
        } catch (error) {
            console.error('Failed to save S3 configuration:', error);
            this.showAlert(error.message || 'Failed to save S3 configuration', 'danger');
        }
    }

    async testConnection() {
        const testButton = document.getElementById('testS3Connection');
        const originalText = testButton.innerHTML;
        
        testButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        testButton.disabled = true;

        try {
            const response = await api.request('/s3/test', {
                method: 'POST'
            });

            this.showAlert(`S3 connection successful: ${response.bucket}`, 'success');
        } catch (error) {
            console.error('S3 connection test failed:', error);
            this.showAlert(error.message || 'S3 connection failed', 'danger');
        } finally {
            testButton.innerHTML = originalText;
            testButton.disabled = false;
        }
    }

    async uploadFile(file, entityType, entityId = null, onProgress = null) {
        if (!this.isConfigured) {
            throw new Error('S3 storage not configured');
        }

        const uploadId = Date.now() + Math.random();
        
        try {
            // Get presigned upload URL
            const urlResponse = await api.request('/s3/upload-url', {
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
            const uploadResult = await this.directUpload(file, urlResponse, onProgress);
            
            // Mark upload as complete
            const completeResponse = await api.request('/s3/upload-complete', {
                method: 'POST',
                body: JSON.stringify({
                    uploadId: urlResponse.uploadId,
                    key: urlResponse.key
                })
            });

            return {
                success: true,
                url: completeResponse.url,
                key: completeResponse.key,
                uploadId: urlResponse.uploadId
            };
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    async directUpload(file, uploadConfig, onProgress) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            
            // Add all presigned POST fields
            Object.entries(uploadConfig.fields).forEach(([key, value]) => {
                formData.append(key, value);
            });
            
            // Add the file last
            formData.append('file', file);

            const xhr = new XMLHttpRequest();

            // Progress tracking
            if (onProgress) {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        onProgress(percentComplete);
                    }
                });
            }

            xhr.addEventListener('load', () => {
                if (xhr.status === 204 || xhr.status === 200) {
                    resolve({ success: true });
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload aborted'));
            });

            xhr.open('POST', uploadConfig.url);
            xhr.send(formData);
        });
    }

    async deleteFile(key) {
        try {
            await api.request(`/s3/file/${encodeURIComponent(key)}`, {
                method: 'DELETE'
            });
            this.showAlert('File deleted successfully', 'success');
            return true;
        } catch (error) {
            console.error('Failed to delete file:', error);
            this.showAlert(error.message || 'Failed to delete file', 'danger');
            return false;
        }
    }

    async getUploadHistory(limit = 50, offset = 0) {
        try {
            const response = await api.request(`/s3/uploads?limit=${limit}&offset=${offset}`);
            return response.uploads;
        } catch (error) {
            console.error('Failed to get upload history:', error);
            throw error;
        }
    }

    async getStorageStats() {
        try {
            const response = await api.request('/s3/storage-stats');
            return response.stats;
        } catch (error) {
            console.error('Failed to get storage stats:', error);
            throw error;
        }
    }

    // Helper method to format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Helper method to validate file
    validateFile(file, allowedTypes = [], maxSize = null) {
        const errors = [];

        if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
            errors.push(`File type ${file.type} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
        }

        if (maxSize && file.size > maxSize) {
            errors.push(`File size ${this.formatFileSize(file.size)} exceeds maximum ${this.formatFileSize(maxSize)}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Create drag-and-drop upload area
    createDropZone(element, options = {}) {
        const {
            allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'],
            maxSize = 500 * 1024 * 1024, // 500MB
            entityType = 'episode',
            entityId = null,
            onSuccess = null,
            onError = null,
            onProgress = null
        } = options;

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.classList.add('dragover');
        });

        element.addEventListener('dragleave', (e) => {
            e.preventDefault();
            element.classList.remove('dragover');
        });

        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            element.classList.remove('dragover');

            const files = Array.from(e.dataTransfer.files);
            
            for (const file of files) {
                const validation = this.validateFile(file, allowedTypes, maxSize);
                
                if (!validation.valid) {
                    if (onError) onError(validation.errors.join(', '));
                    continue;
                }

                try {
                    const result = await this.uploadFile(file, entityType, entityId, onProgress);
                    if (onSuccess) onSuccess(result);
                } catch (error) {
                    if (onError) onError(error.message);
                }
            }
        });

        // Also handle click to open file dialog
        element.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = allowedTypes.join(',');
            input.multiple = false;
            
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const validation = this.validateFile(file, allowedTypes, maxSize);
                
                if (!validation.valid) {
                    if (onError) onError(validation.errors.join(', '));
                    return;
                }

                try {
                    const result = await this.uploadFile(file, entityType, entityId, onProgress);
                    if (onSuccess) onSuccess(result);
                } catch (error) {
                    if (onError) onError(error.message);
                }
            });

            input.click();
        });
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);

        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Initialize S3 manager
const s3Manager = new S3Manager();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    s3Manager.initialize();
});

// Export for use in other scripts
window.s3Manager = s3Manager;