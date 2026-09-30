#!/bin/bash
# post-unblock-fix.sh - Run this IMMEDIATELY after server is unblocked
# This fixes the root causes that led to the IP block

set -euo pipefail

echo "🔧 POST-UNBLOCK FIX SCRIPT"
echo "=========================="
echo ""

cd /root/crypto-tracker

echo "1. Stopping all services..."
docker-compose down
sleep 5

echo "2. Cleaning up Docker resources..."
docker system prune -f

echo "3. Clearing memory caches..."
sync
echo 3 > /proc/sys/vm/drop_caches
free -h

echo "4. Pulling latest code with fixes..."
git pull origin main

echo "5. Starting services with new limits..."
docker-compose up -d

echo "6. Waiting for services to be healthy..."
sleep 30
docker-compose ps

echo "7. Installing automation system..."
chmod +x scripts/setup-automation.sh
./scripts/setup-automation.sh

echo "8. Setting up firewall rules..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw limit ssh

echo "9. Installing monitoring tools..."
apt-get update
apt-get install -y sysstat htop iotop nethogs

echo "10. Checking final status..."
docker-compose ps
free -h
df -h

echo ""
echo "✅ POST-UNBLOCK FIX COMPLETED!"
echo ""
echo "Next steps:"
echo "1. Monitor with: watch -n 5 'docker stats --no-stream'"
echo "2. Check logs: tail -f /var/log/auto-repair.log"
echo "3. View automation status: systemctl status auto-repair.timer"
echo ""
echo "The server should now be stable with automatic monitoring!"
