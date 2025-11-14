# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies (Python, curl for health checks)
RUN apk add --no-cache python3 py3-pip curl

# Copy package files
COPY backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --only=production

# Copy application code
WORKDIR /app
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Copy and setup environment file
COPY .env.example .env

# Set working directory to backend for database operations
WORKDIR /app/backend

# Generate Prisma client and prepare for migrations
RUN npx prisma generate

# Expose port 3001 (single server serving both frontend and backend)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start script that handles database migration and app startup
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push && npm start"] 