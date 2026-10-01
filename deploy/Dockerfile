# syntax=docker/dockerfile:1

# Imagem da API (MVP-ROADMAP.md F0-T4). Contexto de build: a raiz do repositório.
#   docker build -f deploy/Dockerfile --target runtime -t lotg-api:latest .
# Base glibc (bookworm-slim), a mesma em build e runtime; nunca Alpine.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# deps: baixa para a store tudo que o lockfile pede; só invalida quando o lockfile muda.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm config set store-dir /pnpm/store && pnpm fetch

# build: instala a partir da store, compila o servidor e isola o pacote com dependências de produção.
FROM deps AS build
COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm --filter "@lotg/server..." build
RUN pnpm --filter @lotg/server deploy --prod /out && mkdir -p /out/node_modules

# dev (opcional): a API com recarga automática dentro do contêiner. O padrão é rodá-la no host.
FROM build AS dev
ENV NODE_ENV=development \
    PORT=3000
EXPOSE 3000
CMD ["pnpm", "--filter", "@lotg/server", "dev"]

# runtime: só dist/, node_modules de produção e as migrações; usuário não root.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
COPY --chown=node:node deploy/migrations ./deploy/migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
