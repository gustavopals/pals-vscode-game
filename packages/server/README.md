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

## Testes

```bash
pnpm --filter @lotg/server test     # unitários: configuração, Código do Reino, ETag, esqueleto HTTP
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
TEST_DATABASE_URL=… pnpm test:integration -- games     # um arquivo
```

Os testes de integração ficam em `test/` (e os cenários de ponta a ponta em `tests/server/`, na raiz) e rodam contra o PostgreSQL real do `db_test`, um arquivo por vez. Cada arquivo recria o banco com `resetTestDb()`. Os helpers de `test/helpers/app.ts` sobem a API em memória com um relógio controlado (`server.clock.advance(ms)`): nenhum teste espera tempo real. O access token vale 15 minutos desse relógio; depois de avançá-lo, use `renew`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/app.ts`, `main.ts`, `config.ts` | Montagem do Fastify, arranque e configuração |
| `src/plugins/` | Formato de erros, limites de taxa, autorização (`requireIdentity`), saúde do banco |
| `src/auth/` | Tokens (JWT e refresh), sessões, exclusão, Código do Reino, GitHub (validação do token e repasse do *device flow*) |
| `src/games/` | Lock e persistência (`repository`), criação e leitura (`service`), `/view` e ETag, comandos com recibo, eventos e Crônica |
| `src/jobs/` | Avanço de partidas paradas, expurgo de contas, agendador com advisory lock |
| `src/db/` | Esquema Drizzle e migrador |
| `src/routes/` | Rotas: validam a forma com os schemas de `@lotg/protocol` e chamam os serviços |

As dependências entram por um `AppContext` (`config`, `pool`, `db`, `clock`, `fetch`, `hooks`). O relógio e o `fetch` do GitHub são injetados; é isso que permite testar expiração, exclusão em sete dias e vínculo de conta sem esperar nem tocar a rede.

## Contratos que valem a pena ter em mente

O texto completo está no GDD §14.5–14.9 e nos ADRs 0003–0005. Em resumo:

- **Toda leitura e todo comando** de uma partida autenticam, conferem a propriedade e travam a linha com `SELECT … FOR UPDATE` (`lockGame`). Partida de outra conta é 404, antes de qualquer outra consulta.
- **Leitura** avança o mundo até agora e só escreve se o avanço produziu eventos. Produção contínua não escreve nem muda `state_version`.
- **Comando novo** avança, aplica e grava estado, eventos e recibo na mesma transação, com um único incremento de `state_version`. Uma recusa do motor também é gravada: o mundo avançou, a ação não teve efeito, e a resposta é `422 GAME_RULE` com o estado novo em `details`.
- **Reenvio** do mesmo `commandId` devolve status e corpo originais com `X-Lords-Replayed: true`, sem avançar nem aplicar. Mesmo UUID com outra ordem é `409 COMMAND_ID_CONFLICT`.
- **ETag de `/view`** é o SHA-256 do corpo `{ view, stateVersion }`; não é a `stateVersion`.
- **Autorização** consulta conta e sessão no banco em toda requisição, sem cache. JWT expirado é `UNAUTHORIZED` (o cliente renova); sessão revogada ou conta excluída é `SESSION_REVOKED` (renovar não adianta).
- **Refresh**: apresentar um token já usado revoga a sessão inteira, com commit antes do 401. Por isso os desfechos de `rotateRefreshToken` saem da transação como valor, não como exceção.
- **Exclusão** tem duas etapas: `DELETE /me` bloqueia na hora (202); o job remove tudo sete dias depois.
- **Partida arquivada** não avança mais: `/view` e comandos novos respondem `409 CONFLICT`; eventos, Crônica e recibos continuam legíveis.

## Cuidados que já custaram um defeito

- **Ordem de locks.** Um comando trava a partida e depois insere o recibo, que referencia a conta; uma exclusão trava a conta e depois arquiva as partidas. Por isso toda trava de conta é `FOR NO KEY UPDATE` (`lockLiveAccount`), que não bloqueia a referência por chave estrangeira. Com `FOR UPDATE`, os dois se travam.
- **Jobs.** Cada partida avança na própria transação; uma que falha é contada em `failed` e não segura as outras nem o expurgo de contas.
- **Banco fora do ar.** `guardPool` põe um ouvinte de erro em cada conexão; sem ele, uma conexão que cai em uso derruba o processo. Com ele, a consulta falha, a API segue de pé e `/v1/health` responde 503 com `{ status: 'ok', db: 'down' }`.
- **Logs.** O erro de consulta do Drizzle traz o SQL e os parâmetros na mensagem. Nunca logue o erro cru: use `safeError`.
- **Texto.** Nomes passam por `isStorableText` no protocolo: o PostgreSQL recusa o caractere nulo, e sem a checagem ele viraria um 500.
- **Proxy.** Com `TRUST_PROXY=true`, o servidor confia em um salto só: o IP é o que o proxy viu.

## Limitações conhecidas

- `GET /v1/catalog` (GDD §14.5) ainda não existe; nenhuma tarefa do roadmap o pede.
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

Testado só com um GitHub simulado (`test/helpers/github.ts`, `test/githubDevice.test.ts`).
