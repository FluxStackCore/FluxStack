# FluxStack Production Dockerfile
# Multi-stage build for optimized production image

# =====================================
# Stage 1: Dependencies
# =====================================
FROM oven/bun:1.2-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install production dependencies only
RUN bun install --production --frozen-lockfile

# =====================================
# Stage 2: Builder
# =====================================
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# =====================================
# Stage 3: Production Runner
# =====================================
FROM oven/bun:1.2-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup -g 1001 -S fluxstack && \
    adduser -S fluxstack -u 1001

# Copy production dependencies from deps stage
COPY --from=deps --chown=fluxstack:fluxstack /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=fluxstack:fluxstack /app/dist ./dist
COPY --from=builder --chown=fluxstack:fluxstack /app/package.json ./

# Copy config directory (required for runtime configuration)
COPY --from=builder --chown=fluxstack:fluxstack /app/config ./config

# Switch to non-root user
USER fluxstack

# Expose application port
EXPOSE 3000

# Health check for container orchestrators
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun -e 'fetch("http://localhost:3000/api/health").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Start the application
CMD ["bun", "dist/index.js"]
