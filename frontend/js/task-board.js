/* 
🏪 KiranaClub Task Manager - Task Board JavaScript
Professional task board with expand/collapse functionality
*/

// Task Board Manager
class TaskBoardManager {
    constructor() {
        this.boardContainer = document.getElementById('boardContainer');
        this.statusConfig = [
            { key: 'Not started', label: 'NOT STARTED', class: 'todo' },
            { key: 'In progress', label: 'IN PROGRESS', class: 'in-progress' },
            { key: 'Dev Testing', label: 'DEV TESTING', class: 'dev-testing' },
            { key: 'Product Testing', label: 'PRODUCT TESTING', class: 'product-testing' },
            { key: 'Awaiting Release', label: 'AWAITING RELEASE', class: 'awaiting-release' },
            { key: 'Done', label: 'DONE', class: 'done' },
            { key: 'Blocked - Product', label: 'BLOCKED (PRODUCT)', class: 'blocked' },
            { key: 'Blocked - Engineering', label: 'BLOCKED (ENGINEERING)', class: 'blocked' }
        ];
        this.allTasks = [];
        this.filteredTasks = [];
        this.activeFilters = {
            sprint: ['current'], // Default to current sprint filter
            assignee: [],
            assignedBy: [],
            priority: [],
            currentSprintOnly: false
        };
        this.pagination = {
            page: 1,
            pageSize: 20,
            total: 0,
            hasNext: false,
            hasPrev: false
        };
        this.bulkSelection = new Set();
        this.pageSizeOptions = [10, 20, 50, 100];
        this.init();
    }

    onTasksLoaded(tasks = [], pagination = {}) {
        this.allTasks = tasks;
        this.pagination = {
            ...this.pagination,
            ...pagination
        };
        this.applyFilters({ skipServer: true });
        this.updatePaginationControls();
        this.updateBulkSelectionState();
    }

    init() {
        this.setupHorizontalScrolling();
        this.setupExpandFunctionality();
        this.setupDragAndDrop();
        this.setupSearch();
    }

