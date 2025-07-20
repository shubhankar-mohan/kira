#!/bin/bash

# KiranaClub Task Manager Startup Script

echo "🏪 Starting KiranaClub Task Manager..."

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

# Start the backend server
echo "🚀 Starting backend server on port 3001..."
npm start &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend server is running successfully!"
else
    echo "❌ Backend server failed to start. Check the logs above."
    exit 1
fi

# Navigate to frontend directory
cd ../frontend

# Start frontend server
echo "🌐 Starting frontend server on port 3000..."
echo "📖 If you don't have a local server, you can use:"
echo "   Python: python3 -m http.server 3000"
echo "   Node.js: npx http-server -p 3000"
echo "   PHP: php -S localhost:3000"

# Try to start with Python if available
if command -v python3 &> /dev/null; then
    echo "🐍 Starting with Python..."
    python3 -m http.server 3000 &
    FRONTEND_PID=$!
    
    sleep 2
    echo ""
    echo "🎉 KiranaClub Task Manager is now running!"
    echo "📱 Frontend: http://localhost:3000"
    echo "🔌 Backend API: http://localhost:3001"
    echo "📊 Health Check: http://localhost:3001/health"
    echo ""
    echo "🔐 Demo Login Credentials:"
    echo "   Admin: admin@kirana.club / admin123"
    echo "   Manager: manager@kirana.club / manager123"
    echo "   Developer: dev@kirana.club / dev123"
    echo ""
    echo "⚠️  Don't forget to configure your Google Sheets credentials in backend/.env"
    echo "📖 See README.md for complete setup instructions"
    echo ""
    echo "Press Ctrl+C to stop all servers"
    
    # Wait for user interrupt
    trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit 0" INT
    wait
else
    echo "🌐 Please start a web server in the frontend directory manually:"
    echo "   cd frontend && python3 -m http.server 3000"
    echo ""
    echo "🎉 Backend is running at http://localhost:3001"
    echo "📊 Health Check: http://localhost:3001/health"
    
    # Keep backend running
    trap "echo ''; echo '🛑 Stopping backend...'; kill $BACKEND_PID; exit 0" INT
    wait $BACKEND_PID
fi
