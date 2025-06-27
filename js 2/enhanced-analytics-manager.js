// js/enhanced-analytics-manager.js
// Enhanced Analytics Manager with Integration Steps functionality

class EnhancedAnalyticsManager extends AnalyticsManager {
  constructor() {
    super();
    this.integrationManager = null;
    this.integrationMode = 'guided'; // 'guided' or 'manual'
  }

  // Override the addAnalyticsManagementSection to include integration steps
  addAnalyticsManagementSection() {
    super.addAnalyticsManagementSection();
    this.enhanceWithIntegrationSteps();
  }

  // Add integration steps functionality to the existing analytics management
  enhanceWithIntegrationSteps() {
    const integrationStepsDiv = document.getElementById('integrationStepsList');
    if (!integrationStepsDiv) return;

    // Initialize integration manager
    this.integrationManager = new IntegrationStepsManager();

    // Create the integration steps interface
    integrationStepsDiv.innerHTML = `
      <div class="integration-steps-container">
        <!-- Integration Mode Toggle -->
        <div class="mb-4">
          <div class="btn-group" role="group">
            <input type="radio" class="btn-check" name="integrationMode" id="guidedMode" value="guided" checked>
            <label class="btn btn-outline-primary" for="guidedMode">
              <i class="fas fa-route me-2"></i>Guided Setup
            </label>
            
            <input type="radio" class="btn-check" name="integrationMode" id="manualMode" value="manual">
            <label class="btn btn-outline-primary" for="manualMode">
              <i class="fas fa-cogs me-2"></i>Manual Steps
            </label>
          </div>
        </div>

        <!-- Guided Mode Interface -->
        <div id="guidedModeContainer">
          <div class="alert alert-info">
            <i class="fas fa-info-circle me-2"></i>
            <strong>Guided Setup:</strong> Follow the recommended integration path with automatic dependency resolution.
          </div>
          
          <div class="integration-progress mb-4">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6>Integration Progress</h6>
              <span class="progress-text">0 / ${this.integrationManager.steps.length} steps completed</span>
            </div>
            <div class="progress">
              <div class="progress-bar bg-success" role="progressbar" style="width: 0%"></div>
            </div>
          </div>

          <div class="recommended-steps">
            <h6 class="mb-3">Recommended Integration Order:</h6>
            <div id="recommendedStepsList">
              <!-- Will be populated with recommended steps -->
            </div>
          </div>
        </div>

        <!-- Manual Mode Interface -->
        <div id="manualModeContainer" style="display: none;">
          <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Manual Mode:</strong> Apply individual integration steps as needed. Check dependencies before applying.
          </div>
          
          <!-- Filter Controls -->
          <div class="mb-4">
            <div class="row">
              <div class="col-md-4">
                <label class="form-label">Filter by Category:</label>
                <select class="form-select" id="categoryFilter">
                  <option value="">All Categories</option>
                  <option value="Setup">Setup</option>
                  <option value="Episode Tracking">Episode Tracking</option>
                  <option value="Download Tracking">Download Tracking</option>
                  <option value="Social Tracking">Social Tracking</option>
                  <option value="Search Tracking">Search Tracking</option>
                  <option value="Admin Panel">Admin Panel</option>
                  <option value="Advanced Tracking">Advanced Tracking</option>
                  <option value="Dashboard">Dashboard</option>
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label">Filter by Status:</label>
                <select class="form-select" id="statusFilter">
                  <option value="">All Steps</option>
                  <option value="applied">Applied</option>
                  <option value="not-applied">Not Applied</option>
                  <option value="needs-fix">Needs Fix</option>
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label">Filter by Impact:</label>
                <select class="form-select" id="impactFilter">
                  <option value="">All Impact Levels</option>
                  <option value="low">Low Impact</option>
                  <option value="medium">Medium Impact</option>
                  <option value="high">High Impact</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Bulk Actions -->
          <div class="mb-4">
            <div class="btn-group">
              <button class="btn btn-success" id="applyAllRecommended">
                <i class="fas fa-play me-2"></i>Apply All Recommended
              </button>
              <button class="btn btn-warning" id="rollbackAll">
                <i class="fas fa-undo me-2"></i>Rollback All
              </button>
              <button class="btn btn-info" id="testAllApplied">
                <i class="fas fa-flask me-2"></i>Test All Applied
              </button>
              <button class="btn btn-outline-secondary" id="exportIntegrationConfig">
                <i class="fas fa-download me-2"></i>Export Config
              </button>
            </div>
          </div>

          <!-- Integration Steps Grid -->
          <div id="integrationStepsGrid">
            <!-- Will be populated with all integration steps -->
          </div>
        </div>

        <!-- Integration Summary -->
        <div class="mt-4">
          <div class="card">
            <div class="card-header">
              <h6><i class="fas fa-chart-pie me-2"></i>Integration Summary</h6>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-3">
                  <div class="text-center">
                    <div class="fs-4 text-success" id="appliedCount">0</div>
                    <small class="text-muted">Applied</small>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="text-center">
                    <div class="fs-4 text-warning" id="needsFixCount">0</div>
                    <small class="text-muted">Needs Fix</small>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="text-center">
                    <div class="fs-4 text-secondary" id="pendingCount">0</div>
                    <small class="text-muted">Pending</small>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="text-center">
                    <div class="fs-4 text-info" id="readyCount">0</div>
                    <small class="text-muted">Ready to Apply</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupIntegrationEventListeners();
    this.updateIntegrationInterface();
  }

  // Setup event listeners for integration features
  setupIntegrationEventListeners() {
    // Mode toggle
    document.querySelectorAll('input[name="integrationMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.integrationMode = e.target.value;
        this.toggleIntegrationMode();
      });
    });

    // Filter controls
    ['categoryFilter', 'statusFilter', 'impactFilter'].forEach(filterId => {
      document.getElementById(filterId)?.addEventListener('change', () => {
        this.filterIntegrationSteps();
      });
    });

    // Bulk actions
    document.getElementById('applyAllRecommended')?.addEventListener('click', () => {
      this.applyAllRecommendedSteps();
    });

    document.getElementById('rollbackAll')?.addEventListener('click', () => {
      this.rollbackAllSteps();
    });

    document.getElementById('testAllApplied')?.addEventListener('click', () => {
      this.testAllAppliedSteps();
    });

    document.getElementById('exportIntegrationConfig')?.addEventListener('click', () => {
      this.exportIntegrationConfiguration();
    });
  }

  // Toggle between guided and manual mode
  toggleIntegrationMode() {
    const guidedContainer = document.getElementById('guidedModeContainer');
    const manualContainer = document.getElementById('manualModeContainer');

    if (this.integrationMode === 'guided') {
      guidedContainer.style.display = 'block';
      manualContainer.style.display = 'none';
      this.updateGuidedMode();
    } else {
      guidedContainer.style.display = 'none';
      manualContainer.style.display = 'block';
      this.updateManualMode();
    }
  }

  // Update guided mode interface
  updateGuidedMode() {
    const recommendedSteps = this.getRecommendedSteps();
    const container = document.getElementById('recommendedStepsList');
    
    container.innerHTML = recommendedSteps.map((step, index) => {
      const isApplied = this.integrationManager.appliedSteps.includes(step.id);
      const canApply = this.integrationManager.canApplyStep(step);
      const isNext = !isApplied && canApply && index === this.getNextStepIndex(recommendedSteps);
      
      return `
        <div class="recommended-step-item mb-3 ${isNext ? 'border border-primary' : ''}" data-step-id="${step.id}">
          <div class="d-flex align-items-center">
            <div class="step-number me-3">
              <div class="rounded-circle d-flex align-items-center justify-content-center ${isApplied ? 'bg-success text-white' : isNext ? 'bg-primary text-white' : 'bg-light'}" 
                   style="width: 30px; height: 30px;">
                ${isApplied ? '<i class="fas fa-check"></i>' : index + 1}
              </div>
            </div>
            
            <div class="flex-grow-1">
              <h6 class="mb-1">${step.title}</h6>
              <p class="mb-1 text-muted small">${step.description}</p>
              <div class="step-meta">
                <span class="badge bg-${step.impact === 'high' ? 'danger' : step.impact === 'medium' ? 'warning' : 'info'} me-2">
                  ${step.impact} impact
                </span>
                <span class="badge bg-light text-dark">${step.category}</span>
              </div>
            </div>
            
            <div class="step-actions">
              ${!isApplied && isNext ? 
                `<button class="btn btn-primary btn-sm" onclick="enhancedAnalyticsManager.applyGuidedStep('${step.id}')">
                  <i class="fas fa-play me-1"></i> Apply Next
                </button>` :
                !isApplied ? 
                `<button class="btn btn-outline-secondary btn-sm" disabled>
                  Waiting...
                </button>` :
                `<button class="btn btn-success btn-sm" disabled>
                  <i class="fas fa-check me-1"></i> Applied
                </button>`
              }
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.updateProgressBar();
  }

