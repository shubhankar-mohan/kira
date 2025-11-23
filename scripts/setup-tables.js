#!/usr/bin/env node
/**
 * Manual table setup script for when Prisma schema engine fails (P1017 error).
 * This creates all tables defined in backend/prisma/schema.prisma using raw SQL.
 *
 * Usage: node scripts/setup-tables.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'mysql://kira_user:change_me_secure_password@127.0.0.1:3307/kira_db';

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  multipleStatements: true
};

const schema = `
-- Kira Task Manager Schema (MySQL)
-- Generated from backend/prisma/schema.prisma

CREATE TABLE IF NOT EXISTS User (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  passwordHash VARCHAR(255),
  role ENUM('Admin', 'Manager', 'Developer') DEFAULT 'Developer',
  avatarUrl VARCHAR(500),
  isActive BOOLEAN DEFAULT TRUE,
  lastLoginAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_role (role),
  INDEX idx_user_isActive (isActive)
);

CREATE TABLE IF NOT EXISTS Sprint (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  week INT NOT NULL,
  startDate DATETIME,
  endDate DATETIME,
  status ENUM('Planned', 'Active', 'Completed') DEFAULT 'Planned',
  description TEXT,
  goal TEXT,
  isCurrent BOOLEAN DEFAULT FALSE,
  createdById CHAR(36),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (createdById) REFERENCES User(id),
  INDEX idx_sprint_week (week),
  INDEX idx_sprint_status (status),
  INDEX idx_sprint_isCurrent (isCurrent),
  INDEX idx_sprint_dates (startDate, endDate)
);

CREATE TABLE IF NOT EXISTS Task (
  id CHAR(36) PRIMARY KEY,
  displayId INT UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status ENUM('PENDING', 'IN_PROGRESS', 'DONE', 'PRODUCT_BLOCKED', 'ENGG_BLOCKED', 'DEV_TESTING', 'PRODUCT_TESTING', 'NOT_REQUIRED') DEFAULT 'PENDING',
  priority ENUM('P0', 'P1', 'P2', 'BACKLOG') DEFAULT 'BACKLOG',
  type ENUM('Feature', 'Bug', 'Improvement', 'Task') DEFAULT 'Task',
  storyPoints INT DEFAULT 0,
  estimatedPoints INT DEFAULT 0,
  orderIndex INT DEFAULT 0,
  tags JSON,
  metadata JSON,
  sprintId CHAR(36),
  parentTaskId CHAR(36),
  slackThreadTs VARCHAR(50),
  slackChannelId VARCHAR(50),
  createdFrom ENUM('Web', 'Slack', 'API') DEFAULT 'Web',
  createdById CHAR(36),
  updatedById CHAR(36),
  completedAt DATETIME,
  dueDate DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sprintId) REFERENCES Sprint(id),
  FOREIGN KEY (parentTaskId) REFERENCES Task(id),
  FOREIGN KEY (createdById) REFERENCES User(id),
  FOREIGN KEY (updatedById) REFERENCES User(id),
  INDEX idx_task_status (status),
  INDEX idx_task_priority (priority),
  INDEX idx_task_type (type),
  INDEX idx_task_sprintId (sprintId),
  INDEX idx_task_parentTaskId (parentTaskId),
  INDEX idx_task_createdAt (createdAt),
  INDEX idx_task_dueDate (dueDate),
  INDEX idx_task_orderIndex (orderIndex),
  INDEX idx_task_slackThreadTs (slackThreadTs),
  INDEX idx_task_slackChannelId (slackChannelId)
);

CREATE TABLE IF NOT EXISTS TaskSequence (
  id INT PRIMARY KEY AUTO_INCREMENT
);

CREATE TABLE IF NOT EXISTS TaskAssignment (
  taskId CHAR(36) NOT NULL,
  userId CHAR(36) NOT NULL,
  role ENUM('Assignee', 'Reviewer', 'Watcher') DEFAULT 'Assignee',
  assignedById CHAR(36),
  assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (taskId, userId, role),
  FOREIGN KEY (taskId) REFERENCES Task(id),
  FOREIGN KEY (userId) REFERENCES User(id),
  FOREIGN KEY (assignedById) REFERENCES User(id),
  INDEX idx_assignment_userId (userId),
  INDEX idx_assignment_role (role)
);

CREATE TABLE IF NOT EXISTS Comment (
  id CHAR(36) PRIMARY KEY,
  taskId CHAR(36) NOT NULL,
  userId CHAR(36),
  authorName VARCHAR(255),
  content TEXT NOT NULL,
  commentType ENUM('Comment', 'Status_Change', 'Assignment', 'System') DEFAULT 'Comment',
  metadata JSON,
  parentCommentId CHAR(36),
  isEdited BOOLEAN DEFAULT FALSE,
  slackTs VARCHAR(50),
  slackChannelId VARCHAR(50),
  source ENUM('Web', 'Slack', 'System') DEFAULT 'Web',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (taskId) REFERENCES Task(id),
  FOREIGN KEY (userId) REFERENCES User(id),
  FOREIGN KEY (parentCommentId) REFERENCES Comment(id),
  INDEX idx_comment_taskId (taskId),
  INDEX idx_comment_userId (userId),
  INDEX idx_comment_createdAt (createdAt),
  INDEX idx_comment_commentType (commentType),
  INDEX idx_comment_slackTs (slackTs),
  INDEX idx_comment_source (source)
);

CREATE TABLE IF NOT EXISTS SlackThread (
  id CHAR(36) PRIMARY KEY,
  taskId CHAR(36) NOT NULL,
  channelId VARCHAR(50) NOT NULL,
  threadTs VARCHAR(50) NOT NULL,
  createdById CHAR(36),
  isActive BOOLEAN DEFAULT TRUE,
  lastActivityAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  messageCount INT DEFAULT 0,
  FOREIGN KEY (taskId) REFERENCES Task(id),
  FOREIGN KEY (createdById) REFERENCES User(id),
  UNIQUE KEY uniq_slack_channel_thread (channelId, threadTs),
  INDEX idx_slackthread_taskId (taskId),
  INDEX idx_slackthread_channelId (channelId),
  INDEX idx_slackthread_isActive (isActive)
);

CREATE TABLE IF NOT EXISTS Event (
  id CHAR(36) PRIMARY KEY,
  aggregateType ENUM('Task', 'Comment', 'User', 'Sprint') NOT NULL,
  aggregateId CHAR(36) NOT NULL,
  eventType VARCHAR(100) NOT NULL,
  eventData JSON NOT NULL,
  source ENUM('Web', 'Slack', 'System') NOT NULL,
  userId CHAR(36),
  slackEventId VARCHAR(100) UNIQUE,
  slackThreadTs VARCHAR(50),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  processedAt DATETIME,
  FOREIGN KEY (userId) REFERENCES User(id),
  INDEX idx_event_aggregate (aggregateType, aggregateId),
  INDEX idx_event_createdAt (createdAt),
  INDEX idx_event_source (source),
  INDEX idx_event_processedAt (processedAt)
);

CREATE TABLE IF NOT EXISTS ActivityLog (
  id CHAR(36) PRIMARY KEY,
  entityType ENUM('Task', 'Sprint', 'User', 'Comment') NOT NULL,
  entityId CHAR(36) NOT NULL,
  userId CHAR(36),
  action VARCHAR(100) NOT NULL,
  oldValues JSON,
  newValues JSON,
  source ENUM('Web', 'Slack', 'System') NOT NULL,
  slackThreadTs VARCHAR(50),
  ipAddress VARCHAR(45),
  userAgent TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES User(id),
  INDEX idx_activity_entity (entityType, entityId),
  INDEX idx_activity_userId (userId),
  INDEX idx_activity_action (action),
  INDEX idx_activity_source (source),
  INDEX idx_activity_createdAt (createdAt)
);
`;

async function main() {
  console.log('Connecting to MySQL...', { host: config.host, port: config.port, database: config.database });

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('Connected successfully.');

    console.log('Creating tables...');
    await conn.query(schema);
    console.log('Tables created successfully!');

    const [tables] = await conn.query('SHOW TABLES');
    console.log('Tables in database:', tables.map(t => Object.values(t)[0]).join(', '));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();