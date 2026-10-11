# Milestones Coffee - Full Stack Deployment Guide

## Quick Start

### Windows (PowerShell)
```powershell
# Navigate to project directory
cd C:\path\to\msqrcode

# Run startup script
.\START_ALL_SERVICES.ps1
```

### WSL/Linux
```bash
cd ~/msqrcode
chmod +x start_all_services.sh
./start_all_services.sh
```

---

## What Gets Started

| Service | Port | URL | Status |
|---------|------|-----|--------|
| Admin Dashboard | 5174 | http://localhost:5174 | ✓ Ready |
| Menu App | 5173 | http://localhost:5173 | ✓ Ready |
| API Server | 3000 | http://localhost:3000 | ✓ Ready |
| PostgreSQL | 5432 | localhost | ✓ Docker |
| Redis | 6379 | localhost | ✓ Docker |
| Adminer (DB UI) | 8080 | http://localhost:8080 | ✓ Optional |

---

## Manual Setup (Step by Step)

### Step 1: Start Database Services

**Windows (PowerShell):**
```powershell
# PostgreSQL
docker run -d --rm -p 5432:5432 --name milestones-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=milestones `
  postgres:17-alpine

# Redis
docker run -d --rm -p 6379:6379 --name milestones-redis `
  redis:8-alpine
```

**WSL:**
```bash
# PostgreSQL
docker run -d --rm -p 5432:5432 --name milestones-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=milestones \
  postgres:17-alpine

# Redis
docker run -d --rm -p 6379:6379 --name milestones-redis \
  redis:8-alpine
```

### Step 2: Start API Server (WSL Terminal)

```bash
cd ~/msqrcode/packages/api
npm run dev
```

**Expected Output:**
```
[Nest] 12345  - 10/06/2026, 9:30:00 PM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 10/06/2026, 9:30:02 PM     LOG [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] 12345  - 10/06/2026, 9:30:02 PM     LOG [RoutesResolver] AuthController {/auth}:
[Nest] 12345  - 10/06/2026, 9:30:02 PM     LOG [NestApplication] Nest application successfully started
```

### Step 3: Start Menu App (Windows PowerShell - New Terminal)

```powershell
cd $env:USERPROFILE\msqrcode\packages\menu-app
npm run dev
```

**Expected Output:**
```
  ➜  local:   http://localhost:5173/
  ➜  press h to show help
```

### Step 4: Start Admin Dashboard (WSL Terminal - New Tab/Window)

```bash
cd ~/msqrcode/packages/admin-dashboard
npm run dev
```

**Expected Output:**
```
  ➜  local:   http://127.0.0.1:5174/
  ➜  press h to show help
```

---

## Access the Application

Once all services are running, open your browser:

### Full Application Suite
- **Admin Dashboard**: http://localhost:5174
  - Manage products, categories, QR codes
  - View analytics and reports
  
- **Menu App**: http://localhost:5173
  - Customer-facing menu interface
  - QR code scanner integration
  
- **API**: http://localhost:3000
  - REST API endpoints
  - Health check: http://localhost:3000/health (if available)

### Database Management
- **Adminer**: http://localhost:8080
  - Database browser and SQL editor
  - Login: postgres / postgres
  - Server: localhost
  - Database: milestones

---

## Environment Configuration

### API Environment Variables

File: `packages/api/.env.development`

```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/milestones
REDIS_URL=redis://localhost:6379
PORT=3000
LOG_LEVEL=debug
```

### React Apps Configuration

Both Vite apps are configured in `vite.config.ts`:
- Admin Dashboard: Port 5174
- Menu App: Port 5173

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    LOCALHOST                             │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │  Admin Dashboard │  │    Menu App      │             │
│  │   (React/Vite)   │  │   (React/Vite)   │             │
│  │   Port: 5174     │  │   Port: 5173     │             │
│  └────────┬─────────┘  └────────┬─────────┘             │
│           │                      │                       │
│           └──────────┬───────────┘                       │
│                      │                                   │
│            API (NestJS, Port 3000)                      │
│                      │                                   │
│      ┌───────────────┼───────────────┐                  │
│      │               │               │                  │
│  PostgreSQL      Redis           TypeORM               │
│  (Port 5432)  (Port 6379)       Database               │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Port Already in Use

```powershell
# Find process using port
netstat -ano | findstr :5174  # For Windows

# Kill process (replace PID)
taskkill /PID <PID> /F
```

### "Cannot find module" errors

```bash
cd packages/api
pnpm install  # or npm install
```

### Database Connection Failed

1. Verify PostgreSQL is running:
```bash
docker ps | grep postgres
```

2. Test connection:
```bash
psql -h localhost -U postgres -d milestones
```

3. Verify `DATABASE_URL` in `.env.development`

### Windows Node.js Interfering with WSL

If you see UNC paths like `\\wsl.localhost\...` in errors:

1. **Option A**: Run Menu App in Windows PowerShell instead of WSL
2. **Option B**: Explicitly use WSL Node:
```bash
wsl -u owner bash -c "cd ~/msqrcode/packages/api && npm run dev"
```

### npm Workspace Protocol Errors

Use Docker Compose (includes pnpm) or ensure you're using pnpm:
```bash
npm install -g pnpm@8
pnpm install
pnpm run dev
```

---

## Stopping Services

### PowerShell
```powershell
# Stop Docker containers
docker stop milestones-postgres milestones-redis

# Stop running npm processes - use Ctrl+C in each terminal
```

### WSL/Linux
```bash
# Stop Docker containers
docker stop milestones-postgres milestones-redis

# Stop background services
jobs -p | xargs kill
```

---

## Performance Tips

1. **Use WSL** for Node.js development (faster than Windows native)
2. **Keep Docker containers running** (faster restarts)
3. **Clear node_modules** if experiencing issues:
   ```bash
   rm -rf node_modules packages/*/node_modules pnpm-lock.yaml
   pnpm install
   ```

---

## Development Workflow

### Making Changes

1. **API changes**: Modify files in `packages/api/src/`
   - Restart: Ctrl+C and `npm run dev` (watch mode auto-rebuilds)

2. **Frontend changes**: Modify in `packages/admin-dashboard/src/` or `packages/menu-app/src/`
   - Hot reload automatic (Vite)

3. **Database schema changes**: 
   - Update TypeORM entities in `packages/database/src/entities/`
   - Create migration if needed
   - Restart API

---

## Testing the Integration

### 1. Test API Health
```bash
curl http://localhost:3000/health
```

### 2. Test Database Connection
Open http://localhost:8080 and verify you can access the database

### 3. Test Frontend Connectivity
- Open Admin Dashboard: http://localhost:5174
- Open Menu App: http://localhost:5173
- Check browser console for any API connection errors

---

## Production Deployment

For production, refer to each package's specific deployment guide:
- API: `packages/api/README.md`
- Admin Dashboard: `packages/admin-dashboard/README.md`
- Menu App: `packages/menu-app/README.md`

---

## Support

For issues or questions, check:
1. Service logs in their terminal windows
2. Database status at Adminer: http://localhost:8080
3. API health: http://localhost:3000/health

---

**Generated**: 2026-10-06
**Version**: 2.0.0
