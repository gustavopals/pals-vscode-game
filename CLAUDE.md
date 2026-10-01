# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

**Lords of the Guild** é um jogo medieval de gerenciamento assíncrono jogado dentro do VS Code: motor determinístico em TypeScript, servidor Fastify + PostgreSQL autoritativo, extensão do VS Code como cliente.

- [GAME_DESIGN.md](GAME_DESIGN.md) — GDD documental v0.4. §14 é o **contrato de arquitetura**, §16.1 é o **escopo exato do jogo v0.1**, §18.3 são regras permanentes.
- [MVP-ROADMAP.md](MVP-ROADMAP.md) — plano de execução da v0.1 em fases `F0…F5` e tarefas `F1-T3`, cada uma com subtarefas em caixas de seleção, seção "Verificação" e "Pronto quando". O Registro de Execução (§9) diz o que já foi feito.
- [Decisões de arquitetura](docs/decisions/README.md) — ADRs. Os contratos dos ADRs 0003–0005 já estão no GDD; segui-los não exige nova aprovação de desvio.

**Estado:** as Fases 0 a 3 estão implementadas: monorepo e Docker, conteúdo e motor da v0.1, `sim-cli`, protocolo, servidor, `client-sdk`, extensão do VS Code e Webview. A extensão **nunca foi aberta em um VS Code de verdade**: foi exercitada por testes, inclusive um que a ativa com um editor de mentira contra o servidor real. O roteiro manual está em [docs/manual-test-v0.1.md](docs/manual-test-v0.1.md), sem nenhuma execução registrada. A próxima tarefa é F4-T1.

Os dois documentos somam ~2.700 linhas: leia as seções indicadas pela tarefa em vez do arquivo inteiro (ambos têm índice numerado por `§`).

## Comandos

Ambiente: Node 22 (`nvm use` lê o `.nvmrc`), pnpm 9 fixado em `packageManager` (Corepack), Docker com Compose v2. O repositório deve ficar no sistema de arquivos do Linux, nunca em `/mnt/c`.

```bash
pnpm install
pnpm dev:up            # sobe db (5432) e db_test (5433) e espera ficarem saudáveis
pnpm dev:down          # derruba os contêineres de dev, mantendo os volumes
pnpm db:psql           # psql no banco de dev; aceita argumentos: pnpm db:psql -c 'select 1'
pnpm secrets:gen       # cria deploy/.env e gera os segredos vazios, sem sobrescrever os existentes
pnpm dev:api           # API no host com tsx watch (lê deploy/.env e aplica as migrações); http://localhost:3000/v1/health
pnpm dev:ext           # extensão e Webview em watch; depois F5 abre o Extension Development Host
pnpm --filter lords-of-the-guild package   # gera packages/extension/lords-of-the-guild-0.1.0.vsix
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
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration            # tests/ e packages/server/test/ contra o db_test
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration -- games   # um arquivo de integração

pnpm build             # servidor (dist/main.js), Webview (packages/extension/media/webview.*) e extensão (dist/extension.js)
pnpm docker:build      # imagem de produção da API (lotg-api:latest, alvo runtime)

pnpm -s sim -- --seed pedra-alta-golden --days 7 --strategy economico > semana.csv   # bot de playtest; resumo no stderr
pnpm -s sim -- --remote http://localhost:3000 --bots 50 --minutes 2                  # carga contra a API, com p50/p95
```

Detalhes que não são óbvios:

