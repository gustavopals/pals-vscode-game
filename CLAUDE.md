# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

**Lords of the Guild** é um jogo medieval de gerenciamento assíncrono jogado **no navegador, em uma página com a aparência de um editor de código**: motor determinístico em TypeScript, servidor Fastify + PostgreSQL autoritativo, app web como cliente.

- [GAME_DESIGN.md](GAME_DESIGN.md) — GDD documental v0.7. §14 é o **contrato de arquitetura**, §16.1 é o escopo exato da v0.1, §16.2 os critérios da v0.2, §18.2 as seções que cada versão implementa, §18.3 são regras permanentes.
- [MVP-ROADMAP.md](MVP-ROADMAP.md) — plano de execução da v0.1 (fases `F0…F5`, tarefas `F1-T3`), fechado. [docs/roadmap-v0.2.md](docs/roadmap-v0.2.md) — o da v0.2 (fases `A…G`, tarefas `V2C-T2`), no mesmo formato: subtarefas em caixas de seleção, "Verificação", "Pronto quando" e o Registro de execução (§11), que diz o que foi feito e o que não foi verificado. [docs/roadmap-v0.3.md](docs/roadmap-v0.3.md) — o da v0.3, **proposto**, sem nenhuma tarefa executada.
- [Decisões de arquitetura](docs/decisions/README.md) — ADRs. Os contratos dos ADRs 0003–0005 já estão no GDD; segui-los não exige nova aprovação de desvio.
- [docs/architecture.md](docs/architecture.md) — o que está construído (reescrito para a v0.2), com a ordem dos eventos, os relógios, o Conselho, a Ameaça e os limites conhecidos.

**Estado:** **a v0.2 "Estações e Conselho" foi implementada em 2026-10-02** (o motor, o servidor, o app e o simulador das Fases A a E do roadmap da v0.2), por agentes de código em duas trilhas, e **publicada por fase no `main`** por autorização do autor (Fases A e B, depois C, depois D e E; antes de afirmar o que está no ar, confira `protocol` e `builtAt` em `GET /v1/version`). **A tag `v0.2.0` e a release são de 2026-10-05**, criadas a pedido do autor depois da Fase G; os pacotes e `GET /v1/version` dizem `0.2.0`. **Em 2026-10-05 o autor respondeu às pendências**, com quatro dias de jogo em produção e outras pessoas jogando ([ADR 0016](docs/decisions/0016-respostas-do-autor-as-pendencias-da-v0.2.md); a tabela das respostas abre [docs/pendencias-v0.2.md](docs/pendencias-v0.2.md)), e a **Fase G** do roadmap (§6b, tarefas V2G-T1 a T7) aplicou as respostas: depósitos em 1.000 no nível 1, os 50 de ouro de volta ao objetivo 4, a deserção por fome e o aviso da Torre em tempo real, a fome que reabre logo, os sete problemas das cartas, as descrições das dificuldades e três ajustes do app. Continua do autor a evidência manual por critério de aceitação, que ninguém preencheu: a versão foi fechada por decisão dele, como a v0.1. O que foi feito por fase está em [docs/relatorio-v0.2.md](docs/relatorio-v0.2.md); os seis critérios do GDD §16.2 e os cenários QA-01 a QA-16, com a prova automática de cada um e a evidência manual por preencher, em [docs/acceptance-v0.2.md](docs/acceptance-v0.2.md); o roteiro para jogar em desenvolvimento, em [docs/manual-test-v0.2.md](docs/manual-test-v0.2.md). Não foram feitos: os playtests com outras pessoas (o da v0.1, V2A-T1, e o da v0.2, V2F-T3), as revisões com o autor jogando (V2C-T7.5, V2D-T5, V2E-T5), a matriz completa do simulador no fechamento (V2F-T1, com o balanceamento da Ameaça em revisão) e o ensaio de reversão com imagens atravessando uma migração de estado. O estado do jogo está na versão 12 e o protocolo, na 2.

A v0.1 foi fechada em 2026-10-01 (tag `v0.1.0`), por decisão do autor, sem playtest externo e sem evidência por critério ([docs/acceptance-v0.1.md](docs/acceptance-v0.1.md)). O jogo está no ar em `https://lords.palsincomehub.com`, no Coolify ([ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)), com banco, API e app em três recursos; [deploy/README.md](deploy/README.md) descreve a instalação, a operação, a reversão depois de uma migração de estado e os ensaios. Continuam pendentes, todas do autor: cópia de `RECOVERY_CODE_SECRET` fora do Coolify, destino externo para os backups, canal de notificação do Coolify e a confirmação de que o e-mail de alerta do GitHub chega. Fora dos roadmaps, a pedido do autor, existe a **página de apresentação** do jogo ([ADR 0012](docs/decisions/0012-pagina-de-apresentacao.md)): `packages/landing`, uma página estática em domínio próprio, publicada como um quarto recurso do Coolify.

Decisões do autor em 2026-10-01: aprovados os ADRs 0006 (`@types/node` e `@types/pg`), 0007 (Crônica sem viradas de dia, já implementado), 0008 (os seis pontos: tokens em `localStorage`, GitHub por *device flow*, remoção da extensão, notificações, novas dependências, marca) e 0010 (`features` em `GET /version`); ritmo 3× no MVP (ADR 0011); licença MIT. **O vínculo GitHub continua desligado**: o código do *device flow* continua, testado só com um GitHub simulado, a produção roda sem `GITHUB_CLIENT_ID` e quem troca de navegador usa o Código do Reino. Não ligue o vínculo nem remova o código sem o autor pedir. Pendentes de confirmação do autor: os oito pontos do ADR 0012 (endereço, letras, título e tom da página de apresentação, entre outros).

