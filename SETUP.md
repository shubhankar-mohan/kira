# 🚀 Kira Task Manager - Complete Setup Guide

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **Docker**: 20.x or higher (for containerized deployment)
- **Docker Compose**: 2.x or higher
- **Git**: For cloning the repository
- **Modern Browser**: Chrome, Firefox, Safari, or Edge

### Accounts Required
- **Google Cloud Platform**: For Google Sheets API access
- **Slack Workspace**: For Slack integration
- **Domain/Server**: For production deployment (optional for development)

## 🛠️ Installation Methods

### Method 1: Docker Deployment (Recommended)

#### Quick Start
```bash
# Clone the repository
git clone <your-repo-url>
cd kira

# Create environment file
cp .env.example .env
# Edit .env with your configuration (see Environment Variables section)

# Deploy with Docker
chmod +x deploy.sh
./deploy.sh
```

#### Manual Docker Commands
```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Method 2: Local Development Setup

#### Backend Setup
```bash
# Navigate to project directory
cd /path/to/kira

# Install backend dependencies
cd backend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start backend server
npm run dev
```

#### Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Start development server
python3 -m http.server 3000
# OR
npx http-server -p 3000
# OR
php -S localhost:3000
```

## 🔧 Environment Configuration

### Complete .env File Template

Create a `.env` file in the project root with the following variables:

```env
# ===========================================
# CORE APPLICATION CONFIGURATION
# ===========================================

# Application Environment
NODE_ENV=development
PORT=3001

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
FRONTEND_BASE_URL=http://localhost:3000

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# ===========================================
# DATABASE CONFIGURATION
# ===========================================

# Database Type (mysql or sheets for legacy)
DB_TYPE=mysql

# MySQL Configuration
DB_HOST=localhost
DB_PORT=3307
DB_NAME=kira_db
DB_USER=kira_user
DB_PASSWORD=change_me_secure_password
DATABASE_URL=mysql://kira_user:change_me_secure_password@localhost:3307/kira_db

# MySQL Root Password (for Docker)
MYSQL_ROOT_PASSWORD=root_secure_password

# ===========================================
# REDIS CONFIGURATION
# ===========================================

# Redis Connection
REDIS_URL=redis://localhost:6379

# ===========================================
# GOOGLE SHEETS CONFIGURATION (Legacy)
# ===========================================

# Google Sheets API Credentials
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your_actual_spreadsheet_id_here

# Alternative: JSON credentials (if using service account JSON file)
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# ===========================================
# SLACK INTEGRATION CONFIGURATION
# ===========================================

# Core Slack Settings
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
SLACK_APP_TOKEN=xapp-your-app-token-here

# Slack Channel Configuration
SLACK_NOTIFICATIONS_CHANNEL=#general
SLACK_ALERTS_CHANNEL=#alerts
SLACK_STANDUP_CHANNEL=#standup
SLACK_DEV_CHANNEL=#development
SLACK_RELEASES_CHANNEL=#releases
SLACK_REPORTS_CHANNEL=#sprint-reports
SLACK_TASKS_CHANNEL=#tasks

# Slack Feature Toggles
SLACK_ENABLE_SCHEDULED_REPORTS=true
SLACK_PORT=3001

# Slack Security Configuration
SLACK_ALLOWED_IPS=192.168.1.100,10.0.0.1
SLACK_RATE_LIMIT_WINDOW_MS=60000
SLACK_RATE_LIMIT_MAX=60

# Legacy Slack Webhook (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# ===========================================
# SEEDING CONFIGURATION
# ===========================================

# Default Admin User
SEED_ADMIN_EMAIL=admin@kira.local
SEED_ADMIN_NAME=Kira Admin
```

### Environment Variables Explained

#### Core Application Variables
- **NODE_ENV**: Application environment (`development`, `production`)
- **PORT**: Server port (default: 3001)
- **FRONTEND_URL**: Frontend application URL
- **JWT_SECRET**: Secret key for JWT token signing (use strong random string)

#### Database Variables
- **DB_TYPE**: Database type (`mysql` for new setup, `sheets` for legacy)
- **DB_HOST**: MySQL server hostname
- **DB_PORT**: MySQL server port (3307 for Docker, 3306 for local MySQL)
- **DB_NAME**: Database name
- **DB_USER**: Database username
- **DB_PASSWORD**: Database password
- **DATABASE_URL**: Complete database connection string
- **MYSQL_ROOT_PASSWORD**: MySQL root password (Docker only)

#### Redis Variables
- **REDIS_URL**: Redis connection string

#### Google Sheets Variables (Legacy Support)
- **GOOGLE_SHEETS_CLIENT_EMAIL**: Service account email
- **GOOGLE_SHEETS_PRIVATE_KEY**: Service account private key
- **GOOGLE_SHEETS_SPREADSHEET_ID**: Google Spreadsheet ID
- **GOOGLE_SHEETS_CREDENTIALS**: Complete service account JSON (alternative)

