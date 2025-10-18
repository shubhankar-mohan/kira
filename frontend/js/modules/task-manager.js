// Task Manager Module - Handles all task-related operations
class TaskManager {
    constructor() {
        this.tasks = [];
        this.users = [];
        this.sprints = [];
        this.currentTaskId = null;
        this.filters = {
            sprint: 'all',
            assignee: '',
            priority: '',
            type: ''
        };
        this.pagination = {
            page: 1,
            pageSize: 20,
            total: 0,
            hasNext: false,
            hasPrev: false
        };
        this.serverFilters = {
            status: [],
            priority: [],
            type: [],
            sprint: [],
            assignee: [],
            assignedBy: [],
            createdBy: '',
            tags: [],
            search: '',
            createdFrom: '',
            createdBefore: '',
            sort: '',
            dir: ''
        };
        this.bulkSelection = new Set();
    }

    async loadTasks(params = {}) {
        try {
            const query = this.buildTaskQueryPayload(params);
            const response = await api.getTasks(query);
            const items = response.data || [];

            this.tasks = items;
            this.updatePagination({
                page: response.page,
                pageSize: response.pageSize,
                total: response.total,
                hasNext: response.hasNext
            });

            this.serverFilters = this.normalizeServerFilters({ ...this.serverFilters, ...params });

            if (window.taskBoardManager && typeof window.taskBoardManager.onTasksLoaded === 'function') {
                window.taskBoardManager.onTasksLoaded(this.tasks, this.pagination);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.tasks = [];
            this.updatePagination({ total: 0, hasNext: false, hasPrev: false, page: 1 });
        }
    }

    async loadUsers() {
        try {
            console.log('🔄 Loading users from API...');
            console.log('API base URL:', api.baseURL);
            console.log('Full URL:', `${window.location.origin}${api.baseURL}/users`);
            
            const response = await api.getUsers();
            console.log('API Response:', response);
            console.log('Response structure:', Object.keys(response));
            console.log('Response.data:', response.data);
            console.log('Response.success:', response.success);
            this.users = response.data || [];
            console.log('✅ Users loaded:', this.users.length);
        } catch (error) {
            console.error('❌ Error loading users:', error);
            console.error('Error details:', error.message);
            this.users = [];
        }
    }

    async loadSprints() {
        try {
            console.log('🔄 Loading sprints from API...');
            console.log('API base URL:', api.baseURL);
            console.log('Full URL:', `${window.location.origin}${api.baseURL}/sprints`);
            
            const response = await api.getSprints();
            console.log('API Response:', response);
            console.log('Response structure:', Object.keys(response));
            console.log('Response.data:', response.data);
            console.log('Response.success:', response.success);
            this.sprints = response.data || [];
            console.log('✅ Sprints loaded:', this.sprints.length);
            console.log('🔍 Sprints array after loading:', this.sprints);
        } catch (error) {
            console.error('❌ Error loading sprints:', error);
            console.error('Error details:', error.message);
            this.sprints = [];
        }
    }

    async loadInitialData() {
        console.log('Loading initial data...');
        
        try {
            console.log('Loading tasks, users, and sprints...');
            await Promise.all([
                this.loadTasks(),
                this.loadUsers(),
                this.loadSprints()
            ]);
            
            console.log('Data loaded successfully. Tasks:', this.tasks.length, 'Users:', this.users.length, 'Sprints:', this.sprints.length);
            
            console.log('Updating dashboard...');
            this.updateDashboard();
            
            console.log('Creating task board...');
            if (window.taskBoardManager) {
                window.taskBoardManager.createTaskBoard();
                window.taskBoardManager.renderTasks(this.tasks);
                window.taskBoardManager.populateFilters();
            }
            
            console.log('Populating filters...');
            this.populateFilters();
            
            // Initialize modal manager dropdowns after data is loaded
            console.log('Initializing modal manager dropdowns...');
            if (window.modalManager) {
                window.modalManager.refreshCreateTaskDropdowns();
            }
            
            // Initialize filter display text
            if (typeof updateFilterDisplayText === 'function') {
                updateFilterDisplayText();
            }
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('Failed to load data. Please refresh the page.', 'error');
            }
        }
    }

