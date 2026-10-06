# Milestones Coffee - Complete Service Startup Script (Windows PowerShell)
# This script starts all three services simultaneously

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Milestones Coffee - Full Stack Startup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Define project directory
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

# Check if Docker is available
$dockerAvailable = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerAvailable = $true
    Write-Host "✓ Docker found" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting PostgreSQL & Redis..." -ForegroundColor Yellow

# Start PostgreSQL container
Write-Host "  → Starting PostgreSQL (port 5432)..." -ForegroundColor Gray
docker run -d --rm `
  -p 5432:5432 `
  --name milestones-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=milestones `
  postgres:17-alpine | Out-Null

Start-Sleep -Seconds 2

# Start Redis container
Write-Host "  → Starting Redis (port 6379)..." -ForegroundColor Gray
docker run -d --rm `
  -p 6379:6379 `
  --name milestones-redis `
  redis:8-alpine | Out-Null

Start-Sleep -Seconds 1

Write-Host ""
Write-Host "Database services ready." -ForegroundColor Green
Write-Host ""

# Create new PowerShell windows for each service
Write-Host "Opening terminal windows for API and Menu App..." -ForegroundColor Yellow
Write-Host ""

# Terminal 1: API in WSL
Write-Host "  → Terminal 1: API Server (WSL/WSL2)" -ForegroundColor Cyan
$apiCmd = 'wsl -u owner bash -c "cd ~/msqrcode/packages/api && npm run dev"'
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'API Server (NestJS)' -ForegroundColor Cyan; Write-Host 'Starting...'; $apiCmd" -WindowStyle Normal

Start-Sleep -Seconds 2

# Terminal 2: Menu App (Windows Native)
Write-Host "  → Terminal 2: Menu App Server (Windows)" -ForegroundColor Yellow
$menuCmd = 'cd $env:USERPROFILE\msqrcode\packages\menu-app; npm run dev'
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Menu App (Vite)' -ForegroundColor Yellow; Write-Host 'Starting...'; $menuCmd" -WindowStyle Normal

Start-Sleep -Seconds 2

# Terminal 3: Admin Dashboard (WSL)
Write-Host "  → Terminal 3: Admin Dashboard (WSL/WSL2)" -ForegroundColor Magenta
$adminCmd = 'wsl -u owner bash -c "cd ~/msqrcode/packages/admin-dashboard && npm run dev"'
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Admin Dashboard (Vite)' -ForegroundColor Magenta; Write-Host 'Starting...'; $adminCmd" -WindowStyle Normal

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  All services started! Waiting for startup..." -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Services will be available at:" -ForegroundColor White
Write-Host "  • Admin Dashboard:  http://localhost:5174" -ForegroundColor Cyan
Write-Host "  • Menu App:         http://localhost:5173" -ForegroundColor Yellow
Write-Host "  • API:              http://localhost:3000" -ForegroundColor Green
Write-Host "  • Database (Adminer): http://localhost:8080" -ForegroundColor Gray
Write-Host ""
Write-Host "Check the individual terminal windows for live logs." -ForegroundColor White
Write-Host "Press Ctrl+C in any terminal to stop that service." -ForegroundColor Gray
Write-Host ""
Write-Host "Note: Close this window to close all services." -ForegroundColor Gray
