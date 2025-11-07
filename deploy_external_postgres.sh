#!/bin/bash
# ============================================================================
# Deploy Script: Remove Docker PostgreSQL & Use External PostgreSQL
# ============================================================================
# Purpose: Clean up Docker PostgreSQL and deploy app with external database
# Server: 46.62.216.158 (Hetzner)
# Run on: SERVER (via SSH)
# ============================================================================

set -e  # Exit on error

echo "============================================================================"
echo "🚀 Deployment: Switching to External PostgreSQL"
echo "============================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/root/crypto-tracker"
EXTERNAL_DB_HOST="46.62.216.158"
EXTERNAL_DB_PORT="5432"
EXTERNAL_DB_NAME="crypto_tracker_db"
EXTERNAL_DB_USER="Abhishek.vaghasiya2016@gmail.com"
EXTERNAL_DB_PASS="Abhishek.vaghasiya2016"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   Project Directory: $PROJECT_DIR"
echo "   External DB Host: $EXTERNAL_DB_HOST"
echo "   External DB Name: $EXTERNAL_DB_NAME"
echo ""

# ============================================================================
# Step 1: Verify external PostgreSQL is running
# ============================================================================
echo -e "${YELLOW}Step 1: Verifying External PostgreSQL...${NC}"

if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✅ PostgreSQL service is running${NC}"
else
    echo -e "${RED}❌ PostgreSQL service is NOT running!${NC}"
    echo "   Starting PostgreSQL..."
    systemctl start postgresql
    sleep 3
fi

# Test database exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $EXTERNAL_DB_NAME; then
    echo -e "${GREEN}✅ Database '$EXTERNAL_DB_NAME' exists${NC}"
else
    echo -e "${RED}❌ Database '$EXTERNAL_DB_NAME' does not exist!${NC}"
    echo "   Please create it first using the commands in EXTERNAL_POSTGRES_SETUP.md"
    exit 1
fi

echo ""

# ============================================================================
# Step 2: Backup existing data (if Docker PostgreSQL exists)
# ============================================================================
echo -e "${YELLOW}Step 2: Checking for existing Docker PostgreSQL data...${NC}"

cd $PROJECT_DIR 2>/dev/null || {
    echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
    echo "   Cloning repository first..."
    cd /root
    git clone https://github.com/virajsavaliya/crypto-tracker.git
    cd $PROJECT_DIR
}

# Check if postgres container exists and has data
if docker ps -a | grep -q postgres; then
    echo -e "${YELLOW}⚠️  Found existing PostgreSQL container${NC}"
    echo "   Creating backup before removal..."
    
    # Try to backup if container is running
    if docker ps | grep -q postgres; then
        BACKUP_FILE="/root/postgres_backup_$(date +%Y%m%d_%H%M%S).sql"
        docker exec postgres pg_dump -U postgres crypto_tracker > $BACKUP_FILE 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Could not backup (database might be empty or different name)${NC}"
        }
        
        if [ -f "$BACKUP_FILE" ]; then
            echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
            echo "   You can import this to external PostgreSQL if needed:"
            echo "   PGPASSWORD='$EXTERNAL_DB_PASS' psql -h $EXTERNAL_DB_HOST -U '$EXTERNAL_DB_USER' -d $EXTERNAL_DB_NAME < $BACKUP_FILE"
        fi
    fi
else
    echo -e "${GREEN}✅ No existing PostgreSQL container found${NC}"
fi

echo ""

# ============================================================================
# Step 3: Stop and remove Docker containers
# ============================================================================
echo -e "${YELLOW}Step 3: Stopping Docker containers...${NC}"

cd $PROJECT_DIR

if [ -f "docker-compose.yml" ]; then
    echo "   Stopping all services..."
    docker compose down 2>/dev/null || docker-compose down 2>/dev/null || echo "No containers running"
    
    echo "   Removing PostgreSQL-related containers..."
    docker rm -f postgres pgbouncer 2>/dev/null || echo "Containers already removed"
    
    echo "   Removing PostgreSQL volumes..."
    docker volume rm crypto-tracker_postgres_data 2>/dev/null || \
    docker volume rm archive-2_postgres_data 2>/dev/null || \
    docker volume ls | grep postgres | awk '{print $2}' | xargs -r docker volume rm 2>/dev/null || \
    echo "No PostgreSQL volumes found"
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
else
    echo -e "${YELLOW}⚠️  docker-compose.yml not found${NC}"
fi

echo ""

# ============================================================================
# Step 4: Pull latest code from GitHub
# ============================================================================
echo -e "${YELLOW}Step 4: Pulling latest code from GitHub...${NC}"

cd $PROJECT_DIR

# Stash any local changes
git stash 2>/dev/null || true

# Pull latest changes
git pull origin main

echo -e "${GREEN}✅ Code updated${NC}"
echo ""

# ============================================================================
# Step 5: Update .env file with external database connection
# ============================================================================
echo -e "${YELLOW}Step 5: Updating .env configuration...${NC}"

