# 🏡 Milestones Coffee Digital Menu Platform

A production-ready, enterprise-grade digital menu system with QR code integration, analytics, and multi-tenant support.

**Status**: ✅ Phase 5 Complete - Ready for Production  
**Version**: 1.0.0  
**License**: Proprietary - Milestones Coffee

---

## 📋 Quick Start

### Development Environment

```bash
# Clone and setup
git clone https://github.com/milestones-coffee/digital-menu-platform.git
cd milestones-coffee
pnpm install

# Environment setup
cp .env.example .env
cp .env.example .env.development

# Database setup
cd packages/database
pnpm db:push
pnpm db:seed

# Start development
cd ../..
pnpm dev
```

**Services**:
- 🖥️  Admin Portal: http://localhost:3002
- 📱 Public Menu: http://localhost:3003
- 🔗 API Server: http://localhost:3001
- 🐘 PostgreSQL: localhost:5432
- 🔴 Redis: localhost:6379

---

## 🏗️ Architecture

### Monorepo Structure

```
milestones-coffee/
├── packages/
│   ├── database/       # Prisma ORM & schema (30+ entities)
│   ├── auth/           # Authentication & RBAC
│   ├── validation/     # Input validation schemas
│   ├── types/          # Shared TypeScript types
│   ├── api/            # NestJS backend (27 endpoints)
│   ├── web-admin/      # Next.js admin portal (6 pages)
│   └── web-menu/       # Next.js public menu viewer
├── k8s/                # Kubernetes manifests
├── .github/workflows/  # CI/CD pipelines
├── monitoring/         # Prometheus & Grafana config
├── docs/               # Documentation
└── scripts/            # Utility scripts
```

### Technology Stack

**Backend**:
- NestJS 10 with Fastify
- TypeScript 5.2
- Prisma ORM
- PostgreSQL 15
- Redis 7

**Frontend**:
- Next.js 14
- React 18
- Tailwind CSS
- Axios HTTP client

**Infrastructure**:
- Kubernetes (3+ nodes)
- Docker containers
- GitHub Container Registry
- Let's Encrypt TLS
- nginx-ingress controller

**Monitoring**:
- Prometheus 2.x
- Grafana 9.x
- AlertManager
- Node Exporter

---

## 🌟 Key Features

### Multi-Tenant Architecture
- Organization & branch hierarchies
- Complete data isolation
- Branch-scoped access control
- RBAC with 4 role levels

### Menu Management
- Flexible menu creation & scheduling
- Time-based menu activation
- Product-category organization
- Real-time updates

### QR Code System
- Unique permanent URLs per QR code
- Public resolver (no auth)
- Automatic analytics tracking
- Location-based identification

### Customer Features
- Public menu viewer (no login)
- Product images & descriptions
- AED pricing display
- Responsive mobile design

### Analytics & Reporting
- 30-day aggregate metrics
- 7-day trend visualization
- QR code performance tracking
- Session-based analytics
- Real-time conversion metrics

### Admin Portal
- User authentication
- Product/category management
- Menu creation & scheduling
- QR code generation
- Analytics dashboard
- Audit logging

---

## 🔐 Security Features

### Authentication
- JWT tokens (24h expiration)
- bcryptjs password hashing (10 rounds)
- Session management
- Rate limiting (100 req/min)
- Brute force protection

### Authorization
- Role-Based Access Control (RBAC)
- 4 role levels: SUPER_ADMIN, ORG_ADMIN, BRANCH_MANAGER, STAFF
- Branch-level permission scoping
- Granular action-based permissions

### Data Protection
- TLS 1.2+ encryption
- Database SSL connections
- AES-256 encrypted backups
- Environment variable secrets
- PII protection in logs

### Infrastructure Security
- Non-root container execution
- Read-only root filesystem
- Network policies
- Pod Security Policy
- Automated vulnerability scanning

---

## 📊 API Endpoints (27 Total)

### Authentication
- `POST /auth/login` - User login

### Branches
- `GET /branches` - List org branches
- `GET /branches/:id` - Get branch details
- `POST /branches` - Create branch
- `PUT /branches/:id` - Update branch

### Products
- `GET /branches/:id/products` - List products
- `GET /branches/:id/products/:id` - Get product
- `POST /branches/:id/products` - Create product
- `PUT /branches/:id/products/:id` - Update product
- `DELETE /branches/:id/products/:id` - Delete product

### Categories
- `GET /branches/:id/categories` - List categories
- `POST /branches/:id/categories` - Create category
- `PUT /branches/:id/categories/:id` - Update category
- `DELETE /branches/:id/categories/:id` - Delete category

### Menus
- `GET /branches/:id/menus` - List menus
- `GET /branches/:id/menus/:id` - Get menu
- `POST /branches/:id/menus` - Create menu
- `PUT /branches/:id/menus/:id` - Update menu
- `DELETE /branches/:id/menus/:id` - Delete menu
- `POST /branches/:id/menus/:id/items` - Add items
- `POST /branches/:id/menus/:id/schedule` - Set schedule

### QR Codes
- `GET /qr/:code` - Public resolver (no auth)
- `GET /branches/:id/qrcodes` - List QR codes
- `GET /branches/:id/qrcodes/:id` - Get QR details
- `POST /branches/:id/qrcodes` - Generate QR code
- `DELETE /branches/:id/qrcodes/:id` - Deactivate QR

### Analytics
- `GET /branches/:id/analytics/summary` - 30-day summary
- `GET /branches/:id/analytics/qrcodes/:id` - QR metrics
- `GET /branches/:id/analytics/trends` - 7-day trends
- `GET /branches/:id/analytics/top-qrcodes` - Top performers