  // Update manual mode interface
  updateManualMode() {
    const container = document.getElementById('integrationStepsGrid');
    container.innerHTML = this.integrationManager.generateStepsUI();
    this.updateIntegrationSummary();
  }

  // Get recommended steps in order
  getRecommendedSteps() {
    const order = [
      'load-scripts',
      'episode-data-attributes',
      'play-button-tracking',
      'download-tracking',
      'social-share-tracking',
      'search-tracking',
      'admin-analytics-section',
      'custom-event-tracking',
      'episode-analytics-modal',
      'realtime-widget',
      'analytics-dashboard'
    ];

    return order.map(id => this.integrationManager.steps.find(s => s.id === id)).filter(Boolean);
  }

  // Get next step index in guided mode
  getNextStepIndex(recommendedSteps) {
    for (let i = 0; i < recommendedSteps.length; i++) {
      const step = recommendedSteps[i];
      const isApplied = this.integrationManager.appliedSteps.includes(step.id);
      const canApply = this.integrationManager.canApplyStep(step);
      
      if (!isApplied && canApply) {
        return i;
      }
    }
    return -1;
  }

  // Update progress bar
  updateProgressBar() {
    const totalSteps = this.integrationManager.steps.length;
    const appliedSteps = this.integrationManager.appliedSteps.length;
    const percentage = (appliedSteps / totalSteps) * 100;

    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');

    if (progressBar) progressBar.style.width = percentage + '%';
    if (progressText) progressText.textContent = `${appliedSteps} / ${totalSteps} steps completed`;
  }

