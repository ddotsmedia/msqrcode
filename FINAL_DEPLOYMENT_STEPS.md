# Final Deployment Steps - Milestones Coffee

## Current Status
✅ PostgreSQL running in Docker (port 5432)
✅ Redis running in Docker (port 6379)
✅ Menu App running (port 5174)
✅ API Docker container started (port 3000)
⏳ Admin Dashboard - needs pnpm cleanup

## Step 1: Clean Admin Dashboard (One-time fix)

**In PowerShell (from project root `D:\path\to\msqrcode`):**

```powershell
cd packages/admin-dashboard
pnpm store prune
Remove-Item -Recurse -Force node_modules
Remove-Item pnpm-lock.yaml -ErrorAction SilentlyContinue
pnpm install
cd ../..
```

## Step 2: Start Admin Dashboard

**Open new PowerShell window and run:**

```powershell
cd packages/admin-dashboard
pnpm dev
```

You should see:
```
VITE v6.0.0  ready in XXX ms

➜  Local:   http://localhost:5174/
```

## Step 3: Verify All Services Running

**In a new PowerShell window, run this verification script:**

```powershell
# Check all services
Write-Host "Checking Milestones Coffee Services..." -ForegroundColor Green
Write-Host ""

# Check Menu App
Try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 2
    Write-Host "✓ Menu App (5173): Running" -ForegroundColor Green
} Catch {
    Write-Host "✗ Menu App (5173): Not responding" -ForegroundColor Red
}

# Check Admin Dashboard
Try {
    $response = Invoke-WebRequest -Uri "http://localhost:5174" -UseBasicParsing -TimeoutSec 2
    Write-Host "✓ Admin Dashboard (5174): Running" -ForegroundColor Green
} Catch {
    Write-Host "✗ Admin Dashboard (5174): Not responding" -ForegroundColor Red
}

# Check API
Try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
    Write-Host "✓ API (3000): Running" -ForegroundColor Green
} Catch {
    Write-Host "✗ API (3000): Not responding" -ForegroundColor Red
}

# Check Database
Try {
    $response = docker ps --filter "name=milestones-postgres" --format "table {{.Status}}"
    if ($response) {
        Write-Host "✓ PostgreSQL (5432): Running in Docker" -ForegroundColor Green
    }
} Catch {
    Write-Host "✗ PostgreSQL: Not running" -ForegroundColor Red
}

# Check Redis
Try {
    $response = docker ps --filter "name=milestones-redis" --format "table {{.Status}}"
    if ($response) {
        Write-Host "✓ Redis (6379): Running in Docker" -ForegroundColor Green
    }
} Catch {
    Write-Host "✗ Redis: Not running" -ForegroundColor Red
}

Write-Host ""
Write-Host "All services ready for development!" -ForegroundColor Green
```

## Service Endpoints

Once all services are running:

| Service | URL | Purpose |
|---------|-----|---------|
| Menu App | http://localhost:5173 | Customer QR scanner & menu |
| Admin Dashboard | http://localhost:5174 | Admin analytics & management |
| API | http://localhost:3000 | Backend services |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |

## Troubleshooting

**If Admin Dashboard fails to start:**
1. Make sure PostgreSQL and Redis are running: `docker ps`
2. Completely close the pnpm dev server (Ctrl+C)
3. Repeat Step 1 cleanup commands
4. Try `pnpm install` again

**If API shows 500 errors:**
- Check API logs in Docker: `docker logs <container_id>`
- Verify DATABASE_URL is correct in API container

**If ports are already in use:**
```powershell
# Kill process on specific port
netstat -ano | findstr :<port>
taskkill /PID <PID> /F
```

## Development Workflow

1. **File changes auto-reload** in Menu App and Admin Dashboard (hot reload)
2. **API changes** require container restart: `docker restart <api_container_id>`
3. **Database changes** require migration or schema reset in PostgreSQL container

---

**Deployment Date:** October 6, 2026
**Configuration:** pnpm monorepo with Turbo, Docker Compose, Vite dev servers