**As regras da v0.2 foram confirmadas pelo autor em 2026-10-05**, com mudanças. Os ADRs [0013](docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), [0014](docs/decisions/0014-conselho-e-ameaca-na-v0.2.md) e [0015](docs/decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md) nasceram aplicados por delegação; o [ADR 0016](docs/decisions/0016-respostas-do-autor-as-pendencias-da-v0.2.md) registra o que o autor respondeu e vale onde divergir deles. A confirmação das leituras, das telas e dos textos menores foi **em bloco**, com base no jogo, sem leitura item a item: se o autor trocar uma delas, é mudança de conteúdo, golden e GDD no mesmo commit.

O GDD e os roadmaps são longos (o da v0.2 passa de 1.500 linhas): leia as seções indicadas pela tarefa em vez do arquivo inteiro (todos têm índice numerado por `§`).

## Comandos

Ambiente: Node 22 (`nvm use` lê o `.nvmrc`), pnpm 9 fixado em `packageManager` (Corepack), Docker com Compose v2. O repositório deve ficar no sistema de arquivos do Linux, nunca em `/mnt/c`.

```bash
pnpm install
pnpm dev:up            # sobe db (5432) e db_test (5433) e espera ficarem saudáveis
pnpm dev:down          # derruba os contêineres de dev, mantendo os volumes
pnpm db:psql           # psql no banco de dev; aceita argumentos: pnpm db:psql -c 'select 1'
pnpm secrets:gen       # cria deploy/.env e gera os segredos vazios, sem sobrescrever os existentes
pnpm dev:api           # API no host com tsx watch (lê deploy/.env e aplica as migrações); http://localhost:3000/v1/health
pnpm dev:web           # app web com o Vite em http://localhost:5173; /v1 é repassado para a API (LOTG_API_URL troca o destino)
pnpm dev:landing       # página de apresentação com o Vite em http://localhost:5174 (não precisa da API)
pnpm db:migrate        # aplica as migrações no banco de dev sem subir a API
pnpm --filter @lotg/server db:generate -- --name <nome>   # gera o SQL de uma mudança em src/db/schema.ts

pnpm verify            # lint + typecheck + test — porta de entrada de todo "pronto"
pnpm lint              # ESLint + Prettier (verificação); pnpm format corrige
pnpm typecheck         # tsc --noEmit em todos os pacotes
pnpm test              # unitários e de conteúdo (Vitest, projeto unit)
pnpm --filter @lotg/engine test                   # um pacote
pnpm --filter @lotg/engine test -- construction   # um arquivo de teste (filtro por nome)
pnpm --filter @lotg/engine test -- --coverage     # cobertura do pacote
UPDATE_GOLDEN=1 pnpm --filter @lotg/engine test   # regrava os goldens de __golden__/; conferir o diff
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration         # tests/ e packages/server/test/ contra o db_test
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration games   # só os arquivos com "games" no nome (SEM "--": com ele o filtro é ignorado e roda tudo)
pnpm test:e2e                              # Playwright: app compilado + API real + db_test, em Chromium (precisa de pnpm dev:up)
pnpm test:e2e 04-conta -g "duas abas"      # um arquivo e um teste; --headed ou --ui para ver o navegador
GAME_TIME_SCALE=3 pnpm test:e2e 03-retorno-e-conexao -g "ritmo"   # os cenários "no ritmo da produção" com o servidor de teste no padrão da produção
pnpm test:e2e:landing                      # Playwright: a página de apresentação compilada, em tela de computador e de celular; sem API nem banco
pnpm capture:landing                       # refaz as capturas do jogo que a página de apresentação mostra (usa o db_test)
pnpm exec playwright install chromium      # uma vez por máquina

pnpm build             # servidor (packages/server/dist/main.js), app web (packages/web/dist) e página de apresentação (packages/landing/dist)
pnpm docker:build      # imagem de produção da API (lotg-api:latest, alvo runtime)
pnpm docker:build:web  # imagem do app web (lotg-web:latest, alvo web: Caddy servindo o dist na porta 80)
pnpm docker:build:landing   # imagem da página de apresentação (lotg-landing:latest, alvo landing)
scripts/landing-smoke.sh http://localhost:8080   # a página servida pelo Caddy: cabeçalhos, cache e o 404 (também serve para a produção)

pnpm -s sim -- --seed pedra-alta-golden --days 7 --strategy economico > semana.csv   # bot de playtest; resumo no stderr
pnpm -s sim -- --seed pedra-alta-golden --days 7 --time-scale 3 > semana-3x.csv      # o mesmo bot no ritmo do servidor; dias e sessões continuam em tempo real
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy preguicoso --sessions-per-day 1 > ano.csv   # um ano de jogo, com o bot de uma visita por dia
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md                                    # matriz de balanceamento: 3 perfis × 3 ritmos × 50 sementes, em Senhor; sai com 1 se alguma partida sair da faixa
pnpm -s sim -- --matrix --difficulty ironKing > rei.csv 2> rei.md                    # a mesma matriz em outra dificuldade (peasant, lord, ironKing); --seeds 5 para uma olhada rápida
pnpm -s sim -- --perf                                                                # custo do motor na volta de 1, 7 e 30 dias reais fora, no ritmo 3
SHOW_COVERAGE=1 pnpm --filter @lotg/sim-cli test -- coverage                         # cobertura do Conselho em 50 sementes: quantas cartas chegam, de quais, em que estação
pnpm -s sim -- --remote http://localhost:3000 --bots 50 --minutes 2                  # carga contra a API, com p50/p95 (deixa contas "Bot N" no servidor)
pnpm -s sim -- --smoke <url>                                                         # fumaça de concorrência e idempotência: cria uma conta e a exclui no fim (--keep mantém)
```

