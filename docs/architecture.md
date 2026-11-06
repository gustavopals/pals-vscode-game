# Arquitetura até a v0.4

O que está construído em Lords of the Guild, conferido em **2026-11-06** no branch
`v4-docs`, a partir da terceira junção `v4-juncao3` (`ccbaa5c`). O estado está na
**versão 42**, o protocolo na **4** e os pacotes ainda em **0.3.0**. Esta é uma
base local de desenvolvimento, sem publicação da v0.4. Antes de afirmar o que
está no ar, conferir `protocol`, `version` e `builtAt` em `GET /v1/version`.

O [GDD](../GAME_DESIGN.md), §14, continua sendo o contrato. As regras da guerra
seguem os ADRs [0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md)
e [0020](decisions/0020-horda-cerco-e-cronica-do-ano.md); o Reino segue o
[ADR 0021](decisions/0021-estatisticas-e-ranking.md). As seções 19b a 19m descrevem
as entregas da v0.4 sobre a base da Guilda. Registros de fases nos READMEs podem
conservar números e limitações históricos; aqui vale o código desta base.

Detalhes por pacote: [motor](../packages/engine/README.md),
[servidor](../packages/server/README.md), [app](../packages/web/README.md),
[simulador](../packages/sim-cli/README.md) e [implantação](../deploy/README.md).
As medições e suas datas estão em [balance-v0.4.md](balance-v0.4.md); decisões e
perguntas abertas, em [pendencias-v0.4.md](pendencias-v0.4.md). O ponto de
continuação é [retomada-v0.4.md](retomada-v0.4.md); provas e roteiro humano estão
em [acceptance-v0.4.md](acceptance-v0.4.md) e [manual-test-v0.4.md](manual-test-v0.4.md).

## 1. Visão geral

O diagrama do GDD §14.1, com os componentes usados pela base local e pela implantação no Coolify.

```mermaid
flowchart TB
    subgraph browser["Navegador"]
        App["App web (Preact)<br/>bancada com aparência de editor"]
        SDK["client-sdk<br/>HTTP tipado, renovação de sessão,<br/>X-Lords-Protocol: 4"]
        Store[("localStorage<br/>tokens, cache da visão com marca de versão,<br/>preferências")]
        App --> SDK
        App --> Store
    end

    SDK -- "HTTPS · JSON · ciclo de 30 s" --> Proxy

    subgraph coolify["Servidor com Coolify"]
        Proxy["Proxy da plataforma (Traefik)<br/>TLS, HTTP → HTTPS, rotas pelo caminho"]
        Web["lotg-web · Caddy<br/>arquivos estáticos do app<br/>CSP e cabeçalhos de segurança"]
        API["lotg-api · Node 22 + Fastify<br/>auth · catalog · games · view · commands · events · chronicle<br/>jobs: avanço (com migração) e expurgo"]
        Engine["engine + content<br/>(empacotados dentro da API)"]
        DB[("lotg-db · PostgreSQL 16<br/>accounts · sessions · refresh_tokens<br/>games (JSONB, com schemaVersion) · commands · game_events")]
        Backup["Backup agendado<br/>pg_dump diário, 14 dias"]
        Landing["lotg-landing · Caddy<br/>página de apresentação<br/>em outro domínio"]

        Proxy -- "/ (tudo o que não é /v1)" --> Web
        Proxy -- "/v1, com o prefixo inteiro" --> API
        Proxy -- "domínio da página" --> Landing
        API --> Engine
        API --> DB
        DB -.-> Backup
    end

    Monitor["GitHub Actions · health.yml<br/>consulta /v1/health e a página"] -.-> Proxy
    Sim["sim-cli<br/>em processo, --matrix, --perf<br/>ou --remote"] -. "carga" .-> Proxy
    Deploy["GitHub Actions · ci.yml<br/>job deploy, depois da CI verde"] -. "API do Coolify:<br/>API, app, página" .-> coolify
```

A instalação é a da v0.1 ([ADR 0009](decisions/0009-implantacao-no-coolify.md)): três recursos no Coolify mais a página de apresentação, a borda no proxy da plataforma, app e API na mesma origem, deploy automático a cada `push` no `main`. Nem a v0.2 nem a v0.3 criaram tabela, rota de infraestrutura nem recurso novo: tudo o que acrescentaram ao jogo vive dentro de `games.state` e de `game_events`. As rotas novas da v0.2 foram `GET /v1/catalog` e os campos novos de `POST /games`; **a v0.3 não acrescentou rota nenhuma**, só comandos, eventos e campos da visão, e `GET /chronicle.md` ganhou o parâmetro `links`. A v0.4 acrescenta a Crônica anual (`GET /games/:id/years/:year/chronicle.md`), as estatísticas (`GET /stats`) e a preferência de ranking (`GET`/`PUT /me/ranking`), sob `/v1`, além da migração SQL `0001_ranking_listed` em `accounts`.

Os princípios do GDD §14.1 valem como estão: o servidor é autoritativo e é o relógio; o motor é um só (servidor, simulador e testes); estado inicial, semente e log de comandos refazem uma partida que nasceu na versão atual (a de uma partida migrada tem um limite, ver 4.4); o avanço é preguiçoso, então uma queda do servidor não perde nada.

## 2. Pacotes e direção das dependências

```mermaid
flowchart LR
    content["content<br/>números, textos, cartas, schemas"]
    engine["engine<br/>regras puras, migração, sorteios"]
    protocol["protocol<br/>schemas da API /v1"]
    server["server<br/>Fastify + PostgreSQL"]
    sdk["client-sdk<br/>cliente HTTP"]
    web["web<br/>app Preact"]
    sim["sim-cli<br/>bots"]
    landing["landing<br/>página estática"]

    engine --> content
    protocol --> content
    protocol -. "só tipos, em teste" .-> engine
    server --> engine
    server --> content
    server --> protocol
    sdk --> protocol
    web --> sdk
    web --> protocol
    sim --> engine
    sim --> content
    sim --> sdk
    sim --> protocol
    landing -. "só em teste" .-> content
```

A seta aponta para o que é importado. As regras, impostas por `no-restricted-imports` em [`eslint.config.js`](../eslint.config.js):

- `engine`, `content` e `protocol` não importam `fastify`, `pg`, Drizzle nem módulos do Node. Arquivos de teste ficam fora da regra.
- `server` e `web` nunca importam um ao outro.
- `web` não importa o motor nem, fora dos testes, `@lotg/content` e o `contentHash` de `@lotg/protocol` (que lê o catálogo inteiro). `packages/web/src/bundle.test.ts` compila o app e confere que nenhum número, frase, flag ou efeito escondido do conteúdo chega ao navegador: do conteúdo só entram as listas de identificadores que os schemas do protocolo usam.
- `landing` não importa pacote nenhum do jogo. Só os testes dela leem `content`, para conferir as frases da Crônica que a página cita.
- `protocol` depende do motor apenas como dependência de desenvolvimento: um teste de igualdade de tipos faz o `pnpm typecheck` quebrar se `Command`, `ViewState` ou os códigos de recusa divergirem entre os dois.

Os pacotes são consumidos como fonte TypeScript (`exports` aponta para `src/index.ts`). Só o que é implantado tem build: o servidor (um único `dist/main.js`, com esbuild), o app (`packages/web/dist`, com Vite) e a página de apresentação (`packages/landing/dist`, com Vite).

## 3. Onde fica cada responsabilidade

**O servidor orquestra, o motor decide, o app exibe.**

| Responsabilidade | Onde fica |
|---|---|
| Regras de jogo: produção, estações, estoque, obras e filas, ofício, moral, Conselho, Ameaça, incursões, objetivos, heróis, soldo, Taverna, expedições, Mercado, caravanas, Mestres, forja, exército, batalha, Horda, Cerco e fecho anual | `packages/engine` (`advanceTo`, `applyCommand`) |
| Números, textos, cartas e frases da Crônica | `packages/content` (`balance.ts`, `buildings.ts`, `cards/`, `chronicle.ts`, `objectives.ts`, `tiles.ts`) |
| Leitura de um estado gravado em qualquer versão | `migrateState`, em `packages/engine/src/migrations.ts` |
| Sorteios | `packages/engine/src/random.ts`, só dentro de `advanceTo` |
| O que a interface mostra, com a explicação de cada número e a névoa da Ameaça | `deriveViewState` e os `*View.ts` do motor |
| Forma dos comandos, das respostas e dos erros da API | `packages/protocol` (zod) |
| Faixas e regras de um comando (recusa com frase em português) | Motor; o servidor responde `422 GAME_RULE` |
| Relógio, autenticação, propriedade da partida, lock, migração gravada, persistência, recibos | `packages/server` |
| Opções de nova partida e conferência do ritmo pedido | Servidor (`src/catalog.ts`, `GET /v1/catalog`) |
| Recusa de um cliente de outro protocolo (`426`) | Servidor (`src/plugins/errors.ts`) |
| Conversão entre tempo real e tempo de jogo | Servidor (`gameTimeAt`, em `games/repository.ts`) e `deriveViewState` |
| Filtro de apresentação da Crônica (sem viradas de dia nem fecho do desperdício) e a nota "Sua escolha voltou" no Markdown | Servidor (`chronicleRows`, `games/chronicleMarkdown.ts`) |
| Avanço de partidas paradas (migrando-as) e expurgo de contas excluídas | Jobs do servidor, sob advisory lock (uma réplica por rodada) |
| Renovação de sessão, retentativas de rede, mesmo `commandId` no reenvio, cabeçalho do protocolo | `packages/client-sdk` |
| Estado da interface, ciclo de atualização, cache com marca de versão, avisos, diálogos | `packages/web` (`app/controller.ts`, `game/gameSession.ts`) |
| Relatório de Retorno em três blocos e "Antes de partir", montados só com a visão e os eventos (com a Guilda, o Mercado, as caravanas e os Mestres) | `packages/web/src/game/returnReport.ts` e `beforeLeaving.ts` |
| A conferência de duas etapas do Mercado e das caravanas, e a única conta de regra do app (`quantidade × preço de hoje`) | `packages/web/src/ui/market.ts`, amarrada ao motor por teste |
| Credenciais e cache no navegador, sincronização entre abas | `packages/web/src/services` (`localStorage`, Web Locks, evento `storage`) |
| Balanceamento: bots que jogam só com a visão, matriz e faixas | `packages/sim-cli` |
| TLS, redirecionamento, rotas por caminho | Proxy do Coolify |
| Cabeçalhos de segurança do app (CSP, `nosniff`, HSTS) | Caddy da imagem `web` |
| Apresentação do jogo a quem ainda não joga | `packages/landing`, servida pelo Caddy da imagem `landing`, em outro domínio |
| Backup do banco | Agendamento do Coolify |
| Implantação a cada `push` no `main` | Job `deploy` de `.github/workflows/ci.yml`, pela API do Coolify |

O app não faz conta sobre o jogo. Quando a interface precisou de um número ou de uma frase que não estava no `ViewState`, ela foi acrescentada no motor: na v0.2 e na v0.3, por exemplo, `winter` e `calendar.nextSeason.firewood` (a conta da lenha), `resources[].fullInSeconds`, `constructions.planned[].waiting`, `perNewWorkerPerHour`, `morale.next`, `council.pending[].defaultOptionId`, `threat.incoming.defenseText` e `objectives[].missing`; na v0.3, `eligibleHeroIds`, `canSend`, `suggestedTeam` e `sendBlockedReason` (quem pode partir em uma expedição), `canDismiss`, `wageNextLevelText` e o excedente vendável do Mercado (`surplusSellable`, `surplusText`). Há uma exceção registrada: `previewAllocation`, no app, repete a ordem de saída das levas em adaptação só para a prévia antes de confirmar uma alocação (pendência C-15); um teste em navegador a compara com o servidor.


## 4. O estado e as versões

### 4.1 Um JSON inteiro por partida

O `GameState` inteiro fica em `games.state` (JSONB), sempre escrito por completo, nunca em pedaços. Da v0.1 para a v0.3 o estado cresceu de 1 para 24 versões sem uma migração de SQL sequer: mudar a forma do estado não muda o esquema do banco. A coluna `games.schema_version` é só um espelho para consultas (`select schema_version, status, count(*) from games group by 1, 2`).

Quatro coisas têm versão, cada uma com o seu tratamento ([README do servidor](../packages/server/README.md), "O que tem versão"):

