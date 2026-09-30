#!/bin/bash

###############################################################################
# Docker Local Setup Script
# Purpose: Clean and reset Docker environment for local development
# Usage: ./docker-local-setup.sh
###############################################################################

set -e  # Exit on any error

echo "🚀 Starting Docker Local Setup..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

###############################################################################
# Step 1: Check if Docker is running
###############################################################################
print_info "Checking if Docker is running..."

if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

print_success "Docker is running"

###############################################################################
# Step 2: Stop all running containers
###############################################################################
print_info "Stopping all running containers..."

if [ "$(docker ps -q)" ]; then
    docker stop $(docker ps -q)
    print_success "All containers stopped"
else
    print_warning "No running containers found"
fi

###############################################################################
# Step 3: Remove all containers
###############################################################################
print_info "Removing all containers..."

if [ "$(docker ps -aq)" ]; then
    docker rm -f $(docker ps -aq)
    print_success "All containers removed"
else
    print_warning "No containers to remove"
fi

###############################################################################
# Step 4: Remove all images
###############################################################################
print_info "Removing all Docker images..."

if [ "$(docker images -q)" ]; then
    docker rmi -f $(docker images -q)
    print_success "All images removed"
else
    print_warning "No images to remove"
fi

###############################################################################
# Step 5: Remove all volumes
###############################################################################
print_info "Removing all Docker volumes..."

if [ "$(docker volume ls -q)" ]; then
    docker volume rm -f $(docker volume ls -q)
    print_success "All volumes removed"
else
    print_warning "No volumes to remove"
fi

###############################################################################
# Step 6: Remove all networks (except default ones)
###############################################################################
print_info "Removing all Docker networks..."

if [ "$(docker network ls -q -f type=custom)" ]; then
    docker network prune -f
    print_success "All custom networks removed"
else
    print_warning "No custom networks to remove"
fi

###############################################################################
# Step 7: Clean Docker system
###############################################################################
print_info "Running Docker system prune..."

docker system prune -af --volumes
print_success "Docker system cleaned"

###############################################################################
# Step 8: Check for .env file
###############################################################################
print_info "Checking for .env file in backend..."

if [ ! -f "./backend/.env" ]; then
    print_warning ".env file not found in backend directory"
    
    if [ -f "./.env.example" ]; then
        print_info "Creating .env file from .env.example..."
        cp ./.env.example ./backend/.env
        print_success ".env file created"
        print_warning "⚠️  IMPORTANT: Please update ./backend/.env with your actual credentials"
        print_warning "    - DATABASE_URL (if using external PostgreSQL)"
        print_warning "    - STRIPE keys"
        print_warning "    - EMAIL configuration"
        print_warning "    - TELEGRAM bot token"
    else
        print_error ".env.example not found. Creating a basic .env file..."
        cat > ./backend/.env << 'EOF'
# Local Development Environment
DEBUG=1
SECRET_KEY=django-insecure-local-development-key-change-in-production

# Database (using local PostgreSQL in Docker)
DATABASE_URL=postgresql://postgres:postgres@db:5432/crypto_tracker_db

# Redis
REDIS_URL=redis://redis:6379/0

# Celery
CELERY_BROKER_URL=redis://redis:6379/1

# CORS and Allowed Hosts
ALLOWED_HOSTS=localhost,127.0.0.1,backend1,backend,0.0.0.0
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Email (optional for local dev)
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@localhost

# Stripe (optional for local dev)
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
STRIPE_PRICE_ID_BASIC=price_basic
STRIPE_PRICE_ID_ENTERPRISE=price_enterprise

# Firebase (optional for local dev)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# Telegram (optional for local dev)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=your_bot
BACKEND_URL=http://localhost:8080
EOF
        print_success "Basic .env file created"
        print_warning "⚠️  IMPORTANT: Please update ./backend/.env with your actual credentials"
    fi
else
    print_success ".env file already exists"
fi

###############################################################################
# Step 9: Create docker-compose.local.yml for local development
###############################################################################
print_info "Creating docker-compose.local.yml..."

cat > docker-compose.local.yml << 'EOF'
# docker-compose.local.yml
# Purpose: Local development environment with all services
# Usage: docker-compose -f docker-compose.local.yml up --build

