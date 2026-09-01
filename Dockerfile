# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------
FROM node:20-bookworm AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Build (API bundle + Vite static web)
# -----------------------------------------------------------------------------
FROM deps AS build

RUN pnpm --filter @workspace/api-server run build \
  && pnpm --filter @workspace/aced-web run build

# -----------------------------------------------------------------------------
# Production runtime (single container: API + static web on PORT)
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN groupadd --system aced \
  && useradd --system --gid aced --create-home --home-dir /app aced

COPY --from=build --chown=aced:aced /app/pnpm-workspace.yaml ./
COPY --from=build --chown=aced:aced /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build --chown=aced:aced /app/artifacts/aced-web/dist/public ./artifacts/aced-web/dist/public
COPY --from=build --chown=aced:aced /app/storage/.gitkeep ./storage/.gitkeep

USER aced

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/api/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

# -----------------------------------------------------------------------------
# Tools image (db push, seed) — full workspace + node_modules
# -----------------------------------------------------------------------------
FROM build AS tools

WORKDIR /app

CMD ["pnpm", "--version"]
