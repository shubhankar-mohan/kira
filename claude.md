# Kira Task Manager - Development Guide

**Designed and Authored by:** Shubhankar Mohan  
**Project:** KiranaClub Task Management System  
**Version:** 1.0  

## Development Guidelines
This document contains critical information about working with this codebase. Follow these guidelines precisely.

### Code Quality
- Type hints required for all code
- Public APIs must have docstrings
- Functions must be focused and small
- Follow existing patterns exactly
- Line length: 88 chars maximum

### Development Philosophy
- Simplicity: Write simple, straightforward code
- Readability: Make code easy to understand
- Performance: Consider performance without sacrificing readability
- Maintainability: Write code that's easy to update
- Testability: Ensure code is testable
- Reusability: Create reusable components and functions
- Less Code = Less Debt: Minimize code footprint
### Coding Best Practices
- Early Returns: Use to avoid nested conditions
- Descriptive Names: Use clear variable/function names (prefix handlers with "handle")
- Constants Over Functions: Use constants where possible
- DRY Code: Don't repeat yourself
- Functional Style: Prefer functional, immutable approaches when not verbose
- Minimal Changes: Only modify code related to the task at hand
- Function Ordering: Define composing functions before their components
- TODO Comments: Mark issues in existing code with "TODO:" prefix
- Simplicity: Prioritize simplicity and readability over clever solutions
- Build Iteratively Start with minimal functionality and verify it works before adding complexity
- Functional Code: Use functional and stateless approaches where they improve clarity
- Clean logic: Keep core logic clean and push implementation details to the edges
- File Organsiation: Balance file organization with simplicity - use an appropriate number of files for the project scale

### Pull Requests
- Create a detailed message of what changed. Focus on the high level description of the problem it tries to solve, and how it is solved. Don't go into the specifics of the code unless it adds clarity.
- NEVER ever mention a co-authored-by or similar aspects. In particular, never mention the tool used to create the commit message or PR.

## Quick Start

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
python3 -m http.server 3000
# or
npx serve -p 3000
```

## Project Structure

```
/kira/
├── backend/
│   ├── server.js              # Main server entry point
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   ├── tasks.js           # Task CRUD operations  
│   │   ├── users.js           # User management
│   │   └── sprints.js         # Sprint management
│   ├── services/
│   │   └── googleSheets.js    # Google Sheets API integration
│   └── package.json
└── frontend/
    ├── index.html             # Single page application
    ├── css/
    │   ├── styles.css         # Main styles
    │   ├── login.css          # Login page styles
    │   └── task-board.css     # Task board specific styles
    └── js/
        ├── api.js             # API service layer
        ├── app.js             # Main application logic
        └── task-board.js      # Task board functionality
```

## Development Commands

### Linting & Type Checking
```bash
# Backend
cd backend && npm run lint
cd backend && npm run typecheck

# Frontend (if applicable)
cd frontend && npm run lint
```

### Testing
```bash
# Backend tests
cd backend && npm test

