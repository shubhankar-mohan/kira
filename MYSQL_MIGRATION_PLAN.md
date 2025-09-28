# Kira Task Manager - MySQL Migration Plan

**Author:** Shubhankar Mohan  
**Project:** KiranaClub Task Management System  
**Version:** 2.0 Migration Plan  
**Date:** 2025-09-27  

## Executive Summary

This document outlines the comprehensive migration plan from Google Sheets to MySQL database for the Kira Task Manager. **This migration prioritizes Slack as a first-class citizen**, treating it as the primary interface for 60-70% of user interactions. The migration addresses performance limitations, API rate limits, and scalability concerns while introducing event-driven architecture, real-time synchronization, and microservices with Traefik gateway.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Migration Objectives](#migration-objectives)
3. [Technical Architecture](#technical-architecture)
4. [Database Schema Design](#database-schema-design)
5. [Docker Infrastructure](#docker-infrastructure)
6. [Implementation Phases](#implementation-phases)
7. [Migration Strategy](#migration-strategy)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Guide](#deployment-guide)
10. [Risk Assessment](#risk-assessment)
11. [Success Metrics](#success-metrics)

## Current State Analysis

### Limitations of Google Sheets Backend
- **API Rate Limits**: 100 requests per 100 seconds per user
- **Performance**: 2-5 seconds per API call
- **Scalability**: Degrades with sheet size (>1000 rows)
- **Concurrency**: Limited concurrent access
- **Query Complexity**: No complex filtering/sorting
- **Data Integrity**: No foreign key constraints
- **Backup**: Manual export processes

### Current Usage Metrics
- Average tasks: 200-500 per project
- Active users: 5-15 per instance
- Daily API calls: 500-1000
- Average response time: 3-4 seconds

## Migration Objectives

### Primary Goals
1. **Performance**: Reduce query time from 3-4s to <100ms
2. **Scalability**: Support 10,000+ tasks and 100+ users
3. **Reliability**: Remove external API dependencies
4. **Cost**: Eliminate Google Sheets API costs
5. **Features**: Enable advanced querying and reporting

### Secondary Goals
1. **Easy Deployment**: One-command Docker setup
2. **Data Migration**: Seamless transition from existing data
3. **Backup/Recovery**: Automated data protection
4. **Monitoring**: Health checks and performance metrics
5. **Security**: Enhanced data protection

## Technical Architecture

### System Overview - Event-Driven Microservices with Slack-First Design
```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│   Slack     │    │   Traefik    │    │   Event     │    │   MySQL     │
│   Bot       │◄──►│   Gateway    │◄──►│   Bus       │◄──►│   Database  │
│  (Primary)  │    │ (Auto-disco) │    │  (Redis)    │    │ (Optimized) │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
       ▲                   ▲                   ▲                   ▲
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│   Web UI    │    │   API        │    │  Background │    │   Backup    │
│ (Secondary) │    │  Services    │    │  Workers    │    │   Service   │
│             │    │ (Task/User)  │    │ (Sync Jobs) │    │             │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
```

**Key Principles:**
- **Slack-First**: 60-70% of interactions happen via Slack
- **Real-time Sync**: Bi-directional synchronization between Slack and Web UI
- **Event-Driven**: All changes flow through Redis event bus
- **Microservices**: Separated concerns with auto-discovery via Traefik

### Technology Stack
- **Database**: MySQL 8.0 (with InnoDB engine)
- **Backend**: Node.js with Express.js (Microservices)
- **ORM**: Sequelize or Prisma
- **Event Bus**: Redis Streams for real-time sync
- **Container**: Docker & Docker Compose
- **Frontend**: Vanilla JavaScript (enhanced for Slack integration)
- **Reverse Proxy**: Traefik (with auto-discovery)
- **Slack Integration**: Primary interface with bi-directional sync

## Database Schema Design

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255), -- For future auth enhancement
  role ENUM('Admin', 'Manager', 'Developer') DEFAULT 'Developer',
  avatar_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Sprints Table
```sql
CREATE TABLE sprints (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  week INT NOT NULL,
  start_date DATE,
  end_date DATE,
  status ENUM('Planned', 'Active', 'Completed') DEFAULT 'Planned',
  description TEXT,
  goal TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_week (week),
  INDEX idx_status (status),
  INDEX idx_current (is_current),
  INDEX idx_dates (start_date, end_date),
  UNIQUE KEY unique_current_sprint (is_current, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Tasks Table (Enhanced for Slack Integration)
```sql
CREATE TABLE tasks (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status ENUM('PENDING', 'IN_PROGRESS', 'DONE', 'PRODUCT-BLOCKED', 'ENGG-BLOCKED', 'DEV-TESTING', 'NOT-REQUIRED') DEFAULT 'PENDING',
  priority ENUM('P0', 'P1', 'P2', 'Backlog') DEFAULT 'Backlog',
  type ENUM('Feature', 'Bug', 'Improvement', 'Task') DEFAULT 'Task',
  story_points INT DEFAULT 0,
  estimated_points INT DEFAULT 0,
  sprint_id VARCHAR(36),
  parent_task_id VARCHAR(36), -- For subtasks
  order_index INT DEFAULT 0,
  tags JSON, -- For flexible tagging
  metadata JSON, -- For extensibility
  
  -- Slack Integration Fields
  slack_thread_ts VARCHAR(50), -- Primary Slack thread
  slack_channel_id VARCHAR(50), -- Channel where task was created
  created_from ENUM('Web', 'Slack', 'API') DEFAULT 'Web',
  
  -- Standard Fields
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  completed_at TIMESTAMP NULL,
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_type (type),
  INDEX idx_sprint (sprint_id),
  INDEX idx_parent (parent_task_id),
  INDEX idx_created (created_at),
  INDEX idx_due_date (due_date),
  INDEX idx_order (order_index),
  INDEX idx_slack_thread (slack_thread_ts),
  INDEX idx_slack_channel (slack_channel_id),
  INDEX idx_created_from (created_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Task Assignments Table
```sql
CREATE TABLE task_assignments (
  task_id VARCHAR(36),
  user_id VARCHAR(36),
  role ENUM('Assignee', 'Reviewer', 'Watcher') DEFAULT 'Assignee',
  assigned_by VARCHAR(36),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (task_id, user_id, role),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_user (user_id),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Comments Table (Enhanced for Slack Sync)
```sql
CREATE TABLE comments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  content TEXT NOT NULL,
  comment_type ENUM('Comment', 'Status_Change', 'Assignment', 'System') DEFAULT 'Comment',
  metadata JSON, -- For system comments data
  parent_comment_id VARCHAR(36), -- For threaded comments
  is_edited BOOLEAN DEFAULT FALSE,
  
  -- Slack Integration Fields
  slack_ts VARCHAR(50), -- Slack message timestamp
  slack_channel_id VARCHAR(50), -- Channel where comment was posted
  source ENUM('Web', 'Slack', 'System') DEFAULT 'Web',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  
  INDEX idx_task (task_id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  INDEX idx_type (comment_type),
  INDEX idx_slack_ts (slack_ts),
  INDEX idx_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Slack Threads Table (New)
```sql
CREATE TABLE slack_threads (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id VARCHAR(36) NOT NULL,
  channel_id VARCHAR(50) NOT NULL,
  thread_ts VARCHAR(50) NOT NULL,
  created_by VARCHAR(36),
  is_active BOOLEAN DEFAULT TRUE,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  message_count INT DEFAULT 0,
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  
  UNIQUE KEY unique_thread (channel_id, thread_ts),
  INDEX idx_task (task_id),
  INDEX idx_channel (channel_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Events Table (Event Sourcing)
```sql
CREATE TABLE events (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  aggregate_type ENUM('Task', 'Comment', 'User', 'Sprint') NOT NULL,
  aggregate_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSON NOT NULL,
  source ENUM('Web', 'Slack', 'System') NOT NULL,
  user_id VARCHAR(36),
  slack_event_id VARCHAR(100), -- For deduplication
  slack_thread_ts VARCHAR(50), -- Link to Slack thread
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_aggregate (aggregate_type, aggregate_id),
  INDEX idx_created (created_at),
  INDEX idx_source (source),
  INDEX idx_slack_event (slack_event_id),
  INDEX idx_processed (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Activity Log Table (Enhanced)
```sql
CREATE TABLE activity_log (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  entity_type ENUM('Task', 'Sprint', 'User', 'Comment') NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  action VARCHAR(100) NOT NULL,
  old_values JSON,
  new_values JSON,
  source ENUM('Web', 'Slack', 'System') NOT NULL,
  slack_thread_ts VARCHAR(50),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_source (source),
  INDEX idx_created (created_at),
  INDEX idx_composite (entity_type, entity_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Database Indexes Strategy
- **Primary indexes**: All primary keys (UUID)
- **Foreign key indexes**: All foreign key columns
- **Query-specific indexes**: Status, priority, dates
- **Composite indexes**: Common query patterns
- **Full-text indexes**: Title and description search

### Data Relationships
```
Users ──┐
        ├─── Task Assignments ──── Tasks ──┐
        │                                  ├─── Comments
        └─── Activity Log                  │
                                          └─── Sprints
```

## Docker Infrastructure

### Directory Structure (Microservices with Traefik)
```
kira/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── deploy.sh
├── backup.sh
├── traefik/
│   ├── traefik.yml
│   ├── dynamic.yml
│   └── acme.json
├── database/
│   ├── init/
│   │   ├── 01-schema.sql
│   │   ├── 02-indexes.sql
│   │   ├── 03-seed-data.sql
│   │   └── 04-procedures.sql
│   ├── migrations/
│   └── backups/
├── services/
│   ├── api-gateway/
│   │   ├── Dockerfile
│   │   └── src/
│   ├── task-service/
│   │   ├── Dockerfile
│   │   └── src/
│   ├── slack-service/
│   │   ├── Dockerfile
│   │   └── src/
│   └── notification-service/
│       ├── Dockerfile
│       └── src/
└── frontend/
    ├── Dockerfile
    └── ...
```

### Docker Compose Configuration

#### Development Environment (Microservices with Traefik)
```yaml
# docker-compose.yml
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    container_name: kira-traefik-dev
    command:
      - "--api.dashboard=true"
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--log.level=DEBUG"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080" # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - kira-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.localhost`)"
      - "traefik.http.routers.dashboard.service=api@internal"

  redis:
    image: redis:7-alpine
    container_name: kira-redis-dev
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - kira-network

  mysql:
    image: mysql:8.0
    container_name: kira-mysql-dev
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/init:/docker-entrypoint-initdb.d:ro
      - ./database/conf:/etc/mysql/conf.d:ro
    command: --default-authentication-plugin=mysql_native_password
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      start_period: 30s
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - kira-network

  api-gateway:
    build: ./services/api-gateway
    container_name: kira-api-gateway-dev
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
      - TASK_SERVICE_URL=http://task-service:3001
      - SLACK_SERVICE_URL=http://slack-service:3002
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.localhost`) || PathPrefix(`/api`)"
      - "traefik.http.routers.api.entrypoints=web"
      - "traefik.http.services.api.loadbalancer.server.port=3000"
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - kira-network

  task-service:
    build: ./services/task-service
    container_name: kira-task-service-dev
    environment:
      - NODE_ENV=development
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_NAME=${DB_NAME}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_URL=redis://redis:6379
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - kira-network

  slack-service:
    build: ./services/slack-service
    container_name: kira-slack-service-dev
    environment:
      - NODE_ENV=development
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
      - SLACK_SIGNING_SECRET=${SLACK_SIGNING_SECRET}
      - REDIS_URL=redis://redis:6379
      - TASK_SERVICE_URL=http://task-service:3001
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.slack.rule=PathPrefix(`/slack`)"
      - "traefik.http.routers.slack.entrypoints=web"
      - "traefik.http.services.slack.loadbalancer.server.port=3002"
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - kira-network

  notification-service:
    build: ./services/notification-service
    container_name: kira-notification-service-dev
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
      - SLACK_SERVICE_URL=http://slack-service:3002
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - kira-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: development
    container_name: kira-frontend-dev
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`app.localhost`)"
      - "traefik.http.routers.frontend.entrypoints=web"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    networks:
      - kira-network

volumes:
  mysql_data:
    driver: local
  redis_data:
    driver: local

networks:
  kira-network:
    driver: bridge
```

#### Production Environment
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: kira-mysql-prod
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - mysql_backups:/backups
      - ./database/init:/docker-entrypoint-initdb.d:ro
      - ./database/conf/prod.cnf:/etc/mysql/conf.d/prod.cnf:ro
    command: --default-authentication-plugin=mysql_native_password
    restart: always
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      start_period: 30s
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - kira-network
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: kira-backend-prod
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_NAME=${DB_NAME}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - LOG_LEVEL=info
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      mysql:
        condition: service_healthy
    restart: always
    networks:
      - kira-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    container_name: kira-nginx-prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
    restart: always
    networks:
      - kira-network

volumes:
  mysql_data:
    driver: local
  mysql_backups:
    driver: local

networks:
  kira-network:
    driver: bridge
```

### MySQL Configuration

#### Development Config
```ini
# database/conf/dev.cnf
[mysqld]
innodb_buffer_pool_size=128M
innodb_log_file_size=64M
max_connections=100
query_cache_size=32M
query_cache_type=1
slow_query_log=1
slow_query_log_file=/var/log/mysql/slow.log
long_query_time=2
```

#### Production Config
```ini
# database/conf/prod.cnf
[mysqld]
innodb_buffer_pool_size=512M
innodb_log_file_size=256M
innodb_flush_log_at_trx_commit=2
max_connections=200
query_cache_size=64M
query_cache_type=1
slow_query_log=1
slow_query_log_file=/var/log/mysql/slow.log
long_query_time=1
log_bin=mysql-bin
expire_logs_days=7
```

## Slack-First Architecture Implementation

### Real-Time Synchronization Strategy

#### Event-Driven Flow
```
Slack Action → Redis Event → Database Update → Web UI Update
Web Action → Redis Event → Database Update → Slack Notification
```

#### Key Synchronization Points
1. **Task Creation**: 
   - Slack: `@kira create task` → MySQL → Web UI real-time update
   - Web UI: Create task → MySQL → Slack thread creation

2. **Status Updates**:
   - Slack: Reactions (✅❌⚠️) → Status change → Web UI update
   - Web UI: Drag & drop → Status change → Slack notification

3. **Comments**:
   - Slack: Thread replies → MySQL comments → Web UI comments
   - Web UI: Add comment → MySQL → Slack thread reply

### Microservices Communication

#### Service Responsibilities
```
┌─────────────────┐
│  API Gateway    │ ← Routes requests, handles auth
│  (Port 3000)    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Task Service   │ ← CRUD operations, business logic
│  (Port 3001)    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Slack Service   │ ← Bot interactions, webhook handling
│  (Port 3002)    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│Notification Svc │ ← Email, push, Slack notifications
│  (Port 3003)    │
└─────────────────┘
```

#### Event Bus Patterns
```javascript
// Task creation event
{
  type: 'TASK_CREATED',
  source: 'SLACK',
  data: {
    taskId: 'uuid',
    title: 'Fix login bug',
    slackThreadTs: '1234567890.123',
    channelId: 'C1234567',
    createdBy: 'U9876543'
  }
}

// Status change event
{
  type: 'TASK_STATUS_CHANGED',
  source: 'WEB',
  data: {
    taskId: 'uuid',
    oldStatus: 'IN_PROGRESS',
    newStatus: 'DONE',
    changedBy: 'user-uuid'
  }
}
```

### Enhanced Slack Bot Capabilities

#### Advanced Commands
```bash
# Task Management
/kira create "Fix login bug" P1 @john @sarah 5 points due:2025-01-15
/kira assign T-123 @john @sarah
/kira status T-123 done "Fixed auth issue"
/kira comment T-123 "Need to test on staging"

# Sprint Management
/kira sprint create "Sprint 24.1" goal:"Improve UX" start:2025-01-01
/kira sprint add T-123 T-124 T-125
/kira burndown current
/kira velocity team

# Reporting
/kira standup
/kira my-tasks
/kira blocked-tasks
/kira team-health
```

#### Interactive Components
```javascript
// Task creation modal
{
  "type": "modal",
  "title": { "type": "plain_text", "text": "Create Task" },
  "blocks": [
    {
      "type": "input",
      "label": { "type": "plain_text", "text": "Title" },
      "element": { "type": "plain_text_input" }
    },
    {
      "type": "input", 
      "label": { "type": "plain_text", "text": "Priority" },
      "element": {
        "type": "static_select",
        "options": [
          { "text": { "type": "plain_text", "text": "P0 - Critical" }, "value": "P0" },
          { "text": { "type": "plain_text", "text": "P1 - High" }, "value": "P1" }
        ]
      }
    }
  ]
}
```

## Implementation Phases

### Phase 1: Foundation Setup (Week 1-2)
**Duration**: 10 days  
**Goal**: Basic infrastructure and database setup

#### Tasks:
1. **Database Schema Creation**
   - Design and create all tables
   - Define indexes and constraints
   - Create stored procedures for common operations
   - Set up database migrations framework

2. **Docker Infrastructure**
   - Create Docker Compose configurations
   - Set up development and production environments
   - Configure persistent volumes
   - Implement health checks

3. **Backend Database Layer**
   - Install and configure ORM (Sequelize/Prisma)
   - Create database connection management
   - Implement repository pattern
   - Add connection pooling

#### Deliverables:
- ✅ Complete database schema
- ✅ Working Docker Compose setup
- ✅ Database connection layer
- ✅ Basic CRUD operations

#### Success Criteria:
- Database starts and migrates successfully
- Backend connects to MySQL
- Basic operations (Create, Read, Update, Delete) work
- Docker containers are healthy

### Phase 2: Data Migration & API Updates (Week 3-4)
**Duration**: 10 days  
**Goal**: Migrate existing data and update all API endpoints

#### Tasks:
1. **Data Migration Tools**
   - Create Google Sheets export utility
   - Build data transformation scripts
   - Implement validation and error handling
   - Create rollback mechanisms

2. **API Layer Updates**
   - Replace Google Sheets service with MySQL
   - Update all CRUD operations
   - Implement proper error handling
   - Add input validation

3. **Advanced Features**
   - Implement complex queries (filtering, sorting)
   - Add pagination support
   - Create bulk operations
   - Implement transaction management

#### Migration Script Example:
```javascript
// scripts/migrate-from-sheets.js
const { GoogleSheetsService } = require('../backend/services/googleSheets');
const { DatabaseService } = require('../backend/services/database');

async function migrateData() {
  const sheets = new GoogleSheetsService();
  const db = new DatabaseService();
  
  // Migrate Users
  const users = await sheets.getUsers();
  await db.users.bulkCreate(users);
  
  // Migrate Sprints
  const sprints = await sheets.getSprints();
  await db.sprints.bulkCreate(sprints);
  
  // Migrate Tasks
  const tasks = await sheets.getTasks();
  await db.tasks.bulkCreate(tasks);
  
  // Migrate Assignments
  await migrateTaskAssignments(tasks);
}
```

#### Deliverables:
- ✅ Data migration scripts
- ✅ Updated API endpoints
- ✅ Validation and error handling
- ✅ Performance improvements

#### Success Criteria:
- 100% data migration accuracy
- All API endpoints work with MySQL
- Response times < 100ms for simple queries
- No data loss during migration

### Phase 3: Production Features (Week 5-6)
**Duration**: 10 days  
**Goal**: Production-ready features and deployment

#### Tasks:
1. **Backup and Recovery**
   - Automated daily backups
   - Point-in-time recovery
   - Backup validation
   - Disaster recovery procedures

2. **Monitoring and Logging**
   - Application health checks
   - Database performance monitoring
   - Structured logging
   - Error tracking and alerting

3. **Security Enhancements**
   - Database connection encryption
   - Input sanitization
   - SQL injection prevention
   - Access control improvements

4. **Setup Wizard**
   - Interactive configuration
   - Database connectivity testing
   - Initial data seeding
   - Environment validation

#### Deliverables:
- ✅ Backup and recovery system
- ✅ Monitoring and alerting
- ✅ Security hardening
- ✅ Setup wizard

#### Success Criteria:
- Automated backups working
- Health checks pass
- Security audit clean
- One-command deployment works

### Phase 4: Enhancement & Optimization (Week 7-8)
**Duration**: 10 days  
**Goal**: Performance optimization and advanced features

#### Tasks:
1. **Performance Optimization**
   - Query optimization
   - Index tuning
   - Connection pool optimization
   - Caching implementation

2. **Advanced Features**
   - Full-text search
   - Advanced reporting
   - Bulk operations
   - API rate limiting

3. **User Experience**
   - Real-time updates
   - Better error messages
   - Loading states
   - Offline support

#### Deliverables:
- ✅ Optimized performance
- ✅ Advanced features
- ✅ Enhanced user experience
- ✅ Complete documentation

#### Success Criteria:
- Sub-50ms query response times
- Advanced features working
- User acceptance testing passed
- Documentation complete

## Migration Strategy

### Pre-Migration Checklist
- [ ] Backup existing Google Sheets data
- [ ] Test Docker environment
- [ ] Validate database schema
- [ ] Test data migration scripts
- [ ] Prepare rollback plan

### Migration Steps

#### Step 1: Environment Preparation
```bash
# 1. Clone and setup
git clone <repository>
cd kira
cp .env.example .env

# 2. Configure environment
./setup.sh --interactive

# 3. Start MySQL
docker-compose up mysql -d

# 4. Verify database
docker-compose exec mysql mysql -u root -p -e "SHOW DATABASES;"
```

#### Step 2: Data Export
```bash
# Export from Google Sheets
node scripts/export-sheets-data.js --output ./migration/data.json

# Validate exported data
node scripts/validate-export.js --input ./migration/data.json
```

#### Step 3: Data Import
```bash
# Start application
docker-compose up -d

# Import data
node scripts/import-to-mysql.js --input ./migration/data.json

# Validate migration
node scripts/validate-migration.js
```

#### Step 4: Switch Backend
```bash
# Update environment to use MySQL
sed -i 's/DATABASE_TYPE=sheets/DATABASE_TYPE=mysql/' .env

# Restart backend
docker-compose restart backend

# Test API endpoints
npm run test:api
```

### Rollback Plan
1. **Immediate Rollback**: Switch DATABASE_TYPE back to sheets
2. **Data Rollback**: Restore from Google Sheets backup
3. **Full Rollback**: Revert to previous version

### Data Validation
- **Record Counts**: Verify all records migrated
- **Data Integrity**: Check relationships and constraints
- **Business Logic**: Validate business rules still work
- **Performance**: Ensure queries perform as expected

## Testing Strategy

### Unit Testing
```javascript
// tests/unit/database.test.js
describe('Database Layer', () => {
  test('should create task with valid data', async () => {
    const task = await db.tasks.create({
      title: 'Test Task',
      status: 'TODO',
      priority: 'P1'
    });
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test Task');
  });
  
  test('should handle duplicate email', async () => {
    await expect(db.users.create({
      email: 'duplicate@test.com',
      name: 'Test User'
    })).rejects.toThrow();
  });
});
```

### Integration Testing
```javascript
// tests/integration/api.test.js
describe('API Integration', () => {
  test('should create and retrieve task', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Integration Test Task',
        description: 'Test task for integration testing'
      })
      .expect(201);
    
    const taskId = response.body.id;
    
    const getResponse = await request(app)
      .get(`/api/tasks/${taskId}`)
      .expect(200);
    
    expect(getResponse.body.title).toBe('Integration Test Task');
  });
});
```

### Performance Testing
```javascript
// tests/performance/load.test.js
describe('Performance Tests', () => {
  test('should handle 100 concurrent task creations', async () => {
    const promises = Array(100).fill().map((_, i) => 
      request(app)
        .post('/api/tasks')
        .send({ title: `Task ${i}` })
    );
    
    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(5000); // 5 seconds max
  });
});
```

### Migration Testing
```bash
# Test migration with sample data
./scripts/test-migration.sh --sample-size 1000

# Test migration rollback
./scripts/test-rollback.sh

# Test data integrity
./scripts/verify-data-integrity.sh
```

## Deployment Guide

### Prerequisites
- Docker and Docker Compose installed
- Minimum 2GB RAM, 10GB disk space
- Network access for initial setup

### Quick Start Deployment
```bash
# 1. Download and extract
wget https://github.com/your-org/kira/releases/latest/kira.tar.gz
tar -xzf kira.tar.gz
cd kira

# 2. Run setup wizard
./setup.sh

# 3. Start application
./deploy.sh --env production

# 4. Verify deployment
curl http://localhost/health
```

### Setup Wizard Features
```bash
./setup.sh --interactive
```

The setup wizard will guide you through:
1. **Database Configuration**
   - Choose local MySQL or external server
   - Test database connectivity
   - Configure connection parameters

2. **Application Settings**
   - Set JWT secret
   - Configure ports
   - Set up SSL (optional)

3. **Initial Data**
   - Create admin user
   - Import from Google Sheets (optional)
   - Seed sample data (optional)

4. **Environment Validation**
   - Check system requirements
   - Validate configuration
   - Test deployment

### Manual Configuration

#### Environment Variables
```bash
# .env
# Database Configuration
DB_TYPE=mysql
DB_HOST=mysql
DB_PORT=3306
DB_NAME=kira_db
DB_USER=kira_user
DB_PASSWORD=secure_random_password

# MySQL Root Password
MYSQL_ROOT_PASSWORD=root_secure_password

# Application Settings
NODE_ENV=production
JWT_SECRET=your_jwt_secret_minimum_32_characters
BACKEND_PORT=5000
FRONTEND_PORT=80

# Security
SESSION_SECRET=your_session_secret
BCRYPT_ROUNDS=12

# Optional: External Database
# DB_HOST=your-mysql-server.com
# DB_SSL=true
```

#### Production Deployment
```bash
# 1. Production environment
cp .env.example .env.prod
# Edit .env.prod with production values

# 2. Deploy with production config
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 3. Set up SSL (optional)
./scripts/setup-ssl.sh --domain your-domain.com

# 4. Set up backups
./scripts/setup-backups.sh --schedule daily --retention 30
```

### Health Checks
```bash
# Application health
curl http://localhost/api/health

# Database health
curl http://localhost/api/health/database

# System status
docker-compose ps
```

## Risk Assessment

### High Risk Items

#### 1. Data Loss During Migration
**Risk Level**: High  
**Impact**: Critical business disruption  
**Mitigation**:
- Complete backup before migration
- Staged migration with validation
- Rollback procedures tested
- Parallel run for validation period

#### 2. Performance Degradation
**Risk Level**: Medium  
**Impact**: User experience affected  
**Mitigation**:
- Performance testing before deployment
- Database optimization
- Monitoring and alerting
- Gradual rollout

#### 3. Docker Deployment Issues
**Risk Level**: Medium  
**Impact**: Deployment delays  
**Mitigation**:
- Extensive testing in staging
- Setup wizard validation
- Clear documentation
- Support for manual installation

### Medium Risk Items

#### 1. Database Schema Evolution
**Risk Level**: Medium  
**Impact**: Future update complications  
**Mitigation**:
- Migration framework
- Version control for schema
- Automated migration testing
- Rollback capabilities

#### 2. Resource Requirements
**Risk Level**: Low  
**Impact**: Higher hosting costs  
**Mitigation**:
- Resource optimization
- Efficient queries
- Connection pooling
- Horizontal scaling options

### Risk Monitoring
- **Daily backup verification**
- **Performance metric tracking**
- **Error rate monitoring**
- **Resource utilization alerts**

## Success Metrics

### Performance Metrics
- **Query Response Time**: < 100ms (vs 3-4s current)
- **Page Load Time**: < 2s (vs 5-8s current)
- **Concurrent Users**: 100+ (vs 5-10 current)
- **Data Throughput**: 1000+ ops/sec

### Reliability Metrics
- **Uptime**: 99.9% (vs 95% current with API limits)
- **Error Rate**: < 0.1%
- **Data Consistency**: 100%
- **Backup Success Rate**: 100%

### User Experience Metrics
- **User Satisfaction**: Target 90%+
- **Task Creation Time**: < 30s
- **Search Response**: < 1s
- **Mobile Performance**: Equivalent to desktop

### Business Metrics
- **Cost Reduction**: 80% (eliminate API costs)
- **Scalability**: 10x current capacity
- **Feature Velocity**: 2x faster development
- **Maintenance Time**: 50% reduction

## Conclusion

This comprehensive migration plan transforms Kira from a Google Sheets-dependent application to a robust, scalable MySQL-based system. The Docker-based deployment ensures easy setup and maintenance, while the phased approach minimizes risk and ensures smooth transition.

The migration will result in:
- **30x performance improvement** (3s → 100ms queries)
- **Unlimited scalability** (no API rate limits)
- **Enhanced features** (complex queries, reporting)
- **Reduced costs** (no Google API fees)
- **Better reliability** (no external dependencies)

With proper execution of this plan, Kira will be positioned as an enterprise-ready task management solution capable of supporting large teams and complex workflows.

---

**Next Steps:**
1. Review and approve this migration plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Schedule regular progress reviews

**Contact:** Shubhankar Mohan - Lead Developer