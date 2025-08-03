#!/bin/bash

# KiranaClub Task Manager Docker Deployment Script

echo "🚀 Deploying KiranaClub Task Manager with Docker..."

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
        echo "📝 Please edit .env with your production credentials before continuing."
    else
        echo "❌ .env.example not found. Please create a .env file with your credentials."
        exit 1
    fi
fi

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
    echo "🎉 KiranaClub Task Manager is now running!"
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
    echo "   Admin: admin@kirana.club / admin123"
    echo "   Manager: manager@kirana.club / manager123"
    echo "   Developer: dev@kirana.club / dev123"
else
    echo "❌ Failed to start application. Check the logs above."
    exit 1
fi 