#!/bin/bash
# start.sh
# Purpose: Flexible startup script that handles both Django server and Celery
# Usage: 
#   - No args: Start Daphne server
#   - With args: Run the provided command (e.g., "celery -A project_config worker")

set -euo pipefail

echo "Starting Django backend..."

# Wait for database to be ready (for all services)
echo "Waiting for database..."
python manage.py migrate --check 2>/dev/null || {
    echo "Running database migrations..."
    python manage.py migrate
}

# Only do web-server specific setup if not running Celery
if [ "${1:-}" != "celery" ]; then
    echo "Collecting static files..."
    python manage.py collectstatic --noinput || true
    
    if [ "${DEBUG:-0}" = "1" ]; then
        echo "Creating superuser for development..."
        python manage.py loaddata core/fixtures/initial_data.json 2>/dev/null || true
    fi
fi

# If arguments provided, execute them; otherwise start default server
if [ $# -gt 0 ]; then
    echo "Running command: $@"
    exec "$@"
else
    # Start Binance WebSocket client in background for real-time data updates
    echo "Starting Binance WebSocket client in background..."
    python manage.py start_binance_ws &
    
    if [ "${DEBUG:-0}" = "1" ]; then
        echo "Starting development server with ASGI support..."
        exec daphne -b 0.0.0.0 -p 8000 project_config.asgi:application
    else
        echo "Starting production server with Daphne (ASGI)..."
        exec daphne -b 0.0.0.0 -p 8000 --access-log /dev/stdout --proxy-headers project_config.asgi:application
    fi
fi
