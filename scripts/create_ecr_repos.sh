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
    #!/usr/bin/env bash
    set -euo pipefail

    # This script was intentionally neutralized.
    # AWS/ECR-specific automation was removed from this repository to
    # decouple the codebase from provider-specific tooling. Please manage
    # provider resources (ECR, registries, etc.) outside the repo or via
    # a dedicated private automation repository.

    echo "NOTICE: AWS/ECR automation removed from repository."
    echo "If you need an automated deployment to a specific provider (Hetzner, AWS, etc.),"
    echo "request a provider-specific script and it will be added separately."
    exit 0
    echo "   See: ECR_SETUP_GUIDE.md for details"
