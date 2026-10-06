# Milestones Coffee - Complete Local Deployment

## Prerequisites
- Docker & Docker Compose installed (or run services natively)
- Node.js 22+ in WSL
- PostgreSQL 17 & Redis 8 (via Docker or native)

## Option A: Docker Compose (Recommended - Avoids Node Path Issues)

Run this in PowerShell or WSL:

```bash
cd ~/msqrcode
docker compose up -d
```

This starts:
- PostgreSQL at localhost:5432
- Redis at localhost:6379
- API at localhost:3000
- Adminer (DB UI) at localhost:8080

## Option B: Native Setup (No Docker)

### 1. Start PostgreSQL & Redis

Windows (PowerShell):
```powershell
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -v postgres_data:/var/lib/postgresql/data postgres:17-alpine

docker run -d -p 6379:6379 -v redis_data:/data redis:8-alpine
```

### 2. Start API Server (WSL)

```bash
cd ~/msqrcode/packages/api
npm install  # If needed
npm run dev
```

This starts the API at localhost:3000 (or the port in .env)

### 3. Start Menu App (Windows PowerShell - Avoids WSL Node Path Issues)

Open a new PowerShell window:
```powershell
cd $env:USERPROFILE\msqrcode\packages\menu-app
npm install
npm run dev
```

Menu App will run at localhost:5173

### 4. Start Admin Dashboard (WSL - Already Running)

```bash
cd ~/msqrcode/packages/admin-dashboard
npm run dev
```

Admin Dashboard runs at localhost:5174

## Port Allocation

- API: 3000
- Menu App: 5173
- Admin Dashboard: 5174
- PostgreSQL: 5432
- Redis: 6379
- Adminer: 8080

## Complete Preview Access

Once all services are running:

- **Admin Dashboard**: http://localhost:5174
- **Menu App**: http://localhost:5173
- **API Health**: http://localhost:3000/health (if available)
- **Database Manager**: http://localhost:8080

## Environment Variables

If API needs custom config, create `.env` in packages/api:

```
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/milestones
REDIS_URL=redis://localhost:6379
PORT=3000
```

## Troubleshooting

### "npm workspace protocol not supported"
→ Use Docker Compose (resolves with pnpm inside container)

### "Windows Node interfering"
→ Run each service in separate terminal/window in different environments (WSL for admin, PowerShell for menu-app)

### Port already in use
→ Change port in .env or specify `--port` flag in dev command
