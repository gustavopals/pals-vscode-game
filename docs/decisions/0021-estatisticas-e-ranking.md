# ADR 0021 — Estatísticas do reino e ranking de ouro

**Status:** aprovado pelo autor em 2026-10-30. **Escopo:** fora dos roadmaps (pedido direto do
autor); servidor (`GET /v1/stats`, `GET`/`PUT /v1/me/ranking`, coluna nova em `accounts`), SDK e
app (aba "Reino", opção nas Preferências). Não muda regra de jogo, o `GameState` nem o protocolo
(continua 3: só adições).

## Contexto

O pedido do autor (2026-10-30): "faz uma tela também com estatísticas de jogo, como pontos,
quantos usuários ou contas tem, um ranking de quem tem mais ouro, algumas infos legais para
engajar com os usuários". Até aqui nada do que um jogador vê vem de outro jogador: a tela é a
primeira coisa pública do jogo. As três perguntas que o agente fez e o que o autor respondeu:

1. **Quem aparece no ranking?** Todos os feudos, **com opção de sair** nas Preferências.
2. **Como o feudo aparece?** **Pelo nome do feudo** (o que o jogador deu na fundação). Nunca o
   nome da conta, e-mail, identificador ou qualquer dado pessoal.
3. **O que a tela mostra?** **Os totais do reino, o ranking de ouro e as estatísticas do próprio
   jogador**, com a posição dele no ranking.

## Decisão

**O que é público.** Só o nome do feudo e o ouro dele, e só para os feudos que estão no ranking.
Os totais do reino são números agregados, que não dizem nada de ninguém. Nenhum identificador
(de conta ou de partida), nome de exibição, data de criação, dificuldade ou ritmo sai na
resposta. O nome do feudo é escolhido pelo jogador; a Preferência diz que ele fica à vista de
todos.

**Como se sai.** Uma coluna por conta, `accounts.ranking_listed` (`boolean not null default
true`): todos entram, como o autor respondeu. `PUT /v1/me/ranking { listed }` muda; vale para
**todos os feudos da conta** (o de agora e os que vierem) e tem **efeito imediato** no ranking
de quem lê, porque a lista nominal nunca vem do cache (abaixo). `GET /v1/me/ranking` diz o valor
atual, para as Preferências. Quem saiu continua vendo a tela inteira e a própria posição ("fora
do ranking", com o lugar que teria), e continua contado nos totais agregados: eles são anônimos.

**Quem conta.** Contas não excluídas (`deleted_at is null`; a conta excluída some na hora, antes
do expurgo) e partidas `active` (as arquivadas ficam de fora). **Contas de teste ficam de fora**
pela convenção que já existe em `deploy/analytics/ops.sql`: nome de exibição começando com
"Bot " (o `sim-cli --remote` e o `--smoke`). Uma partida por conta (`games_one_active_per_account`).

**Ativo nos últimos 7 dias.** Conta com `accounts.last_seen_at` nos últimos 7 dias reais
(`last_seen_at` é atualizado a cada requisição autenticada, de 5 em 5 minutos). É a mesma conta
que o painel de operação usa.

**Os totais.** Contas, feudos ativos, contas ativas em 7 dias, e somas do estado gravado de todos
os feudos ativos, que o estado já guarda: ouro, aldeões (`settlement.population.villagers`),
incursões repelidas (`stats.raids_repelled`), incursões sofridas (`stats.raids_suffered`) e
expedições enviadas (a soma das chaves `stats.expeditionsSent:<modelo>`). Um campo que uma
versão antiga do estado ainda não tem conta 0. **As estatísticas do jogador** são as mesmas
leituras do estado dele (ouro, aldeões, soldados, heróis, incursões repelidas e sofridas,
expedições enviadas, construções iniciadas), mais os dias reais desde a fundação e a posição no
ranking de ouro.

**De onde vem o ouro.** Do estado **gravado** (`games.state`), em milésimos, convertido para
unidades como a visão faz (`floor(milésimos / 1000)`). O servidor **não** avança partidas de
outros jogadores em uma leitura de estatística: o avanço é preguiçoso (cada partida anda quando o
dono a lê, e o job avança a parada há mais de 1 h), e avançar dezenas de partidas a cada leitura
travaria as linhas dos outros. A tela diz isso: "o ouro de cada feudo na última vez que ele foi
atualizado (até 1 h atrás)". Nenhuma regra de jogo roda no servidor para isso: é leitura de JSON.

**Cache.** Os totais e o ranking são uma consulta agregada guardada **na memória da instância por
60 s**: no máximo uma varredura por minuto, qualquer que seja o número de leitores. Para o "efeito
imediato" da saída, o cache guarda os 50 primeiros **com** o identificador interno da conta (que
nunca sai na resposta) e a resposta filtra pela preferência **atual** de quem aparece neles (uma
consulta por chave primária às contas da lista) antes de cortar nos 10 e numerar. Quem sai some
na leitura seguinte; quem volta reaparece quando o cache se renova, em até um minuto. A posição do próprio jogador é
calculada na hora, contra o ouro gravado dele (`count(*)` dos feudos com mais ouro, entre os
listados), e por isso é sempre a de agora.

**Limite do ranking.** Os **10 primeiros**, mais a linha do jogador quando ele está fora dos 10.
Empate no ouro: o feudo mais antigo fica na frente (ordem estável, sem dizer a data). A posição é
1 + o número de feudos listados com mais ouro.

**Privacidade.** O texto da política de privacidade é do autor (CLAUDE.md, regra 7): o agente não
o reescreve. A pendência está em `docs/pendencias-v0.4.md` ("Estatísticas e ranking"): a
política precisa citar que o nome do feudo e o ouro ficam à vista de todos, com a opção de sair.

## Consequências e verificação

- Migração SQL `0001_*` em `deploy/migrations` (gerada pelo drizzle-kit), com o padrão `true`:
  as contas que já existem entram no ranking, como o autor respondeu.
- `packages/server/test/stats.test.ts` prova: o corpo só tem os campos do schema (estrito) e
  nenhum nome de exibição, identificador ou data; quem sai some do ranking na hora (com o cache
  quente), quem volta reaparece depois do minuto do cache; a conta excluída some; as partidas arquivadas e as contas "Bot "
  ficam fora; a posição do jogador fora dos 10; o cache de 60 s.
- O app lê `GET /v1/stats` só com a aba Reino aberta e à vista, no ritmo das leituras da partida,
  no máximo uma vez por minuto; as Preferências leem `GET /v1/me/ranking`.
- A tela fica fora do bundle de números de regra: o app só mostra o que a resposta traz.
