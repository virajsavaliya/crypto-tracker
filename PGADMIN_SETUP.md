# 🗄️ pgAdmin Installation Guide for Hetzner

Complete guide to install and configure pgAdmin 4 on your Hetzner server for PostgreSQL database management.

---

## 🎯 Quick Install (1 Minute)

### Option 1: Automated Script (Recommended)

SSH into your Hetzner server and run:

```bash
# Download and run the installation script
curl -fsSL https://raw.githubusercontent.com/virajsavaliya/crypto-tracker/main/deploy/install_pgadmin.sh | bash
```

That's it! pgAdmin will be installed and accessible at `http://YOUR_SERVER_IP:5050`

### Option 2: Custom Configuration

```bash
# Download the script
wget https://raw.githubusercontent.com/virajsavaliya/crypto-tracker/main/deploy/install_pgadmin.sh

# Set custom configuration (optional)
export PGADMIN_EMAIL="your-email@example.com"
export PGADMIN_PASSWORD="your-secure-password"
export PGADMIN_PORT="5050"

# Make executable and run
chmod +x install_pgadmin.sh
./install_pgadmin.sh
```

---

## 🔑 Default Credentials

- **URL:** `http://YOUR_SERVER_IP:5050`
- **Email:** `admin@example.com`
- **Password:** `admin`

⚠️ **IMPORTANT:** Change the password after first login!

---

## 🔌 Connect to Your Database

After logging into pgAdmin:

### Step 1: Add New Server

1. Right-click **Servers** → **Register** → **Server**

### Step 2: General Tab

- **Name:** `Crypto Tracker`

### Step 3: Connection Tab

Fill in these details:

| Field | Value |
|-------|-------|
| **Host name/address** | `postgres` or `172.17.0.1` |
| **Port** | `5432` |
| **Maintenance database** | `crypto_tracker_db` |
| **Username** | `crypto_user` |
| **Password** | (from your `.env.production`) |
| **Save password** | ✅ Check this |

### Step 4: Click Save

You should now see your database in the left sidebar!

---

## 🔍 Finding Your Database Password

If you don't know your database password:

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# View the password
cat /home/deploy/crypto-tracker/backend/.env.production | grep DB_PASSWORD
```

---

## 🛠️ Manual Installation (Docker Method)

If you prefer manual setup:

```bash
# 1. Create directory for pgAdmin data
sudo mkdir -p /opt/pgadmin/data
sudo chmod -R 777 /opt/pgadmin/data

# 2. Run pgAdmin container
docker run -d \
  --name pgadmin4 \
  --restart always \
  -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL="admin@example.com" \
  -e PGADMIN_DEFAULT_PASSWORD="admin" \
  -v /opt/pgadmin/data:/var/lib/pgadmin \
  dpage/pgadmin4:latest

# 3. Allow port through firewall
sudo ufw allow 5050/tcp

# 4. Check if running
docker ps | grep pgadmin4
```

---

## 🔒 Security Best Practices

### 1. Change Default Password

After first login:
1. Click **File** → **Preferences**
2. Go to **Security** → **Change Password**
3. Set a strong password

### 2. Use SSH Tunnel (Recommended for Production)

Instead of exposing port 5050, use SSH tunneling:

```bash
# On your local machine
ssh -L 5050:localhost:5050 root@YOUR_SERVER_IP

# Then access pgAdmin at:
http://localhost:5050
```

This way, pgAdmin is not exposed to the internet.

### 3. Restrict Firewall Access

Limit access to specific IPs:

```bash
# Remove public access
sudo ufw delete allow 5050/tcp

# Allow only from your IP
sudo ufw allow from YOUR_IP_ADDRESS to any port 5050
```

### 4. Update pgAdmin Regularly

```bash
# Pull latest image
docker pull dpage/pgadmin4:latest

# Restart container
docker stop pgadmin4
docker rm pgadmin4

# Run with new image (use the command from manual installation)
```

---

## 🛠️ Common Tasks

### View Logs

```bash
docker logs -f pgadmin4
```

### Restart pgAdmin

```bash
docker restart pgadmin4
```

### Stop pgAdmin

```bash
docker stop pgadmin4
```

### Remove pgAdmin

```bash
docker stop pgadmin4
docker rm pgadmin4
sudo rm -rf /opt/pgadmin
```

### Change Port

```bash
# Stop current container
docker stop pgadmin4 && docker rm pgadmin4

