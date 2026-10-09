#!/bin/bash

# Fixed VPS Deployment Script for Milestones Coffee
# Pushes corrected Dockerfiles and rebuilds

VPS_HOST="194.164.151.202"
VPS_USER="root"
DEPLOY_PATH="/opt/msqrcode"
PROJECT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "════════════════════════════════════════════════════════"
echo "Milestones Coffee - VPS Docker Build Fix"
echo "Target: ${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}"
echo "════════════════════════════════════════════════════════"

# Step 1: Sync corrected Dockerfiles only
echo ""
echo "[1/3] Pushing corrected Dockerfiles to VPS..."
scp -P 22 "${PROJECT_PATH}/packages/api/Dockerfile.production" "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/milestones-coffee/packages/api/"
scp -P 22 "${PROJECT_PATH}/packages/menu-app/Dockerfile" "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/milestones-coffee/packages/menu-app/"
scp -P 22 "${PROJECT_PATH}/packages/admin-dashboard/Dockerfile" "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/milestones-coffee/packages/admin-dashboard/"

# Step 2: Rebuild Docker images (containers stay running until build completes)
echo ""
echo "[2/3] Rebuilding Docker images with corrected Dockerfiles..."
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" "cd ${DEPLOY_PATH} && docker compose -f docker-compose.prod.yml build --no-cache"

if [ $? -ne 0 ]; then
    echo ""
    echo "Build failed! Check VPS for errors."
    exit 1
fi

# Step 3: Restart services
echo ""
echo "[3/3] Restarting services..."
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" "cd ${DEPLOY_PATH} && docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d"

# Verify
echo ""
echo "Services status:"
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" "cd ${DEPLOY_PATH} && docker compose -f docker-compose.prod.yml ps"

echo ""
echo "✓ Live at:"
echo "  • API:   http://194.164.151.202:3016"
echo "  • Menu:  http://194.164.151.202:3017"
echo "  • Admin: http://194.164.151.202:3018"
