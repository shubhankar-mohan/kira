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
        return routes[path] || 'dashboard';
    }

    getPathFromPage(page) {
        const paths = {
            'dashboard': '/dashboard',
            'board': '/board',
            'sprints': '/sprints',
            'users': '/users'
        };
        return paths[page] || '/dashboard';
    }

    setupFormSubmissions() {
        // Create task form
        const createTaskForm = document.getElementById('createTaskForm');
        if (createTaskForm) {
            createTaskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createTask();
            });
        }

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
            
            console.log('Populating filters...');
            this.populateFilters();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Failed to load data. Please refresh the page.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    navigateToPage(page, updateHistory = true) {
        console.log('Navigating to page:', page);
        
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
            'users': 'Team'
        };
        
        const breadcrumbElement = document.getElementById('breadcrumbPath');
        if (breadcrumbElement) {
            breadcrumbElement.textContent = breadcrumbMap[page] || 'Dashboard';
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
            sprintWeek: document.getElementById('taskSprint').value
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