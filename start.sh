#!/bin/bash

# KiranaClub Task Manager Startup Script (Single Server)

echo "🏪 Starting KiranaClub Task Manager..."
echo "🔄 Single server mode: Backend serves frontend on port 3001"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Navigate to backend directory
cd backend

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from example..."
    cp .env.example .env
    echo "📝 Please edit backend/.env with your Google Sheets credentials before continuing."
    echo "📖 See README.md for detailed setup instructions."
    exit 1
fi

# Start the single server (backend serves frontend)
echo "🚀 Starting KiranaClub Task Manager on port 3001..."
echo "🔄 Backend will serve frontend files with client-side routing"
npm start &
SERVER_PID=$!

# Wait a moment for server to start
sleep 5

# Check if server is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Server is running successfully!"
else
    echo "❌ Server failed to start. Check the logs above."
    exit 1
fi

# Test frontend serving
if curl -s http://localhost:3001/ | grep -q "Kira Task Manager"; then
    echo "✅ Frontend is being served correctly!"
else
    echo "⚠️  Frontend serving might have issues. Check the logs above."
fi

echo ""
echo "🎉 KiranaClub Task Manager is now running!"
echo "📱 Application: http://localhost:3001"
echo "📊 Health Check: http://localhost:3001/health"
echo "🔌 API Endpoints: http://localhost:3001/api/*"
echo ""
echo "🔐 Demo Login Credentials:"
echo "   Admin: admin@kirana.club / admin123"
echo "   Manager: manager@kirana.club / manager123"
echo "   Developer: dev@kirana.club / dev123"
echo ""
echo "📋 Available URLs:"
echo "   Dashboard: http://localhost:3001/dashboard"
echo "   Task Board: http://localhost:3001/board"
echo "   Sprints: http://localhost:3001/sprints"
echo "   Task Details: http://localhost:3001/task/{taskId}"
echo ""
echo "⚠️  Don't forget to configure your Google Sheets credentials in backend/.env"
echo "📖 See README.md for complete setup instructions"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for user interrupt
trap "echo ''; echo '🛑 Stopping server...'; kill $SERVER_PID; exit 0" INT
wait $SERVER_PID
