# 🐧 Linux Server Commands Reference Guide

Complete command reference for managing your Hetzner server, PostgreSQL, pgAdmin, and Docker.

---

## 📡 SSH Connection

### Connect to Server
```bash
# Connect as root
ssh root@46.62.216.158

# Connect with SSH key
ssh -i ~/.ssh/id_ed25519 root@46.62.216.158

# Your SSH key location: /Users/virajsavaliya/.ssh/id_ed25519.pub

### Change Password
```bash
# Change root password
passwd root

# Change user password
passwd username
```

### Disconnect from Server
```bash
# Exit SSH session
exit

# Or use keyboard shortcut
Ctrl + D
```

---

## 🗄️ PostgreSQL Commands

### Service Management
```bash
# Start PostgreSQL
systemctl start postgresql

# Stop PostgreSQL
systemctl stop postgresql

# Restart PostgreSQL
systemctl restart postgresql

# Check status
systemctl status postgresql

# Enable auto-start on boot
systemctl enable postgresql

# Disable auto-start
systemctl disable postgresql
```

### Database Operations
```bash
# Access PostgreSQL as postgres user
sudo -u postgres psql

# Access specific database
sudo -u postgres psql -d crypto_tracker_db

# List all databases
sudo -u postgres psql -c "\l"

# List all users
sudo -u postgres psql -c "\du"
```

### Create Database & User
```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE crypto_tracker_db;"

# Create user with password
sudo -u postgres psql -c "CREATE USER \"abhishek.vaghasiya2016@gmail.com\" WITH PASSWORD 'Abhishek.vaghasiya2016';"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE crypto_tracker_db TO \"abhishek.vaghasiya2016@gmail.com\";"

# Make user owner
sudo -u postgres psql -c "ALTER DATABASE crypto_tracker_db OWNER TO \"abhishek.vaghasiya2016@gmail.com\";"
```

### Delete Database & User
```bash
# Drop database
sudo -u postgres psql -c "DROP DATABASE crypto_tracker_db;"

# Drop user
sudo -u postgres psql -c "DROP USER \"abhishek.vaghasiya2016@gmail.com\";"

# Force drop database (disconnect all users first)
sudo -u postgres psql << 'EOF'
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'crypto_tracker_db'
  AND pid <> pg_backend_pid();
DROP DATABASE crypto_tracker_db;
EOF
```

### Backup & Restore
```bash
# Backup database
sudo -u postgres pg_dump crypto_tracker_db > backup_$(date +%Y%m%d).sql

# Restore database
sudo -u postgres psql crypto_tracker_db < backup_20241107.sql

# Backup all databases
sudo -u postgres pg_dumpall > all_databases_backup.sql
```

### PostgreSQL Configuration
```bash
# Edit main configuration
nano /etc/postgresql/*/main/postgresql.conf

# Edit access configuration
nano /etc/postgresql/*/main/pg_hba.conf