# Run with new port (e.g., 8888)
docker run -d \
  --name pgadmin4 \
  --restart always \
  -p 8888:80 \
  -e PGADMIN_DEFAULT_EMAIL="admin@example.com" \
  -e PGADMIN_DEFAULT_PASSWORD="admin" \
  -v /opt/pgadmin/data:/var/lib/pgadmin \
  dpage/pgadmin4:latest

# Update firewall
sudo ufw allow 8888/tcp
```

---

## 🔧 Troubleshooting

### Can't Connect to Database

**Problem:** "Could not connect to server" error

**Solutions:**

1. **Check if crypto-tracker containers are running:**
   ```bash
   cd /home/deploy/crypto-tracker
   docker compose ps
   ```

2. **Try alternative host addresses:**
   - `postgres` (Docker network name)
   - `172.17.0.1` (Docker host IP)
   - `localhost` (if on same network)

3. **Verify database credentials:**
   ```bash
   cat /home/deploy/crypto-tracker/backend/.env.production | grep DB_
   ```

4. **Check PostgreSQL is accepting connections:**
   ```bash
   docker compose logs postgres
   ```

### Can't Access pgAdmin Web Interface

**Problem:** Page doesn't load at `http://YOUR_SERVER_IP:5050`

**Solutions:**

1. **Check if container is running:**
   ```bash
   docker ps | grep pgadmin4
   ```

2. **Check firewall:**
   ```bash
   sudo ufw status | grep 5050
   ```

3. **Check logs:**
   ```bash
   docker logs pgadmin4
   ```

4. **Verify port is listening:**
   ```bash
   sudo netstat -tulpn | grep 5050
   ```

### Permission Denied Error

**Problem:** pgAdmin shows permission errors

**Solution:**

```bash
sudo chmod -R 777 /opt/pgadmin/data
docker restart pgadmin4
```

### Forgot pgAdmin Password

**Solution:** Remove and reinstall:

```bash
docker stop pgadmin4
docker rm pgadmin4
sudo rm -rf /opt/pgadmin/data

# Run install script again
curl -fsSL https://raw.githubusercontent.com/virajsavaliya/crypto-tracker/main/deploy/install_pgadmin.sh | bash
```

---

## 📊 Using pgAdmin

### Common Tasks:

1. **View Tables:**
   - Expand: Servers → Crypto Tracker → Databases → crypto_tracker_db → Schemas → public → Tables

2. **Run SQL Queries:**
   - Right-click database → **Query Tool**
   - Example: `SELECT * FROM core_cryptodata LIMIT 100;`

3. **View Data:**
   - Right-click table → **View/Edit Data** → **All Rows**

4. **Export Data:**
   - Right-click table → **Export**
   - Choose format (CSV, SQL, etc.)

5. **Backup Database:**
   - Right-click database → **Backup**
   - Choose location and format

6. **Restore Database:**
   - Right-click database → **Restore**
   - Select backup file

---

## 🔗 Integration with Docker Compose (Optional)

To include pgAdmin in your main docker-compose setup:

Add to `docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin4
    restart: always
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_CONFIG_ENHANCED_COOKIE_PROTECTION: 'True'
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    depends_on:
      - postgres

volumes:
  # ... existing volumes ...
  pgadmin_data:
```

Then restart:

```bash
cd /home/deploy/crypto-tracker
docker compose up -d
```

---

## 📞 Support

If you encounter issues:

1. Check logs: `docker logs -f pgadmin4`
2. Verify database is running: `docker compose ps postgres`
3. Check network connectivity: `docker network inspect crypto-tracker_default`
4. GitHub Issues: https://github.com/virajsavaliya/crypto-tracker/issues

---

## 📝 Quick Reference

| Task | Command |
|------|---------|
| Install pgAdmin | `curl -fsSL https://raw.githubusercontent.com/virajsavaliya/crypto-tracker/main/deploy/install_pgadmin.sh \| bash` |
| Access URL | `http://YOUR_SERVER_IP:5050` |
| View logs | `docker logs -f pgadmin4` |
| Restart | `docker restart pgadmin4` |
| Stop | `docker stop pgadmin4` |
| Remove | `docker stop pgadmin4 && docker rm pgadmin4` |
| SSH Tunnel | `ssh -L 5050:localhost:5050 root@YOUR_SERVER_IP` |
| Check DB password | `cat /home/deploy/crypto-tracker/backend/.env.production \| grep DB_PASSWORD` |

---

**Note:** pgAdmin is a powerful tool. Always ensure you have backups before performing any destructive operations on your production database!
