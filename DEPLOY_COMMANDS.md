# 🚀 Quick Deployment Commands - Remove Docker PostgreSQL

## For Hetzner Server (46.62.216.158)

---

## 📋 Prerequisites Check

Before deployment, make sure:
1. ✅ External PostgreSQL is running: `systemctl status postgresql`
2. ✅ Database exists: `crypto_tracker_db`
3. ✅ User exists: `Abhishek.vaghasiya2016@gmail.com`
4. ✅ pgAdmin accessible: http://46.62.216.158:5050

---

## 🎯 Option 1: Automated Deployment (RECOMMENDED)

### Single Command Deployment:

```bash
# SSH to your server
ssh root@46.62.216.158

# Download and run deployment script
curl -fsSL https://raw.githubusercontent.com/virajsavaliya/crypto-tracker/main/deploy_external_postgres.sh | bash
```

**OR** if you already have the repo:

```bash
# SSH to your server
ssh root@46.62.216.158

# Go to project directory
cd /root/crypto-tracker

# Pull latest changes
git pull origin main

# Run deployment script
chmod +x deploy_external_postgres.sh
./deploy_external_postgres.sh
```

---

## 🔧 Option 2: Manual Step-by-Step Commands

If you prefer to run commands manually:

### Step 1: SSH to Server
```bash
ssh root@46.62.216.158
```

### Step 2: Verify External PostgreSQL
```bash
# Check PostgreSQL is running
systemctl status postgresql

# If not running, start it
systemctl start postgresql

# Verify database exists
sudo -u postgres psql -l | grep crypto_tracker_db

# Test connection
PGPASSWORD='Abhishek.vaghasiya2016' psql -h 46.62.216.158 -U 'Abhishek.vaghasiya2016@gmail.com' -d crypto_tracker_db -c "SELECT version();"
```

### Step 3: Backup Existing Docker PostgreSQL (Optional but Recommended)
```bash
# Go to project directory
cd /root/crypto-tracker

# Backup if postgres container exists
if docker ps | grep -q postgres; then
  docker exec postgres pg_dump -U postgres crypto_tracker > /root/backup_$(date +%Y%m%d_%H%M%S).sql
  echo "Backup created!"
fi
```

### Step 4: Stop and Remove Docker Containers
```bash
# Stop all containers
docker compose down

# Remove PostgreSQL containers specifically
docker rm -f postgres pgbouncer 2>/dev/null

# Remove PostgreSQL volumes (frees disk space)
docker volume rm $(docker volume ls -q | grep postgres) 2>/dev/null

# Verify removal
docker ps -a | grep postgres  # Should show nothing
docker volume ls | grep postgres  # Should show nothing
```

### Step 5: Update Code from GitHub
```bash
# Navigate to project
cd /root/crypto-tracker

# Pull latest changes (contains updated docker-compose.yml)
git stash  # Save any local changes
git pull origin main

# Verify docker-compose.yml is updated
grep -A 5 "# NOTE: PostgreSQL runs externally" docker-compose.yml
```

### Step 6: Update .env File
```bash
# Edit backend .env file
nano backend/.env

# Update this line (or add if missing):
# DATABASE_URL=postgresql://Abhishek.vaghasiya2016@gmail.com:Abhishek.vaghasiya2016@46.62.216.158:5432/crypto_tracker_db?sslmode=disable

# Save: Ctrl+O, Enter
# Exit: Ctrl+X
```

**OR use this automated command:**
```bash
cd /root/crypto-tracker
cat > backend/.env << 'EOF'
# === DOCKER ENVIRONMENT ===
DOCKER_ENV=1

# === DJANGO SETTINGS ===
DEBUG=1
SECRET_KEY="django-insecure-@8j_u!8w%5^s@p_k6w_w_x_j(n+&k85n_c!g9$n-n_w!s"

# === DATABASE CONFIGURATION ===
# Using external PostgreSQL on Hetzner (46.62.216.158:5432)
DATABASE_URL=postgresql://Abhishek.vaghasiya2016@gmail.com:Abhishek.vaghasiya2016@46.62.216.158:5432/crypto_tracker_db?sslmode=disable

# === REDIS CONFIGURATION ===
REDIS_URL=redis://redis:6379/0

# === CELERY CONFIGURATION ===
CELERY_BROKER_URL=redis://redis:6379/1

# === CORS AND ALLOWED HOSTS ===
ALLOWED_HOSTS=localhost,127.0.0.1,46.62.216.158,backend1,nginx,*
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,http://46.62.216.158:3000,http://46.62.216.158:8080

# === FRONTEND URLS ===
FRONTEND_URL=http://46.62.216.158:3000

# === EMAIL CONFIGURATION ===
EMAIL_HOST_USER=savaliyaviraj5@gmail.com
EMAIL_HOST_PASSWORD=pdmbmmqcepwmwssb

# === STRIPE CONFIGURATION ===
STRIPE_SECRET_KEY=sk_test_51S2oJlDM44PIrnngu6OWgoBjPk7iZoluR2Dn6q1MRCG2DG51xgi3Vtb0VSZHK9LaAB8e5Ws8yu4biZb0LsV5D62600xytd7dCf
STRIPE_WEBHOOK_SECRET=whsec_5d40031424827949f143a50ea30ca66778498bdb933dc4499e54961ef4f7b546
STRIPE_PRICE_ID_BASIC=price_1S2resDM44PIrnngv05qDmcp
STRIPE_PRICE_ID_ENTERPRISE=price_1S2rfMDM44PIrnngUeig13MG

# === TELEGRAM BOT CONFIGURATION ===
TELEGRAM_BOT_TOKEN=8446563628:AAFC-G2nFdFvV4rH6NlCG3ATHFaz-pu2b8A
TELEGRAM_BOT_USERNAME=virajtesting_bot
BACKEND_URL=http://46.62.216.158:8080
EOF

echo "✅ .env file updated!"
```

