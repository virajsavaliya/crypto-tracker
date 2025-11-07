#!/usr/bin/env bash
# Hetzner Server Deployment Script
# This script sets up a fresh Ubuntu server and deploys the crypto-tracker application

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Crypto Tracker - Hetzner Deployment         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
DEPLOY_USER="deploy"
APP_DIR="/home/${DEPLOY_USER}/crypto-tracker"
REPO_URL="https://github.com/virajsavaliya/crypto-tracker.git"

# Step 1: Update system
echo -e "${YELLOW}[1/10] Updating system packages...${NC}"
apt-get update -qq
apt-get upgrade -y -qq
echo -e "${GREEN}✅ System updated${NC}"

# Step 2: Install required packages
echo -e "\n${YELLOW}[2/10] Installing required packages...${NC}"
apt-get install -y -qq \
    curl \
    git \
    ufw \
    fail2ban \
    ca-certificates \
    gnupg \
    lsb-release
echo -e "${GREEN}✅ Packages installed${NC}"

# Step 3: Install Docker
echo -e "\n${YELLOW}[3/10] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}✅ Docker installed${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# Step 4: Create deploy user
echo -e "\n${YELLOW}[4/10] Creating deploy user...${NC}"
if ! id -u ${DEPLOY_USER} &> /dev/null; then
    useradd -m -s /bin/bash ${DEPLOY_USER}
    usermod -aG docker ${DEPLOY_USER}
    echo -e "${GREEN}✅ User '${DEPLOY_USER}' created${NC}"
else
    echo -e "${GREEN}✅ User '${DEPLOY_USER}' already exists${NC}"
fi

# Step 5: Configure firewall
echo -e "\n${YELLOW}[5/10] Configuring firewall...${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable
echo -e "${GREEN}✅ Firewall configured${NC}"

# Step 6: Clone repository
echo -e "\n${YELLOW}[6/10] Cloning repository...${NC}"
if [ -d "${APP_DIR}" ]; then
    echo -e "${YELLOW}Repository already exists, pulling latest changes...${NC}"
    cd ${APP_DIR}
    sudo -u ${DEPLOY_USER} git pull origin main
else
    sudo -u ${DEPLOY_USER} git clone ${REPO_URL} ${APP_DIR}
    echo -e "${GREEN}✅ Repository cloned${NC}"
fi

cd ${APP_DIR}

# Step 7: Create environment files
echo -e "\n${YELLOW}[7/10] Setting up environment files...${NC}"

cat > ${APP_DIR}/backend/.env.production << 'EOF'
# Django Settings
DEBUG=False
SECRET_KEY=CHANGE_ME_TO_SECURE_RANDOM_STRING_50_CHARS_MINIMUM
ALLOWED_HOSTS=your-domain.com,www.your-domain.com

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=crypto_tracker_db
DB_USER=crypto_user
DB_PASSWORD=CHANGE_ME_SECURE_DB_PASSWORD

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Binance API
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_API_SECRET=your_binance_api_secret_here

# Stripe (Payment)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Email Settings
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=True

# Firebase (for push notifications)
FIREBASE_CREDENTIALS={}

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
EOF

cat > ${APP_DIR}/frontend/.env.production << 'EOF'
NEXT_PUBLIC_API_URL=http://backend1:8000
NEXT_PUBLIC_WS_URL=ws://backend1:8000
EOF

chown ${DEPLOY_USER}:${DEPLOY_USER} ${APP_DIR}/backend/.env.production
chown ${DEPLOY_USER}:${DEPLOY_USER} ${APP_DIR}/frontend/.env.production

echo -e "${GREEN}✅ Environment files created${NC}"
echo -e "${RED}⚠️  IMPORTANT: Edit ${APP_DIR}/backend/.env.production with your actual credentials!${NC}"

# Step 8: Build and start containers
echo -e "\n${YELLOW}[8/10] Building Docker images (this may take 10-15 minutes)...${NC}"
cd ${APP_DIR}
sudo -u ${DEPLOY_USER} docker compose build
echo -e "${GREEN}✅ Docker images built${NC}"

# Step 9: Start services
echo -e "\n${YELLOW}[9/10] Starting services...${NC}"
sudo -u ${DEPLOY_USER} docker compose up -d
echo -e "${GREEN}✅ Services started${NC}"

# Step 10: Run migrations
echo -e "\n${YELLOW}[10/10] Running database migrations...${NC}"
sleep 10  # Wait for database to be ready
sudo -u ${DEPLOY_USER} docker compose exec backend1 python manage.py migrate
echo -e "${GREEN}✅ Migrations completed${NC}"

# Create superuser prompt
echo -e "\n${YELLOW}Creating Django superuser...${NC}"
sudo -u ${DEPLOY_USER} docker compose exec backend1 python manage.py createsuperuser || echo "Superuser creation skipped"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Deployment Complete!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo -e "1. ${YELLOW}Edit environment variables:${NC}"
echo -e "   nano ${APP_DIR}/backend/.env.production"
echo ""
echo -e "2. ${YELLOW}Restart services after updating config:${NC}"
echo -e "   cd ${APP_DIR} && docker compose restart"
echo ""
echo -e "3. ${YELLOW}View logs:${NC}"
echo -e "   cd ${APP_DIR} && docker compose logs -f"
echo ""
echo -e "4. ${YELLOW}Check service status:${NC}"
echo -e "   cd ${APP_DIR} && docker compose ps"
echo ""
echo -e "5. ${YELLOW}Access the application:${NC}"
echo -e "   Frontend: http://$(curl -s ifconfig.me):3000"
echo -e "   Backend API: http://$(curl -s ifconfig.me):8080"
echo -e "   Admin: http://$(curl -s ifconfig.me):8080/admin"
echo ""
echo -e "${RED}⚠️  SECURITY REMINDERS:${NC}"
echo -e "   - Change all default passwords in .env.production"
echo -e "   - Set up a domain and SSL certificate (Let's Encrypt)"
echo -e "   - Configure proper ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS"
echo -e "   - Never commit .env.production to Git"
echo ""
