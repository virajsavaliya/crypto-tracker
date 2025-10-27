# 📦 Creating ECR Repositories - Complete Guide

Since you don't have ECR CLI permissions, here are **3 ways** to create the ECR repositories.

---

## ⚠️ Current Status

Your AWS role doesn't have ECR permissions via CLI:
```
❌ ecr:CreateRepository
❌ ecr:DescribeRepositories
```

**But you might have Console access!** Let's try that first.

---

## METHOD 1: AWS Console (Try This First!) ⭐

### Step-by-Step Instructions:

1. **Go to ECR Console:**
   ```
   https://us-east-1.console.aws.amazon.com/ecr/repositories
   ```

2. **Click "Create repository"**

3. **Create Backend Repository:**
   - **Visibility:** Private
   - **Repository name:** `crypto-tracker/backend`
   - **Tag immutability:** Disabled (default)
   - **Scan on push:** Enabled ✅
   - **Encryption:** AES-256 (default)
   - Click **"Create repository"**

4. **Create Frontend Repository:**
   - Click "Create repository" again
   - **Visibility:** Private
   - **Repository name:** `crypto-tracker/frontend`
   - **Tag immutability:** Disabled
   - **Scan on push:** Enabled ✅
   - **Encryption:** AES-256
   - Click **"Create repository"**

5. **Save the Repository URIs:**
   - Backend URI: `196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/backend`
   - Frontend URI: `196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/frontend`

### ✅ After Creation:

You'll be able to push Docker images! Continue to the "Pushing Images" section below.

---

## METHOD 2: Request Admin to Run Script

If Console doesn't work, send this to your AWS admin:

```
Hi,

Could you please create two ECR repositories for the crypto tracker project?

Option A - Run this script (automated):
  ./scripts/create_ecr_repos.sh

Option B - Manual creation via Console:
  1. Go to: https://us-east-1.console.aws.amazon.com/ecr/repositories
  2. Create repository: crypto-tracker/backend
  3. Create repository: crypto-tracker/frontend
  4. Enable "Scan on push" for both
  
Region: us-east-1
Account: 196790134201

Thanks!
```

---

## METHOD 3: Request ECR Permissions

Ask your admin to add these permissions to your role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutLifecyclePolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

Or request the managed policy: **AmazonEC2ContainerRegistryFullAccess**

---

## 🔐 Pushing Images to ECR

Once repositories are created, here's how to use them:

### Step 1: Login to ECR

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  196790134201.dkr.ecr.us-east-1.amazonaws.com
```

### Step 2: Build Images

```bash
# Build backend
docker build -t crypto-tracker-backend ./backend

# Build frontend  
docker build -t crypto-tracker-frontend ./frontend
```

### Step 3: Tag Images

```bash
# Tag backend
docker tag crypto-tracker-backend:latest \
  196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/backend:latest

# Tag frontend
docker tag crypto-tracker-frontend:latest \
  196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/frontend:latest
```

### Step 4: Push Images

```bash
# Push backend
docker push 196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/backend:latest

# Push frontend
docker push 196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/frontend:latest
```

### Or Use Automated Script:

```bash
# After repositories are created
REGION=us-east-1 ACCOUNT=196790134201 TAG=latest ./scripts/ecr_build_push.sh
```

---

## 📋 What You Need to Deploy

After ECR repositories are created, you need:

### For ECR-Based Deployment:
1. ✅ ECR repositories (this guide)
2. ⏳ EC2 instance (admin must create, or get permissions)
3. ⏳ Security group (admin must create, or get permissions)
4. ⏳ SSH key pair (admin must create, or get permissions)

### Alternative: Direct Deployment (No ECR)
If you get an EC2 instance, you can deploy **without ECR**:
```bash
./scripts/deploy_to_existing_instance.sh INSTANCE_ID
```
This builds images directly on the EC2 instance (slower but works without ECR).


## 🧪 Testing ECR Access

Test if you can access ECR now:

```bash
# Try to list repositories
aws ecr describe-repositories --region us-east-1

# Try to get login token
aws ecr get-login-password --region us-east-1
```

If these work, you have ECR access! ✅

---

## 📊 ECR Repository Configuration

### Recommended Settings:

**Lifecycle Policy** (auto-cleanup old images):
```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

**Image Scanning:** Enabled (scans for vulnerabilities)

**Encryption:** AES-256 (enabled by default)

---

## 💰 ECR Costs

**ECR Pricing:**
- **Storage:** $0.10 per GB-month
- **Data Transfer:** $0.09 per GB (out to internet)
- **Free Tier:** 500 MB-month storage for 1 year

**Typical Usage:**
- 2 images × ~500 MB each = 1 GB
- **Cost:** ~$0.10/month (very cheap!)

---

## 🆘 Troubleshooting

### Error: "no basic auth credentials"
```bash
# Re-login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  196790134201.dkr.ecr.us-east-1.amazonaws.com
```

### Error: "AccessDeniedException"
You need ECR permissions. Use Console (Method 1) or ask admin (Method 2).

### Error: "RepositoryNotFoundException"
Repository doesn't exist. Create it via Console or ask admin.

### Can't push images
1. Check if logged in: `docker info | grep Username`
2. Check repository exists: `aws ecr describe-repositories --region us-east-1`
3. Verify image tag matches repository URI exactly

---

## ✅ Success Checklist

After creating ECR repositories, verify:

- [ ] Backend repository exists: `crypto-tracker/backend`
- [ ] Frontend repository exists: `crypto-tracker/frontend`
- [ ] Can login to ECR: `aws ecr get-login-password ...`
- [ ] Image scanning enabled
- [ ] Have the repository URIs saved

**Repository URIs:**
```
Backend:  196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/backend
Frontend: 196790134201.dkr.ecr.us-east-1.amazonaws.com/crypto-tracker/frontend
```

---

## 🎯 Quick Reference

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  196790134201.dkr.ecr.us-east-1.amazonaws.com

# Build, tag, and push (automated)
./scripts/ecr_build_push.sh

# List repositories
aws ecr describe-repositories --region us-east-1

# List images in repository
aws ecr list-images --repository-name crypto-tracker/backend --region us-east-1
```

---

## 📞 Next Steps After ECR Setup

Once ECR repositories are created:

1. **If you have EC2 permissions:**
   ```bash
   ./scripts/quick_deploy.sh
   ```

2. **If admin creates EC2 instance:**
   ```bash
   ./scripts/deploy_to_existing_instance.sh INSTANCE_ID
   ```

3. **To just push images to ECR:**
   ```bash
   ./scripts/ecr_build_push.sh
   ```

---

**Need help?** Tell me:
- Did Console access work?
- Do you need me to create more scripts?
- Want to try a different approach?
