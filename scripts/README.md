# Scripts Directory

This folder contains deployment, testing, and utility scripts for the crypto tracker project.

## Deployment Scripts

- **`deploy-frontend.sh`** - Deploys frontend with cache clearing
- **`deploy-pgbouncer.sh`** - Deploys PgBouncer connection pooler
- **`deploy-to-server.sh`** - Full server deployment script
- **`fix_502.sh`** - Quick fix for 502 Bad Gateway errors (rebuilds all containers)

## Setup Scripts

- **`setup-auto-deploy.sh`** - Sets up GitHub webhook auto-deployment
- **`setup-github-secrets.sh`** - Configures GitHub Actions secrets
- **`SETUP_GITHUB_WEBHOOK.md`** - Documentation for webhook setup

## Development Scripts

- **`local-dev.sh`** - Starts local development environment
- **`test-local-docker.sh`** - Tests local Docker setup
- **`test-return-pct-fix.sh`** - Tests return percentage calculations

## Webhook System

- **`webhook-listener.py`** - Python webhook receiver for auto-deployment
- **`webhook-listener.service`** - Systemd service configuration

## Testing & Verification

- **`verify_alerts.py`** - Creates test alerts for all alert types

## Quick Commands

```bash
# Fix 502 errors and rebuild everything
bash scripts/fix_502.sh

# Start local development
bash scripts/local-dev.sh

# Deploy frontend only
bash scripts/deploy-frontend.sh

# Verify all alert types work
python3 scripts/verify_alerts.py
```
