# Lords of the Guild — MVP Roadmap (v0.1 "Fundação online")

> **Status:** plano de execução  
> **Versão do documento:** 1.1 (contratos de comandos, sessões, cache HTTP e exclusão consolidados)\
> **Base:** [GAME_DESIGN.md](GAME_DESIGN.md) v0.4 (seções §14, §16.1 e §18.1 são o contrato; versão do jogo: v0.1)\
> **Forma de trabalho:** desenvolvimento 100% com Claude Code, uma tarefa por sessão, Docker para banco, API e produção  
> **Idioma:** português (Brasil); identificadores de código em inglês

---

## 0. Como usar este roadmap

### 0.1 O que é o MVP

O MVP é exatamente a **v0.1 do GDD** (§16.1): um feudo com economia, construção e recrutamento que roda em um **servidor Node.js + PostgreSQL**, com **conta criada em um clique**, vínculo opcional ao GitHub ou por **Código do Reino**, e uma **extensão do VS Code** como cliente. O jogador instala, clica em **Jogar agora** e vê Pedra Alta crescer enquanto trabalha, de qualquer máquina.

**Entra no MVP:** motor determinístico (economia, obras, recrutamento, escassez, Objetivos 1–4, Crônica simples), servidor (auth, partidas, comandos idempotentes, eventos, job horário), extensão (boas-vindas, TreeView, painel Feudo, status bar, comandos, modo sem conexão), Docker (dev e produção), backup, implantação em VPS.

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

Provedor do VPS e domínio (F4-T3), publicação no Marketplace ou distribuição por `.vsix` (F3-T10), nome público do jogo e ícone, política de privacidade final (texto), e qualquer **desvio do GDD**. Desvios são propostos pelo agente em `docs/decisions/` e aprovados por você antes da implementação.

Os ajustes documentais de 2026-10-01 nos pontos 1–3 da revisão estão consolidados no GDD 0.4 e nos [ADRs 0003–0005](docs/decisions/README.md): recibos de comandos e avanço em recusas; histórico de refresh e revogação; ETag, HMAC de recuperação e exclusão em duas etapas. Implementar esses contratos não constitui novo desvio. Nenhuma tarefa de código foi concluída por esta revisão.

---

## 1. Decisões de ambiente e convenções

### 1.1 Docker: o que roda onde

| Componente | Desenvolvimento | Produção |
|---|---|---|
| PostgreSQL | Docker (`db` na porta 5432 e `db_test` na 5433) | Docker (`db`, volume persistente, backup diário) |
| API (Fastify) | **No host**, com `tsx watch` e depurador (`pnpm dev:api`); opcionalmente em Docker com `--profile full` para paridade | Docker (imagem multi-stage, não root, healthcheck) |
| Caddy (TLS) | Não roda | Docker (certificado automático, proxy para `api:3000`) |
| Extensão VS Code | No host, via F5 (Extension Development Host) | Pacote `.vsix` ou Marketplace |
| Testes unitários | No host (`vitest`) | CI |
| Testes de integração | No host contra `db_test` em Docker | CI com serviço PostgreSQL |
| `sim-cli` | No host; modo remoto aponta para a API local | Não roda |

**Por que a API roda no host no dev:** hot reload e depurador diretos, com dependências instaladas no ambiente que as executa. A imagem Docker é testada no `--profile full` e em produção; não compartilhar `node_modules` entre host e contêiner. Mantida a base `node:22-bookworm-slim` para consistência entre build e runtime. Argon2 não é necessário na v0.1: os contratos de credenciais usam `node:crypto` (F2-T4 e F2-T5).

**WSL2:** manter o repositório dentro do sistema de arquivos do Linux (ex.: `/opt/pals-vscode-game` ou `~/dev/...`), nunca em `/mnt/c`, e habilitar a integração do Docker Desktop com a distribuição WSL.

### 1.2 Portas e serviços

| Serviço | Porta | Observação |
|---|---|---|
| API | 3000 | `http://localhost:3000/v1/health` |
| PostgreSQL dev | 5432 | banco `lotg`, usuário `lotg` |
| PostgreSQL test | 5433 | banco `lotg_test`, recriado a cada suíte, `tmpfs` |
| pgweb (opcional, `--profile tools`) | 8081 | inspeção visual do banco |
| Caddy (produção) | 80 e 443 | redireciona 80 para 443 |

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
| `POSTGRES_PASSWORD` | compose | `lotg` (prod: forte) | senha do banco |
| `PUBLIC_HOST` | compose prod | — | domínio para o Caddy |
| `API_IMAGE_TAG` | compose prod | `latest` | tag da imagem publicada |

Configurações da extensão (em `package.json` → `contributes.configuration`): `lords.serverUrl` (padrão: a instância hospedada; `http://localhost:3000` no dev), `lords.notifications` (`silent` · `essential` · `all`), `lords.discreetMode` (boolean), `lords.vigilHour` (0–23, padrão 20).

### 1.4 Scripts do `package.json` raiz

