#!/bin/bash

# Kira Task Manager Docker Deployment Script

echo "🚀 Deploying Kira Task Manager with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker version: $(docker --version)"
echo "✅ Docker Compose version: $(docker-compose --version)"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env file created with Docker container defaults"
        echo "📝 Edit .env to customize database passwords and add Slack tokens if needed"
    else
        echo "❌ .env.example not found. Please create a .env file with your credentials."
        exit 1
    fi
fi

# Ensure .env has production values for Docker networking
echo "🔧 Ensuring .env has correct Docker networking configuration..."
sed -i.bak 's/NODE_ENV=development/NODE_ENV=production/' .env 2>/dev/null || true
sed -i.bak 's/DB_HOST=localhost/DB_HOST=mysql/' .env 2>/dev/null || true
sed -i.bak 's/:3307/:3306/g' .env 2>/dev/null || true
sed -i.bak 's/redis:\/\/localhost:/redis:\/\/redis:/' .env 2>/dev/null || true
rm -f .env.bak 2>/dev/null || true

# Create logs directory
mkdir -p logs

# Build and start the application
echo "🔨 Building Docker image..."
docker-compose build

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
else
    echo "❌ Docker build failed. Check the logs above."
    exit 1
fi

echo "🚀 Starting application..."
docker-compose up -d

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Kira Task Manager is now running!"
    echo "📱 Application: http://localhost:3001"
    echo "📊 Health Check: http://localhost:3001/health"
    echo ""
    echo "📋 Useful commands:"
    echo "   View logs: docker-compose logs -f"
    echo "   Stop app: docker-compose down"
    echo "   Restart: docker-compose restart"
    echo "   Update: docker-compose pull && docker-compose up -d"
    echo ""
    echo "🔐 Demo Login Credentials:"
echo "   Admin: admin@example.com / admin123"
echo "   Manager: manager@example.com / manager123"
echo "   Developer: dev@example.com / dev123"
else
    echo "❌ Failed to start application. Check the logs above."
    exit 1
fi 