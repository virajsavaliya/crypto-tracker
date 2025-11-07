#!/bin/bash
# Test connection to external PostgreSQL database
# Usage: ./test_postgres_connection.sh

echo "🔍 Testing PostgreSQL Connection..."
echo "=================================="
echo ""

# Database credentials
DB_HOST="46.62.216.158"
DB_PORT="5432"
DB_NAME="crypto_tracker_db"
DB_USER="Abhishek.vaghasiya2016@gmail.com"
DB_PASS="Abhishek.vaghasiya2016"

# Test 1: Check if port is accessible
echo "Test 1: Checking if PostgreSQL port is accessible..."
nc -zv $DB_HOST $DB_PORT 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Port $DB_PORT is accessible"
else
    echo "❌ Port $DB_PORT is NOT accessible"
    echo "   Make sure firewall allows connection: ufw allow 5432/tcp"
    exit 1
fi
echo ""

# Test 2: Try to connect using psql (if available)
echo "Test 2: Attempting database connection..."
if command -v psql &> /dev/null; then
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U "$DB_USER" -d $DB_NAME -c "\conninfo" 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Database connection successful!"
        
        # Test 3: Check database tables
        echo ""
        echo "Test 3: Checking database tables..."
        PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U "$DB_USER" -d $DB_NAME -c "\dt" 2>&1
        
        # Test 4: Check database size
        echo ""
        echo "Test 4: Checking database size..."
        PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U "$DB_USER" -d $DB_NAME -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>&1
    else
        echo "❌ Database connection failed!"
        echo "   Check credentials and PostgreSQL configuration (pg_hba.conf)"
        exit 1
    fi
else
    echo "⚠️  psql command not found. Install PostgreSQL client:"
    echo "   macOS: brew install postgresql"
    echo "   Ubuntu/Debian: apt-get install postgresql-client"
    echo ""
    echo "   Skipping database connection test..."
fi
echo ""

# Test 3: Test from Docker environment
echo "Test 5: Testing connection from Docker container..."
if command -v docker &> /dev/null; then
    docker run --rm postgres:15-alpine psql "postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME" -c "SELECT version();" 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Docker container can connect to database!"
    else
        echo "❌ Docker container cannot connect to database"
        echo "   This might be a network or firewall issue"
    fi
else
    echo "⚠️  Docker not found. Skipping Docker connection test..."
fi
echo ""

# Summary
echo "=================================="
echo "📊 Connection Test Summary"
echo "=================================="
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""
echo "🔗 pgAdmin URL: http://$DB_HOST:5050"
echo "=================================="
