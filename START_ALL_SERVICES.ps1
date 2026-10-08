# Milestones Coffee - Complete Service Startup (Windows PowerShell)
Write-Host "---------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Milestones Coffee - Full Stack Startup" -ForegroundColor Cyan
Write-Host "---------------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

# Start PostgreSQL container
Write-Host "  ? Starting PostgreSQL (port 5432)..." -ForegroundColor Gray
docker run -d --rm `
  -p 5432:5432 `
  --name milestones-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=milestones `
  postgres:17-alpine | Out-Null

Start-Sleep -Seconds 2

# Start Redis container
Write-Host "  ? Starting Redis (port 6379)..." -ForegroundColor Gray
docker run -d --rm `
  -p 6379:6379 `
  --name milestones-redis `
  redis:8-alpine | Out-Null

Start-Sleep -Seconds 1
Write-Host ""
Write-Host "? Database services ready." -ForegroundColor Green
Write-Host ""
Write-Host "Opening terminal windows..." -ForegroundColor Yellow
Write-Host ""

# API in WSL
Write-Host "  ? Terminal 1: API Server (WSL)" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "wsl -u owner bash -c 'cd ~/msqrcode/packages/api && npm run dev'"

Start-Sleep -Seconds 2

# Menu App
Write-Host "  ? Terminal 2: Menu App (Windows)" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\packages\menu-app'; npm run dev"

Start-Sleep -Seconds 2

# Admin Dashboard in WSL
Write-Host "  ? Terminal 3: Admin Dashboard (WSL)" -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "wsl -u owner bash -c 'cd ~/msqrcode/packages/admin-dashboard && npm run dev'"

Write-Host ""
Write-Host "---------------------------------------------------------------" -ForegroundColor Green
Write-Host "  All services starting..." -ForegroundColor Green
Write-Host "---------------------------------------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Access at:" -ForegroundColor White
Write-Host "  • Admin Dashboard:  http://localhost:5174" -ForegroundColor Cyan
Write-Host "  • Menu App:         http://localhost:5173" -ForegroundColor Yellow
Write-Host "  • API:              http://localhost:3000" -ForegroundColor Green
Write-Host ""
