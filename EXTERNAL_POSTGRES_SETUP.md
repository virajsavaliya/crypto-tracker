# 🗄️ External PostgreSQL Configuration

This document explains how the application is configured to use an external PostgreSQL server instead of Docker-based PostgreSQL.

---

## 📊 Configuration Overview

### External PostgreSQL Server Details

| Field | Value |
|-------|-------|
| **Name** | Crypto Tracker Production |
| **Host** | 46.62.216.158 |
| **Port** | 5432 |
| **Database** | crypto_tracker_db |
| **Username** | Abhishek.vaghasiya2016@gmail.com |
| **Password** | Abhishek.vaghasiya2016 |
| **Management** | pgAdmin at http://46.62.216.158:5050 |

---

## ✅ Benefits of External PostgreSQL

1. **Data Security** 🔒
   - Database data persists independently of Docker containers
   - No risk of data loss if containers are removed
   - Separate backup and recovery processes

2. **Better Resource Management** 💪
   - Frees up ~1GB RAM from Docker containers
   - PostgreSQL can use dedicated server resources
   - Reduces Docker Compose complexity

3. **Easier Management** 🎯
   - Direct access via pgAdmin web interface
   - No need to exec into containers for database operations
   - Centralized database administration

4. **Production Ready** 🚀
   - Professional deployment architecture
   - Standard production setup pattern
   - Easier to scale and monitor

---

## 🔧 Changes Made

### 1. Removed from `docker-compose.yml`:
- ❌ `postgres` service (PostgreSQL 15 container)
- ❌ `pgbouncer` service (connection pooler - not needed for external DB)
- ❌ `postgres_data` volume
- ❌ All `depends_on: postgres` and `depends_on: pgbouncer` conditions

### 2. Updated `backend/.env`:
```env
# OLD (Docker PostgreSQL):
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/crypto_tracker?sslmode=disable

# NEW (External PostgreSQL):
DATABASE_URL=postgresql://Abhishek.vaghasiya2016@gmail.com:Abhishek.vaghasiya2016@46.62.216.158:5432/crypto_tracker_db?sslmode=disable
```

### 3. Simplified Dependencies:
All backend services now only depend on Redis:
- `backend1` - Django application
- `celery-worker` - Background task processing
- `celery-beat` - Task scheduler
- `data-worker` - Binance WebSocket data fetcher
- `calc-worker` - Metrics calculation worker

---

## 🚀 How to Deploy

### Step 1: Ensure PostgreSQL Server is Running
```bash
# SSH to your server
ssh root@46.62.216.158

# Check PostgreSQL status
systemctl status postgresql

# If not running, start it
systemctl start postgresql
```

### Step 2: Verify Database Exists
```bash
# Check if database and user exist
sudo -u postgres psql -c "\l" | grep crypto_tracker_db
sudo -u postgres psql -c "\du" | grep "Abhishek.vaghasiya2016@gmail.com"
```

### Step 3: Test Connection from Your Local Machine
```bash
# Install PostgreSQL client if not installed
brew install postgresql  # macOS
# or
apt-get install postgresql-client  # Linux

# Test connection
psql "postgresql://Abhishek.vaghasiya2016@gmail.com:Abhishek.vaghasiya2016@46.62.216.158:5432/crypto_tracker_db"
```

### Step 4: Deploy Application with Docker Compose
```bash
# Navigate to your project directory
cd /path/to/crypto-tracker

# Stop any existing containers
docker compose down

# Pull latest images and start services
docker compose up -d

# Check logs
docker compose logs -f
```

### Step 5: Run Database Migrations
```bash
# Migrations will run automatically via data-worker service
# Or run manually:
docker compose exec backend1 python manage.py migrate
```

---

## 🔍 Troubleshooting

### Connection Issues

**Problem**: Can't connect to external PostgreSQL from Docker containers

**Solution 1**: Check PostgreSQL configuration allows remote connections
```bash
# On the server (46.62.216.158)
sudo nano /etc/postgresql/*/main/postgresql.conf
# Ensure: listen_addresses = '*'

sudo nano /etc/postgresql/*/main/pg_hba.conf
# Ensure this line exists:
# host    all             all             0.0.0.0/0               md5

# Restart PostgreSQL
systemctl restart postgresql
```

**Solution 2**: Check firewall allows port 5432
```bash
# On the server
ufw status | grep 5432
# Should show: 5432                       ALLOW       Anywhere

# If not allowed:
ufw allow 5432/tcp
```

**Solution 3**: Verify credentials in `.env` file
```bash
# Check your backend/.env file
cat backend/.env | grep DATABASE_URL
```

### Migration Issues

**Problem**: Migrations fail with "relation already exists"

**Solution**: This is usually safe to ignore. The migration system tracks what's applied.
```bash
# Check migration status
docker compose exec backend1 python manage.py showmigrations

# Fake a migration if needed (use carefully!)
docker compose exec backend1 python manage.py migrate --fake core
```

### Permission Issues

**Problem**: Database user doesn't have sufficient permissions

**Solution**: Grant all privileges
```bash
# On the PostgreSQL server
sudo -u postgres psql << 'EOF'
GRANT ALL PRIVILEGES ON DATABASE crypto_tracker_db TO "Abhishek.vaghasiya2016@gmail.com";
ALTER DATABASE crypto_tracker_db OWNER TO "Abhishek.vaghasiya2016@gmail.com";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "Abhishek.vaghasiya2016@gmail.com";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "Abhishek.vaghasiya2016@gmail.com";
\q
EOF
```