    setupSearch() {
        const searchBox = document.getElementById('taskSearchBox');
        if (searchBox) {
            searchBox.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.applyFilters();
            });
        }
    }

    // Setup horizontal scrolling for the board
    setupHorizontalScrolling() {
        if (!this.boardContainer) return;

        let isScrolling = false;
        let scrollTimeout;
        let lastScrollTime = 0;

        this.boardContainer.addEventListener('wheel', (e) => {
            // Prevent interference with page scrolling
            const now = Date.now();
            if (now - lastScrollTime < 50) {
                return; // Throttle rapid scroll events
            }
            lastScrollTime = now;

            // Only handle scroll when the board container is the target
            if (e.currentTarget === this.boardContainer) {
                // Detect scroll direction and magnitude
                const deltaX = Math.abs(e.deltaX);
                const deltaY = Math.abs(e.deltaY);
                
                // Determine if this is a horizontal scroll gesture
                const isHorizontalGesture = deltaX > deltaY && deltaX > 5;
                const isTrackpadVerticalGesture = deltaY > 5 && deltaX === 0;
                
                // Only handle if it's clearly a horizontal gesture or trackpad vertical
                if (isHorizontalGesture || isTrackpadVerticalGesture) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Calculate scroll amount
                    let scrollAmount = 0;
                    if (isHorizontalGesture) {
                        scrollAmount = e.deltaX;
                    } else if (isTrackpadVerticalGesture) {
                        // Convert vertical trackpad scroll to horizontal
                        scrollAmount = e.deltaY;
                    }
                    
                    // Apply smooth scrolling
                    this.boardContainer.scrollLeft += scrollAmount;
                    
                    // Set scrolling state
                    isScrolling = true;
                    clearTimeout(scrollTimeout);
                    
                    // Reset scrolling state after delay
                    scrollTimeout = setTimeout(() => {
                        isScrolling = false;
                    }, 200);
                }
            }
        }, { passive: false });

        // Enhanced touch handling for mobile devices
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let isTouchScrolling = false;
        let touchScrollDirection = null;
        let initialScrollLeft = 0;

        this.boardContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                isTouchScrolling = false;
                touchScrollDirection = null;
                initialScrollLeft = this.boardContainer.scrollLeft;
            }
        }, { passive: true });

        this.boardContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const touchX = e.touches[0].clientX;
                const touchY = e.touches[0].clientY;
                const deltaX = touchStartX - touchX;
                const deltaY = touchStartY - touchY;
                const absDeltaX = Math.abs(deltaX);
                const absDeltaY = Math.abs(deltaY);
                
                // Determine scroll direction on first significant movement
                if (!touchScrollDirection && (absDeltaX > 5 || absDeltaY > 5)) {
                    touchScrollDirection = absDeltaX > absDeltaY ? 'horizontal' : 'vertical';
                }
                
                // Handle horizontal scrolling with improved logic
                if (touchScrollDirection === 'horizontal' && absDeltaX > 5) {
                    e.preventDefault();
                    e.stopPropagation();
                    isTouchScrolling = true;
                    
                    // Smooth scrolling with momentum
                    const scrollAmount = deltaX * 1.2; // Slight amplification for better feel
                    this.boardContainer.scrollLeft = initialScrollLeft + (touchStartX - touchX) * 1.2;
                } else if (touchScrollDirection === 'vertical') {
                    // Allow normal page scrolling for vertical gestures
                    isTouchScrolling = false;
                }
            }
        }, { passive: false });
        
        // Add touchend handler for momentum and cleanup
        this.boardContainer.addEventListener('touchend', (e) => {
            if (isTouchScrolling) {
                const touchEndTime = Date.now();
                const touchDuration = touchEndTime - touchStartTime;
                
                // Add momentum scrolling for quick swipes
                if (touchDuration < 300) {
                    const velocity = (touchStartX - e.changedTouches[0].clientX) / touchDuration;
                    if (Math.abs(velocity) > 0.5) {
                        const momentum = velocity * 150; // Momentum factor
                        const targetScrollLeft = this.boardContainer.scrollLeft + momentum;
                        
                        this.boardContainer.scrollTo({
                            left: Math.max(0, Math.min(targetScrollLeft, this.boardContainer.scrollWidth - this.boardContainer.clientWidth)),
                            behavior: 'smooth'
                        });
                    }
                }
            }
            
            // Reset touch state
            isTouchScrolling = false;
            touchScrollDirection = null;
        }, { passive: true });

        // Prevent page scroll when scrolling horizontally on the board
        this.boardContainer.addEventListener('scroll', (e) => {
            if (isScrolling) {
                e.stopPropagation();
            }
        });
    }

    // Setup expand/collapse functionality for task cards
    setupExpandFunctionality() {
        // Removed expand functionality - cards are now flexible height
    }

    // Toggle card expansion
    toggleCardExpansion(card) {
        // Removed expand functionality - cards are now flexible height
    }

    // Setup enhanced drag and drop functionality with touch support
    setupDragAndDrop() {
        // Traditional drag and drop for desktop
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.taskId || '');
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.classList.remove('dragging');
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            const column = e.target.closest('.column');
            if (column) {
                column.classList.add('drag-over');
            }
        });

        document.addEventListener('dragleave', (e) => {
            const column = e.target.closest('.column');
            if (column) {
                column.classList.remove('drag-over');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const column = e.target.closest('.column');
            if (column) {
                column.classList.remove('drag-over');
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId) {
                    this.handleTaskDrop(taskId, column);
                }
            }
        });
        
        // Enhanced touch-based drag and drop
        this.setupTouchDragAndDrop();
    }
    
    // Setup touch-based drag and drop
    setupTouchDragAndDrop() {
        let draggedCard = null;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        let isDragging = false;
        let dragPreview = null;
        let longPressTimer = null;
        let touchMoved = false;
        
        // Helper function to create drag preview
        const createDragPreview = (originalCard) => {
            const preview = originalCard.cloneNode(true);
            preview.classList.add('touch-drag-preview');
            preview.style.position = 'fixed';
            preview.style.pointerEvents = 'none';
            preview.style.zIndex = '9999';
            preview.style.transform = 'rotate(5deg) scale(1.05)';
            preview.style.opacity = '0.9';
            preview.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
            document.body.appendChild(preview);
            return preview;
        };
        
        // Helper function to update drag preview position
        const updateDragPreview = (x, y) => {
            if (dragPreview) {
                dragPreview.style.left = (x - dragOffsetX) + 'px';
                dragPreview.style.top = (y - dragOffsetY) + 'px';
            }
        };
        
        // Helper function to get column under point
        const getColumnUnderPoint = (x, y) => {
            const elements = document.elementsFromPoint(x, y);
            return elements.find(el => el.classList.contains('column'));
        };
        
        // Touch start handler
        document.addEventListener('touchstart', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (!taskCard) return;
            
            // Prevent touch scrolling conflicts
            if (e.touches.length !== 1) return;
            
            const touch = e.touches[0];
            draggedCard = taskCard;
            dragStartX = touch.clientX;
            dragStartY = touch.clientY;
            touchMoved = false;
            
            // Calculate offset from touch point to card center
            const rect = taskCard.getBoundingClientRect();
            dragOffsetX = touch.clientX - rect.left;
            dragOffsetY = touch.clientY - rect.top;
            
            // Start long press timer for drag initiation
            longPressTimer = setTimeout(() => {
                if (!touchMoved && draggedCard) {
                    isDragging = true;
                    draggedCard.classList.add('touch-dragging');
                    dragPreview = createDragPreview(draggedCard);
                    updateDragPreview(touch.clientX, touch.clientY);
                    
                    // Provide haptic feedback if available
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }
            }, 200); // 200ms long press
            
        }, { passive: true });
        
        // Touch move handler
        document.addEventListener('touchmove', (e) => {
            if (!draggedCard) return;
            
            const touch = e.touches[0];
            const moveX = Math.abs(touch.clientX - dragStartX);
            const moveY = Math.abs(touch.clientY - dragStartY);
            
            // Track if touch has moved significantly
            if (moveX > 10 || moveY > 10) {
                touchMoved = true;
                
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }
            
            if (isDragging) {
                e.preventDefault();
                updateDragPreview(touch.clientX, touch.clientY);
                
                // Highlight drop zones
                const column = getColumnUnderPoint(touch.clientX, touch.clientY);
                document.querySelectorAll('.column').forEach(col => {
                    col.classList.remove('touch-drag-over');
                });
                if (column && column !== draggedCard.closest('.column')) {
                    column.classList.add('touch-drag-over');
                }
            }
        }, { passive: false });
        
        // Touch end handler
        document.addEventListener('touchend', (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            if (isDragging && draggedCard) {
                const touch = e.changedTouches[0];
                const targetColumn = getColumnUnderPoint(touch.clientX, touch.clientY);
                
                if (targetColumn && targetColumn !== draggedCard.closest('.column')) {
                    this.handleTaskDrop(draggedCard.dataset.taskId, targetColumn);
                }
                
                // Clean up
                if (dragPreview) {
                    dragPreview.remove();
                    dragPreview = null;
                }
                
                draggedCard.classList.remove('touch-dragging');
                document.querySelectorAll('.column').forEach(col => {
                    col.classList.remove('touch-drag-over');
                });
            }
            
            // Reset state
            isDragging = false;
            draggedCard = null;
            touchMoved = false;
        }, { passive: true });
    }

    // Handle task drop
    handleTaskDrop(taskId, targetColumn) {
        const newStatus = targetColumn.dataset.status;
        if (newStatus && window.taskManager) {
            window.taskManager.updateTaskStatus(taskId, newStatus);
        }
    }

    // Create task board columns
    createTaskBoard() {
        if (!this.boardContainer) return;

        this.boardContainer.innerHTML = '';
        
        this.statusConfig.forEach(status => {
            const column = this.createColumn(status);
            this.boardContainer.appendChild(column);
        });

        this.boardContainer.appendChild(this.createPaginationFooter());
    }

    createPaginationFooter() {
        const footer = document.createElement('div');
        footer.className = 'board-pagination';

        const pageSizeOptions = this.pageSizeOptions.map((size) => `
            <option value="${size}">${size} / page</option>
        `).join('');

        footer.innerHTML = `
            <div class="bulk-actions" id="taskBulkActions">
                <button class="btn btn-secondary" id="taskBulkStatus">Update Status</button>
                <button class="btn btn-secondary" id="taskBulkAssign">Assign</button>
                <button class="btn btn-danger" id="taskBulkDelete">Delete</button>
                <span class="bulk-count" id="taskBulkCount">0 selected</span>
            </div>
            <div class="pagination-controls">
                <button class="btn btn-secondary" id="tasksPaginationPrev">Previous</button>
                <span class="pagination-label" id="tasksPaginationLabel">0-0 of 0</span>
                <button class="btn btn-secondary" id="tasksPaginationNext">Next</button>
                <select class="pagination-size" id="tasksPaginationSize">
                    ${pageSizeOptions}
                </select>
            </div>
        `;

        this.bindPaginationEvents(footer);
        return footer;
    }

    bindPaginationEvents(container) {
        const prevBtn = container.querySelector('#tasksPaginationPrev');
        const nextBtn = container.querySelector('#tasksPaginationNext');
        const sizeSelect = container.querySelector('#tasksPaginationSize');

        if (prevBtn) {
            prevBtn.addEventListener('click', async () => {
                if (window.taskManager) {
                    await window.taskManager.goToPrevPage();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', async () => {
                if (window.taskManager) {
                    await window.taskManager.goToNextPage();
                }
            });
        }

        if (sizeSelect) {
            sizeSelect.addEventListener('change', async (e) => {
                if (window.taskManager) {
                    await window.taskManager.changePageSize(e.target.value);
                }
            });
        }

        const statusBtn = container.querySelector('#taskBulkStatus');
        const assignBtn = container.querySelector('#taskBulkAssign');
        const deleteBtn = container.querySelector('#taskBulkDelete');

        if (statusBtn) {
            statusBtn.addEventListener('click', () => this.handleBulkStatus());
        }
        if (assignBtn) {
            assignBtn.addEventListener('click', () => this.handleBulkAssign());
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.handleBulkDelete());
        }
    }

    // Create a single column
    createColumn(status) {
        const column = document.createElement('div');
        column.className = `column ${status.class}`;
        column.dataset.status = status.key;
        
        column.innerHTML = `
            <div class="column-header">
                <div class="column-title">
                    <span>${status.label}</span>
                    <span class="task-count">0</span>
                </div>
            </div>
            <div class="column-content">
            </div>
        `;

        return column;
    }

    // Render tasks in the board
    renderTasks(tasks) {
        if (!this.boardContainer) return;

        // Store all tasks for filtering
        this.allTasks = tasks;
        this.applyFilters();
    }

    // Apply filters and render filtered tasks
    applyFilters(options = {}) {
        console.log('🔍 Applying filters. Active filters:', this.activeFilters);
        console.log('🔍 Sprint filter values:', this.activeFilters.sprint);
        console.log('🔍 Assignee filter values:', this.activeFilters.assignee);
        console.log('🔍 Priority filter values:', this.activeFilters.priority);
        console.log('📋 Total tasks before filtering:', this.allTasks.length);

        if (!options.skipServer && window.taskManager) {
            const serverFilterUpdates = this.buildServerFilterPayload();
            window.taskManager.updateFiltersAndReload(serverFilterUpdates, { resetPage: true });
            return;
        }

        this.filteredTasks = this.filterTasks(this.allTasks);

        // If current-sprint filter produces zero tasks but we have tasks overall,
        // fall back to showing all tasks to avoid an empty board when no sprint is marked current.
        if (this.filteredTasks.length === 0 && this.allTasks.length > 0) {
            const hasCurrent = (window.taskManager?.sprints || []).some(s => s.isCurrent) ||
                               (window.taskManager?.sprints || []).some(s => s.status === 'Active');
            if (!hasCurrent) {
                console.log('ℹ️ No current/active sprint detected. Falling back to show all tasks.');
                this.activeFilters.sprint = ['all'];
                this.activeFilters.currentSprintOnly = false;
                this.filteredTasks = this.filterTasks(this.allTasks);
            }
        }
        
        console.log('📋 Tasks after filtering:', this.filteredTasks.length);
        this.renderFilteredTasks();
    }

    // Toggle current sprint filter
    toggleCurrentSprintFilter() {
        this.activeFilters.currentSprintOnly = !this.activeFilters.currentSprintOnly;
        
        const toggleButton = document.getElementById('currentSprintToggle');
        const toggleText = document.getElementById('currentSprintToggleText');
        
        if (this.activeFilters.currentSprintOnly) {
            toggleButton.classList.add('btn-primary');
            toggleButton.classList.remove('btn-secondary');
            toggleText.textContent = 'Show All Sprints';
        } else {
            toggleButton.classList.add('btn-secondary');
            toggleButton.classList.remove('btn-primary');
            toggleText.textContent = 'Show Current Sprint';
        }
        
        this.applyFilters();
    }

    // Filter tasks based on active filters
    filterTasks(tasks) {
        let filteredTasks = tasks.filter(task => {
            // Add null check for task
            if (!task) return false;
            
            // Current sprint filter
            if (this.activeFilters.currentSprintOnly) {
                const currentSprint = window.taskManager.sprints.find(s => s.isCurrent);
                if (currentSprint) {
                    const taskSprint = task.sprint || task.sprintWeek || '';
                    const currentSprintName = currentSprint.sprintWeek || currentSprint.name || '';
                    if (taskSprint !== currentSprintName) {
                        return false;
                    }
                } else {
                    // No current sprint marked, show no tasks
                    return false;
                }
            }
            
            // Sprint filter
            if (this.activeFilters.sprint.length > 0 && !this.activeFilters.sprint.includes('all')) {
                const taskSprint = task.sprintWeek || task.sprint || '';
                
                // Handle "current" filter option
                if (this.activeFilters.sprint.includes('current')) {
                    // Check both taskManager and sprintManager for current sprints
                    let currentSprints = [];
                    if (window.taskManager && window.taskManager.sprints) {
                        currentSprints = window.taskManager.sprints.filter(s => s.isCurrent);
                    }
                    if (currentSprints.length === 0 && window.sprintManager && window.sprintManager.sprints) {
                        currentSprints = window.sprintManager.sprints.filter(s => s.isCurrent);
                    }
                    
                    // Map current sprints to their week identifiers - prioritize name property since that's what tasks use
                    const currentSprintWeeks = currentSprints.map(s => s.name || s.sprintWeek || s.week).filter(w => w);
                    console.log('🎯 Current sprint filter active. Current sprints:', currentSprintWeeks, 'Task sprint:', taskSprint);
                    console.log('🎯 Available sprints in taskManager:', window.taskManager?.sprints?.map(s => ({name: s.name, sprintWeek: s.sprintWeek, isCurrent: s.isCurrent})));
                    console.log('🎯 All sprints data:', window.taskManager?.sprints);
                    
                    // Determine which sprint weeks to use for filtering
                    let sprintWeeksToCheck = currentSprintWeeks;
                    
                    if (currentSprintWeeks.length === 0) {
                        console.log('⚠️ No current sprints found - checking if any sprints have status "Active"');
                        // Fallback: check for sprints with "Active" status
                        const activeSprintsByStatus = window.taskManager?.sprints?.filter(s => s.status === 'Active') || [];
                        sprintWeeksToCheck = activeSprintsByStatus.map(s => s.name || s.sprintWeek || s.week).filter(w => w);
                        console.log('🔄 Active sprints by status:', sprintWeeksToCheck);
                        
                        if (sprintWeeksToCheck.length === 0) {
                            console.log('⚠️ No current or active sprints found - showing no tasks');
                            return false;
                        }
                    }
                    
                    const isCurrentSprintTask = sprintWeeksToCheck.includes(taskSprint);
                    console.log('🎯 Task sprint match check:', taskSprint, 'in', sprintWeeksToCheck, '=', isCurrentSprintTask);
                    
                    if (!isCurrentSprintTask) {
                        return false;
                    }
                } else {
                    // Regular sprint filtering
                    let matchFound = false;
                    for (const filterSprint of this.activeFilters.sprint) {
                        // Extract sprint week from current sprint labels like "🎯 W26 (Current)"
                        const sprintWeek = filterSprint.includes('(Current)') ? 
                            filterSprint.replace(/🎯\s*/, '').replace(/\s*\(Current\)/, '') : 
                            filterSprint;
                        
                        if (taskSprint === sprintWeek) {
                            matchFound = true;
                            break;
                        }
                    }
                    if (!matchFound) {
                        return false;
                    }
                }
            }

            // Assignee filter - handle comma-separated values
            if (this.activeFilters.assignee.length > 0 && !this.activeFilters.assignee.includes('all')) {
                const taskAssignee = task.assignedTo || task.assignee || '';
                let assigneeMatch = false;
                
                if (typeof taskAssignee === 'string') {
                    const assignees = taskAssignee.split(/[,;|]/)
                        .map(name => name.trim())
                        .filter(name => name && name !== 'Unassigned');
                    
                    assigneeMatch = assignees.some(assignee => 
                        this.activeFilters.assignee.includes(assignee)
                    );
                } else {
                    assigneeMatch = this.activeFilters.assignee.includes(taskAssignee);
                }
                
                if (!assigneeMatch) {
                    return false;
                }
            }

            // Assigned By filter - handle comma-separated values
            if (this.activeFilters.assignedBy.length > 0 && !this.activeFilters.assignedBy.includes('all')) {
                const taskAssignedBy = task.assignedBy || task.createdBy || '';
                let creatorMatch = false;
                
                if (typeof taskAssignedBy === 'string') {
                    const creators = taskAssignedBy.split(/[,;|]/)
                        .map(name => name.trim())
                        .filter(name => name && name !== 'Unassigned');
                    
                    creatorMatch = creators.some(creator => 
                        this.activeFilters.assignedBy.includes(creator)
                    );
                } else {
                    creatorMatch = this.activeFilters.assignedBy.includes(taskAssignedBy);
                }
                
                if (!creatorMatch) {
                    return false;
                }
            }

            // Priority filter
            if (this.activeFilters.priority.length > 0 && !this.activeFilters.priority.includes('all')) {
                const taskPriority = task.priority || '';
                if (!this.activeFilters.priority.includes(taskPriority)) {
                    return false;
                }
            }

            return true;
        });

        // Apply search filter if search term exists
        if (this.searchTerm && this.searchTerm.trim()) {
            filteredTasks = this.searchTasks(filteredTasks, this.searchTerm.trim());
        }

        return filteredTasks;
    }

    // Render filtered and sorted tasks
    renderFilteredTasks() {
        if (!this.boardContainer) return;

        // Clear existing tasks
        document.querySelectorAll('.column-content').forEach(content => {
            content.innerHTML = '';
        });

        // Group tasks by status
        const tasksByStatus = {};
        this.statusConfig.forEach(status => {
            tasksByStatus[status.key] = [];
        });

        this.filteredTasks.forEach(task => {
            const status = task.status || 'Not started';
            if (tasksByStatus[status]) {
                tasksByStatus[status].push(task);
            }
        });

        // Render tasks in each column with sorting
        this.statusConfig.forEach(status => {
            const column = this.boardContainer.querySelector(`[data-status="${status.key}"]`);
            if (!column) return;

            const content = column.querySelector('.column-content');
            
            // Clear content
            content.innerHTML = '';

            // Sort tasks by priority and due date
            const sortedTasks = this.sortTasksByPriorityAndDueDate(tasksByStatus[status.key]);

            // Add tasks
            sortedTasks.forEach(task => {
                const taskCard = this.createTaskCard(task);
                content.appendChild(taskCard);
            });

            // Update task count
            const countElement = column.querySelector('.task-count');
            if (countElement) {
                countElement.textContent = tasksByStatus[status.key].length;
            }
        });
    }

    // Sort tasks by priority and due date
    sortTasksByPriorityAndDueDate(tasks) {
        const priorityOrder = {
            'P0': 0,
            'P1': 1,
            'P2': 2,
            'Backlog': 3
        };

        return tasks.sort((a, b) => {
            // First sort by priority
            const priorityA = priorityOrder[a.priority] ?? 4;
            const priorityB = priorityOrder[b.priority] ?? 4;
            
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            // Then sort by due date if present
            const dueDateA = a.dueDate ? new Date(a.dueDate) : null;
            const dueDateB = b.dueDate ? new Date(b.dueDate) : null;

            if (dueDateA && dueDateB) {
                return dueDateA - dueDateB;
            } else if (dueDateA && !dueDateB) {
                return -1; // Tasks with due dates come first
            } else if (!dueDateA && dueDateB) {
                return 1;
            }

            // Finally sort by creation date
            const createdA = new Date(a.createdAt || a.created_at || 0);
            const createdB = new Date(b.createdAt || b.created_at || 0);
            return createdA - createdB;
        });
    }

    // Update filter values
    updateFilter(filterType, values) {
        this.activeFilters[filterType] = values;
        this.applyFilters();
    }

    // Get available filter options
    getFilterOptions() {
        const options = {
            sprint: [],
            assignee: [],
            assignedBy: [],
            priority: ['P0', 'P1', 'P2', 'Backlog']
        };

        // Get sprint options from sprints data (not just from tasks)
        if (window.taskManager && window.taskManager.sprints) {
            const currentSprints = window.taskManager.sprints.filter(s => s.isCurrent);
            const otherSprints = window.taskManager.sprints.filter(s => !s.isCurrent);
            
            // Sort other sprints by week number (descending, so newest non-current sprints appear first)
            otherSprints.sort((a, b) => {
                const getWeekNumber = (sprint) => {
                    const sprintWeek = sprint.name || sprint.sprintWeek || sprint.week || '';
                    const match = sprintWeek.match(/W?(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                };
                return getWeekNumber(b) - getWeekNumber(a);
            });
            
            // Add current sprints first with visual indicator
            currentSprints.forEach(sprint => {
                const sprintWeek = sprint.name || sprint.sprintWeek || sprint.week;
                if (sprintWeek) {
                    options.sprint.push(`🎯 ${sprintWeek} (Current)`);
                }
            });
            
            // Add all other sprints (including past sprints)
            otherSprints.forEach(sprint => {
                const sprintWeek = sprint.name || sprint.sprintWeek || sprint.week;
                if (sprintWeek) {
                    options.sprint.push(sprintWeek);
                }
            });
        }

        // Also add any sprint values from tasks that might not be in sprints list
        this.allTasks.forEach(task => {
            if (!task) return;
            
            // Handle sprint values
            if (task.sprint || task.sprintWeek) {
                const sprintValue = task.sprint || task.sprintWeek;
                const currentSprintLabel = `🎯 ${sprintValue} (Current)`;
                
                // Only add if not already in the list (either as current or regular)
                if (!options.sprint.includes(sprintValue) && !options.sprint.includes(currentSprintLabel)) {
                    options.sprint.push(sprintValue);
                }
            }
            
            // Handle assignee values - parse comma-separated values
            if (task.assignedTo || task.assignee) {
                const assignedValue = task.assignedTo || task.assignee;
                if (typeof assignedValue === 'string') {
                    // Split by common delimiters and clean up
                    const assignees = assignedValue.split(/[,;|]/)
                        .map(name => name.trim())
                        .filter(name => name && name !== 'Unassigned' && name !== '');
                    
                    assignees.forEach(assignee => {
                        if (!options.assignee.includes(assignee)) {
                            options.assignee.push(assignee);
                        }
                    });
                } else if (assignedValue && !options.assignee.includes(assignedValue)) {
                    options.assignee.push(assignedValue);
                }
            }
            
            // Handle assigned by values - parse comma-separated values
            if (task.assignedBy || task.createdBy) {
                const createdByValue = task.assignedBy || task.createdBy;
                if (typeof createdByValue === 'string') {
                    // Split by common delimiters and clean up
                    const creators = createdByValue.split(/[,;|]/)
                        .map(name => name.trim())
                        .filter(name => name && name !== 'Unassigned' && name !== '');
                    
                    creators.forEach(creator => {
                        if (!options.assignedBy.includes(creator)) {
                            options.assignedBy.push(creator);
                        }
                    });
                } else if (createdByValue && !options.assignedBy.includes(createdByValue)) {
                    options.assignedBy.push(createdByValue);
                }
            }
        });

        return options;
    }

    // Populate filter dropdowns
    populateFilters() {
        const options = this.getFilterOptions();
        
        // Populate sprint filter
        this.populateFilterDropdown('sprintFilter', options.sprint);
        
        // Populate assignee filter
        this.populateFilterDropdown('assigneeFilter', options.assignee);
        
        // Populate assigned by filter
        this.populateFilterDropdown('assignedByFilter', options.assignedBy);
    }

    // Populate a specific filter dropdown
    populateFilterDropdown(filterId, options) {
        const dropdown = document.getElementById(filterId + 'Dropdown');
        if (!dropdown) return;

        // Keep the "All" and "current" options and preserve their states
        const allOption = dropdown.querySelector('[data-value="all"]');
        const currentOption = dropdown.querySelector('[data-value="current"]');
        const allOptionHtml = allOption ? allOption.outerHTML : '';
        const currentOptionHtml = currentOption ? currentOption.outerHTML : '';
        
        // Clear dropdown
        dropdown.innerHTML = '';
        
        // Re-add preserved options first
        if (currentOptionHtml) {
            dropdown.innerHTML += currentOptionHtml;
        }
        if (allOptionHtml) {
            dropdown.innerHTML += allOptionHtml;
        }

        // Add options
        options.forEach(option => {
            const optionElement = document.createElement('div');
            optionElement.className = 'multiselect-option';
            optionElement.dataset.value = option;
            
            const safeId = `${filterId}-${option.replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`;
            optionElement.innerHTML = `
                <input type="checkbox" id="${safeId}" data-filter="true">
                <label for="${safeId}">${option}</label>
            `;
            
            dropdown.appendChild(optionElement);
        });
    }

    // Create a task card
    createTaskCard(task) {
        // Add null check for task
        if (!task) {
            console.warn('Attempted to create task card with null/undefined task');
            return document.createElement('div'); // Return empty div as fallback
        }
        
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.taskId = task.id;
        card.draggable = true;

        // Parse assigned people - handle both string and array formats
        let assignedPeople = [];
        if (task.assignedTo) {
            if (Array.isArray(task.assignedTo)) {
                assignedPeople = task.assignedTo.filter(name => name && name.trim() !== 'Unassigned');
            } else if (typeof task.assignedTo === 'string') {
                // Split by common delimiters and filter out unassigned
                assignedPeople = task.assignedTo.split(/[,;|]/)
                    .map(name => name.trim())
                    .filter(name => name && name !== 'Unassigned');
            } else {
                if (task.assignedTo !== 'Unassigned') {
                    assignedPeople = [task.assignedTo];
                }
            }
        }

        // Display shortId (kira-XXXXXX) when available, fallback to internal id
        const displayId = task.shortId || task.id || 'TASK-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        // Get sprint week info
        const sprintWeek = task.sprintWeek || task.sprint || '';

        card.innerHTML = `
            <div class="task-card-header">
                <div class="task-meta-top">
                    <span class="task-id">${displayId}</span>
                    ${sprintWeek ? `<span class="sprint-week sprint-${this.getSprintClass(sprintWeek)}">${sprintWeek}</span>` : ''}
                </div>
                <div class="task-actions">
                    <input type="checkbox" class="task-select-checkbox" data-task-id="${task.id}" ${this.bulkSelection.has(task.id) ? 'checked' : ''}>
                    <img src="assets/copy-icon.jpg" alt="Copy task path" class="copy-icon" data-action="copyTaskPath" data-task-id="${task.id}" title="Copy task path" style="cursor: pointer;">
                </div>
            </div>
            <div class="task-title" data-action="openTaskDetails" data-task-id="${task.id}" style="cursor: pointer;">${this.escapeHtml(task.task || 'Untitled Task')}</div>
            <div class="task-tags-section">
                ${task.priority ? `<span class="task-tag priority-${task.priority.toLowerCase()}">${task.priority}</span>` : ''}
                ${task.type ? `<span class="task-tag type-${task.type.toLowerCase()}">${task.type}</span>` : ''}
                ${task.tags ? this.renderTaskTags(task.tags) : ''}
            </div>
            ${assignedPeople.length > 0 ? `
                <div class="assignees-section">
                    <div class="assignees-title">Assigned to</div>
                    <div class="assignees-list">
                        ${assignedPeople.map(person => this.createAssigneeItem(person)).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        // Add click handler to the entire card (excluding copy icon)
        card.addEventListener('click', async (e) => {
            if (e.target.classList.contains('task-select-checkbox')) {
                this.toggleBulkSelection(task.id, e.target.checked);
                return;
            }
            if (e.target.closest('.pagination-controls') || e.target.closest('.bulk-actions')) {
                return;
            }
            if (!e.target.closest('.task-actions') && !e.target.closest('.copy-icon')) {
                e.preventDefault();
                e.stopPropagation();
                await openTaskDetails(task.id);
            }
        });

        return card;
    }

    toggleBulkSelection(taskId, checked) {
        if (checked) {
            this.bulkSelection.add(taskId);
        } else {
            this.bulkSelection.delete(taskId);
        }
        this.updateBulkSelectionState();
    }

    updateBulkSelectionState(selectedIds = Array.from(this.bulkSelection)) {
        const countEl = document.getElementById('taskBulkCount');
        if (countEl) {
            countEl.textContent = `${selectedIds.length} selected`;
        }

        const selectors = document.querySelectorAll('.task-select-checkbox');
        selectors.forEach((checkbox) => {
            const id = checkbox.dataset.taskId;
            checkbox.checked = selectedIds.includes(id);
        });

        const bulkContainer = document.getElementById('taskBulkActions');
        if (bulkContainer) {
            if (selectedIds.length > 0) {
                bulkContainer.classList.add('active');
            } else {
                bulkContainer.classList.remove('active');
            }
        }
    }

    // Create assignee item
    createAssigneeItem(name) {
        const initials = this.getInitials(name);
        return `
            <div class="assignee-item">
                <div class="assignee-avatar">${initials}</div>
                <span class="assignee-name">${this.escapeHtml(name)}</span>
            </div>
        `;
    }

    // Render task tags
    renderTaskTags(tags) {
        if (!tags) return '';
        
        let tagArray = [];
        if (Array.isArray(tags)) {
            tagArray = tags;
        } else if (typeof tags === 'string') {
            tagArray = tags.split(/[,;|]/).map(tag => tag.trim()).filter(tag => tag);
        }

        return tagArray.map(tag => 
            `<span class="task-tag type-improvement">${this.escapeHtml(tag)}</span>`
        ).join('');
    }

    // Get initials from name
    getInitials(name) {
        if (!name || name === 'Unassigned') return 'U';
        return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().substr(0, 2);
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }



    // Search tasks
    searchTasks(tasks, searchTerm) {
        if (!searchTerm) return tasks;
        
        const term = searchTerm.toLowerCase();
        return tasks.filter(task => {
            // Add null check for task
            if (!task) return false;
            
            return (task.task && task.task.toLowerCase().includes(term)) ||
                   (task.shortId && task.shortId.toLowerCase().includes(term)) ||
                   (task.description && task.description.toLowerCase().includes(term)) ||
                   (task.assignedTo && task.assignedTo.toLowerCase().includes(term)) ||
                   (task.id && task.id.toLowerCase().includes(term));
        });
    }

    // Get sprint class for color coding
    getSprintClass(sprintWeek) {
        if (!sprintWeek) return '';
        
        // Extract sprint number or week number
        const sprintMatch = sprintWeek.match(/(\d+)/);
        if (sprintMatch) {
            const num = parseInt(sprintMatch[1]);
            // Color code based on sprint number (1-4: current, 5-8: upcoming, 9+: future)
            if (num <= 4) return 'current';
            if (num <= 8) return 'upcoming';
            return 'future';
        }
        
        // Default color for non-numeric sprints
        return 'default';
    }

    buildServerFilterPayload() {
        const payload = {};

        if (this.activeFilters.sprint && this.activeFilters.sprint.length > 0) {
            payload.sprint = this.activeFilters.sprint.filter(value => value !== 'all');
        }

        if (this.activeFilters.assignee && this.activeFilters.assignee.length > 0) {
            payload.assignee = this.activeFilters.assignee.filter(value => value !== 'all');
        }

        if (this.activeFilters.assignedBy && this.activeFilters.assignedBy.length > 0) {
            payload.assignedBy = this.activeFilters.assignedBy.filter(value => value !== 'all');
        }

        if (this.activeFilters.priority && this.activeFilters.priority.length > 0) {
            payload.priority = this.activeFilters.priority.filter(value => value !== 'all');
        }

        if (this.searchTerm && this.searchTerm.trim()) {
            payload.search = this.searchTerm.trim();
        }

        return payload;
    }

    updatePaginationControls() {
        if (!window.document) return;
        const pageDisplay = document.getElementById('tasksPaginationLabel');
        const prevBtn = document.getElementById('tasksPaginationPrev');
        const nextBtn = document.getElementById('tasksPaginationNext');
        const pageSizeSelect = document.getElementById('tasksPaginationSize');

        if (pageDisplay) {
            const { page, pageSize, total } = this.pagination;
            const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
            const end = Math.min(page * pageSize, total);
            pageDisplay.textContent = `${start}-${end} of ${total}`;
        }

        if (prevBtn) {
            prevBtn.disabled = !this.pagination.hasPrev;
        }

        if (nextBtn) {
            nextBtn.disabled = !this.pagination.hasNext;
        }

        if (pageSizeSelect) {
            pageSizeSelect.value = String(this.pagination.pageSize);
        }
    }

    handleBulkStatus() {
        if (!window.taskManager || this.bulkSelection.size === 0) return;
        const status = prompt('Enter new status for selected tasks (e.g., In progress, Done, Blocked - Product):');
        if (!status) return;
        window.taskManager.bulkUpdateStatus(Array.from(this.bulkSelection), status).then(() => {
            this.bulkSelection.clear();
            this.updateBulkSelectionState();
        });
    }

    handleBulkAssign() {
        if (!window.taskManager || this.bulkSelection.size === 0) return;
        const userEmail = prompt('Enter email of assignee:');
        if (!userEmail) return;
        const assignedBy = window.authManager?.currentUser?.email || '';
        window.taskManager.bulkAssignTasks(Array.from(this.bulkSelection), userEmail, assignedBy).then(() => {
            this.bulkSelection.clear();
            this.updateBulkSelectionState();
        });
    }

    handleBulkDelete() {
        if (!window.taskManager || this.bulkSelection.size === 0) return;
        if (!confirm(`Delete ${this.bulkSelection.size} tasks? This cannot be undone.`)) return;
        window.taskManager.bulkDeleteTasks(Array.from(this.bulkSelection)).then(() => {
            this.bulkSelection.clear();
            this.updateBulkSelectionState();
        });
    }
}

// Global functions for task board
function toggleCardExpansion(card) {
    if (window.taskBoardManager) {
        window.taskBoardManager.toggleCardExpansion(card);
    }
}

async function openTaskDetails(taskId) {
    if (window.taskManager) {
        await window.taskManager.openTaskDetails(taskId);
    }
}

function editTask(taskId) {
    if (window.taskManager) {
        window.taskManager.editTask(taskId);
    }
}

function showCreateTaskModal() {
    if (window.taskManager) {
        window.taskManager.showCreateTaskModal();
    }
}

// Global filter functions
function toggleMultiselect(filterId) {
    const container = document.querySelector(`[data-filter-id="${filterId}"]`)?.parentElement;
    const dropdown = document.getElementById(filterId + 'Dropdown');
    
    if (!container || !dropdown) {
        console.log('toggleMultiselect: container or dropdown not found', { filterId, container: !!container, dropdown: !!dropdown });
        return;
    }
    
    // Close all other dropdowns
    document.querySelectorAll('.multiselect-container').forEach(cont => {
        if (cont !== container) {
            cont.classList.remove('open');
        }
    });
    
    // Toggle current dropdown
    const wasOpen = container.classList.contains('open');
    container.classList.toggle('open');
    
    console.log('toggleMultiselect:', { filterId, wasOpen, nowOpen: container.classList.contains('open') });
    
    // Close dropdown when clicking outside
    if (container.classList.contains('open')) {
        setTimeout(() => {
            document.addEventListener('click', function closeDropdown(e) {
                if (!container.contains(e.target)) {
                    container.classList.remove('open');
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }, 0);
    }
}

function applyFilters() {
    if (!window.taskBoardManager) {
        console.log('applyFilters: taskBoardManager not available');
        return;
    }
    
    const filters = {
        sprint: getSelectedValues('sprintFilter'),
        assignee: getSelectedValues('assigneeFilter'),
        assignedBy: getSelectedValues('assignedByFilter'),
        priority: getSelectedValues('priorityFilter')
    };
    
    console.log('applyFilters: filters to apply', filters);
    
    // Update active filters
    Object.keys(filters).forEach(filterType => {
        window.taskBoardManager.activeFilters[filterType] = filters[filterType];
    });
    
    // Apply filters
    window.taskBoardManager.applyFilters();
    
    // Update filter display text
    updateFilterDisplayText();
}

function getSelectedValues(filterId) {
    const dropdown = document.getElementById(filterId + 'Dropdown');
    if (!dropdown) return [];
    
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => {
        // Handle the special "all" case
        if (cb.id.endsWith('-all')) {
            return 'all';
        }
        // Handle the special "current" case
        if (cb.id.endsWith('-current')) {
            return 'current';
        }
        
        // For other values, get the original text from the label instead of parsing the ID
        const label = cb.nextElementSibling;
        if (label && label.tagName === 'LABEL') {
            let value = label.textContent.trim();
            
            // For sprint filters, extract the actual sprint week from labels like "🎯 W27 (Current)"
            if (filterId === 'sprintFilter') {
                // Remove emoji and (Current) suffix, keep just the sprint week
                value = value.replace(/🎯\s*/, '').replace(/\s*\(Current\)/, '').trim();
            }
            
            // For priority filters, extract just the priority code from labels like "P0 - Critical"
            if (filterId === 'priorityFilter') {
                // Extract priority code (P0, P1, P2, Backlog) from labels like "P0 - Critical"
                const match = value.match(/^(P\d+|Backlog)/);
                if (match) {
                    value = match[1];
                }
            }
            
            return value;
        }
        
        // Fallback to ID parsing if label not found
        const prefix = filterId + '-';
        let value = cb.id.replace(prefix, '');
        return value;
    });
}

function clearAllFilters() {
    // Uncheck all checkboxes
    document.querySelectorAll('.multiselect-option input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Check "All" options
    document.querySelectorAll('.multiselect-option[data-value="all"] input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
    
    // Reset active filters
    if (window.taskBoardManager) {
        window.taskBoardManager.activeFilters = {
            sprint: [],
            assignee: [],
            assignedBy: [],
            priority: []
        };
        window.taskBoardManager.applyFilters();
    }
    
    // Update filter display text
    updateFilterDisplayText();
}

function updateFilterDisplayText() {
    const filterTypes = ['sprintFilter', 'assigneeFilter', 'assignedByFilter', 'priorityFilter'];
    
    filterTypes.forEach(filterId => {
        const display = document.querySelector(`[data-filter-id="${filterId}"] .multiselect-text`);
        if (!display) return; // Skip if element not found
        
        const selectedValues = getSelectedValues(filterId);
        
        if (selectedValues.includes('all') || selectedValues.length === 0) {
            // Show "All" text
            const allTexts = {
                'sprintFilter': 'All Sprints',
                'assigneeFilter': 'All Assignees',
                'assignedByFilter': 'All Creators',
                'priorityFilter': 'All Priorities'
            };
            display.textContent = allTexts[filterId];
        } else if (selectedValues.includes('current') && filterId === 'sprintFilter') {
            // Special handling for current sprint filter
            display.textContent = '🎯 Current Sprint';
        } else if (selectedValues.length === 1) {
            // Handle special display text for certain values
            if (selectedValues[0] === 'current' && filterId === 'sprintFilter') {
                display.textContent = '🎯 Current Sprint';
            } else {
                display.textContent = selectedValues[0];
            }
        } else {
            display.textContent = `${selectedValues.length} selected`;
        }
    });
}

// Initialize task board when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskBoardManager = new TaskBoardManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskBoardManager;
} 