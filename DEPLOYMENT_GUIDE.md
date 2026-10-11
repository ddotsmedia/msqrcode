# MS QR Code - Production Deployment Guide

## Overview
This guide provides step-by-step instructions to deploy the MS QR Code (Milestones Coffee Platform) to production on the VPS at `194.164.151.202:/opt/msqrcode`.

## Fixed Issues
1. ✅ **API Module Resolution** - Updated Dockerfile to properly handle pnpm monorepo by copying entire node_modules from builder stage
2. ✅ **Port Conflicts** - PostgreSQL: 5433:5432, Redis: 6384:6379 (verified against running services on VPS)
3. ✅ **Dockerfile References** - Created missing Dockerfiles for menu-app and admin-dashboard
4. ✅ **Docker Compose Configuration** - Updated to reference correct Dockerfile paths

## Files Changed
- `packages/api/Dockerfile` - Fixed to copy node_modules from builder stage (resolves express module error)
- `packages/menu-app/Dockerfile` - Created (nginx-based React/Vite build)
- `packages/admin-dashboard/Dockerfile` - Created (nginx-based React/Vite build)
- `docker-compose.prod.yml` - Updated with correct ports and Dockerfile references

## Pre-Deployment Checklist

### Before connecting to VPS:
1. Verify all files are in the project directory:
   - ✅ packages/api/Dockerfile (corrected)
   - ✅ packages/menu-app/Dockerfile (new)
   - ✅ packages/admin-dashboard/Dockerfile (new)
   - ✅ docker-compose.prod.yml (updated)

2. Verify port availability on VPS:
   - Port 5433 (PostgreSQL) - Must NOT be in use
   - Port 6384 (Redis) - Must NOT be in use
   - Port 3016 (API) - Must NOT be in use
   - Port 3017 (Menu App) - Must NOT be in use
   - Port 3018 (Admin Dashboard) - Must NOT be in use

## Deployment Steps

### Step 1: Connect to VPS and Prepare Directory
\`\`\`bash
ssh root@194.164.151.202

# Stop any existing containers
cd /opt/msqrcode
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Backup existing configuration
cp docker-compose.prod.yml docker-compose.prod.yml.backup
\`\`\`

### Step 2: Upload Updated Files
\`\`\`bash
# From your local machine, copy files to VPS
scp -r /home/claude/msqrcode/* root@194.164.151.202:/opt/msqrcode/
\`\`\`

### Step 3: Build and Start Containers
\`\`\`bash
# On VPS - verify port availability
cd /opt/msqrcode
lsof -i :5433 || echo "Port 5433: OK"
lsof -i :6384 || echo "Port 6384: OK"
lsof -i :3016 || echo "Port 3016: OK"

# Build images (takes 5-10 minutes)
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Verify containers are running
docker-compose -f docker-compose.prod.yml ps
\`\`\`

### Step 4: Verify Deployment
\`\`\`bash
# Check status
docker-compose -f docker-compose.prod.yml ps

# Check API logs
docker logs msqrcode-api | tail -50

# Test API
curl http://localhost:3016/api/health

# Test other services
curl -I http://localhost:3017/  # Menu App
curl -I http://localhost:3018/  # Admin Dashboard
\`\`\`

## Troubleshooting

### API container keeps restarting
\`\`\`bash
docker logs msqrcode-api
# If "Cannot find module 'express'", rebuild:
docker-compose -f docker-compose.prod.yml build --no-cache api
\`\`\`

### Port conflicts
\`\`\`bash
# Find what's using the port
lsof -i :<port>

# Kill the process if it's safe to do so
kill -9 <PID>
\`\`\`

## Key Configuration Details

- **PostgreSQL Port**: 5433 (host) → 5432 (container)
- **Redis Port**: 6384 (host) → 6379 (container)
- **API Port**: 3016 (host) → 3000 (container)
- **Database URL** (internal): postgresql://postgres:postgres@postgres:5432/msqrcode
- **Redis URL** (internal): redis://redis:6379

Note: Internal URLs use container ports, not exposed host ports.