# Frontend tests (if applicable)  
cd frontend && npm test
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PUT /api/tasks/:id/status` - Update task status

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Sprints
- `GET /api/sprints` - Get all sprints
- `POST /api/sprints` - Create new sprint
- `PUT /api/sprints/:id` - Update sprint
- `DELETE /api/sprints/:id` - Delete sprint

## Google Sheets Database Schema

### Tasks Sheet
| Column | Description |
|--------|-------------|
| id | Unique task identifier |
| title | Task title |
| description | Task description |
| status | TODO, IN_PROGRESS, DONE, BLOCKED |
| priority | P0, P1, P2, Backlog |
| type | Feature, Bug, Improvement |
| assignedTo | Comma-separated user emails |
| sprintWeek | Sprint identifier |
| createdAt | Creation timestamp |
| updatedAt | Last update timestamp |

### Users Sheet
| Column | Description |
|--------|-------------|
| id | Unique user identifier |
| email | User email address |
| name | Full name |
| role | Admin, Manager, Developer |
| createdAt | Creation timestamp |

### Sprints Sheet
| Column | Description |
|--------|-------------|
| id | Unique sprint identifier |
| name | Sprint name |
| week | Sprint week number |
| startDate | Sprint start date |
| endDate | Sprint end date |
| status | Active, Completed, Planned |

## Common Development Tasks

### Adding a New Feature
1. Create backend route in appropriate file
2. Add API service method in `frontend/js/api.js`
3. Implement UI logic in relevant frontend JS file
4. Add CSS styles if needed
5. Test the feature thoroughly

### Adding a New Page
1. Add page section to `frontend/index.html`
2. Add route handling in `frontend/js/app.js`
3. Implement page-specific logic
4. Add navigation menu item
5. Update CSS for new page styles

### Database Changes
1. Update Google Sheets manually or via API
2. Update service methods in `backend/services/googleSheets.js`
3. Update frontend models/interfaces
4. Test data consistency

## Environment Variables

### Backend (.env)
```
PORT=5000
JWT_SECRET=your_jwt_secret
GOOGLE_SHEETS_ID=your_google_sheets_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key
SLACK_WEBHOOK_URL=your_slack_webhook_url
```

## Troubleshooting

### Common Issues

**Backend not starting:**
- Check if all environment variables are set
- Verify Google Sheets API credentials
- Ensure port 5000 is not in use

**Frontend not loading:**
- Check if backend is running on port 5000
- Verify CORS settings in backend
- Check browser console for errors

**Google Sheets errors:**
- Verify service account has access to the sheet
- Check sheet ID in environment variables
- Ensure sheet structure matches expected schema

**Authentication issues:**
- Check JWT secret configuration
- Verify user credentials in Users sheet
- Check token expiration settings

### Debug Mode
Add to backend for debugging:
```javascript
console.log('Debug info:', debugData);
```

Add to frontend for debugging:
```javascript
console.log('Frontend debug:', debugData);
```

## Slack Integration

### Webhook Setup
1. Create Slack app in your workspace
2. Add webhook URL to environment variables
3. Configure notification triggers in backend routes
4. Test with sample notifications

### Notification Types
- Task assignments
- Status changes  
- Sprint updates
- User mentions

## Mobile Optimization

### Key Features
- Touch-friendly drag and drop
- Responsive card layouts
- Mobile-optimized navigation
- Smooth scrolling gestures

### Testing
- Test on various screen sizes
- Verify touch interactions work
- Check horizontal scrolling on mobile
- Validate form inputs on mobile keyboards

## Performance Tips

### Frontend
- Minimize DOM manipulations
- Use event delegation for dynamic content
- Implement loading states for better UX
- Optimize image sizes and formats

### Backend
- Cache Google Sheets data when possible
- Implement proper error handling
- Use connection pooling if needed
- Add request logging for debugging

## Deployment

### Frontend
- Can be deployed to any static hosting (Netlify, Vercel, etc.)
- Update API endpoints for production
- Ensure CORS is configured for production domain

### Backend
- Deploy to Heroku, Railway, or similar platform
- Set production environment variables
- Configure production database connection
- Set up monitoring and logging

## Design Philosophy

### Architecture Decisions
- **Single Page Application**: Chosen for smooth user experience without page reloads
- **Google Sheets as Database**: Cost-effective solution for small teams (<30 users)
- **Vanilla JavaScript**: Maintains simplicity and reduces bundle size
- **Horizontal Scrolling Board**: Inspired by modern tools for better task visualization
- **Mobile-First Design**: Optimized for touch interactions and mobile workflows

### User Experience Principles
- **Minimal Click Philosophy**: Reduce steps needed to complete common tasks
- **Visual Hierarchy**: Clear priority indicators and status colors
- **Progressive Disclosure**: Show essential info first, expand for details
- **Consistent Interactions**: Same patterns across all features
- **Performance First**: Fast loading and smooth animations

### Technical Constraints
- Must maintain backward compatibility with existing Google Sheets data
- Support for concurrent usage by small teams (no complex locking needed)
- Budget-conscious development (leverage free tiers and simple hosting)
- Easy deployment and maintenance for non-technical stakeholders

## Feature Roadmap

### Current Features (v1.0)
- ✅ Task management with drag-and-drop
- ✅ User authentication and role-based access
- ✅ Sprint management and tracking
- ✅ Horizontal scrolling kanban board
- ✅ Mobile-optimized responsive design
- ✅ Google Sheets integration

### Planned Features (v1.1)
- [ ] Slack integration for real-time notifications
- [ ] Advanced search and filtering
- [ ] Task templates and quick creation
- [ ] Bulk operations for multiple tasks
- [ ] Dark/light theme toggle
- [ ] Keyboard shortcuts for power users

### Future Enhancements (v2.0)
- [ ] Time tracking and reporting
- [ ] Custom fields and task types
- [ ] Advanced analytics and insights
- [ ] Team collaboration features
- [ ] API webhooks for integrations
- [ ] Export functionality for reports

## Contributing

### Code Style
- Use consistent indentation (2 spaces)
- Add comments for complex logic
- Follow existing naming conventions
- Keep functions small and focused

### Git Workflow
- Create feature branches for new work
- Write descriptive commit messages
- Test changes before committing
- Keep commits focused and atomic

### Instructions
- Don't Added @-mention support with typeahead for custom agents. 
- don't mention @agent in the codebase
- don't add @agent in the any commits

### Contact
For questions or suggestions regarding this project, please contact:
**Shubhankar Mohan** - Project Designer and Lead Developer