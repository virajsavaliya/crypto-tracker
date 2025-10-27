# 🎯 DEPLOY TO AWS - START HERE

## 🚨 IMPORTANT: I Cannot Deploy For You
I (GitHub Copilot) don't have access to your AWS account or the ability to run commands on external servers. However, I've created **automated scripts** that make deployment super easy for you!

## ✅ What I've Created For You

1. **✅ `backend/.env.production`** - Production environment template
2. **✅ `scripts/aws_setup.sh`** - Automated AWS infrastructure setup
3. **✅ `scripts/deploy_to_ec2.sh`** - Automated application deployment
4. **✅ `scripts/quick_deploy.sh`** - One-command complete deployment
5. **✅ `AWS_DEPLOYMENT_GUIDE.md`** - Detailed step-by-step guide

---

## 🚀 Deploy in 3 Steps (5 minutes)

### Step 1: Install & Configure AWS CLI

```bash
# Install AWS CLI
brew install awscli

# Configure with your credentials
aws configure
# Enter your: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)
```

### Step 2: Update Production Settings

```bash
# Edit the production environment file
nano backend/.env.production

# Update these values:
# - SECRET_KEY (generate a secure random key)
# - STRIPE_SECRET_KEY (your production key)
# - EMAIL credentials
# - TELEGRAM_BOT_TOKEN
# Save: Ctrl+O, Enter, Ctrl+X
```

### Step 3: Deploy!

```bash
# Option A: One command complete deployment
./scripts/quick_deploy.sh

# Option B: Step by step
./scripts/aws_setup.sh      # Creates AWS resources (5 min)
# Wait 2 minutes for Docker to install
./scripts/deploy_to_ec2.sh  # Deploys your app (3 min)
```

---

## 🎉 What Happens Automatically

The scripts will:
- ✅ Create EC2 security groups with correct ports
- ✅ Generate SSH keys for secure access
- ✅ Launch an Ubuntu EC2 instance (2 CPU, 4GB RAM)
- ✅ Install Docker automatically
- ✅ Create ECR repositories for your images
- ✅ Copy your code to the server
- ✅ Build and start all containers
- ✅ Run health checks
- ✅ Give you the URLs to access your app

---

## 📱 After Deployment

You'll get URLs like:
```
Frontend: http://YOUR_IP:3000
Backend API: http://YOUR_IP:8080/api/
Admin Panel: http://YOUR_IP:8080/admin/
```

**Next steps:**
1. Create Django superuser (see guide)
2. Configure Stripe webhooks
3. Set up Telegram bot webhook
4. (Optional) Add custom domain

---

## 📚 Need More Details?

Read the complete guide: **`AWS_DEPLOYMENT_GUIDE.md`**

It includes:
- Detailed explanations of each step
- Post-deployment configuration
- Domain setup instructions
- Monitoring and management commands
- Troubleshooting tips
- Cost estimates
- Security best practices

---

## 💰 Estimated Cost

- **~$40/month** for EC2 t3.medium instance
- You can reduce this with t3.small or spot instances

---

## 🆘 Quick Help

### Check if AWS CLI is working:
```bash
aws sts get-caller-identity
```

### View your EC2 instance:
```bash
aws ec2 describe-instances --filters "Name=tag:Name,Values=crypto-tracker"
```

### SSH to your server:
```bash
ssh -i ~/.ssh/crypto-tracker-key.pem ubuntu@YOUR_IP
```

### View application logs:
```bash
ssh -i ~/.ssh/crypto-tracker-key.pem ubuntu@YOUR_IP 'cd ~/crypto-tracker && docker compose logs -f'
```

---

## 🗑️ To Remove Everything (Stop Charges)

```bash
# Terminate instance
INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=crypto-tracker" --query 'Reservations[0].Instances[0].InstanceId' --output text)
aws ec2 terminate-instances --instance-ids $INSTANCE_ID

# Wait for termination, then delete security group
aws ec2 delete-security-group --group-name crypto-tracker-sg

# Delete ECR repos
aws ecr delete-repository --repository-name crypto-tracker/backend --force
aws ecr delete-repository --repository-name crypto-tracker/frontend --force
```

---

## ❓ Common Questions

**Q: Do I need to install anything else?**  
A: No, just AWS CLI. Everything else (Docker, PostgreSQL, Redis, etc.) is installed automatically on the EC2 instance.

**Q: How long does deployment take?**  
A: First time: ~10 minutes. Updates: ~3 minutes.

**Q: Can I use a custom domain?**  
A: Yes! See the section in `AWS_DEPLOYMENT_GUIDE.md`

**Q: What if something goes wrong?**  
A: Check the troubleshooting section in `AWS_DEPLOYMENT_GUIDE.md` or view the logs with the commands above.

**Q: How do I update my application?**  
A: Just run `./scripts/deploy_to_ec2.sh` again after making changes.

---

## 📞 Script Locations

- **Setup AWS**: `./scripts/aws_setup.sh`
- **Deploy App**: `./scripts/deploy_to_ec2.sh`
- **Quick Deploy**: `./scripts/quick_deploy.sh`
- **Full Guide**: `./AWS_DEPLOYMENT_GUIDE.md`
- **Production Env**: `./backend/.env.production`

---

**Ready to deploy?** Start with Step 1 above! 🚀