Detalhes que não são óbvios:

- Os projetos do Vitest ficam em `vitest.config.ts` (`test.projects`: `unit` e `integration`), não em `vitest.workspace.ts`: o Vitest 5 removeu o arquivo de workspace. Sem `TEST_DATABASE_URL`, o projeto `integration` não inclui nenhum arquivo e passa vazio.
- Os pacotes são consumidos como fonte TypeScript (`exports` aponta para `src/index.ts`, `moduleResolution: Bundler`); só o que é implantado tem build.
- Goldens são gravados com `toMatchFileSnapshot` e nunca se regravam sozinhos: só com `UPDATE_GOLDEN=1`. Um golden diferente é uma mudança de regra; ela precisa ser intencional.
- Testes de integração rodam um arquivo por vez contra o PostgreSQL real; cada arquivo chama `resetTestDb()`. Os helpers de `packages/server/test/helpers/app.ts` sobem a API em memória com relógio controlado (`server.clock.advance(ms)`). O access token vale 15 minutos desse relógio: depois de avançá-lo, use `renew`. Para rodar duas suítes em paralelo, cada uma precisa do próprio banco (`create database …` no `db_test`).
- `@types/node` e `@types/pg` foram adotados na Fase 2 e aprovados depois ([ADR 0006](docs/decisions/0006-types-node.md)); `engine`, `content` e `protocol` continuam com `types: []`.
- A Crônica não traz as viradas de dia ([ADR 0007](docs/decisions/0007-cronica-sem-viradas-de-dia.md)) nem o fecho diário do desperdício ([ADR 0015](docs/decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md)): `chronicleRows` filtra `CHRONICLE_HIDDEN_EVENT_TYPES` (`dayStarted` e `storageWasted`, em `@lotg/protocol`) em `GET /chronicle` e `/chronicle.md`, e o app usa a mesma lista no que mostra como Crônica (`game/returnReport.ts`). `GET /events` continua trazendo tudo.
- **Ritmo e dificuldade** ([ADR 0011](docs/decisions/0011-ritmo-3x-no-mvp.md); [ADR 0013](docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisões 2 e 2a): o jogador escolhe na criação (`POST /games` com `difficulty` e `timeScale`; os ritmos oferecidos são 3, 1 e 0,5, vindos de `balance.paces`) e a escolha fica gravada na linha e em `state.settings`, imutável. `GAME_TIME_SCALE` (padrão 3, de 0,5 a 10) é só o ritmo de quem não escolhe. O motor continua em tempo de jogo; `deriveViewState(state, gameTimeMs, { timeScale })` devolve prazos em segundos reais e taxas por hora real, inclusive nos textos de explicação. A visão é sempre em tempo real: o app não converte nada. As constantes de **tempo real** do motor são o prazo de resposta de uma carta do Conselho (`council.expiryRealMs`), a carência, o passo e a janela de retomada da deserção por fome (`morale.famineDesertionAfterRealMs`, `famineDesertionEveryRealMs`, `famineResumeWithinRealMs`) e a antecedência do aviso da Torre (`threat.watchtowerLevels[].warningRealMs`); todas são convertidas com `settings.timeScale` por `realToGameMs` (`units.ts`), e nada mais no motor conta tempo real (ADR 0016). Os testes de integração e em navegador rodam com `GAME_TIME_SCALE=1` (`packages/server/test/helpers/app.ts`), porque foram escritos nos tempos de jogo do GDD; o golden do motor também é no ritmo 1.
- **Sorteios e lobos nos testes.** Toda partida nova tem os lobos do roteiro marcados e cartas do Conselho por sorteio. Nos testes de integração, quem conta eventos ou estoques de outra mecânica chama `quietHorde(server, gameId)`. Nos testes em navegador o conselho fica **em recesso** e a Horda **calada** por padrão (`/__test/council-recess`, `/__test/horde-quiet`, chamados por `tests/e2e/helpers.ts`); os cenários do Conselho chamam `world.conveneCouncil()` (o servidor de teste aceita `seed` em `POST /games`, por `allowGameSeed`) e os da incursão, `world.wolvesRoam()`. `/__test/council-deal` põe uma carta escolhida na mesa e `/__test/raise` põe um edifício no nível pedido.
- Os testes de unidade de `packages/web` rodam em Node, sem DOM: funções puras e HTML de `preact-render-to-string`. `src/test-helpers.ts` tem uma API `/v1` de mentira (`fakeApi`), `makeController` e `scriptedDialogs`. O `ViewState` de exemplo é o golden do motor, importado por caminho relativo (`../../engine/src/__golden__/view-seed-pedra-alta.json`): importar `@lotg/engine` ali é barrado pelo lint.
- Tudo o que depende de navegador (foco, teclado, `localStorage` entre abas, CSP, contraste) é provado em `tests/e2e/*.spec.ts`. O Playwright sobe `tests/e2e/server.ts` (a API real na porta 3100, com relógio adiantável, GitHub de mentira e rotas `/__test`, que só existem ali) e o `vite preview` do app compilado (4173). Os testes dividem um servidor e um banco: `workers: 1`. Não rode `pnpm test:e2e` e `pnpm test:integration` ao mesmo tempo: usam o mesmo `db_test`.
- Nos testes em navegador o tempo anda por saltos: `world.passTime(ms, ...páginas)` adianta o servidor e o relógio de cada página e **espera o ciclo de atualização terminar**. Saltar de novo com uma leitura em voo, ou logo depois de um clique sem esperar o resultado na tela, cria corridas que não existem no tempo de verdade.
- O servidor de desenvolvimento do Vite afrouxa a CSP (`style-src 'unsafe-inline'`, WebSocket); a política estrita de `packages/web/index.html` só vale no build. Por isso os testes em navegador usam o build.
- TypeScript está fixado em 6.x porque o `typescript-eslint` ainda não aceita o 7.
- O build da imagem usa a raiz do repositório como contexto; o ignore é `deploy/Dockerfile.dockerignore`. `runtime` é o último alvo do `Dockerfile` de propósito (é o que sai sem `--target`); os alvos `web` e `landing` saem da base `static`, que é `debian:bookworm-slim` com o binário do Caddy copiado da imagem oficial, que é Alpine. O esbuild empacota o servidor inteiro, com as dependências, em `dist/main.js`: a imagem não tem `node_modules`. Uma dependência nova com binário nativo ou arquivos lidos em tempo de execução precisa ser tratada em `packages/server/esbuild.mjs`.
- As migrações são geradas pelo drizzle-kit em `deploy/migrations` (`0000_init.sql`, não `0001`) e aplicadas no arranque sob `pg_advisory_lock(727)`.
- A API roda **no host** em desenvolvimento ([ADR 0001](docs/decisions/0001-api-no-host-em-dev.md)); não compartilhar `node_modules` entre host e contêiner. O perfil `--profile full` do compose de dev existe para testar a imagem; `--profile tools` sobe o pgweb (8081).
- Os bancos de dev usam sempre `lotg/lotg` e portas só em `127.0.0.1`. Variáveis de ambiente em [deploy/.env.example](deploy/.env.example) e MVP-ROADMAP.md §1.3, incluindo `RECOVERY_CODE_SECRET` independente de `JWT_SECRET`, preservado nos deploys.

## Pacotes

Monorepo pnpm (GDD §14.2), oito pacotes:

| Pacote | Papel |
|---|---|
| `@lotg/engine` | Motor puro: `GameState`, migração por versão, `advanceTo`, `applyCommand`, sorteios com semente, `deriveViewState` |
| `@lotg/content` | Todos os números e textos de jogo, as cartas do Conselho + schemas zod |
| `@lotg/protocol` | Tipos e schemas zod da API `/v1`: `Command`, `ViewState`, catálogo, erros, `PROTOCOL_VERSION` |
| `@lotg/server` | Fastify + Drizzle/`pg`: auth, catálogo, partidas, migração do estado, comandos, job de avanço, migrações SQL |
| `@lotg/client-sdk` | Cliente HTTP tipado (usado pelo app web e pelo `sim-cli`) |
| `@lotg/sim-cli` | Bots de playtest, em processo ou contra um servidor; matriz de balanceamento e faixas |
| `@lotg/web` | App web em Preact e Vite: bancada com aparência de editor, sessão de jogo, cache no navegador |
| `@lotg/landing` | Página de apresentação: HTML e CSS estáticos compilados pelo Vite, em domínio próprio, com o botão que leva ao jogo |

Direção das dependências, imposta por `no-restricted-imports` em `eslint.config.js`: `engine`, `content` e `protocol` não importam `fastify`, `pg`, Drizzle nem módulos do Node (com ou sem `node:`); arquivos `*.test.ts` ficam fora dessa regra. `server` e `web` dependem deles e **nunca um do outro**. O app web não importa o motor, o servidor nem módulos do Node, e, fora dos testes, nem `@lotg/content` nem o `contentHash` de `@lotg/protocol`: `packages/web/src/bundle.test.ts` compila o app e falha se um número, uma frase, uma flag ou um efeito escondido do conteúdo chegar ao navegador. A página de apresentação não importa pacote nenhum do jogo; só os testes dela leem `@lotg/content`, para conferir as frases que a página cita.

## Regras de arquitetura

**O servidor orquestra, o motor decide, o app exibe.**

1. Nenhuma regra de jogo fora de `packages/engine`; nenhum número de jogo fora de `packages/content`; o app só exibe o `ViewState`.
2. O servidor é autoritativo e é o relógio. O cliente envia comandos e recebe um `ViewState`; nunca envia estado, timestamps ou resultados. A névoa é aplicada no servidor.
3. Recursos em milésimos inteiros; `advanceTo` por segmentos; o invariante de divisão de intervalo é sagrado (ver "Motor", abaixo).
4. Toda mudança de estado é um comando validado, idempotente por `commandId` no servidor.
5. Só as bibliotecas permitidas: TypeScript, esbuild, Vitest, fast-check, zod, Preact, Fastify (+ plugins oficiais `@fastify/*`), `pg`, Drizzle, `jose`, `pino`, `tsx`, Vite, `@preact/preset-vite`, `@vscode/codicons`, `@playwright/test`, ESLint, Prettier (as quatro do app web vêm do ADR 0008, ponto 5, confirmado pelo autor). Hashes e HMAC usam `node:crypto` somente no servidor; não instalar `argon2`. Qualquer outra dependência exige ADR aprovado em `docs/decisions/`.
6. **Não antecipar mecânicas de versões futuras**, nem "só a estrutura". Cada mecânica do GDD tem tag `[v0.x]`; a versão implementada é a v0.2 (§16.2, §18.2): estações, armazenamento, ofício, moral, Conselho, Torre, Paliçada, lobos e tiles abstratos existem. Campos de heróis, Taverna, expedições, Mercado, Mestres, exército, mapa gráfico ou níveis de Torre e Paliçada acima do 2 no `GameState` são erro até a versão deles. Em contrapartida, não tomar decisões de arquitetura que impeçam as versões seguintes.
7. Desvios do GDD não são decididos pelo agente: propor em `docs/decisions/NNNN-titulo.md` e aguardar aprovação. Também não são do agente: onde e como o jogo é hospedado (ADR 0009), o registro do OAuth App do GitHub, nome público e ícone, texto da política de privacidade.
8. Mudar uma regra exige atualizar o golden test correspondente e o GDD. Toda nova mecânica entra com: dados em `content`, validação de comando com motivo de recusa legível, evento na Crônica, tooltip explicativo e teste.

### Servidor (`packages/server`, GDD §14.5–14.9)

O [README do servidor](packages/server/README.md) descreve a estrutura e os contratos. O que orienta qualquer mudança:

- Rotas validam a forma com os schemas zod de `@lotg/protocol` e chamam serviços; serviços recebem um `AppContext` (`config`, `pool`, `db`, `clock`, `fetch`, `hooks`). Nunca usar `new Date()` ou `Date.now()` para tempo de jogo, expiração ou exclusão: é sempre `ctx.clock()`.
- Toda leitura e todo comando de partida passam por `lockGame` (`SELECT … FOR UPDATE` filtrado pela conta). Escritas de estado passam por `persistState`, que incrementa `state_version` uma vez e numera os eventos.
- Quando uma operação precisa de commit antes de responder com erro (reuso de refresh token, recusa do motor), o desfecho sai da transação como valor e o erro é lançado depois: lançar dentro de `db.transaction` desfaz tudo.
- O protocolo valida só a forma dos comandos; faixas e regras são recusadas pelo motor, com frase em português (`422 GAME_RULE`). O schema do protocolo não lê `balance` (o app importa os schemas, e a tabela de números iria junto): quem confere o ritmo pedido contra os oferecidos é o servidor (`OfferedGameRequestSchema`, em `src/catalog.ts`).
- `Command`, `ViewState` e os códigos de recusa do protocolo têm teste de igualdade de tipos com os do motor: mudar um lado quebra o `pnpm typecheck`.
- **Estado gravado nunca vai cru para o motor.** `loadGame` (chamado por `lockGame` e pelo job) passa `games.state` por `migrateState` com o `time_scale` da linha; a migração é gravada pela primeira escrita daquela transação, com um só incremento de `state_version`. Estado de versão futura ou fora da forma é `500` sem gravar por cima; `persistState` também confere o que grava (`assertStorable`). O tipo `StoredGameState` existe para o compilador barrar `row.state` direto no motor.
- **`GET /v1/catalog`** traz só as opções de nova partida (dificuldades, ritmos, padrões), sem autenticação e com ETag; os fatores de regra não saem nele.
- **Protocolo 2.** `PROTOCOL_VERSION` é 2 desde o Conselho; o SDK manda `X-Lords-Protocol` e o servidor responde `426 UPGRADE_REQUIRED` ("Recarregue a página") a outro número. O `ViewState` cresce por adição, e adição **não** sobe o protocolo; só o que o app antigo não consegue ler sobe. As rotas continuam em `/v1`.

### Cliente (`packages/client-sdk` e `packages/web`)

O [README do app](packages/web/README.md) descreve a estrutura. O que orienta qualquer mudança:

- **`client-sdk`**: `createClient({ baseUrl, tokenStore, clientVersion, fetch, refreshLock })`. Renova a sessão sozinho em `401 UNAUTHORIZED`, com uma renovação por vez, relendo antes o `TokenStore` (outra aba pode já ter renovado); `SESSION_REVOKED` ou refresh recusado limpam o `TokenStore` e chamam `onUnauthenticated`. A rotação nunca é repetida em falha de rede. Leituras e comandos repetem em falha de rede (o comando, com o mesmo `commandId`). A recusa do motor sai como `GameRuleClientError`, com o estado avançado em `details`.
- **`app/controller.ts`** é a única fonte de estado da bancada (conta, partida, abas, avisos) e não conhece o navegador: visibilidade, rede e outras abas entram por `setVisible`, `handleOnline` e `handleTabChange`; `main.tsx` é a cola. A lógica fica em módulos puros (`account/`, `game/`, `notifications/policy.ts`, `ui/treeModel.ts`, `ui/format.ts`, `app/router.ts`, `workbench/treeNav.ts`).
- **`palette/commands.ts`** tem todos os comandos e é o único lugar que abre diálogos. A árvore, a barra de status, os avisos e os componentes chamam `controller.runCommand(id, arg)`; os componentes das abas recebem um objeto `Actions` (`order`, `run`, `playNow`) e nunca falam com a rede.
- Uma ordem do jogador nasce em `controller.prepare(tipo, payload)`, que fixa o `commandId` e devolve a função de envio: "Tentar de novo" chama a mesma função e reenvia a mesma ordem. Nunca gere outro `commandId` para uma retentativa.
- A resposta a uma carta do Conselho tem um caminho só: painel, árvore, aviso e paleta chamam `controller.runCommand('lords.answerCard', …)`, que passa por `controller.prepare` como toda ordem.
- Clicar em um item da árvore só navega; ordens saem dos botões da linha (`rowActions` em `workbench/Tree.tsx`).
- Depois de uma ausência de 4 h o app abre na aba Hoje, e os eventos da ausência não viram avisos avulsos (`session.catchingUp`). A aba que ficou aberta e **fora de vista** por 4 h ou mais também conta a ausência (`away`, guardado no cache) e, na volta, um aviso leva ao relatório. O Relatório de Retorno tem três blocos ("O feudo prosperou", "O que exigiu um preço", "Você ainda pode decidir"), montados só com a visão e os eventos (`game/returnReport.ts`); "Antes de partir" (`game/beforeLeaving.ts`) também só lê a visão.
- O ciclo de leitura é de 30 s com a aba à vista, mas a leitura seguinte vem antes quando uma obra, a espera de uma planejada ou uma adaptação termina (`nextPollMs`, em `game/gameSession.ts`).
- O cache de cada partida tem a marca `CACHE_VERSION` (o protocolo e `VIEW_FORMAT`); a visão guardada só é exibida com a marca desta versão e na forma do schema. Um campo do `ViewState` que mantém o nome e passa a dizer outra coisa pede subir `VIEW_FORMAT` (`game/gameSession.ts`).
- O lembrete "Proteja seu reino" conta **tempo real**: 48 h desde a primeira vez da conta neste navegador (`account/linkReminder.ts`: `REMIND_AFTER_MS`, `shouldRemindToLink(record, account, now)`). O registro `{ since, shown }` fica em `lords.linkReminder:<accountId>` e é criado por `controller.maybeRemindToLink` na primeira visão. Não depende do calendário do jogo nem do ritmo.
- Números de regra não são escritos no cliente (nem em textos): o que o jogador precisa ver vem no `ViewState` (por exemplo `constructions.active.refund`, `population.housed` e `population.vacancies`). O que faltar é acrescentado no motor.
- As mudanças de conta passam por uma fila no `Controller` (`enqueue`): "Jogar agora" muda a conta duas vezes seguidas e, sem a fila, o tratamento da primeira fecha a sessão que a segunda abriu.
- Tudo no `localStorage`, com prefixo `lords.`: tokens (`lords.tokens`), conta, preferências e cache por conta e partida (`cacheKey`). Sair, excluir e perder a sessão apagam tokens e cache, em todas as abas (evento `storage`, `services/tabSync.ts`).
- A renovação da sessão roda dentro de `navigator.locks.request('lords.refresh')` (`services/sessionLock.ts`): as abas dividem um refresh token que só vale uma vez.
- **Sem `style="…"` e sem script embutido**: a CSP de `index.html` é `default-src 'self'` e é o que protege os tokens. Indentação e cores vão por classe.
- Só `theme/themes.css` tem cores; `styles.css` e `workbench/workbench.css` usam apenas variáveis `--vscode-*`. Testes falham se aparecer uma cor fixa, se uma variável faltar em um dos três temas ou se um par texto/fundo ficar abaixo de 4,5:1.
- Foco e teclado dos diálogos e da árvore usam `useLayoutEffect`: com `useEffect` o foco chega um quadro depois, e quem digita rápido (ou um teste) escapa do diálogo.
- `controller.start()` é chamado **antes** do primeiro `render`: a parte síncrona restaura a conta e o cache, e a página recarregada já nasce no feudo.

### Página de apresentação (`packages/landing`)

O [README da página](packages/landing/README.md) descreve a estrutura e o [ADR 0012](docs/decisions/0012-pagina-de-apresentacao.md), a decisão. O que orienta qualquer mudança:

- É uma página estática, em **domínio próprio**: HTML e CSS escritos à mão e um script pequeno. Sem Preact, sem pacotes do jogo, sem chamadas a servidor. Não divide origem nem armazenamento com o jogo.
- **Só diz do jogo o que o jogo diz de si.** `src/page.test.ts` confere as linhas da Crônica citadas contra `@lotg/content` e barra as formas mais comuns de promessa de duração de dia ou ano (ADR 0011), as viradas de dia (ADR 0007), preço, multijogador, GitHub e o nome "Visual Studio Code"; o que a expressão regular não pega continua proibido. Nenhum número de regra no texto; o que ainda não existe só aparece no parágrafo "No horizonte", sem data. Quando uma versão do jogo entrega o que estava lá, a frase sai do horizonte na mesma publicação (em 2026-10-05 saíram as estações com efeito e o Conselho).
- As pinturas são **arte conceitual gerada por IA** e levam essa legenda; a página abre com uma **captura real do jogo**. As capturas saem de `pnpm capture:landing` (API no ritmo de produção), que **só roda à mão**: nada avisa que uma captura ficou velha. O roteiro falha se a disposição da tela mudar, porque os rótulos presos à captura têm posição em porcentagem em `src/styles/page.css`. As capturas mostram os ícones do app (Codicons, CC BY 4.0), e a página dá o crédito no rodapé.
- Mesma disciplina do app: CSP estrita (`default-src 'none'`), **sem `style="…"` e sem script embutido**, nada de terceiros, nenhuma medição de audiência. Só `src/styles/tokens.css` tem cores; um teste mede o contraste de cada par de texto e fundo.
- Os endereços do jogo e da página entram no build por `%GAME_URL%` e `%SITE_URL%` (`src/site.ts`, variáveis `LOTG_GAME_URL` e `LOTG_LANDING_URL`); não escreva endereço no HTML.
- O título da aba da página **não** pode ser igual ao do jogo: o monitor de saúde distingue os dois sites por ele.

### Contratos do servidor e do cliente (GDD §14.5–14.10)

- **Avanço preguiçoso.** Leituras e comandos novos autenticam, verificam propriedade e travam a partida antes de `advanceTo(agora)`. Reenvios retornam o recibo antes de avançar. Um job (`advance-stale-games`) avança partidas sem estado persistido há mais de 1 h; não há temporizador por partida em memória.
- **Caminho de um comando** (uma transação): lock da partida → busca de recibo por `(game_id, commandId)` → para comando novo, `advanceTo` → `applyCommand` → persistência do estado, eventos e recibo completo (`request_hash`, `response_status`, `response_body`). Recusa preserva o avanço e faz commit antes do 422; falha inesperada faz rollback. Reenvio idêntico retorna status/corpo originais com `X-Lords-Replayed`; payload diferente com o mesmo UUID recebe `COMMAND_ID_CONFLICT`. Recibos permanecem enquanto a partida existir.
- **Persistência.** `GameState` inteiro em `games.state` (JSONB), sem patches parciais, com `schemaVersion` (hoje 12) e a coluna `schema_version` como espelho; `commands` + estado inicial + semente = replay completo de uma partida nascida na versão atual (a migrada precisa também do estado de cada fronteira). Mudar a forma do estado não é migração de SQL. Crônica e eventos ficam em tabelas próprias; o motor só os **emite** como saída.
- **Cliente.** Polling de 30 s com a aba à vista (2 min em segundo plano) em `GET /view` e `GET /events?after=`. ETag fraco é SHA-256 do corpo `{ view, stateVersion }`; pode mudar sem escrita no banco. `stateVersion` é string decimal; `X-Lords-State-Version` é apenas aviso de concorrência, sem usar `If-Match`. Após recibo repetido, buscar view/eventos atuais sem reaplicar eventos antigos. Cache no `localStorage` separado por conta e partida; comandos nunca ficam em fila local.
- **Sessões e recuperação.** Uma família por sessão/máquina, validade absoluta de 30 dias, histórico completo em `refresh_tokens`. Reuso de qualquer antecessor revoga a família com commit antes do 401. Autorização consulta conta/sessão no banco sem cache positivo. Código do Reino usa HMAC-SHA256 com `RECOVERY_CODE_SECRET` independente; detalhes em GDD §14.7 e ADRs 0003/0005.
- **Exclusão.** Bloqueio imediato, revogação de todas as sessões, limpeza do código de recuperação e arquivamento das partidas em transação; resposta 202 com `deletedAt`/`purgeAfter`. Primeiro job a partir de sete dias remove dependentes em cascata; backups seguem retenção de 14 dias desde a geração. Logout, exclusão e sessão revogada limpam tokens e cache local. Não prometer remoção física imediata nem oferecer desfazer exclusão. Os dados da v0.2 vivem em `games.state` e `game_events`, e saem no mesmo expurgo.

### Motor (`packages/engine`, GDD §14.3)

API pública, e nada além dela e dos tipos: `createInitialState`, `migrateState`, `nextEventAt`, `advanceTo`, `applyCommand`, `deriveViewState`, mais `REJECTION_CODES`, `CURRENT_SCHEMA_VERSION` e `StateMigrationError` (`purity.test.ts` falha se outra coisa vazar). O [README do motor](packages/engine/README.md) descreve o ciclo, os invariantes, cada mecânica, a receita de uma versão de estado nova, a de uma carta nova e como adicionar um evento.

- Funções puras que nunca mutam a entrada: cada chamada clona o estado (JSON puro) e trabalha num rascunho. Sem `Date.now()`, `Math.random()` ou I/O; o ESLint e `purity.test.ts` recusam.
- `advanceTo` anda trecho a trecho até o próximo evento de `nextEventAt`: fim de obra, chegada de aldeão, virada de dia, fim de adaptação, comida ou lenha acabando, estoque enchendo, planejada automática juntando o custo, carta que expira, efeito escondido, continuação que chega, incursão que chega, aviso da Torre e ferido que sara.
- **Ordem fixa no mesmo instante** (`processEventsAt` em `advance.ts`, provada em `advance.test.ts`): obras concluídas → aldeões que chegam (recrutas, depois feridos que saram) → virada do dia (`processCalendar`: fecho do desperdício, ano, estação, amanhecer, experiência do ofício, moral com os sorteios dela, sorteio do Conselho, Ameaça) → Conselho fora do sorteio (expirações, efeitos escondidos, continuações) → fim de adaptação → incursões (aviso da Torre e resolução) → planejadas automáticas e objetivos (`settlePlanned`) → fome e frio (`settleScarcity`). Depois, `announceFilled`. Nunca a ordem de importação dos módulos. Um evento novo entra nessa lista em um lugar escolhido, com teste do instante exato, e o README do motor diz por quê.
- Recursos em **milésimos inteiros**; `accumulators` guarda o resto de `taxa × ms` que ainda não completou um milésimo. Fatores do conteúdo são frações (`{ num, den }`) para nenhuma conta usar ponto flutuante. Nunca `number` fracionário no estado, com uma exceção: `settings.timeScale` (pode ser 0,5), que não entra em conta contínua.
- Invariante testada por propriedade, exata e sem tolerância: `advanceTo(t2)` ≡ `advanceTo(t1)` seguido de `advanceTo(t2)`, no estado, nos eventos **e no gerador**.
- `applyCommand` exige o estado avançado até o instante do comando e lança se não estiver; recusa de regra devolve `{ ok: false, code, message }` sem lançar. Depois de todo comando e de todo instante com eventos rodam `settlePlanned` (planejadas e objetivos, repetidos enquanto um der motivo ao outro) e `settleScarcity`; o estado sai sempre **em repouso**, e um estado que chega fora dele (recém-migrado) é acomodado antes de o tempo andar.
- O motor **emite** eventos já com a frase da Crônica (`emit` em `chronicle.ts`, modelos em `@lotg/content`) e não os guarda no estado.
- Valores deriváveis (capacidade habitacional, limite do estoque, filas abertas, aldeões livres, taxas) são funções puras, nunca persistidos.
- **Versões do estado.** Uma versão por tarefa que muda a forma do `GameState`, um passo por versão em `migrations/` (forma exata da versão de que parte, identificadores escritos no arquivo, nada importado de `@lotg/content`), retratos congelados em `__fixtures__/` com impressão digital. Todo prazo que um passo cria conta de `context.boundaryMs` (a fronteira **daquele** passo), nunca de `state.migratedAtMs`. Um passo não emite eventos. Sem o passo, a partida de quem já joga quebra no primeiro `advanceTo`.
- **Sorteios** (`random.ts`): xoshiro128\*\* com fluxos nomeados em `state.rng` (`morale`, `council`, `horde`; um fluxo novo para cada assunto novo). Só `advanceTo` sorteia, dentro de um instante marcado da linha do tempo; nunca `applyCommand`, `deriveViewState`, `nextEventAt`, a criação ou a migração. Só se sorteia o que pode acontecer. O estado do gerador nunca sai na visão. Trocar o algoritmo é mudar regra (`RNG_VERSION`, vetores, migração).
- **Névoa no servidor.** O `ViewState` só leva o que o jogador pode saber: flags, efeitos escondidos e continuações do Conselho, a Ameaça e as incursões sem a Torre de Vigia e o gerador nunca saem. As previsões da visão não sorteiam e não contam com incursões marcadas.
- **Cartas.** Os ids de carta e de opção publicados são fixados em `packages/content/src/council.test.ts`: mudar um pede passo de migração. Toda carta nova muda o sorteio de todas as sementes (goldens, retratos, `COUNCIL_SCENARIO_SEED`): o README do motor, "Uma carta nova", tem a receita.

## Convenções

- Documentação, textos de interface e conteúdo de jogo em **português do Brasil** (conteúdo narrativo em tom de crônica medieval, frases curtas). Identificadores de código em inglês (`townHall`, `lumberMill`, `startConstruction`).
- Testes `*.test.ts` ao lado do código; golden files em `__golden__/`; integração em `tests/server/` ou `packages/server/test/`; navegador em `tests/e2e/*.spec.ts`. Testes primeiro onde houver regra de jogo ou contrato de API.
- `main` sempre verde (`pnpm verify`). Tarefas de tamanho `L` em branch (`f1-t5-construcoes`) com merge ao final.
- Commits: `F1-T3: resumo no imperativo` (na v0.2, `V2C-T2: …`; correções de revisão, `V2C: corrige …`). Nunca logar tokens, códigos de recuperação ou segredos.

## Ritual de conclusão de tarefa (MVP-ROADMAP.md §0.3 e §A.4; roadmap da v0.2, §0.4)

Uma tarefa do roadmap por sessão; a ordem das fases é obrigatória. Para tarefas `M` e `L`, apresentar o plano e esperar aprovação antes de codar.

1. Rodar os comandos da seção "Verificação" da tarefa e `pnpm verify` (mais `pnpm test:integration` se tocar o servidor, `pnpm test:e2e` se tocar o app web, `pnpm test:e2e:landing` se tocar a página de apresentação; se tocar o motor ou o conteúdo, a matriz já roda no `pnpm test`, e uma faixa que falha é regressão a corrigir nos números, nunca no bot) e mostrar a saída. Confira o `pnpm verify` pelo código de saída: `| tail` esconde a falha de um pacote. Se a mudança tocar a aba Feudo, a barra de status ou o modo discreto do app, rodar também `pnpm capture:landing` e refazer as três imagens e o `og.png` da página (packages/landing/README.md). Sem saída de teste, não há tarefa concluída.
2. Marcar as caixas da tarefa no roadmap da versão e preencher a linha no Registro de Execução (§9 do MVP-ROADMAP.md, §11 do roadmap da v0.2), com o que foi verificado **e o que não foi**. Procurar o que a tarefa tornou falso em `CLAUDE.md`, nos READMEs e em `docs/`.
3. Desvios do GDD → `docs/decisions/NNNN-titulo.md`, aguardando aprovação.
4. Um commit por tarefa (ou por subtarefa em tarefas `L`).

## Nunca

- Rodar `docker compose down -v` fora do ambiente de dev: `-v` apaga os volumes do banco.
- Commitar `.env` ou qualquer segredo; regenerar `RECOVERY_CODE_SECRET` de um ambiente que já emitiu códigos.
- Publicar ou implantar sem o autor pedir. O jogo está em produção no Coolify ([ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)) e **todo `push` no `main` com o CI verde é implantado sozinho** pelo job `deploy` de `.github/workflows/ci.yml`: dar `push` no `main` é publicar.
- Voltar a imagem da API para antes de uma migração de estado sem restaurar o backup, nem usar a imagem da `v0.1.0` como destino de reversão: ela não confere a versão do estado e grava por cima com as regras antigas ([deploy/README.md](deploy/README.md), "Reverter depois de uma migração de estado").
- Usar o nome, o logotipo ou a marca "Visual Studio Code" na interface (ADR 0008, ponto 6).
- Mesclar estados de contas.
- Usar Alpine como base da imagem (as bases são `node:22-bookworm-slim` e `debian:bookworm-slim`).
