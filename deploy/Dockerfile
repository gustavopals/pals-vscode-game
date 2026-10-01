# syntax=docker/dockerfile:1

# Imagens do jogo. Contexto de build: a raiz do repositório.
#   docker build -f deploy/Dockerfile --target runtime -t lotg-api:latest .       # a API
#   docker build -f deploy/Dockerfile --target web -t lotg-web:latest .           # o app web + Caddy
#   docker build -f deploy/Dockerfile --target landing -t lotg-landing:latest .   # a página de apresentação + Caddy
# `runtime` é o último alvo de propósito: é o que sai de um build sem `--target`.
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

# web-build: os arquivos estáticos do app web (packages/web/dist), com hash no nome.
FROM build AS web-build
RUN pnpm --filter @lotg/web build

# landing-build: os arquivos estáticos da página de apresentação (packages/landing/dist).
# Os endereços do jogo e da página têm padrão no pacote (src/site.ts); `--build-arg` os troca.
FROM build AS landing-build
ARG LOTG_GAME_URL=""
ARG LOTG_LANDING_URL=""
RUN LOTG_GAME_URL="$LOTG_GAME_URL" LOTG_LANDING_URL="$LOTG_LANDING_URL" \
  pnpm --filter @lotg/landing build

# static: o Caddy como servidor de arquivos, em HTTP na porta 80 (ADR 0009). É a base de `web`
# e de `landing`, que só acrescentam os arquivos e o Caddyfile de cada um. Quem termina o TLS
# é o proxy da plataforma.
# A imagem oficial do Caddy é Alpine; daqui só se aproveita o binário, que é estático.
FROM debian:bookworm-slim AS static
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libcap2-bin \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --create-home --home-dir /var/lib/caddy --shell /usr/sbin/nologin caddy
COPY --from=caddy:2 /usr/bin/caddy /usr/bin/caddy
# Porta 80 sem rodar como root.
RUN setcap cap_net_bind_service=+ep /usr/bin/caddy \
  && mkdir -p /data /config \
  && chown -R caddy:caddy /data /config
ENV XDG_DATA_HOME=/data \
    XDG_CONFIG_HOME=/config
USER caddy
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s --retries=3 \
  CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/80"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

# web: o app. O proxy da plataforma manda /v1 para a API, na mesma origem (ADR 0008).
FROM static AS web
COPY --from=web-build /app/packages/web/dist /srv
COPY deploy/web.Caddyfile /etc/caddy/Caddyfile

# landing: a página de apresentação, em domínio próprio (ADR 0012).
FROM static AS landing
COPY --from=landing-build /app/packages/landing/dist /srv
COPY deploy/landing.Caddyfile /etc/caddy/Caddyfile

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
