# Build stage
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/admin-dashboard/package.json ./packages/admin-dashboard/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/admin-dashboard/ ./packages/admin-dashboard/
COPY tsconfig.json ./

# Build app
RUN pnpm --filter @milestones/admin-dashboard build

# Production stage - use nginx to serve
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Copy nginx config
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

# Copy built app
COPY --from=builder /app/packages/admin-dashboard/dist/ .

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/index.html || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
