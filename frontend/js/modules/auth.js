// Authentication Module - Handles login, logout, and user management
class AuthManager {
    constructor() {
        this.currentUser = null;
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
        
        // Safely update profile elements if they exist
        const profileNameElement = document.getElementById('profileName');
        const profileRoleElement = document.getElementById('profileRole');
        const avatarElement = document.getElementById('profileAvatar');
        
        if (profileNameElement) {
            profileNameElement.textContent = name;
        }
        if (profileRoleElement) {
            profileRoleElement.textContent = role.toLowerCase();
        }
        if (avatarElement) {
            avatarElement.textContent = name.charAt(0).toUpperCase();
        }
        
        // Hide user management for non-admins
        if (this.currentUser.role !== 'Admin') {
            const userNav = document.getElementById('userManagementNav');
            if (userNav) userNav.style.display = 'none';
        }
        
        // Load initial data using the app's method
        if (window.app) {
            window.app.loadInitialData();
        } else {
            // Fallback to taskManager if app is not available
            window.taskManager.loadInitialData();
        }
        
        window.router.navigateToPage(window.router.currentPage, false);
        
        // Handle task detail page after data is loaded
        if (window.router.currentPage === 'task-detail' && window.router.currentTaskId) {
            if (window.app) {
                window.app.showTaskDetailPage(window.router.currentTaskId);
            }
        }
    }

    async login() {
        console.log('Login function called');
        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        console.log('Login attempt:', email);
        
        if (!email || !password) {
            window.taskManager.showNotification('Please enter both email and password.', 'error');
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
        
        window.taskManager.showNotification('Logged out successfully.', 'success');
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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
} else if (typeof window !== 'undefined') {
    window.AuthManager = AuthManager;
} 