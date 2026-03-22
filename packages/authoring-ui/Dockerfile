# R-04 fix: use pnpm via corepack (matches monorepo toolchain and backend Dockerfile)
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src

RUN pnpm exec vite build

# --- runner ---
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
