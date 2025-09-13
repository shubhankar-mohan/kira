# UI Improvement Plan - Kira Task Manager

## Overview
This document outlines the systematic approach to fix all UI/UX issues and implement requested features across the application.

## 1. User Details Modal Fixes

### Issues Identified:
- ❌ Extra spacing after fields causing layout issues
- ❌ Footer button padding cutting off buttons  
- ❌ Redundant "User details" text in footer
- ❌ Email field should be read-only

### Implementation Plan:
```css
/* Fix task-metadata-grid spacing */
.task-metadata-grid {
    gap: 16px; /* Reduce from 24px */
    margin-bottom: 16px; /* Add consistent bottom margin */
}

/* Fix footer padding */
.task-modal-footer {
    padding: 20px 32px 24px 32px; /* Consistent padding */
}
```

```html
<!-- Make email readonly with visual indication -->
<input type="email" id="userDetailEmail" readonly class="task-metadata-input readonly">

<!-- Remove redundant footer text -->
<div class="task-footer-info">
    <span>Team member</span> <!-- Clean, simple text -->
</div>
```

## 2. User Card Full Clickable Area

### Current Issue:
- Only part of user card is clickable due to nested elements

### Implementation Plan:
```html
<!-- Wrap entire card content with data-action -->
<div class="user-card" data-user-id="..." data-action="openUserDetails">
    <!-- All content becomes clickable -->
</div>
```

## 3. New User Modal Complete Redesign

### Requirements:
- Match User Details modal exactly
- Include all fields: Name, Email, Role, Slack Name, Slack ID, Status + Password
- Working Create User functionality

### Implementation Plan:
```html
<!-- Use identical structure to User Details modal -->
<div id="createUserModal" class="task-modal-overlay">
    <div class="task-modal-container">
        <div class="task-modal-header">...</div>
        <div class="task-modal-body">
            <!-- 7 fields: Name, Email, Role, Slack Name, Slack ID, Status, Password -->
        </div>
        <div class="task-modal-footer">
            <!-- Create User button with proper API integration -->
        </div>
    </div>
</div>
```

```javascript
// Implement proper createUser method in ui-manager.js
async createUser() {
    const formData = {
        name: document.getElementById('userName').value,
        email: document.getElementById('userEmail').value,
        role: document.getElementById('userRole').value,
        slackName: document.getElementById('userSlackName').value,
        slackId: document.getElementById('userSlackId').value,
        status: document.getElementById('userStatus').value || 'Active',
        password: document.getElementById('userPassword').value
    };
    
    const response = await api.createUser(formData);
    // Handle response, update UI, close modal
}
```

## 4. Create Sprint Modal Improvements

### Requirements:
- Reduce padding between goal textbox and footer
- Auto-populate Monday start date, Friday end date
- Dynamic button text: "Add to Current" → "Current Sprint" (green)

### Implementation Plan:
```css
.sprint-modal .modal-content {
    padding-bottom: 16px; /* Reduce from 24px */
}
```

```javascript
// Auto-populate dates on modal open
function getNextMondayFriday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (8 - dayOfWeek) % 7);
    
    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);
    
    return {
        monday: nextMonday.toISOString().split('T')[0],
        friday: nextFriday.toISOString().split('T')[0]
    };
}
```

## 5. Sprint Cards as Thin Strips

### Design Concept:
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ W26 [Current]     │ Goal: Feature completion     │ 35 Tasks │ 17 Done │ 49% │ [Current Sprint] │
│ Created by shubhankar                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Implementation:
- Height: ~60px (down from ~120px)  
- Horizontal layout with flex
- Compact stats display
- "Created by" in smaller text

## 6. Dashboard Current Sprint Focus

