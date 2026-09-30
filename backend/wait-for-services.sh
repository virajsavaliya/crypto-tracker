#!/bin/bash
# wait-for-services.sh
# Purpose: Wait for database services to be ready before starting application
# Usage: ./wait-for-services.sh [host] [port] [timeout]

set -e

# Default to 'db' for local development, can be overridden with environment variable or argument
host="${1:-${DB_HOST:-db}}"
port="${2:-${DB_PORT:-5432}}"
timeout="${3:-60}"

echo "⏳ Waiting for $host:$port to be ready..."
echo "   Timeout: ${timeout}s"

start_time=$(date +%s)

until pg_isready -h "$host" -p "$port" -U postgres -q 2>/dev/null; do
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))
  
  if [ $elapsed -ge $timeout ]; then
    echo "❌ ERROR: Timeout waiting for $host:$port after ${timeout}s"
    exit 1
  fi
  
  echo "   Waiting for $host:$port... (${elapsed}s elapsed)"
  sleep 2
done

echo "✅ $host:$port is ready!"
echo "   Took $(($(date +%s) - start_time))s"

# Additional check: Try to actually connect via psql
echo "🔍 Verifying database connection..."

# Extract database name from DATABASE_URL or use default
DB_NAME="${DB_NAME:-crypto_tracker_db}"

if PGPASSWORD=postgres psql -h "$host" -p "$port" -U postgres -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ Database connection verified successfully!"
else
  echo "⚠️  WARNING: Database $DB_NAME doesn't exist or connection failed. Trying to connect to postgres database..."
  if PGPASSWORD=postgres psql -h "$host" -p "$port" -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Connected to postgres database. Database will be created during migrations."
  else
    echo "❌ ERROR: Could not verify database connection"
    exit 1
  fi
fi

echo "🚀 All checks passed. Proceeding with application startup..."
