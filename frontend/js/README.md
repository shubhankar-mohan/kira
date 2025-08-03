# Frontend JavaScript Architecture

## Overview
The frontend JavaScript has been refactored into a modular architecture for better maintainability and organization.

## File Structure

```
frontend/js/
├── api.js                    # API service layer
├── task-board.js            # Task board functionality
├── app-new.js              # Main application (modular version)
└── modules/
    ├── router.js            # Navigation and routing
    ├── auth.js              # Authentication management
    ├── task-manager.js      # Task operations
    ├── modal-manager.js     # Modal operations
    └── ui-manager.js        # UI operations (notifications, loading)
```

## Module Responsibilities

### `api.js`
- Handles all API communication
- Authentication token management
- Request/response handling
- Error handling

### `router.js`
- Client-side routing
- URL management
- Page navigation
- Breadcrumb updates

### `auth.js`
- Login/logout functionality
- User session management
- Authentication state
- Profile management

### `task-manager.js`
- Task CRUD operations
- Task filtering
- Dashboard statistics
- Task status updates

### `modal-manager.js`
- Modal show/hide operations
- Form handling
- Task detail modals
- Dynamic form population

### `ui-manager.js`
- Notifications
- Loading states
- UI rendering (sprints, users)
- Data synchronization

### `task-board.js`
- Kanban board functionality
- Drag and drop
- Task card rendering
- Board filtering

### `app-new.js`
- Main application coordinator
- Module initialization
- Cross-module communication
- Global state management

## Benefits of Modular Structure

1. **Separation of Concerns**: Each module has a specific responsibility
2. **Maintainability**: Easier to find and fix issues
3. **Reusability**: Modules can be reused across different parts of the app
4. **Testability**: Individual modules can be tested in isolation
5. **Scalability**: Easy to add new features without affecting existing code

## Module Communication

Modules communicate through:
- Global window objects (e.g., `window.taskManager`)
- Event system
- Direct method calls
- Shared state through the main App class

## Usage

The modular structure is automatically initialized when the page loads. All modules are available as global objects:

- `window.router` - Navigation and routing
- `window.authManager` - Authentication
- `window.taskManager` - Task operations
- `window.modalManager` - Modal operations
- `window.uiManager` - UI operations
- `window.app` - Main application

## Migration from Old Structure

The old monolithic `app.js` has been split into focused modules. The new structure maintains the same functionality while being more organized and maintainable. 