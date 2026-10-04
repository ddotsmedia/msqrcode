# Milestones Coffee Phase 2 — Final Deployment Guide

**Status**: Git commit complete (60 files). Ready for GitHub setup and local testing.

**Generated Secrets** (save these for GitHub):
```
JWT_SECRET=ad27fdaa6ed47a3bfb81cc8fff71037f
DB_PASSWORD=6188e79142aeac5b
VPS_HOST=srv988590.servercow.de
VPS_USER=root
```

---

## REMAINING STEPS (Execute on Windows Machine)

### Step 1: Create GitHub Repository

1. Navigate to https://github.com/new
2. Create new repository:
   - Repository name: milestones-coffee
   - Description: QR-based digital menu system for Milestones Coffee
   - Visibility: Private
   - Initialize repository: NO
   - Click Create repository

### Step 2: Push to GitHub

```powershell
cd "C:\web\MS QR Code new"
git remote set-url origin https://github.com/YOUR_USERNAME/milestones-coffee.git
git push -u origin main
git branch -vv
```

### Step 3: Add GitHub Secrets

Go to: Settings > Secrets and variables > Actions

Add these 5 secrets:
- VPS_HOST = srv988590.servercow.de
- VPS_USER = root
- VPS_SSH_KEY = (content of ~/.ssh/id_rsa)
- DB_PASSWORD = 6188e79142aeac5b
- JWT_SECRET = ad27fdaa6ed47a3bfb81cc8fff71037f

### Step 4: Local Testing

```powershell
cd "C:\web\MS QR Code new"
rm -r node_modules pnpm-lock.yaml
pnpm install
docker-compose up -d
Start-Sleep -Seconds 15
pnpm db:push
pnpm db:seed
pnpm dev
```

### Step 5: Health Checks

```powershell
curl http://localhost:3000/api/health
curl http://localhost:5173
curl http://localhost:5174
```

### Step 6: VPS Preparation

```bash
ssh root@srv988590.servercow.de
mkdir -p /opt/milestones-coffee
cd /opt/milestones-coffee

cat > .env << 'EOF'
DB_USER=milestones
DB_PASSWORD=6188e79142aeac5b
DB_NAME=milestones_coffee
JWT_SECRET=ad27fdaa6ed47a3bfb81cc8fff71037f
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://menu.milestonescoffee.ae
EOF

exit
```

### Step 7: Push & Deploy

```powershell
cd "C:\web\MS QR Code new"
git status
git push origin main
```

Watch: https://github.com/YOUR_USERNAME/milestones-coffee/actions

### Step 8: Verify Live Deployment

```bash
ssh root@srv988590.servercow.de
docker ps
curl http://localhost:3000/api/health
curl https://menu.milestonescoffee.ae/api/health
```

---

## Summary

✅ Phase 2 code committed to git (60 files)
✅ Main branch ready
⏳ Next: Create GitHub repo, add secrets, push, and deploy
⏳ Deployment time: ~20 minutes total
