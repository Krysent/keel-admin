# ---- Stage 1: build ----
FROM node:20-alpine AS builder
WORKDIR /repo

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests first for better layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/http/package.json packages/http/
COPY packages/auth/package.json packages/auth/
COPY packages/ui/package.json packages/ui/
COPY packages/theme/package.json packages/theme/
COPY packages/i18n/package.json packages/i18n/
COPY packages/utils/package.json packages/utils/
COPY packages/types/package.json packages/types/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY tooling/vite-plugins/package.json tooling/vite-plugins/

# Install dependencies with frozen lockfile for deterministic builds
RUN pnpm install --frozen-lockfile

# Copy full source
COPY . .

# Build argument to select environment mode (development/staging/production)
ARG MODE=production
RUN pnpm --filter @keel/admin build --mode ${MODE}

# ---- Stage 2: runtime ----
FROM nginx:1.27-alpine AS runtime

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /repo/apps/admin/dist /usr/share/nginx/html

EXPOSE 80

# Health check using wget (available in alpine)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
