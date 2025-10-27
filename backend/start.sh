#!/bin/bash
# start.sh
# Purpose: Production-ready backend startup with migrations and static files
# Reduces server load: Proper initialization, graceful handling, optimized Gunicorn config
# Test: docker run -e DATABASE_URL=... backend

set -euo pipefail

echo "Starting Django backend..."

# Wait for database to be ready
echo "Waiting for database..."
python manage.py migrate --check || {
    echo "Running database migrations..."
    python manage.py migrate
}

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

# Create superuser if needed (development only)
if [ "${DEBUG:-0}" = "1" ]; then
    echo "Creating superuser for development..."
    python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin/admin123')
"
fi

# Start the appropriate server
if [ "${DEBUG:-0}" = "1" ]; then
    echo "Starting development server with ASGI support..."
    exec daphne -b 0.0.0.0 -p 8000 project_config.asgi:application
else
    echo "Starting production server with Daphne (ASGI)..."
    exec daphne -b 0.0.0.0 -p 8000 \
        --access-log /dev/stdout \
        --proxy-headers \
        project_config.asgi:application
fi