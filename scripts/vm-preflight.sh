#!/bin/bash

# Kira VM Pre-flight Check Script
# Run this on a fresh VM before attempting to install Kira

echo "🔍 Kira VM Pre-flight Check"
echo "=================================="
echo ""

ERRORS=0
WARNINGS=0

# Function to log errors
log_error() {
    echo "❌ ERROR: $1"
    ERRORS=$((ERRORS + 1))
}

# Function to log warnings  
log_warning() {
    echo "⚠️  WARNING: $1"
    WARNINGS=$((WARNINGS + 1))
}

# Function to log success
log_success() {
    echo "✅ $1"
}

# Check OS
echo "📋 System Information"
echo "OS: $(uname -s) $(uname -r)"
echo "Architecture: $(uname -m)"
echo "Distribution: $(lsb_release -d 2>/dev/null | cut -f2 || echo "Unknown")"
echo ""

# Check Docker
echo "🐳 Docker Check"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log_success "Docker installed: $DOCKER_VERSION"
    
    # Check if Docker is running
    if docker ps &> /dev/null; then
        log_success "Docker daemon is running"
    else
        log_error "Docker daemon is not running. Start with: sudo systemctl start docker"
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        log_success "Docker Compose installed: $COMPOSE_VERSION"
    elif docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version)
        log_success "Docker Compose (plugin) installed: $COMPOSE_VERSION"
    else
        log_error "Docker Compose not found. Install with: sudo apt install docker-compose"
    fi
else
    log_error "Docker not installed. Install with: sudo apt install docker.io"
fi
echo ""

# Check Node.js
echo "📦 Node.js Check"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$NODE_MAJOR" -eq 18 ]; then
        log_success "Node.js version: $NODE_VERSION (recommended)"
    elif [ "$NODE_MAJOR" -eq 20 ]; then
        log_success "Node.js version: $NODE_VERSION (compatible)"
    elif [ "$NODE_MAJOR" -gt 20 ]; then
        log_warning "Node.js version: $NODE_VERSION (may have Prisma issues, recommend v18)"
    elif [ "$NODE_MAJOR" -lt 18 ]; then
        log_error "Node.js version: $NODE_VERSION (too old, need v18+)"
    fi
else
    log_error "Node.js not installed. Install via NVM: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    log_success "npm version: $NPM_VERSION"
else
    log_error "npm not found (should come with Node.js)"
fi
echo ""

# Check Git
echo "📂 Git Check"
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    log_success "Git installed: $GIT_VERSION"
else
    log_error "Git not installed. Install with: sudo apt install git"
fi
echo ""

# Check ports
echo "🔌 Port Availability Check"
check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port $port is already in use (needed for $service)"
        echo "   Use: sudo lsof -i :$port to see what's using it"
    else
        log_success "Port $port is available ($service)"
    fi
}

check_port 3001 "Kira App"
check_port 3307 "MySQL"
check_port 6379 "Redis"
echo ""

# Check disk space
echo "💾 Disk Space Check"
AVAILABLE_GB=$(df / | awk 'NR==2 {printf "%.1f", $4/1024/1024}')
AVAILABLE_KB=$(df / | awk 'NR==2 {print $4}')

if [ "$AVAILABLE_KB" -gt 2097152 ]; then  # 2GB in KB
    log_success "Available disk space: ${AVAILABLE_GB}GB"
else
    log_warning "Available disk space: ${AVAILABLE_GB}GB (recommended: 2GB+)"
fi
echo ""

# Check memory
echo "🧠 Memory Check"
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_GB=$(echo "$TOTAL_RAM_KB" | awk '{printf "%.1f", $1/1024/1024}')

if [ "$TOTAL_RAM_KB" -gt 2097152 ]; then  # 2GB in KB
    log_success "Total RAM: ${TOTAL_RAM_GB}GB"
elif [ "$TOTAL_RAM_KB" -gt 1048576 ]; then  # 1GB in KB
    log_warning "Total RAM: ${TOTAL_RAM_GB}GB (minimum: 2GB recommended for smooth operation)"
else
    log_error "Total RAM: ${TOTAL_RAM_GB}GB (insufficient: need at least 1GB, recommend 2GB+)"
fi
echo ""

# Check network connectivity
echo "🌐 Network Check"
if ping -c 1 google.com &> /dev/null; then
    log_success "Internet connectivity OK"
    
    # Check Docker Hub access
    if curl -s https://hub.docker.com &> /dev/null; then
        log_success "Docker Hub accessible"
    else
        log_warning "Docker Hub not accessible (may cause image pull issues)"
    fi
    
    # Check GitHub access  
    if curl -s https://github.com &> /dev/null; then
        log_success "GitHub accessible"
    else
        log_warning "GitHub not accessible (may cause git clone issues)"
    fi
else
    log_error "No internet connectivity"
fi
echo ""

# Check user permissions
echo "👤 Permission Check"
if groups $USER | grep &>/dev/null '\bdocker\b'; then
    log_success "User '$USER' is in docker group"
else
    log_warning "User '$USER' not in docker group. Add with: sudo usermod -aG docker $USER"
    echo "   Note: You'll need to log out and back in after adding"
fi

if [ "$EUID" -eq 0 ]; then
    log_warning "Running as root (not recommended for normal operation)"
else
    log_success "Running as non-root user: $USER"
fi
echo ""

# Summary
echo "📊 Summary"
echo "=================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 All checks passed! Your VM is ready for Kira installation."
    echo ""
    echo "📋 Next steps:"
    echo "   1. git clone https://github.com/shubhankar-mohan/kira.git"
    echo "   2. cd kira"  
    echo "   3. chmod +x start.sh"
    echo "   4. ./start.sh"
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  Pre-flight completed with $WARNINGS warning(s)."
    echo "Installation should work but may have minor issues."
    echo ""
    echo "📋 Next steps:"
    echo "   1. Address warnings above (optional)"
    echo "   2. git clone https://github.com/shubhankar-mohan/kira.git"
    echo "   3. cd kira"
    echo "   4. chmod +x start.sh" 
    echo "   5. ./start.sh"
else
    echo "❌ Pre-flight failed with $ERRORS error(s) and $WARNINGS warning(s)."
    echo "Please fix the errors above before attempting installation."
    echo ""
    echo "📋 Common fixes:"
    echo "   • Install Docker: sudo apt update && sudo apt install -y docker.io docker-compose"
    echo "   • Install Node.js 18: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && nvm install 18"
    echo "   • Add to docker group: sudo usermod -aG docker $USER"
    echo "   • Install Git: sudo apt install git"
fi

echo ""
exit $ERRORS