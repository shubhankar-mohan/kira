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

    loadPageContent(page) {
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
                if (window.uiManager) {
                    window.uiManager.renderSprints();
                }
                break;
            case 'users':
                if (window.uiManager) {
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
        console.log('Updating dashboard...');
        
        const totalTasks = this.tasks.length;
        const inProgressTasks = this.tasks.filter(t => t.status === 'In progress').length;
        const completedTasks = this.tasks.filter(t => t.status === 'Done').length;
        const blockedTasks = this.tasks.filter(t => t.status && t.status.includes('Blocked')).length;
        
        const totalTasksElement = document.getElementById('totalTasks');
        const inProgressTasksElement = document.getElementById('inProgressTasks');
        const completedTasksElement = document.getElementById('completedTasks');
        const blockedTasksElement = document.getElementById('blockedTasks');
        
        if (totalTasksElement) totalTasksElement.textContent = totalTasks;
        if (inProgressTasksElement) inProgressTasksElement.textContent = inProgressTasks;
        if (completedTasksElement) completedTasksElement.textContent = completedTasks;
        if (blockedTasksElement) blockedTasksElement.textContent = blockedTasks;
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

        // Populate sprint filter
        const sprintSelect = document.getElementById('taskSprint');
        if (sprintSelect) {
            sprintSelect.innerHTML = '<option value="">Backlog</option>';
            this.sprints.forEach(sprint => {
                const option = document.createElement('option');
                option.value = sprint.sprintWeek;
                option.textContent = sprint.sprintWeek;
                sprintSelect.appendChild(option);
            });
        }
    }

    showCreateTaskModal() {
        if (window.modalManager) {
            window.modalManager.showModal('createTaskModal');
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskManager;
} 