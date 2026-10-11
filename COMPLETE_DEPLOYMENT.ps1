# Complete Deployment Script for Milestones Coffee
# Run this script to finish deployment and verify all services

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     MILESTONES COFFEE - COMPLETE DEPLOYMENT VERIFICATION      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "packages/admin-dashboard")) {
    Write-Host "ERROR: Please run this script from the project root directory" -ForegroundColor Red
    Write-Host "Expected: D:\path\to\msqrcode" -ForegroundColor Yellow
    exit 1
}

# Step 1: Clean Admin Dashboard if needed
Write-Host "STEP 1: Preparing Admin Dashboard..." -ForegroundColor Yellow

if (Test-Path "packages/admin-dashboard/node_modules") {
    Write-Host "  Cleaning pnpm cache and node_modules..." -ForegroundColor Gray
    Push-Location packages/admin-dashboard

    pnpm store prune 2>&1 | Out-Null
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
    Remove-Item pnpm-lock.yaml -ErrorAction SilentlyContinue

    Write-Host "  Installing dependencies..." -ForegroundColor Gray
    pnpm install

    Pop-Location
} else {
    Write-Host "  ✓ Admin Dashboard already prepared" -ForegroundColor Green
}

Write-Host ""
Write-Host "STEP 2: Service Status Check" -ForegroundColor Yellow
Write-Host ""

$allRunning = $true

# Check Menu App
Write-Host "  Checking Menu App (5173)..." -ForegroundColor Gray
Try {
    $null = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "    ✓ Menu App is running" -ForegroundColor Green
} Catch {
    Write-Host "    ✗ Menu App is NOT running - you need to start it" -ForegroundColor Yellow
    $allRunning = $false
}

# Check Admin Dashboard
Write-Host "  Checking Admin Dashboard (5174)..." -ForegroundColor Gray
Try {
    $null = Invoke-WebRequest -Uri "http://localhost:5174" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "    ✓ Admin Dashboard is running" -ForegroundColor Green
} Catch {
    Write-Host "    ✗ Admin Dashboard is NOT running - you need to start it" -ForegroundColor Yellow
    $allRunning = $false
}

# Check API
Write-Host "  Checking API (3000)..." -ForegroundColor Gray
Try {
    $null = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "    ✓ API is running" -ForegroundColor Green
} Catch {
    Write-Host "    ✗ API is NOT running - check Docker" -ForegroundColor Yellow
    $allRunning = $false
}

# Check PostgreSQL
Write-Host "  Checking PostgreSQL (5432)..." -ForegroundColor Gray
Try {
    $result = docker ps --filter "name=milestones-postgres" --format "table {{.Status}}" 2>$null
    if ($result) {
        Write-Host "    ✓ PostgreSQL is running in Docker" -ForegroundColor Green
    } else {
        Write-Host "    ✗ PostgreSQL container not found" -ForegroundColor Yellow
        $allRunning = $false
    }
} Catch {
    Write-Host "    ✗ Cannot check PostgreSQL - Docker not available" -ForegroundColor Yellow
}

# Check Redis
Write-Host "  Checking Redis (6379)..." -ForegroundColor Gray
Try {
    $result = docker ps --filter "name=milestones-redis" --format "table {{.Status}}" 2>$null
    if ($result) {
        Write-Host "    ✓ Redis is running in Docker" -ForegroundColor Green
    } else {
        Write-Host "    ✗ Redis container not found" -ForegroundColor Yellow
        $allRunning = $false
    }
} Catch {
    Write-Host "    ✗ Cannot check Redis - Docker not available" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan

if ($allRunning) {
    Write-Host "║            ✓ ALL SERVICES ARE RUNNING SUCCESSFULLY!           ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Menu App:        http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  Admin Dashboard: http://localhost:5174" -ForegroundColor Cyan
    Write-Host "  API:             http://localhost:3000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Open your browser and visit any of these URLs to see the apps running!" -ForegroundColor Green
} else {
    Write-Host "║               SERVICES STILL STARTING UP...                    ║" -ForegroundColor Yellow
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Open THREE separate PowerShell windows" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Window 1 - Menu App:" -ForegroundColor Green
    Write-Host "    cd packages/menu-app" -ForegroundColor Gray
    Write-Host "    pnpm dev" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Window 2 - Admin Dashboard:" -ForegroundColor Green
    Write-Host "    cd packages/admin-dashboard" -ForegroundColor Gray
    Write-Host "    pnpm dev" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Window 3 - Docker API (if not already running):" -ForegroundColor Green
    Write-Host "    docker ps  (check if milestones-api is running)" -ForegroundColor Gray
    Write-Host "    If not, build and run: docker build -f packages/api/Dockerfile.dev -t milestones-api ." -ForegroundColor Gray
    Write-Host "    Then: docker run -d -p 3000:3000 -e DATABASE_URL='postgresql://postgres:postgres@localhost:5432/milestones' -e REDIS_URL='redis://localhost:6379' milestones-api" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Once all services show as running, access:" -ForegroundColor Cyan
    Write-Host "    - Menu App:        http://localhost:5173" -ForegroundColor Gray
    Write-Host "    - Admin Dashboard: http://localhost:5174" -ForegroundColor Gray
    Write-Host "    - API:             http://localhost:3000" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Deployment Information:"
Write-Host "  📁 Project Root: $(Get-Location)" -ForegroundColor Gray
Write-Host "  📦 Package Manager: pnpm" -ForegroundColor Gray
Write-Host "  🐳 Database: PostgreSQL (Docker)" -ForegroundColor Gray
Write-Host "  ⚡ Cache: Redis (Docker)" -ForegroundColor Gray
Write-Host ""
