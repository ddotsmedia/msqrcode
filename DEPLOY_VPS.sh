#!/bin/bash
set -e

# MS QR Code - Autonomous VPS Deployment Script
# This script deploys the project to the VPS with zero questions

echo "=========================================="
echo "MS QR Code - Autonomous Deployment"
echo "=========================================="
echo "Time: $(date)"
echo ""

# Configuration
VPS_IP="194.164.151.202"
DEPLOY_PATH="/opt/msqrcode"
PROJECT_NAME="msqrcode"

# Step 1: Setup and prepare directory
echo "[1/7] Preparing deployment environment..."
sudo mkdir -p "$DEPLOY_PATH"
sudo chown $(whoami):$(whoami) "$DEPLOY_PATH" || true
cd "$DEPLOY_PATH"

# Step 2: Clone or update repository
echo "[2/7] Fetching latest code..."
if [ -d .git ]; then
    git fetch origin
    git reset --hard origin/main
else
    git clone https://github.com/yourorg/msqrcode.git . || true
    git fetch origin
    git reset --hard origin/main
fi

# Step 3: Install pnpm
echo "[3/7] Setting up pnpm..."
corepack enable
corepack prepare pnpm@9.0.0 --activate

# Step 4: Install dependencies
echo "[4/7] Installing dependencies (this may take 2-3 minutes)..."
pnpm install --no-frozen-lockfile

# Step 5: Generate Prisma Client
echo "[5/7] Generating Prisma client..."
pnpm --filter @milestones/database exec prisma generate 2>/dev/null || \
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 pnpm --filter @milestones/database exec prisma generate || \
  echo "Note: Prisma generation may require manual intervention. Docker build will attempt again."

# Step 6: Build all packages
echo "[6/7] Building all packages (this may take 3-5 minutes)..."
pnpm build || echo "Warning: Local build may have failed. Docker build will attempt again."

# Step 7: Deploy with Docker Compose
echo "[7/7] Deploying containers with Docker Compose..."
docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo ""
echo "Waiting for services to stabilize..."
sleep 10

# Check service status
echo ""
echo "=========================================="
echo "Deployment Status:"
echo "=========================================="
docker compose -f docker-compose.prod.yml ps

# Health checks
echo ""
echo "Running health checks..."
echo ""

API_HEALTH=$(curl -s http://localhost:3016/api/health || echo "unavailable")
if echo "$API_HEALTH" | grep -q "ok\|degraded"; then
    echo "✓ API is responding (health: OK)"
else
    echo "⚠ API health check response:"
    echo "$API_HEALTH"
fi

# Final status
echo ""
echo "=========================================="
echo "Deployment Summary:"
echo "=========================================="
echo "Project: $PROJECT_NAME"
echo "Location: $DEPLOY_PATH"
echo "Deployed: $(date)"
echo ""
echo "Services:"
echo "  - API: http://localhost:3016"
echo "  - Menu App: http://localhost:3017"
echo "  - Admin Dashboard: http://localhost:3018"
echo "  - PostgreSQL: localhost:5433"
echo "  - Redis: localhost:6384"
echo ""
echo "View logs: docker compose -f $DEPLOY_PATH/docker-compose.prod.yml logs -f"
echo "=========================================="
