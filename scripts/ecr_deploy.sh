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
#!/usr/bin/env bash
set -euo pipefail

echo "NOTICE: AWS/ECR deployment script removed."
echo "This repository is provider-agnostic. Provider-specific automation (AWS ECR) has been removed." 
echo "If you need deployment automation for Hetzner, Docker Hub, or GHCR, add a script under /deploy or request one." 
exit 0

