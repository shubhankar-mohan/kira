// KiranaClub Task Manager - Main Application
class TaskManager {
    constructor() {
        console.log('🚀 TaskManager v4.0 - Multi-Page Router Version');
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.currentTaskId = null;
        this.tasks = [];
        this.users = [];
        this.sprints = [];
        this.filters = {
            sprint: 'all',
            assignee: '',
            priority: '',
            type: ''
        };
        
        this.init();
    }

    async init() {
        console.log('TaskManager initializing...');
        this.setupEventListeners();
        this.setupRouter();
        await this.checkAuth();
        
        // Handle pending task navigation after auth check
        if (this.pendingTaskNavigation && this.currentTaskId) {
            this.pendingTaskNavigation = false;
            this.showTaskDetailPage(this.currentTaskId);
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Login form
        const passwordField = document.getElementById('password');
        if (passwordField) {
            passwordField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.login();
                }
            });
        }

        // Modal close events
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Form submissions
        this.setupFormSubmissions();
    }

    setupRouter() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.navigateToPage(e.state.page, false);
            }
        });

        // Check for initial URL
        const path = window.location.pathname;
        const page = this.getPageFromPath(path);
        if (page && page !== 'dashboard') {
            this.currentPage = page;
            
            // If it's a task detail page, we'll handle navigation after auth check
            if (page === 'task-detail') {
                this.pendingTaskNavigation = true;
            }
        }
    }

    getPageFromPath(path) {
        const routes = {
            '/': 'dashboard',
            '/dashboard': 'dashboard',
            '/board': 'board',
            '/sprints': 'sprints',
            '/users': 'users',
            '/team': 'users'
        };
        
        // Handle task detail pages
        if (path.startsWith('/task/')) {
            const taskId = path.split('/')[2];
            if (taskId) {
                this.currentTaskId = taskId;
                return 'task-detail';
            }
        }
        
        return routes[path] || 'dashboard';
    }

    getPathFromPage(page) {
        const paths = {
            'dashboard': '/dashboard',
            'board': '/board',
            'sprints': '/sprints',
            'users': '/users'
        };
        
        if (page === 'task-detail' && this.currentTaskId) {
            return `/task/${this.currentTaskId}`;
        }
        
        return paths[page] || '/dashboard';
    }

    setupFormSubmissions() {
        // Create sprint form
        const createSprintForm = document.getElementById('createSprintForm');
        if (createSprintForm) {
            createSprintForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createSprint();
            });
        }

        // Create user form
        const createUserForm = document.getElementById('createUserForm');
        if (createUserForm) {
            createUserForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createUser();
            });
        }
    }

    async checkAuth() {
        console.log('Checking authentication...');
        const token = localStorage.getItem('authToken');
        
        if (token) {
            try {
                const response = await api.verifyToken();
                if (response.success) {
                    this.currentUser = response.data.user;
                    this.showMainApp();
                    return;
                }
            } catch (error) {
                console.log('Token verification failed:', error);
            }
        }
        
        this.showLoginForm();
    }

    showLoginForm() {
        console.log('Showing login form...');
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    showMainApp() {
        console.log('Showing main app...');
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        // Update profile info
        const name = this.currentUser.name || this.currentUser.email;
        const email = this.currentUser.email;
        const role = this.currentUser.role;
        
        document.getElementById('profileName').textContent = name;
        document.getElementById('profileRole').textContent = role.toLowerCase();
        
        // Set avatar initial
        const avatarElement = document.getElementById('profileAvatar');
        avatarElement.textContent = name.charAt(0).toUpperCase();
        
        // Hide user management for non-admins
        if (this.currentUser.role !== 'Admin') {
            const userNav = document.getElementById('userManagementNav');
            if (userNav) userNav.style.display = 'none';
        }
        
        this.loadInitialData();
        this.navigateToPage(this.currentPage, false);
        
        // Handle task detail page after data is loaded
        if (this.currentPage === 'task-detail' && this.currentTaskId) {
            this.showTaskDetailPage(this.currentTaskId);
        }
    }

    async loadInitialData() {
        console.log('Loading initial data...');
        
        this.showLoading();
        
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
            
            // Handle pending task navigation
            if (this.pendingTaskNavigation && this.currentTaskId) {
                this.pendingTaskNavigation = false;
                this.navigateToPage('task-detail', false);
            }
            
            console.log('Populating filters...');
            this.populateFilters();
            
            // Initialize filter display text
            if (typeof updateFilterDisplayText === 'function') {
                updateFilterDisplayText();
            }
            
            // Handle task detail page after data is loaded
            if (this.currentPage === 'task-detail' && this.currentTaskId) {
                this.showTaskDetailPage(this.currentTaskId);
            }
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Failed to load data. Please refresh the page.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    navigateToPage(page, updateHistory = true) {
        console.log('Navigating to page:', page);
        
        // Handle special case for task detail page
        if (page === 'task-detail' && this.currentTaskId) {
            this.showTaskDetailPage(this.currentTaskId);
            return;
        }
        
        // Update current page
        this.currentPage = page;
        
        // Update URL if needed
        if (updateHistory) {
            const path = this.getPathFromPage(page);
            window.history.pushState({ page }, '', path);
        }
        
        // Update breadcrumb
        this.updateBreadcrumb(page);
        
        // Hide all page sections
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show the selected page
        const targetSection = document.getElementById(page + 'Section');
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }
        
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNav = document.querySelector(`[data-section="${page}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }
        
        // Load page-specific content
        this.loadPageContent(page);
    }

    updateBreadcrumb(page) {
        const breadcrumbMap = {
            'dashboard': 'Dashboard',
            'board': 'Task Board',
            'sprints': 'Sprints',
            'users': 'Team',
            'task-detail': `Task ${this.currentTaskId || ''}`
        };
        
        const breadcrumbElement = document.getElementById('breadcrumbPath');
        if (breadcrumbElement) {
            if (typeof page === 'string' && page.startsWith('Task ')) {
                breadcrumbElement.textContent = page;
            } else {
                breadcrumbElement.textContent = breadcrumbMap[page] || 'Dashboard';
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
                this.renderSprints();
                break;
            case 'users':
                this.renderUsers();
                break;
            case 'task-detail':
                if (this.currentTaskId) {
                    this.showTaskDetailPage(this.currentTaskId);
                }
                break;
        }
    }

    async login() {
        console.log('Login function called');
        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        console.log('Login attempt:', email);
        
        if (!email || !password) {
            this.showNotification('Please enter both email and password.', 'error');
            return;
        }

        this.showLoginLoading();
        
        try {
            const response = await api.login(email, password);
            
            if (response.success) {
                this.currentUser = response.data.user;
                this.showLoginSuccess('Login successful! Redirecting...');
                
                setTimeout(() => {
                    this.showMainApp();
                }, 1000);
            } else {
                this.showLoginError(response.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showLoginError('Login failed. Please check your credentials.');
        } finally {
            this.hideLoginLoading();
        }
    }

    logout() {
        console.log('Logout called');
        api.logout();
        localStorage.removeItem('authToken');
        this.currentUser = null;
        this.showLoginForm();
        
        // Reset form
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        
        this.showNotification('Logged out successfully.', 'success');
    }

    async syncData() {
        console.log('Syncing data...');
        this.showNotification('Syncing with Google Sheets...', 'info');
        
        try {
            await this.loadTasks();
            await this.loadUsers();
            await this.loadSprints();
            
            this.updateDashboard();
            if (window.taskBoardManager) {
                window.taskBoardManager.renderTasks(this.tasks);
                window.taskBoardManager.populateFilters();
            }
            
            this.showNotification('Data synced successfully!', 'success');
        } catch (error) {
            console.error('Sync error:', error);
            this.showNotification('Sync failed. Please try again.', 'error');
        }
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

    // Removed showSection and refreshCurrentSection - replaced with navigateToPage

    updateDashboard() {
        console.log('Updating dashboard...');
        
        const totalTasks = this.tasks.length;
        const inProgressTasks = this.tasks.filter(t => t.status === 'In progress').length;
        const completedTasks = this.tasks.filter(t => t.status === 'Done').length;
        const blockedTasks = this.tasks.filter(t => t.status && t.status.includes('Blocked')).length;
        
        document.getElementById('totalTasks').textContent = totalTasks;
        document.getElementById('inProgressTasks').textContent = inProgressTasks;
        document.getElementById('completedTasks').textContent = completedTasks;
        document.getElementById('blockedTasks').textContent = blockedTasks;
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
                
                this.showNotification('Task status updated successfully!', 'success');
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showNotification('Failed to update task status.', 'error');
        }
    }

    showCreateTaskModal() {
        const modal = document.getElementById('createTaskModal');
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
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

        try {
            const response = await api.createTask(formData);
            if (response.success) {
                this.tasks.push(response.data);
                this.updateDashboard();
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(this.tasks);
                    window.taskBoardManager.populateFilters();
                }
                this.closeModal('createTaskModal');
                this.showNotification('Task created successfully!', 'success');
            }
        } catch (error) {
            console.error('Error creating task:', error);
            this.showNotification('Failed to create task.', 'error');
        }
    }

    showCreateSprintModal() {
        const modal = document.getElementById('createSprintModal');
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
            
            // Setup dynamic sprint statistics
            this.setupSprintModalDynamics();
        }
    }

    setupSprintModalDynamics() {
        // Update team members count
        const teamMembersElement = document.getElementById('teamMembers');
        if (teamMembersElement) {
            teamMembersElement.textContent = this.users.length || 0;
        }

        // Update available tasks count (unassigned to sprints)
        const availableTasksElement = document.getElementById('availableTasks');
        if (availableTasksElement) {
            const unassignedTasks = this.tasks.filter(task => !task.sprintWeek || task.sprintWeek === '').length;
            availableTasksElement.textContent = unassignedTasks || 0;
        }

        // Setup date change listeners for duration calculation
        const startDateInput = document.getElementById('sprintStartDate');
        const endDateInput = document.getElementById('sprintEndDate');
        const durationElement = document.getElementById('sprintDuration');

        const updateDuration = () => {
            if (startDateInput.value && endDateInput.value && durationElement) {
                const startDate = new Date(startDateInput.value);
                const endDate = new Date(endDateInput.value);
                const diffTime = Math.abs(endDate - startDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 1) {
                    durationElement.textContent = '1 day';
                } else if (diffDays <= 7) {
                    durationElement.textContent = `${diffDays} days`;
                } else {
                    const weeks = Math.floor(diffDays / 7);
                    const remainingDays = diffDays % 7;
                    if (remainingDays === 0) {
                        durationElement.textContent = weeks === 1 ? '1 week' : `${weeks} weeks`;
                    } else {
                        durationElement.textContent = `${weeks}w ${remainingDays}d`;
                    }
                }
            } else if (durationElement) {
                durationElement.textContent = 'Select dates';
            }
        };

        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', updateDuration);
            endDateInput.addEventListener('change', updateDuration);
        }

        // Set default dates (2 weeks from today)
        if (startDateInput && endDateInput) {
            const today = new Date();
            const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
            
            startDateInput.value = today.toISOString().split('T')[0];
            endDateInput.value = twoWeeksLater.toISOString().split('T')[0];
            updateDuration();
        }
    }

    async createSprint() {
        const formData = {
            sprintWeek: document.getElementById('sprintName').value,
            goal: document.getElementById('sprintGoal').value,
            startDate: document.getElementById('sprintStartDate').value,
            endDate: document.getElementById('sprintEndDate').value
        };

        try {
            const response = await api.createSprint(formData);
            if (response.success) {
                this.sprints.push(response.data);
                this.populateFilters();
                this.closeModal('createSprintModal');
                this.showNotification('Sprint created successfully!', 'success');
            }
        } catch (error) {
            console.error('Error creating sprint:', error);
            this.showNotification('Failed to create sprint.', 'error');
        }
    }

    showCreateUserModal() {
        const modal = document.getElementById('createUserModal');
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
        }
    }

    async createUser() {
        const formData = {
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            role: document.getElementById('userRole').value,
            password: document.getElementById('userPassword').value
        };

        try {
            const response = await api.createUser(formData);
            if (response.success) {
                this.users.push(response.data);
                this.populateFilters();
                this.closeModal('createUserModal');
                this.showNotification('User created successfully!', 'success');
            }
        } catch (error) {
            console.error('Error creating user:', error);
            this.showNotification('Failed to create user.', 'error');
        }
    }

    renderSprints() {
        const container = document.getElementById('sprintsContent');
        if (!container) return;

        container.innerHTML = this.sprints.map(sprint => `
            <div class="sprint-card">
                <div class="card-header">
                    <h3>${sprint.sprintWeek}</h3>
                    <span class="sprint-status ${sprint.status}">${sprint.status}</span>
                </div>
                <p class="sprint-goal">${sprint.goal || 'No goal set'}</p>
                <div class="sprint-stats">
                    <div class="stat">
                        <span class="stat-value">${sprint.taskCount || 0}</span>
                        <span class="stat-label">Tasks</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${sprint.completedCount || 0}</span>
                        <span class="stat-label">Completed</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderUsers() {
        const container = document.getElementById('usersContent');
        if (!container) return;

        container.innerHTML = this.users.map(user => `
            <div class="user-card">
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
                        <span class="stat-value">${user.taskCount || 0}</span>
                        <span class="stat-label">Tasks</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${user.completedCount || 0}</span>
                        <span class="stat-label">Completed</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
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

    showLoginLoading() {
        const loading = document.getElementById('loginLoading');
        const errorMessage = document.getElementById('loginErrorMessage');
        const successMessage = document.getElementById('loginSuccessMessage');
        const button = document.getElementById('loginButton');
        
        if (errorMessage) errorMessage.classList.remove('show');
        if (successMessage) successMessage.classList.remove('show');
        
        if (loading) loading.classList.add('show');
        if (button) {
            button.disabled = true;
            button.style.opacity = '0.6';
        }
    }

    hideLoginLoading() {
        const loading = document.getElementById('loginLoading');
        const button = document.getElementById('loginButton');
        
        if (loading) loading.classList.remove('show');
        if (button) {
            button.disabled = false;
            button.style.opacity = '1';
        }
    }

    showLoginError(message) {
        const errorMessage = document.getElementById('loginErrorMessage');
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.classList.add('show');
        }
    }

    showLoginSuccess(message) {
        const successMessage = document.getElementById('loginSuccessMessage');
        if (successMessage) {
            successMessage.textContent = message;
            successMessage.classList.add('show');
        }
    }

    openTaskDetails(taskId) {
        if (!taskId) return;
        
        // Find the task in our tasks array
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            this.showNotification('Task not found', 'error');
            return;
        }

        // Populate the modal fields
        document.getElementById('detailTaskTitle').value = task.task || '';
        document.getElementById('detailTaskStatus').value = task.status || 'Not started';
        document.getElementById('detailTaskPriority').value = task.priority || 'P2';
        document.getElementById('detailTaskType').value = task.type || 'Feature';
        document.getElementById('detailTaskDescription').value = task.description || '';
        
        // Populate metadata (read-only fields)
        const createdByElement = document.getElementById('detailTaskCreatedBy');
        const createdAtElement = document.getElementById('detailTaskCreatedAt');
        if (createdByElement) createdByElement.textContent = task.createdBy || 'Unknown';
        if (createdAtElement) createdAtElement.textContent = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'Unknown';

        // Update header badges
        const taskIdBadge = document.getElementById('taskIdBadge');
        const taskStatusBadge = document.getElementById('taskStatusBadge');
        if (taskIdBadge) taskIdBadge.textContent = task.id || 'NEW';
        if (taskStatusBadge) {
            taskStatusBadge.textContent = task.status || 'Not started';
            taskStatusBadge.className = `status-badge status-${(task.status || 'not-started').toLowerCase().replace(/[^a-z]/g, '-')}`;
        }

        // Populate assignee dropdown
        this.populateTaskDetailsDropdowns();

        // Set current assignee
        if (task.assignedTo) {
            document.getElementById('detailTaskAssignee').value = task.assignedTo;
        }

        // Set current sprint
        if (task.sprintWeek) {
            document.getElementById('detailTaskSprint').value = task.sprintWeek;
        }

        // Set the modal title
        document.getElementById('taskDetailsTitle').textContent = `Task Details`;

        // Store current task ID for saving
        this.currentTaskId = taskId;

        // Show the modal
        this.showModal('taskDetailsModal');
    }

    populateTaskDetailsDropdowns() {
        // Populate assignee dropdown
        const assigneeSelect = document.getElementById('detailTaskAssignee');
        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="">Select assignee</option>';
            this.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = user.name;
                assigneeSelect.appendChild(option);
            });
        }

        // Populate sprint dropdown
        const sprintSelect = document.getElementById('detailTaskSprint');
        if (sprintSelect) {
            sprintSelect.innerHTML = '<option value="">No Sprint</option>';
            this.sprints.forEach(sprint => {
                const option = document.createElement('option');
                option.value = sprint.name;
                option.textContent = sprint.name;
                sprintSelect.appendChild(option);
            });
        }
    }

    async saveTaskDetails() {
        if (!this.currentTaskId) return;

        const taskData = {
            task: document.getElementById('detailTaskTitle').value,
            status: document.getElementById('detailTaskStatus').value,
            priority: document.getElementById('detailTaskPriority').value,
            type: document.getElementById('detailTaskType').value,
            description: document.getElementById('detailTaskDescription').value,
            assignedTo: document.getElementById('detailTaskAssignee').value,
            sprintWeek: document.getElementById('detailTaskSprint').value
        };

        try {
            this.showLoading();
            const response = await api.updateTask(this.currentTaskId, taskData);
            
            if (response.success) {
                // Update local task
                const taskIndex = this.tasks.findIndex(t => t.id === this.currentTaskId);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...taskData };
                }
                
                // Re-render board
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(this.tasks);
                }
                
                this.showNotification('Task updated successfully!', 'success');
                this.closeModal('taskDetailsModal');
                
                // Send Slack notification for task updates
                await this.sendSlackTaskUpdate(this.currentTaskId, taskData);
            } else {
                this.showNotification('Failed to update task: ' + response.error, 'error');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            this.showNotification('Failed to update task', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async saveTaskDetailsFromPage(taskData) {
        if (!this.currentTaskId) return;

        try {
            this.showLoading();
            const response = await api.updateTask(this.currentTaskId, taskData);
            
            if (response.success) {
                // Update local task
                const taskIndex = this.tasks.findIndex(t => t.id === this.currentTaskId);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...taskData };
                }
                
                // Re-render board if it's available
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(this.tasks);
                }
                
                this.showNotification('Task updated successfully!', 'success');
                
                // Send Slack notification for task updates
                await this.sendSlackTaskUpdate(this.currentTaskId, taskData);
                
                // Navigate back to board
                setTimeout(() => {
                    this.navigateToPage('board');
                }, 1000);
            } else {
                this.showNotification('Failed to update task: ' + response.error, 'error');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            this.showNotification('Failed to update task', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async sendSlackTaskUpdate(taskId, taskData) {
        try {
            // Get the current user info
            const currentUser = this.currentUser ? this.currentUser.name : 'Unknown User';
            
            // Determine what changed
            const originalTask = this.tasks.find(t => t.id === taskId);
            const changes = {};
            
            if (originalTask) {
                if (taskData.status !== originalTask.status) changes.status = taskData.status;
                if (taskData.priority !== originalTask.priority) changes.priority = taskData.priority;
                if (taskData.assignedTo !== originalTask.assignedTo) changes.assignedTo = taskData.assignedTo;
                if (taskData.description !== originalTask.description) changes.description = true;
                if (taskData.sprintWeek !== originalTask.sprintWeek) changes.sprintWeek = taskData.sprintWeek;
            }
            
            // Send task update notification with thread support
            await api.sendTaskUpdateNotification(
                taskId, 
                taskData.task, 
                currentUser, 
                changes
            );
        } catch (error) {
            console.error('Failed to send Slack notification:', error);
            // Don't show error to user for Slack notifications
        }
    }

    async showTaskDetailPage(taskId) {
        // Load the task data if not already loaded
        if (!this.tasks.length) {
            await this.loadInitialData();
        }
        
        // Find the task
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            this.showNotification('Task not found', 'error');
            this.navigateToPage('dashboard');
            return;
        }

        // Update URL
        window.history.pushState({ page: 'task-detail', taskId }, '', `/task/${taskId}`);
        
        // Update breadcrumb
        this.updateBreadcrumb(`Task ${taskId}`);
        
        // Clear navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Hide all page sections
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show task detail section
        const taskDetailSection = document.getElementById('taskDetailSection');
        if (taskDetailSection) {
            taskDetailSection.classList.remove('hidden');
        }

        // Render the task details form in the page container
        const formContainer = document.getElementById('taskDetailForm');
        if (formContainer) {
            formContainer.innerHTML = this.createTaskDetailFormHTML(task);
            
            // Populate the form with task data
            this.populateTaskDetailForm(task);
        }
    }

    async renderTaskDetailPage(taskId) {
        // Load the task data if not already loaded
        if (!this.tasks.length) {
            await this.loadInitialData();
        }
        
        // Find the task
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            this.showNotification('Task not found', 'error');
            this.navigateToPage('dashboard');
            return;
        }

        // Update breadcrumb
        const breadcrumbElement = document.getElementById('taskDetailBreadcrumb');
        if (breadcrumbElement) {
            breadcrumbElement.textContent = `${task.task || 'Task'} (${taskId})`;
        }

        // Render the task details form in the page container
        const formContainer = document.getElementById('taskDetailForm');
        if (formContainer) {
            formContainer.innerHTML = this.createTaskDetailFormHTML(task);
            
            // Populate the form with task data
            this.populateTaskDetailForm(task);
        }
    }

    createTaskDetailFormHTML(task) {
        return `
            <div class="task-detail-form-container">
                <div class="task-details-header">
                    <div class="task-header-info">
                        <h3 class="task-title-large">Task Details</h3>
                        <div class="task-meta-badges">
                            <span class="task-id-badge">${task.id || 'NEW'}</span>
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
                                        <path d="9 11l3 3 8-8"></path>
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
                                            <option value="Product Testing">Product Testing</option>
                                            <option value="Awaiting Release">Awaiting Release</option>
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
}

// Global functions
function fillDemoCredentials(email, password) {
    document.getElementById('username').value = email;
    document.getElementById('password').value = password;
}

function navigateTo(page) {
    if (window.taskManager) {
        window.taskManager.navigateToPage(page);
    }
}

function showCreateTaskModal() {
    if (window.taskManager) {
        window.taskManager.showCreateTaskModal();
    }
}

function showCreateSprintModal() {
    if (window.taskManager) {
        window.taskManager.showCreateSprintModal();
    }
}

function showCreateUserModal() {
    if (window.taskManager) {
        window.taskManager.showCreateUserModal();
    }
}

function openTaskDetails(taskId) {
    if (window.taskManager) {
        window.taskManager.openTaskDetails(taskId);
    }
}

function editTask(taskId) {
    // Same as openTaskDetails for now
    openTaskDetails(taskId);
}

function saveTaskDetails() {
    if (window.taskManager) {
        window.taskManager.saveTaskDetails();
    }
}

function saveTaskDetailsFromPage() {
    if (!window.taskManager || !window.taskManager.currentTaskId) return;

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
    window.taskManager.saveTaskDetailsFromPage(taskData);
}

function closeModal(modalId) {
    if (window.taskManager) {
        window.taskManager.closeModal(modalId);
    }
}

function syncData() {
    if (window.taskManager) {
        window.taskManager.syncData();
    }
}

function logout() {
    if (window.taskManager) {
        window.taskManager.logout();
    }
}

function toggleProfileMenu() {
    const profileMenu = document.querySelector('.profile-menu');
    if (profileMenu) {
        profileMenu.classList.toggle('open');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskManager = new TaskManager();
});