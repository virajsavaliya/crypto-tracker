# 🚀 AWS ECR Deployment - Quick Start Guide

## ✅ Prerequisites Checklist

Before deploying, ensure you have:

- [x] AWS CLI installed (`aws --version`)
- [x] Docker installed and running
- [ ] Valid AWS credentials configured
- [ ] ECR repositories created

## 📋 Step-by-Step Deployment

### Step 1: Configure AWS Credentials

Your token has expired. Refresh your credentials:

```bash
# Option A: If using Access Keys
aws configure

# Option B: If using AWS SSO
aws sso login --profile your-profile

# Verify credentials work
aws sts get-caller-identity
```

### Step 2: Create ECR Repositories (if needed)

```bash
cd /Users/virajsavaliya/Desktop/project/Archive\ 2

# Create ECR repositories
./scripts/create_ecr_repos.sh
```

**Or manually via AWS Console:**
1. Go to: https://us-east-1.console.aws.amazon.com/ecr/repositories
2. Click "Create repository"
3. Create:
   - `crypto-tracker/backend`
   - `crypto-tracker/frontend`
4. Enable "Scan on push" for both

### Step 3: Deploy to ECR

```bash
# Run the complete deployment script
./scripts/ecr_deploy.sh

# Or with a custom tag
TAG=v1.0.0 ./scripts/ecr_deploy.sh
```

This script will automatically:
- ✅ Check AWS credentials
- ✅ Verify/create ECR repositories
- ✅ Login to ECR
- ✅ Build backend Docker image
- ✅ Build frontend Docker image
- ✅ Tag images with ECR URIs
- ✅ Push images to ECR
- ✅ Verify deployment

---

## 🎯 Quick Commands

### Login to ECR manually
```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  196790134201.dkr.ecr.us-east-1.amazonaws.com
```

### List ECR repositories
```bash
aws ecr describe-repositories --region us-east-1
```

### List images in a repository
```bash
# Backend images
aws ecr list-images \
  --repository-name crypto-tracker/backend \
  --region us-east-1

# Frontend images
aws ecr list-images \
  --repository-name crypto-tracker/frontend \
  --region us-east-1
```

### Get image details
```bash
aws ecr describe-images \
  --repository-name crypto-tracker/backend \
  --region us-east-1
```

---

## 🔧 Manual Build & Push (if script fails)

### Backend
```bash
cd /Users/virajsavaliya/Desktop/project/Archive\ 2

# Build
docker build -t crypto-tracker-backend:latest ./backend

# Tag
docker tag crypto-tracker-backend:latest \
  196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/backend:latest

# Push
docker push \
  196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/backend:latest
```

### Frontend
```bash
# Build
docker build -t crypto-tracker-frontend:latest ./frontend

# Tag
docker tag crypto-tracker-frontend:latest \
  196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/frontend:latest

# Push
docker push \
  196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/frontend:latest
```

---

## ✅ Verify Deployment

After pushing images:

```bash
# Check backend images
aws ecr describe-images \
  --repository-name crypto-tracker/backend \
  --region us-east-1 \
  --query 'imageDetails[*].[imageTags[0],imageSizeInBytes,imagePushedAt]' \
  --output table

# Check frontend images
aws ecr describe-images \
  --repository-name crypto-tracker/frontend \
  --region us-east-1 \
  --query 'imageDetails[*].[imageTags[0],imageSizeInBytes,imagePushedAt]' \
  --output table
```

---

## 🚀 Deploy to EC2 (After ECR Push)

Once images are in ECR, deploy to EC2:

```bash
# Using docker-compose on EC2
ssh -i ~/.ssh/your-key.pem ubuntu@YOUR_EC2_IP

# On the EC2 instance
cd ~/crypto-tracker
export TAG=latest
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 🐛 Troubleshooting

### Error: "ExpiredToken"
**Solution:** Refresh your AWS credentials
```bash
aws configure
# or
aws sso login
```

### Error: "RepositoryNotFoundException"
**Solution:** Create the ECR repositories first
```bash
./scripts/create_ecr_repos.sh
```

### Error: "no basic auth credentials"
**Solution:** Re-login to ECR
```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  196790134201.dkr.ecr.us-east-1.amazonaws.com
```

### Error: "AccessDeniedException"
**Solution:** Check IAM permissions. You need:
- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:PutImage`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`

### Build fails with "No space left on device"
**Solution:** Clean up Docker
```bash
docker system prune -a --volumes
```

---

## 💰 ECR Costs

- Storage: $0.10 per GB/month
- Transfer: $0.09 per GB out to internet
- Typical usage: ~$0.10-0.20/month for 2 images

---

## 🗑️ Cleanup (Delete Images)

### Delete specific images
```bash
# Get image digest
IMAGE_DIGEST=$(aws ecr list-images \
  --repository-name crypto-tracker/backend \
  --query 'imageIds[?imageTag==`latest`].imageDigest' \
  --output text \
  --region us-east-1)

# Delete image
aws ecr batch-delete-image \
  --repository-name crypto-tracker/backend \
  --image-ids imageDigest=$IMAGE_DIGEST \
  --region us-east-1
```

### Delete entire repositories
```bash
# WARNING: This deletes everything!
aws ecr delete-repository \
  --repository-name crypto-tracker/backend \
  --force \
  --region us-east-1

aws ecr delete-repository \
  --repository-name crypto-tracker/frontend \
  --force \
  --region us-east-1
```

---

## 📊 Repository URIs

Once created, your repositories will be:

- **Backend**: `196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/backend`
- **Frontend**: `196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/frontend`

---

## 🔐 Security Best Practices

1. **Enable Image Scanning**: Scans for vulnerabilities (already enabled in script)
2. **Use IAM Roles**: For EC2 instances pulling images
3. **Lifecycle Policies**: Auto-delete old images to save costs
4. **Encryption**: AES-256 encryption enabled by default
5. **Private Repositories**: Keep repositories private (not public)

---

## 📞 Need Help?

1. Check AWS CloudWatch logs
2. Review ECR setup guide: `ECR_SETUP_GUIDE.md`
3. Review deployment guide: `START_HERE_DEPLOY.md`
4. Check AWS documentation: https://docs.aws.amazon.com/ecr/

---

## ✨ Next Steps After ECR Deployment

1. **Set up EC2 instance** (if not done yet)
2. **Configure production environment** (`backend/.env.production`)
3. **Deploy application** to EC2
4. **Set up monitoring** and logging
5. **Configure custom domain** (optional)
6. **Set up CI/CD** for automatic deployments (optional)

---

**Ready to deploy?** Start with Step 1 above! 🚀