#### Slack Integration Variables
- **SLACK_BOT_TOKEN**: Bot user OAuth token (starts with `xoxb-`)
- **SLACK_SIGNING_SECRET**: Request signing secret
- **SLACK_APP_TOKEN**: App-level token (starts with `xapp-`)
- **SLACK_*_CHANNEL**: Channel names for different types of notifications
- **SLACK_ENABLE_SCHEDULED_REPORTS**: Enable automated reports (`true`/`false`)
- **SLACK_ALLOWED_IPS**: Comma-separated IP addresses for security
- **SLACK_RATE_LIMIT_***: Rate limiting configuration

## 🗄️ Database Setup

### MySQL Database Setup

#### Using Docker (Recommended)
```bash
# Start MySQL container
docker-compose up -d mysql

# Check container status
docker-compose ps mysql

# View MySQL logs
docker-compose logs mysql
```

#### Local MySQL Installation
```bash
# Install MySQL (Ubuntu/Debian)
sudo apt update
sudo apt install mysql-server

# Start MySQL service
sudo systemctl start mysql
sudo systemctl enable mysql

# Create database and user
mysql -u root -p
CREATE DATABASE kira_db;
CREATE USER 'kira_user'@'localhost' IDENTIFIED BY 'change_me_secure_password';
GRANT ALL PRIVILEGES ON kira_db.* TO 'kira_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Database Migration
```bash
# Navigate to backend directory
cd backend

# Install Prisma CLI
npm install -g prisma

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database with initial data
npm run prisma:seed
```

### Redis Setup

#### Using Docker
```bash
# Start Redis container
docker-compose up -d redis

# Check Redis connection
docker-compose exec redis redis-cli ping
```

#### Local Redis Installation
```bash
# Install Redis (Ubuntu/Debian)
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis connection
redis-cli ping
```

## 📊 Google Sheets API Setup (Legacy Support)

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "KiranaClub-TaskManager"
3. Enable Google Sheets API and Google Drive API

### Step 2: Create Service Account
1. Navigate to **APIs & Services > Credentials**
2. Click **Create Credentials > Service Account**
3. Name: `kirana-task-manager`
4. Grant **Editor** role
5. Create and download JSON key file

### Step 3: Create Google Spreadsheet
1. Create a new Google Sheet
2. Share it with the service account email (from JSON file)
3. Give **Editor** permissions
4. Copy the Spreadsheet ID from URL

### Step 4: Configure Environment
```env
# Extract values from JSON file
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your_actual_spreadsheet_id_here
```

## 🤖 Slack App Setup

### Step 1: Create Slack App
1. Visit [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Select **From an app manifest**
4. Use the provided `slack-app-manifest.yaml`
5. Replace `https://your-domain.com` with your actual domain
6. Create the app

### Step 2: Configure OAuth & Permissions
Required Bot Token Scopes:
- `app_mentions:read` - Listen for @kira mentions
- `channels:history` - Read channel messages
- `channels:join` - Join channels automatically
- `chat:write` - Send messages and notifications
- `commands` - Handle slash commands
- `reactions:read` & `reactions:write` - Emoji reactions
- `users:read` & `users:read.email` - User information
- `files:read` - File attachments

### Step 3: Configure Event Subscriptions
- **Request URL**: `https://yourdomain.com/api/slack/events`
- **Bot Events**:
  - `app_mention` - @kira mentions
  - `message.channels` - Channel messages
  - `reaction_added` - Emoji reactions

### Step 4: Configure Slash Commands
- **Command**: `/kira`
- **Request URL**: `https://yourdomain.com/api/slack/commands`
- **Description**: Kira task management commands
- **Usage Hint**: `create | close | status | burndown | workload | help`

### Step 5: Configure Interactivity
- **Request URL**: `https://yourdomain.com/api/slack/interactive`
- **Options Load URL**: `https://yourdomain.com/api/slack/options`

### Step 6: Install App to Workspace
1. Go to **OAuth & Permissions**
2. Click **Install to Workspace**
3. Copy the tokens to your `.env` file

### Step 7: Configure Environment Variables
```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
SLACK_APP_TOKEN=xapp-your-app-token-here
```

## 🐳 Docker Deployment

### Docker Compose Configuration
```yaml
# docker-compose.yml
services:
  mysql:
    image: mysql:8.0
    container_name: kira-mysql
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
      - MYSQL_USER=${DB_USER}
      - MYSQL_PASSWORD=${DB_PASSWORD}
    volumes:
      - ./data/mysql:/var/lib/mysql
    ports:
      - "3307:3306"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: kira-redis
    volumes:
      - ./data/redis:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  kira-app:
    build: .
    depends_on:
      - mysql
      - redis
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_TYPE=${DB_TYPE}
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_NAME=${DB_NAME}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
      - SLACK_SIGNING_SECRET=${SLACK_SIGNING_SECRET}
      - SLACK_APP_TOKEN=${SLACK_APP_TOKEN}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

### Production Environment Variables
```env
# Production Configuration
NODE_ENV=production
PORT=3001

