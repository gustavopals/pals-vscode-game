# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado atual do repositório

**Lords of the Guild** é um jogo medieval de gerenciamento assíncrono jogado dentro do VS Code: motor determinístico em TypeScript, servidor Fastify + PostgreSQL autoritativo, extensão do VS Code como cliente.

Hoje o repositório contém **apenas especificação, nenhum código**:

- [GAME_DESIGN.md](GAME_DESIGN.md) — GDD documental v0.4. §14 é o **contrato de arquitetura**, §16.1 é o **escopo exato do jogo v0.1**, §18.3 são regras permanentes.
- [MVP-ROADMAP.md](MVP-ROADMAP.md) — plano de execução da v0.1 em fases `F0…F5` e tarefas `F1-T3`, cada uma com subtarefas em caixas de seleção, seção "Verificação" e "Pronto quando".
- [Decisões de arquitetura](docs/decisions/README.md) — ADRs 0003–0005 consolidados na revisão documental de 2026-10-01; implementação pendente. Seguir esses contratos não exige nova aprovação de desvio.

Os comandos, pacotes e diretórios descritos abaixo são o **alvo** definido nesses documentos; passam a existir a partir de F0-T2 (monorepo) e F0-T4 (Docker). Antes de rodar um comando, confira se o `package.json` raiz já existe. A tarefa F0-T3 do roadmap prevê reescrever este arquivo seguindo o modelo de MVP-ROADMAP.md §A.1, junto com `docs/decisions/` e `.claude/settings.json`.

Os dois documentos somam ~2.600 linhas: leia as seções indicadas pela tarefa em vez do arquivo inteiro (ambos têm índice numerado por `§`).

## Comandos (alvo, MVP-ROADMAP.md §1.4)

Ambiente: Node 22 LTS, pnpm 9, Docker com integração WSL2. O repositório deve ficar no sistema de arquivos do Linux, nunca em `/mnt/c`.

```bash
pnpm install
pnpm dev:up            # sobe db (5432) e db_test (5433) via deploy/docker-compose.dev.yml
pnpm db:migrate        # aplica migrações no banco de dev
pnpm dev:api           # API no host com tsx watch (http://localhost:3000/v1/health)
pnpm dev:ext           # extensão + webview em watch; depois F5 abre o Extension Development Host

pnpm verify            # lint + typecheck + test — porta de entrada de todo "pronto"
pnpm test              # unitários e de conteúdo (Vitest)
pnpm test:integration  # servidor contra db_test; exige TEST_DATABASE_URL
pnpm --filter @lotg/engine test -- construction   # um pacote / um arquivo de teste
pnpm sim -- --seed <s> --days 7 --strategy economico   # bot de playtest em processo
pnpm docker:build      # imagem de produção da API
```

A API roda **no host** em desenvolvimento para hot reload e depuração; não compartilhar `node_modules` entre host e contêiner. O perfil `--profile full` do compose de dev existe para testar a imagem. Credenciais usam `node:crypto` no servidor; Argon2 não é necessário. Variáveis de ambiente e portas em MVP-ROADMAP.md §1.2–1.3, incluindo `RECOVERY_CODE_SECRET` independente de `JWT_SECRET`, preservado nos deploys.

## Arquitetura

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

Direção das dependências: `engine`, `content` e `protocol` não importam `vscode`, `fastify`, `pg` nem `node:*` (regra de lint). `server` e `extension` dependem deles e **nunca um do outro**. A extensão não contém o motor.

**O servidor orquestra, o motor decide, a extensão exibe.**

- **Servidor autoritativo e relógio.** O cliente envia comandos e recebe um `ViewState`; nunca envia estado, timestamps ou resultados. A névoa é aplicada no servidor.
- **Avanço preguiçoso.** Leituras e comandos novos autenticam, verificam propriedade e travam a partida antes de `advanceTo(agora)`. Reenvios retornam o recibo antes de avançar. Um job (`advance-stale-games`) avança partidas sem estado persistido há mais de 1 h; não há temporizador por partida em memória.
- **Caminho de um comando** (uma transação): lock da partida → busca de recibo por `(game_id, commandId)` → para comando novo, `advanceTo` → `applyCommand` → persistência do estado, eventos e recibo completo (`request_hash`, `response_status`, `response_body`). Recusa preserva o avanço e faz commit antes do 422; falha inesperada faz rollback. Reenvio idêntico retorna status/corpo originais com `X-Lords-Replayed`; payload diferente com o mesmo UUID recebe `COMMAND_ID_CONFLICT`. Recibos permanecem enquanto a partida existir.
- **Persistência.** `GameState` inteiro em `games.state` (JSONB), sem patches parciais; `commands` + estado inicial + semente = replay completo. Crônica e eventos ficam em tabelas próprias; o motor só os **emite** como saída.
- **Cliente.** Polling de 30 s com o painel aberto (2 min fechado) em `GET /view` e `GET /events?after=`. ETag fraco é SHA-256 do corpo `{ view, stateVersion }`; pode mudar sem escrita no banco. `stateVersion` é string decimal; `X-Lords-State-Version` é apenas aviso de concorrência, sem usar `If-Match`. Após recibo repetido, buscar view/eventos atuais sem reaplicar eventos antigos. Cache em `globalState` separado por servidor/conta/partida; comandos nunca ficam em fila local. A Webview só fala com a extensão.
- **Sessões e recuperação.** Uma família por sessão/máquina, validade absoluta de 30 dias, histórico completo em `refresh_tokens`. Reuso de qualquer antecessor revoga a família com commit antes do 401. Autorização consulta conta/sessão no banco sem cache positivo. Código do Reino usa HMAC-SHA256 com `RECOVERY_CODE_SECRET` independente; detalhes em GDD §14.7 e ADRs 0003/0005.
- **Exclusão.** Bloqueio imediato, revogação de todas as sessões, limpeza do código de recuperação e arquivamento das partidas em transação; resposta 202 com `deletedAt`/`purgeAfter`. Primeiro job a partir de sete dias remove dependentes em cascata; backups seguem retenção de 14 dias desde a geração. Logout, exclusão e sessão revogada limpam tokens e cache local. Não prometer remoção física imediata nem oferecer desfazer exclusão na v0.1.