---

## 📦 Backup & Restore

### Backup Database
```bash
# SSH to server
ssh root@46.62.216.158

# Create backup
sudo -u postgres pg_dump crypto_tracker_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip backup_*.sql

# Download backup to local machine (from local terminal)
scp root@46.62.216.158:~/backup_*.sql.gz ./backups/
```

### Restore Database
```bash
# SSH to server
ssh root@46.62.216.158

# Stop application (optional but recommended)
# docker compose down (if running on same server)

# Restore from backup
gunzip backup_20241107_120000.sql.gz
sudo -u postgres psql crypto_tracker_db < backup_20241107_120000.sql

# Restart application
# docker compose up -d
```

### Automated Backups (Recommended)
```bash
# Create backup script
cat > /root/backup_postgres.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/postgres_backups"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
sudo -u postgres pg_dump crypto_tracker_db | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
echo "Backup completed: backup_$TIMESTAMP.sql.gz"
EOF

chmod +x /root/backup_postgres.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup_postgres.sh >> /var/log/postgres_backup.log 2>&1") | crontab -
```

---

## 🔐 Security Best Practices

1. **Change Default Passwords** ⚠️
   ```bash
   # Generate strong password
   openssl rand -base64 32
   
   # Update PostgreSQL user password
   sudo -u postgres psql -c "ALTER USER \"Abhishek.vaghasiya2016@gmail.com\" WITH PASSWORD 'your_new_strong_password';"
   
   # Update backend/.env with new password
   ```

2. **Restrict Remote Access** 🔒
   ```bash
   # Instead of allowing all IPs (0.0.0.0/0), restrict to specific IPs
   # Edit pg_hba.conf:
   sudo nano /etc/postgresql/*/main/pg_hba.conf
   
   # Replace:
   # host    all             all             0.0.0.0/0               md5
   
   # With (example for specific IP):
   # host    all             all             YOUR_APP_SERVER_IP/32    md5
   ```

3. **Enable SSL/TLS** 🔐
   ```bash
   # Generate SSL certificate
   sudo openssl req -new -x509 -days 365 -nodes -text \
     -out /etc/postgresql/*/main/server.crt \
     -keyout /etc/postgresql/*/main/server.key
   
   # Set permissions
   sudo chmod 600 /etc/postgresql/*/main/server.key
   sudo chown postgres:postgres /etc/postgresql/*/main/server.*
   
   # Enable SSL in postgresql.conf
   sudo nano /etc/postgresql/*/main/postgresql.conf
   # Add: ssl = on
   
   # Update DATABASE_URL to use SSL:
   # DATABASE_URL=postgresql://...?sslmode=require
   ```

4. **Regular Updates** 🔄
   ```bash
   # Keep PostgreSQL updated
   apt-get update
   apt-get upgrade postgresql
   ```

5. **Monitor Logs** 📊
   ```bash
   # Check PostgreSQL logs
   tail -f /var/log/postgresql/postgresql-*-main.log
   
   # Monitor connections
   sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname = 'crypto_tracker_db';"
   ```

---

## 📈 Performance Monitoring

### Check Database Size
```bash
sudo -u postgres psql -c "\l+ crypto_tracker_db"
```

### Check Table Sizes
```bash
sudo -u postgres psql crypto_tracker_db -c "
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### Check Active Connections
```bash
sudo -u postgres psql -c "
SELECT 
    COUNT(*), 
    state 
FROM pg_stat_activity 
WHERE datname = 'crypto_tracker_db' 
GROUP BY state;
"
```

### Slow Query Analysis
```bash
# Enable slow query logging in postgresql.conf
sudo nano /etc/postgresql/*/main/postgresql.conf
# Add:
# log_min_duration_statement = 1000  # Log queries taking > 1 second

# View slow queries
sudo tail -f /var/log/postgresql/postgresql-*-main.log | grep "duration:"
```

---

## 🔄 Switching Back to Docker PostgreSQL (If Needed)

If you ever need to switch back to Docker-based PostgreSQL:

1. **Export data from external database**
   ```bash
   pg_dump -h 46.62.216.158 -U "Abhishek.vaghasiya2016@gmail.com" crypto_tracker_db > export.sql
   ```

2. **Revert docker-compose.yml changes** (use git to restore postgres service)

3. **Update backend/.env**
   ```env
   DATABASE_URL=postgresql://postgres:postgres@postgres:5432/crypto_tracker?sslmode=disable
   ```

4. **Start with Docker Compose**
   ```bash
   docker compose up -d postgres
   docker compose exec postgres psql -U postgres -c "CREATE DATABASE crypto_tracker;"
   docker compose exec backend1 python manage.py migrate
   ```

5. **Import data**
   ```bash
   cat export.sql | docker compose exec -T postgres psql -U postgres crypto_tracker
   ```

---

## 📞 Support

- **pgAdmin**: http://46.62.216.158:5050
- **Documentation**: See `LINUX_SERVER_COMMANDS.md` for all server commands
- **Deployment Guide**: See `DEPLOY_HETZNER.md` for full deployment instructions

---

**Last Updated**: November 7, 2025
