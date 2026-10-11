# MS QR Code - API Module Fix & Deployment Guide

## Problem Summary
The API container was crashing with error: `Cannot find module 'express'`

This occurred because the Docker multi-stage build was not properly copying the `node_modules` directory with all pnpm symlinks from the builder stage to the production stage.

## Root Cause
The original API Dockerfile only copied the built application files but did NOT copy the complete `node_modules` directory. In a pnpm monorepo, dependencies are stored with symlinks, and without copying the entire `node_modules`, the application cannot find required packages at runtime.

## Solution Applied
Updated `packages/api/Dockerfile` to include:
```dockerfile
# Copy the entire node_modules with all symlinks properly set up
COPY --from=builder /app/node_modules/ ./node_modules/
```

This ensures all dependencies (express, and others) are available in the production container.

## Deployment Steps

### Via SSH (Recommended - Automated)

```bash
# 1. SSH to VPS
ssh root@194.164.151.202

# 2. Navigate to project
cd /opt/msqrcode

# 3. Pull latest changes
git pull origin main

# 4. Stop and remove old containers
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml rm -f

# 5. Clean rebuild (CRITICAL: must use --no-cache to apply new Dockerfile)
docker-compose -f docker-compose.prod.yml build --no-cache

# 6. Start services
docker-compose -f docker-compose.prod.yml up -d

# 7. Wait for startup
sleep 30

# 8. Verify status
docker-compose -f docker-compose.prod.yml ps

# 9. Check API health
curl http://localhost:3016/api/health

# 10. View logs if needed
docker-compose -f docker-compose.prod.yml logs -f api
```

### Using Deployment Script (Fully Automated)

If you have the `vps-deployment.sh` script:

```bash
# Copy to VPS or run via SSH
ssh root@194.164.151.202 'bash /opt/msqrcode/vps-deployment.sh'
```

## Key Points

### Critical: --no-cache Flag
**MUST use `docker-compose build --no-cache`** to ensure Docker:
- Doesn't use cached layers from previous builds
- Fully rebuilds the image with the updated Dockerfile
- Properly copies node_modules from the builder stage

Without `--no-cache`, Docker may reuse old cached layers and the old (broken) build will be used.

### Container Health Checks
All containers have health checks configured:
- **PostgreSQL**: `pg_isready` test every 10s (passes when ready)
- **Redis**: `redis-cli ping` test every 10s (passes when ready)
- **API**: Health endpoint check every 10s
- **Frontend apps**: HTTP 200 on /index.html

### Port Configuration
```
PostgreSQL:     localhost:5433  (avoids VPS native PG on 5432)
Redis:          localhost:6384  (avoids suqly-redis-1 on 6379)
API:            localhost:3016  (Node.js app on 3000)
Menu App:       localhost:3017  (Nginx on 80)
Admin Dashboard: localhost:3018 (Nginx on 80)
```

## Verification

### Check Running Containers
```bash
docker-compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME                         STATUS
msqrcode-postgres-prod       Up (healthy)
msqrcode-redis-prod          Up (healthy)
msqrcode-api-prod            Up (healthy)
msqrcode-menu-app            Up
msqrcode-admin-dashboard     Up
```

### Test API Endpoint
```bash
# Health check
curl http://localhost:3016/api/health

# Should return 200 OK with health data
```

### Check API Logs
```bash
# If API is still crashing
docker-compose -f docker-compose.prod.yml logs msqrcode-api

# Should see "Server is running on port 3000" or similar
# NOT the "Cannot find module 'express'" error
```

### Check Container Node Version
```bash
docker-compose -f docker-compose.prod.yml exec api node -v

# Should output: v22.x.x (not v18.x.x)
# If still v18, the Dockerfile on VPS hasn't been updated
```

## If API Still Crashes

If the API container is still failing after deployment:

### 1. Verify Dockerfile on VPS
```bash
head -40 /opt/msqrcode/packages/api/Dockerfile | tail -15
```

Should show:
```dockerfile
# Copy the entire node_modules with all symlinks properly set up
COPY --from=builder /app/node_modules/ ./node_modules/
```

If not present, the git pull didn't work or there's a local modification.

### 2. Check node_modules in Container
```bash
docker-compose -f docker-compose.prod.yml exec api ls -la node_modules/ | head -20

# Should show many folders including express
```

### 3. Force Re-clone Repository
```bash
cd /opt/msqrcode
git fetch --all
git reset --hard origin/main
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Check Build Logs
```bash
docker-compose -f docker-compose.prod.yml build --no-cache 2>&1 | tail -100
```

Look for:
- `COPY --from=builder /app/node_modules/` command execution
- Any "failed to copy" errors

## Success Indicators

✓ All 5 containers running and healthy
✓ API container does NOT show "Cannot find module" errors
✓ `curl http://localhost:3016/api/health` returns 200 OK
✓ Frontend apps accessible at ports 3017 and 3018
✓ No restarting containers (status column shows "Up" without "(starting)")

## Files Changed

1. **packages/api/Dockerfile** - Added `COPY --from=builder /app/node_modules/ ./node_modules/`
2. **packages/menu-app/Dockerfile** - Created (new file)
3. **packages/admin-dashboard/Dockerfile** - Created (new file)
4. **docker-compose.prod.yml** - Port mappings corrected

All changes are already committed to git and ready to deploy.
