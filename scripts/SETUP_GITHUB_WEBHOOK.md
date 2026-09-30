# 🚀 QUICK SETUP: Auto-Deployment is READY!

## ✅ What's Already Done

The webhook listener is installed and running on your server:
- ✅ Service is active and will start automatically on reboot
- ✅ Port 9000 is open in the firewall
- ✅ Webhook secret has been generated
- ✅ Logs are being written to `/var/log/webhook-deployment.log`

## 📝 FINAL STEP: Configure GitHub Webhook

**You need to do this ONCE:**

### 1. Go to GitHub Repository Settings
👉 **https://github.com/VaghasiyaAbhi/crypto-tracker/settings/hooks**

### 2. Click "Add webhook" button

### 3. Fill in the form:

**Payload URL:**
```
http://46.62.216.158:9000/webhook
```

**Content type:**
```
application/json
```

**Secret:**
```
b92a9c4dab76cd4d88cd6a5f8d5e77da7eb80f1dba3ed5b848e4ae16c29718d2
```

**Which events would you like to trigger this webhook?**
- ✅ Select: **"Just the push event"**

**Active:**
- ✅ Check the box to make sure it's active

### 4. Click "Add webhook"

### 5. Test It!

GitHub will immediately send a test ping. You should see:
- ✅ Green checkmark next to the webhook
- Recent delivery showing successful response

---

## 🎉 That's It! Now It's Automatic!

### How to Use:

```bash
# 1. Make changes to your code
vim frontend/src/app/alerts/page.tsx

# 2. Commit your changes
git add .
git commit -m "Add new feature"

# 3. Push to GitHub
git push origin main

# 4. ✨ MAGIC HAPPENS ✨
# Your server automatically:
# - Pulls the latest code
# - Builds the frontend (no cache)
# - Restarts containers
# - Deploys in 2-3 minutes!
```

### No more:
❌ SSH into server
❌ Running deployment commands
❌ Waiting for builds
❌ Manual container restarts
❌ Checking if deployment worked

### Instead:
✅ Just push your code
✅ Wait 2-3 minutes
✅ Your changes are live!

---

## 📊 Monitoring

### Watch Deployments in Real-Time:

```bash
ssh root@46.62.216.158 "journalctl -u webhook-listener -f"
```

### Check Service Status:

```bash
ssh root@46.62.216.158 "systemctl status webhook-listener"
```

### View Deployment History:

```bash
ssh root@46.62.216.158 "grep 'Deployment triggered' /var/log/webhook-deployment.log"
```

---

## 🔧 Useful Commands

### On Your Server:

```bash
# View live logs
sudo journalctl -u webhook-listener -f

# Check service status
sudo systemctl status webhook-listener

# Restart the service
sudo systemctl restart webhook-listener

# View deployment log
tail -f /var/log/webhook-deployment.log

# Check health
curl http://localhost:9000/health
```

---

## 🎯 What Gets Deployed Automatically?

✅ **Frontend changes** - Any changes in `/frontend` folder
✅ **Component updates** - New React components, pages, etc.
✅ **Style changes** - CSS, Tailwind updates
✅ **Type definitions** - TypeScript type updates
✅ **Configuration** - Next.js config, package.json

**Note:** Backend changes still need manual restart:
```bash
ssh root@46.62.216.158 "cd /root/crypto-tracker && docker-compose restart backend1"
```

---

## 🚨 Troubleshooting

### If webhook doesn't trigger:

1. **Check GitHub webhook delivery:**
   - Go to webhook settings
   - Click on "Recent Deliveries"
   - Check for errors

2. **Check service is running:**
   ```bash
   ssh root@46.62.216.158 "systemctl status webhook-listener"
   ```

3. **Check logs:**
   ```bash
   ssh root@46.62.216.158 "journalctl -u webhook-listener -n 50"
   ```

4. **Test webhook manually:**
   - Go to GitHub webhook
   - Click "Recent Deliveries"
   - Click "Redeliver" on any delivery

---

## 📚 Full Documentation

For complete documentation, see:
- **AUTO_DEPLOYMENT_GUIDE.md** - Complete setup guide
- **FRONTEND_DEPLOYMENT_FIX.md** - Troubleshooting deployment issues

---

## 🎊 Congratulations!

You now have a **production-grade CI/CD pipeline**!

Every time you push code to `main`, your website updates automatically.
Just like the big companies do it! 🚀

**Questions?** Check the logs or refer to AUTO_DEPLOYMENT_GUIDE.md
