# Context Prompt for Claude Code: Kira Task Manager Enhancement

## Project Overview

I have an existing task management application called "Kira" built for KiranaClub (a small startup with <30 users). I need to enhance it to be more similar to Focalboard with modern UI/UX and additional features.

## Current Technology Stack

**Backend:**
- Node.js with Express
- Google Sheets API as database (using google-spreadsheet library)
- JWT authentication
- Basic CRUD operations for tasks, users, sprints

**Frontend:**
- Vanilla HTML/CSS/JavaScript (no frameworks)
- Basic responsive design
- Simple task board layout

**Database:**
- Google Sheets with separate sheets for: Tasks, Users, Sprints, Comments
- No simultaneous write conflicts (small team)

## Current Project Structure
```
/Documents/Shubhankar/kira/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── routes/ (tasks.js, users.js, sprints.js, auth.js)
│   ├── services/googleSheets.js
│   └── .env
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   └── js/ (app.js, api.js)
└── README.md
```

## Required Enhancements

### 1. Focalboard-inspired UI/UX
- **Horizontal scrolling task board** (currently vertical)
- **Drag-and-drop between status columns** with smooth animations
- **Inline editing** of task properties (title, description, etc.)
- **Modern card design** with hover effects and micro-interactions
- **Enhanced visual hierarchy** with better typography and spacing

### 2. Enhanced Task Management
- **Quick edit dropdowns** for priority, status changes
- **Task duplication** functionality
- **Bulk operations** (select multiple tasks, bulk status changes)
- **Advanced search/filtering** with real-time results
- **Task templates** and quick creation from any column

### 3. Slack Integration
- **Real-time notifications** for task assignments, completions
- **Status change alerts** for important transitions (Done, Blocked)
- **Sprint notifications** when sprints are created/completed
- **Configurable webhook support**

### 4. Improved Developer Experience
- **Keyboard shortcuts** (Ctrl+Shift+F for search, Ctrl+K for new task)
- **Better error handling** with user-friendly messages
- **Loading states** and optimistic updates
- **Auto-save functionality** for inline edits

### 5. Enhanced Features
- **Role-based access control** (Admin, Manager, Developer roles)
- **Sprint management improvements** with visual progress tracking
- **Dark/light theme toggle**
- **Mobile-optimized responsive design**
- **Export functionality** for tasks and reports

## Current Feature Set (Working)
- ✅ Google Sheets integration with automatic sheet creation
- ✅ Basic authentication with JWT
- ✅ CRUD operations for tasks, users, sprints
- ✅ Comment system
- ✅ Basic task filtering
- ✅ Role-based navigation
- ✅ Responsive design

## Reference Implementation
The target UX should be similar to Focalboard (https://github.com/mattermost-community/focalboard) which features:
- Horizontal scrolling kanban boards
- Smooth drag-and-drop with visual feedback
- Inline property editing
- Modern card-based UI
- Keyboard shortcuts for power users

## Technical Constraints
- **Must continue using Google Sheets** as database (no migration to SQL/NoSQL)
- **Keep vanilla JS** (no React/Vue frameworks)
- **Maintain backward compatibility** with existing data structure
- **Support <30 concurrent users** (no complex scaling needed)
- **Budget-conscious** (leverage free tiers where possible)

## Current Issues to Solve
1. **Static board layout** - need horizontal scrolling columns
2. **Poor mobile experience** - cards too small, hard to interact
3. **No drag-and-drop** - all status changes require modal editing
4. **Limited keyboard navigation** - power users want shortcuts
5. **No real-time collaboration** - need Slack notifications for awareness
6. **Basic visual design** - needs modern, professional appearance

## Expected Deliverables
1. **Enhanced frontend code** with Focalboard-like features
2. **Backend Slack integration** endpoints
3. **Updated CSS** with modern design system
4. **Migration guide** for updating existing installation
5. **Setup instructions** for Slack webhooks

## Example Current vs Desired Workflow
**Current:** Click task → Modal opens → Edit → Save → Close modal
**Desired:** Click task title → Inline edit → Auto-save OR Drag task → Drop in new column → Auto-update
