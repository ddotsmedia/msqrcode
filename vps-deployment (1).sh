#!/bin/bash

################################################################################
# MS QR Code Production Deployment Script
# VPS: 194.164.151.202:/opt/msqrcode
# Purpose: Pull latest code, rebuild Docker images with clean cache, restart containers
################################################################################

set -e

echo "========================================="
echo "MS QR Code - Production Deployment"
echo "========================================="
echo ""

VPS_PATH="/opt/msqrcode"
echo "[1] Navigating to VPS project directory: $VPS_PATH"
cd "$VPS_PATH" || exit 1

echo ""
echo "[2] Checking git status before pull..."
git status

echo ""
echo "[3] Pulling latest changes from repository..."
git pull origin main

echo ""
echo "[4] Stopping current running containers..."
docker-compose -f docker-compose.prod.yml down || true

echo ""
echo "[5] Removing old Docker images to force rebuild..."
# This ensures we get the latest code compiled
docker-compose -f docker-compose.prod.yml rm -f

echo ""
echo "[6] Building Docker images with --no-cache flag (forces fresh build)..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "[7] Starting containers..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "[8] Waiting for services to become healthy (30 seconds)..."
sleep 30

echo ""
echo "[9] Checking container status..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "[10] Verifying API health endpoint..."
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3016/api/health || echo "000")
echo "API Health Check - HTTP Status: $API_HEALTH"

if [ "$API_HEALTH" = "200" ]; then
    echo "✓ API is healthy!"
else
    echo "✗ API health check failed. HTTP Status: $API_HEALTH"
    echo "Checking API logs for errors..."
    docker-compose -f docker-compose.prod.yml logs msqrcode-api | tail -50
fi

echo ""
echo "[11] Checking all service logs for errors..."
docker-compose -f docker-compose.prod.yml logs --tail=20

echo ""
echo "========================================="
echo "Deployment Status:"
echo "========================================="
echo "PostgreSQL:     $(docker-compose -f docker-compose.prod.yml ps postgres | grep -q 'Up' && echo '✓ Running' || echo '✗ Not running')"
echo "Redis:          $(docker-compose -f docker-compose.prod.yml ps redis | grep -q 'Up' && echo '✓ Running' || echo '✗ Not running')"
echo "API:            $(docker-compose -f docker-compose.prod.yml ps api | grep -q 'Up' && echo '✓ Running' || echo '✗ Not running')"
echo "Menu App:       $(docker-compose -f docker-compose.prod.yml ps menu-app | grep -q 'Up' && echo '✓ Running' || echo '✗ Not running')"
echo "Admin Dashboard: $(docker-compose -f docker-compose.prod.yml ps admin-dashboard | grep -q 'Up' && echo '✓ Running' || echo '✗ Not running')"
echo ""
echo "Access points:"
echo "  API:              http://194.164.151.202:3016/api/health"
echo "  Menu App:         http://194.164.151.202:3017"
echo "  Admin Dashboard:  http://194.164.151.202:3018"
echo ""
echo "========================================="
