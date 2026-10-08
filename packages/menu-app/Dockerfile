# Production Dockerfile for Menu App with nginx
# Stage 1: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && npm install -g pnpm

# Copy package files
COPY pnpm-lock.yaml package.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source code
COPY packages/database ./packages/database
COPY packages/menu-app ./packages/menu-app
COPY turbo.json tsconfig.json ./

# Build application
RUN pnpm build --filter=@milestones/menu-app

# Stage 2: Runtime with nginx
FROM nginx:alpine

# Copy nginx configuration
RUN mkdir -p /etc/nginx/conf.d

# Default nginx config for SPA routing
RUN echo 'server { \
    listen 3002; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html index.htm; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Copy built application from builder
COPY --from=builder /app/packages/menu-app/dist /usr/share/nginx/html

# Expose port
EXPOSE 3002

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
