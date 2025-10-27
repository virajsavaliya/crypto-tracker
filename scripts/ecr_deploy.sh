#!/usr/bin/env bash
# Complete ECR Deployment Script
# Builds, tags, and pushes Docker images to AWS ECR

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${AWS_ACCOUNT_ID:-196790134201}"
PROJECT_NAME="crypto-tracker"
TAG="${TAG:-latest}"

# Repository URIs
BACKEND_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}/backend"
FRONTEND_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}/frontend"

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   AWS ECR Deployment Script                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Get project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

echo -e "${CYAN}📦 Project: ${PROJECT_NAME}${NC}"
echo -e "${CYAN}📍 Region: ${REGION}${NC}"
echo -e "${CYAN}🏷️  Tag: ${TAG}${NC}"
echo -e "${CYAN}📂 Root: ${PROJECT_ROOT}${NC}"
echo ""

# Step 1: Check AWS credentials
echo -e "${YELLOW}[Step 1/7] Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}❌ AWS credentials not configured or expired${NC}"
    echo ""
    echo "Please run: aws configure"
    echo "Or: aws sso login"
    exit 1
fi

IDENTITY=$(aws sts get-caller-identity --query 'Arn' --output text)
echo -e "${GREEN}✅ Authenticated as: ${IDENTITY}${NC}"

# Step 2: Check if ECR repositories exist
echo -e "\n${YELLOW}[Step 2/7] Checking ECR repositories...${NC}"

check_repo() {
    local repo_name=$1
    if aws ecr describe-repositories --repository-names "$repo_name" --region "$REGION" &>/dev/null; then
        echo -e "${GREEN}✅ Repository exists: ${repo_name}${NC}"
        return 0
    else
        echo -e "${RED}❌ Repository not found: ${repo_name}${NC}"
        return 1
    fi
}

BACKEND_EXISTS=$(check_repo "${PROJECT_NAME}/backend" && echo "true" || echo "false")
FRONTEND_EXISTS=$(check_repo "${PROJECT_NAME}/frontend" && echo "true" || echo "false")

if [[ "$BACKEND_EXISTS" == "false" ]] || [[ "$FRONTEND_EXISTS" == "false" ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  Some repositories don't exist. Creating them...${NC}"
    
    if [[ -x "./scripts/create_ecr_repos.sh" ]]; then
        ./scripts/create_ecr_repos.sh
    else
        echo -e "${RED}❌ Cannot create repositories automatically${NC}"
        echo "Please create them manually or run: ./scripts/create_ecr_repos.sh"
        exit 1
    fi
fi

# Step 3: Login to ECR
echo -e "\n${YELLOW}[Step 3/7] Logging in to ECR...${NC}"
if aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com" &>/dev/null; then
    echo -e "${GREEN}✅ Successfully logged in to ECR${NC}"
else
    echo -e "${RED}❌ Failed to login to ECR${NC}"
    exit 1
fi

# Step 4: Build Backend Image
echo -e "\n${YELLOW}[Step 4/7] Building backend Docker image...${NC}"
echo -e "${CYAN}📦 Building from: ${PROJECT_ROOT}/backend${NC}"

if docker build -t "${PROJECT_NAME}-backend:${TAG}" ./backend; then
    echo -e "${GREEN}✅ Backend image built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build backend image${NC}"
    exit 1
fi

# Step 5: Build Frontend Image
echo -e "\n${YELLOW}[Step 5/7] Building frontend Docker image...${NC}"
echo -e "${CYAN}📦 Building from: ${PROJECT_ROOT}/frontend${NC}"

if docker build -t "${PROJECT_NAME}-frontend:${TAG}" ./frontend; then
    echo -e "${GREEN}✅ Frontend image built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build frontend image${NC}"
    exit 1
fi

# Step 6: Tag and Push Backend
echo -e "\n${YELLOW}[Step 6/7] Tagging and pushing backend image...${NC}"
docker tag "${PROJECT_NAME}-backend:${TAG}" "${BACKEND_REPO}:${TAG}"
echo -e "${CYAN}🏷️  Tagged: ${BACKEND_REPO}:${TAG}${NC}"

echo -e "${CYAN}⬆️  Pushing to ECR (this may take a few minutes)...${NC}"
if docker push "${BACKEND_REPO}:${TAG}"; then
    echo -e "${GREEN}✅ Backend image pushed successfully${NC}"
else
    echo -e "${RED}❌ Failed to push backend image${NC}"
    exit 1
fi

# Also tag as 'latest' if TAG is a version
if [[ "$TAG" != "latest" ]]; then
    docker tag "${PROJECT_NAME}-backend:${TAG}" "${BACKEND_REPO}:latest"
    docker push "${BACKEND_REPO}:latest"
    echo -e "${GREEN}✅ Also tagged and pushed as 'latest'${NC}"
fi

# Step 7: Tag and Push Frontend
echo -e "\n${YELLOW}[Step 7/7] Tagging and pushing frontend image...${NC}"
docker tag "${PROJECT_NAME}-frontend:${TAG}" "${FRONTEND_REPO}:${TAG}"
echo -e "${CYAN}🏷️  Tagged: ${FRONTEND_REPO}:${TAG}${NC}"

echo -e "${CYAN}⬆️  Pushing to ECR (this may take a few minutes)...${NC}"
if docker push "${FRONTEND_REPO}:${TAG}"; then
    echo -e "${GREEN}✅ Frontend image pushed successfully${NC}"
else
    echo -e "${RED}❌ Failed to push frontend image${NC}"
    exit 1
fi

# Also tag as 'latest' if TAG is a version
if [[ "$TAG" != "latest" ]]; then
    docker tag "${PROJECT_NAME}-frontend:${TAG}" "${FRONTEND_REPO}:latest"
    docker push "${FRONTEND_REPO}:latest"
    echo -e "${GREEN}✅ Also tagged and pushed as 'latest'${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Deployment Complete! 🎉                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Images successfully pushed to ECR:${NC}"
echo ""
echo -e "${CYAN}Backend:${NC}"
echo -e "  ${BACKEND_REPO}:${TAG}"
if [[ "$TAG" != "latest" ]]; then
    echo -e "  ${BACKEND_REPO}:latest"
fi
echo ""
echo -e "${CYAN}Frontend:${NC}"
echo -e "  ${FRONTEND_REPO}:${TAG}"
if [[ "$TAG" != "latest" ]]; then
    echo -e "  ${FRONTEND_REPO}:latest"
fi
echo ""

# Verify images in ECR
echo -e "${YELLOW}📊 Verifying images in ECR...${NC}"
echo ""
echo -e "${CYAN}Backend images:${NC}"
aws ecr list-images --repository-name "${PROJECT_NAME}/backend" --region "$REGION" --output table

echo ""
echo -e "${CYAN}Frontend images:${NC}"
aws ecr list-images --repository-name "${PROJECT_NAME}/frontend" --region "$REGION" --output table

echo ""
echo -e "${GREEN}🎯 Next Steps:${NC}"
echo ""
echo "1. Update docker-compose.prod.yml with:"
echo "   export TAG=${TAG}"
echo ""
echo "2. Deploy to EC2:"
echo "   ./scripts/deploy_to_ec2.sh"
echo ""
echo "3. Or use docker-compose on your server:"
echo "   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
echo ""
echo -e "${YELLOW}💡 Tip: Set a custom tag with: TAG=v1.0.0 ./scripts/ecr_deploy.sh${NC}"
echo ""
