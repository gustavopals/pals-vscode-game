# @lotg/server

A API `/v1` de Lords of the Guild: Fastify + PostgreSQL. O servidor é autoritativo e é o relógio do jogo. Ele autentica, trava a partida, chama o motor (`@lotg/engine`) e persiste. Nenhuma regra de jogo vive aqui.

## Rodar

```bash
pnpm dev:up          # db (5432) e db_test (5433) em Docker
pnpm secrets:gen     # cria deploy/.env com JWT_SECRET e RECOVERY_CODE_SECRET
pnpm dev:api         # tsx watch; aplica as migrações no arranque
curl -s localhost:3000/v1/health && curl -s localhost:3000/v1/version
```

A configuração vem das variáveis de `deploy/.env` ([exemplo comentado](../../deploy/.env.example)) e é validada no arranque: falta ou formato errado derruba o processo com uma mensagem que cita só o nome da variável.

## Dificuldade e ritmo das partidas

O jogador escolhe a dificuldade e o ritmo ao criar a partida ([ADR 0013](../../docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisões 2, 2a e 19a). Os dois ficam gravados e não mudam mais.

- **`POST /games`** aceita `difficulty` (`peasant`, `lord`, `ironKing`) e `timeScale` (um dos ritmos de `balance.paces`: 3, 1 ou 0,5). Um valor fora dessas listas é `400 VALIDATION`, com o campo em `details.issues`, e nada é criado nem arquivado. A dificuldade é conferida pelo schema do protocolo, que lê a lista de identificadores de `@lotg/content`. O ritmo, não: o protocolo só exige um número positivo, e quem o confere contra `balance.paces` é o servidor (`OfferedGameRequestSchema`, em `src/catalog.ts`). O protocolo não pode ler `balance`, porque o app importa os schemas dele e a tabela de números iria junto para o navegador; `packages/web/src/bundle.test.ts` compila o app e acusa.
- **Sem os campos**, valem os padrões: a dificuldade recomendada do conteúdo (Senhor) e o ritmo do servidor, `GAME_TIME_SCALE`. É o caminho do app da v0.1 e do simulador.
- **`GAME_TIME_SCALE`** é só esse padrão: horas de jogo por hora real de quem não escolhe. O padrão da variável é 3; aceita de 0,5 a 10, com casas decimais, e fora da faixa, ou com texto, o servidor não sobe. Ela pode valer um ritmo que o jogo não oferece (7, por exemplo): a partida criada sem `timeScale` nasce nele mesmo assim, mas ninguém consegue pedi-lo no corpo.
- Os dois valores são gravados na linha (`games.difficulty`, `games.time_scale`) e dentro do estado (`state.settings`), sempre iguais; o motor lê os do estado. Mudar a variável, ou criar outra partida, não mexe nas que já existem: cada uma segue como nasceu, em qualquer instância que a leia. Em uma partida da v0.1, a migração copia o ritmo da coluna e grava `lord`.
- O motor continua em tempo de jogo. O servidor converte: tempo de jogo = (agora − `created_at`) × `time_scale`, e o `at` de cada evento é `created_at` + `atMs` ÷ `time_scale`.
- **A visão sai em tempo real.** Em `GET /view` e na resposta dos comandos (aceitos ou recusados), todo campo em segundos é de segundos reais e toda taxa por hora é por hora real, inclusive nos textos de explicação (`breakdown`). Prazos são arredondados para cima; `depletesInSeconds` e `famine.secondsElapsed`, para baixo. Uma obra anunciada com `durationSeconds: 80` termina 80 segundos reais depois. `atMs` nos eventos e `famine.sinceMs` continuam em milissegundos de jogo.
- A visão diz qual é a partida: `settlement.difficulty`, `settlement.difficultyLabel` ("Senhor") e `settlement.paceLabel` ("Rápido: um ano em 56 horas"). Um ritmo fora da lista sai como "Ritmo 7×: um ano em 1 dia".
- No ritmo 3, o dia de jogo dura 40 minutos reais e a comida inicial, sem ninguém na Fazenda, acaba em 12 horas reais.

### `GET /v1/catalog`

As opções de nova partida, para as boas-vindas do app, que não importa `@lotg/content` (GDD §14.5). Sem autenticação, no limite geral de requisições, como `/version`.

```jsonc
{
  "contentHash": "…",                    // o mesmo de GET /version
  "newGame": {
    "difficulties": [                     // da mais branda à mais dura
      { "id": "lord", "label": "Senhor", "description": "O feudo como foi pensado: …", "recommended": true }
    ],
    "paces": [                            // na ordem em que as boas-vindas os mostram
      { "timeScale": 3, "label": "Rápido", "description": "um ano em 56 horas", "hint": "Para quem volta várias vezes ao dia …", "recommended": true }
    ],
    "defaults": { "difficulty": "lord", "timeScale": 3 }
  }
}
```

- `recommended` é a marca do conteúdo. `defaults` é o que as boas-vindas trazem marcado: a dificuldade recomendada e `GAME_TIME_SCALE`, quando ele é um dos ritmos oferecidos; se não for, o ritmo recomendado. Por isso os testes, que rodam com `GAME_TIME_SCALE=1`, veem `defaults.timeScale: 1` e `recommended` no ritmo 3.
- Os fatores de regra de cada dificuldade (`storageCapacity`, `famineDesertion`) **não** saem no catálogo: o app mostra a frase, e quem aplica o fator é o motor.
- O corpo é montado uma vez, no arranque (`src/catalog.ts`). O **ETag** é fraco e é o SHA-256 do corpo inteiro: muda com o conteúdo (o corpo leva o `contentHash`) e também quando o ritmo padrão muda. `If-None-Match` igual devolve `304` sem corpo; `cache-control: no-cache` faz o navegador perguntar antes de reusar.

## Testes

```bash
pnpm --filter @lotg/server test     # unitários: configuração, Código do Reino, ETag, esqueleto HTTP
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
TEST_DATABASE_URL=… pnpm test:integration games        # só os arquivos com "games" no nome (sem "--": com ele o filtro é ignorado)
```

Os testes de integração ficam em `test/` (e os cenários de ponta a ponta em `tests/server/`, na raiz) e rodam contra o PostgreSQL real do `db_test`, um arquivo por vez. Cada arquivo recria o banco com `resetTestDb()`. Os helpers de `test/helpers/app.ts` sobem a API em memória com um relógio controlado (`server.clock.advance(ms)`): nenhum teste espera tempo real. O access token vale 15 minutos desse relógio; depois de avançá-lo, use `renew`.

Os helpers sobem a API com `GAME_TIME_SCALE=1`, porque os cenários foram escritos nos tempos do GDD (dia de 2 horas). O ritmo tem arquivo próprio, `test/pace.test.ts`, que sobe instâncias nos ritmos 1, 3, 0,5 e 7 com `createTestApp({ config: { GAME_TIME_SCALE: '3' } })`. A segunda fila e o início automático das planejadas (a obra que começa sozinha com o jogador fora, no instante exato nos ritmos 1 e 3, e a marca que passa pelo recibo) estão em `test/planned.test.ts`. A volta de uma ausência longa no ritmo 3, atravessada de uma vez (1, 7 e 29 dias reais: uma leitura, um incremento de `stateVersion`, todos os eventos gravados e buscados em páginas), está em `test/long-absence.test.ts`; os tempos medidos ficam em [docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 9.7, e o teste só cobra um teto folgado. A escolha na criação (as nove combinações, os valores inválidos, os padrões e a partida antiga intacta) está em `test/games.test.ts`; o catálogo, em `test/catalog.test.ts` e, sem banco, em `src/catalog.test.ts`. Para criar uma partida de teste em outro ritmo ou dificuldade: `startGame(server, token, { timeScale: 3, difficulty: 'ironKing' })`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/app.ts`, `main.ts`, `config.ts` | Montagem do Fastify, arranque e configuração |
| `src/catalog.ts`, `version.ts` | Corpo de `GET /catalog` (opções de nova partida e padrões) e de `GET /version` (hash do conteúdo) |
| `src/plugins/` | Formato de erros, limites de taxa, autorização (`requireIdentity`), saúde do banco |
| `src/auth/` | Tokens (JWT e refresh), sessões, exclusão, Código do Reino, GitHub (validação do token e repasse do *device flow*) |
| `src/games/` | Lock, migração do estado e persistência (`repository`), criação e leitura (`service`), `/view` e ETag, comandos com recibo, eventos e Crônica |
| `src/jobs/` | Avanço de partidas paradas, expurgo de contas, agendador com advisory lock |
| `src/db/` | Esquema Drizzle e migrador |
| `src/routes/` | Rotas: validam a forma com os schemas de `@lotg/protocol` e chamam os serviços |

As dependências entram por um `AppContext` (`config`, `pool`, `db`, `clock`, `fetch`, `hooks`). O relógio e o `fetch` do GitHub são injetados; é isso que permite testar expiração, exclusão em sete dias e vínculo de conta sem esperar nem tocar a rede.

## Contratos que valem a pena ter em mente

O texto completo está no GDD §14.5–14.9 e nos ADRs 0003–0005. Em resumo:

- **Toda leitura e todo comando** de uma partida autenticam, conferem a propriedade e travam a linha com `SELECT … FOR UPDATE` (`lockGame`). Partida de outra conta é 404, antes de qualquer outra consulta.
- **Leitura** avança o mundo até agora e só escreve se o avanço produziu eventos (ou se o estado acabou de ser migrado de uma versão anterior; ver "O que tem versão"). Produção contínua não escreve nem muda `state_version`.
- **Comando novo** avança, aplica e grava estado, eventos e recibo na mesma transação, com um único incremento de `state_version`. Uma recusa do motor também é gravada: o mundo avançou, a ação não teve efeito, e a resposta é `422 GAME_RULE` com o estado novo em `details`.
- **Reenvio** do mesmo `commandId` devolve status e corpo originais com `X-Lords-Replayed: true`, sem avançar nem aplicar. Mesmo UUID com outra ordem é `409 COMMAND_ID_CONFLICT`.
- **ETag de `/view`** é o SHA-256 do corpo `{ view, stateVersion }`; não é a `stateVersion`.
- **Autorização** consulta conta e sessão no banco em toda requisição, sem cache. JWT expirado é `UNAUTHORIZED` (o cliente renova); sessão revogada ou conta excluída é `SESSION_REVOKED` (renovar não adianta).
- **Refresh**: apresentar um token já usado revoga a sessão inteira, com commit antes do 401. Por isso os desfechos de `rotateRefreshToken` saem da transação como valor, não como exceção.
- **Exclusão** tem duas etapas: `DELETE /me` bloqueia na hora (202); o job remove tudo sete dias depois.
- **Crônica sem viradas de dia nem o fecho diário do desperdício** (ADRs [0007](../../docs/decisions/0007-cronica-sem-viradas-de-dia.md) e [0015](../../docs/decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md)): `GET /chronicle` e `GET /chronicle.md` trazem uma linha por evento, menos os de `CHRONICLE_HIDDEN_EVENT_TYPES` (`@lotg/protocol`): `dayStarted` e `storageWasted`. As viradas de estação e de ano e o depósito que encheu (`storageFilled`) ficam, e o filtro `?year=` e o `?limit=` contam só o que entra na Crônica. `GET /events` continua trazendo tudo, e os eventos continuam todos gravados em `game_events`.
- **"Sua escolha voltou" no Markdown da Crônica** (`games/chronicleMarkdown.ts`, roadmap da v0.2, V2D-T4.3): a linha de uma carta que continua outra (`cardDrawn` com `previousInstanceId`) leva, logo abaixo, um item recuado que cita a linha do desfecho da carta anterior: `  - Sua escolha voltou: “…”` quando o jogador respondeu (`cardAnswered`), `  - A decisão do conselho voltou: “…”` quando o prazo acabou (`cardExpired`). É texto, e continua valendo uma linha por evento: a nota começa com dois espaços. O app acha a linha citada pela frase e leva o leitor até ela. `GET /chronicle` e `GET /events` não mudam: já traziam `previousCardId`, `previousOptionId` e `previousInstanceId` em `data`.
- **Partida arquivada** não avança mais: `/view` e comandos novos respondem `409 CONFLICT`; eventos, Crônica e recibos continuam legíveis. Ela também não é regravada: fica na versão de estado em que parou e é migrada só em memória, a cada leitura.

## O que tem versão

Quatro coisas mudam de forma entre uma versão do jogo e outra. Cada uma tem o seu número e o seu tratamento:

| O quê | Onde está o número | Quando muda | O que o servidor faz |
|---|---|---|---|
| **Estado da partida** | `state.schemaVersion` dentro de `games.state`; a coluna `games.schema_version` é um espelho para consultas | Uma tarefa muda a forma do `GameState` ([README do motor](../engine/README.md), "Versões do estado e migração") | Migra ao travar a partida e grava na escrita seguinte (abaixo) |
| **Conteúdo** | `contentHash` em `GET /version` | Qualquer número ou texto de `@lotg/content` | Nada: o conteúdo vai dentro da imagem e não é gravado no banco. O estado guarda só o que aconteceu (níveis, estoques, prazos já calculados); obras e recrutas em curso mantêm o prazo com que nasceram. O hash serve para saber, de fora, que conteúdo está no ar; a conta é a função `contentHash` de `@lotg/protocol`, a mesma que o simulador usa para identificar os relatórios de balanceamento |
| **Protocolo** | `protocol` em `GET /version`; o cliente manda `X-Lords-Protocol` em toda chamada | O `ViewState` ou uma rota muda de modo que o app antigo não consegue ler. O `ViewState` cresce por **adição**; adição não sobe o protocolo | Um `X-Lords-Protocol` diferente do número do servidor recebe `426 UPGRADE_REQUIRED` com a instrução de recarregar a página. Enquanto o número for o mesmo, uma aba antiga continua funcionando. Hoje é **2**, desde o Conselho do Feudo (V2D-T1, ADR 0014): a visão passou a trazer cartas em `council` e em `pendingDecisions`, que o app do protocolo 1 não sabe ler. Quem não manda o cabeçalho (o monitor de saúde, um `curl`) é atendido |
| **Recibos de comando** | Não têm número: `commands.response_body` é a resposta **da época**, com o `ViewState` de então | Nunca são reescritos | O reenvio do mesmo `commandId` devolve o corpo original, byte a byte, mesmo que o estado já tenha mudado de versão. O cliente não usa um recibo repetido como tela: busca `/view` (GDD §14.8) |

### Migração do estado

- **Onde.** `loadGame` (`src/games/repository.ts`) chama `migrateState` do motor com o `time_scale` da linha. `lockGame` passa por ela, e o job `advance-stale-games` também, depois da própria trava. O resto do servidor só enxerga o estado já na versão atual (`LoadedGame`); o tipo de `games.state` (`StoredGameState`) deixa ler direto só o nome do feudo, que é o que a lista de partidas mostra.
- **Quando grava.** A migração acontece em memória, sob o lock, e é gravada pela primeira escrita daquela transação, junto com `schema_version` e um único incremento de `state_version`: a leitura (que neste caso escreve mesmo sem eventos), o comando novo, aceito ou recusado, ou o job. Duas requisições simultâneas migram uma vez: a segunda espera o lock e já encontra a versão nova.
- **Reenvio.** Um comando repetido responde o recibo antes de avançar: não grava nada, nem a migração. Ela fica para a próxima leitura.
- **Fronteira.** Cada passo de migração grava em `state.migratedAtMs` o instante de jogo em que encontrou a partida, isto é, até onde a versão anterior simulou. Os prazos de uma mecânica nova contam a partir da fronteira do passo que a trouxe ([README do motor](../engine/README.md), "a fronteira é de cada passo").
- **Versão futura ou forma inesperada.** `migrateState` lança `StateMigrationError` e a requisição termina em `500 INTERNAL`, com a transação desfeita: **nada é gravado por cima**. A forma é conferida em toda leitura, também quando o estado já diz ser da versão atual. `loadGame` recusa do mesmo jeito uma partida cujo `settings.timeScale` não é o `time_scale` da linha: o servidor converte o relógio pela coluna e o motor converte prazos reais pelo estado, e os dois têm de ser o mesmo número.
- **Na escrita também.** `persistState` confere o estado que vai gravar (`assertStorable`: o JSON dele tem de ser o que `loadGame` aceitaria de volta). Um defeito de regra que produza `NaN` termina em 500 com a linha intacta, em vez de gravar `null` por cima do último estado bom. No log, a causa aparece com o nome do erro e o caminho do campo (nunca o valor); no job, a partida conta em `failed`, as outras seguem (quantas forem as ilegíveis) e a causa da primeira falha vai no relatório da rodada. É isso que protege o banco quando alguém volta a imagem da API para antes de uma migração; o procedimento está em [deploy/README.md](../../deploy/README.md), "Reverter depois de uma migração de estado". A lista de partidas (`GET /games`) continua respondendo, porque só lê o nome.
- **Sem migração de SQL.** Mudar a forma do estado não muda o esquema do banco: o estado é um JSONB inteiro. Migração de estado e migração de esquema são coisas separadas, e a regra "expandir, depois contrair" vale só para a segunda.

Os testes ficam em `test/games-migration.test.ts`: gravam linhas com `schema_version = 1` a partir dos retratos do motor (`packages/engine/src/__fixtures__/state-v1-*.json`) e de um recibo da v0.1 (`test/__fixtures__/receipt-v1.json`). `test/morale.test.ts` faz o mesmo com retratos da versão 6, a anterior à moral: a partida entra na mecânica com 50, sem evento nenhum na fronteira, e a fome que já trazia só leva o primeiro aldeão na primeira virada de dia depois dela. `test/threat.test.ts` faz o mesmo com um retrato da versão 8, a anterior à Ameaça (a Torre de Vigia por construir, o covil ativo, a Ameaça em zero), e prova pela API a névoa de informação: a Ameaça sobe no estado de todo feudo, e só sai na visão e nos eventos de quem tem a Torre.

## Cuidados que já custaram um defeito

- **Ordem de locks.** Um comando trava a partida e depois insere o recibo, que referencia a conta; uma exclusão trava a conta e depois arquiva as partidas. Por isso toda trava de conta é `FOR NO KEY UPDATE` (`lockLiveAccount`), que não bloqueia a referência por chave estrangeira. Com `FOR UPDATE`, os dois se travam.
- **Jobs.** Cada partida avança na própria transação; uma que falha é contada em `failed` e não segura as outras nem o expurgo de contas. Uma partida que falha nunca é escrita, então fica para sempre na cabeça da fila (`last_processed_at` não anda): a rodada só termina quando um lote não traz avanço **nem falha nova**, senão cem partidas ilegíveis esconderiam todas as outras. O relatório leva a causa da primeira falha (`firstFailure`, nome e mensagem por `safeError`), que é o que aparece no log.
- **Estado cru.** `games.state` pode estar em uma versão anterior. Nunca passe `row.state` de uma consulta direta para o motor: use `lockGame` ou `loadGame`. O tipo `StoredGameState` existe para o compilador barrar isso.
- **Banco fora do ar.** `guardPool` põe um ouvinte de erro em cada conexão; sem ele, uma conexão que cai em uso derruba o processo. Com ele, a consulta falha, a API segue de pé e `/v1/health` responde 503 com `{ status: 'ok', db: 'down' }`.
- **Logs.** O erro de consulta do Drizzle traz o SQL e os parâmetros na mensagem. Nunca logue o erro cru: use `safeError`.
- **Texto.** Nomes passam por `isStorableText` no protocolo: o PostgreSQL recusa o caractere nulo, e sem a checagem ele viraria um 500.
- **Proxy.** Com `TRUST_PROXY=true`, o servidor confia em um salto só: o IP é o que o proxy viu.

## Limitações conhecidas

- `GET /v1/catalog` só traz as opções de nova partida. Os outros catálogos do GDD §14.5 (edifícios, cartas) não saem por ele: o `ViewState` já leva o que o app exibe.
- Se o relógio do servidor andar para trás, o jogo não regride (o tempo de jogo nunca volta), mas `commands.server_time` guarda o instante regredido. Um replay só pelo log usaria esse instante.

## Migrações

O esquema vive em `src/db/schema.ts`. Depois de mudá-lo:

```bash
pnpm --filter @lotg/server db:generate -- --name <nome>   # escreve o SQL em deploy/migrations
pnpm db:migrate                                            # aplica no banco de dev
```

O servidor aplica as migrações pendentes no arranque, dentro de `pg_advisory_lock(727)`, então várias réplicas podem subir juntas. Migrações devem ser compatíveis com a versão anterior do código (expandir, depois contrair).

## Build e imagem

`pnpm --filter @lotg/server build` empacota tudo em `dist/main.js` com esbuild: o servidor, os pacotes `@lotg/*` e as dependências de produção. A imagem (`pnpm docker:build`) leva só esse arquivo e as migrações, sem `node_modules`, e roda como usuário `node`.

## Vínculo GitHub pelo navegador

O app web obtém o token do GitHub por *device flow* (GDD §14.7). O GitHub não aceita essas chamadas direto do navegador, então duas rotas só as repassam, com o `GITHUB_CLIENT_ID` (público) e o escopo `read:user`:

- `POST /v1/auth/github/device` → `${GITHUB_OAUTH_URL}/login/device/code`
- `POST /v1/auth/github/device/poll` → `${GITHUB_OAUTH_URL}/login/oauth/access_token`

Não há segredo de OAuth, nada é guardado e nada vai para o log. Sem `GITHUB_CLIENT_ID` as duas respondem `404 NOT_FOUND` e `GET /v1/version` informa `features.githubDevice: false`, para o app esconder os botões ([ADR 0010](../../docs/decisions/0010-version-informa-o-que-esta-ligado.md)). Limite por IP: `GITHUB_DEVICE_STARTS_PER_HOUR_PER_IP` (padrão 20) para começar e 30 por minuto para consultar. O endereço que o GitHub devolve só é aceito se for do próprio `GITHUB_OAUTH_URL`, porque vira um link na tela do jogador.

Na v0.1 o vínculo GitHub fica desligado em produção (sem `GITHUB_CLIENT_ID`). O código continua no repositório, testado só com um GitHub simulado (`test/helpers/github.ts`, `test/githubDevice.test.ts`); nunca foi exercitado contra o GitHub real.
