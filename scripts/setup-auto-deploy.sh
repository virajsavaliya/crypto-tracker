#!/bin/bash

# Auto-Deployment Setup Script
# This script sets up GitHub webhook auto-deployment

set -e

echo "🚀 Setting up Auto-Deployment System"
echo "====================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Navigate to project directory
cd /root/crypto-tracker

# Generate a secure webhook secret
if [ ! -f /root/.webhook-secret ]; then
    echo "🔐 Generating webhook secret..."
    WEBHOOK_SECRET=$(openssl rand -hex 32)
    echo "$WEBHOOK_SECRET" > /root/.webhook-secret
    chmod 600 /root/.webhook-secret
    echo "✅ Webhook secret saved to /root/.webhook-secret"
else
    WEBHOOK_SECRET=$(cat /root/.webhook-secret)
    echo "✅ Using existing webhook secret"
fi

# Update the service file with the secret
echo "📝 Configuring systemd service..."
sed -i "s/your-webhook-secret-change-this/$WEBHOOK_SECRET/g" webhook-listener.service

# Copy service file to systemd directory
echo "📦 Installing systemd service..."
cp webhook-listener.service /etc/systemd/system/
chmod 644 /etc/systemd/system/webhook-listener.service

# Make scripts executable
chmod +x webhook-listener.py
chmod +x deploy-frontend.sh

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Enable the service to start on boot
echo "✅ Enabling webhook service..."
systemctl enable webhook-listener

# Start the service
echo "▶️  Starting webhook service..."
systemctl start webhook-listener

# Wait a moment for service to start
sleep 2

# Check service status
if systemctl is-active --quiet webhook-listener; then
    echo ""
    echo "✅ Auto-deployment system is running!"
    echo ""
    echo "📊 Service Status:"
    systemctl status webhook-listener --no-pager -l
    echo ""
    echo "🔗 Webhook Configuration:"
    echo "   URL: http://$(curl -s ifconfig.me):9000/webhook"
    echo "   Secret: $WEBHOOK_SECRET"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Go to GitHub: https://github.com/VaghasiyaAbhi/crypto-tracker/settings/hooks"
    echo "   2. Click 'Add webhook'"
    echo "   3. Set Payload URL to: http://$(curl -s ifconfig.me):9000/webhook"
    echo "   4. Set Content type to: application/json"
    echo "   5. Set Secret to the value shown above"
    echo "   6. Select 'Just the push event'"
    echo "   7. Click 'Add webhook'"
    echo ""
    echo "🔥 Open port 9000 in firewall:"
    echo "   sudo ufw allow 9000/tcp"
    echo ""
    echo "📄 Useful Commands:"
    echo "   View logs: sudo journalctl -u webhook-listener -f"
    echo "   Restart: sudo systemctl restart webhook-listener"
    echo "   Stop: sudo systemctl stop webhook-listener"
    echo "   Status: sudo systemctl status webhook-listener"
    echo ""
else
    echo "❌ Failed to start webhook service"
    echo "Check logs with: sudo journalctl -u webhook-listener -n 50"
    exit 1
fi
