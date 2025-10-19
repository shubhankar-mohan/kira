// KiranaClub Task Manager - Main Application (Modular Version)
class App {
    constructor() {
        console.log('🚀 App v5.0 - Modular Version');
        this.init();
    }

    async init() {
        console.log('App initializing...');
        
        // Initialize modules
        this.initializeModules();
        
        // Check authentication
        await window.authManager.checkAuth();

        // After auth, load initial data and honor deep links like /task/:id
        // This ensures router.pendingTaskNavigation is processed
        try {
            await this.loadInitialData();
        } catch (e) {
            console.error('Initial data load failed:', e);
        }
    }

    initializeModules() {
        // Initialize all modules
        window.router = new Router();
        window.authManager = new AuthManager();
        window.taskManager = new TaskManager();
        window.modalManager = new ModalManager();
        window.uiManager = new UIManager();
        
        // Set up cross-module references
        window.taskManager.router = window.router;
        window.taskManager.authManager = window.authManager;
        window.taskManager.modalManager = window.modalManager;
        window.taskManager.uiManager = window.uiManager;
    }

    async loadInitialData() {
        console.log('Loading initial data...');
        
        window.uiManager.showLoading();
        
        try {
            console.log('Loading tasks, users, and sprints...');
            await Promise.all([
                window.taskManager.loadTasks(),
                this.loadUsers(),
                this.loadSprints()
            ]);
            
            console.log('Data loaded successfully. Tasks:', window.taskManager.tasks.length, 'Users:', this.users.length, 'Sprints:', this.sprints.length);
            
            console.log('Updating dashboard...');
            window.taskManager.updateDashboard();
            // Load recent activity widget if present
            if (window.uiManager && typeof window.uiManager.renderRecentActivity === 'function') {
                window.uiManager.renderRecentActivity();
            }
            
            console.log('Creating task board...');
            if (window.taskBoardManager) {
                window.taskBoardManager.createTaskBoard();
                window.taskBoardManager.renderTasks(window.taskManager.tasks);
                window.taskBoardManager.populateFilters();
            }
            
            // Handle pending task navigation
            if (window.router.pendingTaskNavigation && window.router.currentTaskId) {
                window.router.pendingTaskNavigation = false;
                window.router.navigateToPage('task-detail', false);
            }
            
            console.log('Populating filters...');
            window.taskManager.populateFilters();
            
            // Initialize modal manager dropdowns after data is loaded
            console.log('Initializing modal manager dropdowns...');
            if (window.modalManager) {
                window.modalManager.refreshCreateTaskDropdowns();
            }
            
            // Initialize filter display text
            if (typeof updateFilterDisplayText === 'function') {
                updateFilterDisplayText();
            }
            
            // Handle task detail page after data is loaded
            if (window.router.currentPage === 'task-detail' && window.router.currentTaskId) {
                this.showTaskDetailPage(window.router.currentTaskId);
            }
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            window.uiManager.showNotification('Failed to load data. Please refresh the page.', 'error');
        } finally {
            window.uiManager.hideLoading();
        }
    }

    async loadUsers() {
        try {
            const response = await api.getUsers();
            this.users = response.data || [];
        } catch (error) {
            console.error('Error loading users:', error);
            this.users = [];
        }
    }

    async loadSprints() {
        try {
            const response = await api.getSprints();
            this.sprints = response.data || [];
        } catch (error) {
            console.error('Error loading sprints:', error);
            this.sprints = [];
        }
    }

