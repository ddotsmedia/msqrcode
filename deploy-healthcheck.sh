#!/bin/bash
set -e

echo "=== MS QR Code Healthcheck Deployment ==="
echo "Time: $(date)"
echo ""

# Step 1: Pull latest changes
echo "Step 1: Pulling latest changes..."
git pull origin main
echo "✓ Git pull complete"
echo ""

# Step 2: Stop running containers
echo "Step 2: Stopping current services..."
docker compose -f docker-compose.prod.yml down
echo "✓ Services stopped"
echo ""

# Step 3: Rebuild images with updated docker-compose
echo "Step 3: Building Docker images (with HEALTHCHECK support)..."
echo "  - Building API..."
docker build -f packages/api/Dockerfile -t msqrcode-api:latest .
echo "  - Building Menu App..."
docker build -f packages/menu-app/Dockerfile -t msqrcode-menu-app:latest .
echo "  - Building Admin Dashboard..."
docker build -f packages/admin-dashboard/Dockerfile -t msqrcode-admin-dashboard:latest .
echo "✓ All images built"
echo ""

# Step 4: Start services with docker-compose
echo "Step 4: Starting services with docker-compose..."
docker compose -f docker-compose.prod.yml up -d
echo "✓ Services started"
echo ""

# Step 5: Wait for services to stabilize
echo "Step 5: Waiting for services to stabilize (30 seconds)..."
sleep 30
echo "✓ Stability wait complete"
echo ""

# Step 6: Check health status
echo "Step 6: Health Status Check:"
echo "=================================="
docker compose -f docker-compose.prod.yml ps
echo "=================================="
echo ""

# Step 7: Verify specific service health
echo "Step 7: Service Verification:"
echo "  - API health check..."
docker exec msqrcode-api curl -s http://localhost:3000/api/health || echo "API not responding yet"
echo ""
echo "  - Menu App health check..."
docker exec msqrcode-menu-app wget -q -O /dev/null http://localhost/index.html && echo "✓ Menu App responding" || echo "Menu App not responding yet"
echo ""
echo "  - Admin Dashboard health check..."
docker exec msqrcode-admin-dashboard wget -q -O /dev/null http://localhost/index.html && echo "✓ Admin Dashboard responding" || echo "Admin Dashboard not responding yet"
echo ""

echo "=== Deployment Complete ==="
echo "Check 'docker compose -f docker-compose.prod.yml ps' for health status"
echo "Health status updates every 10 seconds after container startup"