### Step 7: Test Database Connection
```bash
# Test connection to external PostgreSQL
PGPASSWORD='Abhishek.vaghasiya2016' psql -h 46.62.216.158 -U 'Abhishek.vaghasiya2016@gmail.com' -d crypto_tracker_db -c "SELECT 'Connection successful!';"
```

### Step 8: Build and Start Containers
```bash
# Build images
docker compose build

# Start all services
docker compose up -d

# Wait for containers to start
sleep 15

# Check status
docker compose ps
```

### Step 9: Run Database Migrations
```bash
# Run migrations on external database
docker compose exec backend1 python manage.py migrate

# Verify database connection
docker compose exec backend1 python manage.py check --database default
```

### Step 10: Verify Everything Works
```bash
# Check all containers are running
docker compose ps

# Check logs for errors
docker compose logs --tail=50 backend1

# Test database connection from backend
docker compose exec backend1 python manage.py dbshell -c "SELECT 1;"

# Test API endpoint
curl http://localhost:8080/api/health
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] PostgreSQL service running: `systemctl status postgresql`
- [ ] All Docker containers running: `docker compose ps`
- [ ] No postgres container: `docker ps | grep postgres` (should be empty)
- [ ] Backend can connect to DB: `docker compose logs backend1 | grep -i database`
- [ ] Frontend accessible: `curl http://localhost:3000`
- [ ] Backend API accessible: `curl http://localhost:8080`
- [ ] pgAdmin accessible: Open http://46.62.216.158:5050 in browser

---

## 🔍 Troubleshooting

### Problem: Can't connect to external PostgreSQL

```bash
# Check PostgreSQL is running
systemctl status postgresql

# Check it's listening on all interfaces
sudo cat /etc/postgresql/*/main/postgresql.conf | grep listen_addresses
# Should show: listen_addresses = '*'

# Check firewall
ufw status | grep 5432
# Should allow port 5432

# Check pg_hba.conf allows connections
sudo cat /etc/postgresql/*/main/pg_hba.conf | grep "0.0.0.0/0"
# Should have: host all all 0.0.0.0/0 md5

# Restart PostgreSQL after any changes
systemctl restart postgresql
```

### Problem: Containers won't start

```bash
# View logs
docker compose logs

# Check specific service
docker compose logs backend1

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Problem: Database migrations fail

```bash
# Check database connection
docker compose exec backend1 python manage.py check --database default

# Try running migrations manually
docker compose exec backend1 python manage.py migrate --verbosity 3

# Check database permissions
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE crypto_tracker_db TO \"Abhishek.vaghasiya2016@gmail.com\";"
```

---

## 🧹 Clean Up Old Resources

After successful deployment, clean up:

```bash
# Remove old Docker images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove old backups (keep recent ones)
ls -lt /root/*.sql
# Delete old ones manually: rm /root/old_backup.sql
```

---

## 📊 Monitor Resources

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check Docker stats
docker stats

# Check PostgreSQL connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='crypto_tracker_db';"
```

---

## 🎯 Summary of What Gets Removed

### From Docker:
- ❌ `postgres` container
- ❌ `pgbouncer` container  
- ❌ `postgres_data` volume
- ❌ All PostgreSQL-related dependencies

### What Stays:
- ✅ Redis container (needed for caching)
- ✅ Backend containers (Django app)
- ✅ Celery workers
- ✅ Frontend container
- ✅ Nginx container

### External Services:
- ✅ PostgreSQL on server (native installation)
- ✅ pgAdmin container (separate, not part of docker-compose)

---

## 📝 Important Notes

1. **Backup First**: Always backup before major changes
2. **Test Connection**: Verify external PostgreSQL works before removing Docker version
3. **Keep Credentials Safe**: Never commit .env to git
4. **Monitor Logs**: Watch logs for first few minutes after deployment
5. **Check Performance**: External PostgreSQL should be faster than Docker version

---

**Need Help?**
- Check logs: `docker compose logs -f`
- View all documentation: `ls -la *.md`
- Test database: `./test_postgres_connection.sh`

---

**Last Updated**: November 7, 2025
