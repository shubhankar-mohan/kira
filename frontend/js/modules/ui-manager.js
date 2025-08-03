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
        const container = document.getElementById('sprintsContent');
        if (!container) return;

        const sprints = window.taskManager.sprints || [];
        container.innerHTML = sprints.map(sprint => `
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

        const users = window.taskManager.users || [];
        container.innerHTML = users.map(user => `
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
            
            this.showNotification('Data synced successfully!', 'success');
        } catch (error) {
            console.error('Sync error:', error);
            this.showNotification('Sync failed. Please try again.', 'error');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} 