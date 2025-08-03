// Event Handlers for KiranaClub Task Manager
// This file replaces all inline event handlers to comply with CSP

class EventHandlerManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupDemoAccountHandlers();
        this.setupNavigationHandlers();
        this.setupModalHandlers();
        this.setupFilterHandlers();
        this.setupTaskActionHandlers();
        this.setupFormHandlers();
        this.setupProfileHandlers();
    }

    // Demo account handlers
    setupDemoAccountHandlers() {
        document.querySelectorAll('.demo-account').forEach(account => {
            account.addEventListener('click', (e) => {
                const role = e.currentTarget.querySelector('.role').textContent.toLowerCase();
                let email, password;
                
                switch(role) {
                    case 'admin':
                        email = 'admin@kirana.club';
                        password = 'admin123';
                        break;
                    case 'manager':
                        email = 'manager@kirana.club';
                        password = 'manager123';
                        break;
                    case 'developer':
                        email = 'dev@kirana.club';
                        password = 'dev123';
                        break;
                    default:
                        return;
                }
                
                this.fillDemoCredentials(email, password);
            });
        });
    }

    fillDemoCredentials(email, password) {
        const emailInput = document.getElementById('username'); // Fixed: was 'email', should be 'username'
        const passwordInput = document.getElementById('password');
        
        if (emailInput && passwordInput) {
            emailInput.value = email;
            passwordInput.value = password;
        } else {
            console.warn('Demo credentials: Email or password input not found', {
                emailInput: !!emailInput,
                passwordInput: !!passwordInput
            });
        }
    }

    // Navigation handlers
    setupNavigationHandlers() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                if (section) {
                    this.navigateTo(section);
                }
            });
        });
    }

    navigateTo(section) {
        if (window.router) {
            window.router.navigateToPage(section);
        } else if (window.navigateTo) {
            window.navigateTo(section);
        }
    }

    // Modal handlers
    setupModalHandlers() {
        // Close modal buttons
        document.querySelectorAll('.modal-close, .modal-close-modern').forEach(button => {
            button.addEventListener('click', (e) => {
                console.log('Modal close button clicked');
                const modalId = e.currentTarget.closest('.modal').id;
                this.closeModal(modalId);
            });
        });

        // Note: Removed duplicate event listeners for data-action buttons
        // These are now handled by setupTaskActionHandlers() using event delegation
        console.log('Modal handlers setup complete. Event delegation will handle data-action buttons.');
    }

    // Filter handlers
    setupFilterHandlers() {
        // Multiselect toggles
        document.querySelectorAll('.multiselect-display').forEach(display => {
            display.addEventListener('click', (e) => {
                const filterId = e.currentTarget.dataset.filterId;
                if (filterId) {
                    this.toggleMultiselect(filterId);
                }
            });
        });

        // Filter checkboxes - use event delegation for dynamically created elements
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="checkbox"][data-filter]')) {
                this.applyFilters();
            }
        });

        // Filter buttons
        const clearFiltersBtn = document.querySelector('[data-action="clearAllFilters"]');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearAllFilters());
        }

        const applyFiltersBtn = document.querySelector('[data-action="applyFilters"]');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        }
    }

    // Task action handlers
    setupTaskActionHandlers() {
        // Task action buttons (View, Edit, etc.)
        document.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn) return;

            const action = actionBtn.dataset.action;
            const taskId = actionBtn.dataset.taskId;
            const page = actionBtn.dataset.page;

            console.log('Action button clicked:', { action, taskId, page });

            // Check if required modules are available
            if (!this.checkModuleAvailability(action)) {
                console.error(`Required module not available for action: ${action}`);
                return;
            }

            switch(action) {
                case 'openTaskDetails':
                    if (taskId) this.openTaskDetails(taskId);
                    break;
                case 'editTask':
                    if (taskId) this.editTask(taskId);
                    break;
                case 'saveTaskDetailsFromPage':
                    this.saveTaskDetailsFromPage();
                    break;
                case 'navigateTo':
                    if (page) this.navigateTo(page);
                    break;
                case 'saveTaskDetails':
                    this.saveTaskDetails();
                    break;
                case 'createTask':
                    this.createTask();
                    break;
                case 'createSprint':
                    this.createSprint();
                    break;
                case 'createUser':
                    this.createUser();
                    break;
                case 'showCreateTaskModal':
                    this.showCreateTaskModal();
                    break;
                case 'showCreateSprintModal':
                    this.showCreateSprintModal();
                    break;
                case 'showCreateUserModal':
                    this.showCreateUserModal();
                    break;
                case 'syncData':
                    this.syncData();
                    break;
                case 'logout':
                    this.logout();
                    break;
                case 'applyFilters':
                    this.applyFilters();
                    break;
                default:
                    console.warn('Unknown action:', action);
            }
        });
    }

    // Form handlers
    setupFormHandlers() {
        // Note: Sync data button is now handled by event delegation in setupTaskActionHandlers()
        
        // Back button
        const backBtn = document.querySelector('.back-button');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                console.log('Back button clicked');
                this.navigateTo('board');
            });
        } else {
            console.log('Back button not found');
        }
    }

    // Profile handlers
    setupProfileHandlers() {
        const profileButton = document.querySelector('.profile-button');
        if (profileButton) {
            profileButton.addEventListener('click', () => {
                console.log('Profile button clicked');
                this.toggleProfileMenu();
            });
        } else {
            console.log('Profile button not found');
        }

        // Note: Logout button is now handled by event delegation in setupTaskActionHandlers()
    }

    // Modal functions
    closeModal(modalId) {
        if (window.modalManager) {
            window.modalManager.closeModal(modalId);
        } else if (window.closeModal) {
            window.closeModal(modalId);
        }
    }

    showCreateTaskModal() {
        if (window.taskManager) {
            window.taskManager.showCreateTaskModal();
        } else if (window.showCreateTaskModal) {
            window.showCreateTaskModal();
        }
    }

    showCreateSprintModal() {
        if (window.uiManager) {
            window.uiManager.showCreateSprintModal();
        } else if (window.showCreateSprintModal) {
            window.showCreateSprintModal();
        }
    }

    showCreateUserModal() {
        if (window.uiManager) {
            window.uiManager.showCreateUserModal();
        } else if (window.showCreateUserModal) {
            window.showCreateUserModal();
        }
    }

    // Task functions
    createTask() {
        if (window.taskManager) {
            window.taskManager.createTask();
        } else if (window.createTask) {
            window.createTask();
        }
    }

    saveTaskDetails() {
        if (window.taskManager) {
            window.taskManager.saveTaskDetails();
        } else if (window.saveTaskDetails) {
            window.saveTaskDetails();
        }
    }

    // Sprint functions
    createSprint() {
        if (window.uiManager) {
            window.uiManager.createSprint();
        } else if (window.createSprint) {
            window.createSprint();
        }
    }

    // User functions
    createUser() {
        if (window.uiManager) {
            window.uiManager.createUser();
        } else if (window.createUser) {
            window.createUser();
        }
    }

    // Filter functions
    toggleMultiselect(filterId) {
        if (window.taskBoardManager && window.taskBoardManager.toggleMultiselect) {
            window.taskBoardManager.toggleMultiselect(filterId);
        } else if (window.toggleMultiselect) {
            window.toggleMultiselect(filterId);
        }
    }

    applyFilters() {
        console.log('applyFilters called, checking availability...');
        if (window.applyFilters) {
            console.log('Calling global applyFilters function');
            window.applyFilters();
        } else if (window.taskBoardManager && window.taskBoardManager.applyFilters) {
            console.log('Calling taskBoardManager.applyFilters');
            window.taskBoardManager.applyFilters();
        } else {
            console.error('No applyFilters function found');
        }
    }

    clearAllFilters() {
        console.log('clearAllFilters called, checking availability...');
        if (window.clearAllFilters) {
            console.log('Calling global clearAllFilters function');
            window.clearAllFilters();
        } else if (window.taskBoardManager && window.taskBoardManager.clearAllFilters) {
            console.log('Calling taskBoardManager.clearAllFilters');
            window.taskBoardManager.clearAllFilters();
        } else {
            console.error('No clearAllFilters function found');
        }
    }

    // Task action functions
    openTaskDetails(taskId) {
        console.log('openTaskDetails called with taskId:', taskId);
        if (window.openTaskDetails) {
            console.log('Calling global openTaskDetails function');
            window.openTaskDetails(taskId);
        } else if (window.modalManager && window.modalManager.openTaskDetails) {
            console.log('Calling modalManager.openTaskDetails');
            window.modalManager.openTaskDetails(taskId);
        } else if (window.taskManager && window.taskManager.openTaskDetails) {
            console.log('Calling taskManager.openTaskDetails');
            window.taskManager.openTaskDetails(taskId);
        } else {
            console.error('openTaskDetails function not found in any module');
        }
    }

    editTask(taskId) {
        // For now, editTask does the same as openTaskDetails
        this.openTaskDetails(taskId);
    }

    saveTaskDetailsFromPage() {
        if (window.app) {
            window.app.saveTaskDetailsFromPage();
        } else if (window.saveTaskDetailsFromPage) {
            window.saveTaskDetailsFromPage();
        }
    }

    // Data functions
    syncData() {
        if (window.uiManager) {
            window.uiManager.syncData();
        } else if (window.syncData) {
            window.syncData();
        }
    }

    // Profile functions
    toggleProfileMenu() {
        console.log('toggleProfileMenu called');
        const profileMenu = document.querySelector('.profile-menu');
        if (profileMenu) {
            profileMenu.classList.toggle('open');
            console.log('Profile menu toggled, class list:', profileMenu.classList.toString());
        } else {
            console.error('Profile menu not found');
        }
    }

    logout() {
        if (window.authManager) {
            window.authManager.logout();
        } else if (window.logout) {
            window.logout();
        }
    }

    // Module availability checker
    checkModuleAvailability(action) {
        const moduleMap = {
            'createTask': 'taskManager',
            'saveTaskDetails': 'taskManager',
            'openTaskDetails': 'modalManager',
            'editTask': 'modalManager',
            'showCreateTaskModal': 'taskManager',
            'createSprint': 'uiManager',
            'showCreateSprintModal': 'uiManager',
            'createUser': 'uiManager',
            'showCreateUserModal': 'uiManager',
            'syncData': 'uiManager',
            'logout': 'authManager',
            'navigateTo': 'router',
            'applyFilters': 'taskBoardManager'
        };

        const requiredModule = moduleMap[action];
        if (!requiredModule) return true; // No specific module required

        const moduleExists = !!window[requiredModule];
        if (!moduleExists) {
            console.warn(`Module ${requiredModule} not available for action ${action}. Available modules:`, {
                taskManager: !!window.taskManager,
                authManager: !!window.authManager,
                modalManager: !!window.modalManager,
                uiManager: !!window.uiManager,
                router: !!window.router
            });
        }
        return moduleExists;
    }

    // Debug method to check all modules
    debugModuleStatus() {
        console.log('Module Status:', {
            taskManager: !!window.taskManager,
            authManager: !!window.authManager,
            modalManager: !!window.modalManager,
            uiManager: !!window.uiManager,
            router: !!window.router,
            app: !!window.app,
            taskBoardManager: !!window.taskBoardManager
        });
        
        // Check specific functions
        console.log('Function Availability:', {
            'taskManager.openTaskDetails': !!(window.taskManager && window.taskManager.openTaskDetails),
            'modalManager.openTaskDetails': !!(window.modalManager && window.modalManager.openTaskDetails),
            'taskBoardManager.applyFilters': !!(window.taskBoardManager && window.taskBoardManager.applyFilters)
        });
    }
}

// Initialize event handlers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing EventHandlerManager...');
    window.eventHandlerManager = new EventHandlerManager();
    
    // Debug module status after a short delay to ensure all modules are loaded
    setTimeout(() => {
        if (window.eventHandlerManager) {
            window.eventHandlerManager.debugModuleStatus();
        }
    }, 1000);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventHandlerManager;
} 