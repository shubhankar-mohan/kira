# 🏗️ Kira Task Manager - Technical Architecture

## 📋 Overview

Kira is a modern task management system built with a monolith-first approach, designed to scale from small teams to enterprise organizations. The architecture emphasizes real-time collaboration, intelligent automation, and seamless Slack integration.

## 🎯 System Architecture

### Current Architecture (v1.0)
```
┌─────────────────────────────────────────────────────────────┐
│                    Kira Task Manager                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend (SPA)          │  Backend (Node.js/Express)      │
│  ┌─────────────────────┐  │  ┌─────────────────────────────┐  │
│  │ Task Board         │  │  │ API Routes                 │  │
│  │ Sprint Dashboard   │  │  │ - /api/tasks               │  │
│  │ Team Management    │  │  │ - /api/sprints             │  │
│  │ User Interface     │  │  │ - /api/users               │  │
│  └─────────────────────┘  │  │ - /api/slack               │  │
│                           │  └─────────────────────────────┘  │
│                           │  ┌─────────────────────────────┐  │
│                           │  │ Services Layer              │  │
│                           │  │ - TaskService               │  │
│                           │  │ - SlackService              │  │
│                           │  │ - AuthService               │  │
│                           │  └─────────────────────────────┘  │
│                           │  ┌─────────────────────────────┐  │
│                           │  │ Data Layer                  │  │
│                           │  │ - Prisma ORM                │  │
│                           │  │ - MySQL Database            │  │
│                           │  │ - Redis Cache               │  │
│                           │  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Target Architecture (v2.0 - Microservices)
```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                              │
│                    (Traefik + Load Balancer)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │   Task      │  │   User      │  │   Slack     │  │ Analytics│ │
│  │  Service    │  │  Service    │  │  Service    │  │ Service  │ │
│  │             │  │             │  │             │  │          │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   MySQL     │  │   Redis     │  │   Event     │              │
│  │  Database   │  │   Cache     │  │   Bus       │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## 🗄️ Database Architecture

### MySQL Schema Design

#### Core Entities
```sql
-- Users and Authentication
User {
  id: UUID (Primary Key)
  email: String (Unique)
  name: String
  role: Enum (Admin, Manager, Developer)
  slackId: String (Optional)
  isActive: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}

-- Sprint Management
Sprint {
  id: UUID (Primary Key)
  name: String
  week: String (W26, W27, etc.)
  goal: String
  status: Enum (Planning, Active, Completed)
  startDate: DateTime
  endDate: DateTime
  isCurrent: Boolean
  createdById: UUID (FK to User)
  createdAt: DateTime
  updatedAt: DateTime
}

-- Task Management
Task {
  id: UUID (Primary Key)
  displayId: Int (Auto-increment for shortId)
  title: String
  description: Text
  status: Enum (Not Started, In Progress, Done, etc.)
  priority: Enum (P0, P1, P2, Backlog)
  type: Enum (Feature, Bug, Improvement)
  points: Int (Story points)
  sprintId: UUID (FK to Sprint, Optional)
  parentTaskId: UUID (FK to Task, Optional)
  dueDate: DateTime (Optional)
  createdById: UUID (FK to User)
  updatedById: UUID (FK to User)
  createdAt: DateTime
  updatedAt: DateTime
}

-- Task Assignments
TaskAssignment {
  taskId: UUID (FK to Task)
  userId: UUID (FK to User)
  role: Enum (Assignee, Reviewer, Watcher)
  assignedAt: DateTime
  @@id([taskId, userId, role])
}

-- Comments and Discussion
Comment {
  id: UUID (Primary Key)
  taskId: UUID (FK to Task)
  userId: UUID (FK to User)
  content: Text
  type: Enum (Comment, Status Change, Assignment)
  slackTs: String (Optional - Slack message timestamp)
  slackChannelId: String (Optional)
  createdAt: DateTime
}

-- Slack Integration
SlackThread {
  id: UUID (Primary Key)
  taskId: UUID (FK to Task)
  channelId: String
  threadTs: String
  isActive: Boolean
  messageCount: Int
  lastActivityAt: DateTime
  createdAt: DateTime
}

-- Event Sourcing
Event {
  id: UUID (Primary Key)
  type: String (TaskCreated, TaskUpdated, etc.)
  aggregateId: UUID
  data: JSON
  slackEventId: String (Optional - for deduplication)
  userId: UUID (FK to User)
  createdAt: DateTime
}

-- Activity Log
ActivityLog {
  id: UUID (Primary Key)
  taskId: UUID (FK to Task, Optional)
  userId: UUID (FK to User)
  action: String
  description: String
  metadata: JSON
  createdAt: DateTime
}
```

