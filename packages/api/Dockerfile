# Build stage
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/api/package.json ./packages/api/

# Install deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/database/ ./packages/database/
COPY packages/api/ ./packages/api/
COPY tsconfig.json ./

# Generate Prisma client
RUN pnpm --filter @milestones/database exec prisma generate

# Build API
RUN pnpm --filter @milestones/api build

# Production stage
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/database/ ./packages/database/
COPY --from=builder /app/packages/api/dist/ ./packages/api/dist/
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/.prisma/ ./node_modules/.prisma/

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "packages/api/dist/main.js"]
