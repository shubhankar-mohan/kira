#!/bin/bash

# Kira Task Manager Startup Script (Single Server)

echo "🏪 Starting Kira Task Manager..."
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

# Ensure Docker is available (for MySQL/Redis)
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH. Please install Docker Desktop."
    exit 1
fi

# Start infrastructure: MySQL and Redis via docker compose
echo "🗄️  Ensuring data directories exist..."
mkdir -p data/mysql data/redis

echo "🐳 Starting MySQL and Redis containers (docker compose)..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d mysql redis || true
else
    docker compose up -d mysql redis || true
fi

# Default DB env if not provided (host networking for local dev)
export DB_TYPE=${DB_TYPE:-mysql}
export DB_HOST=${DB_HOST:-localhost}
export DB_PORT=${DB_PORT:-3307}
export DB_NAME=${DB_NAME:-kira_db}
export DB_USER=${DB_USER:-kira_user}
export DB_PASSWORD=${DB_PASSWORD:-change_me}
export DATABASE_URL=${DATABASE_URL:-mysql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}}

# Wait for MySQL to be reachable (up to ~60s)
echo "⏳ Waiting for MySQL on ${DB_HOST}:${DB_PORT}..."
ATTEMPTS=0
until (echo > /dev/tcp/${DB_HOST}/${DB_PORT}) >/dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS+1))
    if [ "$ATTEMPTS" -gt 60 ]; then
        echo "❌ MySQL did not become ready on ${DB_HOST}:${DB_PORT}. Check docker logs for mysql."
        exit 1
    fi
    sleep 1
done
echo "✅ MySQL reachable."

# Navigate to backend directory
cd backend

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Ensure .env exists with DB defaults if missing
if [ ! -f ".env" ]; then
    echo "⚠️  .env not found. Creating with database defaults..."
    cat > .env <<EOF
DB_TYPE=${DB_TYPE}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL:-redis://localhost:6379}
JWT_SECRET=${JWT_SECRET:-kira-dev-secret}
EOF
fi

# Prisma generate, migrate, and seed (safe to re-run)
echo "🧬 Generating Prisma client..."
npx prisma generate >/dev/null 2>&1 || npx prisma generate

echo "🗃️  Running Prisma migrations..."
if ! npm run prisma:migrate; then
    echo "⚠️  Prisma migrate failed. Falling back to schema sync (db push)..."
    npx prisma db push || true
fi

echo "🌱 Seeding database (demo users, baseline data)..."
npm run prisma:seed || true

# Check if port 3001 is already in use
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 3001 is already in use."
    read -p "Kill existing process and restart? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Stopping existing process on port 3001..."
        lsof -ti:3001 | xargs kill -9 2>/dev/null || true
        sleep 2
    else
        echo "✅ Existing server is already running at http://localhost:3001"
        echo "   Use 'lsof -ti:3001 | xargs kill' to stop it manually."
        exit 0
    fi
fi

# Start the single server (backend serves frontend)
echo "🚀 Starting Kira Task Manager on port 3001..."
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

# Check database health endpoint
if curl -s http://localhost:3001/api/health/database | grep -q '"status":"OK"'; then
    echo "✅ Database health OK!"
else
    echo "⚠️  Database health endpoint did not return OK. Verify DB connectivity."
fi

# Test frontend serving
if curl -s http://localhost:3001/ | grep -q "Kira Task Manager"; then
    echo "✅ Frontend is being served correctly!"
else
    echo "⚠️  Frontend serving might have issues. Check the logs above."
fi

echo ""
echo "🎉 Kira Task Manager is now running!"
echo "📱 Application: http://localhost:3001"
echo "📊 Health Check: http://localhost:3001/health"
echo "🔌 API Endpoints: http://localhost:3001/api/*"
echo ""
echo "🔐 Demo Login Credentials:"
echo "   Admin: admin@example.com / admin123"
echo "   Manager: manager@example.com / manager123"
echo "   Developer: dev@example.com / dev123"
echo ""
echo "📋 Available URLs:"
echo "   Dashboard: http://localhost:3001/dashboard"
echo "   Task Board: http://localhost:3001/board"
echo "   Sprints: http://localhost:3001/sprints"
echo "   Task Details: http://localhost:3001/task/{taskId}"
echo ""
echo "📖 See README.md and IMPLEMENTATION_JOURNAL.md for complete setup instructions"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for user interrupt
trap "echo ''; echo '🛑 Stopping server...'; kill $SERVER_PID; exit 0" INT
wait $SERVER_PID
