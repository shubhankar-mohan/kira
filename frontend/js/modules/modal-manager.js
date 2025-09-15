// Modal Manager Module - Handles all modal operations
class ModalManager {
    constructor() {
        this.setupModalListeners();
        this.setupTaskModalEnhancements();
    }

    setupModalListeners() {
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
            const action = e.target.dataset.action;
            // Support elements with data-action on ancestors (e.g., icons inside buttons)
            const clickable = action ? e.target : e.target.closest('[data-action]');
            const resolvedAction = action || clickable?.dataset.action;
            if (action) {
                this.handleAction(action, e);
            } else if (clickable && resolvedAction) {
                this.handleAction(resolvedAction, { ...e, target: clickable });
            }
        });
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

    handleAction(action, event) {
        const sprintId = event.target.dataset.sprintId;
        const page = event.target.dataset.page || event.target.closest('[data-page]')?.dataset.page;
        
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
                this.saveTaskDetails();
                break;
            case 'createTask':
                window.taskManager.createTask();
                break;
            case 'createUser':
                if (window.uiManager) {
                    window.uiManager.createUser();
                }
                break;
            case 'createSprint':
                window.sprintManager.createSprint();
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
                this.addComment();
                break;
            case 'clearComment':
                this.clearComment();
                break;
            case 'deleteTask':
                this.deleteTask();
                break;
            case 'closeTaskModal':
                this.closeTaskModal();
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
                const userIdToDelete = event.target.dataset.userId;
                if (userIdToDelete) {
                    this.deleteUser(userIdToDelete);
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
            const response = await api.updateSprint(sprint.sprintWeek || sprint.name, { 
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

        const userData = {
            name: document.getElementById('userDetailName').value,
            email: document.getElementById('userDetailEmail').value,
            role: document.getElementById('userDetailRole').value,
            slackName: document.getElementById('userDetailSlackName').value,
            slackId: document.getElementById('userDetailSlackId').value,
            status: document.getElementById('userDetailStatus').value
        };

        try {
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
            window.uiManager.hideLoading();
        }
    }

    async deleteUser(userId) {
        if (!userId || !confirm('Are you sure you want to delete this user?')) return;

        try {
            window.uiManager.showLoading();
            const response = await api.deleteUser(userId);
            
            if (response.success) {
                // Remove from local data
                window.taskManager.users = window.taskManager.users.filter(u => (u.id || u.email) !== userId);
                
                window.uiManager.showNotification('User deleted successfully!', 'success');
                this.closeModal('userDetailsModal');
                
                // Re-render users
                window.uiManager.renderUsers();
            } else {
                window.uiManager.showNotification('Failed to delete user: ' + response.error, 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            window.uiManager.showNotification('Failed to delete user', 'error');
        } finally {
            window.uiManager.hideLoading();
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

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Reset any previous animations
            const modalContainer = modal.querySelector('.task-modal-container');
            if (modalContainer) {
                modalContainer.style.animation = '';
            }
            
            modal.style.display = 'flex';
            modal.classList.add('show');
            
            // Special handling for create task modal
            if (modalId === 'createTaskModal') {
                // Re-populate dropdowns with latest data
                this.refreshCreateTaskDropdowns();
                // Ensure body exists/visible
                const body = modal.querySelector('.task-modal-body');
                if (body) body.style.display = '';
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
                        if (window.modalManager) window.modalManager.saveTaskDetails();
                    });
                    footer.appendChild(btn);
                }
            }
            
            // Focus first input in modal
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }
    }
    
    // Method to refresh all dropdowns in create task modal
    refreshCreateTaskDropdowns() {
        this.refreshAssigneeDropdown();
        this.refreshSprintDropdown();
    }
    
    // Method to refresh assignee dropdown data
    refreshAssigneeDropdown() {
        const assigneeDropdown = document.getElementById('taskAssigneeDropdown');
        if (!assigneeDropdown) return;
        
        if (!window.taskManager || !window.taskManager.users) {
            console.log('refreshAssigneeDropdown: no users available', {
                taskManager: !!window.taskManager,
                users: window.taskManager?.users?.length || 0
            });
            assigneeDropdown.innerHTML = '<div class="multiselect-option disabled">No users available</div>';
            return;
        }
        
        console.log('refreshAssigneeDropdown: populating', window.taskManager.users.length, 'users');
        
        assigneeDropdown.innerHTML = window.taskManager.users.map(user => `
            <div class="multiselect-option" data-value="${user.email}">
                <input type="checkbox" id="assignee-${user.email.replace(/[^a-zA-Z0-9]/g, '-')}" data-assignee-checkbox>
                <label for="assignee-${user.email.replace(/[^a-zA-Z0-9]/g, '-')}">${user.name || user.email}</label>
            </div>
        `).join('');
    }
    
    // Method to refresh sprint dropdown data
    refreshSprintDropdown() {
        const sprintSelect = document.getElementById('taskSprint');
        if (!sprintSelect) return;
        
        if (!window.taskManager || !window.taskManager.sprints) {
            console.log('refreshSprintDropdown: no sprints available', {
                taskManager: !!window.taskManager,
                sprints: window.taskManager?.sprints?.length || 0
            });
            sprintSelect.innerHTML = '<option value="">No Sprint</option><option disabled>No sprints available</option>';
            return;
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

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Handle task modal specially
            if (modalId === 'taskDetailsModal') {
                this.closeTaskModal();
                return;
            }
            
            // Check for unsaved changes in create task modal
            if (modalId === 'createTaskModal') {
                const hasChanges = this.hasUnsavedFormChanges(modalId) || modal.dataset.dirty === 'true';
                if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to close?')) {
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
    openTaskDetails(taskId) {
        if (!taskId) return;
        
        // Find the task in our tasks array
        const task = window.taskManager.tasks.find(t => t.id === taskId);
        if (!task) {
            window.taskManager.showNotification('Task not found', 'error');
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

        // Update header badges and title
        this.updateTaskHeader(task);

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

        if (taskIdBadge) taskIdBadge.textContent = task.id || 'NEW';
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
        // Populate assignee dropdown
        const assigneeSelect = document.getElementById('detailTaskAssignee');
        if (assigneeSelect && window.taskManager && window.taskManager.users) {
            assigneeSelect.innerHTML = '<option value="">Select assignee</option>';
            window.taskManager.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = user.name || user.email;
                assigneeSelect.appendChild(option);
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

    async saveTaskDetails() {
        if (!window.taskManager.currentTaskId) return;

        const saveBtn = document.querySelector('.task-btn-primary');
        const originalContent = saveBtn.innerHTML;
        
        // Show loading state
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
            <svg class="task-btn-icon task-animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="m9 12 2 2 4-4"></path>
            </svg>
            Saving...
        `;

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
            window.taskManager.showLoading();
            const response = await api.updateTask(window.taskManager.currentTaskId, taskData);
            
            if (response.success) {
                // Update local task
                const taskIndex = window.taskManager.tasks.findIndex(t => t.id === window.taskManager.currentTaskId);
                if (taskIndex !== -1) {
                    window.taskManager.tasks[taskIndex] = { ...window.taskManager.tasks[taskIndex], ...taskData };
                }
                
                // Re-render board
                if (window.taskBoardManager) {
                    window.taskBoardManager.renderTasks(window.taskManager.tasks);
                }
                
                // Show success state
                saveBtn.innerHTML = `
                    <svg class="task-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="m9 12 2 2 4-4"></path>
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    Saved!
                `;
                saveBtn.style.background = 'var(--success)';
                
                // Reset button after delay
                setTimeout(() => {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalContent;
                    saveBtn.style.background = '';
                }, 2000);
                
                window.taskManager.showNotification('Task updated successfully!', 'success');
                
                // Send Slack notification for task updates
                await window.taskManager.sendSlackTaskUpdate(window.taskManager.currentTaskId, taskData);
                
                // Clear localStorage
                localStorage.removeItem('taskChanges');
                const modal = document.getElementById('taskDetailsModal');
                if (modal) {
                    delete modal.dataset.dirty;
                }
                
            } else {
                window.taskManager.showNotification('Failed to update task: ' + response.error, 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalContent;
            }
        } catch (error) {
            console.error('Error updating task:', error);
            window.taskManager.showNotification('Error updating task', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalContent;
        }
    }

    async loadTaskActivity(taskId) {
        const activityFeed = document.getElementById('taskActivityFeed');
        if (!activityFeed) return;
        try {
            const res = await api.getTask(taskId);
            const task = res.data || {};
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
            const res = await api.getTask(taskId);
            const task = res.data || {};
            const comments = Array.isArray(task.comments) ? task.comments : [];
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
        
        // Add active class to clicked tab button
        event.target.classList.add('active');
        
        // Show corresponding panel
        document.getElementById(tabName + '-panel').classList.add('active');
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
        const textarea = document.getElementById('taskCommentTextarea');
        const comment = textarea.value.trim();
        
        if (!comment) {
            window.taskManager.showNotification('Please enter a comment', 'error');
            return;
        }

        try {
            // Determine task ID
            const taskId = window.taskManager.currentTaskId || window.router.currentTaskId;
            if (!taskId) {
                window.taskManager.showNotification('No task selected', 'error');
                return;
            }

            // Post to backend
            const userName = window.authManager?.currentUser?.name || 'Anonymous';
            const response = await api.addComment(taskId, comment, userName);

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
        }
    }

    clearComment() {
        const textarea = document.getElementById('taskCommentTextarea');
        textarea.value = '';
        textarea.style.height = 'auto';
    }

    deleteTask() {
        if (confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
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

    closeTaskModal() {
        const modal = document.getElementById('taskDetailsModal');
        if (modal) {
            // Check for unsaved changes
            const hasChanges = modal.dataset.dirty === 'true' || localStorage.getItem('taskChanges');
            if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to close?')) {
                return;
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
        assigneeDisplay.addEventListener('click', (e) => {
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
} else {
    window.ModalManager = ModalManager;
} 