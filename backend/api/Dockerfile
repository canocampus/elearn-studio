# R-10 fix: build context is the repo root (set in docker-compose) so the root
# pnpm-lock.yaml is available for reproducible, frozen installs.
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy root lockfile + workspace manifest + base tsconfig first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/api/package.json ./backend/api/package.json
# Workspace dep: scorm-packager (pre-built dist needed for types + runtime)
COPY packages/scorm-packager/package.json ./packages/scorm-packager/package.json
COPY packages/scorm-packager/dist ./packages/scorm-packager/dist

RUN pnpm install --filter @elearn-studio/api --frozen-lockfile

COPY backend/api/tsconfig.json ./backend/api/tsconfig.json
COPY backend/api/src ./backend/api/src

WORKDIR /app/backend/api
RUN pnpm build

# pnpm deploy: creates a self-contained dir with flattened node_modules (no workspace symlinks)
WORKDIR /app
RUN pnpm --filter @elearn-studio/api deploy --prod /app/deploy

# --- runner ---
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/deploy/node_modules ./node_modules
COPY --from=builder /app/backend/api/dist ./dist
COPY backend/api/package.json ./
# Pre-built runtime-player bundle — referenced via PLAYER_JS_PATH env var
COPY packages/runtime-player/dist/player.js ./player.js

ENV PLAYER_JS_PATH=/app/player.js

EXPOSE 3001
CMD ["node", "dist/index.js"]
