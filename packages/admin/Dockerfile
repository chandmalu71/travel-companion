# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/admin/package.json ./packages/admin/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Copy source
COPY packages/shared/src ./packages/shared/src
COPY packages/admin/ ./packages/admin/

# Ensure public dir exists (admin panel may not have static assets)
RUN mkdir -p /app/packages/admin/public

# Build shared package first
RUN cd packages/shared && pnpm run build

# Build Next.js in standalone mode
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN cd packages/admin && pnpm run build

# ─── Runtime Stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Don't run as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/packages/admin/.next/standalone ./
COPY --from=builder /app/packages/admin/.next/static ./packages/admin/.next/static
COPY --from=builder /app/packages/admin/public ./packages/admin/public

USER nextjs

EXPOSE 3002

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

CMD ["node", "packages/admin/server.js"]