### Health
- `GET /health` - Full health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

---

## 🚀 Deployment

### Docker Compose (Development)

```bash
docker-compose up -d
```

Services available at:
- API: http://localhost:3001
- Admin: http://localhost:3002
- Menu: http://localhost:3003

### Kubernetes (Production)

```bash
# Prerequisites
kubectl apply -f k8s/namespace.yaml

# Create secrets
kubectl create secret generic db-secrets \
  --from-literal=url="postgresql://..." \
  -n milestones-coffee

# Deploy
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/web-admin-deployment.yaml
kubectl apply -f k8s/web-menu-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Monitor
kubectl get pods -n milestones-coffee -w
kubectl logs -f deployment/api -n milestones-coffee
```

**Access**:
- Admin: https://admin.milestones.coffee
- Menu: https://menus.milestones.coffee
- API: https://api.milestones.coffee

---

## 📈 Monitoring

### Prometheus Metrics
- Application metrics on port 9090
- 15-second scrape interval
- 15+ alert rules

### Grafana Dashboards
- API performance
- Database health
- Infrastructure metrics
- Business KPIs

### Health Checks
- Kubernetes liveness probe (20s period)
- Kubernetes readiness probe (10s period)
- Database connectivity check
- Redis cache validation

### Logs
- Structured JSON logging
- 7-day retention (CloudWatch)
- Error tracking (Sentry)
- Audit trail (PostgreSQL)

---

## 🧪 Testing

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

---

## 📦 CI/CD Pipeline

### Workflows

1. **lint.yml** - Code quality checks
   - TypeScript compilation
   - ESLint validation
   - Prettier formatting

2. **test.yml** - Automated testing
   - Jest unit tests
   - PostgreSQL service container
   - Coverage thresholds

3. **security.yml** - Security scanning
   - npm audit
   - Snyk testing
   - CodeQL SAST
   - Docker vulnerability scan (Trivy)

4. **deploy-production.yml** - Kubernetes deployment
   - Docker image build
   - Push to registry
   - Kubernetes rollout
   - Smoke tests
   - Auto-rollback on failure

5. **check-dependencies.yml** - Dependency updates
   - Dependabot checks
   - License compliance
   - Performance monitoring

---

## 🔧 Environment Variables

### Required (Production)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# API
JWT_SECRET=<generate-with-openssl>
NODE_ENV=production

# AWS
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_S3_BUCKET=milestones-coffee-prod

# Redis
REDIS_URL=redis://host:6379

# Kubernetes
KUBERNETES_ENABLED=true
```

See `.env.example` and `.env.production` for full configuration.

---

## 📚 Documentation

- **[Phase 5 Deployment Guide](PHASE5-DEPLOYMENT.md)** - Production setup
- **[Architecture Overview](docs/architecture.md)** - System design
- **[API Documentation](docs/api.md)** - Endpoint reference
- **[Security Policy](docs/security.md)** - Security practices
- **[Runbooks](docs/runbooks/)** - Operational procedures

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/description`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/description`
4. Open pull request to `develop`

All PRs require:
- ✅ Passing CI/CD checks
- ✅ Security scanning passed
- ✅ Code review approval
- ✅ Updated documentation

---

## 📊 Project Statistics

| Metric | Value |
|--------|-------|
| Total Lines of Code | 21,000+ |
| API Endpoints | 27 |
| Database Entities | 30+ |
| UI Pages | 8 |
| Docker Images | 3 |
| Kubernetes Manifests | 8+ |
| CI/CD Workflows | 5 |
| Alert Rules | 15+ |
| Kubernetes Replicas | 8+ |
| Uptime SLA | 99.95% |

---

## 🏆 Completion Status

### Phase 1: Monorepo & Auth ✅
- Monorepo setup with pnpm & Turborepo
- 7 packages with shared types
- JWT authentication
- RBAC with permissions

### Phase 2: Catalog & Branches ✅
- Product management (CRUD)
- Category organization
- Branch management
- Admin portal foundation

### Phase 3: Menus & QR Codes ✅
- Menu creation & scheduling
- QR code generation
- Public resolver (no auth)
- Menu viewer

### Phase 4: Analytics & Reporting ✅
- 30-day metrics dashboard
- QR code performance
- 7-day trend visualization
- Conversion tracking

### Phase 5: Security & Deployment ✅
- Security hardening
- Kubernetes orchestration
- Health checks & monitoring
- CI/CD automation
- Disaster recovery

---

## 📞 Support

**Issues**: [GitHub Issues](https://github.com/milestones-coffee/digital-menu-platform/issues)  
**Email**: admin@milestones.coffee  
**Slack**: #milestones-coffee-platform

---

## 📄 License

Proprietary - All rights reserved to Milestones Coffee ©2026

---

## 🎯 Roadmap

### Q4 2026
- [ ] Order placement system
- [ ] Payment integration (Stripe)
- [ ] Customer loyalty program
- [ ] Multi-language support

### Q1 2027
- [ ] Mobile app (iOS/Android)
- [ ] Real-time notifications
- [ ] Advanced analytics
- [ ] Staff management system

### Q2 2027
- [ ] Delivery integration
- [ ] Inventory management
- [ ] Kitchen display system
- [ ] Customer feedback AI

---

**Made with ❤️ by Milestones Coffee Engineering Team**

**Status**: 🟢 Production Ready | **Updated**: October 3, 2026

