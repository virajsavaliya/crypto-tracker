#!/bin/bash

###############################################################################
# Quick Docker Reset & Start Script
# Purpose: Fast cleanup and startup for local development
# Usage: ./docker-quick-start.sh
###############################################################################

set -e

echo "🧹 Quick Docker Cleanup..."

# Stop and remove everything
docker-compose -f docker-compose.local.yml down -v 2>/dev/null || true
docker system prune -af --volumes

echo "✅ Cleanup complete!"
echo ""
echo "🚀 Starting services..."

# Start services
docker-compose -f docker-compose.local.yml up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ Services started!"
echo ""
echo "📊 Container Status:"
docker-compose -f docker-compose.local.yml ps
echo ""
echo "🌐 Access your application:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/api/"
echo ""
echo "📝 View logs:"
echo "   docker-compose -f docker-compose.local.yml logs -f"
echo ""
