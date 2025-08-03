# 🚀 KiranaClub Task Manager - Deployment Guide

## 📋 Overview

This guide covers deploying the KiranaClub Task Manager as a single Docker container with both frontend and backend running on the same port.

## 🏗️ Architecture

### Single Server Deployment
- **Frontend**: Served by Node.js backend on port 3001
- **Backend API**: Same server, routes prefixed with `/api`
- **Client-side Routing**: Handled by backend serving `index.html`
- **Single Port**: Everything runs on port 3001

### Benefits
- ✅ No CORS issues
- ✅ Single port to manage
- ✅ Simplified deployment
- ✅ Better performance
- ✅ Easier SSL/TLS setup

## 🐳 Docker Deployment

### Prerequisites
- Docker and Docker Compose installed
- Google Sheets API credentials
- Slack App credentials

### Quick Start

1. **Clone and setup**:
```bash
git clone <your-repo>
cd kira
```

2. **Create environment file**:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Deploy**:
```bash
chmod +x deploy.sh
./deploy.sh
```

### Manual Docker Commands

```bash
# Build image
docker-compose build

# Start application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop application
docker-compose down
```

## 🔧 Environment Variables

Create a `.env` file with:

```env
# Google Sheets Configuration
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# Application Configuration
NODE_ENV=production
PORT=3001
```

## 🌐 Production Hosting Options

### 1. VPS/Cloud Server (Recommended)

**Providers**: DigitalOcean, AWS EC2, Google Cloud, Azure

**Setup**:
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Clone and deploy
git clone <your-repo>
cd kira
./deploy.sh
```

**Nginx Reverse Proxy** (for SSL):
```nginx
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

### 2. Docker Hosting Platforms

**Railway**:
- Connect GitHub repo
- Set environment variables
- Auto-deploy on push

**Render**:
- Create Web Service
- Connect GitHub repo
- Set environment variables

**Heroku**:
```bash
# Add Dockerfile
heroku container:push web
heroku container:release web
```

### 3. Kubernetes (Enterprise)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kira-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kira-app
  template:
    metadata:
      labels:
        app: kira-app
    spec:
      containers:
      - name: kira-app
        image: your-registry/kira-app:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: GOOGLE_SHEETS_CREDENTIALS
          valueFrom:
            secretKeyRef:
              name: kira-secrets
              key: google-sheets-credentials
```

## 🔒 Security Considerations

### 1. Environment Variables
- Never commit `.env` files
- Use secrets management in production
- Rotate credentials regularly

### 2. SSL/TLS
- Always use HTTPS in production
- Set up automatic SSL with Let's Encrypt
- Configure secure headers

### 3. Network Security
- Use firewall rules
- Restrict access to necessary ports only
- Consider VPN for admin access

### 4. Database Security
- Use service account for Google Sheets
- Limit API permissions
- Monitor access logs

## 📊 Monitoring & Logging

### Health Checks
```bash
# Application health
curl http://your-domain.com/health

# Docker health
docker ps
```

### Logs
```bash
# View application logs
docker-compose logs -f

# View system logs
journalctl -u docker
```

### Monitoring Tools
- **Prometheus + Grafana**: Metrics and dashboards
- **ELK Stack**: Log aggregation
- **Uptime Robot**: External monitoring

## 🔄 CI/CD Pipeline

### GitHub Actions Example
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Build and push Docker image
      run: |
        docker build -t your-registry/kira-app:${{ github.sha }} .
        docker push your-registry/kira-app:${{ github.sha }}
    
    - name: Deploy to server
      run: |
        ssh user@server "cd /app && docker-compose pull && docker-compose up -d"
```

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use**:
```bash
sudo lsof -i :3001
sudo kill -9 <PID>
```

2. **Docker build fails**:
```bash
docker system prune -a
docker-compose build --no-cache
```

3. **Environment variables not loaded**:
```bash
docker-compose down
docker-compose up -d
```

4. **SSL certificate issues**:
```bash
# Check certificate
openssl s_client -connect your-domain.com:443

# Renew Let's Encrypt
certbot renew
```

## 📈 Performance Optimization

### 1. Docker Optimizations
- Use multi-stage builds
- Optimize layer caching
- Use Alpine base images

### 2. Application Optimizations
- Enable gzip compression
- Use CDN for static assets
- Implement caching headers

### 3. Database Optimizations
- Cache frequently accessed data
- Optimize Google Sheets queries
- Use connection pooling

## 🔄 Backup Strategy

### 1. Application Data
```bash
# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/

# Backup environment
cp .env .env.backup-$(date +%Y%m%d)
```

### 2. Google Sheets
- Set up automated backups
- Use version control for important sheets
- Regular access audits

## 📞 Support

For deployment issues:
1. Check logs: `docker-compose logs -f`
2. Verify environment variables
3. Test connectivity to external services
4. Review security group/firewall settings

---

**Happy Deploying! 🚀** 