### Database Indexes
```sql
-- Performance Indexes
CREATE INDEX idx_task_status ON Task(status);
CREATE INDEX idx_task_priority ON Task(priority);
CREATE INDEX idx_task_sprint ON Task(sprintId);
CREATE INDEX idx_task_created_by ON Task(createdById);
CREATE INDEX idx_task_created_at ON Task(createdAt);
CREATE INDEX idx_comment_task ON Comment(taskId);
CREATE INDEX idx_comment_created_at ON Comment(createdAt);
CREATE INDEX idx_slack_thread_task ON SlackThread(taskId);
CREATE INDEX idx_event_aggregate ON Event(aggregateId);
CREATE INDEX idx_activity_task ON ActivityLog(taskId);

-- Composite Indexes for Common Queries
CREATE INDEX idx_task_status_priority ON Task(status, priority);
CREATE INDEX idx_task_sprint_status ON Task(sprintId, status);
CREATE INDEX idx_task_created_at_status ON Task(createdAt, status);
```

## 🔌 API Architecture

### REST API Design

#### Task Management
```
GET    /api/tasks              # List tasks with filtering/pagination
GET    /api/tasks/:id          # Get specific task
POST   /api/tasks              # Create new task
PUT    /api/tasks/:id          # Update task
DELETE /api/tasks/:id          # Delete task
POST   /api/tasks/bulk/status  # Bulk status update
POST   /api/tasks/bulk/assign  # Bulk assignment
POST   /api/tasks/bulk/delete  # Bulk deletion
GET    /api/tasks/search       # Search tasks
GET    /api/tasks/:id/comments # Get task comments
POST   /api/tasks/:id/comments # Add task comment
```

#### Sprint Management
```
GET    /api/sprints            # List sprints
GET    /api/sprints/:id        # Get specific sprint
POST   /api/sprints            # Create sprint
PUT    /api/sprints/:id        # Update sprint
DELETE /api/sprints/:id        # Delete sprint
GET    /api/sprints/current    # Get current sprint
```

#### User Management
```
GET    /api/users              # List users
GET    /api/users/:id          # Get specific user
POST   /api/users              # Create user
PUT    /api/users/:id          # Update user
DELETE /api/users/:id          # Delete user
```

#### Slack Integration
```
POST   /api/slack/events       # Slack event webhook
POST   /api/slack/commands     # Slack slash commands
POST   /api/slack/interactive  # Slack interactive components
GET    /api/slack/health       # Slack integration health
POST   /api/slack/sync-users   # Sync Slack users
```

#### Analytics & Reporting
```
GET    /api/activity/feed      # Activity feed
GET    /api/analytics/burndown # Sprint burndown data
GET    /api/analytics/velocity # Team velocity metrics
GET    /api/analytics/workload # Team workload analysis
```

### WebSocket Events
```javascript
// Real-time updates
socket.on('task-updated', (data) => {
  // Update task in UI
});

socket.on('comment-added', (data) => {
  // Add comment to task
});

socket.on('sprint-updated', (data) => {
  // Update sprint information
});
```

## 🔐 Security Architecture

### Authentication & Authorization
```javascript
// JWT Token Structure
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "Developer",
  "iat": 1640995200,
  "exp": 1641081600
}

// Role-based Access Control
const permissions = {
  Admin: ['*'],
  Manager: ['read:*', 'write:tasks', 'write:sprints'],
  Developer: ['read:*', 'write:own-tasks']
};
```

### Security Middleware
```javascript
// Request Validation
app.use(express.json({ limit: '10mb' }));
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Rate Limiting
const rateLimit = require('express-rate-limit');
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Slack Security
app.use('/api/slack/', slackSecurity({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  rateLimit: { windowMs: 60000, max: 60 }
}));
```

### Data Protection
- **Encryption**: All sensitive data encrypted at rest
- **Audit Logging**: Complete audit trail for compliance
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries only
- **XSS Protection**: Content Security Policy headers

## 🚀 Performance Architecture

### Caching Strategy
```javascript
// Multi-level Caching
const cacheStrategy = {
  L1: 'Browser Cache (Static Assets)',
  L2: 'CDN Cache (Global Distribution)',
  L3: 'Redis Cache (Application Data)',
  L4: 'Database Query Cache'
};

// Redis Cache Implementation
const redis = new Redis(process.env.REDIS_URL);
const cacheKey = `task:${taskId}`;
const cachedTask = await redis.get(cacheKey);
if (!cachedTask) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  await redis.setex(cacheKey, 300, JSON.stringify(task)); // 5 min TTL
}
```

