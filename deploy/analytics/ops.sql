-- Consultas de operação (MVP-ROADMAP.md F4-T4). Só leitura e só agregados: nenhuma delas mostra
-- nome de jogador, token ou código. Rodar no terminal do banco `lotg-db` no Coolify:
--   psql -U lotg lotg
-- e colar a consulta desejada. deploy/README.md, seção "Operação", explica o caminho.
-- Nas consultas de operação os dias e as horas saem no fuso da sessão do psql (UTC no contêiner).
--
-- As métricas do playtest, no fim do arquivo, usam três variáveis do psql (o bloco "Filtro do
-- playtest"): no mesmo terminal, cole primeiro as três linhas `\set` e só depois as consultas.
--
-- Para ensaiar o arquivo inteiro no banco de desenvolvimento (o psql do contêiner lê pela entrada
-- padrão):
--   docker compose -f deploy/docker-compose.dev.yml exec -T db psql -U lotg -d lotg -v ON_ERROR_STOP=1 < deploy/analytics/ops.sql

-- Contas criadas por dia (últimos 14 dias).
select date_trunc('day', created_at)::date as dia, count(*) as contas
from accounts
where created_at > now() - interval '14 days'
group by 1
order by 1 desc;

-- Contas: total, vinculadas ao GitHub, com Código do Reino e em exclusão.
select
  count(*) as contas,
  count(github_id) as com_github,
  count(recovery_code_hash) as com_codigo_do_reino,
  count(deleted_at) as em_exclusao
from accounts;

-- Jogadores ativos: contas vistas na última hora, no último dia e na última semana.
select
  count(*) filter (where last_seen_at > now() - interval '1 hour') as ultima_hora,
  count(*) filter (where last_seen_at > now() - interval '1 day') as ultimo_dia,
  count(*) filter (where last_seen_at > now() - interval '7 days') as ultima_semana
from accounts
where deleted_at is null;

-- Partidas por situação.
select status, count(*) as partidas
from games
group by 1
order by 2 desc;

-- Partidas ativas e o atraso do avanço: a mais antiga não deveria passar muito de 1 h
-- (ADVANCE_STALE_AFTER_MS) mais o intervalo do job (ADVANCE_JOB_INTERVAL_MS).
select
  count(*) as ativas,
  min(last_processed_at) as avanco_mais_antigo,
  now() - min(last_processed_at) as atraso_maximo
from games
where status = 'active';

-- Comandos por hora nas últimas 24 h, aceitos e recusados.
select
  date_trunc('hour', server_time) as hora,
  count(*) as comandos,
  count(*) filter (where result = 'accepted') as aceitos,
  count(*) filter (where result = 'rejected') as recusados
from commands
where server_time > now() - interval '24 hours'
group by 1
order by 1 desc;

-- Comandos por tipo e resultado ('accepted' ou 'rejected') nos últimos 7 dias; o motivo é o
-- código de recusa do motor.
select type, result, coalesce(error_code, '') as motivo, count(*) as comandos
from commands
where server_time > now() - interval '7 days'
group by 1, 2, 3
order by 4 desc;

-- Sessões abertas (não revogadas e não vencidas).
select count(*) as sessoes_abertas
from sessions
where revoked_at is null and expires_at > now();

-- Tamanho do banco e das tabelas.
select pg_size_pretty(pg_database_size(current_database())) as banco;

select relname as tabela, pg_size_pretty(pg_total_relation_size(relid)) as tamanho, n_live_tup as linhas
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc;

-- ---------------------------------------------------------------------------------------------
-- Métricas do playtest (docs/roadmap-v0.2.md V2A-T1; nasceram em MVP-ROADMAP.md F5-T2.2)
--
-- O QUE ELAS NÃO VEEM. Leituras (GET /view, GET /events) não deixam rastro no banco: só os comandos
-- ficam gravados, em `commands`, aceitos ou recusados. Por isso, aqui:
--   * "sessão" é uma sequência de comandos da mesma partida em que nenhum fica a mais de 30 minutos
--     do anterior; um comando mais de 30 minutos depois do anterior abre outra sessão. Uma visita em
--     que o jogador só olhou e não deu nenhuma ordem não aparece.
--   * "voltar" é dar ao menos um comando. Quem voltou só para olhar conta como não tendo voltado:
--     as proporções abaixo são um piso, e a diferença só aparece nas respostas do formulário.
--   * os dias são do calendário de America/Sao_Paulo. Para outro fuso, troque o nome nas consultas.
--
-- QUEM ENTRA. As quatro consultas contam as mesmas contas, escolhidas na CTE `jogadores` de cada uma:
--   * ficam de fora as contas de bot do sim-cli (nome de exibição começando com "Bot ");
--   * só entram as contas CRIADAS dentro da janela do playtest (`playtest_inicio` incluído,
--     `playtest_fim` excluído). A janela vale para a criação da conta, não para os comandos: tudo o
--     que uma conta da janela fez é contado, mesmo depois do fim dela;
--   * fica de fora a conta do autor (`conta_do_autor`).
-- As contas já removidas pelo job de exclusão (sete dias depois do pedido) somem das métricas junto
-- com os comandos delas: rode as consultas antes disso.
--
-- COMO USAR. Troque os três valores abaixo, e só eles; as consultas não precisam ser editadas.
--   1. Abra o psql (no Coolify: `lotg-db` → Terminal → `psql -U lotg lotg`).
--   2. Cole as três linhas `\set` com os seus valores. Elas valem até o psql ser fechado; se o
--      terminal cair, cole de novo. Sem elas, as consultas param em
--      `syntax error at or near ":"`, que é melhor do que responder sem filtro.
--   3. Cole "Filtro em vigor" e confira a resposta antes de ler as outras.
--   4. Cole as quatro consultas, uma por vez, e copie as saídas como vieram.
-- Os valores:
--   * `playtest_inicio` e `playtest_fim`: data, hora e fuso, por exemplo
--     '2026-10-05 00:00 America/Sao_Paulo' e '2026-10-07 00:00 America/Sao_Paulo'. Sempre nessa
--     ordem, ano-mês-dia: '05/10/2026' é lido como 10 de maio. Sem o fuso, vale UTC. Ponha o fim um
--     pouco depois do último convite, para não cortar quem criou a conta tarde.
--   * `conta_do_autor`: o identificador (UUID) da conta. O app não o mostra em nenhuma tela. Ele
--     está no navegador em que o autor joga: ferramentas de desenvolvedor → Application (Chrome,
--     Edge) ou Armazenamento (Firefox) → Local Storage → chave `lords.account:self`, campo
--     `accountId`. Ou no próprio psql, pelo nome de exibição e pela data de criação:
--       select id, created_at from accounts where display_name = 'NOME DO AUTOR' order by 2;
--     (essa não é agregada: use só com o seu nome e não cole a saída no relatório). Com mais de
--     uma conta de teste, o jeito simples é abrir a janela depois da criação delas.
-- Como estão, os três valores não filtram nada: a janela vai de -infinity a infinity e o
-- identificador de zeros não é de conta nenhuma.
-- ---------------------------------------------------------------------------------------------

-- Filtro do playtest: o único lugar a editar.
\set playtest_inicio '-infinity'
\set playtest_fim 'infinity'
\set conta_do_autor '00000000-0000-0000-0000-000000000000'

-- Filtro em vigor: a janela como o banco a entendeu (em hora de São Paulo), se a conta do autor foi
-- informada e se ela existe, e quantas contas entram nas métricas. `conta_do_autor_existe` falso com
-- `conta_do_autor_informada` verdadeiro quer dizer identificador errado: nada foi tirado. A saída
-- não mostra o identificador, e pode ir para o relatório.
select
  (:'playtest_inicio'::timestamptz at time zone 'America/Sao_Paulo')::text as contas_criadas_desde,
  (:'playtest_fim'::timestamptz at time zone 'America/Sao_Paulo')::text as contas_criadas_antes_de,
  :'conta_do_autor'::uuid <> '00000000-0000-0000-0000-000000000000'::uuid as conta_do_autor_informada,
  exists (select 1 from accounts where id = :'conta_do_autor'::uuid) as conta_do_autor_existe,
  (
    select count(*)
    from accounts
    where display_name not like 'Bot %'
      and created_at >= :'playtest_inicio'::timestamptz
      and created_at < :'playtest_fim'::timestamptz
      and id <> :'conta_do_autor'::uuid
  ) as contas_nas_metricas,
  (select count(*) from accounts where display_name like 'Bot %') as contas_de_bot_fora;

-- Sessões por dia: sessões abertas em cada dia e contas que abriram ao menos uma.
with jogadores as (
  select id
  from accounts
  where display_name not like 'Bot %'
    and created_at >= :'playtest_inicio'::timestamptz
    and created_at < :'playtest_fim'::timestamptz
    and id <> :'conta_do_autor'::uuid
),
marcados as (
  select
    c.game_id,
    c.account_id,
    c.server_time,
    c.seq,
    case
      when c.server_time - lag(c.server_time) over (partition by c.game_id order by c.seq)
        <= interval '30 minutes' then 0
      else 1
    end as abre_sessao
  from commands c
  join jogadores j on j.id = c.account_id
),
numerados as (
  select
    game_id,
    account_id,
    server_time,
    sum(abre_sessao) over (partition by game_id order by seq) as sessao
  from marcados
),
sessoes as (
  select game_id, sessao, min(account_id::text) as conta, min(server_time) as inicio
  from numerados
  group by game_id, sessao
)
select
  (inicio at time zone 'America/Sao_Paulo')::date as dia,
  count(*) as sessoes,
  count(distinct conta) as contas
from sessoes
group by 1
order by 1 desc;

-- Comandos por sessão e duração da sessão (do primeiro ao último comando; uma sessão de um
-- comando só dura zero).
with jogadores as (
  select id
  from accounts
  where display_name not like 'Bot %'
    and created_at >= :'playtest_inicio'::timestamptz
    and created_at < :'playtest_fim'::timestamptz
    and id <> :'conta_do_autor'::uuid
),
marcados as (
  select
    c.game_id,
    c.server_time,
    c.seq,
    case
      when c.server_time - lag(c.server_time) over (partition by c.game_id order by c.seq)
        <= interval '30 minutes' then 0
      else 1
    end as abre_sessao
  from commands c
  join jogadores j on j.id = c.account_id
),
numerados as (
  select
    game_id,
    server_time,
    sum(abre_sessao) over (partition by game_id order by seq) as sessao
  from marcados
),
sessoes as (
  select
    game_id,
    sessao,
    count(*) as comandos,
    max(server_time) - min(server_time) as duracao
  from numerados
  group by game_id, sessao
)
select
  count(*) as sessoes,
  round(avg(comandos), 1) as comandos_media,
  percentile_cont(0.5) within group (order by comandos) as comandos_mediana,
  max(comandos) as comandos_maximo,
  date_trunc('second', percentile_cont(0.5) within group (order by duracao)) as duracao_mediana,
  date_trunc('second', max(duracao)) as duracao_maxima
from sessoes;

-- Tempo até o primeiro comando: da criação da conta ao primeiro comando dela, aceito ou recusado.
-- `sem_comando` são as contas que nunca deram uma ordem; elas não entram na mediana nem no p90.
with jogadores as (
  select id, created_at
  from accounts
  where display_name not like 'Bot %'
    and created_at >= :'playtest_inicio'::timestamptz
    and created_at < :'playtest_fim'::timestamptz
    and id <> :'conta_do_autor'::uuid
),
primeiro as (
  select j.id, min(c.server_time) - j.created_at as espera
  from jogadores j
  left join commands c on c.account_id = j.id
  group by j.id, j.created_at
)
select
  count(*) as contas,
  count(espera) as com_comando,
  count(*) - count(espera) as sem_comando,
  date_trunc('second', percentile_cont(0.5) within group (order by espera)) as mediana,
  date_trunc('second', percentile_cont(0.9) within group (order by espera)) as p90,
  date_trunc('second', max(espera)) as maximo
from primeiro;

-- Retorno no dia 2: das contas criadas em cada dia, quantas deram ao menos um comando no dia
-- seguinte ao da criação. Só entram os dias de criação cujo dia seguinte já terminou: rodada cedo
-- demais, a consulta devolve só a linha do total, com zero contas, e isso não quer dizer "ninguém
-- voltou". O dia é o do calendário, não 24 horas: quem criou a conta às 23h50 e deu uma ordem à
-- 0h10 conta como retorno. A última linha (dia_de_criacao vazio) é o total.
with jogadores as (
  select id, (created_at at time zone 'America/Sao_Paulo')::date as dia_de_criacao
  from accounts
  where display_name not like 'Bot %'
    and created_at >= :'playtest_inicio'::timestamptz
    and created_at < :'playtest_fim'::timestamptz
    and id <> :'conta_do_autor'::uuid
),
retorno as (
  select
    j.id,
    j.dia_de_criacao,
    exists (
      select 1
      from commands c
      where c.account_id = j.id
        and (c.server_time at time zone 'America/Sao_Paulo')::date = j.dia_de_criacao + 1
    ) as voltou
  from jogadores j
  where j.dia_de_criacao + 1 < (now() at time zone 'America/Sao_Paulo')::date
)
select
  dia_de_criacao,
  count(*) as contas,
  count(*) filter (where voltou) as voltaram_no_dia_2,
  round(100.0 * count(*) filter (where voltou) / nullif(count(*), 0), 1) as porcentagem
from retorno
group by rollup (dia_de_criacao)
order by dia_de_criacao desc nulls last;
