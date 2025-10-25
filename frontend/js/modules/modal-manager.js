// Modal Manager Module - Handles all modal operations
class ModalManager {
    constructor() {
        this.setupModalListeners();
        this.setupTaskModalEnhancements();
        this.setupConfirmModal();

        // Cached handlers for create task modal buttons
        this.boundCancelHandler = null;
        this.boundCreateHandler = null;
        this.boundAssigneeDropdownHandler = null;
        this.boundDropdownCloseHandler = null;
        
        // Custom confirm modal resolver
        this.confirmResolver = null;
    }

    setupModalListeners() {
        // Prevent duplicate listener setup
        if (this._listenersSetup) {
            return;
        }
        this._listenersSetup = true;
        
        // Close modal when pressing ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                // Find the topmost visible modal
                const visibleModals = Array.from(document.querySelectorAll('.modal, .task-modal-overlay, .confirm-modal-overlay'))
                    .filter(modal => {
                        const styles = window.getComputedStyle(modal);
                        return styles.display !== 'none' && modal.classList.contains('show');
                    });
                
                if (visibleModals.length > 0) {
                    const topmostModal = visibleModals[visibleModals.length - 1];
                    
                    // Handle confirm modal
                    if (topmostModal.classList.contains('confirm-modal-overlay')) {
                        this.hideConfirmModal(false);
                        return;
                    }
                    
                    // Handle task details modal
                    if (topmostModal.id === 'taskDetailsModal') {
                        this.closeTaskModal();
                        return;
                    }
                    
                    // Handle other modals
                    if (topmostModal.id) {
                        this.closeModal(topmostModal.id);
                    }
                }
            }
        });
        
        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('task-modal-overlay')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Handle task modal differently
                if (e.target.classList.contains('task-modal-overlay') && e.target.id === 'taskDetailsModal') {
                    this.closeTaskModal();
                } else {
                    this.closeModal(e.target.id);
                }
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Find any open modal - check both regular modals and task modals
                const openModal = document.querySelector('.modal.show, .task-modal-overlay.show, .task-modal-overlay[style*="display: flex"]');
                if (openModal) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Handle task modal differently
                    if (openModal.classList.contains('task-modal-overlay') && openModal.id === 'taskDetailsModal') {
                        this.closeTaskModal();
                    } else {
                        this.closeModal(openModal.id);
                    }
                }
            }
        });

        // Handle modal close buttons
        document.addEventListener('click', (e) => {
            const closeButton = e.target.closest('.modal-close, .task-modal-close');
            if (closeButton) {
                e.preventDefault();
                e.stopPropagation();
                
                // Handle different close button types
                if (closeButton.classList.contains('task-modal-close')) {
                    // For task modal close buttons
                    const modal = closeButton.closest('.task-modal-overlay');
                    if (modal) {
                        this.closeModal(modal.id);
                    }
                } else if (closeButton.classList.contains('modal-close')) {
                    // For regular modal close buttons
                    const modal = closeButton.closest('.modal');
                    if (modal) {
                        this.closeModal(modal.id);
                    }
                }
                
                // Also handle data-action close buttons
                const action = closeButton.dataset.action;
                const modalId = closeButton.dataset.modalId;
                
                if (action === 'closeModal' && modalId) {
                    this.closeModal(modalId);
                } else if (action === 'closeTaskModal') {
                    this.closeTaskModal();
                }
            }
        });

        // Handle form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'loginFormElement') {
                e.preventDefault();
                window.authManager.login();
            }
        });

        // Handle button actions
        document.addEventListener('click', (e) => {
            // Support elements with data-action on ancestors (e.g., icons inside buttons)
            const clickable = e.target.closest('[data-action]');
            if (clickable) {
                const action = clickable.dataset.action;
                if (action) {
                    // Stop propagation immediately to prevent duplicate handling
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    // Create a new event-like object with the clickable as the target
                    const eventWithClickable = {
                        ...e,
                        target: clickable,
                        currentTarget: clickable,
                        preventDefault: () => e.preventDefault(),
                        stopPropagation: () => e.stopPropagation()
                    };
                    this.handleAction(action, eventWithClickable);
                }
            }
        }, { capture: true });
    }

    setupTaskModalEnhancements() {
        // Auto-resize textarea
        const textareas = document.querySelectorAll('.task-form-textarea, .task-comment-textarea');
        textareas.forEach(textarea => {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            });
        });

        // Auto-save functionality
        let saveTimeout;
        const formInputs = document.querySelectorAll('.task-form-input, .task-form-select, .task-form-textarea');
        formInputs.forEach(input => {
            input.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                // Mark the parent modal as dirty for unified confirmation behavior
                const modalOverlay = input.closest('.task-modal-overlay');
                if (modalOverlay) {
                    modalOverlay.dataset.dirty = 'true';
                }
                saveTimeout = setTimeout(() => this.autoSaveTask(), 2000);
            });
        });

        // Dynamic header updates for Create Task modal
        this.setupCreateTaskModalDynamics();
        
        // Setup multi-select assignee dropdown
        this.setupAssigneeMultiSelect();

        // Status and priority change handling
        const statusSelect = document.getElementById('detailTaskStatus');
        const prioritySelect = document.getElementById('detailTaskPriority');
        
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                this.updateStatusBadge(e.target.value);
            });
        }
        
        if (prioritySelect) {
            prioritySelect.addEventListener('change', (e) => {
                this.updatePriorityBadge(e.target.value);
            });
        }

        // Prevent modal container clicks from closing the modal
        const modalContainer = document.querySelector('.task-modal-container');
        if (modalContainer) {
            modalContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    setupConfirmModal() {
        const cancelBtn = document.getElementById('confirmModalCancel');
        const confirmBtn = document.getElementById('confirmModalConfirm');
        const overlay = document.getElementById('confirmModal');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideConfirmModal(false);
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.hideConfirmModal(true);
            });
        }

        // Close on overlay click
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideConfirmModal(false);
                }
            });
        }

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !overlay?.classList.contains('hidden')) {
                this.hideConfirmModal(false);
            }
        });
    }

    showConfirm(options = {}) {
        const {
            title = 'Confirm Action',
            message = 'Are you sure you want to proceed?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            type = 'danger', // 'danger', 'warning', 'info', 'primary'
            icon = null
        } = options;

        return new Promise((resolve) => {
            this.confirmResolver = resolve;

            const modal = document.getElementById('confirmModal');
            const titleEl = document.getElementById('confirmModalTitle');
            const messageEl = document.getElementById('confirmModalMessage');
            const confirmBtn = document.getElementById('confirmModalConfirm');
            const cancelBtn = document.getElementById('confirmModalCancel');
            const iconEl = document.getElementById('confirmModalIcon');

            // Set content
            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;
            if (confirmBtn) confirmBtn.textContent = confirmText;
            if (cancelBtn) cancelBtn.textContent = cancelText;

            // Set icon type
            if (iconEl) {
                iconEl.className = 'confirm-modal-icon';
                if (type === 'warning') iconEl.classList.add('warning');
                if (type === 'info') iconEl.classList.add('info');
                
                // Update icon SVG based on type
                if (icon) {
                    iconEl.innerHTML = icon;
                } else {
                    // Default icons
                    if (type === 'danger') {
                        iconEl.innerHTML = `
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        `;
                    } else if (type === 'warning') {
                        iconEl.innerHTML = `
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        `;
                    } else if (type === 'info') {
                        iconEl.innerHTML = `
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 16v-4"></path>
                                <path d="M12 8h.01"></path>
                            </svg>
                        `;
                    }
                }
            }

            // Set button style
            if (confirmBtn) {
                confirmBtn.className = 'confirm-btn confirm-btn-confirm';
                if (type === 'warning') confirmBtn.classList.add('warning');
                if (type === 'primary' || type === 'info') confirmBtn.classList.add('primary');
            }

            // Show modal
            if (modal) {
                modal.classList.remove('hidden');
            }
        });
    }

    hideConfirmModal(confirmed) {
        const modal = document.getElementById('confirmModal');
        if (modal) {
            modal.classList.add('hidden');
        }

        if (this.confirmResolver) {
            this.confirmResolver(confirmed);
            this.confirmResolver = null;
        }
    }

    handleAction(action, event) {
        // Use the element with data-action attribute (from currentTarget or closest)
        const actionElement = event.currentTarget || event.target.closest('[data-action]') || event.target;
        const sprintId = actionElement.dataset.sprintId;
        const page = actionElement.dataset.page || actionElement.closest('[data-page]')?.dataset.page;
        
        // Prevent duplicate calls from event bubbling
        if (action === 'toggleCurrentSprint') {
            event.preventDefault();
            event.stopPropagation();
        }
        
        switch (action) {
            case 'showCreateTaskModal':
                this.showModal('createTaskModal');
                break;
            case 'showCreateUserModal':
                this.showModal('createUserModal');
                break;
            case 'showCreateSprintModal':
                this.showCreateSprintModal();
                break;
            case 'saveTaskDetails':
                event.preventDefault();
                event.stopPropagation();
                this.handleSaveTaskDetails();
                break;
            case 'createTask':
                if (this.validateCreateTaskForm()) {
                    this.handleCreateTask();
                }
                break;
            case 'createUser':
                if (window.uiManager) {
                    window.uiManager.createUser();
                }
                break;
            case 'createSprint':
                if (window.sprintManager && typeof window.sprintManager.createSprint === 'function') {
                    window.sprintManager.createSprint();
                } else if (window.uiManager && typeof window.uiManager.createSprint === 'function') {
                    window.uiManager.createSprint();
                } else {
                    console.warn('Sprint creation handler not available');
                }
                break;
            case 'syncData':
                window.taskManager.syncData();
                break;
            case 'toggleCurrentSprint':
                if (sprintId) {
                    this.toggleCurrentSprint(sprintId);
                }
                break;
            case 'toggleCurrentSprintFilter':
                if (window.taskBoardManager) {
                    window.taskBoardManager.toggleCurrentSprintFilter();
                }
                break;
            case 'switchTaskTab':
                {
                    const tabName = event.target.dataset.tab;
                    if (tabName) this.switchTaskTab(tabName);
                }
                break;
            case 'navigateTo':
                if (page && window.router) {
                    window.router.navigateToPage(page);
                }
                break;
            case 'saveTaskDetailsFromPage':
                if (window.app) {
                    const taskData = {
                        task: document.getElementById('pageTaskTitle')?.value || '',
                        status: document.getElementById('pageTaskStatus')?.value || 'Not started',
                        priority: document.getElementById('pageTaskPriority')?.value || 'P2',
                        type: document.getElementById('pageTaskType')?.value || 'Feature',
                        description: document.getElementById('pageTaskDescription')?.value || '',
                        assignedTo: document.getElementById('pageTaskAssignee')?.value || '',
                        sprintWeek: document.getElementById('pageTaskSprint')?.value || ''
                    };
                    window.app.saveTaskDetailsFromPage(taskData);
                }
                break;
            case 'addComment':
                event.preventDefault();
                event.stopPropagation();
                this.addComment();
                break;
            case 'clearComment':
                this.clearComment();
                break;
            case 'addPageComment':
                event.preventDefault();
                event.stopPropagation();
                this.addPageComment();
                break;
            case 'clearPageComment':
                this.clearPageComment();
                break;
            case 'deleteTask':
                this.deleteTask();
                break;
            case 'closeModal': {
                event.preventDefault();
                event.stopPropagation();

                const explicitModalId = event.target.dataset.modalId || event.target.closest('[data-modal-id]')?.dataset.modalId;
                const modalElement = explicitModalId ? document.getElementById(explicitModalId) : event.target.closest('.modal, .task-modal-overlay');
                const resolvedModalId = explicitModalId || modalElement?.id;

                if (resolvedModalId) {
                    this.closeModal(resolvedModalId);
                } else {
                    console.warn('closeModal action triggered but no modal could be resolved.', {
                        target: event.target
                    });
                }

                break;
            }
            case 'closeTaskModal':
                this.closeTaskModal();
                break;
            case 'generateUserPassword':
                this.generateUserPassword();
                break;
            case 'copyUserPassword':
                this.copyUserPassword();
                break;
            case 'openUserDetails':
                const userId = event.target.closest('[data-user-id]')?.dataset.userId;
                if (userId) {
                    this.openUserDetails(userId);
                }
                break;
            case 'saveUserDetails':
                this.saveUserDetails();
                break;
            case 'deleteUser':
                event.preventDefault();
                event.stopPropagation();
                const deleteButton = event.target.closest('[data-action="deleteUser"]');
                const userIdToDelete = deleteButton?.dataset.userId;
                if (userIdToDelete) {
                    this.deleteUser(userIdToDelete);
                } else {
                    console.error('Delete user: No userId found on button');
                }
                break;
        }
    }

    async toggleCurrentSprint(sprintId) {
        console.log('🎯 toggleCurrentSprint called with sprintId:', sprintId);
        console.log('🎯 Available sprints:', window.taskManager.sprints.map(s => ({ id: s.id, sprintWeek: s.sprintWeek, isCurrent: s.isCurrent })));
        
        // Prevent duplicate calls
        if (this.isTogglingSprintStatus) {
            console.log('⚠️ Already toggling sprint status, ignoring duplicate call');
            return;
        }
        this.isTogglingSprintStatus = true;
        
        try {
            const sprint = window.taskManager.sprints.find(s => (s.sprintWeek || s.name) === sprintId);
            if (!sprint) {
                console.error('❌ Sprint not found with ID:', sprintId);
                window.uiManager.showNotification('Sprint not found', 'error');
                this.isTogglingSprintStatus = false;
                return;
            }
            
            console.log('✅ Found sprint:', sprint);

            // Update sprint status
            const newStatus = !sprint.isCurrent;
            console.log('🎯 Toggling sprint current status from', sprint.isCurrent, 'to', newStatus);

            // Update in backend - only send the essential data to avoid conflicts
            console.log('📡 Making API call to update sprint...');
            const response = await api.updateSprint(sprint.id, { 
                isCurrent: newStatus 
            });
            console.log('📡 API response:', response);
            
            if (response.success) {
                // Update local state after successful API call - only for this sprint
                sprint.isCurrent = newStatus;
                
                window.uiManager.showNotification(
                    `Sprint ${newStatus ? 'marked as current' : 'unmarked'}`, 
                    'success'
                );
                
                // Re-render sprints to update UI
                window.uiManager.renderSprints();
                
                // Update dashboard with new current sprint data
                window.taskManager.updateDashboard();
                
                // Update board filters if on board page
                if (window.router.currentPage === 'board' && window.taskBoardManager) {
                    window.taskBoardManager.populateFilters();
                }
            } else {
                window.uiManager.showNotification('Failed to update sprint', 'error');
            }
        } catch (error) {
            console.error('Error toggling current sprint:', error);
            window.uiManager.showNotification('Failed to update sprint', 'error');
        } finally {
            this.isTogglingSprintStatus = false;
        }
    }

    openUserDetails(userId) {
        const user = window.taskManager.users.find(u => (u.id || u.email) === userId);
        if (!user) {
            window.uiManager.showNotification('User not found', 'error');
            return;
        }

        // Populate form fields
        document.getElementById('userDetailName').value = user.name || '';
        document.getElementById('userDetailEmail').value = user.email || '';
        document.getElementById('userDetailRole').value = user.role || 'Developer';
        document.getElementById('userDetailSlackName').value = user.slackName || '';
        document.getElementById('userDetailSlackId').value = user.slackId || '';
        document.getElementById('userDetailStatus').value = user.status || 'Active';

        // Store current user ID for saving
        this.currentUserId = userId;

        // Update delete button with user ID
        const deleteButton = document.querySelector('[data-action="deleteUser"]');
        if (deleteButton) {
            deleteButton.dataset.userId = userId;
        }

        // Show modal
        this.showModal('userDetailsModal');
    }

    async saveUserDetails() {
        if (!this.currentUserId) return;
        
        // Prevent duplicate submissions
        if (this.isSavingUser) {
            console.log('⚠️ Already saving user, ignoring duplicate call');
            return;
        }

        const userData = {
            name: document.getElementById('userDetailName').value,
            email: document.getElementById('userDetailEmail').value,
            role: document.getElementById('userDetailRole').value,
            slackName: document.getElementById('userDetailSlackName').value,
            slackId: document.getElementById('userDetailSlackId').value,
            status: document.getElementById('userDetailStatus').value
        };

        try {
            this.isSavingUser = true;
            window.uiManager.showLoading();
            const response = await api.updateUser(this.currentUserId, userData);
            
            if (response.success) {
                // Update local user data
                const userIndex = window.taskManager.users.findIndex(u => (u.id || u.email) === this.currentUserId);
                if (userIndex !== -1) {
                    window.taskManager.users[userIndex] = { ...window.taskManager.users[userIndex], ...userData };
                }
                
                window.uiManager.showNotification('User updated successfully!', 'success');
                this.closeModal('userDetailsModal');
                
                // Re-render users
                window.uiManager.renderUsers();
            } else {
                window.uiManager.showNotification('Failed to update user: ' + response.error, 'error');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            window.uiManager.showNotification('Failed to update user', 'error');
        } finally {
            this.isSavingUser = false;
            window.uiManager.hideLoading();
        }
    }

    async deleteUser(userId) {
        if (!userId) {
            console.error('Delete user: No userId provided');
            return;
        }
        
        // Prevent duplicate submissions - check BEFORE showing confirm dialog
        if (this.isDeletingUser) {
            console.log('⚠️ Already deleting user, ignoring duplicate call');
            return;
        }
        
        // Set flag immediately to prevent duplicate confirm dialogs
        this.isDeletingUser = true;
        
        // Disable the delete button immediately
        const deleteBtn = document.querySelector('[data-action="deleteUser"]');
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.style.opacity = '0.5';
            deleteBtn.style.cursor = 'not-allowed';
        }
        
        try {
            // Show custom confirmation dialog
            const confirmed = await this.showConfirm({
                title: 'Delete User',
                message: 'Are you sure you want to delete this user? This action cannot be undone.',
                confirmText: 'Delete User',
                cancelText: 'Cancel',
                type: 'danger'
            });
            
            if (!confirmed) {
                // User cancelled, reset flag and button
                this.isDeletingUser = false;
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.style.opacity = '';
                    deleteBtn.style.cursor = '';
                }
                return;
            }

            // User confirmed - CLOSE MODAL IMMEDIATELY before API call
            this.closeModal('userDetailsModal');
            
            // Show loading indicator
            window.uiManager.showLoading();
            
            // Proceed with deletion API call
            const response = await api.deleteUser(userId);
            
            if (response.success) {
                // Remove from local data - check both id and email since userId could be either
                const beforeCount = window.taskManager.users.length;
                window.taskManager.users = window.taskManager.users.filter(u => u.id !== userId && u.email !== userId);
                const afterCount = window.taskManager.users.length;
                
                console.log(`🗑️ User deleted. Before: ${beforeCount}, After: ${afterCount}, Removed: ${beforeCount - afterCount}`);
                
                // Re-render users list FIRST
                window.uiManager.renderUsers();
                
                // Then show success notification
                window.uiManager.showNotification('User deleted successfully!', 'success');
            } else {
                window.uiManager.showNotification('Failed to delete user: ' + response.error, 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            window.uiManager.showNotification('Failed to delete user', 'error');
        } finally {
            this.isDeletingUser = false;
            window.uiManager.hideLoading();
            
            // Re-enable button in case of error (modal will close on success)
            const deleteBtn = document.querySelector('[data-action="deleteUser"]');
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.style.opacity = '';
                deleteBtn.style.cursor = '';
            }
        }
    }

    showCreateSprintModal() {
        // Auto-populate Monday to Friday dates
        const dates = this.getNextMondayFriday();
        document.getElementById('sprintStartDate').value = dates.monday;
        document.getElementById('sprintEndDate').value = dates.friday;
        
        this.showModal('createSprintModal');
    }

    getNextMondayFriday() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        // Calculate next Monday
        const nextMonday = new Date(today);
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // If Sunday, next day is Monday
        nextMonday.setDate(today.getDate() + daysUntilMonday);
        
        // Calculate Friday of the same week
        const nextFriday = new Date(nextMonday);
        nextFriday.setDate(nextMonday.getDate() + 4);
        
        return {
            monday: nextMonday.toISOString().split('T')[0],
            friday: nextFriday.toISOString().split('T')[0]
        };
    }

    async showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal with ID '${modalId}' not found`);
            return;
        }

        try {
            console.log(`🎭 Opening modal: ${modalId}`);

            // Reset any previous animations
            const modalContainer = modal.querySelector('.task-modal-container');
            if (modalContainer) {
                modalContainer.style.animation = '';
            }

            modal.style.display = 'flex';
            modal.classList.add('show');

            // Special handling for create task modal
            if (modalId === 'createTaskModal') {
                try {
                    // Re-populate dropdowns with latest data
                    await this.refreshCreateTaskDropdowns();
                    this.bindCreateTaskModalEvents(modal);
                    // Setup assignee multiselect
                    this.setupAssigneeMultiSelect();
                    // Ensure body exists/visible
                    const body = modal.querySelector('.task-modal-body');
                    if (body) body.style.display = '';
                    // Ensure footer visible
                    const footer = modal.querySelector('.task-modal-footer');
                    if (footer) {
                        footer.style.display = '';
                        this.setupTaskFooterActions(footer);
                    }
                    console.log('✅ Create task modal initialized successfully');
                } catch (error) {
                    console.error('❌ Error initializing create task modal:', error);
                    // Show error but don't prevent modal from opening
                }
            }
            
            // Ensure edit modal has a visible Save button
            if (modalId === 'taskDetailsModal') {
                const footer = modal.querySelector('.task-modal-footer');
                if (footer) footer.style.display = '';
                let saveBtn = footer ? footer.querySelector('.task-btn-primary') : null;
                if (!saveBtn && footer) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'task-btn task-btn-primary';
                    btn.innerHTML = `
                        <svg class="task-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17,21 17,13 7,13 7,21"></polyline>
                            <polyline points="7,3 7,8 15,8"></polyline>
                        </svg>
                        Save Changes`;
                    btn.addEventListener('click', () => {
                        if (window.modalManager) window.modalManager.handleSaveTaskDetails();
                    });
                    footer.appendChild(btn);
                }
            }

            // Focus first input in modal
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }

            console.log(`✅ Modal ${modalId} opened successfully`);
        } catch (error) {
            console.error(`❌ Error opening modal ${modalId}:`, error);
        }
    }
    
    // Method to refresh all dropdowns in create task modal
    async refreshCreateTaskDropdowns() {
        try {
            await Promise.all([
                this.refreshAssigneeDropdown(),
                this.refreshSprintDropdown()
            ]);
            console.log('✅ All dropdowns refreshed successfully');
        } catch (error) {
            console.error('❌ Error refreshing dropdowns:', error);
            // Don't throw error - let modal continue to open even if dropdown refresh fails
        }
    }

    bindCreateTaskModalEvents(modal) {
        if (!modal) return;
        // This method is now handled by setupAssigneeMultiSelect()
        // Keeping this method stub for compatibility
        console.log('bindCreateTaskModalEvents: Assignee setup delegated to setupAssigneeMultiSelect()');
    }

    handleAssigneeSelectionChange() {
        const dropdown = document.getElementById('taskAssigneeDropdown');
        const hiddenInput = document.getElementById('taskAssignee');
        const displayText = document.querySelector('.task-assignee-multiselect .multiselect-text');

        if (!dropdown || !hiddenInput) {
            console.warn('Assignee dropdown or hidden input not found');
            return;
        }

        const selected = Array.from(dropdown.querySelectorAll('input[type="checkbox"]:checked'))
            .map((checkbox) => {
                const email = checkbox.parentElement?.dataset.value;
                console.log('Selected assignee:', email);
                return email;
            })
            .filter(Boolean);

        hiddenInput.value = selected.join(',');
        console.log('Updated taskAssignee hidden input value:', hiddenInput.value);

        if (displayText) {
            displayText.textContent = selected.length > 0 ? `${selected.length} selected` : 'Select assignees';
        }
    }

    setupTaskFooterActions(footer) {
        if (!footer) return;

        const cancelBtn = footer.querySelector('[data-action="closeModal"][data-modal-id="createTaskModal"]');
        const createBtn = footer.querySelector('[data-action="createTask"]');

        if (cancelBtn) {
            cancelBtn.removeEventListener('click', this.boundCancelHandler);
            this.boundCancelHandler = (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.closeModal('createTaskModal');
            };
            cancelBtn.addEventListener('click', this.boundCancelHandler);
        }

        if (createBtn) {
            createBtn.removeEventListener('click', this.boundCreateHandler);
            this.boundCreateHandler = async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await this.handleCreateTask();
            };
            createBtn.addEventListener('click', this.boundCreateHandler);
        }
    }

    async handleCreateTask() {
        // Prevent duplicate submissions
        if (this.isCreatingTask) {
            console.warn('Task creation already in progress, ignoring duplicate request');
            return;
        }
        
        if (!this.validateCreateTaskForm()) return;

        const createBtn = document.querySelector('#createTaskModal [data-action="createTask"]');
        const originalContent = createBtn ? createBtn.innerHTML : null;

        try {
            this.isCreatingTask = true;
            this.setButtonLoadingState(createBtn, 'Creating...');
            const result = await window.taskManager.createTask();
            if (!result?.success) {
                const message = result?.error?.message || result?.error || 'Failed to create task. Please try again.';
                window.uiManager?.showNotification(message, 'error');
                return;
            }
            
            // Show success notification with shareable link
            if (result.data && (result.data.shortId || result.data.id)) {
                const taskId = result.data.shortId || result.data.id;
                const shareableLink = window.config.getTaskUrl(taskId);
                window.uiManager?.showTaskCreatedNotification(taskId, shareableLink);
            } else {
                window.uiManager?.showNotification('Task created successfully!', 'success');
            }
        } finally {
            this.isCreatingTask = false;
            this.resetButtonState(createBtn, originalContent);
        }
    }

    handleSaveTaskDetails() {
        // Prevent duplicate submissions
        if (this.isSavingTask) {
            console.warn('Task save already in progress, ignoring duplicate request');
            return;
        }
        
        if (!this.validateTaskDetailForm()) {
            return;
        }

        const saveBtn = document.querySelector('#taskDetailsModal .task-btn-primary');
        const originalContent = saveBtn ? saveBtn.innerHTML : null;

        this.isSavingTask = true;
        this.setButtonLoadingState(saveBtn, 'Saving...');

        this.saveTaskDetails()
            .catch((error) => {
                console.error('saveTaskDetails failed:', error);
            })
            .finally(() => {
                this.isSavingTask = false;
                this.resetButtonState(saveBtn, originalContent);
            });
    }

    setButtonLoadingState(button, label) {
        if (!button) return;

        button.disabled = true;
        button.classList.add('is-loading');
        button.dataset.originalLabel = button.dataset.originalLabel || button.textContent?.trim() || '';
        button.innerHTML = `
            <svg class="task-btn-icon task-animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="m9 12 2 2 4-4"></path>
            </svg>
            ${label}`;
    }

    resetButtonState(button, originalContent) {
        if (!button) return;

        button.disabled = false;
        button.classList.remove('is-loading');

        if (originalContent !== null) {
            button.innerHTML = originalContent;
        } else if (button.dataset.originalLabel) {
            button.textContent = button.dataset.originalLabel;
        }
    }
    
    // Method to refresh assignee dropdown data
    async refreshAssigneeDropdown() {
        const assigneeDropdown = document.getElementById('taskAssigneeDropdown');
        if (!assigneeDropdown) {
            console.warn('taskAssigneeDropdown element not found');
            return;
        }

        try {
            if (!window.taskManager || !window.taskManager.users || window.taskManager.users.length === 0) {
                console.log('refreshAssigneeDropdown: no users available', {
                    taskManager: !!window.taskManager,
                    users: window.taskManager?.users?.length || 0
                });
                // Try fetching users as a fallback
                try {
                    const res = await api.getUsers();
                    const users = res?.data || res?.users || [];
                    if (Array.isArray(users) && users.length) {
                        window.taskManager.users = users;
                    }
                } catch (e) {
                    console.warn('refreshAssigneeDropdown: fetch users failed');
                }
                if (!window.taskManager.users || window.taskManager.users.length === 0) {
                    assigneeDropdown.innerHTML = '<div class="multiselect-option disabled">No users available</div>';
                    return;
                }
            }

            console.log('refreshAssigneeDropdown: populating', window.taskManager.users.length, 'users');

            assigneeDropdown.innerHTML = window.taskManager.users.map(user => `
                <div class="multiselect-option" data-value="${user.email}">
                    <input type="checkbox" id="assignee-${user.email.replace(/[^a-zA-Z0-9]/g, '-')}" data-assignee-checkbox>
                    <label for="assignee-${user.email.replace(/[^a-zA-Z0-9]/g, '-')}">${user.name || user.email}</label>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error refreshing assignee dropdown:', error);
            assigneeDropdown.innerHTML = '<div class="multiselect-option disabled">Error loading users</div>';
        }
    }
    
    // Method to refresh sprint dropdown data
    async refreshSprintDropdown() {
        const sprintSelect = document.getElementById('taskSprint');
        if (!sprintSelect) {
            console.warn('taskSprint element not found');
            return;
        }

        try {
            if (!window.taskManager || !window.taskManager.sprints || window.taskManager.sprints.length === 0) {
                console.log('refreshSprintDropdown: no sprints available', {
                    taskManager: !!window.taskManager,
                    sprints: window.taskManager?.sprints?.length || 0
                });
                // Try fetching sprints as a fallback
                try {
                    const res = await api.getSprints();
                    const sprints = res?.data || res?.sprints || [];
                    if (Array.isArray(sprints) && sprints.length) {
                        window.taskManager.sprints = sprints;
                    }
                } catch (e) {
                    console.warn('refreshSprintDropdown: fetch sprints failed');
                }
                if (!window.taskManager.sprints || window.taskManager.sprints.length === 0) {
                    sprintSelect.innerHTML = '<option value="">No Sprint</option><option disabled>No sprints available</option>';
                    return;
                }
            }

            console.log('refreshSprintDropdown: populating', window.taskManager.sprints.length, 'sprints');

            sprintSelect.innerHTML = '<option value="">No Sprint</option>';

            // Separate current and non-current sprints
            const currentSprints = window.taskManager.sprints.filter(sprint => sprint.isCurrent);
            const otherSprints = window.taskManager.sprints.filter(sprint => !sprint.isCurrent);

            // Sort other sprints by week number (descending, so newest non-current sprints appear first)
            otherSprints.sort((a, b) => {
                const getWeekNumber = (sprint) => {
                    const sprintWeek = sprint.name || sprint.sprintWeek || sprint.week || '';
                    const match = sprintWeek.match(/W?(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                };
                return getWeekNumber(b) - getWeekNumber(a);
            });

            // Add current sprints first (at top) and auto-select if there's exactly one
            currentSprints.forEach((sprint, index) => {
                const option = document.createElement('option');
                option.value = sprint.sprintWeek || sprint.name;
                option.textContent = `🎯 ${sprint.sprintWeek || sprint.name} (Current)`;
                // Auto-select current sprint if it's the only one
                if (currentSprints.length === 1 && index === 0) {
                    option.selected = true;
                }
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
        } catch (error) {
            console.error('Error refreshing sprint dropdown:', error);
            sprintSelect.innerHTML = '<option value="">No Sprint</option><option disabled>Error loading sprints</option>';
        }
    }

    closeModal(modalId, options = {}) {
        const { force = false } = options;
        const modal = document.getElementById(modalId);
        if (modal) {
            // Handle task modal specially
            if (modalId === 'taskDetailsModal') {
                this.closeTaskModal();
                return;
            }
            
            // Check for unsaved changes in create task modal
            if (!force && modalId === 'createTaskModal') {
                const hasChanges = this.hasUnsavedFormChanges(modalId) || modal.dataset.dirty === 'true';
                if (hasChanges) {
                    this.showConfirm({
                        title: 'Unsaved Changes',
                        message: 'You have unsaved changes. Are you sure you want to close?',
                        confirmText: 'Close Anyway',
                        cancelText: 'Keep Editing',
                        type: 'warning',
                        icon: 'warning'
                    }).then(confirmed => {
                        if (confirmed) {
                            modal.style.display = 'none';
                            modal.classList.remove('show');
                            this.clearCreateTaskForm();
                            delete modal.dataset.dirty;
                        }
                    });
                    return;
                }
            }
            
            // Standard modal close with smooth animation
            modal.style.display = 'none';
            modal.classList.remove('show');
            
            // Clear any form data if it's a create modal
            if (modalId === 'createTaskModal') {
                this.clearCreateTaskForm();
                delete modal.dataset.dirty;
            }
        }
    }

    // Enhanced task modal methods
    async openTaskDetails(taskId) {
        if (!taskId) return;
        
        // Find the task in our tasks array
        const task = window.taskManager.tasks.find(t => t.id === taskId);
        if (!task) {
            window.taskManager.showNotification('Task not found', 'error');
            return;
        }

        // Ensure users and sprints are loaded before opening modal
        if (!window.taskManager.users || window.taskManager.users.length === 0) {
            console.log('Loading users before opening task details modal...');
            await window.taskManager.loadUsers();
        }
        if (!window.taskManager.sprints || window.taskManager.sprints.length === 0) {
            console.log('Loading sprints before opening task details modal...');
            await window.taskManager.loadSprints();
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

        // Update header badges and title
        this.updateTaskHeader(task);

        // Populate assignee dropdown
        this.populateTaskDetailsDropdowns();

        // Set current assignees
        if (task.assignedTo) {
            const assignees = String(task.assignedTo).split(',').map(e => e.trim()).filter(Boolean);
            document.getElementById('detailTaskAssignee').value = task.assignedTo;
            
            // Check the appropriate checkboxes
            const dropdown = document.getElementById('detailTaskAssigneeDropdown');
            if (dropdown) {
                assignees.forEach(email => {
                    const checkbox = dropdown.querySelector(`input[value="${email}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }
            
            // Update display text
            const displayText = document.querySelector('[data-multiselect-id="detailTaskAssigneeMulti"] .multiselect-text');
            if (displayText) {
                displayText.textContent = assignees.length > 0 ? `${assignees.length} selected` : 'Select assignees';
            }
        }

        // Set current sprint
        if (task.sprintWeek) {
            document.getElementById('detailTaskSprint').value = task.sprintWeek;
        }

        // Store current task ID for saving
        window.taskManager.currentTaskId = taskId;

        // Show the modal
        this.showModal('taskDetailsModal');
        
        // Load activity and comments
        this.loadTaskActivity(taskId);
        this.loadTaskComments(taskId);
    }

    updateTaskHeader(task) {
        const taskIdBadge = document.getElementById('taskIdBadge');
        const taskStatusBadge = document.getElementById('taskStatusBadge');
        const taskPriorityBadge = document.getElementById('taskPriorityBadge');
        const taskTitle = document.getElementById('taskDetailsTitle');
        const taskAssigneeName = document.getElementById('taskAssigneeName');
        const taskSprintName = document.getElementById('taskSprintName');

        if (taskIdBadge) taskIdBadge.textContent = task.shortId || task.id || 'NEW';
        if (taskTitle) taskTitle.textContent = task.task || 'Task Details';
        
        if (taskStatusBadge) {
            taskStatusBadge.innerHTML = `
                <div class="status-indicator"></div>
                ${(task.status || 'NOT STARTED').toUpperCase()}
            `;
            taskStatusBadge.className = `status-badge status-${(task.status || 'not-started').toLowerCase().replace(/[^a-z]/g, '-')}`;
        }

        if (taskPriorityBadge) {
            taskPriorityBadge.textContent = `${task.priority || 'P2'} ${this.getPriorityLabel(task.priority)}`;
            taskPriorityBadge.className = `priority-badge priority-${(task.priority || 'p2').toLowerCase()}`;
        }

        if (taskAssigneeName) {
            const assignee = task.assignedTo ? this.getUserName(task.assignedTo) : 'Unassigned';
            taskAssigneeName.textContent = assignee;
        }

        if (taskSprintName) {
            taskSprintName.textContent = task.sprintWeek || 'No Sprint';
        }
    }

    getPriorityLabel(priority) {
        const labels = {
            'P0': 'CRITICAL',
            'P1': 'HIGH',
            'P2': 'MEDIUM',
            'Backlog': 'BACKLOG'
        };
        return labels[priority] || 'MEDIUM';
    }

    getUserName(email) {
        // Extract name from email or return email
        if (!email) return 'Unassigned';
        const name = email.split('@')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    populateTaskDetailsDropdowns() {
        console.log('populateTaskDetailsDropdowns called');
        // Populate assignee multi-select dropdown
        const assigneeDropdown = document.getElementById('detailTaskAssigneeDropdown');
        console.log('assigneeDropdown element:', assigneeDropdown);
        console.log('window.taskManager:', window.taskManager);
        console.log('window.taskManager.users:', window.taskManager?.users);
        
        if (assigneeDropdown && window.taskManager && window.taskManager.users) {
            console.log('Populating assignee dropdown with', window.taskManager.users.length, 'users');
            assigneeDropdown.innerHTML = '';
            window.taskManager.users.forEach(user => {
                const option = document.createElement('div');
                option.className = 'multiselect-option';
                option.dataset.value = user.email;
                option.innerHTML = `
                    <input type="checkbox" id="detail-assignee-${user.email.replace(/[@.]/g, '-')}" value="${user.email}">
                    <label for="detail-assignee-${user.email.replace(/[@.]/g, '-')}">${user.name || user.email}</label>
                `;
                assigneeDropdown.appendChild(option);
            });
            
            // Setup multi-select behavior for detail modal
            this.setupDetailAssigneeMultiSelect();
        } else {
            console.warn('Could not populate assignee dropdown:', {
                hasElement: !!assigneeDropdown,
                hasTaskManager: !!window.taskManager,
                hasUsers: !!(window.taskManager?.users),
                userCount: window.taskManager?.users?.length || 0
            });
        }

        // Populate sprint dropdown with current sprints at top
        const sprintSelect = document.getElementById('detailTaskSprint');
        if (sprintSelect && window.taskManager && window.taskManager.sprints) {
            sprintSelect.innerHTML = '<option value="">No Sprint</option>';
            
            // Separate current and non-current sprints
            const currentSprints = window.taskManager.sprints.filter(sprint => sprint.isCurrent);
            const otherSprints = window.taskManager.sprints.filter(sprint => !sprint.isCurrent);
            
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
    
    setupDetailAssigneeMultiSelect() {
        const modal = document.getElementById('taskDetailsModal');
        if (!modal) return;
        
        const multiselectDisplay = modal.querySelector('[data-multiselect-id="detailTaskAssigneeMulti"]');
        const dropdown = modal.querySelector('#detailTaskAssigneeDropdown');
        
        if (multiselectDisplay && dropdown) {
            // Toggle dropdown
            multiselectDisplay.removeEventListener('click', this.boundDetailAssigneeHandler);
            this.boundDetailAssigneeHandler = (event) => {
                event.stopPropagation();
                dropdown.classList.toggle('open');
                multiselectDisplay.classList.toggle('open');
            };
            multiselectDisplay.addEventListener('click', this.boundDetailAssigneeHandler);
            
            // Close dropdown when clicking outside
            const closeHandler = (event) => {
                const isClickInsideDropdown = dropdown.contains(event.target);
                const isClickInsideDisplay = multiselectDisplay.contains(event.target);
                
                if (!isClickInsideDropdown && !isClickInsideDisplay) {
                    dropdown.classList.remove('open');
                    multiselectDisplay.classList.remove('open');
                }
            };
            
            document.removeEventListener('click', closeHandler);
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
            }, 0);
            
            // Handle checkbox changes
            dropdown.removeEventListener('change', this.boundDetailAssigneeChangeHandler);
            this.boundDetailAssigneeChangeHandler = () => this.handleDetailAssigneeSelectionChange();
            dropdown.addEventListener('change', this.boundDetailAssigneeChangeHandler);
            
            // Close dropdown with ESC key
            const escHandler = (event) => {
                if (event.key === 'Escape' && dropdown.classList.contains('open')) {
                    event.stopPropagation(); // Prevent modal from closing when dropdown is open
                    dropdown.classList.remove('open');
                    multiselectDisplay.classList.remove('open');
                }
            };
            document.removeEventListener('keydown', escHandler);
            document.addEventListener('keydown', escHandler);
        }
    }
    
    handleDetailAssigneeSelectionChange() {
        const dropdown = document.getElementById('detailTaskAssigneeDropdown');
        const hiddenInput = document.getElementById('detailTaskAssignee');
        const displayText = document.querySelector('[data-multiselect-id="detailTaskAssigneeMulti"] .multiselect-text');
        
        if (!dropdown || !hiddenInput) return;
        
        const selected = Array.from(dropdown.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value)
            .filter(Boolean);
        
        hiddenInput.value = selected.join(',');
        
        if (displayText) {
            displayText.textContent = selected.length > 0 ? `${selected.length} selected` : 'Select assignees';
        }
    }

    async saveTaskDetails() {
        if (!window.taskManager.currentTaskId) return;
        const taskData = {
            task: document.getElementById('detailTaskTitle').value,
            status: document.getElementById('detailTaskStatus').value,
            priority: document.getElementById('detailTaskPriority').value,
            type: document.getElementById('detailTaskType').value,
            description: document.getElementById('detailTaskDescription').value,
            assignedTo: document.getElementById('detailTaskAssignee').value,
            sprintWeek: document.getElementById('detailTaskSprint').value,
            updatedAt: new Date().toISOString()
        };

        try {
            if (window.uiManager) {
                window.uiManager.showLoading();
            }
            const response = await api.updateTask(window.taskManager.currentTaskId, taskData);
            
            if (response && response.success) {
                // Update local task with the returned data
                const taskIndex = window.taskManager.tasks.findIndex(t => t.id === window.taskManager.currentTaskId);
                if (taskIndex !== -1) {
                    // Merge with server response data to ensure we have the complete updated task
                    window.taskManager.tasks[taskIndex] = { 
                        ...window.taskManager.tasks[taskIndex], 
                        ...response.data 
                    };
                }
                
                // Re-render board
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(window.taskManager.tasks);
                }
                
                if (window.uiManager) {
                    window.uiManager.showNotification('Task updated successfully!', 'success');
                }
                
                // Send Slack notification for task updates
                if (window.taskManager && window.taskManager.sendSlackTaskUpdate) {
                    try {
                        await window.taskManager.sendSlackTaskUpdate(window.taskManager.currentTaskId, taskData);
                    } catch (slackErr) {
                        console.warn('Failed to send Slack notification:', slackErr);
                    }
                }
                
                // Clear localStorage
                localStorage.removeItem('taskChanges');
                const modal = document.getElementById('taskDetailsModal');
                if (modal) {
                    delete modal.dataset.dirty;
                }
                
            } else {
                const errorMsg = response?.error || 'Failed to update task';
                if (window.uiManager) {
                    window.uiManager.showNotification('Failed to update task: ' + errorMsg, 'error');
                }
            }
        } catch (error) {
            console.error('Error updating task:', error);
            if (window.uiManager) {
                window.uiManager.showNotification('Error updating task: ' + error.message, 'error');
            }
        } finally {
            if (window.uiManager) {
                window.uiManager.hideLoading();
            }
        }
    }

    async loadTaskActivity(taskId) {
        const activityFeed = document.getElementById('taskActivityFeed');
        if (!activityFeed) return;
        try {
            // Prefer dedicated comments endpoint for freshness
            const [taskRes, commentsRes] = await Promise.all([
                api.getTask(taskId),
                api.getTaskComments(taskId)
            ]);
            const task = taskRes.data || {};
            const activities = Array.isArray(task.activities) ? task.activities : [];
            const render = (a) => {
                const avatar = (a.user || 'U').charAt(0).toUpperCase();
                const timeText = a.timestamp || '';
                const details = a.details ? `<div class="task-activity-changes">${a.details}</div>` : '';
                return `
                    <div class="task-activity-item">
                        <div class="task-activity-avatar">${avatar}</div>
                        <div class="task-activity-content">
                            <div class="task-activity-header">
                                <span class="task-activity-user">${a.user || 'User'}</span>
                                <span class="task-activity-time">${timeText}</span>
                            </div>
                            <div class="task-activity-action">${a.action}</div>
                            ${details}
                        </div>
                    </div>
                `;
            };
            activityFeed.innerHTML = activities.map(render).join('');
        } catch (err) {
            console.error('Failed to load activity:', err);
        }
    }

    async loadTaskComments(taskId) {
        const commentsFeed = document.getElementById('taskCommentsFeed');
        if (!commentsFeed) return;
        try {
            // Use dedicated endpoint so newest comments appear without reloading task
            const res = await api.getTaskComments(taskId, { limit: 100 });
            const comments = Array.isArray(res.data) ? res.data : [];
            const render = (c) => {
                const avatar = (c.user || 'U').charAt(0).toUpperCase();
                const sourceBadge = c.source === 'slack' ? '<span class="comment-source slack">Slack</span>' : '<span class="comment-source web">Dashboard</span>';
                const timeText = c.timestamp || '';
                return `
                    <div class="task-activity-item">
                        <div class="task-activity-avatar">${avatar}</div>
                        <div class="task-activity-content">
                            <div class="task-activity-header">
                                <span class="task-activity-user">${c.user || 'User'}</span>
                                ${sourceBadge}
                                <span class="task-activity-time">${timeText}</span>
                            </div>
                            <div class="task-activity-action">${(c.comment || '').replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                `;
            };
            commentsFeed.innerHTML = comments.map(render).join('');
            const commentCount = document.querySelector('.task-tab-button:last-child span');
            if (commentCount) {
                commentCount.textContent = comments.length;
            }
        } catch (err) {
            console.error('Failed to load comments:', err);
        }
    }

    // Tab switching functionality
    switchTaskTab(tabName) {
        // Remove active class from all tab buttons and panels
        document.querySelectorAll('.task-tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.task-tab-panel').forEach(panel => panel.classList.remove('active'));
        
        // Add active class to the matching tab button
        const targetBtn = document.querySelector(`.task-tab-button[data-tab="${tabName}"]`);
        if (targetBtn) targetBtn.classList.add('active');
        
        // Show corresponding panel
        const targetPanel = document.getElementById(`${tabName}-panel`);
        if (targetPanel) targetPanel.classList.add('active');
    }

    // Auto-save functionality
    autoSaveTask() {
        const formData = {
            title: document.getElementById('detailTaskTitle').value,
            status: document.getElementById('detailTaskStatus').value,
            priority: document.getElementById('detailTaskPriority').value,
            type: document.getElementById('detailTaskType').value,
            assignee: document.getElementById('detailTaskAssignee').value,
            sprint: document.getElementById('detailTaskSprint').value,
            description: document.getElementById('detailTaskDescription').value
        };
        
        // Save to localStorage (in real app, this would be an API call)
        localStorage.setItem('taskChanges', JSON.stringify(formData));
        
        // Update footer info
        const footerInfo = document.querySelector('#autoSaveStatus');
        if (footerInfo) {
            footerInfo.textContent = 'Auto-saved just now';
            setTimeout(() => {
                footerInfo.textContent = 'Auto-saved 2 minutes ago';
            }, 3000);
        }
    }

    updateStatusBadge(status) {
        const badge = document.querySelector('#taskStatusBadge');
        if (badge) {
            badge.innerHTML = `
                <div class="status-indicator"></div>
                ${status.toUpperCase()}
            `;
            badge.className = `status-badge status-${status.toLowerCase().replace(/[^a-z]/g, '-')}`;
        }
    }

    updatePriorityBadge(priority) {
        const badge = document.querySelector('#taskPriorityBadge');
        if (badge) {
            badge.textContent = priority + ' ' + this.getPriorityLabel(priority);
            badge.className = `priority-badge priority-${priority.toLowerCase()}`;
        }
    }

    // Comment functionality
    async addComment() {
        // Prevent duplicate submissions
        if (this.isAddingModalComment) {
            console.log('⚠️ Already adding modal comment, ignoring duplicate call');
            return;
        }

        const textarea = document.getElementById('taskCommentTextarea');
        const comment = textarea.value.trim();

        if (!comment) {
            window.taskManager.showNotification('Please enter a comment', 'error');
            return;
        }

        // Find and disable the comment button
        const commentBtn = document.querySelector('[data-action="addComment"]');
        const originalBtnText = commentBtn ? commentBtn.innerHTML : null;

        try {
            this.isAddingModalComment = true;
            
            // Disable button and show loading state
            if (commentBtn) {
                commentBtn.disabled = true;
                commentBtn.innerHTML = `
                    <svg class="task-btn-icon task-animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    Adding...
                `;
            }

            // Determine task ID - prefer router's currentTaskId as authoritative source
            const taskId = window.router.currentTaskId || window.taskManager.currentTaskId;
            if (!taskId) {
                window.taskManager.showNotification('No task selected', 'error');
                return;
            }

            // Get current user information
            const currentUser = window.authManager?.currentUser;
            if (!currentUser) {
                window.taskManager.showNotification('User not authenticated', 'error');
                return;
            }

            // Post to backend with proper user information
            const response = await api.addComment(taskId, comment, currentUser.name || currentUser.email, currentUser.email);

            if (response && response.success) {
                // Refresh comments from API to avoid duplicate rendering
                await this.loadTaskComments(taskId);
                // Reset input
                textarea.value = '';
                textarea.style.height = 'auto';
                window.taskManager.showNotification('Comment added successfully!', 'success');
            } else {
                window.taskManager.showNotification('Failed to add comment', 'error');
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            window.taskManager.showNotification('Failed to add comment', 'error');
        } finally {
            this.isAddingModalComment = false;
            
            // Re-enable button and restore original text
            if (commentBtn) {
                commentBtn.disabled = false;
                if (originalBtnText) {
                    commentBtn.innerHTML = originalBtnText;
                }
            }
        }
    }

    clearComment() {
        const textarea = document.getElementById('taskCommentTextarea');
        textarea.value = '';
        textarea.style.height = 'auto';
    }

    // Page comment functionality (for task detail page, not modal)
    async addPageComment() {
        // Prevent duplicate submissions
        if (this.isAddingPageComment) {
            return;
        }

        const textarea = document.getElementById('pageCommentTextarea');
        const comment = textarea.value.trim();

        if (!comment) {
            window.uiManager.showNotification('Please enter a comment', 'error');
            return;
        }

        // Find and disable the comment button
        const commentBtn = document.querySelector('[data-action="addPageComment"]');
        const originalBtnText = commentBtn ? commentBtn.innerHTML : null;

        try {
            this.isAddingPageComment = true;
            
            // Disable button and show loading state
            if (commentBtn) {
                commentBtn.disabled = true;
                commentBtn.innerHTML = `
                    <svg class="task-btn-icon task-animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    Adding...
                `;
            }

            // Use DB ID for API call if available
            const taskId = window.router.currentTaskDbId || window.router.currentTaskId;
            if (!taskId) {
                window.uiManager.showNotification('No task selected', 'error');
                return;
            }

            const currentUser = window.authManager?.currentUser;
            if (!currentUser) {
                window.uiManager.showNotification('User not authenticated', 'error');
                return;
            }

            const response = await api.addComment(taskId, comment, currentUser.name || currentUser.email, currentUser.email);

            if (response && response.success) {
                // Refresh comments on the page using DB ID
                await window.app.loadPageComments(taskId);
                // Reset input
                textarea.value = '';
                textarea.style.height = 'auto';
                window.uiManager.showNotification('Comment added successfully!', 'success');
            } else {
                throw new Error(response.error || 'Failed to add comment');
            }
        } catch (error) {
            console.error('Error adding page comment:', error);
            window.uiManager.showNotification('Failed to add comment', 'error');
        } finally {
            this.isAddingPageComment = false;
            
            // Re-enable button and restore original text
            if (commentBtn) {
                commentBtn.disabled = false;
                if (originalBtnText) {
                    commentBtn.innerHTML = originalBtnText;
                }
            }
        }
    }

    clearPageComment() {
        const textarea = document.getElementById('pageCommentTextarea');
        textarea.value = '';
        textarea.style.height = 'auto';
    }

    async deleteTask() {
        const confirmed = await this.showConfirm({
            title: 'Delete Task',
            message: 'Are you sure you want to delete this task? This action cannot be undone.',
            confirmText: 'Delete Task',
            cancelText: 'Cancel',
            type: 'danger',
            icon: 'delete'
        });
        
        if (confirmed) {
            const deleteBtn = document.querySelector('.task-btn-danger');
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = `
                <svg class="task-btn-icon task-animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                </svg>
                Deleting...
            `;
            
            setTimeout(() => {
                console.log('Task deleted');
                this.closeModal('taskDetailsModal');
            }, 1500);
        }
    }

    async closeTaskModal() {
        const modal = document.getElementById('taskDetailsModal');
        if (modal) {
            // Check for unsaved changes
            const hasChanges = modal.dataset.dirty === 'true' || localStorage.getItem('taskChanges');
            if (hasChanges) {
                const confirmed = await this.showConfirm({
                    title: 'Unsaved Changes',
                    message: 'You have unsaved changes. Are you sure you want to close?',
                    confirmText: 'Close Anyway',
                    cancelText: 'Keep Editing',
                    type: 'warning',
                    icon: 'warning'
                });
                
                if (!confirmed) {
                    return;
                }
            }
            
            // Add close animation
            const modalContainer = modal.querySelector('.task-modal-container');
            if (modalContainer) {
                modalContainer.style.animation = 'modalSlideOut 0.4s ease forwards';
                setTimeout(() => {
                    modal.style.display = 'none';
                    modal.classList.remove('show');
                    localStorage.removeItem('taskChanges');
                    delete modal.dataset.dirty;
                    // Reset animation
                    modalContainer.style.animation = '';
                }, 400);
            } else {
                // Fallback if no container found
                modal.style.display = 'none';
                modal.classList.remove('show');
                localStorage.removeItem('taskChanges');
                delete modal.dataset.dirty;
            }
        }
    }

    setupAssigneeMultiSelect() {
        const assigneeContainer = document.querySelector('.task-assignee-multiselect');
        const assigneeDisplay = assigneeContainer?.querySelector('[data-multiselect-id="taskAssigneeMulti"]');
        const assigneeDropdown = document.getElementById('taskAssigneeDropdown');
        const hiddenAssigneeInput = document.getElementById('taskAssignee');
        
        if (!assigneeDisplay || !assigneeDropdown || !assigneeContainer) {
            console.log('setupAssigneeMultiSelect: missing elements', {
                assigneeDisplay: !!assigneeDisplay,
                assigneeDropdown: !!assigneeDropdown,
                assigneeContainer: !!assigneeContainer
            });
            return;
        }
        
        // Populate assignee options
        const populateAssignees = () => {
            if (!window.taskManager || !window.taskManager.users) {
                console.log('setupAssigneeMultiSelect: no users available', {
                    taskManager: !!window.taskManager,
                    users: window.taskManager?.users?.length || 0
                });
                // Show a message in the dropdown when no users are available
                assigneeDropdown.innerHTML = '<div class="multiselect-option disabled">No users available</div>';
                return;
            }
            
            console.log('Populating assignees:', window.taskManager.users.length, 'users');
            
            assigneeDropdown.innerHTML = window.taskManager.users.map(user => `
                <div class="multiselect-option" data-value="${user.email}">
                    <input type="checkbox" id="assignee-${user.email.replace(/[^a-zA-Z0-9]/g, '-')}" data-assignee-checkbox>
                    <label for="assignee-${user.email.replace(/[^a-zA-Z0-9]/g, '-')}">${user.name || user.email}</label>
                </div>
            `).join('');
        };
        
        // Toggle dropdown
        assigneeDisplay.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            // Close other multiselect dropdowns first
            document.querySelectorAll('.multiselect-container').forEach(container => {
                if (container !== assigneeContainer) {
                    container.classList.remove('open');
                }
            });
            
            // Toggle current dropdown using consistent pattern
            assigneeContainer.classList.toggle('open');
            
            // Populate when opening
            if (assigneeContainer.classList.contains('open')) {
                // Ensure users are loaded before populating
                if (!window.taskManager.users || window.taskManager.users.length === 0) {
                    console.log('Loading users for assignee dropdown...');
                    await window.taskManager.loadUsers();
                }
                populateAssignees();
            }
        });
        
        // Handle checkbox changes
        assigneeDropdown.addEventListener('change', (e) => {
            if (e.target.dataset.assigneeCheckbox !== undefined) {
                this.updateAssigneeSelection();
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.task-assignee-multiselect')) {
                assigneeContainer.classList.remove('open');
            }
        });
        
        // Close dropdown with ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && assigneeContainer.classList.contains('open')) {
                e.stopPropagation(); // Prevent modal from closing when dropdown is open
                assigneeContainer.classList.remove('open');
            }
        });
    }
    
    updateAssigneeSelection() {
        const checkboxes = document.querySelectorAll('#taskAssigneeDropdown [data-assignee-checkbox]:checked');
        const selectedEmails = Array.from(checkboxes).map(cb => cb.closest('.multiselect-option').dataset.value);
        const selectedNames = Array.from(checkboxes).map(cb => cb.nextElementSibling.textContent);
        
        console.log('updateAssigneeSelection:', {
            checkboxes: checkboxes.length,
            selectedEmails,
            selectedNames
        });
        
        // Update display text
        const displayText = selectedNames.length > 0 ? 
            (selectedNames.length === 1 ? selectedNames[0] : `${selectedNames.length} assignees`) :
            'Select assignees';
        
        const multiselctText = document.querySelector('[data-multiselect-id="taskAssigneeMulti"] .multiselect-text');
        if (multiselctText) {
            multiselctText.textContent = displayText;
        }
        
        // Update hidden input
        const hiddenInput = document.getElementById('taskAssignee');
        if (hiddenInput) {
            hiddenInput.value = selectedEmails.join(',');
        }
        
        console.log('Updated assignee display:', displayText, 'Hidden input value:', hiddenInput?.value);
    }

    setupCreateTaskModalDynamics() {
        const titleInput = document.getElementById('taskTitle');
        const statusSelect = document.getElementById('taskStatus');
        const prioritySelect = document.getElementById('taskPriority');
        
        if (titleInput || statusSelect || prioritySelect) {
            const updateCreateTaskHeader = () => {
                const title = titleInput?.value || 'Create New Task';
                const status = statusSelect?.value || 'Not started';
                const priority = prioritySelect?.value || 'P2';
                
                // Update header title
                const headerTitle = document.querySelector('#createTaskModal .task-title');
                if (headerTitle) {
                    headerTitle.textContent = title;
                }
                
                // Update status badge
                const statusBadge = document.querySelector('#createTaskModal .status-badge');
                if (statusBadge) {
                    statusBadge.innerHTML = `
                        <div class="status-indicator"></div>
                        ${status.toUpperCase()}
                    `;
                    statusBadge.className = `status-badge status-${status.toLowerCase().replace(/[^a-z]/g, '-')}`;
                }
                
                // Update priority badge
                const priorityBadge = document.querySelector('#createTaskModal .priority-badge');
                if (priorityBadge) {
                    priorityBadge.textContent = `${priority} ${this.getPriorityLabel(priority)}`;
                    priorityBadge.className = `priority-badge priority-${priority.toLowerCase()}`;
                }
            };
            
            // Add event listeners for dynamic updates
            if (titleInput) titleInput.addEventListener('input', updateCreateTaskHeader);
            if (statusSelect) statusSelect.addEventListener('change', updateCreateTaskHeader);
            if (prioritySelect) prioritySelect.addEventListener('change', updateCreateTaskHeader);
        }
    }

    // Sprint modal dynamics
    setupSprintModalDynamics() {
        const startDateInput = document.getElementById('sprintStartDate');
        const endDateInput = document.getElementById('sprintEndDate');
        const durationInput = document.getElementById('sprintDuration');

        if (startDateInput && endDateInput && durationInput) {
            const updateDuration = () => {
                const start = new Date(startDateInput.value);
                const end = new Date(endDateInput.value);
                
                if (start && end && start < end) {
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    durationInput.value = diffDays + ' days';
                }
            };

            startDateInput.addEventListener('change', updateDuration);
            endDateInput.addEventListener('change', updateDuration);
        }
    }
    
    // Helper method to check for unsaved form changes
    hasUnsavedFormChanges(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;
        
        const inputs = modal.querySelectorAll('input, textarea, select');
        for (const input of inputs) {
            if (input.type === 'text' || input.type === 'email' || input.tagName === 'TEXTAREA') {
                if (input.value.trim() !== '') {
                    return true;
                }
            } else if (input.tagName === 'SELECT') {
                if (input.selectedIndex > 0) { // Assuming first option is default/empty
                    return true;
                }
            }
        }
        return false;
    }
    
    // Helper method to clear create task form
    clearCreateTaskForm() {
        const form = document.getElementById('createTaskForm');
        if (form) {
            form.reset();
            
            // Clear any dynamic content
            const assigneeDisplay = form.querySelector('.multiselect-text');
            if (assigneeDisplay) {
                assigneeDisplay.textContent = 'Select assignees';
            }
            
            // Clear hidden assignee input
            const hiddenAssigneeInput = document.getElementById('taskAssignee');
            if (hiddenAssigneeInput) {
                hiddenAssigneeInput.value = '';
            }
            
            // Reset sprint dropdown to default
            const sprintSelect = document.getElementById('taskSprint');
            if (sprintSelect) {
                sprintSelect.value = '';
            }
            
            // Reset header display to defaults
            const titleElement = form.closest('.task-modal-overlay')?.querySelector('.task-title');
            if (titleElement) {
                titleElement.textContent = 'Create New Task';
            }
            
            // Re-populate dropdowns to ensure they have latest data
            this.refreshCreateTaskDropdowns();
        }
    }

    validateCreateTaskForm() {
        const title = document.getElementById('taskTitle');
        const priority = document.getElementById('taskPriority');
        const type = document.getElementById('taskType');

        if (!title?.value?.trim()) {
            window.uiManager?.showNotification('Task title is required.', 'error');
            title?.focus();
            return false;
        }

        if (!priority?.value) {
            window.uiManager?.showNotification('Task priority is required.', 'error');
            priority?.focus();
            return false;
        }

        if (!type?.value) {
            window.uiManager?.showNotification('Task type is required.', 'error');
            type?.focus();
            return false;
        }

        return true;
    }

    validateTaskDetailForm() {
        const title = document.getElementById('detailTaskTitle');
        const status = document.getElementById('detailTaskStatus');
        const priority = document.getElementById('detailTaskPriority');
        const type = document.getElementById('detailTaskType');

        if (!title?.value?.trim()) {
            window.uiManager?.showNotification('Task title is required.', 'error');
            title?.focus();
            return false;
        }

        if (!status?.value) {
            window.uiManager?.showNotification('Task status is required.', 'error');
            status?.focus();
            return false;
        }

        if (!priority?.value) {
            window.uiManager?.showNotification('Task priority is required.', 'error');
            priority?.focus();
            return false;
        }

        if (!type?.value) {
            window.uiManager?.showNotification('Task type is required.', 'error');
            type?.focus();
            return false;
        }

        return true;
    }

    generateUserPassword() {
        const passwordField = document.getElementById('userPassword');
        if (!passwordField) return;
        
        // Generate a secure random password
        const length = 16;
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        const values = new Uint32Array(length);
        window.crypto.getRandomValues(values);
        
        for (let i = 0; i < length; i++) {
            password += charset[values[i] % charset.length];
        }
        
        passwordField.value = password;
        passwordField.removeAttribute('readonly');
        
        if (window.uiManager) {
            window.uiManager.showNotification('Password generated successfully!', 'success');
        }
    }

    async copyUserPassword() {
        const passwordField = document.getElementById('userPassword');
        if (!passwordField || !passwordField.value) {
            if (window.uiManager) {
                window.uiManager.showNotification('No password to copy. Generate one first.', 'error');
            }
            return;
        }
        
        try {
            await navigator.clipboard.writeText(passwordField.value);
            if (window.uiManager) {
                window.uiManager.showNotification('Password copied to clipboard!', 'success');
            }
        } catch (err) {
            console.error('Failed to copy password:', err);
            // Fallback for older browsers
            passwordField.select();
            document.execCommand('copy');
            if (window.uiManager) {
                window.uiManager.showNotification('Password copied to clipboard!', 'success');
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
} else {
    window.ModalManager = ModalManager;
} 