# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including dev) for the build
COPY package*.json ./
RUN npm ci

# Copy source code and config
COPY tsconfig.json .swcrc ./
COPY src ./src

# Compile with swc (fast, no OOM) then rewrite path aliases
RUN node_modules/.bin/swc src -d dist --copy-files --strip-leading-paths && node_modules/.bin/tsc-alias

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application (path aliases already rewritten by tsc-alias)
CMD ["node", "dist/main.js"]