    async loadPageContent(page) {
        switch (page) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'board':
                if (window.taskBoardManager) {
                    this.clearBulkSelection();
                    await this.loadTasks();
                    window.taskBoardManager.renderTasks(this.tasks);
                    window.taskBoardManager.populateFilters();
                }
                break;
            case 'sprints':
                console.log('📊 Loading sprints page...');
                // Refresh sprint data before rendering
                await this.loadSprints();
                console.log('🔄 After loadSprints, this.sprints:', this.sprints.length);
                if (window.uiManager) {
                    console.log('🎨 Rendering sprints UI...');
                    window.uiManager.renderSprints();
                }
                break;
            case 'users':
                console.log('👥 Loading users page...');
                // Refresh user data before rendering
                await this.loadUsers();
                if (window.uiManager) {
                    console.log('🎨 Rendering users UI...');
                    window.uiManager.renderUsers();
                }
                break;
            case 'task-detail':
                if (window.router && window.router.currentTaskId) {
                    if (window.app) {
                        window.app.showTaskDetailPage(window.router.currentTaskId);
                    }
                }
                break;
        }
    }

    async createTaskApi(taskData) {
        try {
            const response = await api.createTask(taskData);
            if (response.success) {
                await this.loadTasks({ page: 1 });
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(this.tasks);
                    window.taskBoardManager.populateFilters();
                }
                if (window.modalManager) {
                    window.modalManager.closeModal('createTaskModal', { force: true });
                }
                return { success: true };
            }
            return { success: false, error: response.error || 'Failed to create task.' };
        } catch (error) {
            console.error('Error creating task:', error);
            return { success: false, error };
        }
    }

    async updateTask(taskId, updates) {
        try {
            const response = await api.updateTask(taskId, updates);
            if (response.success) {
                // Update local task
                const taskIndex = this.tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
                }
                
                // Re-render board
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(this.tasks);
                    window.taskBoardManager.populateFilters();
                }
                
                if (window.uiManager) {
                    window.uiManager.showNotification('Task updated successfully!', 'success');
                }
            }
        } catch (error) {
            console.error('Error updating task:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('Failed to update task.', 'error');
            }
        }
    }

    async updateTaskStatus(taskId, newStatus) {
        try {
            const response = await api.updateTask(taskId, { status: newStatus });
            if (response.success) {
                // Update local task
                const task = this.tasks.find(t => t.id === taskId);
                if (task) {
                    task.status = newStatus;
                }
                
                // Re-render board
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(this.tasks);
                    window.taskBoardManager.populateFilters();
                }
                
                if (window.uiManager) {
                    window.uiManager.showNotification('Task status updated successfully!', 'success');
                }
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('Failed to update task status.', 'error');
            }
        }
    }

    updateDashboard() {
        console.log('🏠 Updating dashboard with current sprint focus...');
        console.log('📊 Available data - Tasks:', this.tasks?.length || 0, 'Users:', this.users?.length || 0, 'Sprints:', this.sprints?.length || 0);
        
        // Check if data is available
        if (!this.tasks || !this.users || !this.sprints) {
            console.warn('⚠️ Dashboard update called but data not fully loaded yet');
            console.log('Available data:', {
                tasks: !!this.tasks && this.tasks.length,
                users: !!this.users && this.users.length,
                sprints: !!this.sprints && this.sprints.length
            });
        }
        
        // Find current sprint(s)
        const currentSprints = (this.sprints || []).filter(s => s.isCurrent || s.status === 'Active');
        const currentSprintWeeks = currentSprints.map(s => s.week || s.sprintWeek);
        
        console.log('📊 Current sprints:', currentSprintWeeks);
        
        // Filter tasks to current sprint only
        const currentSprintTasks = (this.tasks || []).filter(task => {
            const taskSprint = task.sprintWeek || task.sprint;
            return currentSprintWeeks.includes(taskSprint);
        });
        
        console.log('📋 Current sprint tasks:', currentSprintTasks.length);
        
        // Update current sprint overview
        this.updateCurrentSprintOverview(currentSprints, currentSprintTasks);
        
        // Update engineer performance table
        this.updateEngineerPerformanceTable(currentSprintTasks);
        
        // Update current sprint stats
        this.updateCurrentSprintStats(currentSprintTasks);
    }
    
    updateCurrentSprintOverview(currentSprints, currentSprintTasks) {
        const sprintName = currentSprints.length > 0 ? 
            currentSprints.map(s => s.name || s.week).join(', ') : 
            'No active sprint';
        const totalTasks = currentSprintTasks.length;
        const completedTasks = currentSprintTasks.filter(t => t.status === 'Done').length;
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const sprintGoal = currentSprints.length > 0 ? 
            (currentSprints[0].goal || 'No goal set') : 
            'No goal set';
        
        // Update overview elements
        const nameElement = document.getElementById('currentSprintName');
        const progressElement = document.getElementById('currentSprintProgress');
        const goalElement = document.getElementById('currentSprintGoal');
        const statusElement = document.getElementById('currentSprintStatus');
        
        if (nameElement) nameElement.textContent = sprintName;
        if (progressElement) progressElement.textContent = `${completedTasks}/${totalTasks} (${progressPercentage}%)`;
        if (goalElement) goalElement.textContent = sprintGoal;
        if (statusElement) {
            const status = progressPercentage >= 80 ? 'Ahead of schedule' : 
                          progressPercentage >= 60 ? 'On track' : 
                          progressPercentage >= 40 ? 'Slightly behind' : 'Behind schedule';
            statusElement.textContent = status;
        }
    }
    
    updateEngineerPerformanceTable(currentSprintTasks) {
        const tableBody = document.getElementById('engineerPerformanceTable');
        if (!tableBody) return;
        
        console.log('🎯 Updating team performance table');
        console.log('📋 Current sprint tasks:', currentSprintTasks.length);
        console.log('👥 Available users:', this.users.length);
        
        // Calculate stats per engineer
        const engineerStats = {};
        
        // Get all unique assignees from current sprint tasks
        const allAssignees = new Set();
        currentSprintTasks.forEach(task => {
            const assignedTo = task.assignedTo || '';
            if (assignedTo) {
                // Split by common delimiters and clean up
                const assignees = assignedTo.split(/[,;|]/)
                    .map(name => name.trim())
                    .filter(name => name && name !== 'Unassigned' && name !== '');
                assignees.forEach(assignee => allAssignees.add(assignee));
            }
        });
        
        console.log('📧 All assignees in current sprint:', Array.from(allAssignees));
        
        // Process each user
        this.users.forEach(user => {
            const userTasks = currentSprintTasks.filter(task => {
                const assignedTo = task.assignedTo || '';
                // Check both email and name matching
                return assignedTo.includes(user.email) || 
                       assignedTo.includes(user.name) ||
                       (user.name && assignedTo.toLowerCase().includes(user.name.toLowerCase()));
            });
            
            const allocated = userTasks.length;
            const completed = userTasks.filter(t => t.status === 'Done').length;
            const inProgress = userTasks.filter(t => t.status === 'In progress').length;
            const percentage = allocated > 0 ? Math.round((completed / allocated) * 100) : 0;
            
            if (allocated > 0) { // Only show engineers with tasks
                engineerStats[user.email] = {
                    name: user.name,
                    allocated,
                    completed,
                    inProgress,
                    percentage
                };
                console.log(`👤 ${user.name}: ${allocated} tasks (${completed} done, ${inProgress} in progress)`);
            }
        });
        
        // Also check for assignees that might not be in the users list
        allAssignees.forEach(assigneeName => {
            // Skip if already processed as a user
            const isExistingUser = this.users.some(user => 
                user.email === assigneeName || 
                user.name === assigneeName ||
                (user.name && assigneeName.toLowerCase().includes(user.name.toLowerCase()))
            );
            
            if (!isExistingUser) {
                const userTasks = currentSprintTasks.filter(task => {
                    const assignedTo = task.assignedTo || '';
                    return assignedTo.includes(assigneeName);
                });
                
                const allocated = userTasks.length;
                const completed = userTasks.filter(t => t.status === 'Done').length;
                const inProgress = userTasks.filter(t => t.status === 'In progress').length;
                const percentage = allocated > 0 ? Math.round((completed / allocated) * 100) : 0;
                
                if (allocated > 0) {
                    engineerStats[assigneeName] = {
                        name: assigneeName,
                        allocated,
                        completed,
                        inProgress,
                        percentage
                    };
                    console.log(`👤 ${assigneeName} (not in users list): ${allocated} tasks (${completed} done, ${inProgress} in progress)`);
                }
            }
        });
        
        console.log('📊 Total engineers with tasks:', Object.keys(engineerStats).length);
        
        // Render engineer performance rows
        const engineerRows = Object.values(engineerStats).map(stats => {
            const percentageClass = stats.percentage >= 70 ? 'good' : 
                                  stats.percentage >= 50 ? 'average' : 'poor';
            
            return `
                <div class="engineer-row">
                    <div class="engineer-name">${stats.name}</div>
                    <div class="engineer-stat">${stats.allocated}</div>
                    <div class="engineer-stat">${stats.completed}</div>
                    <div class="engineer-stat">${stats.inProgress}</div>
                    <div class="engineer-percentage ${percentageClass}">${stats.percentage}%</div>
                </div>
            `;
        }).join('');
        
        tableBody.innerHTML = engineerRows || '<div class="engineer-row"><div class="engineer-name">No tasks assigned in current sprint</div><div class="engineer-stat">0</div><div class="engineer-stat">0</div><div class="engineer-stat">0</div><div class="engineer-percentage">0%</div></div>';
    }
    
    updateCurrentSprintStats(currentSprintTasks) {
        const totalTasks = currentSprintTasks.length;
        const inProgressTasks = currentSprintTasks.filter(t => t.status === 'In progress').length;
        const completedTasks = currentSprintTasks.filter(t => t.status === 'Done').length;
        const blockedTasks = currentSprintTasks.filter(t => t.status && t.status.includes('Blocked')).length;
        
        const totalElement = document.getElementById('currentSprintTotalTasks');
        const inProgressElement = document.getElementById('currentSprintInProgress');
        const completedElement = document.getElementById('currentSprintCompleted');
        const blockedElement = document.getElementById('currentSprintBlocked');
        
        if (totalElement) totalElement.textContent = totalTasks;
        if (inProgressElement) inProgressElement.textContent = inProgressTasks;
        if (completedElement) completedElement.textContent = completedTasks;
        if (blockedElement) blockedElement.textContent = blockedTasks;
    }

    populateFilters() {
        // Populate assignee filter
        const assigneeSelect = document.getElementById('taskAssignee');
        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="">Unassigned</option>';
            this.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = user.name;
                assigneeSelect.appendChild(option);
            });
        }

        // Populate sprint filter with current sprints at top
        const sprintSelect = document.getElementById('taskSprint');
        if (sprintSelect) {
            sprintSelect.innerHTML = '<option value="">Backlog</option>';
            
            // Separate current and non-current sprints
            const currentSprints = this.sprints.filter(sprint => sprint.isCurrent);
            const otherSprints = this.sprints.filter(sprint => !sprint.isCurrent);
            
            // Sort other sprints by week number (descending, so newest non-current sprints appear first)
            otherSprints.sort((a, b) => {
                const getWeekNumber = (sprint) => {
                    const sprintWeek = sprint.name || sprint.sprintWeek || sprint.week || '';
                    const match = sprintWeek.match(/W?(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                };
                return getWeekNumber(b) - getWeekNumber(a);
            });
            
            // Add current sprints first (at top)
            currentSprints.forEach(sprint => {
                const option = document.createElement('option');
                option.value = sprint.sprintWeek || sprint.name;
                option.textContent = `🎯 ${sprint.sprintWeek || sprint.name} (Current)`;
                sprintSelect.appendChild(option);
            });
            
            // Add separator if there are current sprints
            if (currentSprints.length > 0 && otherSprints.length > 0) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '─────────────';
                sprintSelect.appendChild(separator);
            }
            
            // Add all other sprints (including past sprints)
            otherSprints.forEach(sprint => {
                const option = document.createElement('option');
                option.value = sprint.sprintWeek || sprint.name;
                option.textContent = sprint.sprintWeek || sprint.name;
                sprintSelect.appendChild(option);
            });
        }
    }

    async showCreateTaskModal() {
        try {
            console.log('🎯 Opening create task modal...');

            // Ensure users and sprints are loaded before opening modal
            if (!this.users || this.users.length === 0) {
                console.log('Loading users before opening create task modal...');
                await this.loadUsers();
            }
            if (!this.sprints || this.sprints.length === 0) {
                console.log('Loading sprints before opening create task modal...');
                await this.loadSprints();
            }

            console.log('✅ Data loaded, opening modal. Users:', this.users?.length || 0, 'Sprints:', this.sprints?.length || 0);

            if (window.modalManager) {
                window.modalManager.showModal('createTaskModal');
                // Hydrate fields with safe defaults to avoid empty modal feel
                const title = document.getElementById('taskTitle');
                const priority = document.getElementById('taskPriority');
                const type = document.getElementById('taskType');
                const sprint = document.getElementById('taskSprint');
                if (title && !title.value) title.value = '';
                if (priority && !priority.value) priority.value = 'P2';
            if (type && !type.value) type.value = 'Feature';
            if (sprint && sprint.options.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No Sprint';
                sprint.appendChild(opt);
            }

                console.log('🎉 Create task modal opened successfully');
            } else {
                console.error('❌ ModalManager not available');
                this.showNotification('Modal system not available', 'error');
            }
        } catch (error) {
            console.error('❌ Error opening create task modal:', error);
            this.showNotification('Failed to open create task modal', 'error');
        }
    }

    async openTaskDetails(taskId) {
        if (window.modalManager) {
            await window.modalManager.openTaskDetails(taskId);
        }
    }

    async saveTaskDetails() {
        if (window.modalManager) {
            return await window.modalManager.saveTaskDetails();
        }
    }

    async createTask() {
        const formData = {
            task: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            assignedTo: document.getElementById('taskAssignee').value,
            priority: document.getElementById('taskPriority').value,
            type: document.getElementById('taskType').value,
            sprintWeek: document.getElementById('taskSprint').value,
            status: 'Not started', // Ensure default status is "Not started"
            createdBy: window.authManager?.currentUser?.email || window.authManager?.currentUser?.name || 'Dashboard User'
        };

        this.showLoading();
        try {
            const result = await this.createTaskApi(formData);
            return result;
        } finally {
            this.hideLoading();
        }
    }

    async createSprint() {
        // Implementation for creating sprints
        console.log('Creating sprint...');
    }

    showNotification(message, type) {
        if (window.uiManager) {
            window.uiManager.showNotification(message, type);
        }
    }

    showLoading() {
        if (window.uiManager) {
            window.uiManager.showLoading();
        }
    }

    hideLoading() {
        if (window.uiManager) {
            window.uiManager.hideLoading();
        }
    }

    closeModal(modalId) {
        if (window.modalManager) {
            window.modalManager.closeModal(modalId);
        }
    }

    async sendSlackTaskUpdate(taskId, taskData) {
        try {
            const currentUser = window.authManager?.currentUser?.name || 'Unknown User';
            const originalTask = this.tasks.find((t) => t.id === taskId);
            const changes = {};

            if (originalTask) {
                if (taskData.status !== undefined && taskData.status !== originalTask.status) {
                    changes.status = taskData.status;
                }
                if (taskData.priority !== undefined && taskData.priority !== originalTask.priority) {
                    changes.priority = taskData.priority;
                }
                if (taskData.assignedTo !== undefined && taskData.assignedTo !== originalTask.assignedTo) {
                    changes.assignedTo = taskData.assignedTo;
                }
                if (taskData.description !== undefined && taskData.description !== originalTask.description) {
                    changes.description = true;
                }
                if (taskData.sprintWeek !== undefined && taskData.sprintWeek !== originalTask.sprintWeek) {
                    changes.sprintWeek = taskData.sprintWeek;
                }
                if (taskData.statusReason !== undefined && taskData.statusReason !== originalTask.statusReason) {
                    changes.statusReason = taskData.statusReason;
                }
            }

            if (Object.keys(changes).length === 0) {
                return { success: true, skipped: true };
            }

            const threadTs = originalTask?.slackThread?.threadTs || originalTask?.slackThreadId;
            const channelId = originalTask?.slackThread?.channelId || originalTask?.slackChannelId;

            const response = await api.sendTaskUpdateNotification(
                taskId,
                taskData.task || originalTask?.task || 'Task Updated',
                currentUser,
                changes,
                threadTs,
                channelId
            );

            if (response?.success && response.data) {
                const updatedTask = this.tasks.find((t) => t.id === taskId);
                if (updatedTask) {
                    updatedTask.slackThreadId = response.data.threadTs || threadTs || updatedTask.slackThreadId;
                    updatedTask.slackChannelId = response.data.channelId || channelId || updatedTask.slackChannelId;
                    updatedTask.slackThread = updatedTask.slackThread || {};
                    updatedTask.slackThread.threadTs = updatedTask.slackThread.threadTs || updatedTask.slackThreadId;
                    updatedTask.slackThread.channelId = updatedTask.slackThread.channelId || updatedTask.slackChannelId;
                }
            }

            return response;
        } catch (error) {
            console.error('Failed to send Slack task update notification:', error);
            return { success: false, error: error.message };
        }
    }

    buildTaskQueryPayload(overrides = {}) {
        const {
            page = this.pagination.page,
            pageSize = this.pagination.pageSize,
            status,
            priority,
            type,
            sprint,
            assignee,
            assignedBy,
            createdBy,
            tags,
            search,
            createdFrom,
            createdBefore,
            sort,
            dir
        } = { ...this.serverFilters, ...overrides };

        const payload = {
            page,
            pageSize,
            search,
            createdFrom,
            createdBefore,
            sort,
            dir,
            status,
            priority,
            type,
            sprint,
            assignee,
            assignedBy,
            createdBy,
            tags
        };

        // Map assignedBy -> createdBy when we have an email (backend expects createdBy)
        if (!payload.createdBy && payload.assignedBy) {
            if (Array.isArray(payload.assignedBy)) {
                const emailCandidate = payload.assignedBy.find((value) => typeof value === 'string' && value.includes('@'));
                if (emailCandidate) payload.createdBy = emailCandidate;
            } else if (typeof payload.assignedBy === 'string' && payload.assignedBy.includes('@')) {
                payload.createdBy = payload.assignedBy;
            }
        }
        // Remove assignedBy from payload as backend doesn't support it directly
        delete payload.assignedBy;

        Object.keys(payload).forEach((key) => {
            const value = payload[key];
            if (Array.isArray(value)) {
                const cleaned = value.filter((entry) => entry !== undefined && entry !== null && entry !== '' && entry !== 'all');
                if (cleaned.length === 0) {
                    delete payload[key];
                } else {
                    payload[key] = cleaned;
                }
            } else if (value === undefined || value === null || value === '' || value === 'all') {
                delete payload[key];
            }
        });

        return payload;
    }

    normalizeServerFilters(filters = {}) {
        const normalized = { ...this.serverFilters, ...filters };
        Object.keys(normalized).forEach((key) => {
            const value = normalized[key];
            if (Array.isArray(value)) {
                normalized[key] = value.filter((entry) => entry !== undefined && entry !== null && entry !== '' && entry !== 'all');
            } else if (value === undefined || value === null) {
                normalized[key] = '';
            }
        });
        return normalized;
    }

    updatePagination(meta = {}) {
        const page = Number(meta.page || this.pagination.page || 1);
        const pageSize = Number(meta.pageSize || this.pagination.pageSize || 20);
        const total = Number(meta.total || this.pagination.total || 0);
        const hasNext = Boolean(meta.hasNext);
        const hasPrev = Boolean(meta.hasPrev || page > 1);

        this.pagination = {
            page,
            pageSize,
            total,
            hasNext,
            hasPrev
        };
    }

    clearBulkSelection() {
        this.bulkSelection.clear();
        if (window.taskBoardManager && typeof window.taskBoardManager.updateBulkSelectionState === 'function') {
            window.taskBoardManager.updateBulkSelectionState([]);
        }
    }

    async updateFiltersAndReload(updates = {}, options = {}) {
        this.serverFilters = this.normalizeServerFilters({ ...this.serverFilters, ...updates });

        if (options.resetPage) {
            this.pagination.page = 1;
        }

        const queryOverrides = {
            page: this.pagination.page,
            pageSize: this.pagination.pageSize,
            ...updates
        };

        await this.loadTasks(queryOverrides);
    }

    async goToNextPage() {
        if (!this.pagination.hasNext) return;
        const nextPage = this.pagination.page + 1;
        await this.loadTasks({ page: nextPage });
    }

    async goToPrevPage() {
        if (!this.pagination.hasPrev) return;
        const prevPage = Math.max(1, this.pagination.page - 1);
        await this.loadTasks({ page: prevPage });
    }

    async changePageSize(newSize) {
        const size = Number(newSize);
        if (!size || size === this.pagination.pageSize) return;
        this.pagination.pageSize = size;
        this.pagination.page = 1;
        await this.loadTasks({ page: 1, pageSize: size });
    }

    async bulkUpdateStatus(taskIds, status) {
        if (!Array.isArray(taskIds) || taskIds.length === 0) return;
        try {
            await api.bulkUpdateStatus(taskIds, status, window.authManager?.currentUser?.email || '');
            await this.loadTasks();
            if (window.uiManager) {
                window.uiManager.showNotification('Status updated for selected tasks', 'success');
            }
        } catch (error) {
            console.error('Error updating task status in bulk:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('Bulk status update failed', 'error');
            }
        }
    }

    async bulkAssignTasks(taskIds, userEmail, assignedByEmail) {
        if (!Array.isArray(taskIds) || taskIds.length === 0 || !userEmail) return;
        try {
            await api.bulkAssignTasks(taskIds, userEmail, assignedByEmail);
            await this.loadTasks();
            if (window.uiManager) {
                window.uiManager.showNotification('Assignee updated for selected tasks', 'success');
            }
        } catch (error) {
            console.error('Error assigning tasks in bulk:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('Bulk assign failed', 'error');
            }
        }
    }

    async bulkDeleteTasks(taskIds) {
        if (!Array.isArray(taskIds) || taskIds.length === 0) return;
        try {
            await api.bulkDeleteTasks(taskIds);
            await this.loadTasks();
            if (window.uiManager) {
                window.uiManager.showNotification('Selected tasks deleted', 'success');
            }
        } catch (error) {
            console.error('Error deleting tasks in bulk:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('Bulk delete failed', 'error');
            }
        }
    }

    async refreshTaskDetail(taskId) {
        try {
            const response = await api.getTask(taskId);
            if (response && response.data) {
                const index = this.tasks.findIndex((task) => task.id === response.data.id);
                if (index !== -1) {
                    this.tasks[index] = response.data;
                } else {
                    this.tasks.unshift(response.data);
                }
                return response.data;
            }
        } catch (error) {
            console.error('Failed to refresh task detail:', error);
        }
        return null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskManager;
} else if (typeof window !== 'undefined') {
    window.TaskManager = TaskManager;
} 