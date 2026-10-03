# Milestones Coffee Platform

A full-stack coffee shop management system built with NestJS, React, TypeScript, and PostgreSQL.

## Project Structure

```
milestones-coffee/
├── packages/
│   ├── database/          # Prisma schema & database layer
│   ├── api/               # NestJS backend API
│   ├── menu-app/          # React customer menu app
│   └── admin-dashboard/   # React admin dashboard
├── .github/workflows/     # CI/CD pipelines
├── docker-compose.yml     # Docker services config
└── pnpm-workspace.yaml    # pnpm monorepo config
```

## Port Allocation

| Service | Port |
|---------|------|
| API | 3000 |
| Menu App | 5173 |
| Admin Dashboard | 5174 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Adminer | 8080 |
| Prisma Studio | 5555 |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8.15+
- Docker & Docker Compose (for database)

### Setup

1. Install dependencies:
```bash
pnpm install
```

2. Start databases:
```bash
docker-compose up -d
```

3. Initialize database:
```bash
pnpm --filter @milestones/database exec prisma migrate dev
pnpm --filter @milestones/database run seed
```

4. Generate Prisma client:
```bash
pnpm --filter @milestones/database exec prisma generate
```

### Development

Start all dev servers:
```bash
# Terminal 1: API
pnpm --filter @milestones/api dev

# Terminal 2: Menu App
pnpm --filter @milestones/menu-app dev

# Terminal 3: Admin Dashboard
pnpm --filter @milestones/admin-dashboard dev
```

### Build

```bash
pnpm build
```

### Testing

```bash
pnpm test
```

## Environment Variables

Copy `.env.example` to `.env.development` and configure for your setup.

## Docker

Build and run with Docker:
```bash
docker build -f packages/api/Dockerfile -t milestones-api .
docker run -p 3000:3000 --env-file .env.production milestones-api
```

## Database Management

### Adminer (Web UI)
Open http://localhost:8080

### Prisma Studio
```bash
pnpm --filter @milestones/database exec prisma studio
```

## Scripts

### Root Level
- `pnpm build` - Build all packages
- `pnpm lint` - Lint API code
- `pnpm test` - Run API tests

### Database Package
- `pnpm --filter @milestones/database exec prisma generate` - Generate Prisma client
- `pnpm --filter @milestones/database exec prisma migrate dev` - Run migrations
- `pnpm --filter @milestones/database run seed` - Seed database

### API Package
- `pnpm --filter @milestones/api dev` - Start dev server
- `pnpm --filter @milestones/api build` - Build for production
- `pnpm --filter @milestones/api lint` - Lint code
- `pnpm --filter @milestones/api test` - Run tests

### Frontend Packages
- `pnpm --filter @milestones/menu-app dev` - Start dev server
- `pnpm --filter @milestones/admin-dashboard dev` - Start dev server

## Deployment

### Via Docker
```bash
docker-compose up -d
docker build -f packages/api/Dockerfile -t milestones-api:latest .
docker run -d -p 3000:3000 --env-file .env.production milestones-api:latest
```

### CI/CD
GitHub Actions workflows run on push to `main` and `develop` branches.
See `.github/workflows/ci.yml` for configuration.

## Default Credentials

**Admin User:**
- Email: `admin@milestones.ae`
- Password: `admin123!`

**Branch Manager:**
- Email: `difc.manager@milestones.ae`
- Password: `manager123!`

## Support

For issues or questions, contact the development team.
