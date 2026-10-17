# Build stage
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Copy workspace config and all package.json files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .pnpmfile.cjs ./
COPY packages/admin-dashboard/package.json ./packages/admin-dashboard/
COPY packages/api/package.json ./packages/api/
COPY packages/database/package.json ./packages/database/
COPY packages/menu-app/package.json ./packages/menu-app/

# Install dependencies using the committed lockfile (same as CI and the API image)
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
# Pages and sw.js revalidate on every visit so a deploy shows at once; hashed /assets/ files are cached for a year.
RUN echo 'server { listen 80; root /usr/share/nginx/html; location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; } location / { add_header Cache-Control "no-cache"; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

# Copy built app
COPY --from=builder /app/packages/admin-dashboard/dist/ .

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/index.html || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
