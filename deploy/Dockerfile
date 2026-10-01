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

# build: instala a partir da store e empacota o servidor em um único arquivo (dist/main.js),
# já com as dependências de produção dentro.
FROM deps AS build
COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm --filter @lotg/server build

# dev (opcional): a API com recarga automática dentro do contêiner. O padrão é rodá-la no host.
FROM build AS dev
ENV NODE_ENV=development \
    PORT=3000
EXPOSE 3000
CMD ["pnpm", "--filter", "@lotg/server", "dev"]

# runtime: só o bundle e as migrações; usuário não root. O bundle dispensa node_modules,
# o que mantém a imagem pouco acima do tamanho da base.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
RUN echo '{ "name": "lotg-api", "private": true, "type": "module" }' > package.json
COPY --from=build --chown=node:node /app/packages/server/dist/main.js ./dist/main.js
COPY --chown=node:node deploy/migrations ./deploy/migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --start-interval=2s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
