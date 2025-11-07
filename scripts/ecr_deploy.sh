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
        #!/usr/bin/env bash
        set -euo pipefail

        # This script was intentionally neutralized.
        # AWS/ECR-specific deployment automation has been removed from the repository.
        # Manage image registries and provider-specific pushes outside this repo or
        # via a private deployment repository.

        echo "NOTICE: ECR deployment script disabled."
        echo "Provider-specific automation removed. Use a provider-specific script or CI job."
        exit 0
    exit 1
