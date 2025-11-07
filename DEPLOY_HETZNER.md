# 🚀 Hetzner Server Deployment Guide

Complete guide to deploy the Crypto Tracker application on a Hetzner Ubuntu server.

---

## 📋 Prerequisites

- Hetzner server with Ubuntu 22.04 or 24.04
- Root SSH access
- Server with minimum 2GB RAM, 2 vCPU
- Domain name (optional, for SSL/HTTPS)

---

## 🎯 Quick Deploy (5 Minutes)

### Step 1: Connect to Your Server

```bash
ssh root@YOUR_SERVER_IP
```

**Your credentials:**
- User: `root`
- Password: `L77tRWhUUVwT`
- ⚠️ **IMPORTANT:** Change the root password immediately after first login!

```bash
passwd root
```

### Step 2: Download and Run Deployment Script

```bash
# Download the deployment script
curl -fsSL https://raw.githubusercontent.com/virajsavaliya/crypto-tracker/main/deploy/hetzner_deploy.sh -o deploy.sh

# Make it executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

The script will:
1. ✅ Update system packages
2. ✅ Install Docker and Docker Compose
3. ✅ Create a deploy user
4. ✅ Configure firewall (ports 22, 80, 443)
5. ✅ Clone the repository
6. ✅ Create environment files
7. ✅ Build Docker images (~10-15 minutes)
8. ✅ Start all services
9. ✅ Run database migrations
10. ✅ Create Django superuser (interactive)

### Step 3: Configure Environment Variables

After deployment, **you must update the environment file with your actual credentials:**

```bash
nano /home/deploy/crypto-tracker/backend/.env.production
```

**Required changes:**

1. **Django Secret Key:**
   ```bash
   # Generate a secure secret key
   python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
   
   # Copy output and paste in .env.production
   SECRET_KEY=your_generated_secret_key_here
   ```

2. **Domain/Allowed Hosts:**
   ```env
   ALLOWED_HOSTS=your-domain.com,www.your-domain.com,YOUR_SERVER_IP
   ```

3. **Database Password:**
   ```env
   DB_PASSWORD=change_to_secure_password_123
   ```

4. **API Keys:**
   - Binance API credentials
   - Stripe API keys (for payments)
   - Telegram bot token
   - Email credentials

5. **CORS Origins:**
   ```env
   CORS_ALLOWED_ORIGINS=https://your-domain.com,http://YOUR_SERVER_IP:3000
   ```

### Step 4: Restart Services

After updating environment variables:

```bash
cd /home/deploy/crypto-tracker
docker compose restart
```

### Step 5: Access Your Application

- **Frontend:** `http://YOUR_SERVER_IP:3000`
- **Backend API:** `http://YOUR_SERVER_IP:8080`
- **Django Admin:** `http://YOUR_SERVER_IP:8080/admin`

---

## 🔧 Manual Deployment (Step-by-Step)

If you prefer manual setup or need to customize:

### 1. Update System

```bash
apt-get update && apt-get upgrade -y
```

### 2. Install Docker

```bash
# Install prerequisites
apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
systemctl start docker
systemctl enable docker
```

### 3. Create Deploy User

```bash
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
su - deploy
```

### 4. Clone Repository

```bash
git clone https://github.com/virajsavaliya/crypto-tracker.git
cd crypto-tracker
```

### 5. Create Environment Files

Copy `.env.example` and configure:

```bash
cp backend/.env.example backend/.env.production
cp frontend/.env.example frontend/.env.production

# Edit with your credentials
nano backend/.env.production
nano frontend/.env.production
```

### 6. Build and Start

```bash
# Build images
docker compose build

# Start services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### 7. Run Migrations

```bash
docker compose exec backend1 python manage.py migrate
docker compose exec backend1 python manage.py createsuperuser
docker compose exec backend1 python manage.py collectstatic --noinput
```

---

## 🔒 Security Setup

### 1. Configure Firewall

```bash
# UFW (already configured by script)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 2. Install Fail2Ban (Brute Force Protection)

```bash
apt-get install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### 3. Set Up SSL with Let's Encrypt

```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Update nginx configuration to use SSL
# (You'll need to modify nginx/local_nginx.conf)
```

### 4. Create Non-Root SSH User

```bash
# Create SSH key on your local machine
ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy public key to server
ssh-copy-id deploy@YOUR_SERVER_IP

# Disable root SSH login
nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
systemctl restart sshd
```

---

## 📊 Monitoring & Maintenance

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend1
docker compose logs -f frontend
docker compose logs -f celery-worker
```

### Check Service Status

```bash
docker compose ps
```

### Restart Services

```bash
# All services
docker compose restart

# Specific service
docker compose restart backend1
```

### Update Application

```bash
cd /home/deploy/crypto-tracker
git pull origin main
docker compose build
docker compose up -d
docker compose exec backend1 python manage.py migrate
docker compose exec backend1 python manage.py collectstatic --noinput
```

### Database Backup

```bash
# Backup database
docker compose exec postgres pg_dump -U crypto_user crypto_tracker_db > backup_$(date +%Y%m%d).sql

# Restore database
docker compose exec -T postgres psql -U crypto_user crypto_tracker_db < backup_20241107.sql
```

---

## 🛠️ Troubleshooting

### Services Won't Start

```bash
# Check Docker status
systemctl status docker

# Check logs for errors
docker compose logs

# Rebuild images
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Restart database
docker compose restart postgres
```

### Port Already in Use

```bash
# Check what's using port 8080
sudo lsof -i :8080

# Kill process if needed
sudo kill -9 <PID>
```

### Out of Memory

```bash
# Check memory usage
free -h

# Check Docker memory
docker stats

# Clean up unused Docker resources
docker system prune -a
```

---

## 🔄 Production Checklist

Before going live:

- [ ] Change all default passwords in `.env.production`
- [ ] Generate and set a strong `SECRET_KEY`
- [ ] Set `DEBUG=False`
- [ ] Configure proper `ALLOWED_HOSTS`
- [ ] Configure proper `CORS_ALLOWED_ORIGINS`
- [ ] Set up domain with DNS A records
- [ ] Install SSL certificate (Let's Encrypt)
- [ ] Set up automated database backups
- [ ] Configure email settings (SMTP)
- [ ] Test payment integration (Stripe)
- [ ] Set up monitoring (optional: Sentry, New Relic)
- [ ] Change root password
- [ ] Disable root SSH login
- [ ] Enable fail2ban
- [ ] Test all functionality
- [ ] Set up log rotation

---

## 📞 Support

If you encounter issues:

1. Check logs: `docker compose logs -f`
2. Verify environment variables are set correctly
3. Ensure all ports are accessible through firewall
4. Check GitHub Issues: https://github.com/virajsavaliya/crypto-tracker/issues

---

## 📝 Notes

- Default ports:
  - Frontend: 3000
  - Backend: 8080
  - Nginx: 80, 443
  - PostgreSQL: 5432 (internal only)
  - Redis: 6379 (internal only)

- All data is stored in Docker volumes (persistent)
- Services auto-restart on server reboot
- Log files are managed by Docker