### Scrum Master Requirements:
```
┌─────────────────────────────────────────────────────────────────┐
│ CURRENT SPRINT OVERVIEW                                         │
├─────────────────────────────────────────────────────────────────┤
│ Sprint: W26, W27 (Multi-sprint)    │ Progress: 12/35 (34%)     │
│ Goal: Feature completion           │ Burndown: On track       │
├─────────────────────────────────────────────────────────────────┤
│ TEAM PERFORMANCE                                                │
├─────────────────────────────────────────────────────────────────┤
│ Engineer          │ Allocated │ Completed │ In Progress │ %    │
│ shubhankar        │    8      │    3      │     2       │ 38%  │
│ developer1        │    6      │    4      │     1       │ 67%  │
│ developer2        │    4      │    2      │     2       │ 50%  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Plan:
- Filter all dashboard stats to current sprints only
- Add current sprint details section
- Add engineer performance table
- Add burndown chart indicator

## 7. Board Page Filter Improvements

### Current Issue:
- "All Sprints" filter doesn't make sense for current sprint workflow

### Solution:
```html
<!-- Replace "All Sprints" with "Current Sprint" as default -->
<div class="multiselect-option" data-value="current">
    <input type="checkbox" id="sprint-current" checked>
    <label for="sprint-current">🎯 Current Sprint</label>
</div>
```

## 8. New Task Button Relocation

### Current: Header level (global)
### New: Board page specific

```html
<!-- Remove from header -->
<!-- Add to board page -->
<div class="board-header">
    <h2>Task Board</h2>
    <button class="btn btn-primary" data-action="showCreateTaskModal">
        + New Task
    </button>
</div>
```

## 9. New Task Modal Complete Overhaul

### Requirements:
- "Create Task" button in footer
- API integration for task creation
- Dynamic header (show filled values, not placeholder text)
- Multi-select assignee dropdown
- Sprint dropdown (excluding current sprint indicator)
- Status field pre-filled as "Not Started"

### Implementation Plan:
```html
<div class="task-modal-footer">
    <div class="task-footer-actions">
        <button type="button" class="task-btn task-btn-secondary">Cancel</button>
        <button type="submit" class="task-btn task-btn-primary" data-action="createTask">
            Create Task
        </button>
    </div>
</div>
```

```javascript
// Dynamic header update based on form values
function updateTaskModalHeader() {
    const title = document.getElementById('taskTitle').value || 'New Task';
    const status = document.getElementById('taskStatus').value || 'Not Started';
    const priority = document.getElementById('taskPriority').value || 'Medium';
    
    document.querySelector('.task-title').textContent = title;
    document.querySelector('.task-status').textContent = status;
    document.querySelector('.task-priority').textContent = priority;
}
```

## 10. Implementation Order

1. **Phase 1: Critical Modal Fixes**
   - Fix User Details modal spacing/padding
   - Fix New User modal design and functionality
   - Fix Create Sprint modal padding and dates

2. **Phase 2: Card Interactions**
   - Sprint strips design
   - User card full clickable area
   - Smooth hover animations

3. **Phase 3: Dashboard Redesign**
   - Current sprint stats only
   - Engineer performance table
   - Scrum master view implementation

4. **Phase 4: Board & Task Improvements**
   - Move New Task button to board
   - Fix New Task modal completely
   - Update board filters

## Cache Busting Strategy
Each change will increment version numbers:
- CSS: v4, v5, v6...
- JS modules: v8, v9, v10...
- Add timestamp parameters for hard refresh

## Testing Checklist
- [ ] User Details modal: spacing, readonly email, footer
- [ ] New User modal: design, all fields, create functionality  
- [ ] User cards: full clickable area
- [ ] Sprint strips: compact design, created by info
- [ ] Dashboard: current sprint stats only
- [ ] Board: new task button, improved filters
- [ ] New Task modal: create button, dynamic header, multi-select

## Files to Modify
1. `/frontend/index.html` - Modal structures, button placements
2. `/frontend/css/styles.css` - Sprint strips, spacing fixes
3. `/frontend/css/task-modal.css` - Modal padding fixes
4. `/frontend/js/modules/ui-manager.js` - Render methods, createUser
5. `/frontend/js/modules/modal-manager.js` - Modal handlers
6. `/frontend/js/modules/task-manager.js` - Dashboard logic
7. `/frontend/js/task-board.js` - Filter logic