- Os projetos do Vitest ficam em `vitest.config.ts` (`test.projects`: `unit` e `integration`), não em `vitest.workspace.ts`: o Vitest 5 removeu o arquivo de workspace. Sem `TEST_DATABASE_URL`, o projeto `integration` não inclui nenhum arquivo e passa vazio.
- Os pacotes são consumidos como fonte TypeScript (`exports` aponta para `src/index.ts`, `moduleResolution: Bundler`); só o que é implantado tem build.
- Goldens são gravados com `toMatchFileSnapshot` e nunca se regravam sozinhos: só com `UPDATE_GOLDEN=1`. Um golden diferente é uma mudança de regra; ela precisa ser intencional.
- Testes de integração rodam um arquivo por vez contra o PostgreSQL real; cada arquivo chama `resetTestDb()`. Os helpers de `packages/server/test/helpers/app.ts` sobem a API em memória com relógio controlado (`server.clock.advance(ms)`). O access token vale 15 minutos desse relógio: depois de avançá-lo, use `renew`. Para rodar duas suítes em paralelo, cada uma precisa do próprio banco (`create database …` no `db_test`).
- `@types/node` e `@types/pg` foram adotados na Fase 2 sem aprovação explícita ([ADR 0006](docs/decisions/0006-types-node.md)); `engine`, `content` e `protocol` continuam com `types: []`.
- O [ADR 0007](docs/decisions/0007-cronica-sem-viradas-de-dia.md) (tirar as viradas de dia da Crônica) é só uma proposta: até ser aprovado, a Crônica traz uma linha por evento, como diz o roadmap.
- Fora do editor não existe o módulo `vscode`: o Vitest o troca por `packages/extension/test/fake-vscode.ts` (alias em `vitest.config.ts`). `tests/client/extension.test.ts` ativa a extensão inteira com esse substituto contra o servidor real; é projeto `integration` e precisa de `TEST_DATABASE_URL`. O substituto é mais permissivo que o editor: passar nele não prova que funciona no VS Code.
- Os testes da extensão e da Webview usam como `ViewState` de exemplo o golden do motor, importado por caminho relativo (`../../engine/src/__golden__/view-seed-pedra-alta.json`): importar `@lotg/engine` ali é barrado pelo lint.
- A extensão é empacotada em CommonJS (`dist/extension.js`) e o `package.json` dela não tem `"type": "module"`: é como o VS Code carrega. A Webview sai em `packages/extension/media/webview.{js,css}` (ignorados pelo git) e é o que vai no `.vsix`, conforme `.vscodeignore`.
- TypeScript está fixado em 6.x porque o `typescript-eslint` ainda não aceita o 7.
- O build da imagem usa a raiz do repositório como contexto; o ignore é `deploy/Dockerfile.dockerignore`. O esbuild empacota o servidor inteiro, com as dependências, em `dist/main.js`: a imagem não tem `node_modules`. Uma dependência nova com binário nativo ou arquivos lidos em tempo de execução precisa ser tratada em `packages/server/esbuild.mjs`.
- As migrações são geradas pelo drizzle-kit em `deploy/migrations` (`0000_init.sql`, não `0001`) e aplicadas no arranque sob `pg_advisory_lock(727)`.
- A API roda **no host** em desenvolvimento ([ADR 0001](docs/decisions/0001-api-no-host-em-dev.md)); não compartilhar `node_modules` entre host e contêiner. O perfil `--profile full` do compose de dev existe para testar a imagem; `--profile tools` sobe o pgweb (8081).
- Os bancos de dev usam sempre `lotg/lotg` e portas só em `127.0.0.1`. Variáveis de ambiente em [deploy/.env.example](deploy/.env.example) e MVP-ROADMAP.md §1.3, incluindo `RECOVERY_CODE_SECRET` independente de `JWT_SECRET`, preservado nos deploys.

## Pacotes

Monorepo pnpm com oito pacotes (GDD §14.2):

| Pacote | Papel |
|---|---|
| `@lotg/engine` | Motor puro: `GameState`, `advanceTo`, `applyCommand`, RNG, `deriveViewState` |
| `@lotg/content` | Todos os números e textos de jogo + schemas zod |
| `@lotg/protocol` | Tipos e schemas zod da API `/v1`: `Command`, `ViewState`, erros |
| `@lotg/server` | Fastify + Drizzle/`pg`: auth, partidas, comandos, job de avanço, migrações |
| `@lotg/client-sdk` | Cliente HTTP tipado (usado pela extensão e pelo `sim-cli`) |
| `@lotg/sim-cli` | Bots de playtest, em processo ou contra um servidor |
| `lords-of-the-guild` (`packages/extension`) | VS Code: TreeView, Status Bar, comandos, cache, `SecretStorage` |
| `@lotg/webview` | UI em Preact |

Direção das dependências, imposta por `no-restricted-imports` em `eslint.config.js`: `engine`, `content` e `protocol` não importam `vscode`, `fastify`, `pg`, Drizzle nem módulos do Node (com ou sem `node:`); arquivos `*.test.ts` ficam fora dessa regra. `server` e `extension` dependem deles e **nunca um do outro**. A extensão e a Webview não importam o motor.

