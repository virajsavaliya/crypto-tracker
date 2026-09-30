#!/bin/bash
# emergency-stop.sh - Stop all services immediately if abuse is detected
# Use this to stop server activity while investigating issues

set -euo pipefail

echo "🚨 EMERGENCY STOP - Shutting down all services"
echo "=============================================="

cd /root/crypto-tracker

echo "1. Stopping Docker Compose services..."
docker-compose down

echo "2. Stopping all running containers..."
docker stop $(docker ps -aq) 2>/dev/null || true

echo "3. Checking remaining processes..."
docker ps -a

echo "4. Network connections before shutdown:"
netstat -tupn | grep ESTABLISHED | wc -l
echo "   active connections"

echo ""
echo "✅ ALL SERVICES STOPPED"
echo ""
echo "Server is now in safe mode. All Docker containers stopped."
echo "To restart: docker-compose up -d"
