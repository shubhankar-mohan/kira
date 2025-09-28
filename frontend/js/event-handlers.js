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
                this.handleFilterCheckboxChange(e);
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
        document.addEventListener('click', (event) => {
            const actionBtn = event.target.closest('[data-action]');
            if (!actionBtn) return;

            const action = actionBtn.dataset.action;
            const taskId = actionBtn.dataset.taskId;
            const page = actionBtn.dataset.page;

            const modalManagedActions = new Set([
                'showCreateTaskModal',
                'showCreateUserModal',
                'showCreateSprintModal',
                'createTask',
                'createUser',
                'createSprint',
                'saveTaskDetails',
                'saveTaskDetailsFromPage',
                'addComment',
                'clearComment',
                'closeTaskModal',
                'toggleCurrentSprint',
                'toggleCurrentSprintFilter'
            ]);

            if (modalManagedActions.has(action)) {
                return; // Let ModalManager handle these actions to avoid duplicates
            }

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
                case 'copyTaskPath':
                    if (taskId) this.copyTaskPath(taskId);
                    break;
                case 'saveTaskDetailsFromPage':
                    this.saveTaskDetailsFromPage();
                    break;
                case 'navigateTo':
                    if (page) this.navigateTo(page);
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
                case 'closeModal':
                    const modalId = actionBtn.dataset.modalId;
                    if (modalId && window.modalManager) {
                        window.modalManager.closeModal(modalId);
                    }
                    break;
                case 'openUserProfile':
                    this.openUserProfile();
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
            profileButton.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Profile button clicked');
                this.toggleProfileMenu();
            });
        } else {
            console.log('Profile button not found');
        }

        // Close profile menu when clicking outside
        document.addEventListener('click', (e) => {
            const profileMenu = document.querySelector('.profile-menu');
            if (profileMenu && !profileMenu.contains(e.target)) {
                profileMenu.classList.remove('open');
            }
        });

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
        if (window.modalManager && typeof window.modalManager.createSprint === 'function') {
            window.modalManager.createSprint();
        } else if (window.uiManager && typeof window.uiManager.createSprint === 'function') {
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

    copyTaskPath(taskId) {
        console.log('copyTaskPath called with taskId:', taskId);
        
        // Find the task to get its details
        let task = null;
        if (window.taskManager && window.taskManager.tasks) {
            task = window.taskManager.tasks.find(t => t.id === taskId);
        }
        
        if (!task) {
            console.error('Task not found for ID:', taskId);
            return;
        }
        
        // Create the task path/URL using config
        const taskPath = window.config ? window.config.getTaskUrl(taskId) : `http://localhost:3001/task/${taskId}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(taskPath).then(() => {
            // Show success notification
            if (window.taskManager && window.taskManager.showNotification) {
                window.taskManager.showNotification('Task path copied to clipboard!', 'success');
            } else {
                // Fallback alert
                alert('Task path copied to clipboard!');
            }
            console.log('Task path copied:', taskPath);
        }).catch(err => {
            console.error('Failed to copy task path:', err);
            // Fallback: select and copy manually
            const textArea = document.createElement('textarea');
            textArea.value = taskPath;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (window.taskManager && window.taskManager.showNotification) {
                window.taskManager.showNotification('Task path copied to clipboard!', 'success');
            } else {
                alert('Task path copied to clipboard!');
            }
        });
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

    toggleProfileMenu() {
        if (window.uiManager) {
            window.uiManager.toggleProfileMenu();
        } else {
            console.error('UIManager not available');
        }
    }

    openUserProfile() {
        // Close the profile dropdown first
        const profileMenu = document.querySelector('.profile-menu');
        if (profileMenu) {
            profileMenu.classList.remove('open');
        }

        // Get current user info
        const currentUser = window.authManager?.currentUser;
        if (currentUser && window.modalManager) {
            // Find the user in the users list and open their details
            const user = window.taskManager?.users?.find(u => u.email === currentUser.email);
            if (user) {
                window.modalManager.openUserDetails(user.id);
            } else {
                console.warn('Current user not found in users list');
                // Show a notification or basic profile info
                if (window.uiManager) {
                    window.uiManager.showNotification('Profile details not available', 'info');
                }
            }
        } else {
            console.error('User profile not available');
        }
    }

    handleFilterCheckboxChange(e) {
        const checkbox = e.target;
        const filterId = this.getFilterIdFromCheckbox(checkbox);
        
        if (!filterId) return;
        
        // If "ALL" was checked, uncheck all other options
        if (checkbox.id.endsWith('-all') && checkbox.checked) {
            const dropdown = document.getElementById(filterId + 'Dropdown');
            if (dropdown) {
                dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    if (!cb.id.endsWith('-all')) {
                        cb.checked = false;
                    }
                });
            }
        }
        // If any specific option was checked, uncheck "ALL"
        else if (!checkbox.id.endsWith('-all') && checkbox.checked) {
            const dropdown = document.getElementById(filterId + 'Dropdown');
            if (dropdown) {
                const allCheckbox = dropdown.querySelector('input[type="checkbox"][id$="-all"]');
                if (allCheckbox) {
                    allCheckbox.checked = false;
                }
            }
        }
        // If "ALL" was unchecked and no other options are selected, recheck "ALL"
        else if (checkbox.id.endsWith('-all') && !checkbox.checked) {
            const dropdown = document.getElementById(filterId + 'Dropdown');
            if (dropdown) {
                const otherCheckboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([id$="-all"])');
                const hasOtherChecked = Array.from(otherCheckboxes).some(cb => cb.checked);
                if (!hasOtherChecked) {
                    checkbox.checked = true; // Keep "ALL" checked if nothing else is selected
                }
            }
        }
    }

    getFilterIdFromCheckbox(checkbox) {
        // Find the dropdown container to determine filter ID
        const dropdown = checkbox.closest('[id$="Dropdown"]');
        if (dropdown) {
            return dropdown.id.replace('Dropdown', '');
        }
        return null;
    }

    // Module availability checker
    checkModuleAvailability(action) {
        const moduleMap = {
            'createTask': 'taskManager',
            'saveTaskDetails': 'taskManager',
            'openTaskDetails': 'modalManager',
            'editTask': 'modalManager',
            'copyTaskPath': 'taskManager',
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