| O quê | Número | Quando muda |
|---|---|---|
| Estado da partida | `state.schemaVersion` (42 nesta base) | Uma tarefa muda a forma do `GameState`: um passo de migração por versão |
| Conteúdo | `contentHash` em `GET /version` e `GET /catalog` | Qualquer número, texto ou carta de `@lotg/content`; o conteúdo vai na imagem e não é gravado no banco. **Exceção:** os ids de carta, de modelo de expedição, de nó, de opção, de candidato, de item e de Mestre, e os limites do Mercado e das caravanas, ficam gravados no estado e pedem passo de migração para mudar |
| Protocolo | `protocol` em `GET /version` (hoje 4); o cliente manda `X-Lords-Protocol` | Uma mudança que o app antigo não consegue ler (ver seção 10) |
| Recibos de comando | Nenhum | Nunca são reescritos: o reenvio devolve a resposta da época, byte a byte |

### 4.2 `migrateState`

Um estado gravado só entra no motor por `migrateState(stored, { timeScale, realOriginMs, utcOffsetMinutes, timezoneResolved })`. Ela é pura, sequencial (1 → 2 → … → 42), idempotente e **confere a forma exata** de cada versão antes de mexer, também quando o estado já diz ser da versão atual: o número não é salvo-conduto. O que ela não conhece é recusado com `StateMigrationError` (`future` para uma versão mais nova que a do motor; `invalid` para uma forma inesperada), com o caminho do campo e o tipo, nunca o valor. Cada passo mora em `packages/engine/src/migrations/`, com a forma exata da versão de que parte, os identificadores escritos no arquivo (nada importado de `@lotg/content`) e um retrato congelado em `__fixtures__/`.

| Versão | Tarefa | O que entrou |
|---|---|---|
| 2 | V2B-T1 | `settings.difficulty` e `settings.timeScale`; `migratedAtMs` |
| 3 | V2C-T1 | O frio (`settlement.cold`) |
| 4 | V2C-T2 | Celeiro e Armazém em `buildings`; desperdício por relatar |
| 5 | V2C-T5 | Duas posições de fila; `autoStart` nas planejadas |
| 6 | V2C-T3 | Coortes de adaptação, experiência e mestria do ofício |
| 7 | V2C-T4 | Moral e efeitos temporários de moral |
| 8 | V2D-T1 | O Conselho (`council`) |
| 9 | V2E-T1 | Torre de Vigia; `map` (tiles e Ameaça); `horde` |
| 10 | V2E-T2 | A Paliçada em `buildings` |
| 11 | V2E-T3 | Os feridos (`settlement.injured`) e a incursão do roteiro marcada |
| 12 | V2G | As respostas do autor à v0.2 ([ADR 0016](decisions/0016-respostas-do-autor-as-pendencias-da-v0.2.md)); é o estado da `v0.2.0` e da produção |
| 13 | V3B-T1 | `state.ids` (contadores de identidade) e os fluxos de sorteio por entidade |
| 14 | V3C-T1 | `state.guild`: heróis, soldo e atraso |
| 15 | V3C-T3 | A carta roteirizada e a lista dos heróis prometidos (`guild.arriving`) |
| 16 | V3C-T2 | A Taverna: `buildings.tavern`, `guild.tavernOffers`, `guild.tavern`, o fluxo `tavern` |
| 17 | V3D-T1 | A Guilda dos Aventureiros, `guild.expeditions`, `guild.reports`, o herói em expedição |
| 18 | V3D-T2 | Os desfechos: ferimento, cativeiro, equipamento, `guild.inventory`, `map.discovered` |
| 19 | V3D-T3 | `standout` e `lesson` em cada registro do percurso |
| 20 | V3D-T5 | `freedAtMs` no herói; a lição do tipo `level` |
| 21 | V3E-T1 | O Mercado: `buildings.market` e `state.market` |
| 22 | V3E-T2 | As caravanas (`market.caravans`) e o herói em escolta |
| 23 | V3E-T3 | Os Mestres: `settlement.masters`, `settlement.mastersWaiting` |
| 24 | V3E-T5 | `worked` em cada Mestre (a primeira alocação é imediata) e a guarda dos limites do Mercado e das caravanas (`marketLimitsWithinState`) |
| 25 | V4B-T1 | O ferro: `iron` no estoque, nos acumuladores, no desperdício, nos preços do Mercado e nos registros de quantidade das expedições; nenhum no feudo, o preço na base |
| 26 | V4B-T2 | O Ferreiro: `buildings.smithy` em 0, `settlement.weapons` em 0 e `settlement.forge` em `null` |
| 27 | V4B-T3 | O desgaste: `condition` em cada item (cheia, pela raridade) e `kind` no lote da forja, que passa a guardar também um reparo |
| 28 | V4C-T1 | Quartel, contagens por unidade e lote de treino |
| 29 | V4C-T2 | Formações salvas e Defesa ativa |
| 30 | V4D-T1 | Relatórios de batalha |
| 31 | V4D-T2 | Prévia do Conselho de Guerra |
| 32 | V4E-T1 | Vida da muralha por ala e reparo |
| 33 | V4E-T2 | `composition` em cada incursão marcada (`null` no passo, que não sorteia), o tamanho `strong` e `formationId` em cada relatório de batalha; o passo marca a incursão do roteiro da guerra que a fronteira encontra dentro da antecedência |
| 34 | V4E-T3 | Memória da Horda, preparação das ondas e presságios |
| 35 | V4G-T1 | Origem real e offset civil fixo da Vigília |
| 36 | V4H-T1 | Efeitos temporários sobre os preços do Mercado |
| 37 | V4H-T1 | Participantes das cartas e candidato extra da Taverna |
| 38 | V4F-T1 | Tentativas, sucessos e alerta da sabotagem |
| 39 | V4F-T2 | Campanha do exército e herói em `campaign` |
| 40 | V4G-T2 | Cerco, milícia e Primavera da Reconstrução, inicialmente nulos |
| 41 | V4H-T2 | Bônus de cartas da guerra e guarda da Espada do Senhor |
| 42 | V4H-T1.4 | `map.expeditionUnlocks`, vazio; não abre a Caçada do Lobo Branco |

Os objetivos 5 a 10 (V2E-T4) e os 11 a 16 (V3F-T2) **não mudaram a forma**: uma partida gravada antes deles fica fora do repouso e é acomodada na fronteira, antes de o tempo andar (seção 6). O contador novo dos objetivos (`expeditionsReturned:<modelo>`) não é preenchido por passo nenhum (pendência F-5; seção 21).

### 4.3 A fronteira