# Database (Production)
DB_TYPE=mysql
DB_HOST=mysql
DB_PORT=3306
DB_NAME=kira_db
DB_USER=kira_user
DB_PASSWORD=production_secure_password
DATABASE_URL=mysql://kira_user:production_secure_password@mysql:3306/kira_db

# Redis (Production)
REDIS_URL=redis://redis:6379

# Slack (Production)
SLACK_BOT_TOKEN=xoxb-production-bot-token
SLACK_SIGNING_SECRET=production_signing_secret
SLACK_APP_TOKEN=xapp-production-app-token

# Security
JWT_SECRET=production_jwt_secret_very_long_and_secure
SLACK_ALLOWED_IPS=your.production.ip.address
```

## 🌐 Production Deployment

### VPS/Cloud Server Deployment

#### DigitalOcean Setup
```bash
# Create droplet (Ubuntu 20.04 LTS)
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone repository
git clone <your-repo-url>
cd kira

# Configure environment
cp .env.example .env
nano .env  # Edit with production values

# Deploy
chmod +x deploy.sh
./deploy.sh
```

#### AWS EC2 Setup
```bash
# Launch EC2 instance (Ubuntu 20.04 LTS)
# Install Docker and Docker Compose (same as above)
# Configure security groups for ports 80, 443, 3001
# Set up domain and SSL certificates
```

### Nginx Reverse Proxy
```nginx
# /etc/nginx/sites-available/kira
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL Certificate Setup
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🧪 Testing Your Setup

### Health Checks
```bash
# Application health
curl http://localhost:3001/health

# Database health
curl http://localhost:3001/api/health/database

# Slack integration health
curl http://localhost:3001/api/slack/health
```

### Functional Testing
1. **Web Interface**: Navigate to `http://localhost:3001`
2. **Login**: Use demo accounts or create new user
3. **Create Task**: Test task creation and management
4. **Slack Integration**: Test `@kira help` in Slack
5. **Database**: Verify data persistence in MySQL

### Slack Integration Testing
```bash
# Test Slack webhook
curl -X POST http://localhost:3001/api/slack/events \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test"}'

# Test slash command
curl -X POST http://localhost:3001/api/slack/commands \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "command=/kira&text=help&user_id=U123456"
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
**Symptoms**: `Error: connect ECONNREFUSED`
**Solutions**:
```bash
# Check MySQL container
docker-compose ps mysql
docker-compose logs mysql

# Verify environment variables
echo $DATABASE_URL

# Test connection
mysql -h localhost -P 3307 -u kira_user -p kira_db
```

#### 2. Slack Integration Not Working
**Symptoms**: @kira mentions ignored, commands failing
**Solutions**:
```bash
# Check Slack tokens
echo $SLACK_BOT_TOKEN
echo $SLACK_SIGNING_SECRET

# Verify webhook URLs are accessible
curl -X POST https://yourdomain.com/api/slack/events

# Check Slack app permissions
# Review bot token scopes in Slack app settings
```

#### 3. Redis Connection Failed
**Symptoms**: `Error: connect ECONNREFUSED 127.0.0.1:6379`
**Solutions**:
```bash
# Check Redis container
docker-compose ps redis
docker-compose logs redis

# Test Redis connection
redis-cli ping
```

#### 4. Google Sheets API Errors
**Symptoms**: `Error: The caller does not have permission`
**Solutions**:
- Verify service account email has access to spreadsheet
- Check private key format (newlines must be `\n`)
- Ensure Google Sheets API is enabled
- Verify spreadsheet ID is correct

#### 5. Port Already in Use
**Symptoms**: `Error: listen EADDRINUSE :::3001`
**Solutions**:
```bash
# Find process using port
sudo lsof -i :3001

# Kill process
sudo kill -9 <PID>

# Or change port in .env
PORT=3002
```

### Debug Mode
```bash
# Enable debug logging
NODE_ENV=development
DEBUG=kira:*

# View detailed logs
docker-compose logs -f kira-app
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Monitor database performance
docker-compose exec mysql mysql -u root -p -e "SHOW PROCESSLIST;"

# Check Redis memory usage
docker-compose exec redis redis-cli INFO memory
```

## 📚 Additional Resources

### Documentation
- **Architecture Guide**: See `ARCHITECTURE.md`
- **Slack Integration**: See `SLACK.md`
- **API Reference**: Available at `/api/docs` (when implemented)

### Support
- **GitHub Issues**: Report bugs and feature requests
- **Community**: Connect with other Kira users
- **Documentation**: Comprehensive guides and tutorials

### Updates
- **Version Control**: Track changes and updates
- **Migration Guides**: Database and configuration updates
- **Security Updates**: Regular security patches and updates

---

**Setup Status**: Complete with comprehensive environment configuration
**Next Steps**: Configure Slack integration and test all features
**Support**: Check troubleshooting section for common issues
