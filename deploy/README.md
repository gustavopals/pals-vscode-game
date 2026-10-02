# Implantação e operação

O jogo roda em um servidor com [Coolify](https://coolify.io), em três recursos ([ADR 0009](../docs/decisions/0009-implantacao-no-coolify.md)). O app e a API dividem o mesmo domínio: não há CORS. A página de apresentação é um quarto recurso, em domínio próprio ([ADR 0012](../docs/decisions/0012-pagina-de-apresentacao.md)): não fala com a API nem com o banco, e o jogo não depende dela.

| Recurso      | O que é                                                    | Rota pública          |
| ------------ | ---------------------------------------------------------- | --------------------- |
| `lotg-db`    | PostgreSQL 16, volume persistente, sem porta publicada     | nenhuma               |
| `lotg-api`   | `deploy/Dockerfile`, alvo `runtime`, porta 3000            | `https://<domínio>/v1` |
| `lotg-web`   | `deploy/Dockerfile`, alvo `web` (Caddy servindo o app), 80 | `https://<domínio>`   |
| `lotg-landing` | `deploy/Dockerfile`, alvo `landing` (Caddy servindo a página de apresentação), 80 | `https://<domínio da página>` |

O proxy do Coolify (Traefik) emite o certificado, redireciona HTTP para HTTPS e separa as rotas pelo caminho. A API aplica as migrações de `deploy/migrations` ao subir.

Arquivos desta pasta:

- `Dockerfile` e `Dockerfile.dockerignore`: as três imagens (API, app e página de apresentação). O contexto de build é a raiz do repositório.
- `web.Caddyfile`: o servidor de arquivos da imagem `web` e os cabeçalhos de segurança do app.
- `landing.Caddyfile`: o servidor de arquivos da imagem `landing`, com os cabeçalhos de segurança, o cache e a página de caminho errado.
- `migrations/`: SQL gerado pelo drizzle-kit.
- `ensaio-restauracao.yml`: o serviço que ensaia a restauração de um backup.
- `analytics/ops.sql`: consultas de operação.
- `docker-compose.dev.yml` e `.env.example`: desenvolvimento local.

## Instalação atual

| Item                 | Valor                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Endereço do jogo     | `https://lords.palsincomehub.com`                                 |
| Página de apresentação | `https://lordsoftheguild.palsincomehub.com`                     |
| Painel do Coolify    | `https://app.palsincomehub.com` (Coolify 4.3)                     |
| Projeto e ambiente   | "Lords of the Guild", `production`                                |
| Servidor             | `localhost` (o mesmo em que o Coolify roda)                       |
| Origem do código     | `https://github.com/gustavopals/pals-vscode-game`, branch `main` |
| No ar desde          | 2026-10-01                                                        |

## Implantar do zero

Os dez passos, para refazer a instalação em outro servidor com Coolify.

1. **DNS.** Um registro A do domínio para o IP do servidor.
2. **Projeto.** Criar o projeto e usar o ambiente `production`.
3. **Banco.** Novo recurso PostgreSQL, imagem `postgres:16`, usuário e banco `lotg`, senha gerada, **sem** "Make it publicly available". Iniciar e copiar a URL interna.
4. **API.** Novo recurso a partir do repositório público, branch `main`, build pack "Dockerfile", diretório base `/`, Dockerfile em `/deploy/Dockerfile`, alvo de build `runtime`, porta `3000`, domínio `https://<domínio>/v1`.
5. **Rota da API.** Em "Advanced", desligar **Strip Prefixes**: a API espera receber `/v1/...` inteiro. Desligar também o **health check do Coolify**: ele precisa de `curl` ou `wget` dentro da imagem, que não tem nenhum dos dois. Fica valendo o `HEALTHCHECK` do `Dockerfile`.
6. **Variáveis da API.** As da seção "Produção" de [`.env.example`](.env.example). `GAME_TIME_SCALE`, o ritmo padrão das partidas novas (ADR 0011), não está nessa lista e não precisa ser definida: sem ela vale o padrão 3. Desde a v0.2 o jogador escolhe o ritmo ao criar a partida (3, 1 ou 0,5); a variável vale para quem não escolhe e é o ritmo que as boas-vindas trazem marcado, se for um desses três. Aceita de 0,5 a 10 e não muda as partidas que já existem. `JWT_SECRET` e `RECOVERY_CODE_SECRET` saem de duas execuções de `openssl rand -base64 48`.
7. **Cópia da chave de recuperação.** Guardar `RECOVERY_CODE_SECRET` fora do Coolify, junto aos segredos operacionais. Nunca gerar outra para um ambiente que já emitiu Códigos do Reino: todos deixariam de valer.
8. **App.** Outro recurso do mesmo repositório, alvo de build `web`, porta `80`, domínio `https://<domínio>`, sem variáveis e com o health check do Coolify desligado.
9. **Deploy e conferência.** Fazer o deploy dos dois e conferir:

   ```bash
   curl -s https://<domínio>/v1/health && curl -s https://<domínio>/v1/version
   ```

   Abrir o domínio em um navegador limpo, clicar em **Jogar agora** e ver Pedra Alta.

10. **Backup e avisos.** Agendar o backup do banco (seção "Backup e restauração") e ligar um canal de notificação do Coolify (seção "Operação").

Pela API do Coolify (`/api/v1`), o alvo de build só é aceito em um `PATCH` depois da criação, e a remoção de prefixo é o campo `is_stripprefix_enabled`.

### Página de apresentação

Um recurso à parte, que pode ser criado ou removido sem tocar no jogo.

1. **DNS.** Um registro A do domínio da página para o IP do servidor (na instalação atual, o registro curinga do domínio já aponta para ele).
2. **Recurso.** Outro recurso do mesmo repositório, branch `main`, build pack "Dockerfile", diretório base `/`, Dockerfile em `/deploy/Dockerfile`, alvo de build `landing`, porta `80`, domínio `https://<domínio da página>`, com o health check do Coolify desligado (vale o `HEALTHCHECK` do `Dockerfile`).
3. **Endereços.** A página leva ao endereço do jogo e usa o próprio endereço na prévia do link. Os da instalação atual são o padrão do pacote (`packages/landing/src/site.ts`). Em outra instalação, definir `LOTG_GAME_URL` e `LOTG_LANDING_URL` como variáveis de build do recurso: o `Dockerfile` as recebe como `ARG`. A instalação atual usa os padrões; a passagem dessas variáveis pelo Coolify não foi exercitada.
4. **Deploy e conferência.** Fazer o deploy e conferir de fora:

   ```bash
   scripts/landing-smoke.sh https://<domínio da página>
   ```

   O roteiro confere a página, os cabeçalhos de segurança, o cache e o 404. Depois, abrir a página e clicar em **Jogar agora**: o botão leva ao jogo.

O vínculo com o GitHub fica desligado enquanto `GITHUB_CLIENT_ID` estiver vazio. Para ligar: registrar um OAuth App no GitHub com "Device Flow" habilitado, pôr o identificador na variável e fazer o deploy da API. `GET /v1/version` passa a responder `features.githubDevice: true`.

## Atualizar e reverter

**Atualizar.** Um `push` no `main` implanta sozinho: o job `deploy` de [`ci.yml`](../.github/workflows/ci.yml) roda depois que todos os outros jobs do CI passam, pede ao Coolify o deploy de `lotg-api`, espera `/v1/health`, e então o de `lotg-web`; por último vai o de `lotg-landing`, conferido com `scripts/landing-smoke.sh`. Com o CI vermelho, nada vai ao ar. A troca é por substituição do contêiner depois que o novo passa no health check; conferir `GET /v1/version` (`builtAt` muda).

O job usa o segredo `COOLIFY_DEPLOY_TOKEN` do repositório: um token de API do Coolify com as permissões `read` e `deploy`, e nenhuma outra. Para trocá-lo, criar outro em "Keys & Tokens", rodar `gh secret set COOLIFY_DEPLOY_TOKEN` e apagar o antigo no Coolify.

O deploy manual continua valendo (botão "Deploy", API ou MCP do Coolify), sempre com a API antes do app quando a mudança toca o protocolo. Uma reversão manual dura até o próximo `push` no `main`: para mantê-la, reverter também o commit.

**Reverter.** Na aplicação, aba "Rollback", escolher a imagem do deploy anterior; ou, pela API:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  https://app.palsincomehub.com/api/v1/applications/<uuid>/rollback -d '{"commit":"<sha do deploy anterior>"}'
```

O Coolify guarda as duas últimas imagens de cada aplicação, com o SHA do commit como tag (`GET /applications/<uuid>/rollback-images`). Reverter não desfaz migrações, nem as do esquema nem as do estado das partidas.

**Regra das migrações de esquema.** Toda migração de SQL precisa funcionar com a versão anterior da API: primeiro expandir (coluna ou tabela nova, sem remover nada), publicar, e só em uma versão seguinte contrair. É isso que deixa a reversão segura.

### Reverter depois de uma migração de estado

Desde a v0.2 existe um segundo tipo de migração, que **não** segue a regra acima: a do `GameState` guardado em `games.state` ([README do servidor](../packages/server/README.md), "O que tem versão"). A API nova regrava cada partida na versão nova do estado quando a toca: na primeira leitura, no primeiro comando, ou no job `advance-stale-games`, que alcança todas as partidas ativas em cerca de uma hora. **Uma hora depois do deploy, considere todas as partidas ativas migradas.** Não há caminho de volta no código: nenhuma versão sabe "desmigrar".

**Voltar a imagem da API depois disso é perigoso.** O que acontece depende de qual imagem volta:

| Imagem para a qual se volta | O que ela faz com um estado mais novo que o dela |
|---|---|
| A da tag `v0.1.0`, ou qualquer uma **anterior** à migração por `schemaVersion` (roadmap da v0.2, V2B-T1) | **Não confere a versão.** Lê o estado, simula com as regras antigas, ignora os campos que não conhece e grava por cima. Nada avisa. É corrupção silenciosa: o mundo anda sem as regras novas (uma carta que não expira, um estoque que passa do limite), e quando a imagem nova voltar ela encontra um estado que diz ser da versão nova e não é coerente com ela |
| Qualquer imagem **a partir** da V2B-T1 | Recusa: `GET /view`, comandos e eventos dessas partidas respondem `500 INTERNAL`, o job as conta em `failed`, e **nada é gravado**. No log aparece `StateMigrationError` com as duas versões: a cada requisição recusada e, no job, uma vez por rodada (`jobs.firstFailure`). O jogo fica fora do ar para essas partidas, mas o banco fica intacto. As partidas criadas depois da reversão funcionam, e o job continua a avançá-las, por mais partidas recusadas que haja na frente |

Medido em 2026-10-01 com o motor da tag `v0.1.0` (extraído com `git archive` para uma pasta temporária) diante de cinco estados da versão 2: ele avançou 30 dias, aceitou comandos, derivou a visão e devolveu o estado ainda com `schemaVersion: 2`, `migratedAtMs` e `settings` intactos, **idêntico** ao que o motor novo produz. Ou seja: atravessar **só** a migração 1 → 2 não estraga nada, porque a versão 2 não mudou nenhuma regra, e o servidor da v0.1 grava de volta o número de versão que leu. Isso vale para esse passo e para nenhum outro: da versão 3 em diante o estado carrega campos com regra, e a imagem da `v0.1.0` os atropelaria. **Não use a imagem da `v0.1.0` como destino de reversão depois que uma versão de estado maior que 2 tiver ido ao ar.**

**A troca de contêiner é uma reversão de alguns segundos.** Em todo deploy as duas imagens convivem: o contêiner novo sobe, roda o job `advance-stale-games` logo no arranque, **antes** de abrir a porta (`main.ts` inicia o agendador e só depois chama `listen`), e regrava na versão nova todas as partidas paradas há mais de uma hora, enquanto o contêiner antigo ainda atende quem joga, até o novo passar no health check. Quem volta ao feudo nessa janela tem a partida, já migrada, lida pelo contêiner antigo. O que acontece é o que a tabela acima diz da imagem antiga: se ela é da V2B-T1 em diante, um `500` passageiro e nada gravado; se é a da `v0.1.0`, ela simula com as regras antigas e grava por cima. Por isso a regra vale para a imagem **que está no ar** na hora do deploy, e não só para a que se escolhe em uma reversão.

**Antes de um deploy que sobe a versão do estado** (o commit muda `CURRENT_SCHEMA_VERSION` em `packages/engine/src/migrations.ts`):

0. Conferir que a imagem **que está no ar** já confere a versão do estado, isto é, que ela é da V2B-T1 em diante. Se a produção ainda roda a `v0.1.0`, o deploy é o da próxima seção, em dois passos.
1. Conferir que o backup da madrugada existe e anotar o nome do arquivo; se o deploy for longe das 03:00 UTC, disparar um backup manual na página do `lotg-db` (aba "Backups") e esperar terminar. É o único ponto de retorno, e é um ponto de retorno **caro**: restaurá-lo tira do jogo quem jogou depois dele ("O que a restauração custa a quem joga"). Quanto mais perto do deploy for o backup, menos gente ele atinge.
2. Conferir que há uma cópia do backup **fora do servidor** e que `RECOVERY_CODE_SECRET` está guardado fora do Coolify (as duas pendências da seção "Operação").
3. Anotar o SHA que está no ar (`GET /v1/version`, `builtAt`, e a lista de `rollback-images`).

**Se o deploy que migrou der errado**, há dois caminhos, nesta ordem de preferência:

1. **Avançar.** Corrigir o defeito e publicar uma imagem nova, que entenda a versão de estado que já está no banco. Ninguém perde nada. Enquanto a correção não sai, se o defeito for grave, **parar** `lotg-api` (o app fica sem conexão, mostrando o último retrato que guardou, e não aceita ordens) é melhor do que deixar o defeito ou uma imagem antiga escrevendo.
2. **Restaurar o backup anterior ao deploy** e só então voltar a imagem. Parar `lotg-api`; restaurar como em "Backup e restauração"; fazer o rollback da imagem para o SHA anotado; iniciar `lotg-api`; conferir `/v1/health`, `/v1/version` e, com `analytics/ops.sql`, as contagens. **Perde-se tudo o que foi jogado desde o backup**: ordens, eventos, contas e partidas criadas depois dele. **E quem abriu o jogo depois do backup perde a sessão**: o navegador guarda um refresh token que o banco restaurado nunca viu, a primeira renovação responde `401` e o app apaga a conta local. Para uma conta anônima sem Código do Reino anterior ao backup, isso é **perder o feudo**, que é justamente o que este procedimento existe para evitar. Leia "O que a restauração custa a quem joga", em "Backup e restauração", antes de escolher este caminho: ele é o último recurso. Como o tempo de jogo é calculado a partir de `created_at`, as partidas restauradas alcançam o presente sozinhas na primeira leitura: o tempo não se perde; as decisões e, para muitos, o acesso, sim.

O que **não** fazer: voltar a imagem sem restaurar o backup e deixá-la rodando. Com uma imagem a partir da V2B-T1 o resultado é um jogo fora do ar (reversível: basta avançar de novo); com uma imagem anterior, é corrupção que nenhum backup posterior conserta.

Para saber em que versão as partidas estão:

```sql
select schema_version, status, count(*) from games group by 1, 2 order by 1, 2;
```

### A primeira publicação da v0.2 vai em dois passos

A produção roda a imagem da `v0.1.0`, que não confere a versão do estado, e a v0.2 inteira foi escrita no `main` local, sem publicar nada ([ADR 0013](../docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 3). Um `push` só, com tudo, levaria a produção da `v0.1.0` direto para um estado de versão maior que 2, e isso junta os dois casos que esta seção manda evitar:

- **Na janela da troca**, o contêiner da `v0.1.0` atende partidas que o contêiner novo acabou de migrar para uma versão com regras novas, e grava por cima delas com as regras antigas. É a linha "corrupção silenciosa" da tabela, sem ninguém ter pedido reversão nenhuma.
- **Depois da troca**, as duas imagens que o Coolify guarda são a nova e a da `v0.1.0`: o único destino de reversão disponível é justamente o proibido.

O plano original do roadmap (§0.8) evitava isso sem dizer: a Fase B ia para a produção sozinha, antes das mecânicas. Com tudo no `main` local, a proteção precisa ser um passo do procedimento.

**Passo 1: publicar só a Fase B.** Ela leva o estado para a versão 2, que não muda nenhuma regra (medido acima: o motor da `v0.1.0` diante de um estado da versão 2 produz o mesmo que o motor novo), e põe no ar a primeira imagem que confere a versão.

```bash
# O commit que sobe o estado para a versão 3; o pai dele é o último em que a versão ainda é 2.
git log --reverse --format='%h %s' -S'CURRENT_SCHEMA_VERSION = 3' -- packages/engine/src/migrations.ts | head -1
git show <sha>~1:packages/engine/src/migrations.ts | grep 'CURRENT_SCHEMA_VERSION ='   # tem de dizer 2
git push origin <sha>~1:main
```

Antes do `push`, os passos 1 a 3 de "Antes de um deploy que sobe a versão do estado". Se depois do último commit da Fase B houver correções dela misturadas com as fases seguintes, o pai do commit acima já as inclui até ali; as que vierem depois vão no passo 2.

**Entre os passos: esperar a migração terminar.** Conferir `GET /v1/version` (`builtAt` novo), esperar pouco mais de uma hora (o job alcança as partidas ativas paradas há mais de uma hora; as outras são migradas quando o dono as abre) e conferir que não sobrou partida ativa na versão 1:

```sql
select schema_version, status, count(*) from games group by 1, 2 order by 1, 2;
```

As arquivadas ficam na versão em que estavam: não avançam nem são regravadas, e são migradas só em memória quando lidas.

**Passo 2: publicar o resto** (`git push origin main`), de novo com os passos 0 a 3. A partir daqui o contêiner antigo de qualquer troca e a imagem de reversão de qualquer deploy já recusam uma versão futura: na janela da troca, quem volta a uma partida recém-migrada vê um erro passageiro, e nada é gravado.

**Se for mesmo um `push` só:** parar `lotg-api` antes do deploy (o app fica sem conexão, com o último retrato, e não aceita ordens), para que nenhum contêiner da `v0.1.0` esteja de pé enquanto o novo migra; e, até o deploy seguinte empurrar a imagem da `v0.1.0` para fora das duas guardadas, **não usar a aba "Rollback" da API**: se o deploy der errado, só valem "avançar" ou "restaurar o backup" de cima, e o segundo exige uma imagem que entenda o estado restaurado. Este caminho não foi ensaiado: não foi conferido se um deploy do Coolify com a aplicação parada sobe o contêiner novo sem religar o antigo.

Nada disto foi exercitado com imagens; entra no ensaio que falta (abaixo).

### Ensaios de reversão

| Data       | O que foi feito                                                                                                    | Tempo | Resultado |
| ---------- | ------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 2026-10-01 | `lotg-api` de `42d9256` para a imagem de `1ef9545` pela API de rollback; `/v1/version` voltou a responder sem `features` | 38 s  | sem erro em `/v1/health` durante a troca; contas e partidas intactas |
| 2026-10-01 | Volta para `42d9256` por um deploy normal (a imagem já existia)                                                    | 20 s  | `features.githubDevice` de volta em `/v1/version` |

Os dois commits usam a mesma migração (`0000_init`); a reversão ainda não foi ensaiada atravessando uma migração de esquema.

**Atravessando uma migração de estado: sem ensaio com imagens.** O procedimento acima foi escrito a partir do código e de três provas automáticas, e **não** foi ensaiado com duas imagens Docker diante de um banco descartável (migrar, reverter a imagem, observar a falha, restaurar). O que existe:

| Data       | O que foi provado | Como |
| ---------- | ----------------- | ---- |
| 2026-10-01 | Uma linha gravada com `schema_version = 1` carrega, é persistida na versão 2 uma vez só (também com duas réplicas ao mesmo tempo e pelo job) e aceita ordens; um recibo da v0.1 é devolvido como foi gravado | `packages/server/test/games-migration.test.ts`, contra o PostgreSQL do `db_test` |
| 2026-10-01 | Diante de um estado de versão mais nova, a API responde 500 em leitura, comando e eventos, o job conta a falha, e a linha fica idêntica (mesmo `xmin`) | idem |
| 2026-10-01 | O motor da tag `v0.1.0` não confere a versão e, diante de estados da versão 2, produz o mesmo resultado que o motor novo | Roteiro descartável com o motor extraído por `git archive v0.1.0` |

Falta, antes de a primeira migração de estado ir para a produção: fazer o ensaio de verdade no ambiente `ensaio` (restaurar um backup de produção no banco descartável, subir a imagem nova, conferir a contagem por `schema_version`, voltar a imagem, observar, restaurar de novo) e registrar a linha aqui. O ensaio inclui a **janela da troca** e os dois passos da primeira publicação: partir da imagem da `v0.1.0`, publicar a da Fase B com uma partida parada há mais de uma hora, abrir essa partida pelo contêiner antigo enquanto o novo sobe, e conferir que o estado gravado é o mesmo que o motor novo produziria; depois repetir a troca da Fase B para a imagem seguinte e observar o `500` passageiro, sem escrita.

## Backup e restauração

**Backup.** Agendado no Coolify, na página do `lotg-db`, aba "Backups": `pg_dump` em formato custom todo dia às 03:00 UTC, retenção de 14 dias. Os arquivos ficam no servidor, em `/data/coolify/backups/databases/<time>/lotg-db-<uuid>/`. Falha de backup gera aviso pelos canais de notificação do Coolify.

Os backups estão **no mesmo disco do banco**. Para sobreviver à perda do servidor, cadastrar um armazenamento S3 no Coolify e marcá-lo no agendamento.

**Restaurar em produção.** Parar `lotg-api`; na página do `lotg-db`, "Import Backup", apontar o arquivo `.dmp` do servidor e usar o comando `pg_restore --clean --if-exists --no-owner -U lotg -d lotg`; iniciar `lotg-api`; conferir `/v1/health` e as contagens de `analytics/ops.sql`. A variável `RECOVERY_CODE_SECRET` precisa ser a mesma de quando o backup foi feito. **Restaurar em produção tira do jogo quem jogou depois do backup**: leia a seção seguinte antes.

### O que a restauração custa a quem joga

A restauração devolve o banco, linha por linha, ao instante do backup. Além das ordens, dos eventos, das contas e das partidas posteriores, isso tem efeitos que não são óbvios. Todos estão provados em `packages/server/test/restore.test.ts`, com backup e restauração simulados no banco de teste:

- **Quem abriu o jogo depois do backup perde a sessão.** O refresh token gira a cada renovação (o access token vale 15 minutos) e o banco só guarda o hash dos tokens que ele mesmo emitiu. O navegador de quem jogou depois do backup guarda um sucessor que o banco restaurado nunca viu: na primeira renovação a API responde `401 UNAUTHORIZED`, e o app apaga tokens, conta e cache. A conta e a partida continuam no banco, intactas, e ninguém mais consegue entrar nelas.
- **O único caminho de volta é o Código do Reino gerado antes do backup.** Um código gerado depois some com a restauração. Com o vínculo GitHub desligado, a conta anônima que não tinha código antes do backup **perde o feudo**. O backup é diário e quem joga abre o jogo todo dia: na prática, isso atinge quase todo jogador ativo.
- **Quem não abriu o jogo desde o backup não nota nada**: o token que o navegador guarda é o que o backup conhece.
- **Exclusões e saídas são desfeitas.** Uma conta excluída depois do backup volta a existir, com a sessão e o Código do Reino valendo de novo. Uma sessão encerrada em "Sair desta máquina", ou revogada por reuso de token, depois do backup, volta a valer.

Por isso, em toda restauração em produção:

1. **Antes**, com `lotg-api` já parada, anotar as contas excluídas depois do backup:

   ```sql
   select id, deleted_at from accounts where deleted_at > '<instante do backup, em UTC>';
   ```

2. **Depois** de restaurar e antes de iniciar `lotg-api`, refazer a exclusão de cada uma, com o `deleted_at` anotado (é ele que conta os sete dias do expurgo). São as mesmas escritas de `DELETE /me`:

   ```sql
   begin;
   update accounts set deleted_at = '<deleted_at anotado>', recovery_code_hash = null, github_id = null where id = '<id>';
   update sessions set revoked_at = now() where account_id = '<id>' and revoked_at is null;
   update games set status = 'archived', updated_at = now() where account_id = '<id>' and status = 'active';
   commit;
   ```

   Se o backup tiver mais de sete dias, guardar também a lista inteira (`select id from accounts;`): uma conta que o backup tem e o banco de antes não tinha mais já havia sido expurgada, e é apagada de novo com `delete from accounts where id = '<id>';`, que leva partidas, comandos, eventos e sessões em cascata.

3. Avisar os jogadores, pelo canal que houver, de que quem jogou depois do instante do backup vai precisar do Código do Reino para entrar.

Os passos 1 e 2 ainda não foram ensaiados no ambiente `ensaio`.

**Preservar as sessões: possível, ainda não adotado.** Guardar as tabelas `sessions` e `refresh_tokens` do banco atual antes do `pg_restore` e reimportá-las depois (só as de contas que o backup tem) devolve o acesso a quem jogou depois do backup e mantém as saídas e as revogações posteriores; as ordens dadas depois do backup se perdem do mesmo jeito. O teste "reimportar as sessões do banco de antes da restauração…" mostra que funciona no banco de teste. **Não está no procedimento**: nunca foi ensaiado com `pg_dump` e `pg_restore` de verdade, e põe as sessões de um banco ao lado das contas de outro, o que mexe no contrato de sessão do [ADR 0005](../docs/decisions/0005-sessoes-e-exclusao.md). A decisão é do autor.

**Ensaiar.** O ensaio usa um banco descartável e nunca toca o de produção:

1. Criar o ambiente `ensaio` no projeto e, nele, um PostgreSQL 16 `lotg-db-ensaio` (usuário e banco `lotg`).
2. Criar no mesmo ambiente um recurso "Docker Compose" com [`ensaio-restauracao.yml`](ensaio-restauracao.yml) e definir `TARGET_URL` com a URL interna do banco de ensaio.
3. Iniciar o serviço e ler os logs do contêiner `restore`: as linhas `ENSAIO` mostram as contagens depois de restaurar, depois de apagar uma conta e depois de restaurar de novo.
4. Apagar o serviço e o banco de ensaio.

### Ensaios de restauração

| Data       | Backup                                        | Resultado |
| ---------- | --------------------------------------------- | --------- |
| 2026-10-01 | `pg-dump-lotg-1790875348.dmp` (20.683 bytes) | restaurado: 2 contas, 2 partidas; uma conta apagada: 1 e 1; restaurado de novo: 2 e 2; saída com código 0 |

O ensaio foi feito com as 2 contas que existiam em produção, não com as 3 que o roteiro original pedia.

## Operação

**Saúde.** `GET /v1/health` responde `{"status":"ok","db":"ok"}`. O workflow [`health.yml`](../.github/workflows/health.yml) consulta a API, o app e a página de apresentação de fora do servidor a cada 5 a 15 minutos; quando falha, o GitHub avisa por e-mail quem tem as notificações de Actions ligadas no repositório.

**Avisos do Coolify.** Em "Notifications", ligar um canal (e-mail, Telegram, Discord…). Já estão marcados para avisar: falha de deploy, falha de backup, contêiner que reinicia em excesso, servidor inalcançável e disco acima de 80% (conferido todo dia às 23:00 UTC). Sem um canal ligado, nenhum desses avisos sai.

**Disco.** O Coolify limpa imagens e contêineres sem uso todo dia à meia-noite UTC.

**Logs.** Na página de cada recurso, aba "Logs". A API escreve JSON (pino), uma linha por requisição; tokens e códigos nunca são registrados.

**`psql`.** Na página do `lotg-db`, aba "Terminal":

```bash
psql -U lotg lotg
```

As consultas de [`analytics/ops.sql`](analytics/ops.sql) dão contas por dia, jogadores ativos, partidas por situação, atraso do job de avanço, comandos por hora (aceitos e recusados) e tamanho do banco. O fim do arquivo traz as métricas do playtest (roadmap da v0.2, V2A-T1): sessões por dia, comandos por sessão, tempo até o primeiro comando e retorno no dia 2. Como as leituras não ficam gravadas, uma sessão ali é uma sequência de comandos da mesma partida sem intervalo maior que 30 minutos, e quem voltou só para olhar não aparece. As contas de bot ficam de fora; a janela de criação das contas e a conta do autor se escolhem em três linhas `\set` no bloco "Filtro do playtest", que precisam ser coladas no `psql` antes das consultas (como estão, não filtram nada). A consulta "Filtro em vigor" mostra o que o banco entendeu. Todas são agregadas. As consultas foram ensaiadas no banco de desenvolvimento em 2026-10-01; em produção, ainda não rodaram.

**Segredos.** Ficam só no Coolify. Trocar `JWT_SECRET` derruba as sessões abertas e nada mais. Trocar `PUBLIC_URL` também: ela é o emissor dos tokens. `RECOVERY_CODE_SECRET` não se troca.

**Teste de alerta.** Parar `lotg-api` por alguns minutos deve fazer o workflow de saúde falhar e o GitHub enviar o e-mail; ao iniciar de novo, a execução seguinte volta a passar.

| Data       | O que foi feito                                                                 | Resultado |
| ---------- | ------------------------------------------------------------------------------- | --------- |
| 2026-10-01 | `lotg-api` parada por cerca de 2 minutos (17:36 a 17:38 UTC), com o workflow disparado à mão antes, durante e depois | passou, falhou (`/v1/health` respondeu 404, vindo do app) e passou de novo; a chegada do e-mail do GitHub não foi conferida |
