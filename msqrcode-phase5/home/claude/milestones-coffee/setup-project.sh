#!/bin/bash
set -e

# Create root package.json
cat > package.json << 'EOF'
{
  "name": "@milestones/root",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@8.0.0",
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "clean": "turbo run clean && rm -rf node_modules",
    "security:audit": "pnpm audit --audit-level=moderate",
    "security:check": "snyk test --severity-threshold=high"
  },
  "pnpm": {
    "workspaces": ["packages/*"]
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "prettier": "^3.0.0",
    "typescript": "^5.2.0",
    "@types/node": "^20.0.0"
  }
}
EOF

# Create turbo.json
cat > turbo.json << 'EOF'
{
  "extends": ["//"],
  "globalDependencies": ["**/.env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "outputs": ["coverage/**"],
      "cache": false
    },
    "lint": {
      "cache": false
    }
  }
}
EOF

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist"
  }
}
EOF

# Create directory structure
mkdir -p packages/{database,auth,validation,types,api,web-menu,web-admin}
mkdir -p .github/workflows
mkdir -p k8s
mkdir -p monitoring/prometheus
mkdir -p monitoring/grafana
mkdir -p scripts
mkdir -p docs

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
dist/
.next/
.env
.env.*.local
*.log
.DS_Store
.turbo/
coverage/
.vscode/
.idea/
*.swp
*.swo
pnpm-lock.yaml
EOF

# Create .env.example
cat > .env.example << 'EOF'
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/milestones_coffee"

# API
API_PORT=3001
API_HOST=0.0.0.0
NODE_ENV=development

# JWT
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRATION="24h"

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=milestones-coffee-images
AWS_CLOUDFRONT_URL=https://images.milestones.coffee

# Redis
REDIS_URL=redis://localhost:6379

# Organization (for seed)
ORG_NAME="Milestones Coffee"
ORG_EMAIL="admin@milestones.coffee"

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true

# Security
RATE_LIMIT=100
CORS_ORIGIN=http://localhost:3002,http://localhost:3003
EOF

echo "✓ Project structure created"