### Determinismo do motor (GDD §14.3)

API pública (MVP-ROADMAP.md §3): `createInitialState`, `nextEventAt`, `advanceTo`, `applyCommand`, `deriveViewState`.

- Funções puras que nunca mutam a entrada. Sem `Date.now()`, `Math.random()` ou I/O.
- Tempo de jogo em milissegundos inteiros; `advanceTo` processa a linha do tempo de eventos em ordem, aplicando produção contínua por segmento.
- Recursos em **milésimos inteiros** com acumulador por recurso (divisão inteira carregando o resto). Nunca `number` fracionário no estado.
- Invariante testada por propriedade, exata e sem tolerância: `advanceTo(t2)` ≡ `advanceTo(t1)` seguido de `advanceTo(t2)`.
- RNG com semente e **fluxos nomeados** (`council`, `market`, `battle:<id>`, …), cada um com estado próprio dentro do `GameState`.
- Valores deriváveis (capacidade habitacional, caps de armazenamento) são funções puras, nunca persistidos.

## Regras do projeto

1. Nenhuma regra de jogo fora de `packages/engine`; nenhum número de jogo fora de `packages/content`; a Webview só exibe o `ViewState`.
2. **Não antecipar mecânicas de versões futuras**, nem "só a estrutura". Cada mecânica do GDD tem tag `[v0.x]`; o MVP é exatamente a v0.1 (§16.1). Campos de moral, cartas, heróis, exército, mapa ou mercado no `GameState` da v0.1 são erro. Em contrapartida, não tomar decisões de arquitetura que impeçam as versões seguintes.
3. Bibliotecas permitidas: TypeScript, esbuild, Vitest, fast-check, zod, Preact, Fastify (+ plugins oficiais `@fastify/*`), `pg`, Drizzle, `jose`, `pino`, `tsx`, `@types/vscode`, `@vscode/vsce`, ESLint, Prettier. Hashes e HMAC usam `node:crypto` somente no servidor. Qualquer outra dependência exige ADR aprovado em `docs/decisions/`.
4. Desvios do GDD não são decididos pelo agente: propor em `docs/decisions/NNNN-titulo.md` e aguardar aprovação. Também não são do agente: provedor de VPS e domínio, publicação no Marketplace, nome público e ícone, texto da política de privacidade.
5. Mudar uma regra exige atualizar o golden test correspondente e o GDD. Toda nova mecânica entra com: dados em `content`, validação de comando com motivo de recusa legível, evento na Crônica, tooltip explicativo e teste.
6. Imagens Docker com base `node:22-bookworm-slim`, nunca Alpine. Nunca `docker compose down -v` fora do dev. Nunca commitar `.env`, logar tokens ou mesclar estados de contas.

## Convenções

- Documentação, textos de interface e conteúdo de jogo em **português do Brasil** (conteúdo narrativo em tom de crônica medieval, frases curtas). Identificadores de código em inglês (`townHall`, `lumberMill`, `startConstruction`).
- Testes `*.test.ts` ao lado do código; golden files em `__golden__/`; integração em `tests/` ou `packages/server/test/`. Testes primeiro onde houver regra de jogo ou contrato de API.
- `main` sempre verde (`pnpm verify`). Tarefas de tamanho `L` em branch (`f1-t5-construcoes`) com merge ao final.

## Ritual de tarefa (MVP-ROADMAP.md §0.3 e §A.4)

Uma tarefa do roadmap por sessão; a ordem das fases é obrigatória. Para tarefas `M` e `L`, apresentar o plano e esperar aprovação antes de codar.

Para fechar uma tarefa:

1. Rodar os comandos da seção "Verificação" da tarefa e `pnpm verify` (mais `pnpm test:integration` se tocar o servidor) e mostrar a saída. Sem saída de teste, não há tarefa concluída.
2. Marcar as caixas da tarefa em MVP-ROADMAP.md e preencher a linha no Registro de Execução (§9).
3. Um commit por tarefa (ou por subtarefa em tarefas `L`) com a mensagem `F1-T3: resumo no imperativo`.