| Script | Faz |
|---|---|
| `pnpm dev:up` | `docker compose -f deploy/docker-compose.dev.yml up -d db db_test` |
| `pnpm dev:down` | derruba os contêineres de dev (mantém volumes) |
| `pnpm dev:api` | `pnpm --filter @lotg/server dev` (tsx watch) |
| `pnpm dev:ext` | compila extensão e webview em modo watch |
| `pnpm db:migrate` | aplica migrações no banco de dev |
| `pnpm db:psql` | abre `psql` no contêiner `db` |
| `pnpm build` | compila todos os pacotes |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes |
| `pnpm lint` | ESLint + Prettier (verificação) |
| `pnpm test` | testes unitários e de conteúdo (Vitest) |
| `pnpm test:integration` | testes do servidor contra `db_test` |
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
├── .vscode/launch.json · tasks.json  # F5 da extensão
├── .github/workflows/ci.yml          # opcional (F0-T5)
├── docs/
│   ├── decisions/                    # ADRs curtos: 0001-dev-api-no-host.md …
│   ├── manual-test-v0.1.md           # roteiro manual (F3-T9)
│   └── architecture.md               # F5-T4
├── deploy/
│   ├── Dockerfile                    # multi-stage: deps → build → runtime
│   ├── docker-compose.dev.yml        # db, db_test, api (profile full), pgweb (profile tools)
│   ├── docker-compose.yml            # produção: caddy, api, db
│   ├── Caddyfile
│   ├── .env.example
│   ├── migrations/                   # SQL versionado gerado pelo drizzle-kit
│   ├── backup.sh · restore.sh
│   └── analytics/                    # consultas SQL agregadas (v0.2+)
├── packages/
│   ├── engine/        @lotg/engine      motor puro
│   ├── content/       @lotg/content     dados + schemas zod
│   ├── protocol/      @lotg/protocol    Command, ViewState, API, erros
│   ├── server/        @lotg/server      Fastify + Drizzle
│   ├── client-sdk/    @lotg/client-sdk  cliente HTTP tipado
│   ├── sim-cli/       @lotg/sim-cli     bots de playtest
│   ├── extension/     lords-of-the-guild (VS Code)
│   └── webview/       @lotg/webview     Preact
└── tests/                            # integração entre pacotes (servidor↔banco, extensão↔servidor)
```

### 1.6 Bibliotecas permitidas

Conforme GDD §18.1: TypeScript, esbuild, Vitest, fast-check, zod, Preact, Fastify, `pg`, Drizzle (`drizzle-orm` + `drizzle-kit`), `jose`, `pino`. Hashes, HMAC e geração de credenciais usam `node:crypto` no servidor; não instalar `argon2`. Consideram-se parte do ecossistema permitido: plugins oficiais `@fastify/*` (`rate-limit`, `sensible`, `under-pressure`), `tsx` (dev), `@types/vscode`, `@vscode/vsce`, ESLint e Prettier. **Qualquer outra dependência exige um ADR em `docs/decisions/` aprovado por você.**

### 1.7 Convenções de código e Git

- Nomes de jogo em português nas strings de interface e conteúdo; identificadores em inglês (`townHall`, `lumberMill`, `startConstruction`).
- Motor sem `Date.now()`, `Math.random()`, I/O ou importações do VS Code e do Node de servidor. Teste de pureza em F1-T11.
- Nenhuma regra de jogo fora do motor; nenhum número de jogo fora de `@lotg/content`; a Webview só exibe o `ViewState`.
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

- [ ] F0-T4.1 `docker-compose.dev.yml`: serviço `db` (`postgres:16`, `POSTGRES_USER=lotg`, `POSTGRES_DB=lotg`, volume `lotg_db_dev`, healthcheck `pg_isready`), serviço `db_test` (porta 5433, `tmpfs` em `/var/lib/postgresql/data`, `fsync=off` para velocidade), serviço `api` sob `profiles: [full]` construído do `Dockerfile` alvo `runtime` com `DATABASE_URL` apontando para `db`, serviço `pgweb` sob `profiles: [tools]`.
- [ ] F0-T4.2 `Dockerfile` multi-stage em `node:22-bookworm-slim`: `deps` (corepack + `pnpm fetch` com lockfile), `build` (instala, `pnpm --filter @lotg/server... build`, `pnpm deploy` para pasta isolada), `runtime` (usuário não root, só `dist/`, `node_modules` de produção e `deploy/migrations/`, `HEALTHCHECK` chamando `/v1/health`, `CMD ["node", "dist/main.js"]`). Alvo `dev` opcional com `tsx`.
- [ ] F0-T4.3 `.env.example` com todas as variáveis da §1.3 e comentários; `pnpm secrets:gen` gera valores fortes e independentes para JWT, recuperação e banco, sem sobrescrever valores existentes. Documentar que trocar a chave de recuperação invalida os códigos já emitidos.
- [ ] F0-T4.4 Scripts `dev:up`, `dev:down`, `dev:logs`, `db:psql`, `docker:build` no `package.json` raiz; `README.md` atualizado.

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

- [ ] F0-T5.1 Job `verify`: checkout, pnpm com cache, `pnpm install --frozen-lockfile`, `pnpm verify`.
- [ ] F0-T5.2 Job `integration`: serviço `postgres:16` do GitHub Actions, `TEST_DATABASE_URL`, `pnpm test:integration` (passa vazio até a Fase 2).
- [ ] F0-T5.3 Job `docker`: `docker build` do alvo `runtime` (sem push).

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

- [ ] F1-T1.1 `balance.ts`: população inicial 5, capacidade por nível (Habitações +5, Salão +5), recursos iniciais 180/120/65/250, taxas base 10/8/5/4 por trabalhador/h, consumo 1 comida/habitante/h, recrutamento (50 comida + 10 ouro, 20 min, fila 5), fatores de custo 1,6 (Salão 1,8) e de tempo 1,5, teto de 8 h, multiplicador de fome 0,75, reembolso de cancelamento 0,8, dia de jogo = 7.200.000 ms, estações 24/24/24/12 dias.
- [ ] F1-T1.2 `buildings.ts`: `townHall`, `farm`, `lumberMill`, `quarry`, `goldMine`, `housing` com rótulo pt-BR, custo base, tempo base, nível máximo (Salão 8, demais 10), recurso produzido (quando houver), e a regra de gate `nível ≤ nível do Salão + 1`.
- [ ] F1-T1.3 `objectives.ts`: objetivos 1 a 4 com condição declarativa (`workersAtLeast`, `constructionStarted`, `villagersRecruited`, `buildingLevel`) e recompensa. **Decisão v0.1:** o objetivo 4 ("Salão Nv2") recompensa +50 ouro, porque Celeiro, Armazém e Torre só existem na v0.2; registrar em `docs/decisions/0002-objetivo-4-v01.md`.
- [ ] F1-T1.4 `chronicle.ts`: modelos de frase para cada tipo de evento da v0.1 (GDD Apêndice E), com placeholders `{dia}`, `{estacao}`, `{edificio}`, `{nivel}`, `{quantidade}`.
- [ ] F1-T1.5 `schemas.ts` + `content.test.ts`: zod valida tudo; testes garantem custo e tempo positivos, nível máximo ≥ 2, rótulos não vazios, todo tipo de evento com modelo de frase, toda condição de objetivo conhecida.
- [ ] F1-T1.6 `types.ts` no motor: `GameState` da v0.1 (subconjunto do GDD §14.11: `schemaVersion: 1`, `seed`, `settings`, `clock`, `lastProcessedAt`, `rng`, `settlement` sem campos de versões futuras, `objectives`, `stats`), `GameEvent`, `Command`, `CommandResult`, `RejectionCode`.

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

- [ ] F1-T2.1 `clock.ts`: `dayIndex(ms)`, `seasonOf(dayIndex)` (0–23 primavera, 24–47 verão, 48–71 outono, 72–83 inverno), `dayOfSeason`, `yearOf`, rótulos pt-BR, `nextDayBoundary(ms)`, `nextSeasonBoundary(ms)`. Ano = 84 dias de jogo; ao virar o ano, `clock.year` incrementa e a Crônica registra (sem cerco na v0.1).
- [ ] F1-T2.2 `timeline.ts`: `nextEventAt(state)` = mínimo entre fim de obra, fim de recrutamento, virada de dia, virada de estação e virada de ano (as fontes de produção e fome entram em F1-T3 e F1-T4).
- [ ] F1-T2.3 `advance.ts`: laço `while (lastProcessedAt < target)`: `next = min(nextEventAt, target)`; aplica o segmento contínuo (`applyContinuous`, vazio por enquanto); processa eventos cujo instante é `next`; atualiza `lastProcessedAt`. Retorna novo estado e lista de eventos em ordem.
- [ ] F1-T2.4 Testes: viradas de dia e estação emitem eventos nos instantes exatos; avançar para um instante no passado é no-op; avançar 30 dias de uma vez produz os mesmos eventos que em 720 passos de 1 h.

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

- [ ] F1-T3.1 Taxas por edifício em **milésimos por hora**: `trabalhadores × base × 1000 × (10 + 2 × (nível − 1)) / 10`, sem ponto flutuante. Consumo: `habitantes × 1000` comida/h. Taxa líquida por recurso = soma dos fluxos.
- [ ] F1-T3.2 Acumuladores: `acc[r] += taxa_liquida × duracao_ms`; `delta = trunc(acc[r] / 3_600_000)` (em direção a zero); `acc[r] -= delta × 3_600_000`; estoque += delta. Documentar por que isso torna a divisão de intervalos exata.
- [ ] F1-T3.3 `GameSettings.capsEnabled = false` na v0.1 (sem limite de estoque; GDD §5.5 é v0.2). Deixar o ponto de corte preparado, sem implementar caps.
- [ ] F1-T3.4 Testes de unidade: 2 trabalhadores na Fazenda Nv1 com 5 habitantes = +15 comida/h líquida (exemplo do GDD §13.3 adaptado), 1 h produz exatamente 15.000 milésimos; níveis aplicam +20% por nível.
- [ ] F1-T3.5 Testes de propriedade (fast-check): para quaisquer `t1 < t2 < t3`, `advanceTo(t3)` ≡ `advanceTo(t2)` depois `advanceTo(t3)`, com igualdade **estrita** do estado; recursos nunca negativos; o estado de entrada não é mutado.

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

- [ ] F1-T4.1 `timeline.ts` passa a incluir o **instante de zeramento da comida** como evento: resolver em inteiros o maior `t` com `estoque(t) ≥ 0` dado o acumulador atual e a taxa líquida negativa.
- [ ] F1-T4.2 Ao zerar: `settlement.famine = { since }`; evento `famineStarted`; a partir daí a produção de **todos** os edifícios é multiplicada por 0,75 (aplicado na taxa em milésimos, sem ponto flutuante: `× 3 / 4`), novas ordens de recrutamento são recusadas (`FAMINE`) e a fila em andamento fica congelada (os `finishesAtMs` são deslocados pela duração da fome ao final dela).
- [ ] F1-T4.3 Término: no primeiro instante em que a taxa líquida de comida volta a ser positiva (só muda em comandos ou eventos), `famineEnded`, penalidades removidas, fila de recrutamento retomada.
- [ ] F1-T4.4 Testes: 30 dias offline com consumo maior que produção → fome começa no instante previsto, comida nunca negativa, evento com o instante exato; realocar para a Fazenda encerra a fome; a propriedade de divisão de intervalo continua valendo atravessando a fome.

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

- [ ] F1-T5.1 Fórmulas: `custo(n→n+1) = arredondar(base × fator^(n−1))` com fator 1,6 (Salão 1,8); `tempo(n→n+1) = mín(8 h, tempo_base × 1,5^(n−1))`. Expor `upgradeQuote(state, building)` (custos, duração, bloqueios) para a UI e os testes.
- [ ] F1-T5.2 Iniciar: valida fila livre (`QUEUE_BUSY`), edifício não em obra (`ALREADY_UPGRADING`), nível máximo (`MAX_LEVEL`), gate do Salão (`GATE_LOCKED`), recursos (`INSUFFICIENT_RESOURCES`); desconta recursos; registra `finishesAtMs`; evento `constructionStarted`.
- [ ] F1-T5.3 Concluir (evento da linha do tempo): nível += 1; capacidade habitacional derivada muda imediatamente; evento `constructionFinished` com frase de Crônica.
- [ ] F1-T5.4 Cancelar: devolve 80% (em milésimos, arredondando para baixo); evento `constructionCancelled`. Planejar e desplanejar: lista `planned` sem efeito econômico.
- [ ] F1-T5.5 Testes: tabela de custos e tempos dos níveis 1→2 até 4→5 para cada edifício bate com a planilha do GDD §6.2; teto de 8 h; gate; desconto único; conclusão no instante exato; cancelamento devolve 80% e libera a fila.

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

- [ ] F1-T6.1 `setWorkers(building, count)`: `count ≥ 0`, soma ≤ aldeões (`NOT_ENOUGH_VILLAGERS`), edifício produtivo (`INVALID_WORKERS`); efeito imediato nas taxas (reinicia o segmento).
- [ ] F1-T6.2 `recruitVillagers(quantity)`: 1 a 5 por ordem; fila total ≤ 5 (`RECRUIT_QUEUE_FULL`); `aldeões + em fila + quantidade ≤ capacidade` (`HOUSING_FULL`); custo descontado na ordem; cada aldeão fica pronto 20 min após o anterior; evento `recruitmentFinished` por aldeão (ou agrupado por ordem, decisão do agente, documentada).
- [ ] F1-T6.3 Capacidade habitacional e aldeões livres são **derivados** (`housingCapacity(state)`, `freeVillagers(state)`), nunca persistidos.
- [ ] F1-T6.4 Testes: alocação inválida, fila cheia, capacidade, conclusão escalonada, interação com fome (F1-T4).

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

- [ ] F1-T7.1 União discriminada `Command`: `setWorkers`, `startConstruction`, `cancelConstruction`, `planConstruction`, `unplanConstruction`, `recruitVillagers`, `renameSettlement`. Cada comando carrega `commandId` (UUID) para idempotência no servidor.
- [ ] F1-T7.2 `applyCommand(state, command, nowMs)`: exige `state.lastProcessedAt === nowMs` (o chamador avança antes; violar lança erro de programação), despacha, devolve `{ ok: true, state, events }` ou `{ ok: false, code, message }`. Mensagens em pt-BR vindas de `rejections.ts` (ex.: `INSUFFICIENT_RESOURCES` → "Faltam 40 madeira e 10 pedra").
- [ ] F1-T7.3 Nenhuma recusa de regra altera o estado avançado recebido por `applyCommand` nem lança exceção. O chamador conserva o resultado anterior de `advanceTo`; o servidor o persiste mesmo em recusa (F2-T6), junto aos eventos do avanço.
- [ ] F1-T7.4 Testes: cada código de recusa tem ao menos um teste; comando desconhecido é recusado (`UNKNOWN_COMMAND`); `renameSettlement` valida 2–24 caracteres.

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

- [ ] F1-T8.1 Avaliação declarativa das condições após cada comando e cada evento; no máximo 3 ativos; concluir um ativa o próximo; recompensa creditada; evento `objectiveCompleted`.
- [ ] F1-T8.2 `chronicle.ts`: para cada evento, gera a frase pt-BR a partir dos modelos de `@lotg/content` e do calendário ("No 3º dia da Primavera, os pedreiros ergueram a Serraria ao 2º nível."). O motor **emite** a frase dentro do evento; não a guarda no estado.
- [ ] F1-T8.3 Testes: sequência dos objetivos 1→4 em um cenário roteirizado; frases determinísticas (snapshot).

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

- [ ] F1-T9.1 Estrutura: `settlement`, `calendar` (ano, estação, dia da estação, segundos até a próxima virada), `population` (aldeões, capacidade, livres, em treinamento), `resources[]` (id, rótulo, estoque em unidades, `cap: null`, `perHour` líquido com uma casa decimal, `breakdown` textual), `workers[]` (edifício, nível, alocados, bruto/h, `breakdown`), `constructions` (`active` com segundos restantes e progresso, `planned[]`, `available[]` com custos, duração, `affordable` e `blockedReason`), `famine`, `objectives[]`, `pendingDecisions: []`.
- [ ] F1-T9.2 `breakdown` segue o formato do GDD §13.3: "4 trabalhadores × 10 × 1,2 (Nv2) = 48/h; consumo 18 × 1 = 18/h".
- [ ] F1-T9.3 Formatação numérica fica **fora** do motor (a UI usa `Intl`); o motor entrega números e textos de explicação.
- [ ] F1-T9.4 Golden test: `ViewState` do estado inicial e após o cenário de F1-T8, comparado a arquivo em `__golden__/` (atualizável com `UPDATE_GOLDEN=1`).

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

- [ ] F1-T10.1 Cenário roteirizado de 7 dias (lista de comandos com instantes) para a semente `pedra-alta-golden`; snapshot do estado e dos eventos a cada 24 h.
- [ ] F1-T10.2 `sim-cli`: `pnpm sim -- --seed <s> --days 7 --strategy economico --sessions-per-day 2`; o bot, a cada "sessão", realoca para maximizar valor ponderado dos recursos, inicia a melhoria mais barata disponível e recruta quando há vaga; emite CSV por hora (recursos, população, níveis, fome) e um resumo.
- [ ] F1-T10.3 Teste de faixa (CI): com 2 sessões/dia, no dia 7 a população está entre 20 e 40, Salão ≥ Nv3, nenhuma fome; com 1 sessão/dia, sem fome nas primeiras 24 h. Ajustar números em `@lotg/content` se a faixa falhar, nunca no bot.
- [ ] F1-T10.4 Documentar em `packages/sim-cli/README.md` como interpretar o CSV.

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

- [ ] F1-T11.1 `index.ts` exporta exatamente a API do contrato da fase e os tipos; nada interno vaza.
- [ ] F1-T11.2 Teste de pureza: `grep` automatizado por `Date.now`, `Math.random`, `process.`, `require(`, `import .* from 'node:` e `vscode` dentro de `packages/engine/src` (exceto testes); regra de lint equivalente.
- [ ] F1-T11.3 `README.md` do motor: ciclo `advanceTo → applyCommand → deriveViewState`, invariantes, como adicionar um evento, como atualizar goldens.
- [ ] F1-T11.4 `pnpm verify` verde; cobertura do motor ≥ 90% de linhas.

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

- [ ] F2-T1.1 `commands.ts`: schemas zod de cada comando, com `commandId` UUID; teste de tipo garante que `z.infer<typeof CommandSchema>` é idêntico ao `Command` do motor.
- [ ] F2-T1.2 `view.ts`: schema do `ViewState`; `api.ts`: corpos e respostas de todos os endpoints da §14.5 do GDD usados na v0.1, incluindo `/view { view, stateVersion }`, comando aceito `{ view, events, stateVersion, staleView }`, recusa `GAME_RULE` com `details { code, message, view, events, stateVersion, staleView }` e exclusão `202 { deletedAt, purgeAfter }`. `stateVersion` é string decimal positiva e datas são UTC ISO 8601. `errors.ts`: `ApiErrorSchema { code, message, details? }` e enum de códigos (`VALIDATION`, `UNAUTHORIZED`, `SESSION_REVOKED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `CONFLICT`, `COMMAND_ID_CONFLICT`, `ACCOUNT_CONFLICT`, `ACTIVE_GAME_EXISTS`, `GAME_RULE`, `GITHUB_TOKEN_INVALID`, `UPGRADE_REQUIRED`, `INTERNAL`).
- [ ] F2-T1.3 `webview.ts`: mensagens Webview ↔ extensão (`command`, `view`, `error`, `connection`, `navigate`).
- [ ] F2-T1.4 `PROTOCOL_VERSION = 1`; documentar `X-Lords-Protocol`, `X-Lords-State-Version` (aviso opcional, sem bloqueio da ação), `X-Lords-Replayed` (metadado de reenvio), ETag e `If-None-Match`. O aviso não usa `If-Match`; recibos mantêm status e corpo originais, com o indicador de reenvio somente no cabeçalho.

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

- [ ] F2-T2.1 `config.ts`: variáveis da §1.3 validadas por zod no arranque; falha rápida com mensagem clara. Decodificar `JWT_SECRET` e `RECOVERY_CODE_SECRET` de base64, exigir pelo menos 32 bytes em cada e valores diferentes; nunca imprimir segredos em erros.
- [ ] F2-T2.2 `app.ts`: `buildApp(deps)` com `pino` (redação de `authorization`, `refreshToken`, `githubAccessToken`, `code`), `requestId`, `@fastify/sensible`, `@fastify/rate-limit` (60/min por sessão ou IP), plugin `db` (Pool do `pg` + Drizzle), handler de erros mapeando `ZodError` → 400 `VALIDATION`, `ApiError` → status próprio, desconhecido → 500 `INTERNAL` com `requestId`.
- [ ] F2-T2.3 `GET /v1/health` (`{ status: 'ok', db: 'ok' | 'down' }`, 503 se o banco falhar) e `GET /v1/version` (`{ server, protocol, contentHash, builtAt }`).
- [ ] F2-T2.4 `main.ts`: carrega config, roda migrações (F2-T3), escuta, encerramento gracioso em `SIGTERM`.
- [ ] F2-T2.5 `pnpm dev:api` com `tsx watch`; testes com `app.inject` (health, 404, formato de erro de validação).

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

- [ ] F2-T3.1 Sete tabelas do GDD §14.6: `accounts`, `sessions`, `refresh_tokens`, `games`, `commands`, `game_events`, `chronicles`. `refresh_tokens` guarda todos os hashes por sessão, com `created_at` e `used_at`; não usar apenas o token anterior. `commands` inclui `request_hash`, `response_status`, `response_body` obrigatórios, `result` (`accepted | rejected`) e `error_code`; PK `(game_id, id)`. `accounts.recovery_code_hash` guarda HMAC-SHA256. Relações de propriedade com `ON DELETE CASCADE` cobrem também recibos e histórico de refresh.
- [ ] F2-T3.2 Índices: único parcial `games(account_id) where status = 'active'`; `games(last_processed_at) where status = 'active'`; único `commands(game_id, seq)`; PK `game_events(game_id, seq)`; `sessions(account_id)`; PK `refresh_tokens(token_hash)` e índice `refresh_tokens(session_id)`, mais único parcial em `session_id where used_at is null`; únicos `accounts(github_id)` e `accounts(recovery_code_hash)`; `accounts(deleted_at)`.
- [ ] F2-T3.3 `drizzle-kit generate` com saída em `deploy/migrations/`; `migrate.ts` aplica no arranque dentro de `pg_advisory_lock(727)`; idempotente.
- [ ] F2-T3.4 Helper de teste `resetTestDb()` (drop schema + migrar) usando `TEST_DATABASE_URL`; projeto `integration` do Vitest só roda com a variável definida.

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

- [ ] F2-T4.1 `POST /v1/auth/anonymous { displayName, deviceLabel? }` → cria `accounts` + `sessions` + primeiro hash em `refresh_tokens` atomicamente; responde `{ account, accessToken, refreshToken, expiresIn }`. Limite 10/h por IP.
- [ ] F2-T4.2 Access token: JWT HS256 (`jose`) com `sub` = accountId, `sid` = sessionId, `iss` = `PUBLIC_URL`, `exp = min(agora + 15 min, sessão.expires_at)`. Sessão/família por máquina com validade absoluta de 30 dias; refresh de 32 bytes aleatórios em base64url, guardado como SHA-256 em `refresh_tokens`. Na rotação, localizar hash, travar conta → sessão, revalidar; marcar o token como utilizado e inserir o sucessor na mesma transação. Qualquer antecessor utilizado revoga a sessão inteira; fazer commit da revogação **antes** do 401 `SESSION_REVOKED`. Hash desconhecido ou sessão expirada retorna 401 `UNAUTHORIZED`. Conservar todos os hashes até expiração da sessão ou exclusão em cascata.
- [ ] F2-T4.3 Plugin `auth`: validar JWT, `sub`, `sid`, emissor e expiração; consultar conta/sessão no banco em toda requisição, sem cache positivo de autorização; rejeitar `deleted_at`, `revoked_at`, sessão expirada ou sessão de outra conta. Atualizar `last_seen_at` no máximo a cada 5 min. Novas requisições após commit da revogação falham em qualquer instância. Criação de sessões e alterações de credenciais revalidam a conta sob lock.
- [ ] F2-T4.4 `POST /v1/auth/logout` autenticado por JWT revoga somente a sessão atual; `GET /v1/me` (`{ id, displayName, linked: { github }, hasRecoveryCode, createdAt }`); `PATCH /v1/me { displayName }`; `DELETE /v1/me` faz soft delete, revoga todas as sessões, limpa o HMAC de recuperação e arquiva partidas atomicamente, respondendo `202 { deletedAt, purgeAfter }` com prazo de sete dias. API e métricas de jogadores ativos filtram contas excluídas; nenhum login as restaura. O job F2-T7 remove fisicamente os dados após o prazo; não implementar desfazer exclusão.
- [ ] F2-T4.5 Testes de integração com relógio injetado: criação, JWT e expiração absoluta; `R0 → R1 → R2`, reuso de `R0` invalida `R2` e JWT da família, preservando outra sessão; refresh concorrente do mesmo token não deixa dois sucessores válidos e o reuso revoga inclusive o sucessor recém-emitido; rollback em falha de rotação. Testar logout e exclusão com duas instâncias sem esperar 60 s, acesso/refresh após exclusão e limites de taxa. Uma revogação deve continuar gravada apesar da resposta 401. GitHub e Código do Reino serão verificados em F2-T5.4.

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

- [ ] F2-T5.1 Código do Reino: 20 caracteres aleatórios uniformes do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, exibidos como `XXXX-XXXX-XXXX-XXXX-XXXX`. Normalização: remover espaços externos e hífens, converter para maiúsculas e validar 20 caracteres do alfabeto. Guardar **HMAC-SHA256** hexadecimal do código normalizado usando a chave base64 decodificada `RECOVERY_CODE_SECRET`, independente de `JWT_SECRET`; implementação com `node:crypto` e busca pelo índice único. Gerar outro código na improvável colisão do HMAC. Seguir o contrato do GDD §14.7 e ADR 0003, sem nova decisão pendente.
- [ ] F2-T5.2 `POST /v1/auth/recovery-code` gera/rotaciona sob lock da conta e devolve o código em claro **uma vez**, com `Cache-Control: no-store`; código anterior deixa de funcionar, sessões existentes permanecem. `POST /v1/auth/recover { code, deviceLabel? }` busca HMAC, revalida a conta sob lock e cria sessão nova; limite 5/h por IP. Código inválido, inexistente ou de conta excluída recebe 401 `UNAUTHORIZED` sem revelar conta; não logar código nem chaves.
- [ ] F2-T5.3 `POST /v1/auth/github { githubAccessToken, deviceLabel?, resolve? }`: valida em `${GITHUB_API_URL}/user` com `Authorization: Bearer`, `Accept: application/vnd.github+json` e `User-Agent: lords-of-the-guild-server`; guarda só `github_id`. Casos: (a) chamador autenticado e `github_id` livre → vincula; (b) chamador não autenticado e `github_id` conhecido → entra; (c) chamador autenticado com conta anônima e `github_id` de outra conta → 409 `ACCOUNT_CONFLICT` com `details { existingDisplayName, currentHasProgress }`; repetir com `resolve: 'useExisting'` (conta atual recebe soft delete) ou `resolve: 'keepCurrent'` (vínculo migra para a conta atual). Nunca mesclar estados. Token do GitHub inválido → 401 `GITHUB_TOKEN_INVALID`.
- [ ] F2-T5.4 `fetch` injetável para testar o GitHub sem rede; testes de todos os casos e dos limites. Testar normalização do código, rotação invalidando o anterior, sessões preservadas, troca de `JWT_SECRET` sem invalidar o Código do Reino e exclusão bloqueando recuperação e login GitHub. O caso `useExisting` aplica a mesma exclusão transacional de F2-T4.4 à conta descartada.

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

- [ ] F2-T6.1 `POST /v1/games { settlementName, timezone, vigilHourLocal, replaceActive? }`: na v0.1, `difficulty = 'lord'` e `timeScale = 1` fixos (campos aceitos e guardados); se já há partida ativa e `replaceActive` não vier → 409 `ACTIVE_GAME_EXISTS`; com `replaceActive` → arquiva a atual. Semente aleatória (ou informada em ambiente de teste). `GET /v1/games` lista.
- [ ] F2-T6.2 Relógio: `gameNowMs = (now − games.created_at) × time_scale`, em inteiros. Autenticar, verificar propriedade (404 para outra conta, sem consultar recibos dela) e travar a partida em transação. Capturar `now` sob o lock. Leituras e comandos novos chamam `advanceTo`; reenvios e conflitos de UUID retornam antes do avanço.
- [ ] F2-T6.3 **Regra de persistência:** leituras de partida só escrevem se o avanço produziu eventos; persistir estado e eventos atomicamente sob o lock. Produção contínua sem evento não gera escrita. Cada comando **novo**, aceito ou recusado pelo motor, persiste o estado avançado e o recibo. `state_version` começa em 1 e incrementa uma vez por escrita do estado, também no job; a API o serializa como string decimal. `last_processed_at` recebe o relógio de parede do avanço a cada escrita. Reenvios não escrevem nem incrementam versões/sequências.
- [ ] F2-T6.4 `GET /v1/games/:id/view` responde `{ view, stateVersion }`. ETag fraco `W/"<sha256>"` do JSON canônico desse corpo completo, com chaves de objetos ordenadas recursivamente e ordem de arrays preservada; autenticar e avançar antes de comparar `If-None-Match`. Igual → 304 sem corpo e com ETag; diferente → 200. Usar `Cache-Control: private, no-cache` e `Vary: Authorization` em ambos. Contagens regressivas e produção podem mudar o ETag sem escrita; não incluir `requestId` ou timestamp da requisição no corpo. ETag não é `stateVersion`.
- [ ] F2-T6.5 `POST /v1/games/:id/commands { commandId, type, payload }`: sob o lock, buscar `(game_id, commandId)` e comparar `request_hash` (SHA-256 do JSON canônico de `{ type, payload }` validado, sem cabeçalho de versão). Mesmo hash → retornar status/corpo gravados e `X-Lords-Replayed: true`; diferente → 409 `COMMAND_ID_CONFLICT`, sem alterar o recibo. Comando novo: capturar versão anterior, avançar, aplicar e gravar estado, eventos e recibo completo na mesma transação; `seq` único crescente por partida. Sucesso: 200 `{ view, events, stateVersion, staleView }`. Recusa: 422 `GAME_RULE` com `details { code, message, view, events, stateVersion, staleView }`, persistindo estado/eventos do avanço sem efeitos da ação recusada. Commit antes da resposta inclusive na recusa; falha inesperada faz rollback total. `X-Lords-State-Version` opcional determina `staleView` comparando com a versão persistida capturada sob lock, antes do avanço; ausência → false, formato inválido → 400. Usar `Cache-Control: no-store` nas respostas de comandos. Recibos permanecem enquanto a partida existir.
- [ ] F2-T6.6 `GET /v1/games/:id/events?after=<seq>&limit=100` e `GET /v1/games/:id/chronicle?limit=50` (eventos com frase de Crônica) e `GET /v1/games/:id/chronicle.md` (Markdown com título, ano e uma linha por evento).
- [ ] F2-T6.7 Testes de integração: fluxo completo (conta → partida → comandos → view → eventos); 404 para outra conta antes da busca de recibo; **10 comandos em paralelo** aplicados exatamente uma vez com `seq` 1..10 e estado final igual ao da aplicação sequencial na ordem gravada. Leituras e comandos concorrentes não duplicam eventos; o job entra nesse teste em F2-T7.4. Falha entre escrita do estado e inserção do recibo faz rollback de tudo.
- [ ] F2-T6.8 Testar recibos de sucesso e recusa: reenvio concorrente, após reinício e após outros comandos retorna mesmo status/corpo (igualdade estrutural JSON), só muda o cabeçalho de reenvio; nenhum avanço, evento, versão ou `seq` novo. Mesmo UUID com payload diferente retorna conflito; mudança da ordem das chaves ou do cabeçalho de versão não muda a identidade. Testar recibo com mais de 90 dias ainda idempotente.
- [ ] F2-T6.9 Testar recusa após horas sem acesso com uma obra concluída durante o intervalo: conclusão e produção persistem, ação recusada não desconta nada, recibo 422 contém a nova view e os eventos aparecem uma única vez. Quando recursos passam a bastar, repetir o UUID mantém a recusa original; novo UUID permite reavaliar.
- [ ] F2-T6.10 Testar ETag: relógio congelado e mesmo corpo → 304; avanço contínuo sem evento muda estoque/tempo restante e ETag → 200 com mesma `stateVersion` e zero `UPDATE`; alteração de versão muda a representação. Validar cabeçalhos, 304 sem corpo e autenticação mesmo quando o ETag coincide. Testar `staleView` com cabeçalho ausente, igual, diferente e malformado.

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

- [ ] F2-T7.1 `scheduler.ts`: `setInterval(ADVANCE_JOB_INTERVAL_MS)`; cada execução tenta `pg_try_advisory_lock(7271)` em conexão dedicada; sem o lock, encerra em silêncio (outra réplica está rodando).
- [ ] F2-T7.2 `advanceStaleGames`: lotes de 100 partidas ativas com `last_processed_at < now − ADVANCE_STALE_AFTER_MS`, `FOR UPDATE SKIP LOCKED`; avança e persiste cada uma (mesma função de F2-T6.3, forçando escrita para atualizar `last_processed_at`); orçamento de 20 s por execução; log com contagem.
- [ ] F2-T7.3 `purgeAccounts`: na primeira execução com `now >= deleted_at + 7 dias`, hard delete em cascata de conta, sessões, todos os hashes de refresh, partidas, comandos/recibos, eventos e Crônicas. Job horário, inclusive recuperação após indisponibilidade; logs só com contagens. Limpeza de `refresh_tokens` por idade só pode ocorrer quando a sessão inteira já expirou; nunca apagar apenas antecessores de uma sessão ainda válida. Não expurgar recibos de comandos por idade na v0.1.
- [ ] F2-T7.4 Testes: partida parada é avançada e ganha eventos; partida recente não é tocada; duas instâncias do app → só uma executa; job concorrente com leitura/comando não duplica eventos. Exclusão com relógio injetado: acesso negado imediatamente, registros internos ainda existem antes de sete dias, exatamente no prazo o job remove os registros relacionados à conta nas sete tabelas e uma conta de controle permanece intacta. Reexecução é idempotente; sessão válida mantém histórico de refresh mesmo após várias rotações; sessão expirada pode ter histórico limpo.

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

- [ ] F2-T8.1 Cenários: "primeira hora de um jogador novo" (conta → partida → 6 comandos → view), "troca de máquina" (código do reino → mesma partida), "duas máquinas" (sessões distintas, comandos intercalados, views consistentes), "excluir conta".
- [ ] F2-T8.2 `sim-cli --remote http://localhost:3000 --bots 50 --minutes 2`: cada bot cria conta e partida, faz polling a cada 30 s (acelerado) e envia comandos; mede p50/p95 de `/view` e `/commands`.
- [ ] F2-T8.3 Meta local (API no host, banco em Docker): p95 < 50 ms em `/view` e < 80 ms em `/commands` com 50 bots. Registrar em `docs/perf-v0.1.md` com data e máquina.

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

- [ ] F2-T9.1 Alvo `runtime`: usuário não root, só `dist/`, `node_modules` de produção e `deploy/migrations/`; `HEALTHCHECK` em `/v1/health`; imagem abaixo de 250 MB.
- [ ] F2-T9.2 `docker compose -f deploy/docker-compose.dev.yml --profile full up -d` sobe `db` e `api`; a API aplica migrações e fica saudável.
- [ ] F2-T9.3 `pnpm sim -- --remote http://localhost:3000 --bots 10 --minutes 1` contra o contêiner funciona.

**Verificação:**

```bash
pnpm docker:build && docker compose -f deploy/docker-compose.dev.yml --profile full up -d && docker compose -f deploy/docker-compose.dev.yml ps
docker inspect --format '{{.Config.User}}' lotg-api
```

Esperado: `api` `healthy`; usuário não root.

**Pronto quando:** a imagem construída do zero (`--no-cache`) sobe saudável em menos de 60 s.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F2-T9 e GAME_DESIGN.md §14.13. Finalize o alvo runtime do Dockerfile e o perfil full do compose de dev; prove com docker compose ps, docker inspect e o sim-cli remoto."


---

## 5. Fase 3 — Cliente: `@lotg/client-sdk`, extensão VS Code e Webview

**Meta da fase:** instalar a extensão, clicar em **Jogar agora** e governar Pedra Alta em menos de 30 segundos; continuar de outra máquina; funcionar sem conexão em modo leitura.

### F3-T1 · `@lotg/client-sdk` `M`

**Objetivo:** cliente HTTP tipado, com refresh automático, ETag e erros claros, sem nada do VS Code.
**GDD:** §14.2, §14.10.
**Depende de:** F2-T9.
**Entregáveis:** `packages/client-sdk/src/{client,tokens,errors,retry}.ts`, testes com `fetch` simulado.

- [ ] F3-T1.1 `createClient({ baseUrl, tokenStore, fetch, clientVersion })`; `TokenStore` é uma interface (`get/set/clear`) implementada pela extensão com `SecretStorage` e pelo `sim-cli` em memória.
- [ ] F3-T1.2 Um método por endpoint da v0.1, com tipos do `@lotg/protocol`; respostas validadas por zod em modo dev.
- [ ] F3-T1.3 401 `UNAUTHORIZED` em chamada autenticada → refresh **single-flight** (uma renovação por vez) → repete a chamada uma vez. `SESSION_REVOKED` ou refresh inválido chama `onUnauthenticated()` sem tentar outro refresh. A rotação em si não recebe retentativa automática em falha de rede: o token pode já ter sido consumido; mostrar necessidade de nova autenticação se o resultado não puder ser confirmado. Após renovação bem-sucedida, substituir os tokens juntos no `TokenStore`.
- [ ] F3-T1.4 `getView(gameId, { etag })` devolve `{ status: 200, view, stateVersion, etag }` ou `{ status: 304, etag }`. `sendCommand` conserva `commandId` e payload nas retentativas em falha de rede, aceita versão conhecida via `X-Lords-State-Version` e expõe `X-Lords-Replayed` como metadado `replayed`, fora do corpo original. Após recibo repetido, a sessão de jogo busca view/eventos atuais; nova intenção usa outro UUID. GETs com retentativa exponencial (3 tentativas).
- [ ] F3-T1.5 Erros: `ApiClientError { status, code, message, details, replayed }` e `NetworkError`; cabeçalhos `X-Lords-Protocol` e `X-Lords-Client`. Tipar `GAME_RULE.details` para que a UI atualize a view avançada e os eventos antes de mostrar a recusa, exceto em recibo repetido, que exige nova leitura.
- [ ] F3-T1.6 Testes: refresh concorrente e sem retentativa cega, sessão revogada sem refresh, 304, ETag diferente com mesma versão, retentativa com UUID/payload preservados, reenvio de sucesso/422 exposto como metadado, mapeamento de erros e `UPGRADE_REQUIRED`.

**Verificação:**

```bash
pnpm --filter @lotg/client-sdk test
```

**Pronto quando:** 5 chamadas simultâneas com token expirado disparam exatamente 1 `POST /auth/refresh` no `fetch` simulado.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.10 e MVP-ROADMAP.md F3-T1. Implemente o client-sdk tipado com refresh single-flight, ETag, retentativas seguras e erros claros, testado com fetch simulado."

### F3-T2 · Esqueleto da extensão e pipeline de build `M`

**Objetivo:** a extensão ativa no VS Code com ícone, árvore vazia e build reproduzível para extensão e Webview.
**GDD:** §13.1, §14.10.
**Depende de:** F3-T1.
**Entregáveis:** `packages/extension/{package.json,src/extension.ts,src/services/tokenStore.ts,esbuild.mjs}`, `packages/webview/esbuild.mjs`, `.vscode/launch.json`, `.vscode/tasks.json`, ícone SVG.

- [ ] F3-T2.1 `package.json` da extensão: `contributes.viewsContainers.activitybar` (`lords`, ícone), `views` (`lords.tree`), `commands` (todos os `Lords: …` da v0.1, mesmo que ainda sem implementação), `configuration` (`lords.serverUrl`, `lords.notifications`, `lords.discreetMode`, `lords.vigilHour`), `activationEvents` por view e comandos, `engines.vscode ^1.90`.
- [ ] F3-T2.2 Build: esbuild empacota a extensão em `dist/extension.js` (CommonJS, `external: ['vscode']`, `platform: node`) e a Webview em `media/webview.{js,css}` (ESM, Preact); `pnpm dev:ext` em modo watch.
- [ ] F3-T2.3 `extension.ts`: `activate` cria `OutputChannel` "Lords of the Guild", instancia `TokenStore` (SecretStorage), cliente do SDK com `lords.serverUrl`, e registra árvore e comandos com implementações provisórias ("em construção").
- [ ] F3-T2.4 `.vscode/launch.json` (Extension Development Host) e `tasks.json` (watch) funcionando com F5.

**Verificação:** F5 abre o host de desenvolvimento; o ícone aparece na Activity Bar; a árvore mostra "Jogar agora" como item provisório; `Lords: Sobre` mostra a versão do servidor lida de `/v1/version`.

**Pronto quando:** `pnpm build` produz `dist/extension.js` e `media/webview.js`; F5 ativa sem erros no Output.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.1 e §14.10 e MVP-ROADMAP.md F3-T2. Crie o esqueleto da extensão com contributes completos da v0.1, pipeline esbuild para extensão e Webview, SecretStorage e launch.json para F5."

### F3-T3 · Conta: boas-vindas, Jogar agora, GitHub, Código do Reino `L`

**Objetivo:** o fluxo de entrada do GDD §13.9 inteiro.
**GDD:** §13.9, §14.7.
**Depende de:** F3-T2.
**Entregáveis:** `packages/extension/src/account/{accountService,githubLink,recoveryCode}.ts`, rota `welcome` da Webview, comandos de conta, testes dos módulos puros.

- [ ] F3-T3.1 `AccountService` com estados `signedOut | anonymous | linked` persistidos (tokens no `SecretStorage`, metadados em `globalState`), eventos de mudança para árvore e status bar.
- [ ] F3-T3.2 Tela de boas-vindas (Webview, rota `welcome`): nome de quem governa, nome do feudo (sugestão "Pedra Alta"), **Jogar agora**, "Entrar com GitHub", "Usar Código do Reino". Na v0.1 não há seleção de dificuldade nem ritmo (v0.2). Envia `timezone` detectado e `lords.vigilHour`.
- [ ] F3-T3.3 Jogar agora → `POST /auth/anonymous` → `POST /games` → abre a aba Feudo. Tempo alvo: menos de 5 s de rede em condições normais.
- [ ] F3-T3.4 GitHub: `vscode.authentication.getSession('github', ['read:user'], { createIfNone: true })` → `POST /auth/github`; em `ACCOUNT_CONFLICT`, QuickPick com duas opções descritas ("Usar o feudo já vinculado ao GitHub (este feudo anônimo será excluído)" / "Manter este feudo e mover o vínculo para ele"); nunca mesclar.
- [ ] F3-T3.5 Código do Reino: `Lords: Gerar Código do Reino` mostra o código em modal com "Copiar" e aviso de exibição única; `Lords: Entrar com Código do Reino` abre `InputBox` com validação de formato. "Sair desta máquina" revoga a sessão e limpa tokens, view, ETag e cursor locais. "Excluir conta" exige confirmação e nome do feudo; explica bloqueio imediato, remoção pelo job após sete dias e retenção dos backups por 14 dias desde sua geração. Após 202, limpa os mesmos dados e volta às boas-vindas; não oferece desfazer. `SESSION_REVOKED` também limpa os dados locais da conta.
- [ ] F3-T3.6 Lembrete único do dia 3 (flag em `globalState`) com botão "Não lembrar mais".
- [ ] F3-T3.7 Testes dos módulos puros (validação do código, máquina de estados, montagem do corpo de criação de partida).

**Verificação:** roteiro manual: criar conta em um perfil do VS Code; em outro perfil (`code --user-data-dir /tmp/lotg-b`), entrar com o código; o mesmo feudo aparece. Repetir com GitHub.

**Pronto quando:** do F5 ao painel Feudo com uma partida nova há exatamente 2 campos e 1 clique.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.9 e §14.7 e MVP-ROADMAP.md F3-T3. Implemente o AccountService, a tela de boas-vindas e os fluxos Jogar agora, GitHub (com conflito) e Código do Reino, mais sair e excluir conta. Use plan mode primeiro."

### F3-T4 · Ciclo de atualização, cache e Relatório de Retorno `M`

**Objetivo:** o estado chega sozinho, sobrevive sem conexão e conta o que aconteceu na ausência.
**GDD:** §2.3, §13.5 (Relatório de Retorno), §13.9 (sem conexão), §14.10.
**Depende de:** F3-T3.
**Entregáveis:** `packages/extension/src/game/{gameSession,connection,returnReport}.ts`, testes com temporizadores falsos.

- [ ] F3-T4.1 `GameSession`: ciclo de 30 s com o painel visível, 2 min com ele oculto; `getView` com ETag; `getEvents(after)` com `lastSeq` persistido; eventos `onView`, `onEvents`, `onConnection`. Recibo repetido dispara leitura atual sem reaplicar eventos antigos ou substituir a tela por uma view antiga; consumir eventos novos pelo cursor evita notificações duplicadas.
- [ ] F3-T4.2 Máquina de conexão `online | offline(retryIn) | unauthenticated`; recuo exponencial 5 s → 60 s; ao voltar, sincroniza imediatamente.
- [ ] F3-T4.3 Cache: último `ViewState`, `stateVersion`, ETag, cursor e `lastSeenAt` em `globalState`, separados por servidor, conta e partida; sem conexão, a UI recebe o cache com `connection: offline`. Logout, exclusão e revogação apagam o cache da conta local; falha de autenticação não é tratada como modo offline.
- [ ] F3-T4.4 Relatório de Retorno: ao ativar, se `now − lastSeenAt ≥ 4 h`, busca eventos desde `lastSeq`, monta resumo (produção estimada a partir da diferença de estoques, obras concluídas, recrutas, fome) e abre a rota `today`.
- [ ] F3-T4.5 Testes: cadência com `vi.useFakeTimers`, recuo, cache servido quando o `fetch` falha, limiar de 4 h, reenvio sem regressão de tela/notificação duplicada e limpeza de cache em logout/exclusão/revogação.

**Verificação:**

```bash
pnpm --filter lords-of-the-guild test -- gameSession connection returnReport
```

Manual: derrubar a API (`Ctrl+C` no `dev:api`) com o painel aberto → banner "Sem ligação com o reino" em até 30 s; subir de novo → volta sozinho.

**Pronto quando:** sem rede, o painel mostra o último estado e nenhum comando é enviado ou enfileirado.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.5, §13.9 e §14.10 e MVP-ROADMAP.md F3-T4. Implemente o GameSession com polling adaptativo, ETag, máquina de conexão com recuo, cache em globalState e o Relatório de Retorno, com testes de temporizador falso."

### F3-T5 · TreeView e Status Bar `M`

**Objetivo:** a navegação lateral e a linha de status do GDD §13.2 e §13.5, restritas à v0.1.
**GDD:** §13.2, §13.5.
**Depende de:** F3-T4.
**Entregáveis:** `packages/extension/src/ui/{treeProvider,statusBar}.ts`, testes de formatação.

- [ ] F3-T5.1 Itens: "Hoje em <feudo>" (badge: itens não vistos do relatório), "Feudo: <nome> · <estação>, dia N" com filhos Recursos (estoque e taxa com sinal), Trabalhadores (alocados por edifício com ações inline `+`/`−`), Construções (obra ativa com tempo restante; melhorias disponíveis), Crônica (últimas 5 linhas), Conta (estado e ações), Configurações (abre as settings da extensão).
- [ ] F3-T5.2 Tooltips com o `breakdown` do `ViewState`; descrições truncadas com reticências; atualização com debounce de 500 ms; clique abre a aba correspondente.
- [ ] F3-T5.3 Status bar com prioridade: fome (`$(warning) Fome em Pedra Alta`) > obra ativa (`$(tools) Serraria Nv2 · 00:42`) > padrão (`$(home) Pedra Alta · +15 comida/h`); sem conexão: `$(debug-disconnect) Sem ligação com o reino`; modo discreto: `$(circle-filled) 00:42`. Clique abre o painel. Contagem regressiva local atualizada a cada 30 s (não por segundo, para não distrair).
- [ ] F3-T5.4 Testes das funções puras de formatação (tempo restante, sinal de taxa, prioridade).

**Verificação:** manual com F5: alocar via `+` na árvore muda a taxa imediatamente; concluir uma obra remove o item da status bar.

**Pronto quando:** toda ação da árvore tem equivalente em comando da paleta e vice-versa.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.2 e §13.5 e MVP-ROADMAP.md F3-T5. Implemente a TreeView da v0.1 com badges, ações inline e tooltips, e a status bar com prioridades e modo discreto."

### F3-T6 · Comandos da paleta e QuickPicks `M`

**Objetivo:** jogar inteiramente pelo teclado.
**GDD:** §13.6.
**Depende de:** F3-T5.
**Entregáveis:** `packages/extension/src/commands/*.ts`.

- [ ] F3-T6.1 `Lords: Abrir painel`, `Lords: Alocar trabalhadores…` (QuickPick de edifícios → `InputBox` com a taxa resultante no texto de validação), `Lords: Construir ou melhorar…` (QuickPick com custo, tempo e `$(check)`/`$(lock)` por acessibilidade), `Lords: Recrutar aldeões…` (`InputBox` 1–5 com vagas no prompt), `Lords: Nova partida` (modal com confirmação; `replaceActive: true`).
- [ ] F3-T6.2 `Lords: Exportar Crônica (Markdown)` abre `chronicle.md` em um editor novo não salvo; `Lords: Sobre` (versão da extensão, do servidor e hash do conteúdo); `Lords: Modo discreto` alterna a configuração.
- [ ] F3-T6.3 Comandos de conta de F3-T3 registrados no mesmo módulo.
- [ ] F3-T6.4 Recusas do motor (`GAME_RULE`) aparecem como `showWarningMessage` com a mensagem em português; erros de rede como `showErrorMessage` com botão "Tentar de novo".

**Verificação:** manual: jogar 10 minutos só com a paleta (sem mouse) e registrar fricções em `docs/manual-test-v0.1.md`.

**Pronto quando:** cada comando listado em `contributes.commands` tem implementação e aparece com prefixo "Lords:".

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.6 e MVP-ROADMAP.md F3-T6. Implemente todos os comandos da paleta da v0.1 com QuickPicks e InputBoxes informativos e tratamento de recusas e erros de rede."

### F3-T7 · Webview: aba Feudo, Hoje e boas-vindas `L`

**Objetivo:** o painel do GDD §13.3 (subconjunto v0.1), bonito, nativo do tema e navegável por teclado.
**GDD:** §13.3, §13.7, §14.12.
**Depende de:** F3-T6.
**Entregáveis:** `packages/webview/src/{app,bridge,theme}.tsx`, `components/{Header,ResourcesTable,WorkersPanel,ConstructionsPanel,ObjectivesPanel,ChroniclePanel,FamineBanner,OfflineBanner,Welcome,Today}.tsx`, `styles.css`, `packages/extension/src/ui/panel.ts`.

- [ ] F3-T7.1 `panel.ts`: `WebviewPanel` único (`retainContextWhenHidden: true`), CSP com nonce, recursos via `asWebviewUri`, ponte de mensagens tipada pelo `@lotg/protocol`, rotas `welcome | today | fief`.
- [ ] F3-T7.2 Tema: só variáveis `--vscode-*` (texto, fundo, bordas, botões, foco, avisos); nenhuma cor fixa; testar em Dark Modern, Light Modern e High Contrast.
- [ ] F3-T7.3 Aba Feudo: cabeçalho (nome, Salão, calendário, população), tabela de recursos (estoque, cap "—", por hora com sinal, tooltip com `breakdown`), trabalhadores com `−`/`+` (teclado: setas, `+`, `-`), construções (ativa com barra e contagem regressiva local por segundo; planejadas; disponíveis com custos em "chips", destacando o que falta), objetivos, Crônica (10 linhas), banners de fome e de conexão.
- [ ] F3-T7.4 Aba Hoje: Relatório de Retorno (F3-T4) e atalhos para as decisões; na v0.1 "decisões pendentes" fica vazia com texto explicativo.
- [ ] F3-T7.5 Acessibilidade: ordem de tabulação lógica, foco visível, `aria-live` para a tabela de recursos (educado), `prefers-reduced-motion`, largura mínima 480 px sem rolagem horizontal, números em pt-BR com `Intl.NumberFormat`.
- [ ] F3-T7.6 Testes das funções de formatação e, opcionalmente, snapshots com `preact-render-to-string` (parte do ecossistema Preact).

**Verificação:** manual nos três temas; `Tab` percorre todos os controles; `+` na Fazenda muda a taxa em menos de 1 s; a contagem regressiva termina junto com a notificação de obra concluída.

**Pronto quando:** nenhuma cor fixa em `styles.css` (`grep -E '#[0-9a-fA-F]{3,6}|rgb\(' retorna vazio`) e o painel funciona em 480 px.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.3, §13.7 e §14.12 e MVP-ROADMAP.md F3-T7. Implemente a Webview em Preact com as rotas welcome, today e fief, só com variáveis de tema do VS Code, navegação por teclado e tooltips. Use plan mode e divida em três sessões: ponte e tema; aba Feudo; Hoje e acessibilidade."

### F3-T8 · Notificações e política `S`

**Objetivo:** avisar o essencial, nunca incomodar.
**GDD:** §13.5.
**Depende de:** F3-T7.
**Entregáveis:** `packages/extension/src/notifications/{policy,notifier}.ts`, testes.

- [ ] F3-T8.1 `policy.ts` (puro): entrada = eventos novos + configuração + silêncio ativo + histórico da última hora; saída = notificações a exibir. `silent` nada; `essential` só `famineStarted` na v0.1; `all` inclui `constructionFinished`, `recruitmentFinished`, `objectiveCompleted`. Máximo 3 por hora; excedente vira badge na árvore.
- [ ] F3-T8.2 `notifier.ts`: `showInformationMessage`/`showWarningMessage` com botões `[Ver]` (abre o painel na aba certa) e `[Silenciar 2h]`; respeita o modo discreto (suprime tudo).
- [ ] F3-T8.3 Testes: limite por hora, silêncio, modo discreto, mapeamento por nível.

**Verificação:**

```bash
pnpm --filter lords-of-the-guild test -- policy
```

**Pronto quando:** com `all`, concluir 5 obras em uma hora gera 3 notificações e badge "2".

**Prompt sugerido:** "Leia GAME_DESIGN.md §13.5 e MVP-ROADMAP.md F3-T8. Implemente a política de notificações como módulo puro testado e o notificador com botões Ver e Silenciar 2h."

### F3-T9 · Testes do cliente e roteiro manual `S`

**Objetivo:** cobertura do que é puro e um roteiro reproduzível do que é manual.
**GDD:** §16.1 (critérios 1 a 12).
**Depende de:** F3-T8.
**Entregáveis:** testes faltantes, `docs/manual-test-v0.1.md`.

- [ ] F3-T9.1 Cobertura ≥ 80% nos módulos puros da extensão (`account`, `game`, `notifications`, `ui/format`).
- [ ] F3-T9.2 `docs/manual-test-v0.1.md`: um roteiro passo a passo por critério de aceitação (§8 deste arquivo), com pré-condições, passos, resultado esperado e campo para evidência (captura ou saída). Inclui o truque de "segunda máquina" com `code --user-data-dir`.

**Verificação:** executar o roteiro inteiro uma vez contra o servidor local e registrar o resultado.

**Pronto quando:** os 12 critérios têm roteiro e ao menos uma execução registrada.

**Prompt sugerido:** "Leia MVP-ROADMAP.md §6 e F3-T9 e GAME_DESIGN.md §16.1. Complete os testes dos módulos puros da extensão e escreva docs/manual-test-v0.1.md com um roteiro por critério de aceitação."

### F3-T10 · Empacotamento da extensão `S`

**Objetivo:** um `.vsix` instalável, com página de apresentação e política de privacidade.
**GDD:** §13, §14.14 (privacidade).
**Depende de:** F3-T9.
**Entregáveis:** `packages/extension/{README.md,CHANGELOG.md,icon.png}`, `lords-of-the-guild-0.1.0.vsix`.

- [ ] F3-T10.1 Ícone 128×128, `README.md` da extensão (o que é, como começar, o parágrafo de privacidade do GDD §14.14, como trocar `lords.serverUrl`), `CHANGELOG.md`.
- [ ] F3-T10.2 `vsce package` sem avisos; `code --install-extension` em um perfil limpo funciona; `lords.serverUrl` padrão aponta para a URL de produção (preenchida após F4-T3; até lá, placeholder documentado).
- [ ] F3-T10.3 **Decisão sua:** publicar no Marketplace (exige `publisher` e token) ou distribuir o `.vsix` entre o grupo.

**Verificação:**

```bash
pnpm --filter lords-of-the-guild package && code --install-extension packages/extension/lords-of-the-guild-0.1.0.vsix
```

**Pronto quando:** a extensão instalada de um `.vsix` em perfil limpo chega ao painel Feudo com Jogar agora.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F3-T10. Prepare o empacotamento da extensão com vsce: ícone, README com privacidade, CHANGELOG e o .vsix. Não publique no Marketplace; isso é decisão minha."

---

## 6. Fase 4 — Implantação e operação

**Meta da fase:** o jogo acessível em `https://<domínio>`, com TLS, backup diário testado e procedimento de atualização e reversão.

### F4-T1 · Compose de produção, Caddy e variáveis `M`

**GDD:** §14.13, §14.14.
**Depende de:** F2-T9.
**Entregáveis:** `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/.env.example` (seção produção), `deploy/README.md`.

- [ ] F4-T1.1 `docker-compose.yml`: `caddy` (`caddy:2`, portas 80/443, volumes `caddy_data` e `caddy_config`, `Caddyfile` montado), `api` (imagem construída no servidor a partir do repositório ou `${API_IMAGE}:${API_IMAGE_TAG}`, `env_file`, `depends_on: db: condition: service_healthy`, `restart: unless-stopped`, logging `json-file` com `max-size 10m` e `max-file 5`), `db` (`postgres:16`, volume `lotg_db`, healthcheck, **sem porta publicada**).
- [ ] F4-T1.2 `Caddyfile`: `{$PUBLIC_HOST}` com `encode zstd gzip`, `reverse_proxy api:3000`, cabeçalhos `Strict-Transport-Security`, `X-Content-Type-Options nosniff`, `Referrer-Policy no-referrer`; variante local com `tls internal` para ensaio.
- [ ] F4-T1.3 `deploy/README.md`: os dez passos de implantação (GDD §18.4 expandido), geração de segredos, como ver logs, como entrar no `psql`.
- [ ] F4-T1.4 Ensaio local: `PUBLIC_HOST=localhost docker compose -f deploy/docker-compose.yml up -d` → `curl -k https://localhost/v1/health` responde.

**Verificação:** o ensaio local passa; `docker compose config` valida sem avisos.

**Pronto quando:** nenhum segredo real está no repositório (`git grep -i secret` só encontra o `.env.example`).

**Prompt sugerido:** "Leia GAME_DESIGN.md §14.13, §14.14 e §18.4 e MVP-ROADMAP.md F4-T1. Escreva o compose de produção com Caddy, API e Postgres, o Caddyfile e o deploy/README.md com os dez passos. Faça o ensaio local com tls internal."

### F4-T2 · Backup e restauração `S`

**GDD:** §14.6 (backup).
**Depende de:** F4-T1.
**Entregáveis:** `deploy/backup.sh`, `deploy/restore.sh`, seção no `deploy/README.md`.

- [ ] F4-T2.1 `backup.sh`: `pg_dump -Fc` via `docker compose exec -T db` para `deploy/backups/lotg-AAAAMMDD-HHMM.dump`; retenção de 14 dias; códigos de saída corretos; linha de cron `0 3 * * *`.
- [ ] F4-T2.2 `restore.sh <arquivo>`: para a API, `pg_restore --clean --if-exists`, sobe a API, imprime contagens de `accounts` e `games`.
- [ ] F4-T2.3 Ensaio de restauração contra o compose de dev documentado com data em `deploy/README.md`.

**Verificação:** criar 3 contas no ambiente de ensaio, fazer backup, apagar uma, restaurar, ver 3 contas de novo.

**Pronto quando:** o ensaio de restauração está registrado com data e resultado.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F4-T2. Escreva backup.sh e restore.sh para o compose, com retenção de 14 dias, e faça o ensaio de restauração localmente, registrando no deploy/README.md."

### F4-T3 · Provisionar o VPS e colocar no ar `M`

**Decisões suas antes de começar:** provedor do VPS (Ubuntu 24.04 LTS, 2 vCPU, 2 a 4 GB) e domínio.
**GDD:** §14.13, §18.4.
**Depende de:** F4-T2, F3-T10.
**Entregáveis:** servidor no ar; `deploy/README.md` com o registro da instalação.

- [ ] F4-T3.1 Registro DNS A para o domínio; usuário não root com `sudo`; chave SSH; `ufw` permitindo só 22, 80 e 443; `unattended-upgrades`.
- [ ] F4-T3.2 Docker Engine + plugin Compose instalados; `git clone` do repositório em `/opt/lords`; `.env` gerado com `pnpm secrets:gen` (ou `openssl rand`); `PUBLIC_HOST` definido.
- [ ] F4-T3.3 `docker compose -f deploy/docker-compose.yml up -d --build`; certificado emitido; `/v1/health` 200 em HTTPS.
- [ ] F4-T3.4 Cron de backup instalado; `docker system prune -af --filter until=168h` semanal.
- [ ] F4-T3.5 `lords.serverUrl` padrão da extensão atualizado para o domínio; novo `.vsix` gerado (F3-T10).

**Verificação:**

```bash
curl -s https://<domínio>/v1/health && curl -s https://<domínio>/v1/version
```

Instalar o `.vsix` em uma máquina limpa, clicar em Jogar agora e ver Pedra Alta.

**Pronto quando:** uma pessoa fora da sua máquina joga pela internet.

**Prompt sugerido:** "Leia GAME_DESIGN.md §18.4 e MVP-ROADMAP.md F4-T3. Me guie passo a passo na provisão do VPS (Ubuntu 24.04) e na primeira implantação; gere os comandos, eu executo no servidor e colo as saídas. Não guarde segredos no repositório."

### F4-T4 · Observabilidade mínima `S`

**GDD:** §14.13.
**Depende de:** F4-T3.
**Entregáveis:** monitor de disponibilidade configurado, alertas de disco, seção "Operação" no `deploy/README.md`.

- [ ] F4-T4.1 Monitor externo de `GET /v1/health` a cada minuto (serviço gratuito de uptime ou cron em outra máquina) com aviso por e-mail ou mensagem.
- [ ] F4-T4.2 Cron diário que avisa se o disco passar de 80% ou se o último backup tiver mais de 36 h.
- [ ] F4-T4.3 Cheat-sheet de operação: `docker compose logs -f api --since 1h`, consultas úteis (`contas por dia`, `partidas ativas`, `comandos por hora`) em `deploy/analytics/ops.sql`.

**Verificação:** derrubar a API por 2 minutos gera o alerta e a recuperação.

**Pronto quando:** você recebeu um alerta de teste.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F4-T4. Configure um monitor de saúde externo, um cron de alerta de disco e backup, e escreva o cheat-sheet de operação com consultas SQL agregadas."

### F4-T5 · Atualização, reversão e versão de produção `S`

**GDD:** §14.13.
**Depende de:** F4-T4.
**Entregáveis:** procedimento em `deploy/README.md`, tags Git.

- [ ] F4-T5.1 Procedimento de release: `git tag v0.1.x`, no servidor `git pull && docker tag lotg-api:latest lotg-api:prev && docker compose build api && docker compose up -d api`; conferir `/v1/version`.
- [ ] F4-T5.2 Reversão: `docker tag lotg-api:prev lotg-api:latest && docker compose up -d api` em menos de 2 minutos; regra: migrações sempre compatíveis com a versão anterior (expandir, depois contrair).
- [ ] F4-T5.3 Ensaio: publicar uma mudança trivial, reverter, confirmar.

**Verificação:** ensaio de reversão registrado com tempo medido.

**Pronto quando:** a reversão ensaiada levou menos de 2 minutos sem perda de dados.

**Prompt sugerido:** "Leia MVP-ROADMAP.md F4-T5. Documente e ensaie o procedimento de atualização e reversão da API em produção, com a regra de migrações compatíveis."

---

## 7. Fase 5 — Fechamento do MVP v0.1

**Meta da fase:** os 12 critérios de aceitação do GDD §16.1 comprovados em produção, um playtest real de 48 horas, correções, versão etiquetada e o caminho para a v0.2 aberto.

### F5-T1 · Critérios de aceitação em produção `M`

**Depende de:** F4-T5.
**Entregáveis:** `docs/acceptance-v0.1.md`.

- [ ] F5-T1.1 Executar o roteiro de `docs/manual-test-v0.1.md` contra a produção, dois perfis de VS Code, registrando evidência por critério.
- [ ] F5-T1.2 Rodar o teste de concorrência e idempotência (F2-T6.7) e o `sim-cli --remote` com 20 bots contra produção por 2 minutos, com p95 registrado.
- [ ] F5-T1.3 Qualquer critério falho vira item em F5-T3 com prioridade P0.

**Pronto quando:** os 12 critérios marcados como aprovados com evidência.

**Prompt sugerido:** "Leia MVP-ROADMAP.md §8 e F5-T1 e docs/manual-test-v0.1.md. Conduza a verificação dos 12 critérios de aceitação contra a produção, me pedindo as evidências manuais e rodando as automáticas, e registre tudo em docs/acceptance-v0.1.md."

### F5-T2 · Playtest de 48 horas `M`

**Depende de:** F5-T1.
**Entregáveis:** `docs/playtest-v0.1.md` com achados priorizados.

- [ ] F5-T2.1 3 a 5 pessoas instalam o `.vsix` e jogam dois dias; formulário curto (o que confundiu, o que faltou, quando sentiu vontade de voltar).
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
**Entregáveis:** `README.md` final, `docs/architecture.md`, índice de ADRs, tag `v0.1.0`, release com `.vsix`.

- [ ] F5-T4.1 `README.md` raiz: o que é, como jogar, como desenvolver (comandos da §1.4), como implantar (link para `deploy/README.md`), licença.
- [ ] F5-T4.2 `docs/architecture.md` com o diagrama do GDD §14.1 atualizado para o que foi construído e a lista de divergências aceitas.
- [ ] F5-T4.3 `CHANGELOG.md`, tag `v0.1.0`, release no GitHub com o `.vsix` anexado.

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
| 1 | Jogar agora e primeiro comando em menos de 30 s, sem e-mail nem senha | F2-T4, F2-T6, F3-T3, F3-T7 | Cronômetro no roteiro manual |
| 2 | Alocar um trabalhador muda a taxa imediatamente e reduz os livres | F1-T3, F1-T6, F1-T9, F3-T7 | Teste de unidade + manual |
| 3 | Não alocar mais que a população nem gastar o que não existe; motivo visível | F1-T7, F3-T6, F3-T7 | Testes de recusa + manual |
| 4 | Melhoria desconta uma vez, ocupa a fila e conclui no tempo | F1-T5, F2-T6 | Testes + evento em `game_events` |
| 5 | Reabrir após horas simula o intervalo sem duplicar; divisão de intervalo exata | F1-T3, F1-T4, F2-T6, F3-T4 | Teste de propriedade + manual com relógio |
| 6 | Escassez correta em longos períodos, com instante exato na Crônica | F1-T4, F1-T8 | Teste de 30 dias |
| 7 | Recibo original após reinício/reenvio; UUID conflitante recusado; avanço preservado em recusa; dois clientes não corrompem | F2-T6, F2-T7, F2-T8, F3-T1 | Testes F2-T6.7–10 + `docker compose restart` |
| 8 | Regras rodam em testes sem VS Code | F1-T1 a F1-T11 | `pnpm --filter @lotg/engine test` |
| 9 | Tema claro e escuro; navegável por teclado | F3-T5, F3-T6, F3-T7 | Manual nos três temas |
| 10 | GitHub ou Código do Reino em outra máquina mostra o mesmo feudo | F2-T5, F3-T3 | Manual com dois perfis |
| 11 | Sem conexão: último estado, explicação, retorno automático | F3-T4, F3-T7 | Manual derrubando a API |
| 12 | Exclusão bloqueia acesso e limpa cache imediatamente; job remove conta e dependentes a partir de sete dias; backups seguem retenção informada | F2-T4, F2-T5, F2-T7, F3-T3, F3-T4 | Testes de bloqueio em duas instâncias, relógio antes/no prazo, cascatas SQL e limpeza local |

---

## 9. Registro de execução

Preencher ao fechar cada tarefa (o agente faz isso no ritual da §0.3).

| Tarefa | Data | Commit | Sessões | Observações e desvios |
|---|---|---|---|---|
| F0-T1 | 2026-10-01 | HASH_F0-T1 | 1 | Docker 29.8, Compose v5.5, Node 22.22.3, pnpm 9.15.9. O default do `nvm` continua em 24 (`nvm alias default 22` não foi executado para não afetar outros projetos): o repositório seleciona o 22 pelo `.nvmrc` (`nvm use`) e o pnpm 9 pelo campo `packageManager`. Extensão Docker do VS Code instalada. |
| F0-T2 | 2026-10-01 | HASH_F0-T2 | 1 | `pnpm verify` verde com 8 testes, também em cópia limpa. Vitest 5 removeu `vitest.workspace.ts`: os projetos `unit` e `integration` ficam em `vitest.config.ts`. TypeScript fixado em 6.x (o `typescript-eslint` ainda não aceita o 7). `dev:api`, `db:migrate`, `dev:ext` e `sim` existem e avisam a tarefa que os entrega. |
| F0-T3 | 2026-10-01 | HASH_F0-T3 | 1 | Sessão nova (`claude -p`) resumiu motor puro, conteúdo como dados, `pnpm verify` e bibliotecas permitidas sem correção. O `CLAUDE.md` mantém os contratos dos ADRs 0003–0005 além do modelo da §A.1. |
| F0-T4 | | | | |
| F0-T5 | | | | |
| F1-T1 | | | | |
| F1-T2 | | | | |
| F1-T3 | | | | |
| F1-T4 | | | | |
| F1-T5 | | | | |
| F1-T6 | | | | |
| F1-T7 | | | | |
| F1-T8 | | | | |
| F1-T9 | | | | |
| F1-T10 | | | | |
| F1-T11 | | | | |
| F2-T1 | | | | |
| F2-T2 | | | | |
| F2-T3 | | | | |
| F2-T4 | | | | |
| F2-T5 | | | | |
| F2-T6 | | | | |
| F2-T7 | | | | |
| F2-T8 | | | | |
| F2-T9 | | | | |
| F3-T1 | | | | |
| F3-T2 | | | | |
| F3-T3 | | | | |
| F3-T4 | | | | |
| F3-T5 | | | | |
| F3-T6 | | | | |
| F3-T7 | | | | |
| F3-T8 | | | | |
| F3-T9 | | | | |
| F3-T10 | | | | |
| F4-T1 | | | | |
| F4-T2 | | | | |
| F4-T3 | | | | |
| F4-T4 | | | | |
| F4-T5 | | | | |
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
| CSP da Webview bloqueando scripts | Painel em branco | Nonce por carga, `asWebviewUri`, sem `eval`, testado em F3-T7.1 |
| Perda de dados por volume Docker removido | `docker compose down -v` em produção | Backup diário testado (F4-T2); `README` alerta para nunca usar `-v` em produção |
| Contexto longo degrada a qualidade do agente | Tarefas `L` em uma sessão só | Dividir por subtarefas; uma tarefa por sessão (§0.3) |

---

## Apêndice A — Modelos para o Claude Code

### A.1 Modelo de `CLAUDE.md` do projeto (F0-T3)

````markdown
# Lords of the Guild — instruções do projeto

## O que é
Jogo medieval de gerenciamento jogado dentro do VS Code; motor determinístico em TypeScript, servidor Fastify + PostgreSQL autoritativo, extensão como cliente. Especificação: GAME_DESIGN.md (contrato: §14, §16.1). Plano: MVP-ROADMAP.md.

## Pacotes
engine (motor puro) · content (dados + zod) · protocol (Command, ViewState, API) · server (Fastify + Drizzle) · client-sdk · sim-cli · extension (VS Code) · webview (Preact). Regras de dependência: engine/content/protocol não importam vscode, fastify, pg ou node:*.

## Comandos
pnpm dev:up · pnpm dev:api · pnpm dev:ext · pnpm verify (lint + typecheck + test) · pnpm test:integration (precisa de TEST_DATABASE_URL) · pnpm sim -- --seed X --days 7

## Regras de arquitetura
1. Nenhuma regra de jogo fora de packages/engine. Nenhum número de jogo fora de packages/content.
2. O servidor é o relógio; o cliente nunca envia estado ou timestamps.
3. Recursos em milésimos inteiros; advanceTo por segmentos; invariante de divisão de intervalo é sagrado.
4. Toda mudança de estado é um comando validado, idempotente por commandId no servidor.
5. A Webview só exibe ViewState; nunca calcula regras.
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
Rodar `docker compose down -v` fora do ambiente de dev; commitar .env; publicar no Marketplace; mesclar estados de contas; usar Alpine como base da imagem.
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
