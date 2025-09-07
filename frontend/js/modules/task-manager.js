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
    }

    async loadTasks() {
        try {
            const response = await api.getTasks();
            this.tasks = response.data || [];
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.tasks = [];
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

    async createTask(taskData) {
        try {
            const response = await api.createTask(taskData);
            if (response.success) {
                this.tasks.push(response.data);
                this.updateDashboard();
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(this.tasks);
                    window.taskBoardManager.populateFilters();
                }
                if (window.modalManager) {
                    window.modalManager.closeModal('createTaskModal');
                }
                if (window.uiManager) {
                    window.uiManager.showNotification('Task created successfully!', 'success');
                }
            }
        } catch (error) {
            console.error('Error creating task:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('Failed to create task.', 'error');
            }
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
        
        // Find current sprint(s)
        const currentSprints = this.sprints.filter(s => s.isCurrent || s.status === 'Active');
        const currentSprintWeeks = currentSprints.map(s => s.week || s.sprintWeek);
        
        console.log('📊 Current sprints:', currentSprintWeeks);
        
        // Filter tasks to current sprint only
        const currentSprintTasks = this.tasks.filter(task => {
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

    showCreateTaskModal() {
        if (window.modalManager) {
            window.modalManager.showModal('createTaskModal');
        }
    }

    openTaskDetails(taskId) {
        if (window.modalManager) {
            window.modalManager.openTaskDetails(taskId);
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
            status: 'Not started' // Ensure default status is "Not started"
        };

        await this.createTask(formData);
    }

    async createSprint() {
        // Implementation for creating sprints
        console.log('Creating sprint...');
    }

    async createUser() {
        // Implementation for creating users
        console.log('Creating user...');
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
        // Mock Slack notification - in real app, this would send to Slack
        console.log('Slack notification for task update:', taskId, taskData);
        return Promise.resolve({ success: true });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskManager;
} else if (typeof window !== 'undefined') {
    window.TaskManager = TaskManager;
} 