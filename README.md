# Lords of the Guild

[![CI](https://github.com/gustavopals/pals-vscode-game/actions/workflows/ci.yml/badge.svg)](https://github.com/gustavopals/pals-vscode-game/actions/workflows/ci.yml)

Jogo medieval de gerenciamento assíncrono jogado dentro do VS Code: um feudo que você governa nas pausas do café, onde cada semana é um ano. Motor determinístico em TypeScript, servidor Fastify + PostgreSQL autoritativo e extensão do VS Code como cliente.

- Especificação: [GAME_DESIGN.md](GAME_DESIGN.md)
- Plano de execução da v0.1: [MVP-ROADMAP.md](MVP-ROADMAP.md)
- Decisões de arquitetura: [docs/decisions](docs/decisions/README.md)

> **Estado:** Fases 0 e 1 concluídas: repositório, Docker de desenvolvimento, conteúdo e motor da v0.1 e o simulador. Servidor, extensão e Webview ainda são esqueletos (Fases 2 e 3).

## Pré-requisitos

- Node 22 LTS (`nvm use` lê o `.nvmrc`)
- pnpm 9, fixado em `packageManager` e fornecido pelo Corepack (`corepack enable`)
- Docker com Compose v2 (no WSL2, manter o repositório no sistema de arquivos do Linux, nunca em `/mnt/c`)

## Começando

```bash
nvm use
pnpm install
pnpm dev:up      # bancos de desenvolvimento e de teste em Docker
pnpm verify      # lint + typecheck + testes unitários
```

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev:up` | Sobe `db` (5432) e `db_test` (5433) e espera ficarem saudáveis |
| `pnpm dev:down` | Derruba os contêineres de desenvolvimento, mantendo os volumes |
| `pnpm dev:logs` | Acompanha os logs dos contêineres de desenvolvimento |
| `pnpm db:psql` | Abre o `psql` no banco de desenvolvimento (`pnpm db:psql -c 'select 1'`) |
| `pnpm build` | Compila os pacotes que têm build |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes |
| `pnpm lint` | ESLint + Prettier (verificação); `pnpm format` corrige a formatação |
| `pnpm test` | Testes unitários e de conteúdo (Vitest) |
| `pnpm --filter @lotg/engine test` | Testes de um pacote só |
| `pnpm test:integration` | Testes contra o `db_test`; só roda com `TEST_DATABASE_URL` definido |
| `pnpm verify` | `lint` + `typecheck` + `test`: a porta de entrada de todo "pronto" |
| `UPDATE_GOLDEN=1 pnpm test` | Regrava os goldens (`__golden__/`); confira o diff antes de commitar |
| `pnpm -s sim -- --seed <s> --days 7 --strategy economico` | Bot de playtest: CSV na saída padrão, resumo na saída de erro ([como ler](packages/sim-cli/README.md)) |
| `pnpm secrets:gen` | Cria `deploy/.env` e gera os segredos que faltam, sem sobrescrever os existentes |
| `pnpm docker:build` | Constrói a imagem de produção da API (`lotg-api:latest`) |

Ainda não implementados (avisam a tarefa do roadmap que os entrega): `pnpm dev:api` (F2-T2), `pnpm db:migrate` (F2-T3) e `pnpm dev:ext` (F3-T2).

## Docker em desenvolvimento

O arquivo [deploy/docker-compose.dev.yml](deploy/docker-compose.dev.yml) define:

| Serviço | Porta | Observação |
|---|---|---|
| `db` | 5432 | banco `lotg`, usuário e senha `lotg`, volume `lotg_db_dev` |
| `db_test` | 5433 | banco `lotg_test` em `tmpfs`: some a cada reinício do contêiner |
| `api` (`--profile full`) | 3000 | a API na imagem de produção, para testar a paridade |
| `pgweb` (`--profile tools`) | 8081 | inspeção visual do banco |

As portas são publicadas só em `127.0.0.1`. A API roda **no host** durante o desenvolvimento ([ADR 0001](docs/decisions/0001-api-no-host-em-dev.md)); o perfil `full` existe para validar a imagem:

```bash
docker compose -f deploy/docker-compose.dev.yml --profile full up -d
docker compose -f deploy/docker-compose.dev.yml --profile tools up -d pgweb
```

Variáveis de ambiente: copie [deploy/.env.example](deploy/.env.example) para `deploy/.env` ou rode `pnpm secrets:gen`. `JWT_SECRET` e `RECOVERY_CODE_SECRET` são independentes; trocar o segundo invalida todos os Códigos do Reino já emitidos.

> Nunca rode `docker compose down -v` fora do ambiente de desenvolvimento: `-v` apaga os volumes do banco.

## Estrutura

```
packages/
  engine/       @lotg/engine       motor puro e determinístico
  content/      @lotg/content      números e textos de jogo + schemas
  protocol/     @lotg/protocol     contratos da API /v1
  server/       @lotg/server       Fastify + PostgreSQL
  client-sdk/   @lotg/client-sdk   cliente HTTP tipado
  sim-cli/      @lotg/sim-cli      bots de playtest
  extension/    lords-of-the-guild extensão do VS Code
  webview/      @lotg/webview      interface em Preact
deploy/         Dockerfile, compose, variáveis de ambiente e migrações
tests/          integração entre pacotes
docs/decisions/ ADRs
```

`engine`, `content` e `protocol` não importam `vscode`, `fastify`, `pg` nem módulos do Node; o ESLint recusa a importação.
