# Deployment Fixes Applied - October 8, 2026

## Critical Issues Resolved

### 1. Dockerfile.production - Environment File Copy
**Problem:** The Dockerfile was attempting to copy `.env.production` (gitignored file) during build, causing:
```
failed to compute cache key: failed to calculate checksum
```

**Solution:** Removed the COPY line that tries to bake .env into the image. Production config now comes from `.env.production.local` at runtime via docker-compose environment file mounting.

### 2. Docker Compose Service Context Paths
**Problem:** Service Dockerfiles had incorrect COPY paths for multi-stage builds
```
COPY packages/menu-app ./packages/menu-app  # Failed when context was .
```

**Solution:** Updated docker-compose.prod.yml to specify the correct build context:
```yaml
services:
  api:
    build:
      context: ./milestones-coffee
      dockerfile: packages/api/Dockerfile.production
```

This ensures all COPY paths in Dockerfiles are relative to the milestones-coffee directory.

### 3. Missing Production Dockerfiles
**Problem:** menu-app and admin-dashboard had no production Dockerfiles

**Solution:** Created production-ready multi-stage Dockerfiles for both:
- **menu-app/Dockerfile**: Node builder → nginx runtime, serves on port 3002
- **admin-dashboard/Dockerfile**: Node builder → nginx runtime, serves on port 3003

### 4. Port Safety Verification
**Verified Ports (Safe on VPS):**
- 3016 → API (internal 3000)
- 3017 → Menu App (internal 3002)  
- 3018 → Admin Dashboard (internal 3003)

All ports verified free before assignment. Redis and PostgreSQL use internal Docker networking (no exposed ports except 6379 for backup access if needed).

### 5. Environment Configuration
Created `.env.production.local` with production-ready values:
- Database: PostgreSQL on docker network
- Cache: Redis on docker network
- API endpoints properly configured
- JWT secrets ready for production

## Files Modified

- `docker-compose.prod.yml` - Context paths corrected
- `milestones-coffee/packages/api/Dockerfile.production` - Removed .env.production COPY
- `milestones-coffee/packages/menu-app/Dockerfile` - Created (production build)
- `milestones-coffee/packages/admin-dashboard/Dockerfile` - Created (production build)
- `.env.production.local` - Created with production config

## Deployment Instructions

### Option 1: PowerShell (Windows)
```powershell
cd C:\web\MS QR Code new
.\DEPLOY_TO_VPS.ps1
```

### Option 2: SSH Command (Linux/Mac)
```bash
ssh root@194.164.151.202 "cd /opt/msqrcode && docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml build --no-cache && docker compose -f docker-compose.prod.yml up -d"
```

### Option 3: Manual Multi-Step (Recommended for first deployment)
```bash
# 1. SSH to VPS
ssh root@194.164.151.202

# 2. Navigate to deployment directory
cd /opt/msqrcode

# 3. Backup current state
docker compose -f docker-compose.prod.yml down

# 4. Update configuration files (via scp or direct edit)
# Copy: docker-compose.prod.yml
# Copy: .env.production.local
# Copy: milestones-coffee/ (entire directory)

# 5. Build images
docker compose -f docker-compose.prod.yml build --no-cache

# 6. Start services
docker compose -f docker-compose.prod.yml up -d

# 7. Verify
docker compose -f docker-compose.prod.yml ps
netstat -tlnp | grep -E '3016|3017|3018'
```

## Verification Checklist

After deployment, verify:
- [ ] API container healthy: `docker ps | grep api`
- [ ] Menu-app container running: `docker ps | grep menu`
- [ ] Admin container running: `docker ps | grep admin`
- [ ] PostgreSQL health: `docker ps | grep postgres`
- [ ] Redis health: `docker ps | grep redis`
- [ ] Port 3016 responding: `curl -s http://localhost:3016/health`
- [ ] Port 3017 responding: `curl -s http://localhost:3017`
- [ ] Port 3018 responding: `curl -s http://localhost:3018`

## Logs Access

```bash
# API logs
docker logs milestones-api-prod -f

# Menu app logs
docker logs milestones-menu-prod -f

# Admin dashboard logs
docker logs milestones-admin-prod -f

# PostgreSQL logs
docker logs milestones-postgres-prod -f

# Redis logs
docker logs milestones-redis-prod -f
```

## Rollback Procedure

If deployment fails:
```bash
cd /opt/msqrcode
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml pull  # Restore previous images if available
docker compose -f docker-compose.prod.yml up -d
```
