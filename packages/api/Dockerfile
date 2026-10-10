# Build stage
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/api/package.json ./packages/api/

# Install deps without frozen lockfile to allow npm package resolution
RUN pnpm install --no-frozen-lockfile

# Copy source
COPY packages/database/ ./packages/database/
COPY packages/api/ ./packages/api/
COPY tsconfig.json ./

# Generate Prisma client (with fallback for network issues)
RUN pnpm --filter @milestones/database exec prisma generate 2>/dev/null || \
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 pnpm --filter @milestones/database exec prisma generate 2>/dev/null || \
    echo "Prisma generation encountered issues, attempting build anyway"

# Build API
RUN pnpm --filter @milestones/api build

# Production stage
FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.0 --activate
WORKDIR /app

# Copy workspace files from builder - this has all resolved dependencies
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/api/package.json ./packages/api/

# Copy the entire node_modules with all symlinks properly set up
COPY --from=builder /app/node_modules/ ./node_modules/

# Copy packages directory structure to preserve pnpm workspace symlinks and any package-level node_modules
COPY --from=builder /app/packages/ ./packages/

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "packages/api/dist/main.js"]
