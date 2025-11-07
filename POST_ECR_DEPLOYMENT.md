# 🎉 Post-ECR Deployment Guide

## ✅ Current Status

Your Docker images are successfully deployed to AWS ECR!

- ✅ Backend: `196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/backend:latest`
- ✅ Frontend: `196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/frontend:latest`

---

## 🚀 Next Steps - Deploy to AWS EC2

You have **3 options** to run your application:

---

## **Option 1: Quick Deploy (Recommended) 🌟**

This creates everything automatically:

```bash
cd /Users/virajsavaliya/Desktop/project/Archive\ 2

# Make sure you have updated your production environment file
nano backend/.env.production

# Run the complete deployment
./scripts/quick_deploy.sh
```

**What this does:**
- ✅ Creates EC2 instance (t3.medium, 2 CPU, 4GB RAM)
- ✅ Creates security groups (opens ports 22, 80, 443, 3000, 8080)
- ✅ Installs Docker automatically
- ✅ Pulls your images from ECR
- ✅ Starts all containers
- ✅ Gives you the URLs to access your app

**Time:** ~10 minutes

---

## **Option 2: Manual EC2 Setup (Step by Step)**

### Step 2.1: Create EC2 Instance

```bash
# Create AWS infrastructure (security groups, instance, etc.)
./scripts/aws_setup.sh
```

This will:
- Create security group with correct ports
- Generate SSH key pair
- Launch Ubuntu EC2 instance
- Install Docker

**Wait 2-3 minutes for Docker to install on the instance**

### Step 2.2: Deploy Application

```bash
# Deploy your application to the EC2 instance
./scripts/deploy_to_ec2.sh
```

This will:
- Copy your code to EC2
- Login to ECR on the instance
- Pull images from ECR
- Start all containers using docker-compose

---

## **Option 3: Use Existing EC2 Instance**

If you already have an EC2 instance:

```bash
# Replace INSTANCE_ID with your instance ID
./scripts/deploy_to_existing_instance.sh i-1234567890abcdef0
```

Or manually:

### Step 3.1: SSH to Your Instance

```bash
# Get your instance IP
INSTANCE_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=crypto-tracker" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

# Notice: AWS-specific post-deployment instructions removed

This document previously contained detailed post-deployment steps tailored to
an AWS/ECR-based deployment (EC2 provisioning, ECR login, example account IDs).
To keep the repository provider-agnostic and avoid including provider-specific
commands or account identifiers, that content has been removed.

If you need post-deployment instructions for Hetzner (or another provider),
tell me which provider you prefer and I will add a clean, tested guide for it.
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull

# Start all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 🔍 Verify Deployment

### Check Container Status

```bash
# SSH to your instance
ssh -i ~/.ssh/crypto-tracker-key.pem ubuntu@$INSTANCE_IP

# Check containers
docker ps

# Check logs
docker-compose logs -f backend1
```

### Access Your Application

Get your instance IP:

```bash
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=crypto-tracker" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

Then access:
- **Frontend**: http://YOUR_IP:3000
- **Backend API**: http://YOUR_IP:8080/api/
- **Admin Panel**: http://YOUR_IP:8080/admin/

---

## ⚙️ Post-Deployment Configuration

### 1. Create Django Superuser

```bash
# SSH to instance
ssh -i ~/.ssh/crypto-tracker-key.pem ubuntu@$INSTANCE_IP

# Create superuser
cd ~/crypto-tracker
docker-compose exec backend1 python manage.py createsuperuser
```

### 2. Update Production Environment

```bash
# Edit production settings on the instance
nano ~/crypto-tracker/backend/.env.production

# Update these critical values:
# - SECRET_KEY (generate a new secure key)
# - STRIPE_SECRET_KEY (your production key)
# - ALLOWED_HOSTS (add your domain or IP)
# - EMAIL credentials
# - TELEGRAM_BOT_TOKEN

# Restart backend to apply changes
docker-compose restart backend1
```

### 3. Configure Stripe Webhooks

1. Go to: https://dashboard.stripe.com/webhooks
2. Create endpoint: `http://YOUR_IP:8080/api/webhook/stripe/`
3. Select events: `checkout.session.completed`
4. Copy webhook secret to `.env.production`

### 4. Configure Telegram Bot Webhook

```bash
# SSH to instance
ssh -i ~/.ssh/crypto-tracker-key.pem ubuntu@$INSTANCE_IP

cd ~/crypto-tracker
docker-compose exec backend1 python manage.py set_telegram_webhook \
  http://YOUR_IP:8080/api/telegram/webhook/
```

---

## 🔒 Security Best Practices

### 1. Update Security Group (Optional - Add Domain)

```bash
# Allow HTTPS
aws ec2 authorize-security-group-ingress \
  --group-name crypto-tracker-sg \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

### 2. Set Up SSL/TLS (Recommended for Production)

Use Let's Encrypt with Nginx:

```bash
# SSH to instance
ssh -i ~/.ssh/crypto-tracker-key.pem ubuntu@$INSTANCE_IP

# Install certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 3. Enable Firewall

```bash
# On the EC2 instance
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 8080/tcp
sudo ufw enable
```

---

## 📊 Monitoring & Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend1
docker-compose logs -f frontend
docker-compose logs -f data-worker