## Regras de arquitetura

**O servidor orquestra, o motor decide, a extensão exibe.**

1. Nenhuma regra de jogo fora de `packages/engine`; nenhum número de jogo fora de `packages/content`; a Webview só exibe o `ViewState`.
2. O servidor é autoritativo e é o relógio. O cliente envia comandos e recebe um `ViewState`; nunca envia estado, timestamps ou resultados. A névoa é aplicada no servidor.
3. Recursos em milésimos inteiros; `advanceTo` por segmentos; o invariante de divisão de intervalo é sagrado (ver "Determinismo do motor").
4. Toda mudança de estado é um comando validado, idempotente por `commandId` no servidor.
5. Só as bibliotecas permitidas: TypeScript, esbuild, Vitest, fast-check, zod, Preact, Fastify (+ plugins oficiais `@fastify/*`), `pg`, Drizzle, `jose`, `pino`, `tsx`, `@types/vscode`, `@vscode/vsce`, ESLint, Prettier. Hashes e HMAC usam `node:crypto` somente no servidor; não instalar `argon2`. Qualquer outra dependência exige ADR aprovado em `docs/decisions/`.
6. **Não antecipar mecânicas de versões futuras**, nem "só a estrutura". Cada mecânica do GDD tem tag `[v0.x]`; o MVP é exatamente a v0.1 (§16.1). Campos de moral, cartas, heróis, exército, mapa ou mercado no `GameState` da v0.1 são erro. Em contrapartida, não tomar decisões de arquitetura que impeçam as versões seguintes.
7. Desvios do GDD não são decididos pelo agente: propor em `docs/decisions/NNNN-titulo.md` e aguardar aprovação. Também não são do agente: provedor de VPS e domínio, publicação no Marketplace, nome público e ícone, texto da política de privacidade.
8. Mudar uma regra exige atualizar o golden test correspondente e o GDD. Toda nova mecânica entra com: dados em `content`, validação de comando com motivo de recusa legível, evento na Crônica, tooltip explicativo e teste.

### Servidor (`packages/server`, GDD §14.5–14.9)

O [README do servidor](packages/server/README.md) descreve a estrutura e os contratos. O que orienta qualquer mudança:

- Rotas validam a forma com os schemas zod de `@lotg/protocol` e chamam serviços; serviços recebem um `AppContext` (`config`, `pool`, `db`, `clock`, `fetch`, `hooks`). Nunca usar `new Date()` ou `Date.now()` para tempo de jogo, expiração ou exclusão: é sempre `ctx.clock()`.
- Toda leitura e todo comando de partida passam por `lockGame` (`SELECT … FOR UPDATE` filtrado pela conta). Escritas de estado passam por `persistState`, que incrementa `state_version` uma vez e numera os eventos.
- Quando uma operação precisa de commit antes de responder com erro (reuso de refresh token, recusa do motor), o desfecho sai da transação como valor e o erro é lançado depois: lançar dentro de `db.transaction` desfaz tudo.
- O protocolo valida só a forma dos comandos; faixas e regras são recusadas pelo motor, com frase em português (`422 GAME_RULE`).
- `Command`, `ViewState` e os códigos de recusa do protocolo têm teste de igualdade de tipos com os do motor: mudar um lado quebra o `pnpm typecheck`.

### Cliente (`packages/client-sdk`, `packages/extension`, `packages/webview`)

