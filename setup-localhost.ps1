# Milestones Coffee - Automated Localhost Setup (Windows PowerShell)
# Run this script from project root: .\setup-localhost.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Milestones Coffee - Localhost Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js v18+" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Node.js $(node --version)" -ForegroundColor Green

# Check pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  pnpm not found. Installing globally..." -ForegroundColor Yellow
    npm install -g pnpm@8
}
Write-Host "✓ pnpm $(pnpm --version)" -ForegroundColor Green

# Check Docker (optional)
$hasDocker = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "✓ Docker $(docker --version)" -ForegroundColor Green
    $hasDocker = $true
} else {
    Write-Host "⚠️  Docker not found - will use local database services" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
pnpm install

Write-Host ""
Write-Host "🗄️  Starting database services..." -ForegroundColor Yellow

if ($hasDocker) {
    Write-Host "  Starting Docker containers..." -ForegroundColor Cyan
    docker compose up -d
    Start-Sleep -Seconds 5

    # Check if services are healthy
    $postgresHealthy = $false
    $redisHealthy = $false

    for ($i = 1; $i -le 30; $i++) {
        if ($postgresHealthy -eq $false) {
            $psql = docker exec milestones-postgres pg_isready -U milestones_user -d milestones_coffee 2>&1
            if ($psql -match "accepting connections") {
                $postgresHealthy = $true
                Write-Host "  ✓ PostgreSQL ready" -ForegroundColor Green
            }
        }

        if ($redisHealthy -eq $false) {
            $redis = docker exec milestones-redis redis-cli ping 2>&1
            if ($redis -match "PONG") {
                $redisHealthy = $true
                Write-Host "  ✓ Redis ready" -ForegroundColor Green
            }
        }

        if ($postgresHealthy -and $redisHealthy) {
            break
        }

        if ($i -eq 30) {
            Write-Host "  ⚠️  Database services taking longer to start..." -ForegroundColor Yellow
        }

        Start-Sleep -Seconds 1
    }
} else {
    Write-Host "  ⚠️  Using local PostgreSQL and Redis (ensure they're running)" -ForegroundColor Yellow
    Write-Host "  Manual steps required:" -ForegroundColor Cyan
    Write-Host "    1. Start PostgreSQL service" -ForegroundColor Cyan
    Write-Host "    2. Start Redis service" -ForegroundColor Cyan
    Write-Host "    3. Press Enter to continue..." -ForegroundColor Cyan
    Read-Host
}

Write-Host ""
Write-Host "🗄️  Running database migrations..." -ForegroundColor Yellow
pnpm db:migrate

Write-Host ""
Write-Host "📝 Seeding sample data (optional)..." -ForegroundColor Yellow
$seed = Read-Host "Run database seed? (y/n)"
if ($seed -eq "y" -or $seed -eq "Y") {
    pnpm db:seed
    Write-Host "  ✓ Database seeded" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Option 1 - Run all services together:" -ForegroundColor White
Write-Host "    pnpm dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Option 2 - Run services separately:" -ForegroundColor White
Write-Host "    Terminal 1: cd packages/api && pnpm dev" -ForegroundColor Gray
Write-Host "    Terminal 2: cd packages/web-admin && pnpm dev" -ForegroundColor Gray
Write-Host "    Terminal 3: cd packages/web-menu && pnpm dev" -ForegroundColor Gray
Write-Host ""
Write-Host "📱 Access URLs:" -ForegroundColor Cyan
Write-Host "  Admin Dashboard: http://localhost:3000" -ForegroundColor White
Write-Host "  Digital Menu:    http://localhost:3002" -ForegroundColor White
Write-Host "  API Docs:        http://localhost:3001/api/docs" -ForegroundColor White
Write-Host "  Health Check:    http://localhost:3001/health" -ForegroundColor White
Write-Host ""