# Allow remote connections
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" /etc/postgresql/*/main/postgresql.conf
echo "host    all             all             0.0.0.0/0               md5" >> /etc/postgresql/*/main/pg_hba.conf
```

### Complete PostgreSQL Removal
```bash
# Stop service
systemctl stop postgresql

# Remove packages
apt-get remove --purge -y postgresql*

# Remove data directories
rm -rf /var/lib/postgresql
rm -rf /etc/postgresql

# Remove configuration
rm -rf /etc/postgresql-common
```

---

## 🐳 Docker Commands

### Docker Service Management
```bash
# Start Docker
systemctl start docker

# Stop Docker
systemctl stop docker

# Restart Docker
systemctl restart docker

# Check status
systemctl status docker

# Enable auto-start
systemctl enable docker
```

### Container Management
```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Start a container
docker start container_name

# Stop a container
docker stop container_name

# Restart a container
docker restart container_name

# Remove a container
docker rm container_name

# Stop and remove a container
docker stop container_name && docker rm container_name

# Stop ALL containers
docker stop $(docker ps -aq)

# Remove ALL containers
docker rm $(docker ps -aq)

# Force remove a container
docker rm -f container_name
```

### Container Logs & Info
```bash
# View logs
docker logs container_name

# Follow logs (live)
docker logs -f container_name

# View last 100 lines
docker logs --tail 100 container_name

# Get container info
docker inspect container_name

# View container stats (CPU, memory)
docker stats

# Execute command in running container
docker exec -it container_name bash
```

### Image Management
```bash
# List images
docker images

# Pull an image
docker pull dpage/pgadmin4:latest

# Remove an image
docker rmi image_name

# Remove all unused images
docker image prune -a

# Build image from Dockerfile
docker build -t my-app .
```

### Docker Cleanup
```bash
# Remove unused containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a

# Remove everything (DANGEROUS - removes all!)
docker system prune -a --volumes
```

### Docker Compose Commands
```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# View logs
docker compose logs -f

# Rebuild images
docker compose build

# Rebuild and start
docker compose up -d --build

# Stop specific service
docker compose stop backend1

# Scale service
docker compose up -d --scale backend=3
```

---

## 📦 pgAdmin Docker Commands

### Install pgAdmin
```bash
# Create directory
mkdir -p /opt/pgadmin/data
chmod -R 777 /opt/pgadmin/data

# Run pgAdmin
docker run -d \
  --name pgadmin4 \
  --restart always \
  -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL="abhishek.vaghasiya2016@gmail.com" \
  -e PGADMIN_DEFAULT_PASSWORD="Abhishek.vaghasiya2016" \
  -v /opt/pgadmin/data:/var/lib/pgadmin \
  dpage/pgadmin4:latest
```

### Manage pgAdmin
```bash
# Check if running
docker ps | grep pgadmin4

# View logs
docker logs -f pgadmin4

# Restart pgAdmin
docker restart pgadmin4

# Stop pgAdmin
docker stop pgadmin4

# Remove pgAdmin
docker stop pgadmin4 && docker rm pgadmin4

# Remove data (complete wipe)
docker stop pgadmin4 && docker rm pgadmin4
rm -rf /opt/pgadmin
```

### Reinstall pgAdmin
```bash
# Complete removal and fresh install
docker stop pgadmin4 2>/dev/null
docker rm pgadmin4 2>/dev/null
rm -rf /opt/pgadmin

mkdir -p /opt/pgadmin/data
chmod -R 777 /opt/pgadmin/data

docker run -d \
  --name pgadmin4 \
  --restart always \
  -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL="abhishek.vaghasiya2016@gmail.com" \
  -e PGADMIN_DEFAULT_PASSWORD="Abhishek.vaghasiya2016" \
  -v /opt/pgadmin/data:/var/lib/pgadmin \
  dpage/pgadmin4:latest
```

---

## 🔥 Firewall (UFW) Commands

### Basic UFW Commands
```bash
# Check firewall status
ufw status

# Enable firewall
ufw enable

# Disable firewall
ufw disable

# Reset firewall (remove all rules)
ufw --force reset
```

### Allow/Deny Ports
```bash
# Allow SSH (important!)
ufw allow 22/tcp

# Allow HTTP
ufw allow 80/tcp

# Allow HTTPS
ufw allow 443/tcp

# Allow PostgreSQL
ufw allow 5432/tcp

# Allow pgAdmin
ufw allow 5050/tcp

# Allow custom port
ufw allow 8080/tcp

# Deny a port
ufw deny 3306/tcp

# Delete a rule
ufw delete allow 8080/tcp
```

### Allow from Specific IP
```bash
# Allow from specific IP
ufw allow from 192.168.1.100

# Allow specific IP to specific port
ufw allow from 192.168.1.100 to any port 5432
```

### Default Policies
```bash
# Set defaults
ufw default deny incoming
ufw default allow outgoing
```

### View Rules
```bash
# Show all rules
ufw status verbose

# Show numbered rules (for deletion)
ufw status numbered

# Delete rule by number
ufw delete 3
```

---

## 📁 File & Directory Commands

### Navigation
```bash
# Show current directory
pwd

# List files
ls

# List with details
ls -la

# Change directory
cd /path/to/directory

# Go to home directory
cd ~

# Go back one directory
cd ..

# Go to root
cd /
```

### Create & Delete
```bash
# Create directory
mkdir my_folder

# Create nested directories
mkdir -p /path/to/nested/folder

# Create file
touch myfile.txt

# Remove file
rm myfile.txt

# Remove directory
rm -r my_folder

# Force remove (no confirmation)
rm -rf my_folder

# Remove everything in directory
rm -rf /path/to/directory/*
```

### Copy & Move
```bash
# Copy file
cp source.txt destination.txt

# Copy directory
cp -r source_folder destination_folder

# Move/Rename file
mv oldname.txt newname.txt

# Move to different location
mv file.txt /path/to/destination/
```

### View Files
```bash
# View file content
cat filename.txt

# View with pagination
less filename.txt

# View first 10 lines
head filename.txt

# View last 10 lines
tail filename.txt

# Follow file (live updates)
tail -f logfile.log
```

### Edit Files
```bash
# Edit with nano (beginner-friendly)
nano filename.txt

# Save in nano: Ctrl + O, then Enter
# Exit nano: Ctrl + X

# Edit with vim
vim filename.txt

# Exit vim without saving: :q!
# Save and exit vim: :wq
```

### Search Files
```bash
# Find files by name
find /path -name "*.txt"

# Search inside files
grep "search_term" filename.txt

# Search recursively
grep -r "search_term" /path/to/directory

# Search with line numbers
grep -n "search_term" filename.txt
```

### Permissions
```bash
# Change permissions (read/write/execute)
chmod 755 script.sh

# Make file executable
chmod +x script.sh

# Change owner
chown user:group filename.txt

# Change owner recursively
chown -R user:group /path/to/directory

# Full permissions (DANGEROUS - use carefully)
chmod 777 filename.txt
```

---

## 💻 System Commands

### System Information
```bash
# System info
uname -a

# OS version
cat /etc/os-release

# Disk usage
df -h

# Disk usage of directory
du -sh /path/to/directory

# Memory usage
free -h

# CPU info
lscpu

# Running processes
top

# Or use htop (better)
htop
```

### Package Management (Ubuntu/Debian)
```bash
# Update package list
apt-get update

# Upgrade packages
apt-get upgrade

# Install package
apt-get install package_name

# Remove package
apt-get remove package_name

# Complete removal (including config)
apt-get remove --purge package_name

# Clean up
apt-get autoremove
apt-get clean
```

### Service Management
```bash
# Start service
systemctl start service_name

# Stop service
systemctl stop service_name

# Restart service
systemctl restart service_name

# Check status
systemctl status service_name

# Enable auto-start
systemctl enable service_name

# Disable auto-start
systemctl disable service_name

# List all services
systemctl list-units --type=service
```

### Network Commands
```bash
# Show IP address
ip addr show

# Show network interfaces
ifconfig

# Test connection
ping google.com

# Check open ports
netstat -tulpn

# Or use ss
ss -tulpn

# Check if port is listening
lsof -i :5432

# Download file
wget https://example.com/file.zip

# Or use curl
curl -O https://example.com/file.zip
```

### Process Management
```bash
# List processes
ps aux

# Find process by name
ps aux | grep postgres

# Kill process by PID
kill 1234

# Force kill
kill -9 1234

# Kill by name
pkill postgres

# Kill all Docker containers
pkill -f docker
```

---

## 🔄 Git Commands

### Clone Repository
```bash
# Clone public repository
git clone https://github.com/username/repo.git

# Clone to specific directory
git clone https://github.com/username/repo.git /path/to/directory
```

### Pull Updates
```bash
# Pull latest changes
git pull origin main

# Pull specific branch
git pull origin branch_name
```

### Check Status
```bash
# View repository status
git status

# View commit history
git log

# View branches
git branch -a
```

### Remove Repository
```bash
# Delete cloned repository
rm -rf /path/to/repository
```

---

## 🚀 Quick Reference - Common Tasks

### Complete Fresh Install (PostgreSQL + pgAdmin)
```bash
# 1. Cleanup
docker stop $(docker ps -aq) 2>/dev/null
docker rm $(docker ps -aq) 2>/dev/null
rm -rf /opt/pgadmin
systemctl stop postgresql 2>/dev/null
apt-get remove --purge -y postgresql* 2>/dev/null
rm -rf /var/lib/postgresql /etc/postgresql

# 2. Install PostgreSQL
apt-get update && apt-get install -y postgresql postgresql-contrib
systemctl start postgresql && systemctl enable postgresql

# 3. Create database
sudo -u postgres psql << 'EOF'
CREATE DATABASE crypto_tracker_db;
CREATE USER "abhishek.vaghasiya2016@gmail.com" WITH PASSWORD 'Abhishek.vaghasiya2016';
GRANT ALL PRIVILEGES ON DATABASE crypto_tracker_db TO "abhishek.vaghasiya2016@gmail.com";
ALTER DATABASE crypto_tracker_db OWNER TO "abhishek.vaghasiya2016@gmail.com";
\q
EOF

# 4. Configure remote access
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" /etc/postgresql/*/main/postgresql.conf
echo "host    all             all             0.0.0.0/0               md5" >> /etc/postgresql/*/main/pg_hba.conf
systemctl restart postgresql

# 5. Install pgAdmin
mkdir -p /opt/pgadmin/data && chmod -R 777 /opt/pgadmin/data
docker run -d --name pgadmin4 --restart always -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL="abhishek.vaghasiya2016@gmail.com" \
  -e PGADMIN_DEFAULT_PASSWORD="Abhishek.vaghasiya2016" \
  -v /opt/pgadmin/data:/var/lib/pgadmin dpage/pgadmin4:latest

# 6. Configure firewall
ufw allow 22/tcp && ufw allow 5432/tcp && ufw allow 5050/tcp
```

### Check All Services
```bash
# Check PostgreSQL
systemctl status postgresql

# Check Docker
systemctl status docker

# Check pgAdmin
docker ps | grep pgadmin4

# Check open ports
netstat -tulpn | grep -E '5432|5050'
```

### View All Logs
```bash
# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*-main.log

# pgAdmin logs
docker logs -f pgadmin4

# System logs
journalctl -f
```

---

## ⚠️ Emergency Commands

### Kill Everything
```bash
# Stop all Docker containers
docker stop $(docker ps -aq)

# Stop PostgreSQL
systemctl stop postgresql

# Kill all processes using port 5432
fuser -k 5432/tcp

# Kill all processes using port 5050
fuser -k 5050/tcp
```

### System Recovery
```bash
# Reboot server
reboot

# Shutdown server
shutdown now

# Check system logs for errors
journalctl -xe

# Check disk space
df -h
```

---

## 📝 Notes

1. **Always backup before major changes**
2. **Use `sudo` for system commands if not root**
3. **Be careful with `rm -rf` - it permanently deletes**
4. **Keep firewall rules updated**
5. **Change default passwords immediately**
6. **Regular backups of PostgreSQL databases**

---

## 🔗 Connection Information

| Service | URL/Host | Port | Username | Password |
|---------|----------|------|----------|----------|
| **pgAdmin** | http://46.62.216.158:5050 | 5050 | abhishek.vaghasiya2016@gmail.com | Abhishek.vaghasiya2016 |
| **PostgreSQL** | 46.62.216.158 | 5432 | abhishek.vaghasiya2016@gmail.com | Abhishek.vaghasiya2016 |
| **SSH** | 46.62.216.158 | 22 | root | L77tRWhUUVwT |

---

**Last Updated:** November 7, 2025
