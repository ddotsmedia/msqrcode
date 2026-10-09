# Production VPS Deployment Script
# For Milestones Coffee to 194.164.151.202

param(
    [string]$VpsHost = "194.164.151.202",
    [string]$VpsUser = "root",
    [string]$DeployPath = "/opt/msqrcode"
)

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Milestones Coffee - Production Deployment" -ForegroundColor Green
$target = "$VpsUser@$VpsHost`:$DeployPath"
Write-Host "Target: $target" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan

$ProjectPath = $PSScriptRoot

# Step 1: Copy files to VPS
Write-Host "`n[1/5] Copying files to VPS..." -ForegroundColor Cyan
Write-Host "  • docker-compose.prod.yml" -ForegroundColor Gray
scp -P 22 "$ProjectPath\docker-compose.prod.yml" "${VpsUser}@${VpsHost}:${DeployPath}/"

Write-Host "  • .env.production.local" -ForegroundColor Gray
scp -P 22 "$ProjectPath\.env.production.local" "${VpsUser}@${VpsHost}:${DeployPath}/"

Write-Host "  • milestones-coffee project" -ForegroundColor Gray
scp -P 22 -r "$ProjectPath\milestones-coffee" "${VpsUser}@${VpsHost}:${DeployPath}/"

# Step 2: Stop existing containers
Write-Host "`n[2/5] Stopping containers..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" "cd $DeployPath && docker compose -f docker-compose.prod.yml down 2>/dev/null || true"

# Step 3: Build images
Write-Host "`n[3/5] Building Docker images..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" "cd $DeployPath && docker compose -f docker-compose.prod.yml build --no-cache"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Start services
Write-Host "`n[4/5] Starting services..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" "cd $DeployPath && docker compose -f docker-compose.prod.yml up -d"

# Step 5: Verify
Write-Host "`n[5/5] Verifying..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" "cd $DeployPath && docker compose -f docker-compose.prod.yml ps"

Write-Host "`nServices live at:" -ForegroundColor Green
Write-Host "  • API:   http://194.164.151.202:3016" -ForegroundColor Yellow
Write-Host "  • Menu:  http://194.164.151.202:3017" -ForegroundColor Yellow
Write-Host "  • Admin: http://194.164.151.202:3018" -ForegroundColor Yellow