- **`client-sdk`**: `createClient({ baseUrl, tokenStore, clientVersion, fetch })`. Renova a sessão sozinho em `401 UNAUTHORIZED`, com uma renovação por vez, relendo antes o `TokenStore` (outra janela do VS Code pode já ter renovado); `SESSION_REVOKED` ou refresh recusado limpam o `TokenStore` e chamam `onUnauthenticated`. A rotação nunca é repetida em falha de rede. Leituras e comandos repetem em falha de rede (o comando, com o mesmo `commandId`). A recusa do motor sai como `GameRuleClientError`, com o estado avançado em `details`.
- **Extensão**: a lógica fica em módulos sem `vscode`, testáveis sozinhos: `account/accountService.ts` (conta nesta máquina), `game/gameSession.ts` (ciclo de 30 s/2 min, cache, conexão, comandos), `notifications/policy.ts`, `ui/treeModel.ts` e `ui/format.ts` (árvore e barra de status como dados). `controller.ts` junta tudo e é a única fonte de estado para árvore, barra de status, painel e comandos; a cola com o editor fica em `ui/treeProvider.ts`, `ui/statusBar.ts`, `ui/panel.ts`, `notifications/notifier.ts` e `commands/*.ts`.
- Uma ordem do jogador nasce em `controller.prepare(tipo, payload)`, que fixa o `commandId` e devolve a função de envio: "Tentar de novo" chama a mesma função e reenvia a mesma ordem. Nunca gere outro `commandId` para uma retentativa.
- Clicar em um item da árvore só abre o painel; ordens saem de botões explícitos (`contextValue` + `menus` no manifesto). No editor real, selecionar um item já dispara o `command` dele.
- O Relatório de Retorno não abre o painel sozinho e os eventos da ausência não viram notificações (`session.catchingUp`).
- Números de regra não são escritos no cliente (nem em textos): o que o jogador precisa ver vem no `ViewState` (por exemplo `constructions.active.refund`).
- As mudanças de conta passam por uma fila no `Controller` (`enqueue`): "Jogar agora" muda a conta duas vezes seguidas e, sem a fila, o tratamento da primeira fecha a sessão que a segunda abriu.
- Cache em `globalState` com chave por servidor, conta e partida (`cacheKey`); tokens só no `SecretStorage`. Sair, excluir e perder a sessão apagam os dois.
- **Webview**: `state.ts` é um redutor puro sobre as mensagens da extensão; `app.tsx` e `components/` só exibem. O painel manda `ready`, `command`, `navigate`, `playNow` e `action`, validados pela extensão com `WebviewToExtensionSchema`. Nenhuma conta sobre o jogo é feita no cliente: o que falta no `ViewState` é acrescentado no motor (foi assim com `workers[].perWorkerPerHour`).
- `styles.css` usa só variáveis `--vscode-*`; um teste falha se aparecer uma cor fixa.

### Contratos do servidor e do cliente (GDD §14.5–14.10)

- **Avanço preguiçoso.** Leituras e comandos novos autenticam, verificam propriedade e travam a partida antes de `advanceTo(agora)`. Reenvios retornam o recibo antes de avançar. Um job (`advance-stale-games`) avança partidas sem estado persistido há mais de 1 h; não há temporizador por partida em memória.
- **Caminho de um comando** (uma transação): lock da partida → busca de recibo por `(game_id, commandId)` → para comando novo, `advanceTo` → `applyCommand` → persistência do estado, eventos e recibo completo (`request_hash`, `response_status`, `response_body`). Recusa preserva o avanço e faz commit antes do 422; falha inesperada faz rollback. Reenvio idêntico retorna status/corpo originais com `X-Lords-Replayed`; payload diferente com o mesmo UUID recebe `COMMAND_ID_CONFLICT`. Recibos permanecem enquanto a partida existir.
- **Persistência.** `GameState` inteiro em `games.state` (JSONB), sem patches parciais; `commands` + estado inicial + semente = replay completo. Crônica e eventos ficam em tabelas próprias; o motor só os **emite** como saída.
- **Cliente.** Polling de 30 s com o painel aberto (2 min fechado) em `GET /view` e `GET /events?after=`. ETag fraco é SHA-256 do corpo `{ view, stateVersion }`; pode mudar sem escrita no banco. `stateVersion` é string decimal; `X-Lords-State-Version` é apenas aviso de concorrência, sem usar `If-Match`. Após recibo repetido, buscar view/eventos atuais sem reaplicar eventos antigos. Cache em `globalState` separado por servidor/conta/partida; comandos nunca ficam em fila local. A Webview só fala com a extensão.
- **Sessões e recuperação.** Uma família por sessão/máquina, validade absoluta de 30 dias, histórico completo em `refresh_tokens`. Reuso de qualquer antecessor revoga a família com commit antes do 401. Autorização consulta conta/sessão no banco sem cache positivo. Código do Reino usa HMAC-SHA256 com `RECOVERY_CODE_SECRET` independente; detalhes em GDD §14.7 e ADRs 0003/0005.
- **Exclusão.** Bloqueio imediato, revogação de todas as sessões, limpeza do código de recuperação e arquivamento das partidas em transação; resposta 202 com `deletedAt`/`purgeAfter`. Primeiro job a partir de sete dias remove dependentes em cascata; backups seguem retenção de 14 dias desde a geração. Logout, exclusão e sessão revogada limpam tokens e cache local. Não prometer remoção física imediata nem oferecer desfazer exclusão na v0.1.

