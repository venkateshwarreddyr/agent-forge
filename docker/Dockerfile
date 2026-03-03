# Multi-stage build: builder compiles TypeScript, runtime is lean.
# Same image runs as API server OR SQS worker via ORCHESTRATOR_MODE env var.
#
# Non-root user (appuser) is a security baseline required in
# most enterprise container environments.

# ── Stage 1: dependency installer & TypeScript compiler ────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and compile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ src/
RUN npm run build


# ── Stage 2: lean runtime image ───────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Non-root user — prevents container breakout escalation
RUN adduser -D appuser

# Copy compiled output and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Switch to non-root
USER appuser

# Health check — ECS uses this before the task definition health check kicks in
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -q --spider http://localhost:3000/health || exit 1

EXPOSE 3000

# Entry point handles both api and worker modes via ORCHESTRATOR_MODE env var
CMD ["node", "dist/main.js"]
