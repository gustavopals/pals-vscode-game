# Lords of the Guild — MVP Roadmap (v0.1 "Fundação online")

> **Status:** plano de execução  
> **Versão do documento:** 1.2 (Fase 3 replanejada: o cliente passa a ser um app web com aparência de editor, [ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md))\
> **Base:** [GAME_DESIGN.md](GAME_DESIGN.md) v0.5 (seções §14, §16.1 e §18.1 são o contrato; versão do jogo: v0.1)\
> **Forma de trabalho:** desenvolvimento 100% com Claude Code, uma tarefa por sessão, Docker para banco, API e produção  
> **Idioma:** português (Brasil); identificadores de código em inglês

---

## 0. Como usar este roadmap

### 0.1 O que é o MVP

O MVP é exatamente a **v0.1 do GDD** (§16.1): um feudo com economia, construção e recrutamento que roda em um **servidor Node.js + PostgreSQL**, com **conta criada em um clique**, vínculo opcional ao GitHub ou por **Código do Reino**, e um **app web com aparência de editor de código** como cliente. O jogador abre o endereço, clica em **Jogar agora** e vê Pedra Alta crescer enquanto trabalha, de qualquer máquina.

**Entra no MVP:** motor determinístico (economia, obras, recrutamento, escassez, Objetivos 1–4, Crônica simples), servidor (auth, partidas, comandos idempotentes, eventos, job horário), app web (boas-vindas, árvore lateral, abas Hoje e Feudo, barra de status, paleta de comandos, modo sem conexão), Docker (dev e produção), backup, implantação em VPS.

**Não entra:** efeitos de estação, cartas do Conselho, heróis, exército, mapa, mercado, Temporadas, interação entre jogadores, som. Tudo isso tem fase própria a partir da v0.2 (GDD §16.2) e **não deve ser antecipado**, nem "só a estrutura".

### 0.2 Estrutura do plano

```
Fase (F0…F5)  →  Tarefa (F1-T3)  →  Subtarefa (F1-T3.2)
```

Cada tarefa traz: objetivo, seções do GDD que a governam, dependências, entregáveis (arquivos), subtarefas com caixas de seleção, **verificação** (comandos e resultado esperado), **pronto quando** (critério objetivo), tamanho estimado e um **prompt sugerido** para abrir a sessão do Claude Code.

| Tamanho | Significado |
|---|---|
| `S` | Uma sessão curta do Claude Code (30 a 60 min de trabalho do agente) |
| `M` | Uma a duas sessões; vale usar plan mode antes de codar |
| `L` | Duas a quatro sessões; dividir pelas subtarefas, uma sessão por bloco |

Estimativa total: **5 a 6 semanas** com uma a duas sessões por dia útil. A ordem das fases é obrigatória; dentro de uma fase, a ordem das tarefas respeita as dependências indicadas.

### 0.3 Ritual de cada tarefa com o Claude Code

1. **Abrir a sessão** com o prompt sugerido da tarefa (ou o modelo da §A.2). O prompt sempre pede para ler `CLAUDE.md`, as seções do GDD indicadas e a tarefa neste arquivo.
2. **Plan mode** para tarefas `M` e `L`: o agente apresenta o plano; você aprova antes de ele tocar código.
3. **Testes primeiro** onde houver regra de jogo ou contrato de API (motor, protocolo, servidor).
4. **Verificação obrigatória** antes de o agente dizer "pronto": rodar os comandos da seção "Verificação" da tarefa e `pnpm verify`. Sem saída de teste, não há tarefa concluída.
5. **Fechar a tarefa:** o agente marca as caixas desta tarefa em `MVP-ROADMAP.md`, preenche a linha no Registro de Execução (§9), registra desvios do GDD em `docs/decisions/NNNN-titulo.md` e faz **um commit** com a mensagem `F1-T3: <resumo>`.
6. **Uma tarefa por sessão.** Se sobrar contexto, encerrar e abrir outra sessão: contexto limpo produz código melhor do que contexto longo.

### 0.4 O que o Claude Code não decide sozinho

Provedor do VPS e domínio (F4-T3), registro do OAuth App do GitHub usado no vínculo de conta (F3W-T8), nome público do jogo e ícone, política de privacidade final (texto), e qualquer **desvio do GDD**. Desvios são propostos pelo agente em `docs/decisions/` e aprovados por você antes da implementação.

Os ajustes documentais de 2026-10-01 nos pontos 1–3 da revisão estão consolidados no GDD 0.4 e nos [ADRs 0003–0005](docs/decisions/README.md): recibos de comandos e avanço em recusas; histórico de refresh e revogação; ETag, HMAC de recuperação e exclusão em duas etapas. Implementar esses contratos não constitui novo desvio. Nenhuma tarefa de código foi concluída por esta revisão.

A mudança de plataforma de 2026-10-01 (extensão do VS Code → app web com aparência de editor) foi decidida por você e está no GDD 0.5 e no [ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md). O ADR lista seis pontos em que o plano adotou a opção recomendada e que você pode trocar: onde ficam os tokens no navegador, como é o vínculo com o GitHub, o destino dos pacotes da extensão, as notificações, as novas dependências e o uso da marca.

---

## 1. Decisões de ambiente e convenções

### 1.1 Docker: o que roda onde

| Componente | Desenvolvimento | Produção |
|---|---|---|
| PostgreSQL | Docker (`db` na porta 5432 e `db_test` na 5433) | Coolify (`lotg-db`, volume persistente, backup diário agendado) |
| API (Fastify) | **No host**, com `tsx watch` e depurador (`pnpm dev:api`); opcionalmente em Docker com `--profile full` para paridade | Coolify (`lotg-api`: imagem multi-stage, não root, healthcheck) |
| Proxy (TLS) | Não roda | Traefik do Coolify (certificado automático; `/v1` para a API, o resto para o app; ADR 0009) |
| App web | No host, com o servidor de desenvolvimento do Vite (`pnpm dev:web`, porta 5173), que encaminha `/v1` para a API | Coolify (`lotg-web`: Caddy servindo os arquivos estáticos em HTTP), na mesma origem da API |
| Testes unitários | No host (`vitest`) | CI |
| Testes de integração | No host contra `db_test` em Docker | CI com serviço PostgreSQL |
| Testes em navegador | No host: Playwright com Chromium sem interface, contra a API e o app locais | CI |
| `sim-cli` | No host; modo remoto aponta para a API local | Não roda |

**Por que a API roda no host no dev:** hot reload e depurador diretos, com dependências instaladas no ambiente que as executa. A imagem Docker é testada no `--profile full` e em produção; não compartilhar `node_modules` entre host e contêiner. Mantida a base `node:22-bookworm-slim` para consistência entre build e runtime. Argon2 não é necessário na v0.1: os contratos de credenciais usam `node:crypto` (F2-T4 e F2-T5).

**WSL2:** manter o repositório dentro do sistema de arquivos do Linux (ex.: `/opt/pals-vscode-game` ou `~/dev/...`), nunca em `/mnt/c`, e habilitar a integração do Docker Desktop com a distribuição WSL.

### 1.2 Portas e serviços

| Serviço | Porta | Observação |
|---|---|---|
| API | 3000 | `http://localhost:3000/v1/health` |
| App web (dev) | 5173 | `http://localhost:5173`; encaminha `/v1` para a API |
| PostgreSQL dev | 5432 | banco `lotg`, usuário `lotg` |
| PostgreSQL test | 5433 | banco `lotg_test`, recriado a cada suíte, `tmpfs` |
| pgweb (opcional, `--profile tools`) | 8081 | inspeção visual do banco |
| Proxy do Coolify (produção) | 80 e 443 | redireciona 80 para 443; a API (3000) e o app (80) só são alcançados por ele |

### 1.3 Variáveis de ambiente

| Variável | Onde | Padrão de desenvolvimento | Descrição |
|---|---|---|---|
| `PORT` | API | `3000` | Porta HTTP |
| `DATABASE_URL` | API | `postgres://lotg:lotg@localhost:5432/lotg` | Conexão principal |
| `TEST_DATABASE_URL` | testes | `postgres://lotg:lotg@localhost:5433/lotg_test` | Banco de integração |
| `JWT_SECRET` | API | gerado por `pnpm secrets:gen` | 32+ bytes aleatórios (base64) |
| `RECOVERY_CODE_SECRET` | API | gerado por `pnpm secrets:gen` | 32+ bytes aleatórios independentes (base64); decodificados para a chave HMAC dos Códigos do Reino; preservar em deploys e restaurações |
| `PUBLIC_URL` | API | `http://localhost:3000` | URL pública, usada em logs e `/version` |
| `LOG_LEVEL` | API | `debug` (prod: `info`) | pino |
| `RATE_LIMIT_PER_MINUTE` | API | `60` | por sessão |
| `ACCOUNT_CREATE_PER_HOUR_PER_IP` | API | `10` | criação de contas |
| `RECOVERY_ATTEMPTS_PER_HOUR_PER_IP` | API | `5` | tentativas de Código do Reino |
| `ADVANCE_JOB_INTERVAL_MS` | API | `60000` (prod: `3600000`) | job de avanço |
| `ADVANCE_STALE_AFTER_MS` | API | `3600000` | partida parada há mais de 1 h |
| `GITHUB_API_URL` | API | `https://api.github.com` | sobrescrito nos testes |
| `GITHUB_CLIENT_ID` | API | vazio (vínculo GitHub desligado) | Identificador público do OAuth App usado no *device flow*; não é segredo |
| `GITHUB_OAUTH_URL` | API | `https://github.com` | Origem das rotas de *device flow* do GitHub; sobrescrito nos testes |
| `TRUST_PROXY` | API | `false` (prod: `true`) | confiar em `X-Forwarded-For`; só atrás do proxy |

Preferências do app, guardadas no navegador: notificações (`silent` · `essential` · `all`), modo discreto, tema (`dark` · `light` · `high-contrast`) e Hora da Vigília (0–23, padrão 20). O app fala sempre com a própria origem: não há endereço de servidor para configurar.

### 1.4 Scripts do `package.json` raiz

| Script | Faz |
|---|---|
| `pnpm dev:up` | `docker compose -f deploy/docker-compose.dev.yml up -d db db_test` |
| `pnpm dev:down` | derruba os contêineres de dev (mantém volumes) |
| `pnpm dev:api` | `pnpm --filter @lotg/server dev` (tsx watch) |
| `pnpm dev:web` | servidor de desenvolvimento do app web (Vite, porta 5173, com proxy de `/v1`) |
| `pnpm db:migrate` | aplica migrações no banco de dev |
| `pnpm db:psql` | abre `psql` no contêiner `db` |
| `pnpm build` | compila todos os pacotes |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes |
| `pnpm lint` | ESLint + Prettier (verificação) |
| `pnpm test` | testes unitários e de conteúdo (Vitest) |
| `pnpm test:integration` | testes do servidor contra `db_test` |
| `pnpm test:e2e` | testes do app em um navegador real (Playwright), contra a API e o app locais |
| `pnpm verify` | `lint` + `typecheck` + `test` (porta de entrada de todo "pronto") |
| `pnpm sim -- --seed <s> --days 7 --strategy economico` | bot de playtest em processo |
| `pnpm secrets:gen` | gera `JWT_SECRET`, `RECOVERY_CODE_SECRET` independente e senha do banco para `.env`; não sobrescreve segredos existentes |
| `pnpm docker:build` | constrói a imagem de produção da API |

### 1.5 Estrutura do repositório (alvo ao fim do MVP)

```
lords-of-the-guild/                  (= esta pasta)
├── CLAUDE.md                        # instruções do projeto para o Claude Code (F0-T3)
├── GAME_DESIGN.md
├── MVP-ROADMAP.md
├── README.md
├── package.json · pnpm-workspace.yaml · tsconfig.base.json · vitest.workspace.ts
├── .nvmrc · .editorconfig · .gitignore · eslint.config.js · .prettierrc
├── .vscode/tasks.json                # tarefas de desenvolvimento (API e app)
├── .github/workflows/ci.yml          # opcional (F0-T5)
├── docs/
│   ├── decisions/                    # ADRs curtos: 0001-dev-api-no-host.md …
│   ├── manual-test-v0.1.md           # roteiro manual (F3W-T10)
│   └── architecture.md               # F5-T4
├── deploy/
│   ├── Dockerfile                    # multi-stage: deps → build → web · runtime
│   ├── docker-compose.dev.yml        # db, db_test, api (profile full), pgweb (profile tools)
│   ├── web.Caddyfile                 # servidor de arquivos da imagem web (produção no Coolify, ADR 0009)
│   ├── README.md                     # implantação, operação e registro dos ensaios
│   ├── .env.example
│   ├── migrations/                   # SQL versionado gerado pelo drizzle-kit
│   ├── ensaio-restauracao.yml        # serviço que ensaia a restauração de um backup
│   └── analytics/                    # consultas SQL de operação (ops.sql); agregadas de jogo na v0.2+
├── packages/
│   ├── engine/        @lotg/engine      motor puro
│   ├── content/       @lotg/content     dados + schemas zod
│   ├── protocol/      @lotg/protocol    Command, ViewState, API, erros
│   ├── server/        @lotg/server      Fastify + Drizzle
│   ├── client-sdk/    @lotg/client-sdk  cliente HTTP tipado
│   ├── sim-cli/       @lotg/sim-cli     bots de playtest
│   └── web/           @lotg/web         app web (Preact): bancada, sessão de jogo, cache
└── tests/                            # integração entre pacotes (servidor↔banco) e e2e do app em navegador real
```

### 1.6 Bibliotecas permitidas

Conforme GDD §18.1: TypeScript, esbuild, Vitest, fast-check, zod, Preact, Fastify, `pg`, Drizzle (`drizzle-orm` + `drizzle-kit`), `jose`, `pino`. Hashes, HMAC e geração de credenciais usam `node:crypto` no servidor; não instalar `argon2`. Consideram-se parte do ecossistema permitido: plugins oficiais `@fastify/*` (`rate-limit`, `sensible`, `under-pressure`), `tsx` (dev), ESLint e Prettier. Para o app web ([ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md), ponto 5): `vite` e `@preact/preset-vite` (servidor de desenvolvimento e build), `@vscode/codicons` (ícones) e `@playwright/test` (testes em navegador real). `@types/node` e `@types/pg` seguem o [ADR 0006](docs/decisions/0006-types-node.md). `@types/vscode` e `@vscode/vsce` saem junto com a extensão. **Qualquer outra dependência exige um ADR em `docs/decisions/` aprovado por você.**

### 1.7 Convenções de código e Git

- Nomes de jogo em português nas strings de interface e conteúdo; identificadores em inglês (`townHall`, `lumberMill`, `startConstruction`).
- Motor sem `Date.now()`, `Math.random()`, I/O ou importações do navegador e do Node de servidor. Teste de pureza em F1-T11.
- Nenhuma regra de jogo fora do motor; nenhum número de jogo fora de `@lotg/content`; o app web só exibe o `ViewState`.
- Commits pequenos, um por tarefa (ou por subtarefa em tarefas `L`), mensagem `F1-T3: resumo no imperativo`. O Claude Code acrescenta a linha de coautoria automaticamente.
- Branch `main` sempre verde (`pnpm verify`). Tarefas `L` em branch `f1-t5-construcoes` com merge ao final.
- Testes: `*.test.ts` ao lado do código; golden files em `__golden__/`; integração em `tests/` ou `packages/server/test/`.

---

## 2. Fase 0 — Repositório, ambiente e Docker

**Meta da fase:** qualquer pessoa (ou agente) clona, roda `pnpm install && pnpm dev:up && pnpm verify` e tem o ambiente de pé em menos de 10 minutos.

### F0-T1 · Preparar a máquina de desenvolvimento `S`

**Objetivo:** WSL2 com Docker, Node 22 e pnpm prontos.
**GDD:** §14.13 (ambiente de desenvolvimento).
**Depende de:** nada.
**Entregáveis:** nenhum arquivo no repositório; checklist cumprida.

- [x] F0-T1.1 Docker Desktop instalado com integração WSL2 habilitada para a distribuição em uso; `docker run --rm hello-world` funciona dentro do WSL.
- [x] F0-T1.2 Node 22 LTS via `nvm` (`nvm install 22 && nvm alias default 22`) e pnpm 9 via `corepack enable && corepack prepare pnpm@latest-9 --activate`.
- [x] F0-T1.3 Git configurado (`user.name`, `user.email`); VS Code com extensões ESLint, Prettier e Docker.
- [x] F0-T1.4 Repositório fica no sistema de arquivos do WSL (não em `/mnt/c`).

**Verificação:**

```bash
docker --version && docker compose version && node -v && pnpm -v && git --version
```

Esperado: Docker 24+, Compose v2, Node v22.x, pnpm 9.x.

**Pronto quando:** os quatro comandos respondem sem erro dentro do WSL.

**Prompt sugerido:** "Verifique meu ambiente WSL2 para o projeto Lords of the Guild (Docker, Node 22, pnpm 9, Git) e me diga o que falta, com os comandos para corrigir. Não instale nada sem me mostrar o comando antes."

### F0-T2 · Criar o monorepo `M`