services:
  # PostgreSQL Database for Local Development
  db:
    image: postgres:15-alpine
    container_name: crypto_db
    environment:
      POSTGRES_DB: crypto_tracker_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis for Caching and Celery
  redis:
    image: redis:7-alpine
    container_name: crypto_redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend Django Application
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: crypto_backend
    command: >
      bash -c "
        echo '⏳ Waiting for database...' &&
        python wait-for-services.sh &&
        echo '🔄 Running migrations...' &&
        python manage.py migrate &&
        echo '📦 Collecting static files...' &&
        python manage.py collectstatic --noinput &&
        echo '🚀 Starting development server...' &&
        python manage.py runserver 0.0.0.0:8000
      "
    env_file:
      - ./backend/.env
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  # Celery Worker
  celery-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: crypto_celery_worker
    command: celery -A project_config worker --loglevel=info --concurrency=2
    env_file:
      - ./backend/.env
    volumes:
      - ./backend:/app
    depends_on:
      - db
      - redis
      - backend
    restart: unless-stopped

  # Celery Beat Scheduler
  celery-beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: crypto_celery_beat
    command: celery -A project_config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    env_file:
      - ./backend/.env
    volumes:
      - ./backend:/app
    depends_on:
      - db
      - redis
      - backend
    restart: unless-stopped

  # Frontend Next.js Application
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_API_URL=http://localhost:8000
        - NEXT_PUBLIC_WS_URL=ws://localhost:8000
    container_name: crypto_frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      - NEXT_PUBLIC_WS_URL=ws://localhost:8000
      - NODE_ENV=development
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
EOF

print_success "docker-compose.local.yml created"

###############################################################################
# Step 10: Update backend/.env with correct database URL
###############################################################################
print_info "Updating DATABASE_URL in backend/.env for local PostgreSQL..."

if [ -f "./backend/.env" ]; then
    # Check if DATABASE_URL exists and update it
    if grep -q "^DATABASE_URL=" "./backend/.env"; then
        # macOS-compatible sed
        sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@db:5432/crypto_tracker_db|g' ./backend/.env
    else
        echo "DATABASE_URL=postgresql://postgres:postgres@db:5432/crypto_tracker_db" >> ./backend/.env
    fi
    print_success "DATABASE_URL updated"
fi

###############################################################################
# Step 11: Build Docker images
###############################################################################
print_info "Building Docker images (this may take a few minutes)..."

docker-compose -f docker-compose.local.yml build --no-cache
print_success "Docker images built successfully"

###############################################################################
# Step 12: Display summary
###############################################################################
echo ""
echo "=================================="
print_success "Docker Local Setup Complete!"
echo "=================================="
echo ""
print_info "Summary of what was done:"
echo "  1. ✅ Stopped all running containers"
echo "  2. ✅ Removed all containers"
echo "  3. ✅ Removed all images"
echo "  4. ✅ Removed all volumes"
echo "  5. ✅ Cleaned Docker networks"
echo "  6. ✅ Cleaned Docker system"
echo "  7. ✅ Created/verified .env file"
echo "  8. ✅ Created docker-compose.local.yml"
echo "  9. ✅ Built fresh Docker images"
echo ""
print_info "Next Steps:"
echo ""
echo "  1. Review and update credentials in backend/.env:"
echo "     ${YELLOW}nano backend/.env${NC}"
echo ""
echo "  2. Start the local development environment:"
echo "     ${GREEN}docker-compose -f docker-compose.local.yml up${NC}"
echo ""
echo "  3. Access your services:"
echo "     - Frontend:  ${GREEN}http://localhost:3000${NC}"
echo "     - Backend:   ${GREEN}http://localhost:8000${NC}"
echo "     - Django Admin: ${GREEN}http://localhost:8000/admin${NC}"
echo "     - PostgreSQL: ${GREEN}localhost:5432${NC} (postgres/postgres)"
echo "     - Redis:     ${GREEN}localhost:6379${NC}"
echo ""
echo "  4. Create a superuser (after services are running):"
echo "     ${GREEN}docker-compose -f docker-compose.local.yml exec backend python manage.py createsuperuser${NC}"
echo ""
echo "  5. View logs:"
echo "     ${GREEN}docker-compose -f docker-compose.local.yml logs -f${NC}"
echo ""
echo "  6. Stop services:"
echo "     ${GREEN}docker-compose -f docker-compose.local.yml down${NC}"
echo ""
print_warning "Note: Make sure to update the .env file with your actual credentials before starting!"
echo ""
