# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/api/package.json packages/api/tsconfig.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Add SES SDK (dynamically imported by email service)
RUN cd packages/api && pnpm add @aws-sdk/client-ses

# Copy source
COPY packages/shared/src ./packages/shared/src
COPY packages/api/src ./packages/api/src

# Build shared package
RUN cd packages/shared && pnpm run build

# ─── Runtime Stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy built artifacts and node_modules
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/api ./packages/api
COPY --from=builder /app/node_modules ./node_modules

# Install production dependencies only (keep tsx for runtime)
RUN pnpm install --frozen-lockfile --prod && pnpm add tsx -w

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Use tsx to run TypeScript directly (simpler than compiling)
CMD ["npx", "tsx", "packages/api/src/server.ts"]
