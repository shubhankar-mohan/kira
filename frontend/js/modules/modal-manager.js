// Modal Manager Module - Handles all modal operations
class ModalManager {
    constructor() {
        this.setupModalListeners();
    }

    setupModalListeners() {
        // Modal close events
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Form submissions
        this.setupFormSubmissions();
    }

    setupFormSubmissions() {
        // Create task form
        const createTaskForm = document.getElementById('createTaskForm');
        if (createTaskForm) {
            createTaskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                window.taskManager.createTask();
            });
        }

        // Create sprint form
        const createSprintForm = document.getElementById('createSprintForm');
        if (createSprintForm) {
            createSprintForm.addEventListener('submit', (e) => {
                e.preventDefault();
                window.taskManager.createSprint();
            });
        }

        // Create user form
        const createUserForm = document.getElementById('createUserForm');
        if (createUserForm) {
            createUserForm.addEventListener('submit', (e) => {
                e.preventDefault();
                window.taskManager.createUser();
            });
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('show');
            
            // Setup dynamic sprint statistics
            if (modalId === 'createSprintModal') {
                this.setupSprintModalDynamics();
            }
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    }

    setupSprintModalDynamics() {
        // Update team members count
        const teamMembersElement = document.getElementById('teamMembers');
        if (teamMembersElement) {
            teamMembersElement.textContent = window.taskManager.users.length || 0;
        }

        // Update available tasks count (unassigned to sprints)
        const availableTasksElement = document.getElementById('availableTasks');
        if (availableTasksElement) {
            const unassignedTasks = window.taskManager.tasks.filter(task => !task.sprintWeek || task.sprintWeek === '').length;
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
        window.taskManager.currentTaskId = taskId;

        // Show the modal
        this.showModal('taskDetailsModal');
    }

    populateTaskDetailsDropdowns() {
        // Populate assignee dropdown
        const assigneeSelect = document.getElementById('detailTaskAssignee');
        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="">Select assignee</option>';
            window.taskManager.users.forEach(user => {
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
            window.taskManager.sprints.forEach(sprint => {
                const option = document.createElement('option');
                option.value = sprint.name;
                option.textContent = sprint.name;
                sprintSelect.appendChild(option);
            });
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
            sprintWeek: document.getElementById('detailTaskSprint').value
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
                
                window.taskManager.showNotification('Task updated successfully!', 'success');
                this.closeModal('taskDetailsModal');
                
                // Send Slack notification for task updates
                await window.taskManager.sendSlackTaskUpdate(window.taskManager.currentTaskId, taskData);
            } else {
                window.taskManager.showNotification('Failed to update task: ' + response.error, 'error');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            window.taskManager.showNotification('Failed to update task', 'error');
        } finally {
            window.taskManager.hideLoading();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
} 