    loadPageContent(page) {
        switch (page) {
            case 'dashboard':
                // Just update dashboard with existing data - data is already loaded in init
                console.log('Dashboard: Updating with existing data...');
                window.taskManager.updateDashboard();
                // Refresh recent activity widget
                if (window.uiManager && typeof window.uiManager.renderRecentActivity === 'function') {
                    window.uiManager.renderRecentActivity();
                }
                break;
            case 'board':
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(window.taskManager.tasks);
                    window.taskBoardManager.populateFilters();
                }
                break;
            case 'sprints':
                window.uiManager.renderSprints();
                break;
            case 'users':
                window.uiManager.renderUsers();
                break;
            case 'task-detail':
                if (window.router.currentTaskId) {
                    this.showTaskDetailPage(window.router.currentTaskId);
                }
                break;
        }
    }

    async showTaskDetailPage(taskId) {
        try {
            window.uiManager.showLoading();

            let resolvedTask = window.taskManager.tasks.find(t => (t.shortId && t.shortId.toLowerCase() === taskId.toLowerCase()) || t.id === taskId);

            if (!resolvedTask) {
                // If task not in memory, fetch from API (supports shortId)
                const response = await api.getTask(taskId);
                if (response && response.data) {
                    resolvedTask = response.data;
                    const existingIndex = window.taskManager.tasks.findIndex(t => t.id === resolvedTask.id);
                    if (existingIndex > -1) {
                        window.taskManager.tasks[existingIndex] = resolvedTask;
                    } else {
                        window.taskManager.tasks.unshift(resolvedTask);
                    }
                }
            } else {
                // Always refresh to ensure comments/activity are current
                const freshData = await window.taskManager.refreshTaskDetail(resolvedTask.id);
                if (freshData) {
                    resolvedTask = freshData;
                }
            }

            if (!resolvedTask) {
                window.uiManager.showNotification('Task not found', 'error');
                window.router.navigateToPage('dashboard');
                return;
            }

            const canonicalId = resolvedTask.shortId || resolvedTask.id;
            window.router.currentTaskId = canonicalId;

            window.history.pushState({ page: 'task-detail', taskId: canonicalId }, '', `/task/${canonicalId}`);
            window.router.updateBreadcrumb(`Task ${canonicalId}`);

            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.page-section').forEach(section => section.classList.add('hidden'));

            const taskDetailSection = document.getElementById('taskDetailSection');
            if (taskDetailSection) {
                taskDetailSection.classList.remove('hidden');
            }

            const formContainer = document.getElementById('taskDetailForm');
            if (formContainer) {
                formContainer.innerHTML = this.createTaskDetailFormHTML(resolvedTask);
                this.populateTaskDetailForm(resolvedTask);
                if (window.modalManager) {
                    window.modalManager.loadTaskActivity(resolvedTask.id);
                    window.modalManager.loadTaskComments(resolvedTask.id);
                }
            }
        } catch (err) {
            console.error('Failed to load task detail page:', err);
            window.uiManager.showNotification('Unable to load task details', 'error');
            window.router.navigateToPage('dashboard');
        } finally {
            window.uiManager.hideLoading();
        }
    }

    createTaskDetailFormHTML(task) {
        return `
            <div class="task-detail-form-container">
                <div class="task-details-header">
                    <div class="task-header-info">
                        <h3 class="task-title-large">Task Details</h3>
                        <div class="task-meta-badges">
                            <span class="task-id-badge">${task.shortId || task.id || 'NEW'}</span>
                            <span class="status-badge status-${(task.status || 'not-started').toLowerCase().replace(/[^a-z]/g, '-')}">${task.status || 'Not started'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="modal-body">
                    <form id="taskDetailsPageForm">
                        <!-- Primary Information Section -->
                        <div class="form-section">
                            <div class="section-header">
                                <h4 class="section-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 11l3 3 8-8"></path>
                                        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9"></path>
                                    </svg>
                                    Task Information
                                </h4>
                            </div>
                            
                            <div class="form-grid-modern">
                                <div class="input-group-modern full-width">
                                    <label for="pageTaskTitle" class="input-label">Task Title</label>
                                    <input type="text" id="pageTaskTitle" class="input-modern" required>
                                </div>
                                
                                <div class="input-group-modern">
                                    <label for="pageTaskStatus" class="input-label">Status</label>
                                    <div class="select-wrapper">
                                        <select id="pageTaskStatus" class="select-modern" required>
                                            <option value="Not started">Not Started</option>
                                            <option value="In progress">In Progress</option>
                                            <option value="Dev Testing">Dev Testing</option>
                                            <option value="Done">Done</option>
                                            <option value="Blocked - Product">Blocked - Product</option>
                                            <option value="Blocked - Engineering">Blocked - Engineering</option>
                                        </select>
                                        <svg class="select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="6,9 12,15 18,9"></polyline>
                                        </svg>
                                    </div>
                                </div>
                                
                                <div class="input-group-modern">
                                    <label for="pageTaskPriority" class="input-label">Priority</label>
                                    <div class="select-wrapper">
                                        <select id="pageTaskPriority" class="select-modern" required>
                                            <option value="P0">🔴 P0 - Critical</option>
                                            <option value="P1">🟠 P1 - High</option>
                                            <option value="P2">🟡 P2 - Medium</option>
                                            <option value="Backlog">⚪ Backlog</option>
                                        </select>
                                        <svg class="select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="6,9 12,15 18,9"></polyline>
                                        </svg>
                                    </div>
                                </div>
                                
                                <div class="input-group-modern">
                                    <label for="pageTaskType" class="input-label">Type</label>
                                    <div class="select-wrapper">
                                        <select id="pageTaskType" class="select-modern" required>
                                            <option value="Feature">🚀 Feature</option>
                                            <option value="Bug">🐛 Bug</option>
                                            <option value="Improvement">✨ Improvement</option>
                                        </select>
                                        <svg class="select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="6,9 12,15 18,9"></polyline>
                                        </svg>
                                    </div>
                                </div>
                                
                                <div class="input-group-modern">
                                    <label for="pageTaskAssignee" class="input-label">Assigned To</label>
                                    <div class="select-wrapper">
                                        <select id="pageTaskAssignee" class="select-modern">
                                            <option value="">👤 Select assignee</option>
                                        </select>
                                        <svg class="select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="6,9 12,15 18,9"></polyline>
                                        </svg>
                                    </div>
                                </div>
                                
                                <div class="input-group-modern">
                                    <label for="pageTaskSprint" class="input-label">Sprint</label>
                                    <div class="select-wrapper">
                                        <select id="pageTaskSprint" class="select-modern">
                                            <option value="">🏃 No Sprint</option>
                                        </select>
                                        <svg class="select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="6,9 12,15 18,9"></polyline>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="input-group-modern full-width">
                                <label for="pageTaskDescription" class="input-label">Description</label>
                                <textarea id="pageTaskDescription" class="textarea-modern" rows="4" placeholder="Enter task description..."></textarea>
                            </div>
                        </div>

                        <!-- Metadata Section -->
                        <div class="form-section">
                            <div class="section-header">
                                <h4 class="section-title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="3"></circle>
                                        <path d="M12 1v6m0 6v6m-11-1h6m6 0h6"></path>
                                    </svg>
                                    Metadata
                                </h4>
                            </div>
                            
                            <div class="metadata-grid">
                                <div class="metadata-item">
                                    <label class="metadata-label">Created By</label>
                                    <div class="metadata-value">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        <span id="pageTaskCreatedBy"></span>
                                    </div>
                                </div>
                                
                                <div class="metadata-item">
                                    <label class="metadata-label">Created At</label>
                                    <div class="metadata-value">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <polyline points="12,6 12,12 16,14"></polyline>
                                        </svg>
                                        <span id="pageTaskCreatedAt"></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                
                <div class="modern-footer">
                    <div class="footer-info">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="m9 12 2 2 4-4"></path>
                        </svg>
                        <span>Auto-saved</span>
                    </div>
                    <div class="footer-actions">
                        <button class="btn-modern btn-secondary" data-action="navigateTo" data-page="board">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            Cancel
                        </button>
                        <button class="btn-modern btn-primary" data-action="saveTaskDetailsFromPage">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17,21 17,13 7,13 7,21"></polyline>
                                <polyline points="7,3 7,8 15,8"></polyline>
                            </svg>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    populateTaskDetailForm(task) {
        // Populate basic fields
        document.getElementById('pageTaskTitle').value = task.task || '';
        document.getElementById('pageTaskStatus').value = task.status || 'Not started';
        document.getElementById('pageTaskPriority').value = task.priority || 'P2';
        document.getElementById('pageTaskType').value = task.type || 'Feature';
        document.getElementById('pageTaskDescription').value = task.description || '';
        
        // Populate metadata
        const createdByElement = document.getElementById('pageTaskCreatedBy');
        const createdAtElement = document.getElementById('pageTaskCreatedAt');
        if (createdByElement) createdByElement.textContent = task.createdBy || 'Unknown';
        if (createdAtElement) createdAtElement.textContent = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'Unknown';

        // Populate dropdowns
        this.populatePageTaskDropdowns();

        // Set current assignee and sprint
        if (task.assignedTo) {
            document.getElementById('pageTaskAssignee').value = task.assignedTo;
        }
        if (task.sprintWeek) {
            document.getElementById('pageTaskSprint').value = task.sprintWeek;
        }

        if (taskAssignee) {
            const assigneeSelect = document.getElementById('pageTaskAssignee');
            if (assigneeSelect) {
                assigneeSelect.value = task.assignedTo || '';
            }
        }

            const idDisplay = document.querySelector('.task-id-badge');
            if (idDisplay) {
                idDisplay.textContent = task.shortId || task.id || 'NEW';
            }
    }

    populatePageTaskDropdowns() {
        // Populate assignee dropdown
        const assigneeSelect = document.getElementById('pageTaskAssignee');
        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="">👤 Select assignee</option>';
            this.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = user.name;
                assigneeSelect.appendChild(option);
            });
        }

        // Populate sprint dropdown
        const sprintSelect = document.getElementById('pageTaskSprint');
        if (sprintSelect) {
            sprintSelect.innerHTML = '<option value="">🏃 No Sprint</option>';
            this.sprints.forEach(sprint => {
                const option = document.createElement('option');
                option.value = sprint.name;
                option.textContent = sprint.name;
                sprintSelect.appendChild(option);
            });
        }
    }

    async saveTaskDetailsFromPage(taskData) {
        if (!window.router.currentTaskId) return;

        try {
            window.uiManager.showLoading();
            const response = await api.updateTask(window.router.currentTaskId, taskData);
            
            if (response.success) {
                // Update local task
                const taskIndex = window.taskManager.tasks.findIndex(t => t.id === window.router.currentTaskId);
                if (taskIndex !== -1) {
                    window.taskManager.tasks[taskIndex] = { ...window.taskManager.tasks[taskIndex], ...taskData };
                }
                
                // Re-render board if it's available
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(window.taskManager.tasks);
                }
                
                window.uiManager.showNotification('Task updated successfully!', 'success');
                
                // Send Slack notification for task updates
                await this.sendSlackTaskUpdate(window.router.currentTaskId, taskData);
                
                // Navigate back to board
                setTimeout(() => {
                    window.router.navigateToPage('board');
                }, 1000);
            } else {
                window.uiManager.showNotification('Failed to update task: ' + response.error, 'error');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            window.uiManager.showNotification('Failed to update task', 'error');
        } finally {
            window.uiManager.hideLoading();
        }
    }

    async sendSlackTaskUpdate(taskId, taskData) {
        return window.taskManager?.sendSlackTaskUpdate(taskId, taskData);
    }
}

// Global functions
function openTaskDetails(taskId) {
    if (window.modalManager) {
        window.modalManager.openTaskDetails(taskId);
    }
}

function editTask(taskId) {
    // Same as openTaskDetails for now
    openTaskDetails(taskId);
}

function saveTaskDetails() {
    if (window.modalManager) {
        window.modalManager.saveTaskDetails();
    }
}

function saveTaskDetailsFromPage() {
    if (!window.app || !window.router.currentTaskId) return;

    const taskData = {
        task: document.getElementById('pageTaskTitle').value,
        status: document.getElementById('pageTaskStatus').value,
        priority: document.getElementById('pageTaskPriority').value,
        type: document.getElementById('pageTaskType').value,
        description: document.getElementById('pageTaskDescription').value,
        assignedTo: document.getElementById('pageTaskAssignee').value,
        sprintWeek: document.getElementById('pageTaskSprint').value
    };

    // Call the existing save method with page data
    window.app.saveTaskDetailsFromPage(taskData);
}

function closeModal(modalId) {
    if (window.modalManager) {
        window.modalManager.closeModal(modalId);
    }
}

function syncData() {
    if (window.uiManager) {
        window.uiManager.syncData();
    }
}

function logout() {
    if (window.authManager) {
        window.authManager.logout();
    }
}

function toggleProfileMenu() {
    if (window.uiManager) {
        window.uiManager.toggleProfileMenu();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
}); 