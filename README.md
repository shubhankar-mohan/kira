# KiranaClub Task Manager

A comprehensive task management system built specifically for KiranaClub with Google Sheets integration. Features drag-and-drop task boards, sprint management, team collaboration, and real-time synchronization with Google Sheets.

## 🚀 Features

- **Task Management**: Create, edit, assign, and track tasks with drag-and-drop interface
- **Sprint Planning**: Organize tasks into sprints with progress tracking
- **Team Collaboration**: User management with role-based permissions
- **Google Sheets Integration**: Real-time sync with Google Sheets as database
- **Priority & Status Tracking**: P0-P2 priorities with complete workflow states
- **Comments & Discussion**: Task-level discussions and activity tracking
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 📋 Prerequisites

- Node.js 18.x or higher
- Google Cloud Platform account
- Google Sheets API access
- Modern web browser

## 🛠 Installation & Setup

### 1. Clone/Navigate to Project Directory

```bash
cd /Users/retailpulse/Documents/Shubhankar/kira
```

### 2. Backend Setup

```bash
cd backend
npm install
```

### 3. Google Sheets API Setup

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "KiranaClub-TaskManager"
3. Enable Google Sheets API and Google Drive API

#### Step 2: Create Service Account
1. Go to APIs & Services > Credentials
2. Create Credentials > Service Account
3. Name: `kirana-task-manager`
4. Grant "Editor" role
5. Create and download JSON key file

#### Step 3: Create Google Spreadsheet
1. Create a new Google Sheet
2. Share it with the service account email (from JSON file)
3. Give "Editor" permissions
4. Copy the Spreadsheet ID from URL

### 4. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual values
nano .env
```

Update the `.env` file with your Google Sheets credentials:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Google Sheets Configuration
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
GOOGLE_SHEETS_SPREADSHEET_ID="your_actual_spreadsheet_id_here"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-change-this"
FRONTEND_URL="http://localhost:3000"
```

### 5. Start the Backend Server

```bash
npm start
# or for development with auto-reload
npm run dev
```

The API will be available at `http://localhost:3001`

### 6. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Start a simple HTTP server (Python 3)
python3 -m http.server 3000

# OR using Node.js (if you have http-server installed globally)
npx http-server -p 3000

# OR using PHP
php -S localhost:3000
```

The application will be available at `http://localhost:3000`

## 📊 Google Sheets Structure

The application will automatically create the following sheets in your Google Spreadsheet:

### Tasks Sheet
| Column | Description |
|--------|-------------|
| Task ID | Unique identifier |
| Task | Task title |
| Status | Current status (Not started, In progress, etc.) |
| Priority | P0, P1, P2, Backlog |
| Description | Task description |
| Due date | Deadline |
| Assigned To | Email addresses (comma-separated) |
| Type | Feature, Bug, Improvement, etc. |
| Sprint Points | Story points (0-100) |
| Category | App, Backend, D2R, Engineering |
| Dev Testing Done By | Developer who tested |
| Product Testing Done By | Product team tester |
| Created time | Creation timestamp |
| Created by | Creator email |
| Last edited by | Last editor email |
| Last edited time | Last edit timestamp |
| Sprint Week | W18, W19, etc. |
| Further Development Needed | Additional notes |
| Sprint Spillover Task | Yes/No |
| Message | Additional messages |
| Attachment | File attachments |
| Year | 24, 25, etc. |

### Users Sheet
| Column | Description |
|--------|-------------|
| ID | User ID |
| Email | User email |
| Name | Display name |
| Role | Admin, Manager, Developer |
| Password Hash | Hashed password |
| Created Date | Registration date |
| Active | Active status |

### Sprints Sheet
| Column | Description |
|--------|-------------|
| ID | Sprint ID |
| Sprint Week | W18, W19, etc. |
| Goal | Sprint objective |
| Year | 24, 25, etc. |
| Status | Planning, Active, Completed |
| Start Date | Sprint start |
| End Date | Sprint end |
| Created By | Creator email |

### Comments Sheet
| Column | Description |
|--------|-------------|
| ID | Comment ID |
| Task ID | Associated task |
| User | Commenter name |
| Comment | Comment text |
| Timestamp | Comment time |

## 🔐 Authentication

Default demo accounts:
- **Admin**: `admin@kirana.club` / `admin123`
- **Manager**: `manager@kirana.club` / `manager123`
- **Developer**: `dev@kirana.club` / `dev123`

## 🎯 Usage

### Creating Tasks
1. Click "Create Task" button
2. Fill in task details (title, description, assignee, etc.)
3. Set priority, type, and sprint points
4. Assign to sprint or leave in backlog

### Managing Sprints
1. Go to Sprints section
2. Create new sprints with goals and timelines
3. Assign tasks to sprints
4. Track progress and completion rates

### Task Board Operations
- **Drag & Drop**: Move tasks between status columns
- **Filtering**: Filter by assignee, priority, type, or sprint
- **Task Details**: Click on tasks to view/edit details
- **Comments**: Add discussions to individual tasks

### Team Management (Admin Only)
1. Navigate to Team section
2. Add new team members with roles
3. View team member statistics and task assignments

## 🔄 Synchronization

The application automatically syncs with Google Sheets:
- **Real-time updates**: Changes are immediately saved to sheets
- **Manual sync**: Use the sync button to refresh data
- **Offline resilience**: Works offline, syncs when reconnected

## 🛡 Security Features

- JWT-based authentication
- Role-based access control
- Secure API endpoints
- Input validation and sanitization
- CORS protection

## 📱 Mobile Support

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones
- Different screen orientations

## 🚨 Troubleshooting

### Common Issues

**1. "Google Sheets initialization failed"**
- Check your service account credentials
- Verify the spreadsheet is shared with service account email
- Ensure Google Sheets API is enabled

**2. "API connection failed"**
- Make sure backend server is running on port 3001
- Check frontend is accessing correct API URL
- Verify CORS settings

**3. "Authentication errors"**
- Clear browser localStorage
- Check JWT secret configuration
- Verify user credentials

**4. "Tasks not syncing"**
- Check Google Sheets permissions
- Verify internet connection
- Check browser console for errors

### Logs and Debugging

Backend logs are available in the console:
```bash
cd backend
npm run dev
```

Check browser developer tools for frontend errors.

## 📈 Performance

- Optimized for teams up to 30 users
- Handles thousands of tasks efficiently
- Minimal API calls with smart caching
- Responsive UI with smooth animations

## 🔮 Future Enhancements

- Real-time notifications
- Advanced reporting and analytics
- File attachments
- Time tracking
- Integration with other tools (Slack, GitHub)
- Mobile app

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review Google Sheets API documentation
3. Check the GitHub issues (if applicable)

## 📄 License

MIT License - feel free to customize for your needs.

---

**Built with ❤️ for KiranaClub Team**
