// UI Manager Module - Handles notifications, loading states, and other UI operations
class UIManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        const passwordField = document.getElementById('password');
        if (passwordField) {
            passwordField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    window.authManager.login();
                }
            });
        }
    }

    showLoading() {
        const loading = document.getElementById('loadingIndicator');
        if (loading) {
            loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loading = document.getElementById('loadingIndicator');
        if (loading) {
            loading.classList.add('hidden');
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = `notification ${type}`;
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    }

    toggleProfileMenu() {
        const profileMenu = document.querySelector('.profile-menu');
        if (profileMenu) {
            profileMenu.classList.toggle('open');
        }
    }

    fillDemoCredentials(email, password) {
        document.getElementById('username').value = email;
        document.getElementById('password').value = password;
    }

    renderSprints() {
        console.log('🎨 UI Manager: renderSprints() called');
        const container = document.getElementById('sprintsContent');
        if (!container) {
            console.log('❌ sprintsContent container not found');
            return;
        }

        const sprints = window.taskManager.sprints || [];
        const tasks = window.taskManager.tasks || [];
        console.log('📊 Sprints data:', sprints);
        console.log('📋 Tasks data for sprints:', tasks.length, 'tasks');
        
        // Calculate task stats for each sprint
        const sprintsWithStats = sprints.map(sprint => {
            const sprintTasks = tasks.filter(task => {
                const taskSprint = task.sprintWeek || task.sprint || '';
                const sprintName = sprint.sprintWeek || sprint.name || '';
                return taskSprint === sprintName;
            });
            
            const completedTasks = sprintTasks.filter(task => task.status === 'Done' || task.status === 'Completed');
            const completionRate = sprintTasks.length > 0 ? Math.round((completedTasks.length / sprintTasks.length) * 100) : 0;
            
            return {
                ...sprint,
                stats: {
                    totalTasks: sprintTasks.length,
                    completedTasks: completedTasks.length,
                    completionRate
                }
            };
        });
        
        container.innerHTML = sprintsWithStats.map(sprint => `
            <div class="sprint-strip ${sprint.isCurrent ? 'current-sprint' : ''}" data-sprint-id="${sprint.sprintWeek || sprint.name}">
                <div class="sprint-strip-content">
                    <div class="sprint-main-info">
                        <div class="sprint-title-section">
                            <h3 class="sprint-name">${sprint.sprintWeek || sprint.name}</h3>
                            ${sprint.isCurrent ? '<span class="current-badge">Current</span>' : ''}
                        </div>
                        <div class="sprint-goal-text">${sprint.goal || 'No goal set'}</div>
                        <div class="sprint-meta">
                            <span class="created-by">Created by ${sprint.createdBy?.split('@')[0] || 'Unknown'}</span>
                        </div>
                    </div>
                    <div class="sprint-stats-compact">
                        <div class="stat-compact">
                            <span class="stat-value">${sprint.stats.totalTasks}</span>
                            <span class="stat-label">Tasks</span>
                        </div>
                        <div class="stat-compact">
                            <span class="stat-value">${sprint.stats.completedTasks}</span>
                            <span class="stat-label">Done</span>
                        </div>
                        <div class="stat-compact completion-rate">
                            <span class="stat-value">${sprint.stats.completionRate}%</span>
                            <span class="stat-label">Complete</span>
                        </div>
                    </div>
                    <div class="sprint-actions">
                        <button class="btn-compact ${sprint.isCurrent ? 'btn-current' : 'btn-add'}" 
                                data-action="toggleCurrentSprint" 
                                data-sprint-id="${sprint.sprintWeek || sprint.name}">
                            ${sprint.isCurrent ? 'Current Sprint' : 'Add to Current'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async renderRecentActivity() {
        const container = document.getElementById('recentActivityFeed');
        if (!container) return;
        try {
            const res = await api.getActivityFeed({ limit: 30 });
            const items = Array.isArray(res.data) ? res.data : [];
            
            if (items.length === 0) {
                container.innerHTML = '<div class="activity-empty">No recent activity</div>';
                return;
            }
            
            container.innerHTML = items.map((a) => {
                const timeAgo = this.formatTimeAgo(a.timestamp);
                const taskId = a.taskShortId || a.taskId || '';
                const taskTitle = this.escapeHtml(a.taskTitle || 'Untitled Task');
                const action = a.action || '';
                const userName = this.escapeHtml(a.user || 'User');
                
                // Simplify action text
                let actionText = '';
                if (action.toLowerCase().includes('created')) {
                    actionText = `Created by ${userName}`;
                } else if (action.toLowerCase().includes('status')) {
                    actionText = `Updated by ${userName}`;
                } else {
                    actionText = `Updated by ${userName}`;
                }
                
                return `
                    <div class="activity-row" data-task-id="${taskId}" onclick="window.router?.navigateToPage('task-detail', false, '${taskId}')">
                        <div class="activity-task">
                            <span class="activity-task-id">${taskId}</span>
                            <span class="activity-task-title">${taskTitle}</span>
                        </div>
                        <div class="activity-info">
                            <span class="activity-action">${actionText}</span>
                            <span class="activity-time">${timeAgo}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error('Failed to load recent activity:', e);
            container.innerHTML = '<div class="activity-empty">⚠️ Failed to load recent activity</div>';
        }
    }
    
    formatTimeAgo(timestamp) {
        if (!timestamp) return 'Recently';
        const date = new Date(timestamp);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
    }
    
    getStatusClass(status) {
        const statusMap = {
            'Done': 'status-done',
            'In progress': 'status-progress',
            'Not started': 'status-pending',
            'Dev Testing': 'status-testing',
            'Blocked - Product': 'status-blocked',
            'Blocked - Engineering': 'status-blocked'
        };
        return statusMap[status] || 'status-default';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    showCreateUserModal() {
        if (window.modalManager) {
            window.modalManager.showModal('createUserModal');
        }
    }

    showCreateSprintModal() {
        if (window.modalManager) {
            window.modalManager.showCreateSprintModal();
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'TBD';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    renderUsers() {
        console.log('👥 UI Manager: renderUsers() called');
        const container = document.getElementById('usersContent');
        if (!container) {
            console.log('❌ usersContent container not found');
            return;
        }

        const users = window.taskManager.users || [];
        const tasks = window.taskManager.tasks || [];
        console.log('👤 Users data:', users);
        console.log('📋 Tasks data for users:', tasks.length, 'tasks');
        
        // Calculate task stats for each user
        const usersWithStats = users.map(user => {
            const userTasks = tasks.filter(task => {
                const assignedTo = task.assignedTo || '';
                return assignedTo.includes(user.email) || assignedTo.includes(user.name);
            });
            
            const completedTasks = userTasks.filter(task => task.status === 'Done' || task.status === 'Completed');
            
            return {
                ...user,
                taskCount: userTasks.length,
                completedCount: completedTasks.length
            };
        });
        
        container.innerHTML = usersWithStats.map(user => `
            <div class="user-card" data-user-id="${user.id || user.email}" data-action="openUserDetails" style="cursor: pointer;">
                <div class="user-header">
                    <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                    <div class="user-info">
                        <div class="user-name">${user.name}</div>
                        <div class="user-email">${user.email}</div>
                        <span class="user-role ${user.role.toLowerCase()}">${user.role}</span>
                    </div>
                </div>
                <div class="user-stats">
                    <div class="stat">
                        <span class="stat-value">${user.taskCount}</span>
                        <span class="stat-label">Tasks</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${user.completedCount}</span>
                        <span class="stat-label">Completed</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${user.slackName || 'N/A'}</span>
                        <span class="stat-label">Slack</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async syncData() {
        console.log('Syncing data...');
        this.showNotification('Syncing with Google Sheets...', 'info');
        
        try {
            await window.taskManager.loadTasks();
            await window.taskManager.loadUsers();
            await window.taskManager.loadSprints();
            
            window.taskManager.updateDashboard();
            if (window.taskBoardManager) {
                window.taskBoardManager.renderTasks(window.taskManager.tasks);
                window.taskBoardManager.populateFilters();
            }
            
            // Refresh modal dropdowns with updated data
            if (window.modalManager) {
                window.modalManager.refreshCreateTaskDropdowns();
            }
            
            this.showNotification('Data synced successfully!', 'success');
        } catch (error) {
            console.error('Sync error:', error);
            this.showNotification('Sync failed. Please try again.', 'error');
        }
    }

    async createUser() {
        // Prevent duplicate submissions
        if (this.isCreatingUser) {
            console.warn('User creation already in progress, ignoring duplicate request');
            return;
        }
        
        const formData = {
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            role: document.getElementById('userRole').value,
            slackName: document.getElementById('userSlackName').value,
            slackId: document.getElementById('userSlackId').value,
            status: document.getElementById('userStatus').value || 'Active',
            password: document.getElementById('userPassword').value
        };

        if (!formData.name || !formData.email || !formData.role || !formData.password) {
            this.showNotification('Please fill in all required fields.', 'error');
            return;
        }

        try {
            this.isCreatingUser = true;
            this.showLoading();
            const response = await api.createUser(formData);
            
            if (response.success) {
                window.taskManager.users.push(response.data);
                this.renderUsers();
                window.modalManager.closeModal('createUserModal');
                this.showNotification('User created successfully!', 'success');
                
                // Clear form
                document.getElementById('createUserForm').reset();
            } else {
                const message = response.error && response.error.includes('User_email_key')
                    ? 'A user with this email already exists'
                    : response.error || 'Failed to create user';
                this.showNotification(message, 'error');
            }
        } catch (error) {
            console.error('Error creating user:', error);
            const message = error.message && error.message.includes('User_email_key')
                ? 'A user with this email already exists'
                : 'Failed to create user';
            this.showNotification(message, 'error');
        } finally {
            this.isCreatingUser = false;
            this.hideLoading();
        }
    }

    async createSprint() {
        // Prevent duplicate submissions
        if (this.isCreatingSprint) {
            console.warn('Sprint creation already in progress, ignoring duplicate request');
            return;
        }
        
        const form = document.getElementById('createSprintForm');
        if (!form) {
            console.warn('createSprintForm not found');
            return;
        }

        const formData = {
            name: document.getElementById('sprintName')?.value?.trim(),
            startDate: document.getElementById('sprintStartDate')?.value || null,
            endDate: document.getElementById('sprintEndDate')?.value || null,
            goal: document.getElementById('sprintGoal')?.value?.trim() || '',
            status: 'Planned'
        };

        if (!formData.name || !formData.startDate || !formData.endDate) {
            this.showNotification('Please complete all required sprint fields.', 'error');
            return;
        }

        try {
            this.isCreatingSprint = true;
            this.showLoading();
            const response = await api.createSprint(formData);
            if (response.success) {
                await window.taskManager.loadSprints();
                this.renderSprints();
                form.reset();
                if (window.modalManager) {
                    window.modalManager.closeModal('createSprintModal');
                }
                this.showNotification('Sprint created successfully!', 'success');
            } else {
                this.showNotification(response.error || 'Failed to create sprint', 'error');
            }
        } catch (error) {
            console.error('Error creating sprint:', error);
            const message = error.message.includes('already exists') ? 'Sprint name already exists' : 'Failed to create sprint';
            this.showNotification(message, 'error');
        } finally {
            this.isCreatingSprint = false;
            this.hideLoading();
        }
    }

    async createTaskApi(taskData) {
        if (!taskData.task || !taskData.priority || !taskData.type) {
            window.uiManager?.showNotification('Please fill in all required task fields.', 'error');
            return;
        }

        try {
            const response = await api.createTask(taskData);
            
            if (response.success) {
                await window.taskManager.loadTasks();
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(window.taskManager.tasks);
                    window.taskBoardManager.populateFilters();
                }
                this.showNotification('Task created successfully!', 'success');
            } else {
                this.showNotification(response.error || 'Failed to create task', 'error');
            }
        } catch (error) {
            console.error('Error creating task:', error);
            const message = error.message.includes('already exists') ? 'Task name already exists' : 'Failed to create task';
            this.showNotification(message, 'error');
        } finally {
            this.hideLoading();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} else if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
} 