`migratedAtMs` é o instante de jogo em que a **última** migração encontrou a partida, isto é, até onde uma versão anterior das regras a simulou ([ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 4). Como o conteúdo chega à produção em mais de uma publicação, **a fronteira é de cada passo**: `migrateWith` entrega a cada passo o `lastProcessedAt` da partida naquele momento (`context.boundaryMs`), e todo prazo que um passo cria conta dali. Nada da ausência anterior é recalculado com uma regra que não existia; o estoque acima do novo limite fica; um passo não emite eventos (quem abre o frio de uma partida parada no inverno é o primeiro `advanceTo`, na fronteira). Na v0.3 nenhum passo cria prazo, evento, identificador ou sorteio.

### 4.4 No servidor

`loadGame` (`packages/server/src/games/repository.ts`) chama `migrateState` sob o lock da partida, em toda leitura, todo comando e no job de avanço; o resto do servidor só enxerga o estado na versão atual. A migração é gravada pela primeira escrita daquela transação, com um único incremento de `state_version`. Duas requisições simultâneas migram uma vez. `persistState` confere também o estado que vai gravar (`assertStorable`). Um estado ilegível termina em `500` **sem nada gravado por cima**; o job conta a falha, registra a causa da primeira e segue com as outras partidas.

**Limite conhecido.** O instante de cada migração depende de quando a partida foi gravada pela última vez antes da publicação, e isso não se deduz da semente nem dos comandos. Refazer por replay uma partida migrada exige o estado gravado em cada fronteira (um backup); o estado guarda só a mais recente (pendência B-4). A publicação da v0.3 em 2026-10-15 migrou quatro partidas de 12 para 24, conforme o registro do roadmap da v0.4. A passagem de 24 para 42 ainda exige a publicação pelo autor; retratos e testes não substituem o backup nem a conferência em produção.

## 5. Sorteios

O motor sorteia com um gerador próprio, com semente, em `packages/engine/src/random.ts`: xoshiro128\*\*, só com operações inteiras, e **fluxos nomeados**, cada um com o próprio estado em `state.rng[nome]`:

| Fluxo | Quem sorteia | Desde |
|---|---|---|
| `morale` | A chegada de um colono e a partida de um aldeão, na virada do dia | V2C-T4 |
| `council` | A carta de cada audiência, os participantes dos encontros e o risco diferido de cartas | V2D-T1 |
| `horde` | Marcação e composição de incursões, preparação/regeneração das ondas e presságios | V2E-T3 |
| `tavern` | A rotação dos candidatos (`tavernTurn.ts`) | V3C-T2 |
| `market` | O passo do preço de cada recurso na virada do dia; nasce na primeira virada com o Mercado de pé | V3E-T1 |
| `expedition:<id>` | O nó de uma expedição: a sorte, quem sofre, a cobiça, o saque, o item e o Mestre; apagado na volta | V3D-T1 |
| `battle:<id>` | Sorte de 90 a 110 por ataque; criado e apagado no instante da batalha, nunca persistido | V4D-T1 |
| `caravan:<id>` | A emboscada de uma caravana sem escolta; nasce e é apagado no mesmo instante, e por isso nunca chega a ser gravado | V3E-T2 |

- Sortear em um fluxo não desloca os outros. O fluxo nasce na primeira vez em que é usado (semente por FNV-1a mais SplitMix32 sobre `seed:nome`). Os **fluxos de entidade** (`expedition:expedition-<n>`, `caravan:caravan-<n>`, `battle:battle-<n>`) têm o tipo igual à família e `n` de 1 ao contador de `state.ids`; a guarda de forma confere `rng` contra `ids`, exige que todo `expedition:<id>` seja de uma expedição em curso e todo `caravan:<id>`, de uma caravana na estrada.
- **Só `advanceTo` sorteia**, em instantes da linha do tempo, nunca em um comando, na visão, em `nextEventAt`, na criação ou na migração: consultar a tela a cada 30 segundos não rerrola nada, e um recibo reenviado nem chega ao motor. `purity.test.ts` barra a importação de `random.ts` nesses módulos. Uma ordem pode **criar** uma entidade, mas não sorteia: contratar na Taverna cria o herói de um candidato que a rotação já tinha sorteado, e enviar uma expedição dá o identificador e deixa a variante do grafo para um hash da semente.
- **Só se sorteia o que pode acontecer**: sem vaga, no piso de população, sem carta elegível, com uma incursão já marcada, o fluxo não anda.
- O estado do gerador é gravado com a partida e **nunca** sai no `ViewState`. A divisão de intervalo é provada com os sorteios de verdade no caminho (`economy.property.test.ts`, `council.property.test.ts`, `threat.raids.test.ts`, `tavern.property.test.ts`, `expeditions.property.test.ts`, `market.property.test.ts`, `market.caravans.property.test.ts`).
- Trocar o algoritmo é mudar uma regra: `RNG_VERSION`, vetores de referência em `random.test.ts` e um passo de migração.

A prévia usa geradores locais próprios, sem tocar `state.rng` ou `state.ids`; forja, treino, reparos, formação e sabotagem não têm fluxo novo. A sabotagem e a caçada usam o fluxo da expedição; campanha, incursão e onda usam o da batalha. Os efeitos de cartas reaproveitam `council`, `tavern` e `market`, sem sorteio na resposta do jogador.

### Identidades

`nextId(draft, tipo)` (`ids.ts`) devolve `<tipo>-<n>` de um contador em `state.ids` que só sobe: nunca relógio, UUID ou sorteio. Só uma ordem aceita e um evento da linha do tempo criam entidades. Os tipos: `hero` (criado só por `arrivals.ts`, a porta também do herói contratado), `offer` (o candidato da Taverna, só por `tavernTurn.ts`), `expedition` (só por `expeditionOrders.ts`), `item` (o item achado no fim de um nó, `expeditionTurn.ts`), `caravan` (só por `caravanOrders.ts`) `master` (só por `masterTurn.ts`; Mestre nenhum tem fluxo de sorteio), `formation` (em `formationOrders.ts`) e `battle` (em `battleTurn.ts`). Itens também podem nascer do efeito de carta em `councilWar.ts`. O objeto `ids` não sai na visão; os identificadores que a visão mostra deixam inferir quantos já foram criados, o que é inofensivo.

## 6. A linha do tempo e a ordem do mesmo instante

`advanceTo` anda trecho a trecho até o próximo evento de `nextEventAt` e aplica a produção contínua em cada trecho, com aritmética inteira (milésimos e frações `{ num, den }`). Os instantes da linha do tempo são: fim de obra, chegada de aldeão, virada de dia, fim de uma leva em adaptação ou de um Mestre, comida ou lenha acabando, ouro acabando com soldo a pagar, estoque enchendo, planejada automática juntando o custo, carta que expira, efeito escondido que acontece, continuação que chega, herói prometido que chega, incursão que chega, aviso da Torre para ela, troca dos candidatos da Taverna, fim de um nó de expedição, prazo de uma encruzilhada, chegada de uma caravana, aldeão ferido que sara e herói ferido que sara.

A invariante, testada por propriedade e sem tolerância, vale no estado, nos eventos e no gerador: `advanceTo(t2)` ≡ `advanceTo(t1)` seguido de `advanceTo(t2)`.

**Ordem fixa dentro do mesmo instante** (`processEventsAt`, em
[`advance.ts`](../packages/engine/src/advance.ts)). É a ordem do README do motor,
com os encaixes descritos nas seções da forja, do treino, da muralha, do Cerco e do
Lobo Branco; o código resolve o treino antes da recuperação dos aldeões feridos:

1. Fim do reparo normal da muralha, obras concluídas, fim da forja ou do reparo de item.
2. Recrutas que chegam, fim do treino, aldeões feridos que saram.
3. Mestres à porta que agora têm vaga; heróis feridos que saram.
4. Retirada dos efeitos de preço vencidos e expiração de destinos temporários.
5. Virada do dia (`processCalendar`): fecho do desperdício; **fecho anual
   `yearEnded` antes de `yearStarted`**; no ano novo, reinício do Conselho e da
   memória da Horda, restauração dos tiles e abertura da Reconstrução quando devida;
   estação e sua conta de frio; amanhecer; experiência do ofício; moral (colono,
   partida e deserção); soldo vencido; Mercado (preços e volume); sorteio do
   Conselho; Ameaça (inclui preparação da Horda e marcação do Cerco).
6. Mestres à porta novamente, ocupando a vaga deixada na virada.
7. Conselho fora do sorteio: expirações, efeitos escondidos e continuações.
8. Heróis prometidos que chegam; fim da adaptação de aldeões e Mestres.
9. Incursões: marcação do ensaio quando devida, aviso da Torre e batalha.
10. **Cerco**: a onda devida, seu resultado e a abertura da decisão seguinte;
    depois, dissolução de milícia vencida e fim da Reconstrução.
11. Taverna: fim do festival e rotação dos candidatos.
12. Expedições, na ordem do identificador: fim de nó, decisão por Postura e retorno.
    Dentro da prova, a ordem é sorte, vítima, cobiça, saque, item e Mestre elegível.
13. **Campanha ao Acampamento**: chegada, batalha ou retorno.
14. Caravanas, na ordem do identificador: venda e eventual emboscada; o fluxo sai por último.
15. Planejadas automáticas e objetivos, repetidos enquanto houver consequência.
16. Fome, frio e, por último, abertura/fecho do atraso do soldo.

Depois de tudo, `announceFilled` registra os depósitos cheios. A muralha reparada,
a obra e as armas prontas já contam para a batalha daquele instante. A tropa e os
heróis que voltam de expedição/campanha depois dela ainda estão fora na defesa.
Uma troca enviada no instante exato da onda chega depois do avanço e é recusada.
O saque e as caravanas ainda podem pagar uma planejada ou fechar o atraso no mesmo
instante. As provas estão distribuídas entre `advance.test.ts`, `smithy.test.ts`,
`army.test.ts`, `raids.property.test.ts`, `campaign.property.test.ts`,
`siege.timeline.test.ts` e `yearEnd.test.ts`; não há um cenário único com todos
os acontecimentos simultâneos.

**Repouso.** Depois de cada instante e de cada comando: nenhuma planejada automática pode começar, nenhum objetivo ativo está cumprido, a fome, o frio e o soldo em atraso não têm o que abrir ou fechar, nenhuma carta está vencida na mesa, nenhum aviso da Torre está por dar. Por isso `nextEventAt` é sempre depois de agora e nenhum instante é processado duas vezes. Um estado que chega fora do repouso (recém-migrado, ou com uma lista de objetivos que cresceu) é acomodado no instante em que está, **antes** de o tempo andar: `advanceWith` anuncia as incursões, ergue a lista da Taverna que falta, **recolhe a equipe cujo destino, trecho ou encruzilhada o conteúdo deixou de ter** (`recallStranded`, que a manda para casa com o que juntou), inicia as planejadas e acomoda os objetivos e a escassez. Todo encadeamento tem limite derivado de conteúdo finito (listas de planejadas e de objetivos, uma incursão marcada por vez, no máximo duas cartas na mesa).

**Previsões.** A visão anuncia prazos ("cheio em", "acaba em", a espera de uma planejada, a conta da lenha, a moral da próxima virada) andando uma cópia do estado só com a produção contínua, o ofício e a moral, **sem sortear nada**. A cópia que prevê a moral (`stateAtNextMoraleTurn`) deixa de fora as incursões marcadas (segredo até os vigias a verem), empurra a rotação da Taverna para nunca, anda sem as expedições em curso sem as caravanas na estrada, sem a campanha e sem o Cerco: a previsão não conta com a volta de um herói Devoto nem com o ouro de uma venda, e a visão nunca resolve um nó antes da hora. Um prazo anunciado é o de quem não é atacado no caminho.

## 7. Os relógios

Há três relógios, e cada um tem um dono.

**Tempo de jogo (motor).** Milissegundos inteiros desde o início da partida; o motor recebe o instante como argumento e não conhece o relógio do sistema. Todos os números do conteúdo estão no ritmo Normal do GDD: um dia do calendário são 2 horas de jogo (`calendar.dayMs`), o ano tem 84 dias (primavera, verão e outono de 24, inverno de 12). As constantes de prazo são tempo de jogo e escalam com o ritmo ([ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 1), **com as exceções que o conteúdo marca com `…RealMs`** ([ADR 0016](decisions/0016-respostas-do-autor-as-pendencias-da-v0.2.md)): o prazo de resposta de uma carta do Conselho (`council.expiryRealMs`, 24 h reais), a carência e o passo da deserção por fome (`morale.famineDesertionAfterRealMs` e `famineDesertionEveryRealMs`, 12 h e 2 h reais), a janela em que a fome que reabre é a mesma (`morale.famineResumeWithinRealMs`, 2 h reais) a antecedência do aviso da Torre de Vigia (`threat.watchtowerLevels[].warningRealMs`, 1 h e 2 h reais) os quatro prazos do soldo em atraso (`heroes.arrears`: `discontentAfterRealMs`, 12 h; `leaveAfterRealMs`, 24 h; `leaveEveryRealMs` e `resumeWithinRealMs`, 2 h reais; [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md), decisão 3) e a espera da encruzilhada de uma expedição (`expeditions.crossroadsWaitRealMs`, 12 h reais por resposta do autor de 2026-10-06, convertida quando a equipe chega ao nó; ADR 0017, decisão 1). Na v0.4, o intervalo entre ondas (`siege.waveIntervalRealMs`) também é **60 min reais**, convertido pelo ritmo ao encerrar a onda anterior. A janela da milícia é a antecedência real da Torre. **Os demais prazos são tempo de jogo** e escalam com o ritmo: o soldo, a duração dos nós, o ferimento, a rotação da Taverna, a viagem de uma caravana, a adaptação de um Mestre. O motor as converte em tempo de jogo com `state.settings.timeScale` (`realToGameMs`). Consequência: "as mesmas ordens dão o mesmo feudo em qualquer ritmo" vale até uma carta expirar, uma fome passar da carência, um soldo atrasar além da carência, uma encruzilhada esgotar a espera, os vigias darem um alarme ou uma onda seguinte chegar. A Vigília acrescenta a referência civil descrita na seção 19g.

**Tempo real (servidor).** O servidor é o único relógio (`ctx.clock()`, nunca `Date.now()` solto):

```
tempo de jogo = (agora − criação da partida) × time_scale
```

`games.time_scale` é gravado na criação e não muda: é o ritmo escolhido entre os oferecidos (3, 1 ou 0,5) ou, sem escolha, `GAME_TIME_SCALE` (padrão 3, de 0,5 a 10). O mesmo valor fica em `state.settings.timeScale`, e `loadGame` recusa a partida em que os dois divergem. O tempo de jogo nunca anda para trás. O avanço é **preguiçoso**: acontece nas leituras e nos comandos; um job avança e migra as partidas sem estado persistido há mais de uma hora; não há temporizador por partida em memória.

**Visão em tempo real (interface).** `deriveViewState(state, gameTimeMs, { timeScale })` entrega prazos em segundos reais (arredondados para cima; `depletesInSeconds` e `famine.secondsElapsed`, para baixo), taxas por hora real e textos de explicação já com esses números. O app não converte nada: do ritmo ele só recebe rótulos prontos (`settlement.paceLabel`) e, nas boas-vindas, as opções de `GET /catalog`. O que o app faz com o tempo:

- Ciclo de 30 s com a aba à vista (2 min em segundo plano): `GET /view` com ETag e `GET /events?after=`. A leitura seguinte vem antes quando um prazo da visão vence: uma obra, a espera de uma planejada, uma adaptação, uma carta, uma incursão e os da Guilda (o fim do nó, o prazo da encruzilhada, o ferido que sara, a chegada de uma caravana), a forja, o treino, o reparo e os prazos do Cerco (`nextPollMs`, `guildDeadlines` e `expeditionDeadlines`). Entre dois ciclos, as contagens regressivas andam no relógio do navegador.
- O Relatório de Retorno sai ao abrir a página depois de 4 horas reais sem leitura e, desde a v0.2, também na volta de uma aba que ficou **fora de vista** por 4 horas ou mais (a ausência vai para o cache, porque o navegador pode descartar a aba).
- Os limiares de apresentação são de tempo real e ficam no app, sem número de regra: "cheio em" com alerta abaixo de 8 h, "Antes de partir" olhando 24 h, o aviso de estação uma hora antes, o lembrete "Proteja seu reino" 48 horas depois da primeira vez no navegador.

No ritmo Rápido, um dia de jogo dura 40 minutos reais, uma estação de 24 dias, 16 horas, e o ano, 56 horas. Os testes de integração e em navegador rodam com `GAME_TIME_SCALE=1`, porque foram escritos nos tempos do GDD; o ritmo 3 tem testes próprios no motor, no servidor (`pace.test.ts`) e quatro cenários em navegador ("no ritmo da produção").

## 8. O Conselho

O motor do Conselho fica em `council.ts` (o que não sorteia), `councilTurn.ts` (o sorteio) e `councilView.ts` (a visão); as cartas, em `packages/content/src/cards/` ([README do motor](../packages/engine/README.md), "Conselho do Feudo"; [ADR 0014](decisions/0014-conselho-e-ameaca-na-v0.2.md)).

- **Cadência ancorada.** Uma audiência a cada 4 dias de jogo, sempre em uma virada de dia; quando o instante chega, a próxima anda um intervalo, haja carta ou não. No máximo 2 cartas na mesa: com a mesa cheia, o sorteio daquele instante é pulado. A continuação de uma cadeia tem prioridade sobre o sorteio, e chega no primeiro lugar que se abrir.
- **Expiração** em 24 h reais: o conselho aplica a opção marcada para a dificuldade (`autoResolve`), que nunca tem custo, ou, se a carta marca `autoResolveIfUnlocked` e o feudo já tem o que ela exige, essa opção.
- **Resposta** é o comando `answerCard { instanceId, optionId }`, pelo mesmo recibo transacional de toda ordem: duplo clique, duas abas e resposta atrasada não pagam nem recompensam duas vezes. Não sorteia nada.
- **Efeito escondido** só existe em `council.delayed` até a virada marcada, quando vira evento (`cardEffectApplied`). Antes disso não sai na resposta, na visão nem na previsão da moral.
- **Privacidade narrativa.** Flags, efeitos escondidos, continuações agendadas e o gerador nunca saem do servidor; o nome de uma flag não é texto de interface. O teste do pacote do app procura, pelo nome, que nada disso chegue ao navegador.
- **Ids fixos.** Uma carta que o catálogo já não tem sai calada e não ocupa lugar; por isso os ids de carta e de opção publicados são fixados em `packages/content/src/council.test.ts`, e mudar um deles pede um passo de migração.
- **A carta roteirizada** (v0.3, `scripted: { atGameDay: 13 }`; seção 12): a "Estrangeira ferida" sai no sorteio da audiência, na frente das sorteadas, uma vez por partida, e pede lugar na mesa sem reservá-lo.
- **"Sua escolha voltou."** O evento da continuação leva a escolha anterior (`previousCardId`, `previousOptionId`, `previousInstanceId`); o servidor escreve, no Markdown da Crônica, a nota que a cita (`games/chronicleMarkdown.ts`), e a aba Crônica leva o foco à linha citada.

- **Lotes 2 e 3 na v0.4.** A herança de 22 cartas da v0.3 foi ampliada para 59 nesta base, incluindo os ganchos de Mestre, Mercado, encontros, guerra e Lobo Branco (seção 19l). O alvo de 60 do roadmap ainda não é a contagem do catálogo.
## 9. A Ameaça e as incursões

As regras ficam em `threat.ts`, `hordeTurn.ts` (o sorteio) e `raids.ts` (roteiro, aviso, resolução e feridos, com a batalha delegada a `battleTurn.ts`); os números em `balance.threat` e `balance.raids`, e os tiles em `tiles.ts` (GDD §8.2 e §12.3; ADR 0014, decisões 10, 11 e 20).

- **Tiles abstratos.** O Covil de Lobos é um tile sem mapa (`map.tiles`); o mapa gráfico é da v0.5. A Ameaça (`map.threat`) sobe na virada do dia com os tiles ativos e com o outono, e cai a cada incursão, repelida ou sofrida.
- **A névoa é aplicada no servidor.** `ViewState.threat` é uma união fechada: sem a Torre de Vigia (`known: false`) só saem a frase, a Torre e a defesa; o número, a tendência, os tiles e as incursões marcadas não saem, e o schema do protocolo recusa o resto. Os eventos só levam a Ameaça para quem tem a Torre. Testes conferem que dois feudos iguais, um com a Ameaça em zero e outro com uma incursão à porta, têm a mesma visão sem a Torre.
- **Incursões marcadas** (`horde.scheduledRaids`, no máximo uma por vez): a do roteiro do ano 1 nasce com a partida (os uivos no 10º dia, os lobos no 16º); as outras são sorteadas pela Ameaça na virada do dia e chegam em outra virada. O sorteio não vira evento nem linha: a incursão só aparece quando os vigias a avistam e, sem Torre, quando chega.
- **Torre até o nível 5 e Paliçada até o 6.** A Torre informa tamanho/composição conforme o nível, dispara em batalha e clareia presságios. A Paliçada tem vida por ala e reparo. `palisadeAgainst` ainda limita as perdas econômicas da incursão; a batalha e os níveis novos estão nas seções 19d e 19e.
- **O Covil de Lobos limpo** (v0.3, seção 14): uma expedição ao Covil bem-sucedida desliga o tile e tira 30 da Ameaça (`threat.tileClearedDrop`); os lobos voltam na virada do ano (`restoreTiles`, antes de a Ameaça subir). Na v0.3, com o Covil limpo a Ameaça só subia no outono; na v0.4, o Acampamento ativo também contribui e permite incursões. O outono continua tendo lobos mesmo com o Covil limpo: os lobos descem a serra (`threat.seasonEnemy`, `raidingEnemy`; regra confirmada pelo autor em 2026-10-06, "Manter os lobos do outono").
- **Feridos** não trabalham por um dia de jogo, continuam comendo e voltam sozinhos ao edifício de onde saíram; ninguém parte por causa dos lobos.

O comportamento medido em 2026-10-02 (a Ameaça sobe até perto do máximo e fica lá, e quase toda incursão sorteada é média) está em [balance-v0.2.md](balance-v0.2.md), seção 14.4, e é o que o balanceamento de fechamento (V2F-T1) está revendo.

## 10. O catálogo, o protocolo e o 426

**`GET /v1/catalog`** (V2B-T3; GDD §14.5) traz as opções de nova partida: dificuldades e ritmos com os textos do conteúdo e os padrões (`defaults`). Não tem autenticação, é montado uma vez no arranque e tem ETag fraco (SHA-256 do corpo). Os fatores de regra de cada dificuldade **não** saem: o app mostra a frase, quem aplica o fator é o motor. O catálogo só traz isso; o resto do que o app exibe vem no `ViewState`. `POST /games` aceita `difficulty` e `timeScale`; quem confere o ritmo contra os oferecidos é o servidor (`OfferedGameRequestSchema`), e não o protocolo, porque ler `balance` no protocolo levaria a tabela de números ao navegador.

**O `ViewState` cresce por adição, e adição não sobe o protocolo.** Foi assim com quase toda a v0.3: os heróis, a Taverna, os desfechos, o Mercado, as caravanas e os Mestres entraram como campos novos (`guild`, `tavern`, `market`, `masters`, `mastersWaiting`, `population.masters`, `workers[].master`) e como comandos novos, sem que o app anterior deixasse de ler o que já lia. `Command`, `ViewState` e os códigos de recusa têm teste de igualdade de tipos com os do motor.

**Protocolo 2** (V2D-T1). Com o Conselho, `pendingDecisions` deixou de ser sempre vazio e passou a trazer cartas que o app do protocolo 1 não sabe ler. `PROTOCOL_VERSION` passou a 2, o SDK manda `X-Lords-Protocol` em toda chamada e o servidor responde `426 UPGRADE_REQUIRED` ("Há uma versão nova do jogo. Recarregue a página.") a quem manda outro número. Quem não manda o cabeçalho (o monitor de saúde, um `curl`) é atendido. As rotas continuam em `/v1`: o GDD dizia que mudanças incompatíveis iriam para `/v2` (pendência B-9).

**Protocolo 3** (V3D-T1; [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md), decisão 11). `pendingDecisions` é uma união **fechada** por `kind`: no protocolo 2 só havia `card`, e um teste recusava qualquer outro tipo. Com as expedições, a equipe parada em uma encruzilhada entra na lista (`kind: 'crossroads'`, com o identificador da expedição, o título e o prazo real), e o app do protocolo 2 recusaria a visão inteira ao ver uma. Naquela entrega `PROTOCOL_VERSION` passou a 3, e o cliente anterior recebe o mesmo `426`, em leitura e em ordem, sem que nenhum recibo seja gravado nem reescrito (`packages/server/test/expeditions.test.ts`). `packages/server/src/plugins/errors.ts` não mudou: já comparava `X-Lords-Protocol` com o número. A v0.3 foi publicada com esse protocolo.

**Protocolo 4** (V4G-T2). A decisão entre ondas acrescenta `kind: 'siegeWave'` à união fechada. O cliente do protocolo 3 recebe `426`; o cache antigo é descartado e o cursor de eventos fica. As rotas continuam em `/v1`, e os recibos antigos continuam intactos (`packages/server/test/siege.test.ts`).

**Crônica.** `chronicleRows` filtra `CHRONICLE_HIDDEN_EVENT_TYPES` (`dayStarted`, `storageWasted`, `expeditionNodeResolved` e `battleSimulated`, em `@lotg/protocol`) em `GET /chronicle` e em `/chronicle.md`: sem viradas de dia, sem o fecho do desperdício e sem o nó de expedição que deu certo; o que terminou em Revés ou Desastre sai como `expeditionNodeFailed`. `GET /events` traz tudo. `GET /chronicle.md?links=1` marca cada linha de expedição com o identificador dela (`chronicleLink.ts`), para o app ligar a linha ao relatório pela marca; sem `links` o documento sai limpo.

**Ordem de implantação.** O job `deploy` implanta a API antes do app, então por alguns segundos uma aba antiga fala com a API nova: ela recebe o `426` e o aviso de recarregar. O cache do app tem a marca da versão (`CACHE_VERSION`: protocolo e formato da visão); o de outra versão é descartado, e a primeira volta depois de uma atualização sai sem a comparação dos estoques (pendência B-11). Um campo do `ViewState` que mantém o nome e passa a dizer outra coisa pede subir `VIEW_FORMAT`.

## 11. O caminho de um comando

`POST /v1/games/:id/commands` com `{ commandId, type, payload }`. Tudo acontece em uma transação (`packages/server/src/games/commands.ts`):

```mermaid
sequenceDiagram
    participant App as App web
    participant API as API
    participant Eng as Motor
    participant DB as PostgreSQL

    App->>API: POST /commands { commandId, type, payload }
    API->>API: X-Lords-Protocol diferente? 426
    API->>DB: autentica (conta e sessão, sem cache)
    API->>DB: lockGame (SELECT … FOR UPDATE, filtrado pela conta)
    API->>Eng: migrateState (estado gravado → versão atual)
    API->>DB: busca recibo por (game_id, commandId)
    alt recibo existe, mesmo conteúdo
        API-->>App: status e corpo originais + X-Lords-Replayed
    else recibo existe, conteúdo diferente
        API-->>App: 409 COMMAND_ID_CONFLICT
    else comando novo
        API->>Eng: advanceTo(estado, agora em tempo de jogo)
        API->>Eng: applyCommand(estado avançado, comando)
        API->>DB: persistState (estado inteiro, migração incluída, eventos, state_version + 1) e recibo
        alt aceito
            API-->>App: 200 { view, events, stateVersion }
        else recusado pelo motor
            Note over API,DB: o avanço e o recibo são gravados; a ação não tem efeito
            API-->>App: 422 GAME_RULE, com o estado avançado em details
        end
    end
```

Pontos que sustentam o contrato ([ADR 0004](decisions/0004-comandos-e-cache-http.md)):

- O recibo guarda o hash do pedido, o status e o corpo completo da resposta, enquanto a partida existir. Um reenvio nunca reaplica a ordem, nem depois de um reinício do servidor, nem depois de uma migração: devolve o corpo da época e não migra nem grava nada.
- Uma recusa faz commit antes do 422: o desfecho sai da transação como valor e o erro é lançado depois. Uma falha inesperada desfaz tudo, migração incluída.
- No app, uma ordem nasce em `controller.prepare`, que fixa o `commandId`; "Tentar de novo" reenvia a mesma ordem com o mesmo identificador. Ordens nunca ficam em fila local.
- As ordens das obras levam `targetLevel` opcional (o nível que a tela mostrava): duas abas com a visão atrasada não pagam um nível que ninguém pediu (`STALE_LEVEL`).
- As leituras (`GET /view`, `/events`, `/chronicle`) passam pelo mesmo lock e avançam o mundo, mas só escrevem no banco se o avanço produziu eventos ou se o estado acabou de ser migrado.


## 12. Heróis, soldo e a carta roteirizada

A primeira metade da v0.3 (Fases B e C). O detalhe está no [README do motor](../packages/engine/README.md), "Heróis e soldo" e "A carta roteirizada"; as medições, em [balance-v0.3.md](balance-v0.3.md), seções 3 a 5.

**Estado.** `state.guild` com `heroes` (teto `balance.heroes.rosterCap`, que conta os cativos; o limite de **contratação** é `1 + nível da Taverna` e não os conta), `arriving` (os heróis com nome que uma carta prometeu), `wageArrears` e `lastWageArrears` (no molde de `famine` e `lastFamine`). Atributos, poder, limite de heróis, soldo e preço exibido são **derivados, nunca gravados**. Um herói tem `status`: `idle` (no feudo), `expedition`, `injured`, `captured` ou `escort`.

| Peça | Onde | O que faz |
|---|---|---|
| Soldo | `economy.ts` (`netRates`, `goldCoversWages`), `wages.ts`; conteúdo `balance.heroes.wagePerHourByLevel` | Consumo contínuo de ouro, em tempo de jogo, **cresce com o nível do herói** (2, 3, 4, 6, 8, 10, 12, 15, 18 e 20 por hora; resposta do autor de 2026-10-07). Derivado do nível, nunca gravado. A visão diz o soldo do nível seguinte (`wageNextLevelPerHour`, `wageNextLevelText`) |
| Atraso | `scarcity.ts` (`settleScarcity`), `wages.ts` (`turnWages`) | O atraso abre no instante em que o ouro acaba com soldo a pagar e fecha quando o saldo deixa de ser negativo: é o último passo da ordem do instante. As consequências (Descontente com 12 h reais, um herói a cada 2 h reais depois das 24 h, o Leal nunca) são cobradas **na virada do dia**, logo depois da deserção por fome |
| O que venceu é cobrado | `wageLedgerAt` (`wages.ts`), `famineLedgerAt` (`famine.ts`) | A virada que encontra o atraso (ou a fome) fechado **há menos de 2 h reais** ainda cobra o que a duração já devia. Vale para o soldo e para a deserção por fome da v0.2; confirmado pelo autor em 2026-10-06 |
| Quem volta devendo | `wages.ts` (`chargeReturned`, `servingSinceMs`), `freedAtMs` | O herói devido que volta de escolta ou de expedição é cobrado na volta; o resgatado não volta devendo o atraso do soldo (os prazos dele contam do maior entre a chegada e a volta) |
| Heróis que chegam | `arrivals.ts` (`promiseHero`, `settleHeroArrivals`, `admitHero`), `heroes.ts` | O único lugar que cria herói. A chegada é um instante da linha do tempo; o teto da lista (`rosterCap`) faz a recompensa esperar, nunca se perder |
| A carta roteirizada | `councilTurn.ts`; conteúdo em `cards/scripted.ts` | "Estrangeira ferida", no 13º dia de jogo (`atGameDay` é um piso: a partida que já passou do dia a recebe na primeira audiência com lugar, sem passo de migração), na frente das sorteadas, uma vez por partida. Entrega o primeiro herói a toda partida (Edda ou Rolf). O texto é rascunho |
| Dispensa | `wages.ts` (`dismissHero`) | Sempre confirma, com `guild.dismissText`. Aceita quem está em cativeiro (o que ele levava se perde; com um Resgate a caminho, espera) |
| Visão | `guildView.ts` | `guild` com os heróis (poder explicado), os prometidos, o soldo (`coveredForSeconds`, `afterArrivals`, `arrears`, `lingering`) e as frases `text` e `dismissText`. Prazos em segundos reais |

Os **oito traços** de herói têm efeito: Ganancioso, Prudente, Corajoso e Rastreador atuam nas expedições (seção 14); os da moral (`devout`, entre outros) entram na conta da moral. As recusas de herói e de Taverna são do motor (`HERO_NOT_FOUND`, `HERO_LIMIT`, `HERO_BUSY`, `HERO_UNAVAILABLE`).

## 13. A Taverna

`tavern.ts` (as contas), `tavernTurn.ts` (a rotação e o fim do festival: o único que sorteia e cria `offer-<n>`), `tavernOrders.ts` (`hireHero`, `holdFestival`: não sorteiam) e `tavernView.ts`. O edifício `tavern` pede o Salão no nível 3 e vai até o nível 5.

- **Rotação ancorada na inauguração**, de 12 em 12 dias de jogo, com instante próprio em `nextEventAt` (quase nunca é virada de dia). O sorteio é sem reposição dentro de uma lista e não repete o nome de quem já serve; o número de candidatos é o do nível **no instante da troca**; no instante da troca ela resolve antes da ordem daquele instante (`OFFER_GONE`). Os ids dos modelos de candidato (`TAVERN_CANDIDATE_IDS`) ficam gravados no estado (`guild.tavernOffers[].templateId`), e a ordem deles e a dos nomes (`heroNames`) fazem parte do sorteio.
- **Festival**: um efeito temporário de moral (`id: 'festival'`), um por estação, que acaba em uma virada de dia, sem instante próprio. A moral ganhou os termos `tavern` e `devout`.
- **Contratação** (`hireHero`) cria o herói de um candidato que a rotação já sorteou; recusas `TAVERN_REQUIRED`, `OFFER_GONE`, `HERO_LIMIT`, `FESTIVAL_ALREADY_HELD`, `INSUFFICIENT_RESOURCES`.
- **Visão**: `tavern`, sempre presente. Da Taverna só saem os candidatos desta rotação; o modelo, os da próxima e o fluxo `tavern` nunca.

## 14. A Guilda dos Aventureiros e as expedições

O núcleo da v0.3 (Fase D). O detalhe está no [README do motor](../packages/engine/README.md), "Expedições", "Desfechos", "O relatório nó a nó" e "Uma expedição nova"; as fichas de conteúdo, em [content-v0.3.md](content-v0.3.md), seção 6; a calibragem e as medições, em [balance-v0.3.md](balance-v0.3.md), seções 6 a 10.

**O edifício e a equipe.** `settlement.buildings.guild` pede o Salão no nível 3 e vai até o nível 4; sustenta 1, 2, 2 e 3 expedições ao mesmo tempo. `sendExpedition` (cria a expedição com `nextId`; **não sorteia**: a variante do grafo vem de um hash da semente e do modelo mais o número de envios, `hash.ts`) e `chooseExpeditionPath` são as duas ordens. Uma expedição é um percurso por **eventos da linha do tempo**: o fim de cada nó e o prazo de cada encruzilhada são candidatos de `nextEventAt`, processados por `settleExpeditions` (seção 6, item 12).

**O catálogo.** Seis modelos em três variantes cada (dezoito grafos acíclicos de nós): Patrulha dos Arredores, Floresta Antiga, Covil de Lobos, Resgate, Ruínas de Vel'Thar e Pântano Nebuloso (este pede a Guilda no nível 3 e um Mago). Todos têm encruzilhada, menos a Patrulha. Os destinos aparecem por descoberta (`map.discovered`, e `access` em cada modelo). Cada prova diz a dificuldade, os pesos de atributo, a classe que favorece (`trial.helps`) e a lição (`trial.lesson`); uma opção de encruzilhada pode pedir uma classe ou um traço. **Os ids de modelo, de nó e de opção são fixados em teste** (`STABLE_IDS`, em `expeditions.test.ts`): uma expedição em curso guarda `modelId`, `variant` (a posição na lista), `nodeId` e o `optionId` de cada escolha. Acrescentar é livre; mudar um pede passo de migração.

**Resolução de um nó** (`expeditions.ts`, `expeditionTurn.ts` `resolveStage`): o poder da equipe com os pesos de atributo do nó, a sorte de 85 a 115 (sorteada no fluxo da expedição) e o desfecho por multiplicação cruzada, em inteiros, com os quatro resultados (Sucesso Pleno, Sucesso, Revés e Desastre). **Encruzilhada**: a equipe para e espera 12 h reais; sem resposta, vale a opção que o conteúdo marca para a **Postura** da expedição (Cautelosa, Equilibrada ou Ousada; `cautious`, `balanced`, `bold`), e se a equipe não pode tomá-la, a da Cautelosa.

**Desfechos** (`outcomes.ts`; não sorteia nem dá identificador):

- **Ferimento**: o Revés fere de leve (2 h de jogo) e o Desastre, de forma grave (12 h). Quem sofre é sorteado no fluxo da expedição. O ferido termina a jornada e fica `injured` no feudo até `injury.untilMs`, instante da linha do tempo (`heroRecovered`).
- **Captura e morte**, onde o nó marca captura, pela dificuldade (`balance.difficulties[].heroCapture`): ferimento grave em Camponês, captura em Senhor, **morte em Rei de Ferro**. O cativo não recebe soldo, **não ocupa lugar no limite de heróis** e só volta com o **Resgate** (uma expedição ao destino de resgate, que devolve quem está lá há mais tempo; um Resgate por cativo). A equipe inteira capturada ou morta termina a expedição e perde o saque.
- **Experiência** (`grantXp`): cada prova dá experiência a quem continua na equipe, com níveis até o 10 (`heroLeveledUp`).
- **Equipamento** (`equipment.ts`): três espaços e quatro raridades (`items.ts`); o item nasce com `nextId(draft, 'item')` no fim de um nó ou por carta, vai para o arsenal (`guild.inventory`, teto de 30; o que não cabe vira ouro) e entra no poder como fator. `equipItem` e `unequipItem` não sorteiam. Desgaste e reparo existem na v0.4 (seção 19b); venda voluntária não existe.
- **O Covil de Lobos limpo** desliga o tile e tira 30 da Ameaça (seção 9). Uma equipe por vez em um tile de ameaça.

**Relatório nó a nó** (`expeditionReport.ts`; não sorteia): cada registro do percurso guarda quem se destacou e o que o desfecho ruim ensina (`log[].standout`, `log[].lesson`), escolhidos sem sorteio na resolução; a frase da Crônica e a do relatório são a mesma. O relatório fecha com o caminho de volta, `lossesText` e `deedsText`; os três últimos ficam guardados (`guild.reports`).

**Névoa.** De uma expedição só sai o que a equipe já alcançou e, antes do envio, o primeiro trecho, até a primeira encruzilhada. A dificuldade e o conteúdo dos nós além de uma encruzilhada não decidida, para onde cada opção leva, a variante do grafo, a chave de um nó, a sorte e o fluxo **nunca** saem (`expeditions.test.ts` prova que duas expedições iguais até a encruzilhada dão a mesma visão). O destino por revelar e o Resgate sem cativo não aparecem.

**Visão e servidor.** `expeditionsView.ts` e `guildView.ts`: `guild.built`, `level`, `slots`, `postures`, `equipmentSlots`, `available` (com `fit`, `heroFit`, `eligibleHeroIds`, `canSend`, `suggestedTeam`, `sendBlockedReason`, `rescue`), `expeditions`, `reports` e `inventory`; em cada herói `statusText`, `canDepart`, `injury`, `captive`, `equipment`, `canDismiss` e `nextRescued`. A encruzilhada entra em `pendingDecisions`. Sem rota nova: as ordens passam pelo caminho de todo comando (seção 11). Recusas: `GUILD_REQUIRED`, `EXPEDITION_LIMIT`, `EXPEDITION_LOCKED`, `TEAM_INVALID`, `EXPEDITION_NOT_WAITING`, `CROSSROADS_DECIDED`, `ITEM_NOT_FOUND`, `WRONG_SLOT`, `INVENTORY_FULL`.

**Simulador.** O `explorador` ergue a Guilda, envia a expedição de maior recompensa que a equipe passa com folga (pela régua `fit` da visão), equipa o melhor item, não envia ferido e responde à encruzilhada pela Postura (deixa metade delas); o `ousado` arrisca mais.

## 15. O Mercado

`market.ts` (as contas), `marketTurn.ts` (`turnMarket`), `marketOrders.ts` (`trade`) e `marketView.ts`; conteúdo em `balance.market`. Detalhe no [README do motor](../packages/engine/README.md), "Mercado"; medição em [balance-v0.3.md](balance-v0.3.md), seção 11.

- **Edifício** `market`: pede o Salão no nível 3; vai até o nível 5.
- **Estado**: `state.market` com `prices` e `previousPrices` (milésimos de ouro por unidade), `quoteDay` e `tradedToday`. Os preços entram na base na migração e **só andam depois que o Mercado existe**.
- **O preço anda na virada de cada dia de jogo**, com o Mercado de pé: um sorteio por recurso no fluxo `market`, passo de ±5% com volta de um décimo à base, em uma conta com um arredondamento; a comida custa × 13/10 no outono e no inverno, sobre o preço negociado. A venda é a 17/20 da compra. `turnMarket` não acrescenta instante à linha do tempo: a virada do dia já era um.
- **Volume diário** de `200 × nível` por recurso, somando compra e venda.
- **A ordem `trade { resource, direction, amount, quoteDay }`** não sorteia. Recusas, na ordem: `MARKET_REQUIRED`, `INVALID_AMOUNT`, `PRICE_CHANGED` (o dia virou entre a tela e a ordem), `DAILY_VOLUME_EXCEEDED`, `INSUFFICIENT_RESOURCES`, `STORAGE_FULL` (a compra que não cabe é recusada inteira). O preço da unidade é arredondado a favor da casa (compra para cima, venda para baixo), por unidade.
- **Nenhuma sequência de compra e venda no mesmo dia dá lucro** (critério 4 do GDD §16.2): provado por propriedade em `market.property.test.ts`. Comprar no fim do verão e vender no outono dá lucro, e é intencional.
- **Crônica**: `marketTraded` (com os totais `spent_`/`gained_`) e `marketPriceSwing`, só quando o preço cruza 85% ou 115% da base (2,2 linhas por ano de jogo na medição; eram 80% e 125% até a revisão da Fase E).
- **Visão**: `market`, sempre presente; com o Mercado, um preço por recurso (`buy`, `sell`, `trend`, `breakdown`, `remainingToday`, `maxBuyable`, `maxSellable`, `surplusSellable`, `reserve`, `surplusText`). **Névoa:** nunca o preço de amanhã, o de ontem nem o fluxo.

## 16. As caravanas

`caravans.ts` (as contas, só leem o estado), `caravanOrders.ts` (`sendCaravan`), `caravanTurn.ts` (`settleCaravans`) e `caravansView.ts`, dentro de `market`. Detalhe no README do motor, "Caravanas"; medição em [balance-v0.3.md](balance-v0.3.md), seção 12.

- **Estado**: `market.caravans` (`id` de `nextId`, `resource`, `amount`, `unitPrice` **fixado no envio**, `arrivesAtMs`, `escortHeroId`), em ordem de identificador, com teto igual aos lugares do Mercado. **Não há campo de desfecho**: o desfecho não existe antes da chegada (teste de névoa em `market.caravans.test.ts`).
- **Envio**: Mercado no nível 2; até 300 unidades de um recurso; 4 h de jogo de viagem; um lugar na estrada (dois a partir do Mercado nível 4). O preço fixado é o de venda de agora × 23/20 (**a caravana paga 15% sobre o balcão**, resposta do autor de 2026-10-07; o schema recusa a combinação em que comprar para revender dê lucro). A ordem leva o `quoteDay`, tira a carga do estoque, não conta no volume do dia, **dá o identificador e não sorteia**. Recusas: `MARKET_LEVEL_REQUIRED`, `CARAVAN_LIMIT`, `INVALID_AMOUNT`, `INSUFFICIENT_RESOURCES`, `HERO_NOT_FOUND`, `HERO_UNAVAILABLE`, `PRICE_CHANGED`.
- **Chegada**: instante da linha do tempo (seção 6, item 14). Com escolta não há sorteio; sem escolta, um sorteio no fluxo `caravan:<id>`, com a chance `máx(2, 10 − 5 × nível da Torre)` por cento e a Torre do instante da chegada; a emboscada leva metade da carga, arredondada para baixo. Eventos `caravanSent`, `caravanArrived`, `caravanAmbushed` (este com `lost_<recurso>` e `ambushed_<recurso>`).
- **Quem escolta** está fora do feudo, como quem está em expedição: recebe soldo, não parte, não é dispensado nem equipado, e, no soldo em atraso, só parte depois de voltar.
- **Critério 5 do GDD §16.2**: provado por cenário de semente fixa e pela matriz QA-10, com 1.000 sementes por célula: nenhuma emboscada com escolta; sem escolta, 116, 50 e 24 com a Torre nos níveis 0, 1 e 2.
- **Visão**: `market.caravans` e `market.caravanOffer` (o risco explicado termo a termo, `eligibleEscortIds`, o excedente enviável).

## 17. Os Mestres

`masters.ts` (as contas), `masterTurn.ts` (`deliverMaster`, `settleMasterArrivals`), `masterOrders.ts` (`assignMaster`) e `mastersView.ts`. Detalhe no README do motor, "Mestres"; medição em [balance-v0.3.md](balance-v0.3.md), seção 13.

**O desenho, em uma frase: o Mestre é um habitante que não é aldeão.** `population.villagers` continua contando só os aldeões; o Mestre mora em `settlement.masters`. As contas de habitante (vaga nas casas, comida, lenha, casas cheias, piso de população) somam os dois (`inhabitants`); as de aldeão (ofício, adaptação por coortes, quem parte, deserta ou se fere) não sabem que ele existe. **É isso que garante, por construção, que nenhuma regra de perda o alcança.** No edifício ele é um braço a mais, fora de `settlement.workers` e das coortes (`handsAt`, `armsOf`), e conta para a experiência do ofício. O piso de população protege 3 aldeões, com quantos Mestres houver.

- **Conteúdo**: `balance.masters` (+15%, em fração 3/20; um por edifício; adaptação de um dia de jogo; teto de quatro); quatro Mestres com nome (Odo, Berta, Gil e Ximena; ids fixados em `masters.test.ts`; o ofício de origem é só narrativa).
- **Origem**: a recompensa de expedição `master` (Odo nos guardiões das Ruínas de Vel'Thar, 1 em 4; Berta nos chefes do Pântano Nebuloso, 1 em 3; no último nó com prova, depois do item). Gil e Ximena chegam pelas cartas dos Refugiados do lote 2, integrado na v0.4; todos passam por `deliverMaster`.
- **Chegada**: `deliverMaster` é o único ponto que cria um Mestre. Com vaga entra na hora, sem edifício; sem vaga espera à porta, sem morar nem comer, e entra junto dos aldeões que chegam e de novo logo depois da virada do dia (seção 6, itens 3 e 6).
- **A ordem `assignMaster { masterId, building }`** (`null` o deixa sem edifício) não sorteia nem cria entidade. **A primeira alocação é imediata** (`worked`, estado 24); chegar a um edifício depois de já ter trabalhado custa a adaptação (meio braço, sem bônus, por um dia de jogo; o fim é um instante da linha do tempo). Recusas: `MASTER_NOT_FOUND`, `MASTER_WAITING`, `BUILDING_HAS_MASTER`, `NOT_A_PRODUCTION_BUILDING`.
- **Produção**: o fator `master` (23/20) entra em `productionFactors`, com o termo na explicação ("× 1,15 (Mestre Odo)").
- **Visão**: `masters[]` com `options[]` (o que cada edifício renderia a mais, durante a adaptação e depois dela), `mastersWaiting`, `workers[].master`, `population.masters`, `firstAssignment` e `assignText`.

## 18. Os objetivos 11 a 16

Os objetivos (`packages/content/src/objectives.ts`, `objectives.ts` e `objectivesView.ts` do motor) são uma lista; a v0.3 acrescentou seis ao fim dos dez da v0.2 ([ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md), decisão 20). Cada um aparece quando a ferramenta nova resolve um problema já sentido. A v0.4 acrescentou os cinco de guerra (V4H-T3), com o mesmo limite de três ativos e sem mudar a forma do estado 34; os detalhes estão no README do motor, “Objetivos 17 a 21”, e nas pendências H-1 a H-3.

| # | Objetivo | Condição | Recompensa |
|---|---|---|---|
| 11 | Acolha ou contrate o primeiro herói | `heroCount` | Lança de caça (item) |
| 12 | Erga a Guilda dos Aventureiros | `buildingLevel` guild 1 | 60 de pedra |
| 13 | Envie uma Patrulha | `expeditionSent` patrol | 50 de ouro |
| 14 | Venda no Mercado o que iria para o chão | `tradeDone` sell | 40 de madeira |
| 15 | Escolha um caminho em uma encruzilhada | `crossroadsChosen` | Moral (+10 por 1 dia) |
| 16 | Explore as Ruínas de Vel'Thar | `expeditionCompleted` ruins | Arco de freixo (item) |

Os contadores novos vivem no estado (por exemplo `expeditionsReturned:<modelo>`). A lista crescer não muda a forma do estado: a partida que já tinha cumprido todos recebe os novos na fronteira (seção 6). Duas pendências abertas: o objetivo 12 manda erguer a Guilda mesmo a quem não vai enviar expedição (F-1), e a partida migrada não conta as Ruínas que já concluiu (F-5; hoje não alcança ninguém).

## 19. A Guilda no app

O [README do app](../packages/web/README.md) descreve a estrutura. O que a v0.3 acrescentou, sem mudar a regra de que o app só exibe o `ViewState`:

- **Abas fixas** `#/guilda` (heróis, soldo, atraso, Taverna, expedições, relatórios, arsenal) e `#/mercado` (a tabela de preços, a negociação e as caravanas), com linhas na árvore ("Guilda · 3 heróis · 1 expedição na encruzilhada") e o selo do Feudo. A barra de status põe o soldo em atraso junto da fome e do frio, e a encruzilhada conta como decisão pendente.
- **Um caminho só de comando.** Painel, árvore e paleta chamam `controller.runCommand('lords.…')`: `hireHero`, `dismissHero`, `holdFestival`, `sendExpedition`, `chooseExpeditionPath`, `equipItem`, `unequipItem`, `trade`, `sendCaravan`, `assignMaster`, `openMarket`. Terminam em `controller.guildOrder` (com `prepare`, o `commandId` fixo e a trava por alvo: `send:<destino>`, `path:<expedição>`, `equipment:<herói>`, `trade:<recurso>`, `caravan:<recurso>`, `master:<id>`). Na paleta cada fluxo roda **um por vez por alvo** e relê a conta e a visão depois de cada diálogo.
- **Negociar e mandar a caravana têm duas etapas**: "Revisar" mostra o total e "Confirmar" manda a ordem com o `quoteDay` da visão que o jogador conferiu. Se o dia virar com a conferência aberta, a tela mostra o preço novo ao lado do conferido e pede a conferência de novo; `PRICE_CHANGED` do servidor fecha a conferência com a visão nova; nada é reenviado sozinho. O total é `quantidade × preço de hoje` (`ui/market.ts`, amarrada ao motor por `ui/market.test.ts`).
- **O Relatório de Retorno** (`game/returnReport.ts`) trata a Guilda: a volta, o resgatado, o que sarou, o nível novo, o item achado e o item vendido por falta de lugar, o destino revelado, o Covil limpo, a caravana que chegou e o Mestre que chegou em "O feudo prosperou"; quem se feriu, foi capturado ou morreu, a equipe que não voltou, o lugar limpo que voltou a ser ocupado, o soldo em atraso e a emboscada em "O que exigiu um preço"; a encruzilhada no topo de "Você ainda pode decidir". O saque, a venda e o ouro da caravana são "Recebido", nunca "Produção"; a emboscada traz `lost_<recurso>`, que **não** é corte de depósito (`cutBy` a exclui do "Perdido").
- **"Antes de partir"** (`game/beforeLeaving.ts`, até cinco itens) inclui o soldo (o ouro que acaba, contando quem está a caminho), a encruzilhada (uma linha para todas), o herói livre quando há expedição que pode partir, o depósito que enche (com o atalho "Vender"), o Mestre sem edifício e a caravana sem escolta. Não repete o que o relatório já traz com a mesma frase e o mesmo botão. A ordem é a do código (soldo antes da encruzilhada) e não a do roadmap (pendência F-6).
- **Ciclo de leitura**: a leitura seguinte vem antes quando um prazo da Guilda vence (`guildDeadlines`, `expeditionDeadlines`).
- **Fronteira de importação**: o bundle não leva frase nem número de regra da Guilda, do Mercado, das caravanas e dos Mestres (`bundle.test.ts`).
- **Alarmes**: todo lote com um aviso essencial (atraso do soldo, herói que parte, emboscada) mostra ao menos um aviso, mesmo com a cota de três por hora cheia (pendência F-4).

## 19b. Ferro, Ferreiro, armas, desgaste e reparo

O ferro é o quinto recurso, no Armazém, sem ofício produtor. Vem do Mercado e da
**Mina Abandonada** (`abandonedMine`, Guilda Nv2, descoberta na Floresta Antiga).
O Mercado o negocia como os outros recursos; não é carga de caravana. Números em
`balance.ts`, `items.ts` e nos grafos de `packages/content/src/missions/`.

O Ferreiro pede Salão Nv4 e vai ao Nv6. `forgeWeapons` cobra ferro e madeira ao
começar um lote; cancelar devolve 80% para baixo. Armas são unidades inteiras em
`settlement.weapons`, fora dos recursos, dos depósitos e da venda. Forja e reparo
dividem uma fila (`ForgeJob`): `repairItem` recebe um item desequipado no arsenal,
cobra ferro pelos pontos faltantes e reserva seu lugar até a devolução. Reparo
não se cancela. O nível acelera armas; não acelera reparo.

`condition` limita a durabilidade por raridade. A volta de uma expedição e a
batalha gastam equipamento; com zero, ele permanece e perde o bônus. O painel do
Ferreiro na aba Feudo permite forjar, cancelar e reparar com custo/prazo derivados
pelo motor. `smithy.ts`, `repairOrders.ts`, `equipment.ts` e `smithyView.ts`
concentram a regra; `11-ferreiro.spec.ts` exercita a interface.

## 19c. Quartel, soldados, formações e Defesa ativa

O Quartel pede Salão Nv4 e vai ao Nv8; treina Lanceiros, Espadachins, Arqueiros,
Cavaleiros e Escudeiros. Um lote é cobrado ao começar; só ao terminar o soldado
sai dos aldeões. Continua nas casas, come mais e não deserta. O piso de três
aldeões limita ordem e conclusão; redução do lote emite `trainingShortfall`, sem
reembolso. Cancelar exige o `lotKey` conferido, devolve 80%; dispensar devolve
aldeões sem devolver custo. Contas em `army.ts`, ordens em `armyOrders.ts` e
conclusão em `armyTurn.ts`.

Até cinco formações salvas têm três alas, Frente e Retaguarda, e um comandante
por ala. São planos, podem pedir mais soldados do que há; a visão mostra a falta.
Uma só é a Defesa ativa (`activeFormationId`), usada offline com o efetivo
**disponível naquele instante**. Seu comandante não parte em expedição nem
escolta; dispensa, captura, morte e deserção limpam referências. Uma formação em
campanha não pode ser apagada. `formations.ts` e `formationOrders.ts` validam;
a aba Exército monta por teclado e só envia ao salvar.

## 19d. Batalha e Conselho de Guerra

`resolveBattle(input, luck)` (`battle.ts`) é pura, em inteiros/frações: até doze
rodadas, iniciativa com desempate pelo defensor, ala e linha, baixas imediatas,
contra-ataques, flanco, muralha, torres, auras, Mago, Clériga, Escudeiro, moral e
debandada. Os sete cenários calculados à mão em [content-v0.4.md](content-v0.4.md)
são conferidos linha a linha por `battle.test.ts`. `fightBattle` fornece identidade
e sorte pelo fluxo `battle:<id>`; `battleOutcome.ts` aplica experiência, desgaste
e ferimento do comandante, ou morte só em Rei de Ferro. `army.reports` retém três
relatórios, com rodadas, baixas, muralha e três fatores decisivos.

`previewBattle` (`warCouncil.ts`) executa 200 vezes o mesmo resolvedor com geradores
locais. `simulateBattle { formationId, siegeWave? }` guarda uma prévia por vez,
sem mudar RNG ou ids da partida. Para defesa comum, usa somente o conhecimento
público dos vigias ou o histórico do último relatório, com estimativas marcadas
como incertas. Para `siegeWave: 1 | 2 | 3`, só usa presságios **não vagos da revisão
atual daquela onda**; não consulta a composição oculta. Sem posto revelado, não
simula e informa desconhecimento. Formação, efetivo disponível, muralha, Torre e
conhecimento do alvo entram na assinatura de validade (`previewStale`).

O app oferece **Simular defesa do feudo** para uma formação salva e mostra o
resultado recebido. Ainda não oferece seletor de prévia por onda nem prévia
ofensiva do Acampamento; a opção por onda existe no motor/protocolo e no simulador.

## 19e. Muralha, reparo e incursões como batalha

Paliçada, Muralha de Pedra e Baluarte são níveis do mesmo edifício, até o 6. A vida
é por ala (`settlement.wall.hp`). Uma melhoria acrescenta a diferença de vida e
preserva o dano anterior. `repairWall` paga pedra e ouro na hora, não se cancela e
desloca as obras em curso pelo tempo do reparo; obras iniciadas durante ele esperam.
O reparo termina antes das obras e da batalha (`wall.ts`, `wallRepair.ts`).

Toda incursão passa por `fightRaid`: composição sorteada no fluxo `horde` na
marcação; roteiro e incursão migrada com `composition: null` usam a base da estação.
A Defesa ativa usa o que ficou em casa; sem formação, só muralha e torres lutam.
Aplicam-se dano, baixas, efeitos e relatório antes de `raidRepelled`/`raidSuffered`.
A perda de recursos/aldeões continua limitada pela regra anterior da Paliçada:
a batalha pode aliviar, não agravar essa perda. Lobos do dia 16 preservam o caso
antigo sem exército; as roteirizadas leves dos dias 25 e 37 não ferem. O ensaio
forte cai na janela do dia 61 e usa a Vigília.

Torre Nv1/2 não revela composição; Nv3 revela tipos; Nv4, quantidades aproximadas
por ala; Nv5, composição exata. O app recebe só `compositionText`, os textos da
muralha e as ofertas de reparo, sem composição privada.

## 19f. A Horda aprende e os presságios

`hordePlan.ts` guarda contagens por unidade da última formação efetivamente vista,
antes das baixas. `hordeMind.ts` combina os pesos da estação e a astúcia da
dificuldade (3/10, 1/2, 4/5). Mesma memória e semente dão a mesma composição.
A memória zera no ano novo; não há memória entre anos.

O Acampamento nasce no dia 25, a Fortaleza no outono. Covil e Acampamento ativos
somam Ameaça; a Fortaleza soma zero, por decisão do autor. As ondas são preparadas
no outono e regeneradas quando a observação muda; no inverno ficam congeladas.
Uma revisão nova descarta os presságios antigos do painel, preservando a Crônica.

Presságios usam `horde`, clareza da Torre, chance com teto de 90% e seis registros.
O vago não revela onda; o parcial revela um posto aproximado; o exato, os postos.
`siegeView.ts` só agrupa por onda o conhecimento público não vago. Memória, revisão
interna, composição preparada e RNG nunca saem na visão. O fim do Cerco desativa
a Fortaleza; o ano novo reinicia a preparação.

## 19g. Hora da Vigília e referência civil

`settings.realOriginMs` vem de `games.created_at`. O servidor resolve o fuso IANA
com `Intl` e fornece `hourLocal`, `utcOffsetMinutes` e `timezoneResolved`; o motor
não consulta fuso ou relógio do sistema. `vigil.ts` procura a primeira hora local
após +6 h **de jogo**, dentro da janela de 24 h **de jogo** do evento; sem ocorrência,
usa +12 h de jogo. O offset fica fixo, sem ajuste automático de horário de verão.
Ausência de contexto civil usa origem zero/offset não resolvido e gera aviso.

O ensaio usa a janela do dia 61; o Cerco usa o início do inverno. Alterar hora/fuso
nas Preferências envia `setVigilHour`, com contexto civil resolvido e guardado pelo
servidor para replay. Não remarca prazos já fixados. O ensaio tem uma tentativa de
marcação, inclusive quando não encontra vaga; não é repetido ao mudar a preferência.

## 19h. Ataque ao Acampamento

`attackCamp { formationId }` exige Acampamento conhecido e ativo, soldados e um
comandante livre em ala preenchida. Reserva a fotografia dos postos/comandantes
em `army.campaign`; editar a formação salva não muda quem partiu. Comandantes
ficam `campaign`, recebem soldo e não podem fazer outra atividade. Uma formação
secundária não leva comandante da Defesa ativa.

`army.units` inclui a tropa enviada até a volta, para casas, consumo e limite;
`availableUnits` a subtrai de defesa, prévia e dispensa. Chegada e retorno resolvem
depois das expedições e antes das caravanas. Uma incursão no instante da volta
ainda encontra os postos vazios. Na chegada, a batalha ofensiva usa paliçada e
guarnição da Horda, sem Torre do feudo. Vitória limpa o tile e reduz Ameaça; saque
e desconto das baixas entram no retorno. Recuo/derrota não limpam. O tile volta
no ano novo. `campaign.ts`, `armyTurn.ts` e `armyView.ts` sustentam a tela de
campanha, sua conferência e o vínculo com o relatório da batalha.

## 19i. Sabotagem da Fortaleza

`sendExpedition` com `modelId: 'sabotage'` exige outono, Fortaleza ativa e exatamente
três heróis; descobrir o destino não contorna esses requisitos. São até três
tentativas anuais. Os três grafos têm jornada completa de seis horas de jogo,
com encruzilhada que pode abreviar o percurso; a espera por resposta continua real.
A dificuldade aumenta a cada tentativa. Desastre segue a dificuldade: ferimento
em Camponês, captura em Senhor e morte em Rei de Ferro.

Cada Sucesso reduz a onda correspondente em 15%, até 45%; o Xamã revela a terceira;
o Desastre alerta a primeira, uma vez. Redução/alerta repartem o total em inteiros
com restos determinísticos, preservam postos fixos e sobrevivem à regeneração.
Presságios afetados saem do painel; linhas históricas não são reescritas.
`horde.sabotages` zera no ano novo. Se a Fortaleza some, a equipe retorna pela
fronteira. `sabotage.test.ts` e `hordeSabotage.test.ts` provam essas regras;
a aba Guilda mostra tentativas, ondas enfraquecidas e alerta pelo `ViewState`.

## 19j. Cerco, Plano, milícia e rescaldo

`scheduleSiege` marca na primeira virada de outono/inverno com preparação do ano.
A data usa a Vigília na abertura do inverno; migração que a encontra passada recebe
antecedência futura, sem combate retroativo. Não agenda depois do fim daquele ano.
Até a primeira onda, mudanças da preparação sincronizam o retrato em `siege.waves`.

As bases 40/60/80 recebem **1/3 no ano 1, 2/3 no ano 2 e 1 a partir do ano 3**,
antes do fator da dificuldade. Trunca-se a base anual, depois aplica-se a dificuldade;
Xamã e Senhor da Guerra mantêm seus postos fixos. O chefe da terceira vem além da
base. Sabotagem respeita os mínimos dos postos. Não há multiplicador progressivo
de +10% por ano nem Votos (`content/src/horde.ts`, `hordePlan.ts`).

`setBattlePlan` salva uma formação por onda antes do início; `null` significa usar
a Defesa ativa **no instante da onda**. Apagar uma secundária limpa referências.
Depois da onda 1 e da 2, uma decisão `siegeWave` oferece troca e reparo de emergência;
a próxima chega **60 min reais** após a anterior, em qualquer ritmo. `swapWaveFormation`
e `emergencyRepair` exigem a onda da decisão ainda aberta. O avanço vem primeiro:
no prazo exato, a onda já ocorreu. O reparo é imediato, cobra pedra e ouro e não é
automático; reparo normal em curso bloqueia outro. Sem resposta, vale o Plano.

A milícia (`callMilitia`) pode usar até metade dos aldeões aptos, dentro da
antecedência da Torre para incursão forte/onda, havendo posto livre. Afasta-os do
trabalho, sofre dano ampliado, protege o piso de três aldeões e dissolve ao fim
da batalha. A carta de prontidão reserva limite para a primeira onda e reconfere
aptidão na batalha. `siege.militiaOffer` usa a mesma validação da ordem. **Não há
controle de convocação no app desta base**; a oferta já é usada pelo simulador.

O dano e as baixas persistem entre ondas. A primeira derrota fecha em **Queda**;
resistir à terceira dá **Vitória Gloriosa** se nenhuma Frente ficou vazia/caiu,
caso contrário **Vitória**. Derrubar o Senhor da Guerra encerra a terceira onda.
A Fortaleza é retirada ao fechar o Cerco.

A Queda leva 30% dos recursos e 20% dos aldeões com piso de três, zera a muralha e
tira até dois níveis dos dois edifícios mais altos, preservando nível 1. Cancela
suas obras sem reembolso e encerra o reparo da muralha. Não tira Mestres ou heróis;
sobreviventes acima de um limite reduzido ficam, mas treino novo exige vaga.
Gloriosa dá festa; havendo mortes e sem Gloriosa, há luto. O reparo da muralha tem
desconto no rescaldo até o fim do inverno; após Queda, os dois primeiros dias da
primavera seguinte reduzem o custo das novas obras para 4/5. Não há salto para o Degelo.

A aba Exército já permite Plano, troca, reparo, progresso e resultado por teclado.
A visão não oferece vínculo de relatório por onda nem resumo/prazo próprio do
rescaldo. Hoje, barra, árvore, Retorno e Antes de partir mostram os prazos públicos;
o Retorno reúne batalha/onda pelo `battleId`, sem duplicá-las nem inferir o inimigo.

## 19k. Crônica do Ano e Feitos

`yearEnd.ts` fecha o ano antes da abertura do seguinte e da restauração dos tiles.
O evento `yearEnded` registra população máxima, batalhas, vitórias/resistências,
expedições enviadas, cartas resolvidas, resultado do Cerco, pontuação inteira e
ids dos Feitos. Pesos em `balance.score`; contadores anuais reiniciados no fecho,
sem lista ilimitada de conquistas no estado.

Os seis Feitos são Primeiro Inverno, Muralha Intacta, Regicida da Horda, A Finta,
Sabotador e Resgate (`content/src/feats.ts`). São anuais e não dão poder ou Legado.
O servidor oferece `GET /v1/games/:id/years/:year/chronicle.md`, autenticado e sob
trava da partida: quatro estações, notas de continuação, Cerco, estatísticas,
pontuação e Feitos, com eventos restritos ao ano. Ano não concluído retorna 404.
O app recebe `yearEnded` no Retorno e abre a Crônica comum; o botão existente baixa
a Crônica geral. **Ainda não há seleção/download anual no app ou SDK**.

## 19l. Cartas dos lotes 2 e 3, Lobo Branco e objetivos

O catálogo tem **59 cartas** nesta base; 60 continua sendo alvo do roadmap.
Além das 22 herdadas, há Mestres por carta (Gil/Ximena), efeitos percentuais de
estoque, mudanças temporárias de preço só na próxima virada, risco diferido,
requisitos por herói presente/Carismático, soldados, descobertas e candidato extra.
Participantes de encontros ficam fixados por identidade; só a linha do tempo
sorteia o risco, sem morte/captura por carta. O lote 3 acrescenta bônus de forja,
armas/itens, treino, obras, presságios, incursão, muralha e prontidão da milícia.
Os ids e as fichas estão fixados nos testes de `content`; `councilWar.ts` aplica
os ganchos, e `council.bonuses` guarda os temporários.

As três cartas do **Lobo Branco** (`whitePaws`, `whiteWolf`, `forestReturns`)
formam uma cadeia de outono, com Covil limpo e uma chegada por ano. Só a opção de
caçar abre `whiteWolfHunt`, por seis dias de jogo contados da escolha, exigindo
Guilda e herói apto. A expiração retira a oferta antes do Conselho, preservando
equipe enviada. Não aceita outra equipe simultânea; voltar com a fera vencida
fecha a janela. A continuação final tem prazo mínimo de cinco dias após a escolha;
no ramo da caçada, espera a confirmação do abate (`whiteWolf.slain`). Sem abate,
janela ou equipe na estrada, a continuação é cancelada e o ramo é limpo. O ramo
da oferenda não exige abate. Recursos e moral seguem as opções das cartas, sem
bônus no Cerco ou nos presságios. Essa condição já está em `council.ts` e nos testes,
embora o README ainda descreva a chegada final como independente do resultado.
A forma do prazo está no estado 42; `council.white-wolf-effects.test.ts` prova
acesso, névoa, expiração, exclusividade e divisão de intervalo; `council.chains.test.ts`
prova os ramos e a continuação condicionada.

Os objetivos 17 a 21 usam Salão Nv4, treino, formação salva, prévia e incursão
repelida; preservam os dezesseis anteriores e o limite de três ativos. O presságio
gratuito espera preparação real, sem sortear. `objectives.v04.test.ts` cobre a
entrega; Retorno e Antes de partir reaproveitam visão/eventos para a guerra.

## 19m. Reino, ranking e Novidades

O [ADR 0021](decisions/0021-estatisticas-e-ranking.md) acrescenta
`accounts.ranking_listed` (SQL `0001_ranking_listed`) e três rotas autenticadas:
`GET /v1/stats`, `GET`/`PUT /v1/me/ranking`. São leituras do estado **gravado**,
sem avançar partidas. Totais e ordenação ficam em cache por instância durante
60 s; a linha própria é lida na hora e a frente é filtrada pela preferência/exclusão
atual. Mostram os dez primeiros por ouro, mais o jogador fora deles; empate favorece
feudo mais antigo. De terceiros só saem nome do feudo e ouro, sem identificador.
Contas excluídas, partidas arquivadas e contas `Bot ` ficam fora. Sair do ranking
não retira dos totais anônimos. A aba `#/reino` lê somente a resposta de estatísticas;
Preferências permite sair/voltar. Não é ranking de pontuação nem Temporadas.

`#/novidades` é uma aba editorial local, acessível por Conta, Sobre e paleta, inclusive
sem feudo/conexão. Não importa números ou regras do conteúdo. O selo considera a
última entrada publicada compatível com a versão informada pela API; a marca de
leitura é por conta (`lords.newsSeen:<accountId>`), só após renderizar à vista,
sincronizada entre abas e tolerante a falhas de armazenamento. A entrada da v0.4
continua **rascunho**, sem selo de publicação; data e escopo precisam de conferência
antes da release. `news/*.test.ts`, `15-novidades.spec.ts`, `stats.test.ts` e
`15-reino.spec.ts` cobrem esses fluxos.

## 20. Divergências aceitas em relação ao GDD

O GDD e os roadmaps foram atualizados para refletir as decisões abaixo; a lista serve para quem compara o que foi construído com o desenho original.

### 20.1 Decisões do autor (da v0.1)

| Divergência | Sustentação |
|---|---|
| A API roda no host em desenvolvimento | [ADR 0001](decisions/0001-api-no-host-em-dev.md) |
| `@types/node` e `@types/pg` fora da lista de bibliotecas, aprovados depois | [ADR 0006](decisions/0006-types-node.md) |
| A Crônica não traz as viradas de dia; `GET /events` traz | [ADR 0007](decisions/0007-cronica-sem-viradas-de-dia.md) |
| O cliente é um app web com aparência de editor, e não uma extensão do VS Code | [ADR 0008](decisions/0008-cliente-web-com-aparencia-de-editor.md) |
| Produção no Coolify, com o proxy da plataforma na borda | [ADR 0009](decisions/0009-implantacao-no-coolify.md) |
| `GET /version` informa o que está ligado (`features.githubDevice`) | [ADR 0010](decisions/0010-version-informa-o-que-esta-ligado.md) |
| Ritmo 3× e visão em tempo real | [ADR 0011](decisions/0011-ritmo-3x-no-mvp.md) |
| O vínculo GitHub fica **desligado**; o código existe e só foi testado com um GitHub simulado | ADR 0008, ponto 2 |
| O lembrete "Proteja seu reino" conta 48 horas reais | ADR 0011, consequências |
| Página de apresentação em domínio próprio; oito pontos pendentes de confirmação | [ADR 0012](decisions/0012-pagina-de-apresentacao.md) |
| A v0.1 fechou sem playtest externo e sem evidência por critério | [acceptance-v0.1.md](acceptance-v0.1.md) |


### 20.2 Decisões da v0.2

Respondidas pelo autor em 2026-10-05 ([ADR 0016](decisions/0016-respostas-do-autor-as-pendencias-da-v0.2.md)); o que não foi respondido item a item foi confirmado em bloco, com base no jogo.

| Divergência ou leitura | Sustentação |
|---|---|
| Ritmos Rápido (3×), Normal (1×) e Tranquilo (0,5×); o "Rápido 2×" do GDD saiu. Tudo é tempo de jogo, menos os prazos marcados `…RealMs` | [ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisões 1 e 2 |
| Partidas da v0.1 migradas, com a fronteira de cada passo e o estoque acima do limite preservado | ADR 0013, decisão 4; pendência B-4 |
| O objetivo 4 desbloqueia (Celeiro, Armazém e Torre de Vigia) e dá 50 de ouro | [ADR 0014](decisions/0014-conselho-e-ameaca-na-v0.2.md), decisão 12; ADR 0016, item 7 |
| A Crônica também não traz o fecho diário do desperdício | [ADR 0015](decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md) |
| Primeiro lote de 21 cartas, e não 60 | ADR 0014, decisões 7 e 8 |
| Torre e Paliçada até o nível 2; a Ameaça cai a cada incursão; incursões sorteadas pela Ameaça | ADR 0014, decisões 10 e 11 |
| Protocolo com a versão no cabeçalho, sem `/v2` | Pendência B-9 |
| Publicação por fase no `main` (o roadmap previa branches de fase) | ADR 0013, decisão 3 |

### 20.3 Decisões da v0.3

Os ADRs [0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) (decisões 1 a 10) e [0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) (11 a 21) foram fechados pelo autor em 2026-10-05, três respondidas uma a uma e as outras aprovadas em bloco; as seções "Respostas de 2026-10-06" e "Respostas de 2026-10-07" de cada um valem onde divergirem.

| Divergência ou leitura | Sustentação |
|---|---|
| Regime de trabalho: commits direto no `main`, sem branch de fase; **o `push` é do autor** | ADR 0017, decisão 2; respostas de 2026-10-06 |
| O prazo da encruzilhada é de 12 h reais, e o ciclo de variantes dos grafos fica | Respostas de 2026-10-06 (pendências D-71 e D-54) |
| O cativo não ocupa lugar no limite de heróis | Resposta de 2026-10-06 (D-17) |
| O Covil limpo deixa o feudo sem incursão até o outono, quando os lobos descem a serra | ADR 0018, "Manter os lobos do outono" (D-24) |
| O que venceu é cobrado: soldo e deserção por fome com a janela de 2 h reais | ADR 0017, "Respostas de 2026-10-06" |
| A caravana paga +15% sobre o balcão; o soldo cresce com o nível; o piso de população protege 3 aldeões; a primeira alocação do Mestre é imediata | Respostas de 2026-10-07 |
| O lote 2 e a origem por carta de Gil/Ximena ficaram fora da v0.3.0 | Registro histórico F-3; integrados na v0.4 (seção 19l) |
| A tabela do soldo por nível e as marcas de preço da Crônica (85% e 115%) foram propostas por agentes | **Não confirmadas pelo autor** (E-51 e a nota da retomada) |

### 20.4 O que o GDD descreve e ainda não existe

| Item | Estado nesta base |
|---|---|
| Catálogos de edifícios/cartas em `GET /catalog` | Só opções de nova partida; o restante chega na visão |
| Exportação JSON da partida | Não existe; há Crônica geral e endpoint anual em Markdown |
| Mapa gráfico, postos avançados, Veio de Ferro, Capela, relíquias, Legado e Votos | Continuam fora da v0.4 |
| Memória entre anos e crescimento progressivo das ondas por ano | Não existem; só fatores 1/3, 2/3 e 1, e reinício da memória |
| Temporadas e ranking de pontuação | Não existem; o Reino é ranking de ouro, ADR 0021 |
| Notificações com a aba fechada | Não existem; sem serviço de push |
| Dispensar Mestre/ensino de ofício, compra por caravana, segundo destino de caravana, venda de equipamento | Não existem |
| Avançar para o Degelo | Não existe; o servidor continua sendo o relógio |
| Milícia e prévia por onda na interface; download anual no app | Motor/protocolo/endpoint existem, controles ainda faltam |

## 21. Limites conhecidos e fechamento

- **Aceitação humana pendente:** a evidência manual continua por preencher; automação
  e bots não atestam diversão, legibilidade narrativa, Firefox, Safari, celular ou
  leitor de tela. O roteiro de 15–20 min não substitui playtest com visitas reais.
- **Balanceamento:** medidas e regressões estão datadas em
  [balance-v0.4.md](balance-v0.4.md). `MEASURED` é linha de regressão observada,
  não prova da meta de 65–80% de Vitória do Regular. Fase I ainda exige metas,
  ouro por destino, extremos, tamanho máximo e carga `--remote`; medições de
  `--perf` anteriores não equivalem ao fechamento no candidato final.
- **Interface incompleta:** faltam controle de milícia, seletor de prévia por onda,
  prévia ofensiva, download anual e vínculo de relatório por onda. Não inferir
  esses dados a partir de posições na lista de três relatórios.
- **Catálogo:** 59 cartas, frente ao alvo de 60; cobertura de ramos em testes
  dirigidos não equivale a todas saírem espontaneamente em 50 sementes.
- **Migração/replay:** retomar partida migrada exige os estados de fronteira para
  replay exato; uma imagem anterior ao estado novo exige restaurar o backup.
  `FROZEN` protege retratos históricos; goldens só mudam com `UPDATE_GOLDEN=1` e
  leitura do diff. O ensaio com imagens atravessando a migração segue pendente.
- **Previsões:** não contam com incursões, Cerco, campanha, expedições e caravanas
  na cópia de moral; são estimativas sob as condições expostas, sem antecipar sorte.
- **Operação:** portão completo e imagens devem ser conferidos no commit candidato,
  com backup antes da subida do estado/protocolo e push feito pelo autor. Esta
  atualização documental não executou testes de jogo, banco, navegador ou produção.
  Procedimento em [deploy/README.md](../deploy/README.md); continuação em
  [retomada-v0.4.md](retomada-v0.4.md).