# Last 100 lines
docker-compose logs --tail=100 backend1
```

### Check Container Health

```bash
docker ps
docker stats
```

### Restart Services

```bash
# Restart specific service
docker-compose restart backend1

# Restart all services
docker-compose restart

# Stop all services
docker-compose down

# Start all services
docker-compose up -d
```

### Update Application

When you make changes:

```bash
# 1. Build and push new images locally
cd /Users/virajsavaliya/Desktop/project/Archive\ 2
TAG=v1.0.1 ./scripts/ecr_deploy.sh

# 2. Update on EC2
ssh -i ~/.ssh/crypto-tracker-key.pem ubuntu@$INSTANCE_IP
cd ~/crypto-tracker
export TAG=v1.0.1
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 🌐 Set Up Custom Domain (Optional)

### 1. Point Domain to EC2

1. Get your EC2 Elastic IP:
   ```bash
   aws ec2 allocate-address --domain vpc
   aws ec2 associate-address --instance-id YOUR_INSTANCE_ID --allocation-id YOUR_ALLOCATION_ID
   ```

2. Add DNS records:
   - A record: `@` → Your Elastic IP
   - A record: `www` → Your Elastic IP

### 2. Update Environment Variables

```bash
# Update backend/.env.production
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,localhost
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com
```

### 3. Configure Nginx

Update nginx configuration to use your domain.

---

## 💰 Cost Estimation

### Monthly Costs:
- **EC2 t3.medium**: ~$30-40/month
- **ECR Storage**: ~$0.10/month (2 images)
- **Data Transfer**: ~$1-5/month
- **Elastic IP**: Free (while attached)

**Total**: ~$31-45/month

### Cost Optimization:
- Use **t3.small** instead: ~$15/month (but slower)
- Use **Spot Instances**: Save 70%
- Use **Reserved Instances**: Save 30-40% (1-year commitment)

---

## 🆘 Troubleshooting

### Containers Won't Start

```bash
# Check logs
docker-compose logs

# Check if ports are available
sudo netstat -tulpn | grep LISTEN

# Restart services
docker-compose down
docker-compose up -d
```

### Can't Access Application

```bash
# Check security group
aws ec2 describe-security-groups --group-names crypto-tracker-sg

# Check if services are running
docker ps

# Check nginx
docker-compose logs nginx
```

### Database Connection Issues

```bash
# Check PostgreSQL
docker-compose logs postgres

# Check PgBouncer
docker-compose logs pgbouncer

# Restart database services
docker-compose restart postgres pgbouncer
```

---

## 🗑️ Cleanup (Stop Charges)

### Stop Application (Keep Instance)

```bash
ssh -i ~/.ssh/crypto-tracker-key.pem ubuntu@$INSTANCE_IP
cd ~/crypto-tracker
docker-compose down
```

### Delete Everything

```bash
# Get instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=crypto-tracker" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

# Terminate instance
aws ec2 terminate-instances --instance-ids $INSTANCE_ID

# Wait for termination (check with: aws ec2 describe-instances)
# Then delete security group
aws ec2 delete-security-group --group-name crypto-tracker-sg

# Delete ECR repositories (optional)
aws ecr delete-repository --repository-name crypto-tracker/backend --force
aws ecr delete-repository --repository-name crypto-tracker/frontend --force

# Delete SSH key
rm ~/.ssh/crypto-tracker-key.pem
aws ec2 delete-key-pair --key-name crypto-tracker-key
```

---

## 📞 Quick Commands Reference

```bash
# Deploy to new EC2
./scripts/quick_deploy.sh

# Update application
TAG=v1.0.1 ./scripts/ecr_deploy.sh
./scripts/deploy_to_ec2.sh

# SSH to instance
ssh -i ~/.ssh/crypto-tracker-key.pem ubuntu@$(aws ec2 describe-instances --filters "Name=tag:Name,Values=crypto-tracker" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

# View logs
docker-compose logs -f backend1

# Restart services
docker-compose restart

# Check status
docker ps
docker-compose ps
```

---

## ✅ Deployment Checklist

After deployment, verify:

- [ ] All containers are running (`docker ps`)
- [ ] Frontend accessible at http://YOUR_IP:3000
- [ ] Backend API accessible at http://YOUR_IP:8080/api/
- [ ] Admin panel accessible at http://YOUR_IP:8080/admin/
- [ ] Database connected (check backend logs)
- [ ] Redis connected (check backend logs)
- [ ] WebSocket data streaming (check data-worker logs)
- [ ] Created Django superuser
- [ ] Updated production environment variables
- [ ] Configured Stripe webhooks
- [ ] Configured Telegram bot webhook
- [ ] Set up monitoring/logging
- [ ] (Optional) Configured custom domain
- [ ] (Optional) Enabled SSL/TLS

---

## 🎯 Ready to Deploy?

**Recommended next step:**

```bash
cd /Users/virajsavaliya/Desktop/project/Archive\ 2

# Option 1: Quick deploy (easiest)
./scripts/quick_deploy.sh

# Option 2: Manual step by step
./scripts/aws_setup.sh      # Wait 2-3 minutes after this
./scripts/deploy_to_ec2.sh
```

---

**Need help?** Check the detailed guides:
- `START_HERE_DEPLOY.md`
- `ECR_SETUP_GUIDE.md`
- `AWS_DEPLOYMENT_GUIDE.md` (if it exists)

🚀 **Your application is ready to go live!**