**Objetivo:** esqueleto pnpm com os oito pacotes, TypeScript estrito, lint, Vitest e um `pnpm verify` verde.
**GDD:** §14.2.
**Depende de:** F0-T1.
**Entregáveis:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.workspace.ts`, `eslint.config.js`, `.prettierrc`, `.editorconfig`, `.gitignore`, `.nvmrc`, `packages/*/package.json`, `packages/*/tsconfig.json`, `packages/*/src/index.ts`, um teste trivial por pacote.

- [x] F0-T2.1 `git init` (se a pasta ainda não for um repositório); `.gitignore` para Node, dist, `.env`, `*.vsix`, `coverage`, `deploy/backups/`.
- [x] F0-T2.2 `pnpm-workspace.yaml` com `packages/*`; `package.json` raiz com os scripts da §1.4 (os de Docker podem apontar para arquivos que F0-T4 criará).
- [x] F0-T2.3 `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `isolatedModules`. Cada pacote estende a base.
- [x] F0-T2.4 Pacotes `@lotg/engine`, `@lotg/content`, `@lotg/protocol`, `@lotg/server`, `@lotg/client-sdk`, `@lotg/sim-cli`, `@lotg/webview` e `lords-of-the-guild` (extensão), cada um com `src/index.ts` exportando uma constante de versão e um `*.test.ts` trivial.
- [x] F0-T2.5 ESLint flat config (TypeScript, regras de importação: `engine`/`content`/`protocol` não podem importar `vscode`, `fastify`, `pg`, `node:*`) e Prettier.
- [x] F0-T2.6 `vitest.workspace.ts` com projetos `unit` (todos os pacotes) e `integration` (`tests/` e `packages/server/test/`), este último só rodando com `TEST_DATABASE_URL` definido.
- [x] F0-T2.7 `README.md` inicial com os comandos da §1.4.

**Verificação:**

```bash
pnpm install && pnpm verify
```

Esperado: lint sem erros, typecheck sem erros, 8 testes triviais verdes.

**Pronto quando:** `pnpm verify` passa em um clone limpo; a regra de lint impede `import 'vscode'` dentro de `packages/engine`.

**Prompt sugerido:** "Leia CLAUDE.md (se existir), GAME_DESIGN.md §14.2 e MVP-ROADMAP.md F0-T2. Crie o monorepo pnpm descrito, com TypeScript estrito, ESLint, Prettier e Vitest, e um teste trivial por pacote. Não implemente nada do jogo. Termine com `pnpm verify` verde e me mostre a saída."

### F0-T3 · Escrever o `CLAUDE.md` do projeto `S`

**Objetivo:** instruções permanentes que toda sessão do Claude Code lê antes de agir.
**GDD:** §14, §18.3.
**Depende de:** F0-T2.
**Entregáveis:** `CLAUDE.md`, `docs/decisions/0001-api-no-host-em-dev.md`, `docs/decisions/README.md`.

- [x] F0-T3.1 `CLAUDE.md` com as seções do modelo da §A.1: visão em cinco linhas, mapa de pacotes, comandos, regras de arquitetura, convenções, "nunca faça", ritual de conclusão (`pnpm verify`, marcar roadmap, registro de execução, commit).
- [x] F0-T3.2 Usar o índice e modelo existentes em `docs/decisions/README.md` e criar o ADR 0001 registrando a decisão da §1.1 (API no host em dev). Preservar os ADRs 0003–0005 já consolidados nesta revisão.
- [x] F0-T3.3 `.claude/settings.json` com permissões para os comandos rotineiros (`pnpm *`, `docker compose *`, `git status/diff/log`) para reduzir confirmações.

**Verificação:** abrir uma sessão nova do Claude Code e pedir "resuma as regras deste projeto"; o resumo deve citar motor puro, conteúdo como dados, `pnpm verify` e bibliotecas permitidas.

**Pronto quando:** o resumo da sessão nova bate com o conteúdo sem você corrigir nada.

**Prompt sugerido:** "Leia GAME_DESIGN.md §14 e §18.3 e MVP-ROADMAP.md §1 e §A.1. Escreva o CLAUDE.md do projeto seguindo o modelo, crie docs/decisions com o primeiro ADR e um .claude/settings.json com permissões para pnpm, docker compose e git de leitura."

### F0-T4 · Docker para desenvolvimento `M`

**Objetivo:** banco de dev e de teste em Docker, imagem da API com alvo `dev` e `runtime`, variáveis de ambiente de exemplo.
**GDD:** §14.13.
**Depende de:** F0-T2.
**Entregáveis:** `deploy/docker-compose.dev.yml`, `deploy/Dockerfile`, `deploy/.env.example`, `deploy/.dockerignore`, scripts `dev:*` funcionando.

- [x] F0-T4.1 `docker-compose.dev.yml`: serviço `db` (`postgres:16`, `POSTGRES_USER=lotg`, `POSTGRES_DB=lotg`, volume `lotg_db_dev`, healthcheck `pg_isready`), serviço `db_test` (porta 5433, `tmpfs` em `/var/lib/postgresql/data`, `fsync=off` para velocidade), serviço `api` sob `profiles: [full]` construído do `Dockerfile` alvo `runtime` com `DATABASE_URL` apontando para `db`, serviço `pgweb` sob `profiles: [tools]`.
- [x] F0-T4.2 `Dockerfile` multi-stage em `node:22-bookworm-slim`: `deps` (corepack + `pnpm fetch` com lockfile), `build` (instala, `pnpm --filter @lotg/server... build`, `pnpm deploy` para pasta isolada), `runtime` (usuário não root, só `dist/`, `node_modules` de produção e `deploy/migrations/`, `HEALTHCHECK` chamando `/v1/health`, `CMD ["node", "dist/main.js"]`). Alvo `dev` opcional com `tsx`.
- [x] F0-T4.3 `.env.example` com todas as variáveis da §1.3 e comentários; `pnpm secrets:gen` gera valores fortes e independentes para JWT, recuperação e banco, sem sobrescrever valores existentes. Documentar que trocar a chave de recuperação invalida os códigos já emitidos.
- [x] F0-T4.4 Scripts `dev:up`, `dev:down`, `dev:logs`, `db:psql`, `docker:build` no `package.json` raiz; `README.md` atualizado.

**Verificação:**

```bash
pnpm dev:up && docker compose -f deploy/docker-compose.dev.yml ps
pnpm db:psql -c 'select 1'
pnpm docker:build
```

Esperado: `db` e `db_test` com estado `healthy`; `select 1` responde; a imagem constrói (a API ainda não existe: o `CMD` pode falhar ao rodar, e isso é aceitável nesta tarefa).

**Pronto quando:** os dois bancos sobem saudáveis em menos de 30 s e a imagem constrói sem erro.

**Prompt sugerido:** "Leia MVP-ROADMAP.md §1.1 a §1.3 e F0-T4 e GAME_DESIGN.md §14.13. Crie o docker-compose.dev.yml, o Dockerfile multi-stage em node:22-bookworm-slim e o .env.example. Suba os bancos, prove com `docker compose ps` e `select 1`, e construa a imagem."

### F0-T5 · Integração contínua (opcional, recomendado) `S`

**Objetivo:** `pnpm verify` e testes de integração rodando a cada push.
**Depende de:** F0-T4.
**Entregáveis:** `.github/workflows/ci.yml`.

- [x] F0-T5.1 Job `verify`: checkout, pnpm com cache, `pnpm install --frozen-lockfile`, `pnpm verify`.
- [x] F0-T5.2 Job `integration`: serviço `postgres:16` do GitHub Actions, `TEST_DATABASE_URL`, `pnpm test:integration` (passa vazio até a Fase 2).
- [x] F0-T5.3 Job `docker`: `docker build` do alvo `runtime` (sem push).

**Verificação:** primeiro push com os três jobs verdes.

**Pronto quando:** badge de CI no `README.md` verde.

**Prompt sugerido:** "Crie o workflow de CI descrito em MVP-ROADMAP.md F0-T5 para GitHub Actions, com cache do pnpm e serviço PostgreSQL 16 para os testes de integração."


---

## 3. Fase 1 — Motor de jogo (`@lotg/engine`) e conteúdo (`@lotg/content`)

**Meta da fase:** toda a economia da v0.1 funcionando como funções puras e determinísticas, testada sem servidor nem VS Code, com um bot simulando sete dias em segundos.

**Contrato da fase (API pública do motor, fechado em F1-T11):**

```ts
createInitialState(seed: string, settings: GameSettings): GameState
nextEventAt(state: GameState): number | null                       // próximo evento discreto (ms de jogo)
advanceTo(state: GameState, gameTimeMs: number): { state: GameState; events: GameEvent[] }
applyCommand(state: GameState, command: Command, gameTimeMs: number): CommandResult
deriveViewState(state: GameState, gameTimeMs: number): ViewState
```

Regras invioláveis: funções nunca mutam a entrada; nada de `Date.now()`, `Math.random()`, I/O ou importações de `vscode`, `fastify`, `pg` ou `node:*`; todo número vem de `@lotg/content`; recursos em **milésimos inteiros**.

### F1-T1 · Conteúdo base e tipos do estado `M`

**Objetivo:** dados da v0.1 em `@lotg/content` com schemas zod, e os tipos do `GameState` no motor.
**GDD:** §5.1, §5.2, §6.1, §6.2, §12.2 (objetivos 1–4), §14.4, §14.11.
**Depende de:** F0-T2.
**Entregáveis:** `packages/content/src/{balance,buildings,objectives,chronicle,index}.ts`, `packages/content/src/schemas.ts`, `packages/content/src/content.test.ts`, `packages/engine/src/types.ts`.

- [x] F1-T1.1 `balance.ts`: população inicial 5, capacidade por nível (Habitações +5, Salão +5), recursos iniciais 180/120/65/250, taxas base 10/8/5/4 por trabalhador/h, consumo 1 comida/habitante/h, recrutamento (50 comida + 10 ouro, 20 min, fila 5), fatores de custo 1,6 (Salão 1,8) e de tempo 1,5, teto de 8 h, multiplicador de fome 0,75, reembolso de cancelamento 0,8, dia de jogo = 7.200.000 ms, estações 24/24/24/12 dias.
- [x] F1-T1.2 `buildings.ts`: `townHall`, `farm`, `lumberMill`, `quarry`, `goldMine`, `housing` com rótulo pt-BR, custo base, tempo base, nível máximo (Salão 8, demais 10), recurso produzido (quando houver), e a regra de gate `nível ≤ nível do Salão + 1`.
- [x] F1-T1.3 `objectives.ts`: objetivos 1 a 4 com condição declarativa (`workersAtLeast`, `constructionStarted`, `villagersRecruited`, `buildingLevel`) e recompensa. **Decisão v0.1:** o objetivo 4 ("Salão Nv2") recompensa +50 ouro, porque Celeiro, Armazém e Torre só existem na v0.2; registrar em `docs/decisions/0002-objetivo-4-v01.md`.
- [x] F1-T1.4 `chronicle.ts`: modelos de frase para cada tipo de evento da v0.1 (GDD Apêndice E), com placeholders `{dia}`, `{estacao}`, `{edificio}`, `{nivel}`, `{quantidade}`.
- [x] F1-T1.5 `schemas.ts` + `content.test.ts`: zod valida tudo; testes garantem custo e tempo positivos, nível máximo ≥ 2, rótulos não vazios, todo tipo de evento com modelo de frase, toda condição de objetivo conhecida.
- [x] F1-T1.6 `types.ts` no motor: `GameState` da v0.1 (subconjunto do GDD §14.11: `schemaVersion: 1`, `seed`, `settings`, `clock`, `lastProcessedAt`, `rng`, `settlement` sem campos de versões futuras, `objectives`, `stats`), `GameEvent`, `Command`, `CommandResult`, `RejectionCode`.

**Verificação:**

```bash
pnpm --filter @lotg/content test && pnpm typecheck
```

Esperado: testes de conteúdo verdes; nenhum número de jogo fora de `packages/content`.

**Pronto quando:** `grep -rn "180\|120\|65\|250" packages/engine/src` não encontra valores iniciais no motor.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.1, §5.2, §6.1, §6.2, §12.2 e §14.11, e MVP-ROADMAP.md F1-T1. Crie o conteúdo da v0.1 em @lotg/content com schemas zod e testes, e os tipos do GameState em @lotg/engine. Sem lógica de simulação ainda."

### F1-T2 · Relógio, calendário e linha do tempo de eventos `M`

**Objetivo:** `advanceTo` que percorre segmentos entre eventos discretos, ainda sem produção.
**GDD:** §2.1, §4 (só o calendário visível), §5.8, §14.3 (item 1).
**Depende de:** F1-T1.
**Entregáveis:** `packages/engine/src/{clock,timeline,advance}.ts` e testes.

- [x] F1-T2.1 `clock.ts`: `dayIndex(ms)`, `seasonOf(dayIndex)` (0–23 primavera, 24–47 verão, 48–71 outono, 72–83 inverno), `dayOfSeason`, `yearOf`, rótulos pt-BR, `nextDayBoundary(ms)`, `nextSeasonBoundary(ms)`. Ano = 84 dias de jogo; ao virar o ano, `clock.year` incrementa e a Crônica registra (sem cerco na v0.1).
- [x] F1-T2.2 `timeline.ts`: `nextEventAt(state)` = mínimo entre fim de obra, fim de recrutamento, virada de dia, virada de estação e virada de ano (as fontes de produção e fome entram em F1-T3 e F1-T4).
- [x] F1-T2.3 `advance.ts`: laço `while (lastProcessedAt < target)`: `next = min(nextEventAt, target)`; aplica o segmento contínuo (`applyContinuous`, vazio por enquanto); processa eventos cujo instante é `next`; atualiza `lastProcessedAt`. Retorna novo estado e lista de eventos em ordem.
- [x] F1-T2.4 Testes: viradas de dia e estação emitem eventos nos instantes exatos; avançar para um instante no passado é no-op; avançar 30 dias de uma vez produz os mesmos eventos que em 720 passos de 1 h.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- clock timeline advance
```

**Pronto quando:** os testes de equivalência de passos passam e `nextEventAt` nunca devolve um instante no passado.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §2.1, §5.8 e §14.3, e MVP-ROADMAP.md F1-T2. Implemente o relógio, a linha do tempo e o laço de advanceTo por segmentos, com testes de equivalência de passos. Produção vem na próxima tarefa."

### F1-T3 · Produção e consumo com aritmética inteira `M`

**Objetivo:** fluxos contínuos exatos e invariantes de divisão de intervalo.
**GDD:** §5.3, §5.4 (só realocação livre), §14.3 (item 2).
**Depende de:** F1-T2.
**Entregáveis:** `packages/engine/src/economy.ts`, `economy.test.ts`, `economy.property.test.ts`.

- [x] F1-T3.1 Taxas por edifício em **milésimos por hora**: `trabalhadores × base × 1000 × (10 + 2 × (nível − 1)) / 10`, sem ponto flutuante. Consumo: `habitantes × 1000` comida/h. Taxa líquida por recurso = soma dos fluxos.
- [x] F1-T3.2 Acumuladores: `acc[r] += taxa_liquida × duracao_ms`; `delta = trunc(acc[r] / 3_600_000)` (em direção a zero); `acc[r] -= delta × 3_600_000`; estoque += delta. Documentar por que isso torna a divisão de intervalos exata.
- [x] F1-T3.3 `GameSettings.capsEnabled = false` na v0.1 (sem limite de estoque; GDD §5.5 é v0.2). Deixar o ponto de corte preparado, sem implementar caps.
- [x] F1-T3.4 Testes de unidade: 2 trabalhadores na Fazenda Nv1 com 5 habitantes = +15 comida/h líquida (exemplo do GDD §13.3 adaptado), 1 h produz exatamente 15.000 milésimos; níveis aplicam +20% por nível.
- [x] F1-T3.5 Testes de propriedade (fast-check): para quaisquer `t1 < t2 < t3`, `advanceTo(t3)` ≡ `advanceTo(t2)` depois `advanceTo(t3)`, com igualdade **estrita** do estado; recursos nunca negativos; o estado de entrada não é mutado.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- economy
```

Esperado: propriedade com 500 execuções por teste, sem contraexemplo.

**Pronto quando:** a igualdade estrita vale mesmo com `t2` caindo no meio de um milissegundo "quebrado" (acumulador não zero).

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.3 e §14.3, e MVP-ROADMAP.md F1-T3. Implemente produção e consumo com acumuladores inteiros em milésimos e escreva primeiro o teste de propriedade de divisão de intervalo com fast-check. Sem caps de estoque."

### F1-T4 · Escassez determinística `M`

**Objetivo:** a fome começa no instante exato em que a comida zera, com penalidades e término determinísticos.
**GDD:** §5.6 (sem abandono de aldeões, que é v0.2).
**Depende de:** F1-T3.
**Entregáveis:** `packages/engine/src/famine.ts`, ajustes em `timeline.ts` e `economy.ts`, testes.

- [x] F1-T4.1 `timeline.ts` passa a incluir o **instante de zeramento da comida** como evento: resolver em inteiros o maior `t` com `estoque(t) ≥ 0` dado o acumulador atual e a taxa líquida negativa.
- [x] F1-T4.2 Ao zerar: `settlement.famine = { since }`; evento `famineStarted`; a partir daí a produção de **todos** os edifícios é multiplicada por 0,75 (aplicado na taxa em milésimos, sem ponto flutuante: `× 3 / 4`), novas ordens de recrutamento são recusadas (`FAMINE`) e a fila em andamento fica congelada (os `finishesAtMs` são deslocados pela duração da fome ao final dela).
- [x] F1-T4.3 Término: no primeiro instante em que a taxa líquida de comida volta a ser positiva (só muda em comandos ou eventos), `famineEnded`, penalidades removidas, fila de recrutamento retomada.
- [x] F1-T4.4 Testes: 30 dias offline com consumo maior que produção → fome começa no instante previsto, comida nunca negativa, evento com o instante exato; realocar para a Fazenda encerra a fome; a propriedade de divisão de intervalo continua valendo atravessando a fome.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- famine economy
```

**Pronto quando:** o teste de 30 dias registra `famineStarted` com `atMs` igual ao calculado à mão no próprio teste.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.6 e MVP-ROADMAP.md F1-T4. Implemente a escassez como evento da linha do tempo com instante exato, penalidade 0,75, bloqueio e congelamento do recrutamento, e término determinístico. Mantenha o teste de propriedade verde."

### F1-T5 · Construções `M`

**Objetivo:** melhorar os seis edifícios da v0.1 com uma fila ativa, planejamento visual e cancelamento.
**GDD:** §6.1, §6.2, §6.3 (regras `[v0.1]`).
**Depende de:** F1-T4.
**Entregáveis:** `packages/engine/src/construction.ts`, testes.

- [x] F1-T5.1 Fórmulas: `custo(n→n+1) = arredondar(base × fator^(n−1))` com fator 1,6 (Salão 1,8); `tempo(n→n+1) = mín(8 h, tempo_base × 1,5^(n−1))`. Expor `upgradeQuote(state, building)` (custos, duração, bloqueios) para a UI e os testes.
- [x] F1-T5.2 Iniciar: valida fila livre (`QUEUE_BUSY`), edifício não em obra (`ALREADY_UPGRADING`), nível máximo (`MAX_LEVEL`), gate do Salão (`GATE_LOCKED`), recursos (`INSUFFICIENT_RESOURCES`); desconta recursos; registra `finishesAtMs`; evento `constructionStarted`.
- [x] F1-T5.3 Concluir (evento da linha do tempo): nível += 1; capacidade habitacional derivada muda imediatamente; evento `constructionFinished` com frase de Crônica.
- [x] F1-T5.4 Cancelar: devolve 80% (em milésimos, arredondando para baixo); evento `constructionCancelled`. Planejar e desplanejar: lista `planned` sem efeito econômico.
- [x] F1-T5.5 Testes: tabela de custos e tempos dos níveis 1→2 até 4→5 para cada edifício bate com a planilha do GDD §6.2; teto de 8 h; gate; desconto único; conclusão no instante exato; cancelamento devolve 80% e libera a fila.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- construction
```

**Pronto quando:** `upgradeQuote` de Serraria 1→2 devolve 100 madeira, 50 pedra e 300 s, e de Habitações 2→3 devolve 128 madeira, 32 pedra e 360 s.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §6 e MVP-ROADMAP.md F1-T5. Implemente início, conclusão, cancelamento e planejamento de obras com uma fila ativa, fórmulas de custo e tempo do conteúdo e todos os códigos de recusa, com testes de tabela."

### F1-T6 · População, trabalhadores e recrutamento `S`

**Objetivo:** alocar aldeões e recrutar novos respeitando capacidade e fila.
**GDD:** §5.2, §5.4 `[v0.1]`.
**Depende de:** F1-T5.
**Entregáveis:** `packages/engine/src/population.ts`, testes.

- [x] F1-T6.1 `setWorkers(building, count)`: `count ≥ 0`, soma ≤ aldeões (`NOT_ENOUGH_VILLAGERS`), edifício produtivo (`INVALID_WORKERS`); efeito imediato nas taxas (reinicia o segmento).
- [x] F1-T6.2 `recruitVillagers(quantity)`: 1 a 5 por ordem; fila total ≤ 5 (`RECRUIT_QUEUE_FULL`); `aldeões + em fila + quantidade ≤ capacidade` (`HOUSING_FULL`); custo descontado na ordem; cada aldeão fica pronto 20 min após o anterior; evento `recruitmentFinished` por aldeão (ou agrupado por ordem, decisão do agente, documentada).
- [x] F1-T6.3 Capacidade habitacional e aldeões livres são **derivados** (`housingCapacity(state)`, `freeVillagers(state)`), nunca persistidos.
- [x] F1-T6.4 Testes: alocação inválida, fila cheia, capacidade, conclusão escalonada, interação com fome (F1-T4).

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- population
```

**Pronto quando:** recrutar 3 aldeões com 1 vaga é recusado com `HOUSING_FULL` e nenhum recurso é descontado.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.2 e §5.4 e MVP-ROADMAP.md F1-T6. Implemente alocação de trabalhadores e recrutamento com capacidade derivada e fila escalonada, com testes."

### F1-T7 · Comandos, validação e códigos de recusa `M`

**Objetivo:** uma única porta de entrada para mudar o estado, com recusas legíveis.
**GDD:** §14.3 (item 4), §14.11.
**Depende de:** F1-T6.
**Entregáveis:** `packages/engine/src/commands.ts`, `rejections.ts`, testes.

- [x] F1-T7.1 União discriminada `Command`: `setWorkers`, `startConstruction`, `cancelConstruction`, `planConstruction`, `unplanConstruction`, `recruitVillagers`, `renameSettlement`. Cada comando carrega `commandId` (UUID) para idempotência no servidor.
- [x] F1-T7.2 `applyCommand(state, command, nowMs)`: exige `state.lastProcessedAt === nowMs` (o chamador avança antes; violar lança erro de programação), despacha, devolve `{ ok: true, state, events }` ou `{ ok: false, code, message }`. Mensagens em pt-BR vindas de `rejections.ts` (ex.: `INSUFFICIENT_RESOURCES` → "Faltam 40 madeira e 10 pedra").
- [x] F1-T7.3 Nenhuma recusa de regra altera o estado avançado recebido por `applyCommand` nem lança exceção. O chamador conserva o resultado anterior de `advanceTo`; o servidor o persiste mesmo em recusa (F2-T6), junto aos eventos do avanço.
- [x] F1-T7.4 Testes: cada código de recusa tem ao menos um teste; comando desconhecido é recusado (`UNKNOWN_COMMAND`); `renameSettlement` valida 2–24 caracteres.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- commands
```

**Pronto quando:** a cobertura de `commands.ts` e `rejections.ts` é 100% de linhas.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.3 e MVP-ROADMAP.md F1-T7. Crie a união de comandos da v0.1, o despachante applyCommand e o catálogo de recusas com mensagens em português, com um teste por código."

### F1-T8 · Objetivos e Crônica `S`

**Objetivo:** objetivos 1–4 avaliados a cada mudança e Crônica gerada a partir dos eventos.
**GDD:** §12.2 (1–4), §12.3, Apêndice E.
**Depende de:** F1-T7.
**Entregáveis:** `packages/engine/src/{objectives,chronicle}.ts`, testes.

- [x] F1-T8.1 Avaliação declarativa das condições após cada comando e cada evento; no máximo 3 ativos; concluir um ativa o próximo; recompensa creditada; evento `objectiveCompleted`.
- [x] F1-T8.2 `chronicle.ts`: para cada evento, gera a frase pt-BR a partir dos modelos de `@lotg/content` e do calendário ("No 3º dia da Primavera, os pedreiros ergueram a Serraria ao 2º nível."). O motor **emite** a frase dentro do evento; não a guarda no estado.
- [x] F1-T8.3 Testes: sequência dos objetivos 1→4 em um cenário roteirizado; frases determinísticas (snapshot).

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- objectives chronicle
```

**Pronto quando:** o cenário roteirizado conclui os quatro objetivos e as recompensas somam +20 ouro, +30 madeira, +40 comida e +50 ouro.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §12.2, §12.3 e Apêndice E, e MVP-ROADMAP.md F1-T8. Implemente os objetivos 1–4 e a geração de frases de Crônica a partir dos eventos, com snapshot determinístico."

### F1-T9 · `ViewState` derivado e explicações `M`

**Objetivo:** tudo que a UI precisa, já calculado e formatado, com o "por quê" de cada número.
**GDD:** §13.3, §14.5 (regra do `ViewState`), §15.1 (regra 6).
**Depende de:** F1-T8.
**Entregáveis:** `packages/engine/src/view.ts`, `view.test.ts`, `__golden__/view-seed-pedra-alta.json`.

- [x] F1-T9.1 Estrutura: `settlement`, `calendar` (ano, estação, dia da estação, segundos até a próxima virada), `population` (aldeões, capacidade, livres, em treinamento), `resources[]` (id, rótulo, estoque em unidades, `cap: null`, `perHour` líquido com uma casa decimal, `breakdown` textual), `workers[]` (edifício, nível, alocados, bruto/h, `breakdown`), `constructions` (`active` com segundos restantes e progresso, `planned[]`, `available[]` com custos, duração, `affordable` e `blockedReason`), `famine`, `objectives[]`, `pendingDecisions: []`.
- [x] F1-T9.2 `breakdown` segue o formato do GDD §13.3: "4 trabalhadores × 10 × 1,2 (Nv2) = 48/h; consumo 18 × 1 = 18/h".
- [x] F1-T9.3 Formatação numérica fica **fora** do motor (a UI usa `Intl`); o motor entrega números e textos de explicação.
- [x] F1-T9.4 Golden test: `ViewState` do estado inicial e após o cenário de F1-T8, comparado a arquivo em `__golden__/` (atualizável com `UPDATE_GOLDEN=1`).

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- view
```

**Pronto quando:** o golden do estado inicial mostra comida +15/h líquida com 2 trabalhadores na Fazenda e 5 habitantes, e `available` lista as cinco melhorias possíveis com custos corretos.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.3 e §14.5 e MVP-ROADMAP.md F1-T9. Implemente deriveViewState com explicações textuais de cada número e golden tests."

### F1-T10 · Golden tests de cenário e `sim-cli` básico `M`

**Objetivo:** congelar o comportamento do motor e ter um bot que joga sete dias em segundos.
**GDD:** §15.3, §15.4.
**Depende de:** F1-T9.
**Entregáveis:** `packages/engine/src/__golden__/scenario-7-days.json`, `packages/engine/src/scenario.test.ts`, `packages/sim-cli/src/{main,bots/economico,report}.ts`.

- [x] F1-T10.1 Cenário roteirizado de 7 dias (lista de comandos com instantes) para a semente `pedra-alta-golden`; snapshot do estado e dos eventos a cada 24 h.
- [x] F1-T10.2 `sim-cli`: `pnpm sim -- --seed <s> --days 7 --strategy economico --sessions-per-day 2`; o bot, a cada "sessão", realoca para maximizar valor ponderado dos recursos, inicia a melhoria mais barata disponível e recruta quando há vaga; emite CSV por hora (recursos, população, níveis, fome) e um resumo.
- [x] F1-T10.3 Teste de faixa (CI): com 2 sessões/dia, no dia 7 a população está entre 20 e 40, Salão ≥ Nv3, nenhuma fome; com 1 sessão/dia, sem fome nas primeiras 24 h. Ajustar números em `@lotg/content` se a faixa falhar, nunca no bot.
- [x] F1-T10.4 Documentar em `packages/sim-cli/README.md` como interpretar o CSV.

**Verificação:**

```bash
pnpm sim -- --seed pedra-alta-golden --days 7 --strategy economico
pnpm --filter @lotg/engine test -- scenario
```

Esperado: CSV com 168 linhas; resumo dentro das faixas; golden idêntico.

**Pronto quando:** rodar o `sim` duas vezes com a mesma semente produz CSVs idênticos (`diff` vazio).

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §15.3 e §15.4 e MVP-ROADMAP.md F1-T10. Crie o golden test de cenário de 7 dias e o sim-cli com o bot econômico e o teste de faixa. Se a faixa falhar, proponha ajustes de conteúdo e me mostre antes de aplicar."

### F1-T11 · Pureza, API pública e documentação do motor `S`

**Objetivo:** fechar o contrato do motor para as fases seguintes.
**GDD:** §14.1 (princípio 2), §14.3.
**Depende de:** F1-T10.
**Entregáveis:** `packages/engine/src/index.ts`, `packages/engine/README.md`, `packages/engine/src/purity.test.ts`.

- [x] F1-T11.1 `index.ts` exporta exatamente a API do contrato da fase e os tipos; nada interno vaza.
- [x] F1-T11.2 Teste de pureza: `grep` automatizado por `Date.now`, `Math.random`, `process.`, `require(`, `import .* from 'node:` e `vscode` dentro de `packages/engine/src` (exceto testes); regra de lint equivalente.
- [x] F1-T11.3 `README.md` do motor: ciclo `advanceTo → applyCommand → deriveViewState`, invariantes, como adicionar um evento, como atualizar goldens.
- [x] F1-T11.4 `pnpm verify` verde; cobertura do motor ≥ 90% de linhas.

**Verificação:**

```bash
pnpm verify && pnpm --filter @lotg/engine test -- --coverage
```

**Pronto quando:** cobertura ≥ 90% e o teste de pureza passa.

**Prompt sugerido:** "Leia CLAUDE.md e MVP-ROADMAP.md F1-T11. Feche a API pública do @lotg/engine, adicione o teste de pureza e escreva o README do motor. Rode a cobertura e me mostre."

---

## 4. Fase 2 — Protocolo e servidor (`@lotg/protocol`, `@lotg/server`)

**Meta da fase:** a API `/v1` completa da v0.1 rodando em Docker, com conta anônima, GitHub, Código do Reino, partidas, comandos idempotentes, eventos e job de avanço, coberta por testes de integração contra PostgreSQL real.

### F2-T1 · Pacote `@lotg/protocol` `S`

**Objetivo:** contratos compartilhados entre servidor, extensão e `sim-cli`.
**GDD:** §14.2, §14.5, §14.12.
**Depende de:** F1-T11.
**Entregáveis:** `packages/protocol/src/{commands,view,api,errors,webview,index}.ts`, testes.

- [x] F2-T1.1 `commands.ts`: schemas zod de cada comando, com `commandId` UUID; teste de tipo garante que `z.infer<typeof CommandSchema>` é idêntico ao `Command` do motor.
- [x] F2-T1.2 `view.ts`: schema do `ViewState`; `api.ts`: corpos e respostas de todos os endpoints da §14.5 do GDD usados na v0.1, incluindo `/view { view, stateVersion }`, comando aceito `{ view, events, stateVersion, staleView }`, recusa `GAME_RULE` com `details { code, message, view, events, stateVersion, staleView }` e exclusão `202 { deletedAt, purgeAfter }`. `stateVersion` é string decimal positiva e datas são UTC ISO 8601. `errors.ts`: `ApiErrorSchema { code, message, details? }` e enum de códigos (`VALIDATION`, `UNAUTHORIZED`, `SESSION_REVOKED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `CONFLICT`, `COMMAND_ID_CONFLICT`, `ACCOUNT_CONFLICT`, `ACTIVE_GAME_EXISTS`, `GAME_RULE`, `GITHUB_TOKEN_INVALID`, `UPGRADE_REQUIRED`, `INTERNAL`).
- [x] F2-T1.3 `webview.ts`: mensagens Webview ↔ extensão (`command`, `view`, `error`, `connection`, `navigate`).
- [x] F2-T1.4 `PROTOCOL_VERSION = 1`; documentar `X-Lords-Protocol`, `X-Lords-State-Version` (aviso opcional, sem bloqueio da ação), `X-Lords-Replayed` (metadado de reenvio), ETag e `If-None-Match`. O aviso não usa `If-Match`; recibos mantêm status e corpo originais, com o indicador de reenvio somente no cabeçalho.

**Verificação:**

```bash
pnpm --filter @lotg/protocol test && pnpm typecheck
```

**Pronto quando:** mudar um campo do `Command` no motor quebra o teste de tipo do protocolo.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.5 e §14.12 e MVP-ROADMAP.md F2-T1. Crie o pacote @lotg/protocol com schemas zod de comandos, ViewState, API, erros e mensagens da Webview, com teste de equivalência de tipos com o motor."

### F2-T2 · Esqueleto do servidor `M`

**Objetivo:** Fastify configurado, observável e com erros padronizados, sem regras de jogo.
**GDD:** §14.5, §14.14.
**Depende de:** F2-T1, F0-T4.
**Entregáveis:** `packages/server/src/{main,app,config}.ts`, `plugins/{db,errors,ratelimit}.ts`, `routes/{health,version}.ts`, testes.

- [x] F2-T2.1 `config.ts`: variáveis da §1.3 validadas por zod no arranque; falha rápida com mensagem clara. Decodificar `JWT_SECRET` e `RECOVERY_CODE_SECRET` de base64, exigir pelo menos 32 bytes em cada e valores diferentes; nunca imprimir segredos em erros.
- [x] F2-T2.2 `app.ts`: `buildApp(deps)` com `pino` (redação de `authorization`, `refreshToken`, `githubAccessToken`, `code`), `requestId`, `@fastify/sensible`, `@fastify/rate-limit` (60/min por sessão ou IP), plugin `db` (Pool do `pg` + Drizzle), handler de erros mapeando `ZodError` → 400 `VALIDATION`, `ApiError` → status próprio, desconhecido → 500 `INTERNAL` com `requestId`.
- [x] F2-T2.3 `GET /v1/health` (`{ status: 'ok', db: 'ok' | 'down' }`, 503 se o banco falhar) e `GET /v1/version` (`{ server, protocol, contentHash, builtAt }`).
- [x] F2-T2.4 `main.ts`: carrega config, roda migrações (F2-T3), escuta, encerramento gracioso em `SIGTERM`.
- [x] F2-T2.5 `pnpm dev:api` com `tsx watch`; testes com `app.inject` (health, 404, formato de erro de validação).

**Verificação:**

```bash
pnpm dev:up && pnpm dev:api &  # em outro terminal:
curl -s localhost:3000/v1/health && curl -s localhost:3000/v1/version
```

Esperado: `{"status":"ok","db":"ok"}` e a versão.

**Pronto quando:** derrubar o `db` faz `/v1/health` responder 503 em menos de 2 s.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.5 e §14.14 e MVP-ROADMAP.md F2-T2. Crie o esqueleto do servidor Fastify com config validada, pino com redação, rate limit, plugin de banco, handler de erros padronizado, health e version, e testes com inject."

### F2-T3 · Banco de dados e migrações `M`

**Objetivo:** esquema do GDD §14.6 em Drizzle, SQL versionado e migrador no arranque.
**GDD:** §14.6.
**Depende de:** F2-T2.
**Entregáveis:** `packages/server/src/db/schema.ts`, `drizzle.config.ts`, `deploy/migrations/0001_init.sql`, `packages/server/src/db/migrate.ts`, `packages/server/test/helpers/db.ts`.

- [x] F2-T3.1 Sete tabelas do GDD §14.6: `accounts`, `sessions`, `refresh_tokens`, `games`, `commands`, `game_events`, `chronicles`. `refresh_tokens` guarda todos os hashes por sessão, com `created_at` e `used_at`; não usar apenas o token anterior. `commands` inclui `request_hash`, `response_status`, `response_body` obrigatórios, `result` (`accepted | rejected`) e `error_code`; PK `(game_id, id)`. `accounts.recovery_code_hash` guarda HMAC-SHA256. Relações de propriedade com `ON DELETE CASCADE` cobrem também recibos e histórico de refresh.
- [x] F2-T3.2 Índices: único parcial `games(account_id) where status = 'active'`; `games(last_processed_at) where status = 'active'`; único `commands(game_id, seq)`; PK `game_events(game_id, seq)`; `sessions(account_id)`; PK `refresh_tokens(token_hash)` e índice `refresh_tokens(session_id)`, mais único parcial em `session_id where used_at is null`; únicos `accounts(github_id)` e `accounts(recovery_code_hash)`; `accounts(deleted_at)`.
- [x] F2-T3.3 `drizzle-kit generate` com saída em `deploy/migrations/`; `migrate.ts` aplica no arranque dentro de `pg_advisory_lock(727)`; idempotente.
- [x] F2-T3.4 Helper de teste `resetTestDb()` (drop schema + migrar) usando `TEST_DATABASE_URL`; projeto `integration` do Vitest só roda com a variável definida.

**Verificação:**

```bash
pnpm db:migrate && pnpm db:psql -c '\dt'
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
```

Esperado: sete tabelas mais a de controle do Drizzle; migração aplicada duas vezes sem erro. Testar unicidade de comando por partida, de sequência e de token não utilizado por sessão; testar cascatas completas.

**Pronto quando:** dois processos rodando `migrate` ao mesmo tempo terminam sem erro (teste com `Promise.all`).

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.6 e MVP-ROADMAP.md F2-T3. Modele o esquema em Drizzle, gere a migração SQL em deploy/migrations, implemente o migrador com advisory lock no arranque e o helper de reset do banco de teste."

### F2-T4 · Autenticação: conta anônima, JWT, refresh rotativo, `/me` `L`

**Objetivo:** a conta que nasce em um clique, com sessões seguras e exclusão.
**GDD:** §13.9, §14.7, §14.14.
**Depende de:** F2-T3.
**Entregáveis:** `packages/server/src/auth/{tokens,service}.ts`, `routes/auth.ts`, `routes/me.ts`, `plugins/auth.ts`, testes de integração.

- [x] F2-T4.1 `POST /v1/auth/anonymous { displayName, deviceLabel? }` → cria `accounts` + `sessions` + primeiro hash em `refresh_tokens` atomicamente; responde `{ account, accessToken, refreshToken, expiresIn }`. Limite 10/h por IP.
- [x] F2-T4.2 Access token: JWT HS256 (`jose`) com `sub` = accountId, `sid` = sessionId, `iss` = `PUBLIC_URL`, `exp = min(agora + 15 min, sessão.expires_at)`. Sessão/família por máquina com validade absoluta de 30 dias; refresh de 32 bytes aleatórios em base64url, guardado como SHA-256 em `refresh_tokens`. Na rotação, localizar hash, travar conta → sessão, revalidar; marcar o token como utilizado e inserir o sucessor na mesma transação. Qualquer antecessor utilizado revoga a sessão inteira; fazer commit da revogação **antes** do 401 `SESSION_REVOKED`. Hash desconhecido ou sessão expirada retorna 401 `UNAUTHORIZED`. Conservar todos os hashes até expiração da sessão ou exclusão em cascata.
- [x] F2-T4.3 Plugin `auth`: validar JWT, `sub`, `sid`, emissor e expiração; consultar conta/sessão no banco em toda requisição, sem cache positivo de autorização; rejeitar `deleted_at`, `revoked_at`, sessão expirada ou sessão de outra conta. Atualizar `last_seen_at` no máximo a cada 5 min. Novas requisições após commit da revogação falham em qualquer instância. Criação de sessões e alterações de credenciais revalidam a conta sob lock.
- [x] F2-T4.4 `POST /v1/auth/logout` autenticado por JWT revoga somente a sessão atual; `GET /v1/me` (`{ id, displayName, linked: { github }, hasRecoveryCode, createdAt }`); `PATCH /v1/me { displayName }`; `DELETE /v1/me` faz soft delete, revoga todas as sessões, limpa o HMAC de recuperação e arquiva partidas atomicamente, respondendo `202 { deletedAt, purgeAfter }` com prazo de sete dias. API e métricas de jogadores ativos filtram contas excluídas; nenhum login as restaura. O job F2-T7 remove fisicamente os dados após o prazo; não implementar desfazer exclusão.
- [x] F2-T4.5 Testes de integração com relógio injetado: criação, JWT e expiração absoluta; `R0 → R1 → R2`, reuso de `R0` invalida `R2` e JWT da família, preservando outra sessão; refresh concorrente do mesmo token não deixa dois sucessores válidos e o reuso revoga inclusive o sucessor recém-emitido; rollback em falha de rotação. Testar logout e exclusão com duas instâncias sem esperar 60 s, acesso/refresh após exclusão e limites de taxa. Uma revogação deve continuar gravada apesar da resposta 401. GitHub e Código do Reino serão verificados em F2-T5.4.

**Verificação:**

```bash
pnpm test:integration -- auth
```

**Pronto quando:** reutilizar `R0` após duas rotações revoga `R2` e seus JWTs, inclusive na segunda instância; outra sessão da conta segue válida. Logout e exclusão bloqueiam imediatamente as novas requisições previstas, sem depender de expiração de cache.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.7 e §14.14, ADR 0005 e MVP-ROADMAP.md F2-T4. Implemente conta anônima, JWT, histórico de refresh por sessão, detecção de reuso após múltiplas rotações, autorização sem cache positivo e exclusão em duas etapas. Teste duas instâncias e confirme que respostas 401 não desfazem a revogação. Nunca logue tokens."

### F2-T5 · Código do Reino e vínculo GitHub `M`

**Objetivo:** recuperar a conta em outra máquina sem e-mail nem senha.
**GDD:** §13.9, §14.7.
**Depende de:** F2-T4.
**Entregáveis:** `packages/server/src/auth/{recovery,github}.ts`, rotas e testes conforme o [ADR 0003 existente](docs/decisions/0003-codigo-do-reino-hmac.md).

- [x] F2-T5.1 Código do Reino: 20 caracteres aleatórios uniformes do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, exibidos como `XXXX-XXXX-XXXX-XXXX-XXXX`. Normalização: remover espaços externos e hífens, converter para maiúsculas e validar 20 caracteres do alfabeto. Guardar **HMAC-SHA256** hexadecimal do código normalizado usando a chave base64 decodificada `RECOVERY_CODE_SECRET`, independente de `JWT_SECRET`; implementação com `node:crypto` e busca pelo índice único. Gerar outro código na improvável colisão do HMAC. Seguir o contrato do GDD §14.7 e ADR 0003, sem nova decisão pendente.
- [x] F2-T5.2 `POST /v1/auth/recovery-code` gera/rotaciona sob lock da conta e devolve o código em claro **uma vez**, com `Cache-Control: no-store`; código anterior deixa de funcionar, sessões existentes permanecem. `POST /v1/auth/recover { code, deviceLabel? }` busca HMAC, revalida a conta sob lock e cria sessão nova; limite 5/h por IP. Código inválido, inexistente ou de conta excluída recebe 401 `UNAUTHORIZED` sem revelar conta; não logar código nem chaves.
- [x] F2-T5.3 `POST /v1/auth/github { githubAccessToken, deviceLabel?, resolve? }`: valida em `${GITHUB_API_URL}/user` com `Authorization: Bearer`, `Accept: application/vnd.github+json` e `User-Agent: lords-of-the-guild-server`; guarda só `github_id`. Casos: (a) chamador autenticado e `github_id` livre → vincula; (b) chamador não autenticado e `github_id` conhecido → entra; (c) chamador autenticado com conta anônima e `github_id` de outra conta → 409 `ACCOUNT_CONFLICT` com `details { existingDisplayName, currentHasProgress }`; repetir com `resolve: 'useExisting'` (conta atual recebe soft delete) ou `resolve: 'keepCurrent'` (vínculo migra para a conta atual). Nunca mesclar estados. Token do GitHub inválido → 401 `GITHUB_TOKEN_INVALID`.
- [x] F2-T5.4 `fetch` injetável para testar o GitHub sem rede; testes de todos os casos e dos limites. Testar normalização do código, rotação invalidando o anterior, sessões preservadas, troca de `JWT_SECRET` sem invalidar o Código do Reino e exclusão bloqueando recuperação e login GitHub. O caso `useExisting` aplica a mesma exclusão transacional de F2-T4.4 à conta descartada.

**Verificação:**

```bash
pnpm test:integration -- recovery github
```

**Pronto quando:** gerar um código, "trocar de máquina" (nova sessão) e recuperar devolve a mesma `accountId`; o código errado 6 vezes seguidas devolve 429.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.9 e §14.7, ADR 0003 e MVP-ROADMAP.md F2-T5. Implemente o Código do Reino com HMAC e chave independente, normalização e rotação, e o vínculo GitHub com fetch injetável e os três casos de conflito. Teste também que nenhum fluxo restaura conta excluída."

### F2-T6 · Partidas: criação, `view` com ETag, comandos transacionais, eventos e Crônica `L`

**Objetivo:** o coração do servidor: avançar, aplicar e persistir com idempotência e concorrência corretas.
**GDD:** §14.5, §14.8, §14.9 (avanço preguiçoso), §14.11.
**Depende de:** F2-T5.
**Entregáveis:** `packages/server/src/games/{repository,service,view,commands,events}.ts`, `routes/games.ts`, testes de integração.

- [x] F2-T6.1 `POST /v1/games { settlementName, timezone, vigilHourLocal, replaceActive? }`: na v0.1, `difficulty = 'lord'` e `timeScale = 1` fixos (campos aceitos e guardados); se já há partida ativa e `replaceActive` não vier → 409 `ACTIVE_GAME_EXISTS`; com `replaceActive` → arquiva a atual. Semente aleatória (ou informada em ambiente de teste). `GET /v1/games` lista.
- [x] F2-T6.2 Relógio: `gameNowMs = (now − games.created_at) × time_scale`, em inteiros. Autenticar, verificar propriedade (404 para outra conta, sem consultar recibos dela) e travar a partida em transação. Capturar `now` sob o lock. Leituras e comandos novos chamam `advanceTo`; reenvios e conflitos de UUID retornam antes do avanço.
- [x] F2-T6.3 **Regra de persistência:** leituras de partida só escrevem se o avanço produziu eventos; persistir estado e eventos atomicamente sob o lock. Produção contínua sem evento não gera escrita. Cada comando **novo**, aceito ou recusado pelo motor, persiste o estado avançado e o recibo. `state_version` começa em 1 e incrementa uma vez por escrita do estado, também no job; a API o serializa como string decimal. `last_processed_at` recebe o relógio de parede do avanço a cada escrita. Reenvios não escrevem nem incrementam versões/sequências.
- [x] F2-T6.4 `GET /v1/games/:id/view` responde `{ view, stateVersion }`. ETag fraco `W/"<sha256>"` do JSON canônico desse corpo completo, com chaves de objetos ordenadas recursivamente e ordem de arrays preservada; autenticar e avançar antes de comparar `If-None-Match`. Igual → 304 sem corpo e com ETag; diferente → 200. Usar `Cache-Control: private, no-cache` e `Vary: Authorization` em ambos. Contagens regressivas e produção podem mudar o ETag sem escrita; não incluir `requestId` ou timestamp da requisição no corpo. ETag não é `stateVersion`.
- [x] F2-T6.5 `POST /v1/games/:id/commands { commandId, type, payload }`: sob o lock, buscar `(game_id, commandId)` e comparar `request_hash` (SHA-256 do JSON canônico de `{ type, payload }` validado, sem cabeçalho de versão). Mesmo hash → retornar status/corpo gravados e `X-Lords-Replayed: true`; diferente → 409 `COMMAND_ID_CONFLICT`, sem alterar o recibo. Comando novo: capturar versão anterior, avançar, aplicar e gravar estado, eventos e recibo completo na mesma transação; `seq` único crescente por partida. Sucesso: 200 `{ view, events, stateVersion, staleView }`. Recusa: 422 `GAME_RULE` com `details { code, message, view, events, stateVersion, staleView }`, persistindo estado/eventos do avanço sem efeitos da ação recusada. Commit antes da resposta inclusive na recusa; falha inesperada faz rollback total. `X-Lords-State-Version` opcional determina `staleView` comparando com a versão persistida capturada sob lock, antes do avanço; ausência → false, formato inválido → 400. Usar `Cache-Control: no-store` nas respostas de comandos. Recibos permanecem enquanto a partida existir.
- [x] F2-T6.6 `GET /v1/games/:id/events?after=<seq>&limit=100` e `GET /v1/games/:id/chronicle?limit=50` (eventos com frase de Crônica) e `GET /v1/games/:id/chronicle.md` (Markdown com título, ano e uma linha por evento).
- [x] F2-T6.7 Testes de integração: fluxo completo (conta → partida → comandos → view → eventos); 404 para outra conta antes da busca de recibo; **10 comandos em paralelo** aplicados exatamente uma vez com `seq` 1..10 e estado final igual ao da aplicação sequencial na ordem gravada. Leituras e comandos concorrentes não duplicam eventos; o job entra nesse teste em F2-T7.4. Falha entre escrita do estado e inserção do recibo faz rollback de tudo.
- [x] F2-T6.8 Testar recibos de sucesso e recusa: reenvio concorrente, após reinício e após outros comandos retorna mesmo status/corpo (igualdade estrutural JSON), só muda o cabeçalho de reenvio; nenhum avanço, evento, versão ou `seq` novo. Mesmo UUID com payload diferente retorna conflito; mudança da ordem das chaves ou do cabeçalho de versão não muda a identidade. Testar recibo com mais de 90 dias ainda idempotente.
- [x] F2-T6.9 Testar recusa após horas sem acesso com uma obra concluída durante o intervalo: conclusão e produção persistem, ação recusada não desconta nada, recibo 422 contém a nova view e os eventos aparecem uma única vez. Quando recursos passam a bastar, repetir o UUID mantém a recusa original; novo UUID permite reavaliar.
- [x] F2-T6.10 Testar ETag: relógio congelado e mesmo corpo → 304; avanço contínuo sem evento muda estoque/tempo restante e ETag → 200 com mesma `stateVersion` e zero `UPDATE`; alteração de versão muda a representação. Validar cabeçalhos, 304 sem corpo e autenticação mesmo quando o ETag coincide. Testar `staleView` com cabeçalho ausente, igual, diferente e malformado.

**Verificação:**

```bash
pnpm test:integration -- games
```

**Pronto quando:** o teste de concorrência passa 20 vezes seguidas (`--repeat 20`), os cenários F2-T6.8–10 passam e `GET /view` repetido em 10 s sem eventos não gera `UPDATE`, mesmo devolvendo 200 quando a representação muda (verificar contador de escritas).

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.5, §14.8 e §14.9, ADR 0004 e MVP-ROADMAP.md F2-T6. Implemente leituras com persistência quando há eventos, ETag da representação e comandos com recibo completo em transação. Preserve o avanço em recusas e retorne recibos antes de avançar no reenvio. Escreva primeiro os testes de concorrência, reenvio após reinício, conflito de UUID, recusa após avanço e ETag sem escrita."

### F2-T7 · Job de avanço e exclusão definitiva `M`

**Objetivo:** partidas paradas avançam de hora em hora e contas excluídas desaparecem após a carência.
**GDD:** §14.9, §14.7 (exclusão).
**Depende de:** F2-T6.
**Entregáveis:** `packages/server/src/jobs/{advanceStaleGames,purgeAccounts,scheduler}.ts`, testes.

- [x] F2-T7.1 `scheduler.ts`: `setInterval(ADVANCE_JOB_INTERVAL_MS)`; cada execução tenta `pg_try_advisory_lock(7271)` em conexão dedicada; sem o lock, encerra em silêncio (outra réplica está rodando).
- [x] F2-T7.2 `advanceStaleGames`: lotes de 100 partidas ativas com `last_processed_at < now − ADVANCE_STALE_AFTER_MS`, `FOR UPDATE SKIP LOCKED`; avança e persiste cada uma (mesma função de F2-T6.3, forçando escrita para atualizar `last_processed_at`); orçamento de 20 s por execução; log com contagem.
- [x] F2-T7.3 `purgeAccounts`: na primeira execução com `now >= deleted_at + 7 dias`, hard delete em cascata de conta, sessões, todos os hashes de refresh, partidas, comandos/recibos, eventos e Crônicas. Job horário, inclusive recuperação após indisponibilidade; logs só com contagens. Limpeza de `refresh_tokens` por idade só pode ocorrer quando a sessão inteira já expirou; nunca apagar apenas antecessores de uma sessão ainda válida. Não expurgar recibos de comandos por idade na v0.1.
- [x] F2-T7.4 Testes: partida parada é avançada e ganha eventos; partida recente não é tocada; duas instâncias do app → só uma executa; job concorrente com leitura/comando não duplica eventos. Exclusão com relógio injetado: acesso negado imediatamente, registros internos ainda existem antes de sete dias, exatamente no prazo o job remove os registros relacionados à conta nas sete tabelas e uma conta de controle permanece intacta. Reexecução é idempotente; sessão válida mantém histórico de refresh mesmo após várias rotações; sessão expirada pode ter histórico limpo.

**Verificação:**

```bash
pnpm test:integration -- jobs
```

**Pronto quando:** com `ADVANCE_JOB_INTERVAL_MS=1000` em dev, uma partida criada e abandonada recebe o evento de virada de dia sem nenhuma requisição do cliente.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.9 e MVP-ROADMAP.md F2-T7. Implemente o job de avanço com advisory lock e SKIP LOCKED, e a exclusão definitiva de contas, com testes de integração incluindo duas instâncias concorrentes."

### F2-T8 · Testes de cenário, carga leve e `sim-cli` remoto `M`

**Objetivo:** confiança de ponta a ponta na API e primeiro número de desempenho.
**GDD:** §14.8 (meta de p95), §15.3, §15.4.
**Depende de:** F2-T7.
**Entregáveis:** `tests/server/scenarios.test.ts`, `packages/sim-cli/src/remote.ts`, relatório em `docs/perf-v0.1.md`.

- [x] F2-T8.1 Cenários: "primeira hora de um jogador novo" (conta → partida → 6 comandos → view), "troca de máquina" (código do reino → mesma partida), "duas máquinas" (sessões distintas, comandos intercalados, views consistentes), "excluir conta".
- [x] F2-T8.2 `sim-cli --remote http://localhost:3000 --bots 50 --minutes 2`: cada bot cria conta e partida, faz polling a cada 30 s (acelerado) e envia comandos; mede p50/p95 de `/view` e `/commands`.
- [x] F2-T8.3 Meta local (API no host, banco em Docker): p95 < 50 ms em `/view` e < 80 ms em `/commands` com 50 bots. Registrar em `docs/perf-v0.1.md` com data e máquina.

**Verificação:**

```bash
pnpm test:integration && pnpm sim -- --remote http://localhost:3000 --bots 50 --minutes 2
```

**Pronto quando:** todos os cenários verdes e o relatório de desempenho gravado.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F2-T8 e GAME_DESIGN.md §15.3. Escreva os testes de cenário de ponta a ponta e o modo remoto do sim-cli com medição de p95; rode contra o servidor local e registre o resultado em docs/perf-v0.1.md."

### F2-T9 · Imagem de produção e perfil `full` `S`

**Objetivo:** a API rodando em contêiner como em produção, validada localmente.
**GDD:** §14.13.
**Depende de:** F2-T8, F0-T4.
**Entregáveis:** `deploy/Dockerfile` finalizado, `docker-compose.dev.yml` perfil `full` funcional.

- [x] F2-T9.1 Alvo `runtime`: usuário não root, só `dist/`, `node_modules` de produção e `deploy/migrations/`; `HEALTHCHECK` em `/v1/health`; imagem abaixo de 250 MB.
- [x] F2-T9.2 `docker compose -f deploy/docker-compose.dev.yml --profile full up -d` sobe `db` e `api`; a API aplica migrações e fica saudável.
- [x] F2-T9.3 `pnpm sim -- --remote http://localhost:3000 --bots 10 --minutes 1` contra o contêiner funciona.

**Verificação:**

```bash
pnpm docker:build && docker compose -f deploy/docker-compose.dev.yml --profile full up -d && docker compose -f deploy/docker-compose.dev.yml ps
docker inspect --format '{{.Config.User}}' lotg-api
```

Esperado: `api` `healthy`; usuário não root.

**Pronto quando:** a imagem construída do zero (`--no-cache`) sobe saudável em menos de 60 s.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F2-T9 e GAME_DESIGN.md §14.13. Finalize o alvo runtime do Dockerfile e o perfil full do compose de dev; prove com docker compose ps, docker inspect e o sim-cli remoto."


---

## 5. Fase 3 — Cliente: `@lotg/client-sdk` e app web com aparência de editor

**Meta da fase:** abrir o endereço, clicar em **Jogar agora** e governar Pedra Alta em menos de 30 segundos, em uma página que parece um editor de código; continuar de outra máquina; funcionar sem conexão em modo leitura.

**Replanejamento ([ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md)).** Esta fase foi executada uma primeira vez com o cliente como extensão do VS Code (tarefas F3-T2 a F3-T10, registradas na §9). A plataforma mudou para o navegador. F3-T1 (`client-sdk`) continua valendo como está. As tarefas **F3W-T1 a F3W-T10** substituem F3-T2 a F3-T10 e partem do que já existe: os módulos sem dependência do VS Code (conta, sessão de jogo, política de notificações, modelo da árvore, formatação) e os componentes Preact migram para `packages/web`; a cola com o editor é descartada.

### F3-T1 · `@lotg/client-sdk` `M`

**Objetivo:** cliente HTTP tipado, com refresh automático, ETag e erros claros, sem nada específico de uma plataforma: só depende de `fetch`.
**GDD:** §14.2, §14.10.
**Depende de:** F2-T9.
**Entregáveis:** `packages/client-sdk/src/{client,tokens,errors,retry}.ts`, testes com `fetch` simulado.

- [x] F3-T1.1 `createClient({ baseUrl, tokenStore, fetch, clientVersion })`; `TokenStore` é uma interface (`get/set/clear`) implementada pela extensão com `SecretStorage` e pelo `sim-cli` em memória.
- [x] F3-T1.2 Um método por endpoint da v0.1, com tipos do `@lotg/protocol`; respostas validadas por zod em modo dev.
- [x] F3-T1.3 401 `UNAUTHORIZED` em chamada autenticada → refresh **single-flight** (uma renovação por vez) → repete a chamada uma vez. `SESSION_REVOKED` ou refresh inválido chama `onUnauthenticated()` sem tentar outro refresh. A rotação em si não recebe retentativa automática em falha de rede: o token pode já ter sido consumido; mostrar necessidade de nova autenticação se o resultado não puder ser confirmado. Após renovação bem-sucedida, substituir os tokens juntos no `TokenStore`.
- [x] F3-T1.4 `getView(gameId, { etag })` devolve `{ status: 200, view, stateVersion, etag }` ou `{ status: 304, etag }`. `sendCommand` conserva `commandId` e payload nas retentativas em falha de rede, aceita versão conhecida via `X-Lords-State-Version` e expõe `X-Lords-Replayed` como metadado `replayed`, fora do corpo original. Após recibo repetido, a sessão de jogo busca view/eventos atuais; nova intenção usa outro UUID. GETs com retentativa exponencial (3 tentativas).
- [x] F3-T1.5 Erros: `ApiClientError { status, code, message, details, replayed }` e `NetworkError`; cabeçalhos `X-Lords-Protocol` e `X-Lords-Client`. Tipar `GAME_RULE.details` para que a UI atualize a view avançada e os eventos antes de mostrar a recusa, exceto em recibo repetido, que exige nova leitura.
- [x] F3-T1.6 Testes: refresh concorrente e sem retentativa cega, sessão revogada sem refresh, 304, ETag diferente com mesma versão, retentativa com UUID/payload preservados, reenvio de sucesso/422 exposto como metadado, mapeamento de erros e `UPGRADE_REQUIRED`.

**Verificação:**

```bash
pnpm --filter @lotg/client-sdk test
```

**Pronto quando:** 5 chamadas simultâneas com token expirado disparam exatamente 1 `POST /auth/refresh` no `fetch` simulado.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.10 e MVP-ROADMAP.md F3-T1. Implemente o client-sdk tipado com refresh single-flight, ETag, retentativas seguras e erros claros, testado com fetch simulado."

### Tarefas substituídas (F3-T2 a F3-T10)

Executadas em 2026-10-01 para a extensão do VS Code e substituídas pelas tarefas F3W abaixo. O texto original delas está no histórico do Git (versão 1.1 deste arquivo); o que foi feito e verificado em cada uma está no Registro de Execução (§9).

| Tarefa antiga | O que virou |
|---|---|
| F3-T2 · Esqueleto da extensão e build | F3W-T1 (esqueleto do app) |
| F3-T3 · Conta | F3W-T3 e F3W-T8 |
| F3-T4 · Ciclo de atualização, cache e Relatório de Retorno | F3W-T4 |
| F3-T5 · TreeView e Status Bar | F3W-T2 |
| F3-T6 · Comandos da paleta | F3W-T6 |
| F3-T7 · Webview | F3W-T2 e F3W-T5 |
| F3-T8 · Notificações | F3W-T7 |
| F3-T9 · Testes e roteiro manual | F3W-T10 |
| F3-T10 · Empacotamento `.vsix` | F3W-T9 (build estático) e F4-T1 (servir pelo Caddy) |

### F3W-T1 · Esqueleto do app web e migração do que se reaproveita `M`

**Objetivo:** `packages/web` de pé, com build e servidor de desenvolvimento, e os módulos reaproveitáveis da extensão já dentro dele, com os testes passando.
**GDD:** §14.2, §14.10. **ADR:** 0008.
**Depende de:** F3-T1.
**Entregáveis:** `packages/web/{package.json,vite.config.ts,index.html,tsconfig.json}`, `packages/web/src/{main.tsx,account/,game/,notifications/,ui/,services/}`, remoção de `packages/extension` e `packages/webview`.

- [x] F3W-T1.1 Pacote `@lotg/web` com Preact, Vite e `@preact/preset-vite`; `pnpm dev:web` na porta 5173 com proxy de `/v1` para `http://localhost:3000`; `pnpm build` gera `packages/web/dist` com nomes de arquivo com hash.
- [x] F3W-T1.2 Mover para `packages/web/src`, sem mudar o comportamento: `account/{accountService,githubLink,recoveryCode,linkReminder}.ts`, `game/{gameSession,connection,returnReport}.ts`, `notifications/policy.ts`, `ui/{treeModel,format}.ts`, `services/store.ts`, e os testes de cada um. Mover os componentes Preact, `state.ts`, `format.ts` e `styles.css` de `packages/webview`.
- [x] F3W-T1.3 `services/browserStore.ts`: implementações de `KeyValueStore` e de `TokenStore` sobre `localStorage`, com prefixo `lords.`; falha de armazenamento (modo privado, cota) tratada sem derrubar o app.
- [x] F3W-T1.4 Regras de lint: `packages/web` não importa `@lotg/engine`, `@lotg/server`, `fastify`, `pg` nem módulos do Node. Remover as regras e os aliases de `vscode`.
- [x] F3W-T1.5 Remover `packages/extension`, `packages/webview`, o editor de mentira dos testes, `tests/client/extension.test.ts`, `.vscode/launch.json`, `@types/vscode` e `@vscode/vsce`. Atualizar `README.md`, `CLAUDE.md`, a CI e o `.gitignore`.
- [x] F3W-T1.6 `index.html` com política de conteúdo (CSP) por `<meta>`: `default-src 'self'`, sem `unsafe-inline` e sem `eval`; nenhuma dependência carregada de CDN.

**Verificação:**

```bash
pnpm verify && pnpm build
pnpm dev:api & pnpm dev:web &   # http://localhost:5173 mostra a página; /v1/health responde pelo proxy
```

**Pronto quando:** `pnpm verify` passa com os testes migrados; `curl -s localhost:5173/v1/health` responde `{"status":"ok","db":"ok"}`; `packages/extension` e `packages/webview` não existem mais.

**Prompt sugerido:** "Leia CLAUDE.md, o ADR 0008, GAME_DESIGN.md §14.2 e §14.10 e MVP-ROADMAP.md F3W-T1. Crie packages/web com Vite e Preact, mova os módulos e componentes reaproveitáveis da extensão e da Webview com os seus testes, implemente o armazenamento no navegador e remova os pacotes da extensão. Não mude comportamento nesta tarefa."

### F3W-T2 · Bancada com aparência de editor `L`

**Objetivo:** a moldura do app: barra de atividades, barra lateral com a árvore, área central em abas e barra de status, nos três temas.
**GDD:** §13.1, §13.2, §13.5, §13.7.
**Depende de:** F3W-T1.
**Entregáveis:** `packages/web/src/workbench/{Workbench,ActivityBar,SideBar,Tree,EditorTabs,StatusBar}.tsx`, `packages/web/src/theme/{themes.css,theme.ts}`, testes.

- [x] F3W-T2.1 Temas escuro, claro e alto contraste como conjuntos de valores para as variáveis `--vscode-*` que `styles.css` já usa; escolha lembrada no navegador; na primeira visita, `prefers-color-scheme`. Nenhum componente com cor fixa (o teste existente continua valendo, agora também para os temas, que são o único lugar com cores).
- [x] F3W-T2.2 Árvore lateral renderizada a partir de `buildTree` (`ui/treeModel.ts`): rótulo, descrição, ícone codicon, tooltip, expandir e recolher, ações nos itens (`+`/`−` dos trabalhadores, "Melhorar", "Cancelar"). Clicar em um item só navega; ordens saem dos botões. Teclado no padrão de árvore ARIA: setas, `Home`, `End`, `Enter`.
- [x] F3W-T2.3 Área central em abas (Hoje, Feudo, Crônica quando aberta), com a aba ativa refletida na URL (`#/feudo`), para o botão "voltar" e o recarregar da página funcionarem.
- [x] F3W-T2.4 Barra de status a partir de `statusBar` (`ui/format.ts`), com a mesma prioridade; contagem regressiva local; clique leva à aba correspondente. Título da aba do navegador com o nome do feudo e o contador de novidades.
- [x] F3W-T2.5 Barra de atividades com Feudo, Crônica e Conta, e badge de novidades. Abaixo de 720 px, a barra lateral se recolhe e abre por cima do conteúdo; a 480 px não há rolagem horizontal.
- [x] F3W-T2.6 Testes: renderização em texto de cada parte nos estados principais (sem conta, com feudo, sem conexão, com fome) e teste de navegação por teclado da árvore.

**Verificação:**

```bash
pnpm --filter @lotg/web test -- workbench theme
```

Manual: abrir `http://localhost:5173` nos três temas.

**Pronto quando:** a página, sem conta, mostra a bancada completa e vazia nos três temas; `Tab` percorre barra de atividades, árvore, abas e barra de status nessa ordem, com foco visível.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.1, §13.2, §13.5 e §13.7 e MVP-ROADMAP.md F3W-T2. Implemente a bancada do app web com aparência de editor, a partir do modelo de árvore e da barra de status que já existem como funções puras. Use plan mode e divida em três sessões: temas e moldura; árvore e barra de status; abas e responsividade."

### F3W-T3 · Conta no navegador: boas-vindas, Jogar agora e Código do Reino `L`

**Objetivo:** o fluxo de entrada do GDD §13.9 no navegador, com a sessão dividida corretamente entre abas.
**GDD:** §13.9, §14.7, §14.10.
**Depende de:** F3W-T2.
**Entregáveis:** `packages/web/src/app/{controller,dialogs}.ts(x)`, `packages/web/src/services/{sessionLock,tabSync}.ts`, aba de boas-vindas, testes.

- [x] F3W-T3.1 `controller.ts` sem nada do VS Code: junta `AccountService`, `GameSession` e a política de notificações, com a fila de mudanças de conta e as ordens preparadas com `commandId` fixo (como em `controller.prepare` da extensão).
- [x] F3W-T3.2 Diálogos próprios do app, acessíveis (foco preso, `Esc` fecha, retorno do foco): confirmação, campo de texto com validação a cada tecla, lista de escolha. Substituem `showWarningMessage`, `showInputBox` e `showQuickPick`.
- [x] F3W-T3.3 Aba de boas-vindas: nome de quem governa, nome do feudo (sugestão "Pedra Alta"), **Jogar agora**, "Entrar com GitHub" (F3W-T8) e "Usar Código do Reino". Sem seleção de dificuldade nem ritmo na v0.1. Envia o fuso detectado e a Hora da Vigília das preferências.
- [x] F3W-T3.4 Código do Reino: gerar (diálogo com "Copiar" e aviso de exibição única), entrar (campo com a validação de formato que já existe). "Sair desta máquina" e "Excluir conta" com os mesmos textos e confirmações da extensão; a exclusão explica o bloqueio imediato, os sete dias e os 14 dias dos backups, e não oferece desfazer.
- [x] F3W-T3.5 Várias abas: a renovação da sessão acontece dentro de `navigator.locks.request('lords.refresh', …)`, relendo os tokens depois de obter o lock; sair, excluir ou perder a sessão em uma aba é percebido pelas outras (evento `storage`) e leva todas às boas-vindas. Sem a Web Locks API, vale a releitura do `TokenStore` que o SDK já faz.
- [x] F3W-T3.6 Lembrete único do dia 3 para conta anônima sem código, com "Não lembrar mais"; o texto avisa que limpar os dados de navegação apaga o acesso a uma conta sem vínculo.
- [x] F3W-T3.7 Testes: os dos módulos migrados, mais os de `sessionLock` e `tabSync` e os dos diálogos (teclado e foco).

**Verificação:** teste em navegador (F3W-T10): criar conta em um contexto de navegador; em outro, entrar com o código; o mesmo feudo aparece. Duas abas no mesmo contexto por mais de 15 minutos de relógio: nenhuma volta às boas-vindas.

**Pronto quando:** de abrir a página ao painel Feudo com uma partida nova há exatamente 2 campos e 1 clique.

**Prompt sugerido:** "Leia CLAUDE.md, o ADR 0008, GAME_DESIGN.md §13.9 e §14.7 e MVP-ROADMAP.md F3W-T3. Implemente o controlador do app, os diálogos acessíveis, a aba de boas-vindas e os fluxos Jogar agora e Código do Reino, com a sessão dividida entre abas por Web Locks. Use plan mode primeiro."

### F3W-T4 · Ciclo de atualização, cache e Relatório de Retorno no navegador `M`

**Objetivo:** o estado chega sozinho, sobrevive sem conexão e conta o que aconteceu na ausência.
**GDD:** §2.3, §13.5, §13.9, §14.10.
**Depende de:** F3W-T3.
**Entregáveis:** ajustes em `packages/web/src/game/`, `packages/web/src/services/visibility.ts`, testes.

- [x] F3W-T4.1 `GameSession` ligado à visibilidade da aba (`visibilitychange`): 30 s visível, 2 min em segundo plano; sincroniza na hora ao voltar a ficar visível e quando o navegador avisa que a rede voltou (`online`).
- [x] F3W-T4.2 Cache do `ViewState`, versão, ETag, cursor e instante da última leitura no armazenamento do navegador, separado por conta e partida, com a validação de formato ao carregar que já existe. Sair, excluir e perder a sessão apagam os caches da conta.
- [x] F3W-T4.3 Relatório de Retorno ao abrir a página depois de 4 horas ou mais: o app abre na aba Hoje; os eventos da ausência não viram notificações avulsas.
- [x] F3W-T4.4 Partida arquivada em outra máquina, `426 UPGRADE_REQUIRED` (pede para recarregar a página) e demais problemas do ciclo tratados como na extensão.
- [x] F3W-T4.5 Testes com temporizadores falsos, incluindo a troca de visibilidade.

**Verificação:**

```bash
pnpm --filter @lotg/web test -- gameSession connection returnReport visibility
```

**Pronto quando:** sem rede, o app mostra o último estado e nenhum comando é enviado ou enfileirado; ao voltar a rede, sincroniza sem recarregar a página.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.5, §13.9 e §14.10 e MVP-ROADMAP.md F3W-T4. Ligue o GameSession à visibilidade da aba e aos eventos de rede do navegador, com o cache no armazenamento local e o Relatório de Retorno."

### F3W-T5 · Abas Feudo e Hoje `M`

**Objetivo:** o painel do GDD §13.3 (subconjunto v0.1) dentro da bancada.
**GDD:** §13.3, §13.7, §14.12.
**Depende de:** F3W-T4.
**Entregáveis:** `packages/web/src/tabs/{Fief,Today,Welcome}.tsx` e os componentes migrados.

- [x] F3W-T5.1 Ligar os componentes migrados (`ResourcesTable`, `WorkersPanel`, `ConstructionsPanel`, `RecruitPanel`, `ObjectivesPanel`, `ChroniclePanel`, `Today`, banners) diretamente ao controlador, sem a ponte de mensagens da Webview. `protocol/webview.ts` deixa de ter uso e é removido, exceto `ReturnReportSchema`, que fica no protocolo.
- [x] F3W-T5.2 Tudo o que já estava nos componentes continua valendo: explicação de cada número ao passar o mouse e ao focar, `aria-live` na tabela de recursos, teclado nas linhas de trabalhadores, custos em chips com o que falta por extenso, contagem regressiva por segundo, modo leitura sem conexão.
- [x] F3W-T5.3 Largura mínima de 480 px sem rolagem horizontal, com a barra lateral recolhida.

**Verificação:** teste em navegador: `+` na Fazenda muda a taxa em menos de 1 s; a contagem regressiva termina junto com a conclusão da obra.

**Pronto quando:** nenhuma cor fixa fora de `theme/themes.css` e o painel funciona em 480 px.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.3 e §13.7 e MVP-ROADMAP.md F3W-T5. Ligue os componentes migrados da Webview ao controlador do app, como conteúdo das abas Hoje e Feudo."

### F3W-T6 · Paleta de comandos e atalhos `M`

**Objetivo:** jogar inteiramente pelo teclado.
**GDD:** §13.6.
**Depende de:** F3W-T5.
**Entregáveis:** `packages/web/src/palette/{CommandPalette.tsx,commands.ts}`, testes.

- [x] F3W-T6.1 Paleta que abre com `F1` e `Ctrl+K`, com busca por texto, setas, `Enter` e `Esc`; foco preso enquanto aberta. Não usa `Ctrl+Shift+P` nem `Ctrl+P`, reservados pelo navegador.
- [x] F3W-T6.2 Os comandos da v0.1 (GDD §13.6), cada um com prefixo "Lords:": ir para o Feudo e para Hoje, alocar trabalhadores (lista de edifícios → campo com a taxa resultante), construir ou melhorar (lista com custo, tempo e cadeado), cancelar e planejar obra, recrutar (com as vagas no texto), renomear o feudo, nova partida (com confirmação), abrir e baixar a Crônica, atualizar agora, modo discreto, silenciar notificações, trocar tema, conta (vincular, Código do Reino, sair, excluir), privacidade e sobre.
- [x] F3W-T6.3 Recusas do motor aparecem como aviso com a frase em português; erro de rede, como erro com "Tentar de novo", que reenvia a mesma ordem.
- [x] F3W-T6.4 Testes: filtro e navegação da paleta; toda ação da árvore e do painel tem um comando equivalente.

**Verificação:** teste em navegador: uma partida inteira dos objetivos 1 a 4 só com o teclado.

**Pronto quando:** cada comando listado tem implementação e aparece na paleta com o prefixo "Lords:".

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.6 e MVP-ROADMAP.md F3W-T6. Implemente a paleta de comandos do app, com os comandos da v0.1 reaproveitando a lógica que estava em packages/extension/src/commands."

### F3W-T7 · Notificações e modo discreto `S`

**Objetivo:** avisar o essencial, nunca incomodar.
**GDD:** §13.5.
**Depende de:** F3W-T6.
**Entregáveis:** `packages/web/src/notifications/{Toasts.tsx,browserNotifications.ts}`, testes.

- [x] F3W-T7.1 Avisos no canto inferior direito, com os botões `[Ver]` e `[Silenciar 2h]`, decididos por `notifications/policy.ts` (sem mudança): `silent`, `essential` (só a fome na v0.1) e `all`; no máximo 3 por hora; o excedente vira badge.
- [x] F3W-T7.2 Com a aba em segundo plano, o contador de novidades aparece no título da aba. Notificações do navegador são opcionais: a permissão só é pedida quando o jogador liga a opção nas preferências.
- [x] F3W-T7.3 Modo discreto: a barra de status e o título da aba mostram só um contador, e nenhum aviso aparece.
- [x] F3W-T7.4 Testes do que é novo (título da aba, permissão pedida só sob demanda).

**Verificação:**

```bash
pnpm --filter @lotg/web test -- policy toasts
```

**Pronto quando:** com `all`, concluir 5 obras em uma hora gera 3 avisos e badge "2".

**Prompt sugerido:** "Leia GAME_DESIGN.md §13.5 e MVP-ROADMAP.md F3W-T7. Implemente os avisos do app sobre a política de notificações que já existe, o contador no título da aba, as notificações do navegador opcionais e o modo discreto."

### F3W-T8 · Vínculo GitHub pelo navegador `M`

**Decisão sua antes de começar:** registrar um OAuth App no GitHub com *device flow* habilitado e informar o `GITHUB_CLIENT_ID`. Se preferir deixar o GitHub fora da v0.1, esta tarefa sai e o Código do Reino passa a ser a única forma de trocar de máquina (ADR 0008, ponto 2).
**GDD:** §13.9, §14.5, §14.7.
**Depende de:** F3W-T3.
**Entregáveis:** `packages/server/src/auth/githubDevice.ts`, rotas `POST /v1/auth/github/device` e `/device/poll`, schemas em `@lotg/protocol`, métodos no `client-sdk`, diálogo no app, testes.

- [x] F3W-T8.1 Servidor: as duas rotas repassam a chamada a `${GITHUB_OAUTH_URL}/login/device/code` e `/login/oauth/access_token` com o `GITHUB_CLIENT_ID` e o escopo `read:user`; limite de taxa por IP; sem `GITHUB_CLIENT_ID`, respondem 404 e o app esconde o botão. Nenhum segredo é usado e nada é guardado. `fetch` injetável nos testes, como em `auth/github.ts`.
- [x] F3W-T8.2 Protocolo e SDK: corpos e respostas das duas rotas; `client.startGithubDevice()` e `client.pollGithubDevice(deviceCode)`.
- [x] F3W-T8.3 App: diálogo que mostra o código, o botão "Copiar" e o link para `github.com/login/device`; consulta no intervalo que o GitHub informar, respeitando `slow_down`; trata expiração e recusa. Com o token, chama `POST /auth/github`; o conflito de conta usa a lista de escolha que já existe (`conflictOptions`).
- [x] F3W-T8.4 Testes de integração do servidor (GitHub simulado) e do app (fluxo completo com o servidor de teste). Atualizar a política de privacidade: o token do GitHub passa pelo servidor na ida e não é guardado.

**Verificação:**

```bash
TEST_DATABASE_URL=… pnpm test:integration -- github
```

Manual, uma vez, com o OAuth App real: vincular em um navegador e entrar em outro.

**Pronto quando:** vincular em um navegador e "Entrar com GitHub" em outro mostra o mesmo feudo.

**Prompt sugerido:** "Leia CLAUDE.md, o ADR 0008, GAME_DESIGN.md §14.5 e §14.7 e MVP-ROADMAP.md F3W-T8. Implemente o device flow do GitHub: duas rotas de repasse no servidor, os contratos no protocolo e no SDK e o diálogo no app, com GitHub simulado nos testes."

### F3W-T9 · Crônica, preferências, sobre e build de produção `S`

**Objetivo:** fechar as superfícies que faltam e produzir os arquivos estáticos.
**GDD:** §13.1, §13.6, §14.13, §14.14.
**Depende de:** F3W-T7.
**Entregáveis:** `packages/web/src/tabs/{Chronicle,Settings,About}.tsx`, `packages/web/README.md`, alvo `web` no `deploy/Dockerfile`.

- [x] F3W-T9.1 Aba Crônica: o Markdown de `GET /chronicle.md` exibido como texto formatado (títulos e lista, sem interpretar HTML) e o comando "Baixar Crônica (Markdown)".
- [x] F3W-T9.2 Aba de preferências (notificações, modo discreto, tema, Hora da Vigília) e "Sobre" (versão do app, do servidor e hash do conteúdo, lidos de `/v1/version`).
- [x] F3W-T9.3 Item "Privacidade" na conta, com o texto do GDD §14.14 ajustado ao navegador (credenciais e cache no armazenamento do navegador; limpar os dados de navegação os apaga).
- [x] F3W-T9.4 `pnpm build` gera `packages/web/dist`; alvo `web` no `Dockerfile` que constrói o app e o entrega a uma imagem do Caddy. `README.md` do pacote: como rodar, como testar, estrutura.
- [x] F3W-T9.5 Ícone e nome exibido são provisórios até a sua decisão; o app não usa o nome nem o logotipo do Visual Studio Code.

**Verificação:**

```bash
pnpm build && ls packages/web/dist && docker build -f deploy/Dockerfile --target web -t lotg-web:latest .
```

**Pronto quando:** os arquivos de `dist` servidos por um servidor estático qualquer, com `/v1` encaminhado para a API, chegam ao painel Feudo com **Jogar agora**.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F3W-T9 e GAME_DESIGN.md §13.6 e §14.14. Implemente as abas Crônica, preferências e sobre, o item de privacidade e o build de produção do app, com o alvo web no Dockerfile."

### F3W-T10 · Testes em navegador real e roteiro manual `M`

**Objetivo:** provar os critérios de aceitação em um navegador de verdade, o que a extensão não permitia.
**GDD:** §16.1 (critérios 1 a 12), §15.4.
**Depende de:** F3W-T9 (e F3W-T8, se o GitHub entrar).
**Entregáveis:** `tests/e2e/*.spec.ts`, `playwright.config.ts`, `pnpm test:e2e`, job de CI, `docs/manual-test-v0.1.md` reescrito.

- [x] F3W-T10.1 Playwright com Chromium sem interface, subindo a API (com relógio controlável só em ambiente de teste) e o app. Um arquivo por grupo de critérios da §8.
- [x] F3W-T10.2 Cenários: primeira abertura e "Jogar agora" com o tempo medido; alocar, construir e recrutar pelo painel, pela árvore e pela paleta; recusas visíveis; obra que termina sozinha; fechar e reabrir com Relatório de Retorno; sem conexão e volta; Código do Reino em outro contexto de navegador; duas abas; sair e excluir conta; partida inteira dos objetivos só pelo teclado.
- [x] F3W-T10.3 Temas e acessibilidade: capturas de tela dos três temas guardadas como artefato; verificação automática de contraste e de rótulos ARIA nas telas principais; nada de rolagem horizontal a 480 px.
- [x] F3W-T10.4 Cobertura ≥ 80% nos módulos puros de `packages/web`.
- [x] F3W-T10.5 `docs/manual-test-v0.1.md` reescrito para o navegador: o que os testes automáticos já provam e o que resta para olhos humanos (aparência dos temas, sensação da paleta, leitura do Relatório de Retorno).
- [x] F3W-T10.6 Job `e2e` na CI.

**Verificação:**

```bash
pnpm dev:up && pnpm test:e2e
```

**Pronto quando:** os 12 critérios têm teste em navegador ou item no roteiro manual, e `pnpm test:e2e` passa do zero em uma máquina limpa.

**Prompt sugerido:** "Leia MVP-ROADMAP.md §8 e F3W-T10 e GAME_DESIGN.md §16.1. Configure o Playwright, escreva os testes em navegador real para os critérios de aceitação e reescreva o roteiro manual para o que os testes não cobrem."


---

## 6. Fase 4 — Implantação e operação

**Meta da fase:** o jogo acessível em `https://<domínio>`: o app web em `/` e a API em `/v1`, com TLS, backup diário testado e procedimento de atualização e reversão.

> **Replanejada em 2026-10-01 pelo [ADR 0009](docs/decisions/0009-implantacao-no-coolify.md):** a hospedagem deixa de ser um VPS com Docker Compose e Caddy na borda e passa a ser o Coolify, em três recursos (`lotg-db`, `lotg-api`, `lotg-web`). As tarefas abaixo mantêm os números e os objetivos; mudam os meios. Não existem `deploy/docker-compose.yml`, `backup.sh` nem `restore.sh`: o proxy, o backup agendado e a reversão são da plataforma.

### F4-T1 · Recursos de produção, rotas e variáveis `M`

**GDD:** §14.13, §14.14.
**Depende de:** F2-T9, F3W-T9.
**Entregáveis:** os três recursos no Coolify, `deploy/web.Caddyfile`, `deploy/.env.example` (seção produção), `deploy/README.md`.

- [x] F4-T1.1 Recursos: `lotg-db` (`postgres:16`, volume persistente, **sem porta publicada**), `lotg-api` (repositório, `deploy/Dockerfile`, alvo `runtime`, porta 3000) e `lotg-web` (alvo `web`, porta 80), no mesmo projeto e ambiente.
- [x] F4-T1.2 Rotas e cabeçalhos: o proxy da plataforma termina o TLS e redireciona HTTP para HTTPS; `https://<domínio>/v1` vai para a API **sem remover o prefixo** e o resto para o app; `TRUST_PROXY=true` na API. `web.Caddyfile` responde `index.html` a rotas desconhecidas, dá cache longo só aos arquivos com hash no nome e envia `Content-Security-Policy` igual à do `index.html`, `Strict-Transport-Security`, `X-Content-Type-Options nosniff` e `Referrer-Policy no-referrer`.
- [x] F4-T1.3 `deploy/README.md`: os dez passos de implantação (GDD §18.4 expandido), geração de segredos, como ver logs, como entrar no `psql`.
- [x] F4-T1.4 Conferência em produção no lugar do ensaio local: `/v1/health` e `/v1/version` em HTTPS e, em um navegador real, **Jogar agora** até Pedra Alta, sem erro no console e sem requisição a outra origem. `pnpm test:e2e` não roda contra produção: depende das rotas `/__test`, que só existem no servidor de teste.

**Verificação:**

```bash
curl -s https://<domínio>/v1/health && curl -s https://<domínio>/v1/version
curl -sI https://<domínio>/ | grep -i 'content-security-policy\|strict-transport-security'
```

**Pronto quando:** nenhum segredo real está no repositório (`git grep -i secret` só encontra nomes de variáveis, nunca valores).

**Prompt sugerido:** "Leia GAME_DESIGN.md §14.13, §14.14 e §18.4, o ADR 0009 e MVP-ROADMAP.md F4-T1. Confira os três recursos no Coolify pelo MCP e pela API, as rotas e os cabeçalhos, e atualize o deploy/README.md."

### F4-T2 · Backup e restauração `S`

**GDD:** §14.6 (backup).
**Depende de:** F4-T1.
**Entregáveis:** agendamento de backup no Coolify, `deploy/ensaio-restauracao.yml`, seção no `deploy/README.md`.

- [x] F4-T2.1 Backup agendado do `lotg-db`: `pg_dump` em formato custom, `0 3 * * *` (UTC), retenção de 14 dias; falha gera aviso da plataforma.
- [x] F4-T2.2 `ensaio-restauracao.yml`: serviço que roda uma vez, restaura o backup mais recente com `pg_restore --clean --if-exists` em um banco descartável e imprime as contagens de `accounts` e `games`. O procedimento de restauração em produção está em `deploy/README.md`.
- [x] F4-T2.3 Ensaio de restauração documentado com data em `deploy/README.md`.
- [ ] F4-T2.4 Destino S3 para os backups: hoje eles ficam no mesmo disco do banco (decisão e credenciais do autor).

**Verificação:** restaurar o backup em um banco de ensaio, apagar uma conta, restaurar de novo e ver a conta de volta.

**Pronto quando:** o ensaio de restauração está registrado com data e resultado.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F4-T2 e deploy/README.md. Refaça o ensaio de restauração no ambiente `ensaio` do Coolify com deploy/ensaio-restauracao.yml e registre o resultado."

### F4-T3 · Colocar no ar `M`

**Decisões suas antes de começar:** servidor e domínio (tomadas: Coolify em `app.palsincomehub.com`, jogo em `lords.palsincomehub.com`).
**GDD:** §14.13, §18.4.
**Depende de:** F4-T2, F3W-T10.
**Entregáveis:** jogo no ar; `deploy/README.md` com o registro da instalação.

- [x] F4-T3.1 Registro DNS do domínio apontando para o servidor; certificado emitido pelo proxy.
- [x] F4-T3.2 Variáveis da API definidas no Coolify, com `JWT_SECRET` e `RECOVERY_CODE_SECRET` gerados separadamente e `PUBLIC_URL` igual ao endereço público.
- [x] F4-T3.3 Deploy dos três recursos; `/v1/health` 200 em HTTPS; migrações aplicadas no arranque.
- [x] F4-T3.4 Backup agendado; limpeza diária de imagens e contêineres sem uso pela plataforma.
- [ ] F4-T3.5 `GITHUB_CLIENT_ID` definido e o OAuth App conferido. Por decisão do autor, o vínculo GitHub fica **desligado** por ora (`features.githubDevice: false`).
- [ ] F4-T3.6 Cópia de `RECOVERY_CODE_SECRET` guardada fora do Coolify (só o autor pode fazer).

**Verificação:**

```bash
curl -s https://<domínio>/v1/health && curl -s https://<domínio>/v1/version
```

Abrir `https://<domínio>` em um navegador limpo, clicar em Jogar agora e ver Pedra Alta.

**Pronto quando:** uma pessoa fora da sua máquina joga pela internet.

**Prompt sugerido:** "Leia GAME_DESIGN.md §18.4, o ADR 0009 e MVP-ROADMAP.md F4-T3. Confira a instalação no Coolify, faça o deploy do `main` e o teste em navegador contra o domínio. Não guarde segredos no repositório."

### F4-T4 · Observabilidade mínima `S`

**GDD:** §14.13.
**Depende de:** F4-T3.
**Entregáveis:** monitor de disponibilidade configurado, alertas de disco, seção "Operação" no `deploy/README.md`.

- [x] F4-T4.1 Monitor externo de `GET /v1/health` com aviso por e-mail: workflow agendado `.github/workflows/health.yml`. O intervalo real do agendamento do GitHub é de 5 a 15 minutos, não de 1 minuto.
- [x] F4-T4.2 Avisos da plataforma marcados para disco acima de 80%, falha de backup, falha de deploy e servidor inalcançável.
- [ ] F4-T4.3 Canal de notificação do Coolify ligado (e-mail, Telegram ou Discord). Por decisão do autor, por ora só o GitHub avisa: sem canal, os avisos de F4-T4.2 não saem.
- [x] F4-T4.4 Cheat-sheet de operação em `deploy/README.md` e consultas úteis (`contas por dia`, `partidas ativas`, `comandos por hora`) em `deploy/analytics/ops.sql`.

**Verificação:** derrubar a API por alguns minutos gera o alerta e a recuperação.

**Pronto quando:** você recebeu um alerta de teste.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F4-T4 e deploy/README.md. Confira o workflow de saúde, ligue um canal de notificação do Coolify e faça o teste de alerta parando a API."

### F4-T5 · Atualização, reversão e versão de produção `S`

**GDD:** §14.13.
**Depende de:** F4-T4.
**Entregáveis:** procedimento em `deploy/README.md`, tags Git.

- [x] F4-T5.1 Procedimento de atualização: deploy de `lotg-api` e `lotg-web` a partir do `main`; conferir `/v1/version`.
- [x] F4-T5.2 Reversão para a imagem do deploy anterior pelo rollback do Coolify em menos de 2 minutos; regra: migrações sempre compatíveis com a versão anterior (expandir, depois contrair).
- [x] F4-T5.3 Ensaio: reverter a API para a versão anterior, confirmar, voltar.
- [ ] F4-T5.4 `git tag v0.1.x` a cada release (a primeira tag é de F5-T4).

**Verificação:** ensaio de reversão registrado com tempo medido.

**Pronto quando:** a reversão ensaiada levou menos de 2 minutos sem perda de dados.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F4-T5 e deploy/README.md. Ensaie a atualização e a reversão da API no Coolify, medindo o tempo, e registre."

---

## 7. Fase 5 — Fechamento do MVP v0.1

**Meta da fase:** os 12 critérios de aceitação do GDD §16.1 comprovados em produção, um playtest real de 48 horas, correções, versão etiquetada e o caminho para a v0.2 aberto.

### F5-T1 · Critérios de aceitação em produção `M`

**Depende de:** F4-T5.
**Entregáveis:** `docs/acceptance-v0.1.md`.

- [ ] F5-T1.1 Rodar `pnpm test:e2e` contra a produção e executar o roteiro de `docs/manual-test-v0.1.md` em dois navegadores, registrando evidência por critério.
- [ ] F5-T1.2 Rodar o teste de concorrência e idempotência (F2-T6.7) e o `sim-cli --remote` com 20 bots contra produção por 2 minutos, com p95 registrado.
- [ ] F5-T1.3 Qualquer critério falho vira item em F5-T3 com prioridade P0.

**Pronto quando:** os 12 critérios marcados como aprovados com evidência.

**Prompt sugerido:** "Leia MVP-ROADMAP.md §8 e F5-T1 e docs/manual-test-v0.1.md. Conduza a verificação dos 12 critérios de aceitação contra a produção, me pedindo as evidências manuais e rodando as automáticas, e registre tudo em docs/acceptance-v0.1.md."

### F5-T2 · Playtest de 48 horas `M`

**Depende de:** F5-T1.
**Entregáveis:** `docs/playtest-v0.1.md` com achados priorizados.

- [ ] F5-T2.1 3 a 5 pessoas recebem o endereço e jogam dois dias; formulário curto (o que confundiu, o que faltou, quando sentiu vontade de voltar).
- [ ] F5-T2.2 Consultas agregadas (`deploy/analytics/ops.sql`): sessões por dia, comandos por sessão, tempo até o primeiro comando, proporção de contas que voltaram no dia 2.
- [ ] F5-T2.3 Achados classificados: P0 (bloqueia), P1 (atrapalha), P2 (melhoria), P3 (v0.2+).

**Pronto quando:** o relatório existe e tem ao menos uma métrica de retorno no dia 2.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F5-T2. Prepare o formulário de feedback do playtest, as consultas SQL agregadas e o modelo de docs/playtest-v0.1.md; depois me ajude a consolidar os achados que eu colar."

### F5-T3 · Correções e balanceamento inicial `M`

**Depende de:** F5-T2.
**Entregáveis:** commits de correção, conteúdo ajustado, goldens atualizados.

- [ ] F5-T3.1 Todos os P0 e P1 corrigidos com teste de regressão.
- [ ] F5-T3.2 Balanceamento via `sim-cli` (F1-T10.3): se a faixa do bot "2 sessões/dia" ficou fora, ajustar `@lotg/content` e atualizar goldens com justificativa no commit.
- [ ] F5-T3.3 `pnpm verify` e `pnpm test:integration` verdes; nova release pelo procedimento de F4-T5.

**Pronto quando:** zero P0/P1 abertos e o relatório de desempenho reconfirmado.

**Prompt sugerido:** "Leia docs/playtest-v0.1.md e MVP-ROADMAP.md F5-T3. Corrija os P0 e P1 um por vez, cada um com teste de regressão e commit próprio; depois rode o sim-cli e proponha ajustes de conteúdo."

### F5-T4 · Documentação, versão e release `S`

**Depende de:** F5-T3.
**Entregáveis:** `README.md` final, `docs/architecture.md`, índice de ADRs, tag `v0.1.0`, release.

- [ ] F5-T4.1 `README.md` raiz: o que é, como jogar, como desenvolver (comandos da §1.4), como implantar (link para `deploy/README.md`), licença.
- [ ] F5-T4.2 `docs/architecture.md` com o diagrama do GDD §14.1 atualizado para o que foi construído e a lista de divergências aceitas.
- [ ] F5-T4.3 `CHANGELOG.md`, tag `v0.1.0`, release no GitHub.

**Pronto quando:** um desenvolvedor novo segue o README e chega a `pnpm verify` verde sem perguntar nada.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F5-T4. Finalize README, docs/architecture.md e CHANGELOG, e prepare a tag v0.1.0 (me mostre os comandos antes de criar a tag)."

### F5-T5 · Preparar a v0.2 `S`

**Depende de:** F5-T4.
**Entregáveis:** `docs/roadmap-v0.2.md` (esqueleto).

- [ ] F5-T5.1 Esqueleto no mesmo formato deste arquivo com as tarefas da v0.2 (GDD §16.2): efeitos de estação, Celeiro e Armazém com caps, moral, troca de ofício, cartas do Conselho e cadeias, Torre de Vigia, Paliçada, lobos e Ameaça, dificuldade e ritmo.
- [ ] F5-T5.2 Seção "O que o MVP ensinou" com as lições do playtest e as dívidas técnicas registradas.

**Pronto quando:** a primeira tarefa da v0.2 está detalhada o bastante para abrir a sessão seguinte.

**Prompt sugerido:** "Leia GAME_DESIGN.md §16.2 e MVP-ROADMAP.md inteiro. Crie docs/roadmap-v0.2.md no mesmo formato, com as tarefas da v0.2 e a seção de lições do MVP."

---

## 8. Mapa dos critérios de aceitação (GDD §16.1) para tarefas

| # | Critério | Tarefas que o entregam | Como provar |
|---|---|---|---|
| 1 | Abrir o endereço, Jogar agora e primeiro comando em menos de 30 s, sem instalar nada | F2-T4, F2-T6, F3W-T3, F3W-T5 | Teste em navegador, com o tempo medido |
| 2 | Alocar um trabalhador muda a taxa imediatamente e reduz os livres | F1-T3, F1-T6, F1-T9, F3W-T5 | Teste de unidade + teste em navegador |
| 3 | Não alocar mais que a população nem gastar o que não existe; motivo visível | F1-T7, F3W-T5, F3W-T6 | Testes de recusa + teste em navegador |
| 4 | Melhoria desconta uma vez, ocupa a fila e conclui no tempo | F1-T5, F2-T6 | Testes + evento em `game_events` |
| 5 | Reabrir a aba após horas simula o intervalo sem duplicar; divisão de intervalo exata | F1-T3, F1-T4, F2-T6, F3W-T4 | Teste de propriedade + teste em navegador com relógio controlado |
| 6 | Escassez correta em longos períodos, com instante exato na Crônica | F1-T4, F1-T8 | Teste de 30 dias |
| 7 | Recibo original após reinício/reenvio; UUID conflitante recusado; avanço preservado em recusa; dois clientes não corrompem | F2-T6, F2-T7, F2-T8, F3-T1 | Testes F2-T6.7–10 + `docker compose restart` |
| 8 | Regras rodam em testes sem navegador nem servidor | F1-T1 a F1-T11 | `pnpm --filter @lotg/engine test` |
| 9 | Temas claro, escuro e alto contraste; navegável por teclado, inclusive a paleta | F3W-T2, F3W-T5, F3W-T6 | Teste em navegador (teclado, contraste) + olhar humano nas capturas |
| 10 | GitHub ou Código do Reino em outra máquina mostra o mesmo feudo | F2-T5, F3W-T3, F3W-T8 | Teste em navegador com dois contextos; GitHub real, manual |
| 11 | Sem conexão: último estado, explicação, retorno automático | F3W-T4, F3W-T5 | Teste em navegador derrubando a API |
| 12 | Excluir conta bloqueia na hora e remove tudo depois de sete dias | F2-T4, F2-T7, F3W-T3 | Teste de integração + teste em navegador com duas abas |

---

## 9. Registro de execução

Preencher ao fechar cada tarefa (o agente faz isso no ritual da §0.3).

| Tarefa | Data | Commit | Sessões | Observações e desvios |
|---|---|---|---|---|
| F0-T1 | 2026-10-01 | `ecbda5a` | 1 | Docker 29.8, Compose v5.5, Node 22.22.3, pnpm 9.15.9. O default do `nvm` continua em 24 (`nvm alias default 22` não foi executado para não afetar outros projetos): o repositório seleciona o 22 pelo `.nvmrc` (`nvm use`) e o pnpm 9 pelo campo `packageManager`. Extensão Docker do VS Code instalada. |
| F0-T2 | 2026-10-01 | `737f9b8` | 1 | `pnpm verify` verde com 8 testes, também em cópia limpa. Vitest 5 removeu `vitest.workspace.ts`: os projetos `unit` e `integration` ficam em `vitest.config.ts`. TypeScript fixado em 6.x (o `typescript-eslint` ainda não aceita o 7). `dev:api`, `db:migrate`, `dev:ext` e `sim` existem e avisam a tarefa que os entrega. |
| F0-T3 | 2026-10-01 | `96ac531` | 1 | Sessão nova (`claude -p`) resumiu motor puro, conteúdo como dados, `pnpm verify` e bibliotecas permitidas sem correção. O `CLAUDE.md` mantém os contratos dos ADRs 0003–0005 além do modelo da §A.1. |
| F0-T4 | 2026-10-01 | `ea7632d` | 1 | `db` e `db_test` saudáveis em 18 s; `select 1` responde; imagem `runtime` constrói (326 MB, usuário `node`). O `CMD` falha até F2-T2, como previsto. O ignore do build é `deploy/Dockerfile.dockerignore`, e não `deploy/.dockerignore`, porque o contexto é a raiz do repositório. Bancos de dev com senha fixa `lotg`; `POSTGRES_PASSWORD` vale só para o compose de produção. |
| F0-T5 | 2026-10-01 | `7b379b5` | 1 | Workflow escrito e os comandos dos três jobs rodados localmente com sucesso. **Verificação pendente:** nenhum push foi feito, então os jobs ainda não rodaram no GitHub e o badge não foi conferido. |
| F1-T1 | 2026-10-01 | `87717e4` | 1 | Conteúdo da v0.1 com schemas zod (21 testes) e tipos do `GameState`. Fatores guardados como frações inteiras (16/10, 3/2, 3/4) para o motor não usar ponto flutuante. Estado inicial com os 5 aldeões livres: o objetivo 1 é que ensina a alocar. ADR 0002 criado. |
| F1-T2 | 2026-10-01 | `ad76fd9` | 1 | Relógio, linha do tempo e laço de `advanceTo`. 30 dias de uma vez ≡ 720 passos de 1 h (estado e eventos estritamente iguais). Ordem fixa no mesmo instante: obras, aldeões, ano, estação, dia, objetivos, fome. Entregue no mesmo commit de F1-T3 a F1-T8. |
| F1-T3 | 2026-10-01 | `ad76fd9` | 1 | Taxas em milésimos/h e acumuladores inteiros com truncamento em direção a zero. Propriedade de divisão de intervalo com 500 execuções e cortes em qualquer milissegundo, sem contraexemplo. |
| F1-T4 | 2026-10-01 | `ad76fd9` | 1 | Fome como evento da linha do tempo. Teste de 30 dias registra `famineStarted` em 41.657.142 ms, igual à conta feita à mão. O fim usa o saldo de comida já com a penalidade de 0,75. |
| F1-T5 | 2026-10-01 | `ad76fd9` | 1 | `upgradeQuote`: Serraria 1→2 = 100 madeira, 50 pedra, 300 s; Habitações 2→3 = 128 madeira, 32 pedra, 360 s. Custos por conta inteira, conferidos contra `arredondar(base × fator^(n−1))` em todos os níveis. O teto de 8 h não é alcançado por nenhum edifício da v0.1 (testado direto na fórmula). |
| F1-T6 | 2026-10-01 | `ad76fd9` | 1 | Recrutar 3 com 1 vaga é recusado com `HOUSING_FULL` sem descontar nada. Decisão: um item de fila e um evento `recruitmentFinished` por aldeão. |
| F1-T7 | 2026-10-01 | `ad76fd9` | 1 | 17 códigos de recusa, um teste por código; `commands.ts` e `rejections.ts` com 100% de linhas. `setWorkers`, `planConstruction` e `unplanConstruction` não geram evento. |
| F1-T8 | 2026-10-01 | `ad76fd9` | 1 | Cenário roteirizado conclui os quatro objetivos com +20 ouro, +30 madeira, +40 comida e +50 ouro. Frases fixadas em `__golden__/chronicle-objectives.txt`. "Recrute 3 aldeões" conta os que chegaram, não os encomendados. |
| F1-T9 | 2026-10-01 | `e432b88` | 1 | Golden com três retratos: estado inicial, primeira alocação (2 na Fazenda: comida +15/h) e fim do cenário dos objetivos. `available` lista as seis melhorias; no início, quatro são pagáveis (Salão e Mina de Ouro não cabem nos recursos iniciais do GDD §5.2). `deriveViewState` aceita um instante futuro e avança uma cópia. |
| F1-T10 | 2026-10-01 | `01ccafd` | 1 | Golden de 7 dias com 38 ordens (5 recusadas de propósito), fome e virada do ano. `sim` com a semente `pedra-alta-golden`: 168 linhas de dados, população 26, Salão Nv3, nenhuma fome; duas execuções com `diff` vazio. As faixas passaram sem ajuste de conteúdo. O CSV sai no stdout (`pnpm -s sim`). O bot termina a semana com ~10.000 de madeira parada: sem caps de estoque (v0.2), o excedente não tem saída. |
| F1-T11 | 2026-10-01 | `f5d171a` | 1 | API pública fechada e conferida por teste; pureza por teste e por lint; cobertura do motor de 99,76% de linhas. Lacunas registradas: (1) a v0.1 não tem gerador de RNG, porque nenhuma regra sorteia (o GDD §18.1 item 3 pede fluxos nomeados; o estado já tem o campo `rng`); (2) ADR 0006 propõe `@types/node` e aguarda aprovação. |
| F2-T1 | 2026-10-01 | `2b20231` | 1 | Schemas zod de comandos, `ViewState`, API, erros e mensagens da Webview (34 testes). Mudar o `Command` do motor quebra o `pnpm typecheck` do protocolo (conferido). O protocolo valida só a forma; faixas e regras ficam com o motor, que recusa em português. Acrescentei `canonicalJson`, base do `request_hash` e do ETag. Entregue no mesmo commit de F2-T2 a F2-T7, para o lockfile ficar coerente. |
| F2-T2 | 2026-10-01 | `2b20231` | 1 | `/v1/health` e `/v1/version` respondem; com o `db` parado, a saúde vira 503 em menos de 1 s. Variável nova `TRUST_PROXY` (padrão falso): sem ela, atrás do Caddy todos dividiriam os limites por IP. `@types/node` e `@types/pg` adotados sem aprovação explícita (ADR 0006). Uma revisão independente do servidor (subagente, só leitura) não achou divergência de contrato, mas apontou sete defeitos de concorrência e robustez, todos corrigidos com teste em `packages/server/test/hardening.test.ts`: deadlock entre comando e exclusão de conta (ordem de locks), job travado por uma partida com erro, processo caindo quando o banco cai com conexão em uso, texto com caractere nulo virando 500, corrida no vínculo GitHub, SQL e parâmetros em logs de erro, e `X-Forwarded-For` confiado por inteiro. `/v1/health` com o banco fora responde 503 com `{ status: 'ok', db: 'down' }`, como no roadmap. Ficaram de fora: `GET /catalog` (GDD §14.5, sem tarefa no roadmap) e o tempo de jogo efetivo do comando quando o relógio do servidor anda para trás (o replay pelo log usaria `server_time`). |
| F2-T3 | 2026-10-01 | `2b20231` | 1 | Sete tabelas mais a de controle do Drizzle; migração aplicada duas vezes e por dois processos ao mesmo tempo sem erro. O arquivo é `0000_init.sql` (numeração do drizzle-kit), não `0001_init.sql`. |
| F2-T4 | 2026-10-01 | `2b20231` | 1 | 55 testes de integração escritos por um subagente a partir da documentação, sem divergências. Reuso de `R0` após duas rotações revoga `R2` e os JWTs, inclusive na segunda instância; outra sessão segue válida. JWT expirado responde `UNAUTHORIZED`; sessão revogada ou conta excluída, `SESSION_REVOKED`. `DELETE /me` também zera `github_id`. |
| F2-T5 | 2026-10-01 | `2b20231` | 1 | 52 testes de integração (subagente), sem divergências. Recuperar com o código devolve a mesma conta; a 6ª tentativa em uma hora devolve 429. Login por GitHub sem sessão e com `github_id` desconhecido responde 404 (a documentação não define esse caso). |
| F2-T6 | 2026-10-01 | `2b20231` | 1 | 90 testes de integração (subagente). Concorrência de 10 comandos passou nas 20 repetições; `GET /view` sem eventos não gera `UPDATE`. Um teste apontou que a Crônica omitia as viradas de dia: o filtro saiu, para seguir "uma linha por evento", e virou a proposta do ADR 0007. Acrescentei `?year=` em `/chronicle` (GDD §14.5). Partida arquivada responde 409 em `/view` e comandos novos. |
| F2-T7 | 2026-10-01 | `2b20231` | 1 | 42 testes de esquema e jobs (subagente), sem divergências. Jobs testados por chamada direta com relógio injetado. Com `ADVANCE_JOB_INTERVAL_MS=1000` em dev, o agendador real avançou uma partida abandonada 12 vezes em 12 s sem nenhuma requisição; o evento de virada de dia em si (2 h reais) só foi conferido com o relógio injetado. |
| F2-T8 | 2026-10-01 | `f74b245` | 1 | Cinco cenários de ponta a ponta em `tests/server/`. Carga com 50 bots por 2 min: p95 de 7,8 ms em `/view` e 14,1 ms em `/commands` (metas 50 e 80). Com os bots em rajada sincronizada, as metas não são atingidas (81,6 e 147,4 ms); detalhes em `docs/perf-v0.1.md`. O modo remoto usa `fetch` direto até existir o `client-sdk`. |
| F2-T9 | 2026-10-01 | `e3dd414` | 1 | Imagem construída com `--no-cache` sobe saudável em 2 s, usuário `node`; 10 bots contra o contêiner sem erros. O servidor vai inteiro em `dist/main.js` (esbuild), sem `node_modules`: o sistema de arquivos tem 235 MB (a base tem 232). O `docker image ls` desta máquina mostra 330 MB, por conta do armazenamento do Docker Desktop. |
| F3-T1 | 2026-10-01 | `ea260bd` | 1 | 33 testes com `fetch` simulado. 5 chamadas simultâneas com token expirado disparam exatamente 1 `POST /auth/refresh`. O `sim-cli --remote` passou a jogar pelo SDK (10 bots contra a API local, sem erros). |
| F3-T2 | 2026-10-01 | `ea260bd` | 1 | `pnpm build` produz `dist/extension.js` (CommonJS, 494 kB) e `media/webview.{js,css}`. Uma revisão independente do cliente (subagente, só leitura) apontou 12 defeitos confirmados e 6 riscos, tratados com teste: refresh repetido às cegas dentro das retentativas; duas janelas do VS Code revogando a sessão uma da outra (o SDK agora relê o `TokenStore` antes de renovar; a corrida exata entre dois processos ainda é possível); "Entrar com GitHub" preso nas boas-vindas; partida arquivada em outra máquina nunca revalidada; "Tentar de novo" com `commandId` novo; clique na árvore iniciando obra; painel abrindo sozinho na inicialização; boas-vindas travadas após sair sem conexão; leitura em voo sobrescrevendo a visão de um comando; cache de partidas arquivadas sobrevivendo ao logout; `lords.serverUrl` sobrescrevível por workspace; ciclo em 2 min após trocar de servidor. **Não verificado:** F5 e a ativação em um VS Code real. A ativação foi exercitada por `tests/client/extension.test.ts`, com um editor de mentira contra o servidor real. Entregue no mesmo commit de F3-T3 a F3-T8. **Substituída pelo ADR 0008** (cliente web); o trabalho reaproveitável migra em F3W-T1. |
| F3-T3 | 2026-10-01 | `ea260bd` | 1 | Do painel de boas-vindas ao Feudo: 2 campos, 1 clique e 2 requisições (testado). GitHub, conflito e Código do Reino testados com o editor de mentira; o login real do GitHub não. Sem seleção de dificuldade nem ritmo. Não há comando para renomear quem governa (o servidor aceita; nenhuma tarefa pede). **Substituída pelo ADR 0008** (cliente web); o trabalho reaproveitável migra em F3W-T1. |
| F3-T4 | 2026-10-01 | `ea260bd` | 1 | Cadência de 30 s/2 min, recuo de 5 a 60 s, cache por servidor/conta/partida e Relatório de Retorno testados com temporizadores falsos. O relatório não abre o painel sozinho: marca novidades na árvore e na barra de status, e o painel abre na aba Hoje (GDD §13.5); os eventos da ausência não viram notificações avulsas. Sem ligação, nenhum comando é enviado nem enfileirado. O teste manual de derrubar a API com o painel aberto não foi feito. **Substituída pelo ADR 0008** (cliente web); o trabalho reaproveitável migra em F3W-T1. |
| F3-T5 | 2026-10-01 | `ea260bd` | 1 | Árvore e barra de status são funções puras (`treeModel.ts`, `format.ts`) com teste; toda ação da árvore tem comando na paleta. A contagem regressiva usa horas e minutos (`00:42`) e anda a cada 30 s. **Substituída pelo ADR 0008** (cliente web); o trabalho reaproveitável migra em F3W-T1. |
| F3-T6 | 2026-10-01 | `ea260bd` | 1 | 23 comandos, todos com prefixo "Lords:" e implementação (um teste compara o manifesto com os registrados). Acrescentei `Cancelar a obra`, `Planejar ou desplanejar`, `Renomear o feudo`, `Atualizar agora`, `Silenciar notificações` e `Privacidade`. Clicar em um item da árvore só abre o painel; as ordens saem dos botões do item. Para o cliente não calcular regras, o `ViewState` ganhou `workers[].perWorkerPerHour` e `constructions.active.refund`. O teste de 10 minutos só com a paleta não foi feito. **Substituída pelo ADR 0008** (cliente web); o trabalho reaproveitável migra em F3W-T1. |
| F3-T7 | 2026-10-01 | `ea260bd` | 1 | Rotas `welcome`, `today` e `fief` em Preact (29 kB). `styles.css` sem nenhuma cor fixa (teste). CSP com nonce conferida no HTML gerado. Testes por renderização em texto: cliques, teclado, foco e os três temas **não foram verificados**. O protocolo da Webview ganhou `ready`, `playNow`, `action`, `session`, `chronicle` e `report`. **Substituída pelo ADR 0008** (cliente web); o trabalho reaproveitável migra em F3W-T1. |
| F3-T8 | 2026-10-01 | `ea260bd` | 1 | Com `all`, 5 obras em uma hora geram 3 notificações e badge 2 (testado). Durante o "Silenciar 2h" os eventos viram badge; no modo discreto, nada aparece. **Substituída pelo ADR 0008** (cliente web); o trabalho reaproveitável migra em F3W-T1. |
| F3-T9 | 2026-10-01 | `5d943a1` | 1 | Módulos puros da extensão com 89% a 100% de linhas. `docs/manual-test-v0.1.md` tem um roteiro por critério. **Pendente:** nenhuma execução manual foi feita; o "Pronto quando" (ao menos uma execução registrada) não foi atingido. **Substituída pelo ADR 0008** (cliente web); o trabalho reaproveitável migra em F3W-T1. |
| F3-T10 | 2026-10-01 | `5d943a1` | 1 | `.vsix` de 131 kB gerado com um aviso do `vsce`: falta LICENSE. `publisher` (`gustavopals`) e ícone são provisórios; `lords.serverUrl` aponta para `http://localhost:3000` até existir a instância hospedada. **Não verificado:** instalar o `.vsix` em um perfil limpo. F3-T10.3 (publicar ou distribuir) é decisão sua e segue em aberto. **Substituída pelo ADR 0008** (cliente web); o trabalho reaproveitável migra em F3W-T1. |
| F3W-T1 | 2026-10-01 | `8576c02` | 1 | `pnpm verify` e `pnpm build` passam; `curl localhost:5173/v1/health` responde pelo repasse do Vite. `packages/extension` e `packages/webview` saíram. Os componentes já entraram ligados a um objeto `Actions`, e não à ponte de mensagens: `state.ts` (o redutor de mensagens da Webview) não foi migrado, e o que ele fazia está em `app/controller.ts` e `app/router.ts`. No servidor de desenvolvimento a CSP é afrouxada (o Vite injeta estilos); a estrita vale no build, que é o que os testes em navegador usam. Commit único de F3W-T1 a T8: o código depende um do outro e do mesmo lockfile. |
| F3W-T2 | 2026-10-01 | `8576c02` | 1 | Bancada nos três temas, com paleta própria (não é a do VS Code) e contraste ≥ 4,5:1 conferido por teste de unidade e, com as cores computadas, em Chromium. `Tab` passa por atividades, árvore, abas, conteúdo e barra de status, nessa ordem. A barra de atividades filtra a árvore (Feudo, Crônica, Conta). Dois defeitos achados em navegador e corrigidos: o foco da árvore chegava um quadro depois (`useLayoutEffect`), e recarregar a página mostrava as boas-vindas por um instante e roubava o foco (o controlador agora restaura a conta antes do primeiro desenho). |
| F3W-T3 | 2026-10-01 | `8576c02` | 1 | Dois campos e um clique até o Feudo, com duas requisições (testado). Diálogos com foco preso, `Esc` e retorno do foco; um teste em navegador mostrou que `Esc` falhava se pressionado antes do primeiro quadro, e o tratamento passou para o documento. Web Locks: uma renovação por rodada com duas abas, por 80 minutos de relógio. Dentro do lock a aba espera até 200 ms pela gravação da outra (`storageSettle`): é proteção contra a leitura atrasada do `localStorage` entre processos, que **não** foi reproduzida. O SDK ganhou a opção `refreshLock`. |
| F3W-T4 | 2026-10-01 | `8576c02` | 1 | Sem rede: último estado em modo leitura, nenhuma ordem enviada nem guardada, volta sem recarregar (testado derrubando a API no navegador). Relatório de Retorno abre em Hoje depois de 5 h, com +75 de comida exatamente uma vez. Defeito achado e corrigido: fechar a aba logo depois de uma ordem deixava o cache no passado (o cache agora é gravado antes de buscar os eventos). `426` pede para recarregar a página, uma vez. |
| F3W-T5 | 2026-10-01 | `8576c02` | 1 | `+` na Serraria muda a taxa em menos de 1 s (testado). `protocol/webview.ts` removido; `ReturnReportSchema` foi para `protocol/report.ts`. Nenhuma cor fora de `theme/themes.css` e nenhum `style=` (a CSP barraria). A 480 px e a 720 px não há rolagem horizontal. |
| F3W-T6 | 2026-10-01 | `8576c02` | 1 | 26 comandos na paleta, todos com "Lords:"; a partida dos objetivos 1 a 4 foi jogada só pelo teclado em Chromium. "Reiniciar partida" do GDD §13.6 é o comando "Nova partida" (com confirmação). **Fora da v0.1:** "Baixar cópia da partida (JSON)", que o GDD §13.6 lista mas o roadmap não, e para o qual não há rota. Três defeitos achados pelos testes de unidade (escritos por subagentes) e corrigidos: o aviso com "Tentar de novo" sumia quando a rede voltava, `−` em edifício vazio mandava uma ordem sem efeito, e uma falha síncrona de um comando estourava em quem clicou. |
| F3W-T7 | 2026-10-01 | `8576c02` | 1 | Com `all`, 5 obras em uma hora geram 3 avisos e badge 2 (teste de unidade); em Chromium, aviso com Ver e Silenciar 2h, contador no título com a aba em segundo plano e permissão de notificação pedida só ao ligar a opção. Avisos mostrados com a aba em segundo plano também contam no título. Nada chega com a aba fechada. |
| F3W-T8 | 2026-10-01 | `8576c02` | 1 | **Feito sem o `GITHUB_CLIENT_ID`, que é decisão do autor: o fluxo real nunca foi executado.** Testado com GitHub simulado: 12 testes de integração no servidor e, em Chromium, vincular, entrar em outro navegador, conflito de conta, recusa, `slow_down`, código vencido e desistência. Sem a variável, as rotas respondem 404 e o app esconde os botões. Para o app saber disso antes do clique, `GET /version` ganhou `features.githubDevice` ([ADR 0010](docs/decisions/0010-version-informa-o-que-esta-ligado.md), proposta). Variáveis novas: `GITHUB_CLIENT_ID`, `GITHUB_OAUTH_URL`, `GITHUB_DEVICE_STARTS_PER_HOUR_PER_IP`. |
| F3W-T9 | 2026-10-01 | `8576c02`, `f9ddf02` | 1 | Abas Crônica, Preferências e Sobre. Alvo `web` construído e servido localmente: 194 MB, usuário não root, `index.html` para rotas desconhecidas, cache longo só em `/assets`. Seguindo o [ADR 0009](docs/decisions/0009-implantacao-no-coolify.md), o Caddy **não** repassa `/v1` nem emite certificado, e `runtime` continua o último alvo; a base é `debian:bookworm-slim` com o binário do Caddy, porque a imagem oficial é Alpine. **Não verificado:** o app atrás do proxy do Coolify. Como a API e o app são publicados em separado, o app trata `/version` sem `features` como vínculo desligado. |
| F3W-T10 | 2026-10-01 | `42d9256` | 1 | 48 testes em Chromium passam com a política de conteúdo de produção. Uma revisão independente (subagente, só leitura) não achou caminho de injeção nem falha grave, e apontou três defeitos médios e uma dúzia de menores, corrigidos em `ac3f472`: um 401 de proxy apagava a conta local (e uma conta anônima ficava sem volta), o botão "voltar" ficava preso e o modo discreto escondia recusas e erros. **Ficaram sem correção, por escolha:** vagas de habitação calculadas no app (`capacity − villagers − inTraining`) e o "dia 25" do lembrete, que deveriam vir do `ViewState`; botões de fechar dentro do `tablist`; o limite de consultas do device flow é por IP (30 por minuto), apertado para várias pessoas atrás do mesmo NAT; uma aba aberta a noite inteira não recebe Relatório de Retorno, porque continua sincronizando. Módulos puros do app com 88% a 100% de linhas (89% no pacote; os componentes são cobertos pelos testes em navegador). O job `e2e` foi escrito mas **nunca rodou no GitHub**. Só Chromium: Firefox e Safari não foram abertos. O roteiro manual tem a coluna "Manual" inteira por fazer. Nos testes o tempo anda por saltos e cada salto espera o ciclo de atualização; sem isso apareciam corridas que não existem no tempo real. |
| F4-T1 | 2026-10-01 | `f2167c5` | 1 | Três recursos no Coolify criados pela API REST (o MCP só lê e faz deploy). `/v1/health` e `/v1/version` respondem em HTTPS; em Chromium, **Jogar agora** chegou a Pedra Alta em 2 s, sem erro no console e só com requisições à própria origem; CSP, `nosniff`, `Referrer-Policy`, cache `immutable` em `/assets` e redirecionamento de HTTP conferidos por `curl`. O health check do Coolify foi desligado nas duas aplicações (exige `curl` ou `wget` na imagem); vale o `HEALTHCHECK` do `Dockerfile`. **Sem ensaio local com `tls internal`** nem `pnpm test:e2e` contra produção: a conferência foi feita no ambiente real. `Strict-Transport-Security` entrou no `web.Caddyfile` neste commit. A senha do primeiro banco apareceu na saída de um comando; o banco, ainda vazio, foi apagado e recriado com outra. |
| F4-T2 | 2026-10-01 | `f2167c5` | 1 | Backup diário às 03:00 UTC com retenção de 14 dias; duas execuções manuais com sucesso. Ensaio: backup de 20.683 bytes restaurado em um banco descartável (2 contas, 2 partidas), uma conta apagada (1 e 1), restaurado de novo (2 e 2). Feito com as 2 contas de produção, não com 3. A API de importação do Coolify não existe na versão 4.3: o ensaio usa um serviço Compose que monta a pasta de backups. **Pendente:** os backups ficam no mesmo disco do banco (F4-T2.4). |
| F4-T3 | 2026-10-01 | `f2167c5` | 1 | Commit `42d9256` implantado nos três recursos. Segredos gerados na criação e guardados só no Coolify. **Pendente e só do autor:** copiar `RECOVERY_CODE_SECRET` para fora do Coolify; vínculo GitHub desligado por decisão do autor. O "Pronto quando" (alguém de fora jogar) não foi verificado: só o teste automatizado em navegador. |
| F4-T4 | 2026-10-01 | `f2167c5` | 1 | Workflow `health.yml` consulta `/v1/health` e a página do app; as duas asserções foram conferidas à mão contra produção. Consultas de `ops.sql` escritas a partir do esquema, **não executadas** em produção (não há acesso ao `psql` pela API). Avisos do Coolify marcados, mas sem canal ligado, por decisão do autor. Teste de alerta: com a API parada por cerca de 2 minutos, o workflow passou antes, falhou durante e passou depois. **Não verificado:** a chegada do e-mail do GitHub ao autor (o "Pronto quando") e o disparo pelo agendamento, só o manual. |
| F4-T5 | 2026-10-01 | `f2167c5` | 1 | Reversão da API de `42d9256` para a imagem de `1ef9545` pela API de rollback: 38 s, com `/v1/health` respondendo durante a troca; volta por deploy normal em 20 s. Os dois commits usam a mesma migração: a reversão atravessando uma migração não foi ensaiada. Nenhuma tag criada (F5-T4). |
| F5-T1 | | | | |
| F5-T2 | | | | |
| F5-T3 | | | | |
| F5-T4 | | | | |
| F5-T5 | | | | |

---

## 10. Riscos e mitigações

| Risco | Sinal | Mitigação |
|---|---|---|
| Agente antecipa mecânicas de versões futuras ("só a estrutura") | Campos de moral, cartas ou exército no `GameState` da v0.1 | `CLAUDE.md` proíbe; revisão do diff por tarefa; teste de schema do `GameState` v1 |
| Ponto flutuante quebra o invariante de divisão de intervalo | Teste de propriedade falha esporadicamente | Milésimos inteiros e acumuladores (F1-T3); nunca `number` fracionário no estado |
| `node_modules` compartilhado entre host e contêiner | Dependências incompatíveis ao subir a API em Docker | API no host em dev; instalação própria na imagem `bookworm-slim`; sem bind mount de `node_modules` (§1.1) |
| Escopos do GitHub insuficientes ou token sem `User-Agent` | 401/403 da API do GitHub | `read:user`, cabeçalhos obrigatórios, `fetch` injetável com teste |
| Polling de muitos clientes escrevendo no banco | Carga de escrita alta sem jogadores agindo | Leituras só persistem quando há eventos (F2-T6.3); ETag evita transferência apenas quando a representação permanece igual |
| Reenvio recalcula resultado ou duplica eventos | Timeout seguido de resposta diferente ou desconto duplicado | Recibo completo, hash do payload, transação e testes F2-T6.8–9 |
| Reuso de refresh antigo passa despercebido ou revogação demora | `R0` reutilizado após `R2` sem bloquear a sessão | Histórico por família e autorização sem cache positivo; teste entre instâncias (F2-T4) |
| Troca da chave JWT invalida recuperação | Códigos deixam de funcionar após deploy | `RECOVERY_CODE_SECRET` independente e preservado nos segredos operacionais (ADR 0003) |
| Relógio do servidor errado | Obras concluindo cedo ou tarde | NTP no VPS; teste de sanidade em `/v1/health` comparando com a hora do banco |
| Vazamento de tokens em logs | `authorization` em `docker logs` | Redação no pino (F2-T2); revisão por `grep` nos logs de teste |
| CSP do app bloqueando o próprio app | Página em branco no build de produção | CSP testada no build (F3W-T9) e nos testes em navegador; sem estilos nem scripts inline |
| Tokens ao alcance de um script injetado na página | Dependência ou conteúdo de terceiros executando no app | CSP sem origens externas, nenhuma dependência de CDN, nomes sempre exibidos como texto; rever cookie `HttpOnly` antes de conteúdo gerado por jogadores (ADR 0008, ponto 1) |
| Duas abas renovando a sessão ao mesmo tempo | Sessão revogada sem o jogador ter feito nada | Web Locks na renovação e releitura do `TokenStore` (F3W-T3.5) |
| Jogador anônimo limpa os dados do navegador | Feudo inacessível | Lembrete do dia 3 mais insistente no texto; Código do Reino oferecido cedo |
| O app parecer um produto da Microsoft | Reclamação de marca | Aparência de editor genérico; sem nome, logotipo ou marca do VS Code na interface (ADR 0008, ponto 6) |
| Perda de dados por volume Docker removido | `docker compose down -v` em produção | Backup diário testado (F4-T2); `README` alerta para nunca usar `-v` em produção |
| Contexto longo degrada a qualidade do agente | Tarefas `L` em uma sessão só | Dividir por subtarefas; uma tarefa por sessão (§0.3) |

---

## Apêndice A — Modelos para o Claude Code

### A.1 Modelo de `CLAUDE.md` do projeto (F0-T3)

````markdown
# Lords of the Guild — instruções do projeto

## O que é
Jogo medieval de gerenciamento jogado no navegador, com aparência de editor de código; motor determinístico em TypeScript, servidor Fastify + PostgreSQL autoritativo, app web como cliente. Especificação: GAME_DESIGN.md (contrato: §14, §16.1). Plano: MVP-ROADMAP.md.

## Pacotes
engine (motor puro) · content (dados + zod) · protocol (Command, ViewState, API) · server (Fastify + Drizzle) · client-sdk · sim-cli · web (app Preact). Regras de dependência: engine/content/protocol não importam fastify, pg ou node:*; web não importa engine nem server.

## Comandos
pnpm dev:up · pnpm dev:api · pnpm dev:web · pnpm verify (lint + typecheck + test) · pnpm test:integration (precisa de TEST_DATABASE_URL) · pnpm sim -- --seed X --days 7

## Regras de arquitetura
1. Nenhuma regra de jogo fora de packages/engine. Nenhum número de jogo fora de packages/content.
2. O servidor é o relógio; o cliente nunca envia estado ou timestamps.
3. Recursos em milésimos inteiros; advanceTo por segmentos; invariante de divisão de intervalo é sagrado.
4. Toda mudança de estado é um comando validado, idempotente por commandId no servidor.
5. O app web só exibe ViewState; nunca calcula regras.
6. Só as bibliotecas listadas em MVP-ROADMAP.md §1.6. Outra dependência exige ADR aprovado.
7. Não antecipe mecânicas de versões futuras do GDD, nem "só a estrutura".

## Convenções
Identificadores em inglês; textos de jogo em pt-BR, tom de crônica. Testes ao lado do código; goldens em __golden__/. Commits: "F1-T3: resumo". Nunca logar tokens.

## Ritual de conclusão de tarefa
1. Rodar a seção "Verificação" da tarefa e `pnpm verify`; colar a saída.
2. Marcar as caixas da tarefa em MVP-ROADMAP.md e preencher o Registro de Execução.
3. Desvios do GDD → docs/decisions/NNNN-titulo.md, aguardando aprovação.
4. Um commit por tarefa (ou por subtarefa em tarefas L).

## Nunca
Rodar `docker compose down -v` fora do ambiente de dev; commitar .env; carregar scripts de terceiros no app; mesclar estados de contas; usar Alpine como base da imagem.
````

### A.2 Modelo de prompt para abrir uma tarefa

```
Leia CLAUDE.md, as seções do GAME_DESIGN.md indicadas na tarefa e a tarefa <ID> em MVP-ROADMAP.md.
Trabalhe só nessa tarefa. Se for M ou L, apresente um plano antes de codar e espere minha aprovação.
Escreva os testes antes da implementação onde houver regra de jogo ou contrato de API.
Ao terminar, rode a seção "Verificação" e `pnpm verify`, cole as saídas, marque as caixas da tarefa,
preencha o Registro de Execução e faça um commit "<ID>: <resumo>". Se precisar desviar do GDD,
pare e me proponha um ADR antes.
```

### A.3 Modelo de prompt para retomar uma tarefa interrompida

```
Leia CLAUDE.md e a tarefa <ID> em MVP-ROADMAP.md. Veja `git status`, `git diff` e `git log -5`.
Me diga em cinco linhas o que já está feito, o que falta e se há algo quebrado (`pnpm verify`).
Depois continue pela próxima subtarefa não marcada.
```

### A.4 Definição de pronto (vale para toda tarefa)

- [ ] Comandos da seção "Verificação" executados, com saída colada na conversa.
- [ ] `pnpm verify` verde (e `pnpm test:integration` quando a tarefa toca o servidor).
- [ ] Nenhum número de jogo fora de `packages/content`; nenhuma regra fora de `packages/engine`.
- [ ] Documentação tocada quando o comportamento mudou (README do pacote, `deploy/README.md`).
- [ ] Caixas da tarefa marcadas; Registro de Execução preenchido; ADR criado se houve desvio.
- [ ] Um commit com mensagem `<ID>: <resumo>`; branch `main` continua verde.

### A.5 Sessão típica (exemplo com F1-T5)

1. Você: prompt da A.2 com `<ID> = F1-T5`.
2. Agente: lê os arquivos, propõe o plano (fórmulas, códigos de recusa, lista de testes). Você aprova.
3. Agente: escreve `construction.test.ts` com a tabela de custos; os testes falham; implementa `construction.ts`; os testes passam.
4. Agente: roda `pnpm --filter @lotg/engine test -- construction` e `pnpm verify`; cola as saídas.
5. Agente: marca F1-T5.1 a F1-T5.5, preenche a linha F1-T5 do registro, faz o commit `F1-T5: construções com fila única, custos e cancelamento`.
6. Você: encerra a sessão. Próxima sessão, F1-T6.
