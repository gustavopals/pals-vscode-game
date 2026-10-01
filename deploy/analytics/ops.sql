-- Consultas de operação (MVP-ROADMAP.md F4-T4). Só leitura e só agregados: nenhuma delas mostra
-- nome de jogador, token ou código. Rodar no terminal do banco `lotg-db` no Coolify:
--   psql -U lotg lotg
-- e colar a consulta desejada. deploy/README.md, seção "Operação", explica o caminho.

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
  count(*) filter (where result <> 'ok') as recusados
from commands
where server_time > now() - interval '24 hours'
group by 1
order by 1 desc;

-- Comandos por tipo e resultado nos últimos 7 dias.
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