### Database Optimization
```sql
-- Query Optimization Examples
-- Instead of loading all tasks then filtering:
SELECT * FROM Task WHERE status = 'In Progress' LIMIT 20;

-- Use proper joins to avoid N+1 queries:
SELECT t.*, u.name as createdByName 
FROM Task t 
JOIN User u ON t.createdById = u.id 
WHERE t.sprintId = ?;
```

### Background Job Processing
```javascript
// Job Queue with Redis
const Queue = require('bull');
const taskQueue = new Queue('task processing', process.env.REDIS_URL);

// Add job to queue
taskQueue.add('send-slack-notification', {
  taskId: 'uuid',
  userId: 'uuid',
  action: 'created'
});

// Process jobs
taskQueue.process('send-slack-notification', async (job) => {
  await slackService.sendTaskNotification(job.data);
});
```

## 🔄 Data Flow Architecture

### Task Creation Flow
```
1. User creates task (UI or Slack)
2. API validates input and permissions
3. Task saved to MySQL
4. Event logged to ActivityLog
5. Background job queued for Slack notification
6. Real-time update sent to connected clients
7. Slack notification sent asynchronously
```

### Slack Integration Flow
```
1. User mentions @kira in Slack
2. Slack sends webhook to /api/slack/events
3. Request validated with signing secret
4. Natural language parsed for task details
5. Task created in database
6. Slack thread created and linked
7. Confirmation sent back to Slack
8. Activity logged for audit trail
```

## 📊 Monitoring & Observability

### Health Checks
```javascript
// Application Health
GET /health
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 86400
}

// Database Health
GET /api/health/database
{
  "status": "healthy",
  "latency": "5ms",
  "connections": 3,
  "maxConnections": 20
}
```

### Metrics Collection
```javascript
// Performance Metrics
const metrics = {
  responseTime: 'P95 < 50ms',
  throughput: '1000+ req/sec',
  errorRate: '< 0.1%',
  availability: '99.9%'
};

// Business Metrics
const businessMetrics = {
  tasksCreated: 'Daily count',
  sprintVelocity: 'Points completed per sprint',
  teamUtilization: 'Workload distribution',
  slackEngagement: 'Mention frequency'
};
```

## 🐳 Deployment Architecture

### Docker Configuration
```yaml
# docker-compose.yml
services:
  kira-app:
    build: .
    ports: ["3001:3001"]
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://user:pass@mysql:3306/kira_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mysql
      - redis

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=secure_password
      - MYSQL_DATABASE=kira_db
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

### Production Considerations
- **Load Balancing**: Multiple app instances behind load balancer
- **Database Scaling**: Read replicas for query optimization
- **CDN Integration**: Static asset delivery optimization
- **SSL/TLS**: End-to-end encryption for all communications
- **Backup Strategy**: Automated database backups with point-in-time recovery

## 🔮 Future Architecture Evolution

### Microservices Migration Path
1. **Phase 1**: Extract Slack Service (Weeks 1-2)
2. **Phase 2**: Extract Task Service (Weeks 3-4)
3. **Phase 3**: Extract User Service (Weeks 5-6)
4. **Phase 4**: Extract Analytics Service (Weeks 7-8)
5. **Phase 5**: Implement Event-Driven Architecture (Weeks 9-12)

### Scalability Roadmap
- **Horizontal Scaling**: Multiple service instances
- **Database Sharding**: Partition data by organization
- **Event Sourcing**: Complete audit trail with CQRS
- **CQRS Implementation**: Separate read/write models
- **Message Queues**: Apache Kafka for event streaming

## 📚 Development Guidelines

### Code Organization
```
backend/
├── routes/           # API route handlers
├── services/         # Business logic layer
├── middleware/       # Express middleware
├── db/              # Database configuration
├── prisma/          # Database schema and migrations
└── config/          # Application configuration

frontend/
├── js/              # JavaScript modules
├── css/             # Stylesheets
├── assets/          # Static assets
└── index.html       # Main application file
```

### Testing Strategy
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Complete user workflow testing
- **Performance Tests**: Load and stress testing
- **Security Tests**: Vulnerability and penetration testing

---

**Architecture Status**: Production-ready monolith with microservices migration path
**Next Phase**: Extract Slack Service as first microservice
**Target**: Event-driven microservices architecture with CQRS
