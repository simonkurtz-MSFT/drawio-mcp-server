# Build stage
FROM node:lts-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript project
RUN pnpm run build

# Prune dev dependencies
RUN pnpm prune --prod

# ---------------------------------------------------------------

# Production stage
FROM node:lts-alpine AS production

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only production artifacts
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/build ./build
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

USER nodejs

# 3333: WebSocket for browser extension
# 3000: HTTP for MCP clients (Streamable HTTP at /mcp)
EXPOSE 3333 3000

ENTRYPOINT ["node", "build/index.js"]
# Enable HTTP transport by default for containerized deployments
CMD ["--transport", "http"]