### Motor (`packages/engine`, GDD §14.3)

API pública, e nada além dela e dos tipos: `createInitialState`, `nextEventAt`, `advanceTo`, `applyCommand`, `deriveViewState`. O [README do motor](packages/engine/README.md) descreve o ciclo, os invariantes e como adicionar um evento.

- Funções puras que nunca mutam a entrada: cada chamada clona o estado (JSON puro) e trabalha num rascunho. Sem `Date.now()`, `Math.random()` ou I/O; o ESLint e `purity.test.ts` recusam.
- `advanceTo` anda trecho a trecho até o próximo evento de `nextEventAt` (fim de obra, chegada de aldeão, virada de dia, comida acabando). Ordem fixa no mesmo instante: obras, aldeões, ano, estação, dia, objetivos, fome (`processEventsAt` em `advance.ts`).
- Recursos em **milésimos inteiros**; `accumulators` guarda o resto de `taxa × ms` que ainda não completou um milésimo. Fatores do conteúdo são frações (`{ num, den }`) para nenhuma conta usar ponto flutuante. Nunca `number` fracionário no estado.
- Invariante testada por propriedade, exata e sem tolerância: `advanceTo(t2)` ≡ `advanceTo(t1)` seguido de `advanceTo(t2)`, no estado e nos eventos.
- `applyCommand` exige o estado avançado até o instante do comando e lança se não estiver; recusa de regra devolve `{ ok: false, code, message }` sem lançar. Depois de todo comando e de todo instante com eventos rodam `evaluateObjectives` e `settleFamine`.
- O motor **emite** eventos já com a frase da Crônica (`emit` em `chronicle.ts`, modelos em `@lotg/content`) e não os guarda no estado.
- Valores deriváveis (capacidade habitacional, aldeões livres, taxas) são funções puras, nunca persistidos.
- O `GameState` da v0.1 tem o campo `rng`, mas ainda não existe gerador: nenhuma regra da v0.1 sorteia nada. Fluxos nomeados (`council`, `market`, `battle:<id>`, …) entram com a primeira mecânica que sortear.

## Convenções

- Documentação, textos de interface e conteúdo de jogo em **português do Brasil** (conteúdo narrativo em tom de crônica medieval, frases curtas). Identificadores de código em inglês (`townHall`, `lumberMill`, `startConstruction`).
- Testes `*.test.ts` ao lado do código; golden files em `__golden__/`; integração em `tests/` ou `packages/server/test/`. Testes primeiro onde houver regra de jogo ou contrato de API.
- `main` sempre verde (`pnpm verify`). Tarefas de tamanho `L` em branch (`f1-t5-construcoes`) com merge ao final.
- Commits: `F1-T3: resumo no imperativo`. Nunca logar tokens, códigos de recuperação ou segredos.

## Ritual de conclusão de tarefa (MVP-ROADMAP.md §0.3 e §A.4)

Uma tarefa do roadmap por sessão; a ordem das fases é obrigatória. Para tarefas `M` e `L`, apresentar o plano e esperar aprovação antes de codar.

1. Rodar os comandos da seção "Verificação" da tarefa e `pnpm verify` (mais `pnpm test:integration` se tocar o servidor) e mostrar a saída. Sem saída de teste, não há tarefa concluída.
2. Marcar as caixas da tarefa em MVP-ROADMAP.md e preencher a linha no Registro de Execução (§9).
3. Desvios do GDD → `docs/decisions/NNNN-titulo.md`, aguardando aprovação.
4. Um commit por tarefa (ou por subtarefa em tarefas `L`).

## Nunca

- Rodar `docker compose down -v` fora do ambiente de dev: `-v` apaga os volumes do banco.
- Commitar `.env` ou qualquer segredo; regenerar `RECOVERY_CODE_SECRET` de um ambiente que já emitiu códigos.
- Publicar no Marketplace.
- Mesclar estados de contas.
- Usar Alpine como base da imagem (a base é `node:22-bookworm-slim`).
