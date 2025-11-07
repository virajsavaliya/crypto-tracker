#!/usr/bin/env bash
set -euo pipefail

cat <<'NOTICE'
NOTICE: AWS/ECR repository creation script removed.
This repository has been decoupled from provider-specific automation.
If you need provider-specific setup (ECR, GHCR, Hetzner registry), add a dedicated script under /deploy or request one.
NOTICE

exit 0
