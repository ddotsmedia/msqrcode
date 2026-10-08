# ═══════════════════════════════════════════════════════════════
# Milestones Coffee - Production VPS Deployment Script
# ═══════════════════════════════════════════════════════════════
# Execute this script from PowerShell on Windows to deploy to VPS

param(
    [string]$VpsHost = "194.164.151.202",
    [string]$VpsUser = "root",
    [string]$DeployPath = "/opt/msqrcode"
)

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Milestones Coffee - Production Deployment to VPS" -ForegroundColor Green
Write-Host "Target: $VpsUser@$VpsHost:$DeployPath" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Copy project files to VPS
Write-Host "`n[1/5] Copying project files to VPS..." -ForegroundColor Cyan
$ProjectPath = $PSScriptRoot

# Create SSH command to copy files
Write-Host "  • Copying docker-compose.prod.yml..." -ForegroundColor Gray
scp -P 22 -r "$ProjectPath\docker-compose.prod.yml" "${VpsUser}@${VpsHost}:${DeployPath}/"

Write-Host "  • Copying .env.production.local..." -ForegroundColor Gray
scp -P 22 -r "$ProjectPath\.env.production.local" "${VpsUser}@${VpsHost}:${DeployPath}/"

Write-Host "  • Copying milestones-coffee project..." -ForegroundColor Gray
scp -P 22 -r "$ProjectPath\milestones-coffee" "${VpsUser}@${VpsHost}:${DeployPath}/"

# Step 2: Stop existing containers
Write-Host "`n[2/5] Stopping existing containers..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" `
    "cd $DeployPath && docker compose -f docker-compose.prod.yml down 2>/dev/null || true"

# Step 3: Build Docker images
Write-Host "`n[3/5] Building Docker images (this may take several minutes)..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" `
    "cd $DeployPath && docker compose -f docker-compose.prod.yml build --no-cache"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n✗ Docker build failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Start services
Write-Host "`n[4/5] Starting services..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" `
    "cd $DeployPath && docker compose -f docker-compose.prod.yml up -d"

# Step 5: Verify deployment
Write-Host "`n[5/5] Verifying deployment..." -ForegroundColor Cyan
Write-Host "  • Checking container status..." -ForegroundColor Gray
ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" `
    "cd $DeployPath && docker compose -f docker-compose.prod.yml ps"

Write-Host "`n  • Checking port availability..." -ForegroundColor Gray
ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" `
    "netstat -tlnp 2>/dev/null | grep -E '3016|3017|3018' || echo 'Ports 3016, 3017, 3018 ready'"

Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✓ Deployment Complete!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "`nServices are live at:" -ForegroundColor Cyan
Write-Host "  • API:     https://api.milestonescoffee.ae:3016" -ForegroundColor Yellow
Write-Host "  • Menu:    https://menu.milestonescoffee.ae:3017" -ForegroundColor Yellow
Write-Host "  • Admin:   https://admin.milestonescoffee.ae:3018" -ForegroundColor Yellow

