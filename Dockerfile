# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install Python for any Python dependencies
RUN apk add --no-cache python3 py3-pip

# Copy package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --only=production

# Install frontend dependencies (if any)
WORKDIR /app/frontend
RUN npm ci --only=production || true

# Copy application code
WORKDIR /app
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create production environment file
RUN echo "NODE_ENV=production" > ./backend/.env

# Set working directory to backend
WORKDIR /app/backend

# Expose port 3001 (backend will serve frontend on this port)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["npm", "start"] 