  // Update integration summary
  updateIntegrationSummary() {
    const applied = this.integrationManager.appliedSteps.length;
    let needsFix = 0;
    let ready = 0;
    
    this.integrationManager.steps.forEach(step => {
      const isApplied = this.integrationManager.appliedSteps.includes(step.id);
      if (isApplied && !step.validation()) {
        needsFix++;
      } else if (!isApplied && this.integrationManager.canApplyStep(step)) {
        ready++;
      }
    });

    const pending = this.integrationManager.steps.length - applied;

    document.getElementById('appliedCount').textContent = applied;
    document.getElementById('needsFixCount').textContent = needsFix;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('readyCount').textContent = ready;
  }

  // Apply step in guided mode
  async applyGuidedStep(stepId) {
    await this.integrationManager.applyStep(stepId);
    this.updateGuidedMode();
    this.updateIntegrationSummary();
  }

  // Filter integration steps
  filterIntegrationSteps() {
    const categoryFilter = document.getElementById('categoryFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const impactFilter = document.getElementById('impactFilter').value;

    document.querySelectorAll('.integration-step-card').forEach(card => {
      const stepId = card.dataset.stepId;
      const step = this.integrationManager.steps.find(s => s.id === stepId);
      const isApplied = this.integrationManager.appliedSteps.includes(stepId);
      const isValid = isApplied ? step.validation() : false;

      let show = true;

      // Category filter
      if (categoryFilter && step.category !== categoryFilter) {
        show = false;
      }

      // Status filter
      if (statusFilter) {
        if (statusFilter === 'applied' && !isApplied) show = false;
        if (statusFilter === 'not-applied' && isApplied) show = false;
        if (statusFilter === 'needs-fix' && (!isApplied || isValid)) show = false;
      }

      // Impact filter
      if (impactFilter && step.impact !== impactFilter) {
        show = false;
      }

      card.closest('.col-md-6').style.display = show ? 'block' : 'none';
    });
  }

  // Apply all recommended steps
  async applyAllRecommendedSteps() {
    if (!confirm('Apply all recommended integration steps? This will modify your site.')) return;

    const recommendedSteps = this.getRecommendedSteps();
    const modal = this.createProgressModal('Applying Integration Steps');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < recommendedSteps.length; i++) {
      const step = recommendedSteps[i];
      
      if (this.integrationManager.appliedSteps.includes(step.id)) {
        continue; // Skip already applied
      }

      if (!this.integrationManager.canApplyStep(step)) {
        continue; // Skip if dependencies not met
      }

      this.updateProgressModal(modal, `Applying: ${step.title}`, (i + 1) / recommendedSteps.length * 100);

      try {
        await this.integrationManager.applyStep(step.id);
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to apply ${step.id}:`, error);
      }
    }

    this.closeProgressModal(modal);
    this.updateIntegrationInterface();

    this.showSuccess(`Integration complete! ${successCount} steps applied successfully${failCount > 0 ? `, ${failCount} failed` : ''}.`);
  }

  // Rollback all steps
  async rollbackAllSteps() {
    if (!confirm('Rollback ALL integration steps? This will remove analytics tracking from your site.')) return;

    const appliedSteps = [...this.integrationManager.appliedSteps].reverse(); // Reverse for safe rollback
    const modal = this.createProgressModal('Rolling Back Integration Steps');

    let successCount = 0;

    for (let i = 0; i < appliedSteps.length; i++) {
      const stepId = appliedSteps[i];
      const step = this.integrationManager.steps.find(s => s.id === stepId);

      this.updateProgressModal(modal, `Rolling back: ${step.title}`, (i + 1) / appliedSteps.length * 100);

      try {
        await this.integrationManager.rollbackStep(stepId);
        successCount++;
      } catch (error) {
        console.error(`Failed to rollback ${stepId}:`, error);
      }
    }

    this.closeProgressModal(modal);
    this.updateIntegrationInterface();

    this.showWarning(`Rollback complete! ${successCount} steps rolled back.`);
  }

  // Test all applied steps
  async testAllAppliedSteps() {
    const appliedSteps = this.integrationManager.appliedSteps;
    const modal = this.createProgressModal('Testing Integration Steps');

    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < appliedSteps.length; i++) {
      const stepId = appliedSteps[i];
      const step = this.integrationManager.steps.find(s => s.id === stepId);

      this.updateProgressModal(modal, `Testing: ${step.title}`, (i + 1) / appliedSteps.length * 100);

      try {
        const isValid = await step.validation();
        if (isValid) {
          validCount++;
        } else {
          invalidCount++;
        }
      } catch (error) {
        invalidCount++;
        console.error(`Test failed for ${stepId}:`, error);
      }
    }

    this.closeProgressModal(modal);
    this.updateIntegrationInterface();

    const message = `Testing complete! ${validCount} steps valid${invalidCount > 0 ? `, ${invalidCount} need attention` : ''}.`;
    if (invalidCount > 0) {
      this.showWarning(message);
    } else {
      this.showSuccess(message);
    }
  }

  // Export integration configuration
  exportIntegrationConfiguration() {
    const config = {
      appliedSteps: this.integrationManager.appliedSteps,
      settings: this.settings,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `castbuzz-analytics-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showSuccess('Integration configuration exported successfully!');
  }

  // Create progress modal
  createProgressModal(title) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
          </div>
          <div class="modal-body">
            <div class="progress-step-text mb-3">Initializing...</div>
            <div class="progress">
              <div class="progress-bar progress-bar-striped progress-bar-animated" 
                   role="progressbar" style="width: 0%"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal, { backdrop: 'static', keyboard: false });
    modalInstance.show();

    return { element: modal, instance: modalInstance };
  }

  // Update progress modal
  updateProgressModal(modal, text, percentage) {
    const textElement = modal.element.querySelector('.progress-step-text');
    const progressBar = modal.element.querySelector('.progress-bar');

    if (textElement) textElement.textContent = text;
    if (progressBar) progressBar.style.width = percentage + '%';
  }

  // Close progress modal
  closeProgressModal(modal) {
    modal.instance.hide();
    setTimeout(() => modal.element.remove(), 500);
  }

  // Update entire integration interface
  updateIntegrationInterface() {
    if (this.integrationMode === 'guided') {
      this.updateGuidedMode();
    } else {
      this.updateManualMode();
    }
    this.updateIntegrationSummary();
  }

  // Override auto setup to use guided mode
  async autoSetupAnalytics() {
    // Switch to guided mode
    document.getElementById('guidedMode').checked = true;
    this.integrationMode = 'guided';
    this.toggleIntegrationMode();

    // Apply all recommended steps
    await this.applyAllRecommendedSteps();
  }
}

// Initialize enhanced analytics manager
document.addEventListener('DOMContentLoaded', function() {
  window.enhancedAnalyticsManager = new EnhancedAnalyticsManager();
});