ENV_FILE="$PROJECT_DIR/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ .env file not found: $ENV_FILE${NC}"
    echo "   Creating from template..."
    cp "$PROJECT_DIR/backend/.env.example" "$ENV_FILE" 2>/dev/null || touch "$ENV_FILE"
fi

# Update DATABASE_URL
echo "   Updating DATABASE_URL..."
if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
    # Update existing line
    sed -i.backup "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://${EXTERNAL_DB_USER}:${EXTERNAL_DB_PASS}@${EXTERNAL_DB_HOST}:${EXTERNAL_DB_PORT}/${EXTERNAL_DB_NAME}?sslmode=disable|" "$ENV_FILE"
else
    # Add new line
    echo "DATABASE_URL=postgresql://${EXTERNAL_DB_USER}:${EXTERNAL_DB_PASS}@${EXTERNAL_DB_HOST}:${EXTERNAL_DB_PORT}/${EXTERNAL_DB_NAME}?sslmode=disable" >> "$ENV_FILE"
fi

# Verify Redis is pointing to Docker service
if ! grep -q "^REDIS_URL=" "$ENV_FILE"; then
    echo "REDIS_URL=redis://redis:6379/0" >> "$ENV_FILE"
fi

if ! grep -q "^CELERY_BROKER_URL=" "$ENV_FILE"; then
    echo "CELERY_BROKER_URL=redis://redis:6379/1" >> "$ENV_FILE"
fi

echo -e "${GREEN}✅ .env file updated${NC}"
echo ""

# Show the database configuration
echo -e "${YELLOW}📝 Database Configuration:${NC}"
grep "^DATABASE_URL=" "$ENV_FILE" | sed "s/${EXTERNAL_DB_PASS}/***HIDDEN***/g"
echo ""

# ============================================================================
# Step 6: Test connection to external PostgreSQL
# ============================================================================
echo -e "${YELLOW}Step 6: Testing external PostgreSQL connection...${NC}"

# Test with psql
PGPASSWORD="$EXTERNAL_DB_PASS" psql -h "$EXTERNAL_DB_HOST" -U "$EXTERNAL_DB_USER" -d "$EXTERNAL_DB_NAME" -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully connected to external PostgreSQL${NC}"
else
    echo -e "${RED}❌ Failed to connect to external PostgreSQL${NC}"
    echo "   Please check:"
    echo "   1. PostgreSQL is running: systemctl status postgresql"
    echo "   2. Database exists: sudo -u postgres psql -c '\l'"
    echo "   3. User exists: sudo -u postgres psql -c '\du'"
    echo "   4. Remote access configured in pg_hba.conf"
    exit 1
fi

echo ""

# ============================================================================
# Step 7: Build and start Docker containers
# ============================================================================
echo -e "${YELLOW}Step 7: Building and starting Docker containers...${NC}"

cd $PROJECT_DIR

# Build images
echo "   Building Docker images..."
docker compose build --no-cache

echo ""
echo "   Starting services..."
docker compose up -d

echo ""
echo "   Waiting for services to be ready..."
sleep 10

echo -e "${GREEN}✅ Containers started${NC}"
echo ""

# ============================================================================
# Step 8: Run database migrations
# ============================================================================
echo -e "${YELLOW}Step 8: Running database migrations...${NC}"

# Wait a bit more for backend to be ready
sleep 5

# Run migrations
docker compose exec -T backend1 python manage.py migrate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Migrations had issues (might be already applied)${NC}"
fi

echo ""

# ============================================================================
# Step 9: Verify deployment
# ============================================================================
echo -e "${YELLOW}Step 9: Verifying deployment...${NC}"

echo "   Checking running containers..."
docker compose ps

echo ""
echo "   Checking database connectivity from backend..."
docker compose exec -T backend1 python manage.py check --database default

echo ""

# ============================================================================
# Step 10: Show running services
# ============================================================================
echo -e "${YELLOW}Step 10: Deployment Summary${NC}"

echo ""
echo "============================================================================"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "============================================================================"
echo ""
echo "📊 Running Services:"
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "🗄️  Database Configuration:"
echo "   Host: $EXTERNAL_DB_HOST"
echo "   Port: $EXTERNAL_DB_PORT"
echo "   Database: $EXTERNAL_DB_NAME"
echo "   User: $EXTERNAL_DB_USER"
echo ""
echo "🔗 Access Points:"
echo "   Frontend: http://$(hostname -I | awk '{print $1}'):3000"
echo "   Backend API: http://$(hostname -I | awk '{print $1}'):8080"
echo "   pgAdmin: http://$EXTERNAL_DB_HOST:5050"
echo ""
echo "📝 Useful Commands:"
echo "   View logs: docker compose logs -f"
echo "   View backend logs: docker compose logs -f backend1"
echo "   Restart services: docker compose restart"
echo "   Stop services: docker compose down"
echo ""
echo "🔍 Verify Setup:"
echo "   1. Check frontend: curl http://localhost:3000"
echo "   2. Check backend: curl http://localhost:8080/health"
echo "   3. Check database: docker compose exec backend1 python manage.py dbshell"
echo ""
echo "============================================================================"
echo -e "${GREEN}✅ All Done! Your application is now using external PostgreSQL${NC}"
echo "============================================================================"
