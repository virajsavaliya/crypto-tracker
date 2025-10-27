#!/usr/bin/env bash
# Create ECR Repositories for Crypto Tracker
# This script creates the necessary ECR repositories

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-196790134201}"
PROJECT_NAME="crypto-tracker"

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Creating ECR Repositories                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Region: ${BLUE}$REGION${NC}"
echo -e "  Account: ${BLUE}$ACCOUNT_ID${NC}"
echo -e "  Project: ${BLUE}$PROJECT_NAME${NC}"
echo ""

# Check AWS credentials
echo -e "${YELLOW}[1/4] Checking AWS credentials...${NC}"
if aws sts get-caller-identity &>/dev/null; then
    IDENTITY=$(aws sts get-caller-identity --query 'Arn' --output text)
    echo -e "${GREEN}✅ Credentials valid: $IDENTITY${NC}"
else
    echo -e "${RED}❌ AWS credentials not configured or expired${NC}"
    exit 1
fi

# Check ECR permissions
echo -e "\n${YELLOW}[2/4] Checking ECR permissions...${NC}"
if aws ecr describe-repositories --region "$REGION" --max-items 1 &>/dev/null; then
    echo -e "${GREEN}✅ ECR permissions verified${NC}"
else
    echo -e "${RED}❌ No ECR permissions${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  You don't have permission to manage ECR repositories.${NC}"
    echo ""
    echo "Please do ONE of the following:"
    echo ""
    echo "1. Use AWS Console to create repositories:"
    echo "   https://us-east-1.console.aws.amazon.com/ecr/repositories"
    echo "   Create two repositories:"
    echo "   - crypto-tracker/backend"
    echo "   - crypto-tracker/frontend"
    echo ""
    echo "2. Request ECR permissions from your AWS admin"
    echo "   See: ECR_SETUP_GUIDE.md for details"
    echo ""
    echo "3. Ask your admin to run this script"
    echo ""
    exit 1
fi

# Create backend repository
echo -e "\n${YELLOW}[3/4] Creating backend repository...${NC}"
BACKEND_REPO="${PROJECT_NAME}/backend"

if aws ecr describe-repositories --repository-names "$BACKEND_REPO" --region "$REGION" &>/dev/null; then
    echo -e "${GREEN}✅ Repository already exists: $BACKEND_REPO${NC}"
    BACKEND_URI=$(aws ecr describe-repositories --repository-names "$BACKEND_REPO" --region "$REGION" --query 'repositories[0].repositoryUri' --output text)
else
    BACKEND_URI=$(aws ecr create-repository \
        --repository-name "$BACKEND_REPO" \
        --region "$REGION" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256 \
        --query 'repository.repositoryUri' \
        --output text)
    
    echo -e "${GREEN}✅ Created backend repository${NC}"
fi

echo -e "  URI: ${BLUE}$BACKEND_URI${NC}"

# Create frontend repository
echo -e "\n${YELLOW}[4/4] Creating frontend repository...${NC}"
FRONTEND_REPO="${PROJECT_NAME}/frontend"

if aws ecr describe-repositories --repository-names "$FRONTEND_REPO" --region "$REGION" &>/dev/null; then
    echo -e "${GREEN}✅ Repository already exists: $FRONTEND_REPO${NC}"
    FRONTEND_URI=$(aws ecr describe-repositories --repository-names "$FRONTEND_REPO" --region "$REGION" --query 'repositories[0].repositoryUri' --output text)
else
    FRONTEND_URI=$(aws ecr create-repository \
        --repository-name "$FRONTEND_REPO" \
        --region "$REGION" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256 \
        --query 'repository.repositoryUri' \
        --output text)
    
    echo -e "${GREEN}✅ Created frontend repository${NC}"
fi

echo -e "  URI: ${BLUE}$FRONTEND_URI${NC}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         ECR Repositories Created! 🎉           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Backend:  $BACKEND_URI${NC}"
echo -e "${GREEN}✅ Frontend: $FRONTEND_URI${NC}"
echo ""
echo -e "${YELLOW}🔐 To login to ECR:${NC}"
echo -e "   ${BLUE}aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com${NC}"
echo ""
