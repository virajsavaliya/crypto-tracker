#!/usr/bin/env bash
# Install pgAdmin on Hetzner Server
# This script installs pgAdmin 4 web interface for PostgreSQL management

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Installing pgAdmin 4                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
PGADMIN_EMAIL="${PGADMIN_EMAIL:-admin@example.com}"
PGADMIN_PASSWORD="${PGADMIN_PASSWORD:-admin}"
PGADMIN_PORT="${PGADMIN_PORT:-5050}"

echo -e "${YELLOW}pgAdmin will be accessible at: http://YOUR_SERVER_IP:${PGADMIN_PORT}${NC}"
echo -e "${YELLOW}Default login: ${PGADMIN_EMAIL} / ${PGADMIN_PASSWORD}${NC}"
echo ""

# Step 1: Check if Docker is installed
echo -e "${YELLOW}[1/4] Checking Docker installation...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please run the main deployment script first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is installed${NC}"

# Step 2: Create pgAdmin directories
echo -e "\n${YELLOW}[2/4] Creating pgAdmin directories...${NC}"
mkdir -p /opt/pgadmin
mkdir -p /opt/pgadmin/data
chmod -R 777 /opt/pgadmin/data
echo -e "${GREEN}✅ Directories created${NC}"

# Step 3: Create pgAdmin container
echo -e "\n${YELLOW}[3/4] Starting pgAdmin container...${NC}"

# Stop existing container if running
docker stop pgadmin4 2>/dev/null || true
docker rm pgadmin4 2>/dev/null || true

# Run pgAdmin container
docker run -d \
  --name pgadmin4 \
  --restart always \
  -p ${PGADMIN_PORT}:80 \
  -e PGADMIN_DEFAULT_EMAIL="${PGADMIN_EMAIL}" \
  -e PGADMIN_DEFAULT_PASSWORD="${PGADMIN_PASSWORD}" \
  -e PGADMIN_CONFIG_ENHANCED_COOKIE_PROTECTION=True \
  -e PGADMIN_CONFIG_LOGIN_BANNER="\"Crypto Tracker Database\"" \
  -v /opt/pgadmin/data:/var/lib/pgadmin \
  dpage/pgadmin4:latest

echo -e "${GREEN}✅ pgAdmin container started${NC}"

# Step 4: Configure firewall
echo -e "\n${YELLOW}[4/4] Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow ${PGADMIN_PORT}/tcp
    echo -e "${GREEN}✅ Firewall rule added for port ${PGADMIN_PORT}${NC}"
else
    echo -e "${YELLOW}⚠️  UFW not installed, skipping firewall configuration${NC}"
fi

# Wait for pgAdmin to start
echo -e "\n${YELLOW}Waiting for pgAdmin to start...${NC}"
sleep 5

# Check if container is running
if docker ps | grep -q pgadmin4; then
    echo -e "${GREEN}✅ pgAdmin is running${NC}"
else
    echo -e "${RED}❌ pgAdmin failed to start. Check logs: docker logs pgadmin4${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ pgAdmin Installation Complete!            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Access pgAdmin:${NC}"
echo -e "  URL: ${GREEN}http://$(curl -s ifconfig.me):${PGADMIN_PORT}${NC}"
echo -e "  Email: ${GREEN}${PGADMIN_EMAIL}${NC}"
echo -e "  Password: ${GREEN}${PGADMIN_PASSWORD}${NC}"
echo ""
echo -e "${BLUE}Connect to your PostgreSQL database:${NC}"
echo -e "  Host: ${GREEN}postgres${NC} (or ${GREEN}172.17.0.1${NC} if using host network)"
echo -e "  Port: ${GREEN}5432${NC}"
echo -e "  Database: ${GREEN}crypto_tracker_db${NC}"
echo -e "  Username: ${GREEN}crypto_user${NC}"
echo -e "  Password: ${GREEN}(check your .env.production file)${NC}"
echo ""
echo -e "${YELLOW}⚠️  SECURITY WARNING:${NC}"
echo -e "  - Change the default password after first login"
echo -e "  - Consider using SSH tunnel instead of exposing port ${PGADMIN_PORT}"
echo -e "  - To use SSH tunnel: ssh -L 5050:localhost:${PGADMIN_PORT} root@YOUR_SERVER_IP"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo -e "  View logs: ${GREEN}docker logs -f pgadmin4${NC}"
echo -e "  Restart: ${GREEN}docker restart pgadmin4${NC}"
echo -e "  Stop: ${GREEN}docker stop pgadmin4${NC}"
echo -e "  Remove: ${GREEN}docker stop pgadmin4 && docker rm pgadmin4${NC}"
echo ""
