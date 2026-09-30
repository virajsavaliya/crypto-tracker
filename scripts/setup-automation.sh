#!/bin/bash
#######################################################################
# SETUP AUTOMATED MONITORING AND SELF-HEALING SYSTEM
# This installs all automation scripts and schedules them via cron
#######################################################################

set -e

echo "=========================================="
echo "Setting up Automated Monitoring System"
echo "=========================================="

# Install monitoring scripts to server
echo "📦 Installing monitoring scripts..."

# Make auto-repair script executable
chmod +x /root/crypto-tracker/scripts/auto-repair.sh

# Create cron job for auto-repair (every 5 minutes)
echo "⏰ Setting up cron jobs..."

# Remove existing auto-repair cron if present
crontab -l 2>/dev/null | grep -v "auto-repair.sh" | crontab - 2>/dev/null || true

# Add new cron jobs
(crontab -l 2>/dev/null; echo "# Auto-repair system - runs every 5 minutes") | crontab -
(crontab -l 2>/dev/null; echo "*/5 * * * * /root/crypto-tracker/scripts/auto-repair.sh >> /var/log/auto-repair.log 2>&1") | crontab -

# Keep existing maintenance crons
echo ""
echo "✅ Cron jobs installed:"
crontab -l | grep -E "auto-repair|docker-cleanup|disk-monitor"

# Create log rotation for auto-repair logs
echo ""
echo "📝 Setting up log rotation..."

cat > /etc/logrotate.d/auto-repair << 'EOF'
/var/log/auto-repair.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
EOF

# Install additional monitoring tools
echo ""
echo "🔧 Installing monitoring tools..."

apt-get update > /dev/null 2>&1
apt-get install -y htop iotop sysstat curl jq bc > /dev/null 2>&1

# Create systemd service for critical monitoring (optional)
cat > /etc/systemd/system/crypto-monitor.service << 'EOF'
[Unit]
Description=Crypto Trading Dashboard Monitor
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/root/crypto-tracker/scripts/auto-repair.sh
StandardOutput=append:/var/log/auto-repair.log
StandardError=append:/var/log/auto-repair.log

[Install]
WantedBy=multi-user.target
EOF

# Create systemd timer for the service (runs every 5 minutes)
cat > /etc/systemd/system/crypto-monitor.timer << 'EOF'
[Unit]
Description=Run Crypto Monitor every 5 minutes
Requires=crypto-monitor.service

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=1s

[Install]
WantedBy=timers.target
EOF

# Enable and start the timer
systemctl daemon-reload
systemctl enable crypto-monitor.timer
systemctl start crypto-monitor.timer

# Test auto-repair script
echo ""
echo "🧪 Testing auto-repair script..."
/root/crypto-tracker/scripts/auto-repair.sh

# Create dashboard for monitoring
cat > /usr/local/bin/status-dashboard << 'EOF'
#!/bin/bash
#######################################################################
# Quick Status Dashboard - Shows system health at a glance
#######################################################################

clear
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          VoluSignal.com - System Status Dashboard             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# System Resources
echo "📊 SYSTEM RESOURCES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
df -h / | awk 'NR==1 {print "Disk:     "$0} NR==2 {print "          "$0}'
free -h | awk 'NR==1 {print "Memory:   "$0} NR==2 {print "          "$0}'
uptime | awk '{print "Uptime:   "$0}'
echo ""

# Docker Containers
echo "🐳 DOCKER CONTAINERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd /root/crypto-tracker
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" | head -n 10
echo ""

# Website Status
echo "🌐 WEBSITE STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://volusignal.com/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Website:     ONLINE (HTTP $HTTP_CODE)"
else
    echo "❌ Website:     OFFLINE (HTTP $HTTP_CODE)"
fi

# Redis Check
if docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "✅ Redis:       CONNECTED"
else
    echo "❌ Redis:       DISCONNECTED"
fi

# Database Check
if docker-compose exec -T backend1 python -c "import psycopg2, os; psycopg2.connect(os.environ['DATABASE_URL'])" 2>/dev/null; then
    echo "✅ Database:    CONNECTED"
else
    echo "❌ Database:    DISCONNECTED"
fi

echo ""

# Recent Issues
echo "📋 RECENT AUTO-REPAIRS (Last 10)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f /var/log/auto-repair.log ]; then
    tail -n 10 /var/log/auto-repair.log | grep -E "\[ERROR\]|\[WARNING\]|ALERT|SUCCESS" | tail -5
else
    echo "No repair logs found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Last updated: $(date)"
echo "Run 'status-dashboard' anytime to view this dashboard"
echo ""
EOF

chmod +x /usr/local/bin/status-dashboard

# Create alert configuration file
cat > /root/crypto-tracker/scripts/alert-config.json << 'EOF'
{
  "webhook_url": "",
  "email": "your-email@example.com",
  "thresholds": {
    "disk_usage_percent": 85,
    "memory_usage_percent": 90,
    "ssl_expiry_days": 30,
    "response_time_ms": 5000
  },
  "check_interval_minutes": 5,
  "enabled": true
}
EOF

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              ✅ AUTOMATED MONITORING INSTALLED                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 What's been set up:"
echo ""
echo "  ✅ Auto-repair script       → Runs every 5 minutes"
echo "  ✅ Health monitoring        → Checks 11 critical systems"
echo "  ✅ Self-healing             → Auto-fixes common issues"
echo "  ✅ Disk cleanup             → Triggers at 85% usage"
echo "  ✅ Container restart        → Auto-restarts failed services"
echo "  ✅ Redis recovery           → Fixes corrupted data"
echo "  ✅ Website monitoring       → Checks HTTP status"
echo "  ✅ Log rotation             → Keeps logs manageable"
echo "  ✅ Status dashboard         → 'status-dashboard' command"
echo ""
echo "🔧 Configuration files:"
echo ""
echo "  • Auto-repair:   /root/crypto-tracker/scripts/auto-repair.sh"
echo "  • Alert config:  /root/crypto-tracker/scripts/alert-config.json"
echo "  • Logs:          /var/log/auto-repair.log"
echo "  • Cron jobs:     crontab -l"
echo ""
echo "📊 View system status anytime:"
echo ""
echo "  → status-dashboard"
echo ""
echo "🔍 Check logs:"
echo ""
echo "  → tail -f /var/log/auto-repair.log"
echo "  → tail -f /var/log/docker-cleanup.log"
echo "  → tail -f /var/log/disk-monitor.log"
echo ""
echo "⚙️  Customize alerts:"
echo ""
echo "  1. Edit: nano /root/crypto-tracker/scripts/alert-config.json"
echo "  2. Add webhook URL for Slack/Discord notifications"
echo "  3. Update email address for critical alerts"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Your system is now self-healing and fully automated!"
echo ""
echo "The system will automatically:"
echo "  • Detect issues every 5 minutes"
echo "  • Fix common problems without manual intervention"
echo "  • Alert you if manual action is needed"
echo "  • Keep services running smoothly 24/7"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
