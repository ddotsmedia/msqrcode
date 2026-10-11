#!/bin/bash

# Complete Deployment Script for Milestones Coffee (Linux/WSL)
# Run this script to finish deployment and verify all services

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     MILESTONES COFFEE - COMPLETE DEPLOYMENT VERIFICATION      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -d "packages/admin-dashboard" ]; then
    echo "ERROR: Please run this script from the project root directory"
    echo "Expected: /path/to/msqrcode"
    exit 1
fi

# Step 1: Clean Admin Dashboard if needed
echo "STEP 1: Preparing Admin Dashboard..."
echo ""

if [ -d "packages/admin-dashboard/node_modules" ]; then
    echo "  Cleaning pnpm cache and node_modules..."
    cd packages/admin-dashboard

    pnpm store prune 2>/dev/null
    rm -rf node_modules
    rm -f pnpm-lock.yaml

    echo "  Installing dependencies..."
    pnpm install

    cd ../..
else
    echo "  ✓ Admin Dashboard already prepared"
fi

echo ""
echo "STEP 2: Service Status Check"
echo ""

all_running=true

# Check Menu App
echo "  Checking Menu App (5173)..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "    ✓ Menu App is running"
else
    echo "    ✗ Menu App is NOT running - you need to start it"
    all_running=false
fi

# Check Admin Dashboard
echo "  Checking Admin Dashboard (5174)..."
if curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo "    ✓ Admin Dashboard is running"
else
    echo "    ✗ Admin Dashboard is NOT running - you need to start it"
    all_running=false
fi

# Check API
echo "  Checking API (3000)..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "    ✓ API is running"
else
    echo "    ✗ API is NOT running - check Docker"
    all_running=false
fi

# Check PostgreSQL
echo "  Checking PostgreSQL (5432)..."
if docker ps --filter "name=milestones-postgres" --format "table {{.Status}}" 2>/dev/null | grep -q .; then
    echo "    ✓ PostgreSQL is running in Docker"
else
    echo "    ✗ PostgreSQL container not found"
    all_running=false
fi

# Check Redis
echo "  Checking Redis (6379)..."
if docker ps --filter "name=milestones-redis" --format "table {{.Status}}" 2>/dev/null | grep -q .; then
    echo "    ✓ Redis is running in Docker"
else
    echo "    ✗ Redis container not found"
    all_running=false
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"

if [ "$all_running" = true ]; then
    echo "║            ✓ ALL SERVICES ARE RUNNING SUCCESSFULLY!           ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Menu App:        http://localhost:5173"
    echo "  Admin Dashboard: http://localhost:5174"
    echo "  API:             http://localhost:3000"
    echo ""
    echo "Open your browser and visit any of these URLs to see the apps running!"
else
    echo "║               SERVICES STILL STARTING UP...                    ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "NEXT STEPS:"
    echo ""
    echo "  1. Open THREE separate terminal windows"
    echo ""
    echo "  Window 1 - Menu App:"
    echo "    cd packages/menu-app"
    echo "    pnpm dev"
    echo ""
    echo "  Window 2 - Admin Dashboard:"
    echo "    cd packages/admin-dashboard"
    echo "    pnpm dev"
    echo ""
    echo "  Window 3 - Docker API (if not already running):"
    echo "    docker ps  (check if milestones-api is running)"
    echo "    If not: docker build -f packages/api/Dockerfile.dev -t milestones-api ."
    echo "    Then: docker run -d -p 3000:3000 -e DATABASE_URL='postgresql://postgres:postgres@localhost:5432/milestones' -e REDIS_URL='redis://localhost:6379' milestones-api"
    echo ""
    echo "  2. Once all services show as running, access:"
    echo "    - Menu App:        http://localhost:5173"
    echo "    - Admin Dashboard: http://localhost:5174"
    echo "    - API:             http://localhost:3000"
fi

echo ""
echo "Deployment Information:"
echo "  📁 Project Root: $(pwd)"
echo "  📦 Package Manager: pnpm"
echo "  🐳 Database: PostgreSQL (Docker)"
echo "  ⚡ Cache: Redis (Docker)"
echo ""
