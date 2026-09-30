#!/bin/bash

# Frontend Deployment Script
# This script ensures clean builds and handles common deployment issues

set -e  # Exit on any error

echo "🚀 Starting frontend deployment..."
echo "=================================="

# Navigate to project directory
cd /root/crypto-tracker

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git fetch origin main
git reset --hard origin/main
echo "✅ Code updated to latest version"

# Stop and remove existing frontend container
echo "🛑 Stopping existing frontend container..."
docker stop crypto-tracker-frontend-1 2>/dev/null || docker stop crypto-tracker_frontend_1 2>/dev/null || true
docker rm crypto-tracker-frontend-1 2>/dev/null || docker rm crypto-tracker_frontend_1 2>/dev/null || true
echo "✅ Old container removed"

# Build frontend with NO CACHE to ensure fresh build
echo "🏗️  Building frontend (no cache - fresh build)..."
docker compose -f docker-compose.yml build --no-cache frontend
echo "✅ Frontend built successfully"

# Start frontend
echo "▶️  Starting frontend container..."
docker compose -f docker-compose.yml up -d frontend

# Wait for frontend to be healthy
echo "⏳ Waiting for frontend to become healthy..."
for i in {1..30}; do
    if docker ps | grep -qE "crypto-tracker[-_]frontend[-_]1.*healthy"; then
        echo "✅ Frontend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Frontend didn't become healthy in time"
        docker logs --tail 20 crypto-tracker-frontend-1 2>/dev/null || docker logs --tail 20 crypto-tracker_frontend_1 2>/dev/null
        exit 1
    fi
    sleep 2
    echo "   Checking... ($i/30)"
done

# Restart nginx to refresh DNS cache
echo "🔄 Restarting nginx to refresh DNS..."
docker compose -f docker-compose.yml restart nginx

# Wait for nginx to be healthy
echo "⏳ Waiting for nginx to become healthy..."
sleep 10
for i in {1..15}; do
    if docker ps | grep -qE "crypto-tracker[-_]nginx[-_]1.*healthy"; then
        echo "✅ Nginx is healthy"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️  Nginx health check timeout - checking manually..."
        docker logs --tail 10 crypto-tracker-nginx-1 2>/dev/null || docker logs --tail 10 crypto-tracker_nginx_1 2>/dev/null
    fi
    sleep 2
    echo "   Checking... ($i/15)"
done

# Verify deployment
echo ""
echo "🔍 Verifying deployment..."
echo "=================================="
docker ps | grep -E 'frontend|nginx' || echo "⚠️  Containers not found"

echo ""
echo "✅ Deployment complete!"
echo "=================================="
echo "Frontend: http://localhost:3000"
echo "Public URL: https://volusignal.com"
echo ""
echo "To check logs:"
echo "  docker logs -f crypto-tracker-frontend-1"
echo "  docker logs -f crypto-tracker-nginx-1"
