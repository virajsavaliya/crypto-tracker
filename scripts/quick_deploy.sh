#!/usr/bin/env bash
# Quick Deploy Script - Creates EC2 instance and deploys application
# This is the easiest way to deploy everything from scratch

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Quick Deploy - Crypto Tracker               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${YELLOW}[Step 1/2] Setting up AWS infrastructure...${NC}"
echo ""

# Check if aws_setup.sh exists
if [[ ! -f "$SCRIPT_DIR/aws_setup.sh" ]]; then
    echo -e "${RED}❌ aws_setup.sh not found${NC}"
    echo "Please create EC2 instance manually via AWS Console:"
    echo "1. Go to: https://console.aws.amazon.com/ec2/"
    echo "2. Launch Ubuntu 22.04 LTS instance (t3.medium)"
    echo "3. Open ports: 22, 80, 443, 3000, 8080"
    echo "4. Save the private key"
    echo ""
    echo "Then use: ./scripts/deploy_to_existing_instance.sh INSTANCE_ID"
    exit 1
fi

# Run AWS setup
if ! "$SCRIPT_DIR/aws_setup.sh"; then
    echo -e "${RED}❌ AWS setup failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Infrastructure created${NC}"
echo -e "${YELLOW}⏳ Waiting 2 minutes for Docker to install on EC2 instance...${NC}"
sleep 120

echo ""
echo -e "${YELLOW}[Step 2/2] Deploying application...${NC}"
echo ""

# Check if deploy_to_ec2.sh exists
if [[ ! -f "$SCRIPT_DIR/deploy_to_ec2.sh" ]]; then
    echo -e "${RED}❌ deploy_to_ec2.sh not found${NC}"
    exit 1
fi

# Deploy application
if ! "$SCRIPT_DIR/deploy_to_ec2.sh"; then
    echo -e "${RED}❌ Application deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Quick Deploy Complete! 🎉               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Get instance IP
INSTANCE_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=crypto-tracker" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text 2>/dev/null || echo "")

if [[ -n "$INSTANCE_IP" && "$INSTANCE_IP" != "None" ]]; then
    echo -e "${GREEN}🌐 Your application is accessible at:${NC}"
    echo ""
    echo -e "  Frontend: ${BLUE}http://${INSTANCE_IP}:3000${NC}"
    echo -e "  Backend API: ${BLUE}http://${INSTANCE_IP}:8080/api/${NC}"
    echo -e "  Admin Panel: ${BLUE}http://${INSTANCE_IP}:8080/admin/${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next Steps:${NC}"
    echo ""
    echo "1. Create Django superuser:"
    echo "   ssh -i ~/.ssh/crypto-tracker-key.pem ubuntu@${INSTANCE_IP}"
    echo "   cd ~/crypto-tracker"
    echo "   docker-compose exec backend1 python manage.py createsuperuser"
    echo ""
    echo "2. Configure Stripe webhooks:"
    echo "   URL: http://${INSTANCE_IP}:8080/api/webhook/stripe/"
    echo ""
    echo "3. Configure Telegram bot webhook:"
    echo "   docker-compose exec backend1 python manage.py set_telegram_webhook http://${INSTANCE_IP}:8080/api/telegram/webhook/"
    echo ""
fi

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
