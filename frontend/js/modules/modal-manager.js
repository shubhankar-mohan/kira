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
                this.closeModal(e.target.id);
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.show, .task-modal-overlay');
                if (openModal) {
                    this.closeModal(openModal.id);
                }
            }
        });

        // Handle modal close buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal-close, .task-modal-close')) {
                e.preventDefault();
                e.stopPropagation();
                const modal = e.target.closest('.modal, .task-modal-overlay');
                if (modal) {
                    this.closeModal(modal.id);
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
            if (action) {
                this.handleAction(action, e);
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
                saveTimeout = setTimeout(() => this.autoSaveTask(), 2000);
            });
        });

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
        switch (action) {
            case 'showCreateTaskModal':
                this.showModal('createTaskModal');
                break;
            case 'showCreateUserModal':
                this.showModal('createUserModal');
                break;
            case 'showCreateSprintModal':
                this.showModal('createSprintModal');
                break;
            case 'saveTaskDetails':
                this.saveTaskDetails();
                break;
            case 'createTask':
                window.taskManager.createTask();
                break;
            case 'createUser':
                window.userManager.createUser();
                break;
            case 'createSprint':
                window.sprintManager.createSprint();
                break;
            case 'syncData':
                window.taskManager.syncData();
                break;
        }
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
            
            // Focus first input in modal
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Check for unsaved changes in task modal
            if (modalId === 'taskDetailsModal') {
                const hasChanges = localStorage.getItem('taskChanges');
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
                        // Reset animation
                        modalContainer.style.animation = '';
                    }, 400);
                    return;
                }
            }
            
            modal.style.display = 'none';
            modal.classList.remove('show');
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
        if (assigneeSelect && window.userManager && window.userManager.users) {
            assigneeSelect.innerHTML = '<option value="">Select assignee</option>';
            window.userManager.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = user.name || user.email;
                assigneeSelect.appendChild(option);
            });
        }

        // Populate sprint dropdown
        const sprintSelect = document.getElementById('detailTaskSprint');
        if (sprintSelect && window.sprintManager && window.sprintManager.sprints) {
            sprintSelect.innerHTML = '<option value="">No Sprint</option>';
            window.sprintManager.sprints.forEach(sprint => {
                const option = document.createElement('option');
                option.value = sprint.week;
                option.textContent = `${sprint.week} - ${sprint.name}`;
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

    loadTaskActivity(taskId) {
        const activityFeed = document.getElementById('taskActivityFeed');
        if (!activityFeed) return;

        // Mock activity data - in real app, this would come from API
        const activities = [
            {
                user: 'Shubhankar',
                action: 'Changed status from Not Started to In Progress',
                time: '2 hours ago',
                avatar: 'S'
            },
            {
                user: 'Omkar Salapurkar',
                action: 'Updated task description and added acceptance criteria',
                time: '1 day ago',
                avatar: 'O',
                changes: 'Added detailed acceptance criteria including BigQuery setup, data transformation, and monitoring requirements.'
            }
        ];

        activityFeed.innerHTML = activities.map(activity => `
            <div class="task-activity-item">
                <div class="task-activity-avatar">${activity.avatar}</div>
                <div class="task-activity-content">
                    <div class="task-activity-header">
                        <span class="task-activity-user">${activity.user}</span>
                        <span class="task-activity-time">${activity.time}</span>
                    </div>
                    <div class="task-activity-action">${activity.action}</div>
                    ${activity.changes ? `<div class="task-activity-changes">${activity.changes}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    loadTaskComments(taskId) {
        const commentsFeed = document.getElementById('taskCommentsFeed');
        if (!commentsFeed) return;

        // Mock comments data - in real app, this would come from API
        const comments = [
            {
                user: 'Omkar Salapurkar',
                comment: 'Good progress on this! Make sure to test the data transformation logic thoroughly before pushing to production.',
                time: '4 hours ago',
                avatar: 'O'
            },
            {
                user: 'Shubhankar',
                comment: 'Started working on the BigQuery connection setup. Should have the basic pipeline ready by end of day.',
                time: '1 day ago',
                avatar: 'S'
            }
        ];

        commentsFeed.innerHTML = comments.map(comment => `
            <div class="task-activity-item">
                <div class="task-activity-avatar">${comment.avatar}</div>
                <div class="task-activity-content">
                    <div class="task-activity-header">
                        <span class="task-activity-user">${comment.user}</span>
                        <span class="task-activity-time">${comment.time}</span>
                    </div>
                    <div class="task-activity-action">${comment.comment}</div>
                </div>
            </div>
        `).join('');

        // Update comment count
        const commentCount = document.querySelector('.task-tab-button:last-child span');
        if (commentCount) {
            commentCount.textContent = comments.length;
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
    addComment() {
        const textarea = document.getElementById('taskCommentTextarea');
        const comment = textarea.value.trim();
        
        if (!comment) {
            window.taskManager.showNotification('Please enter a comment', 'error');
            return;
        }

        // Add comment to feed
        const commentsFeed = document.getElementById('taskCommentsFeed');
        const currentUser = window.authManager.currentUser;
        const avatar = currentUser ? currentUser.name.charAt(0).toUpperCase() : 'U';
        const userName = currentUser ? currentUser.name : 'User';

        const commentHtml = `
            <div class="task-activity-item">
                <div class="task-activity-avatar">${avatar}</div>
                <div class="task-activity-content">
                    <div class="task-activity-header">
                        <span class="task-activity-user">${userName}</span>
                        <span class="task-activity-time">Just now</span>
                    </div>
                    <div class="task-activity-action">${comment}</div>
                </div>
            </div>
        `;

        commentsFeed.insertAdjacentHTML('afterbegin', commentHtml);
        
        // Clear textarea
        textarea.value = '';
        textarea.style.height = 'auto';
        
        // Update comment count
        const commentCount = document.querySelector('.task-tab-button:last-child span');
        if (commentCount) {
            const currentCount = parseInt(commentCount.textContent) || 0;
            commentCount.textContent = currentCount + 1;
        }

        window.taskManager.showNotification('Comment added successfully!', 'success');
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
            // Reset any animations
            const modalContainer = modal.querySelector('.task-modal-container');
            if (modalContainer) {
                modalContainer.style.animation = '';
            }
            
            // Ensure modal is completely hidden
            modal.style.display = 'none';
            modal.classList.remove('show');
            
            // Clear any stored changes
            localStorage.removeItem('taskChanges');
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
} else {
    window.ModalManager = ModalManager;
} 