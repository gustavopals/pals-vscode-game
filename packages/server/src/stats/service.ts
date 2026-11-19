import type { FiefStats, RankingEntry, RankingPreference, StatsResponse } from '@lotg/protocol';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { notFound } from '../api-error';
import type { AppContext } from '../context';
import { accounts, legacyLedger } from '../db/schema';

// Estatísticas do reino e ranking de ouro (ADR 0021). Só leitura do estado **gravado**: nenhuma
// partida é avançada aqui, nenhuma regra de jogo roda. Os campos são lidos do JSON com
// `coalesce(…, 0)`, porque o estado gravado pode ser de uma versão anterior à do motor.

/** Por quanto tempo os totais e o ranking ficam guardados na memória da instância. */
export const STATS_CACHE_MS = 60_000;
/** Quantas linhas o ranking mostra (mais a do jogador, se ele estiver fora delas). */
export const RANKING_SIZE = 10;
/** Janela de "ativo": requisição autenticada nos últimos 7 dias reais. */
export const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * As contas de teste do `sim-cli` (`--remote` e `--smoke`) ficam fora, pela mesma convenção de
 * `deploy/analytics/ops.sql`: o nome de exibição começa com "Bot ".
 */
const COUNTED_ACCOUNT = `a.deleted_at is null and a.display_name not like 'Bot %'`;

/**
 * Uma linha por feudo ativo de conta que conta, com o que o estado gravado diz dele. O ouro é
 * convertido como a visão faz: `floor(milésimos / 1000)`.
 */
const FIEFS = `
  select
    g.account_id,
    a.ranking_listed as listed,
    g.created_at,
    g.state -> 'settlement' ->> 'name' as name,
    floor(coalesce((g.state -> 'settlement' -> 'resources' ->> 'gold')::numeric, 0) / 1000)::bigint as gold,
    coalesce((g.state -> 'settlement' -> 'population' ->> 'villagers')::bigint, 0) as villagers,
    coalesce((g.state -> 'stats' ->> 'raids_repelled')::bigint, 0) as raids_repelled,
    coalesce((g.state -> 'stats' ->> 'raids_suffered')::bigint, 0) as raids_suffered,
    coalesce((
      select sum(value::numeric)
      from jsonb_each_text(coalesce(g.state -> 'stats', '{}'::jsonb))
      where key like 'expeditionsSent:%'
    ), 0)::bigint as expeditions_sent
  from games g
  join accounts a on a.id = g.account_id
  where g.status = 'active' and ${COUNTED_ACCOUNT}
`;

type Candidate = {
  accountId: string;
  listed: boolean;
  createdAtMs: number;
  name: string;
  gold: number;
};

type Snapshot = {
  atMs: number;
  kingdom: StatsResponse['kingdom'];
  /** Todos os feudos, do mais rico ao mais pobre (no empate, o mais antigo antes). */
  fiefs: Candidate[];
};

const caches = new WeakMap<AppContext, Snapshot>();

/** Esquece os totais e o ranking guardados: a próxima leitura refaz a consulta. */
export function forgetStats(ctx: AppContext): void {
  caches.delete(ctx);
}

const toNumber = (value: string | number | null | undefined): number => Number(value ?? 0);

async function snapshot(ctx: AppContext): Promise<Snapshot> {
  const now = ctx.clock().getTime();
  const cached = caches.get(ctx);
  // Um relógio que voltou (outro servidor, um teste) também invalida a consulta guardada.
  if (cached !== undefined && now >= cached.atMs && now - cached.atMs < STATS_CACHE_MS) {
    return cached;
  }
  const since = new Date(now - ACTIVE_WINDOW_MS);
  const totals = await ctx.pool.query<Record<string, string>>(
    `with fiefs as (${FIEFS})
     select
       (select count(*) from accounts a where ${COUNTED_ACCOUNT}) as accounts,
       (select count(*) from accounts a where ${COUNTED_ACCOUNT} and a.last_seen_at >= $1) as active,
       (select count(*) from fiefs) as fiefs,
       (select coalesce(sum(gold), 0) from fiefs) as gold,
       (select coalesce(sum(villagers), 0) from fiefs) as villagers,
       (select coalesce(sum(raids_repelled), 0) from fiefs) as raids_repelled,
       (select coalesce(sum(raids_suffered), 0) from fiefs) as raids_suffered,
       (select coalesce(sum(expeditions_sent), 0) from fiefs) as expeditions_sent`,
    [since],
  );
  const ranked = await ctx.pool.query<{
    account_id: string;
    listed: boolean;
    created_at: Date;
    name: string | null;
    gold: string;
  }>(
    `with fiefs as (${FIEFS})
     select account_id, listed, created_at, name, gold from fiefs
     order by gold desc, created_at asc, account_id asc`,
  );
  const row = totals.rows[0] ?? {};
  const fresh: Snapshot = {
    atMs: now,
    kingdom: {
      accounts: toNumber(row.accounts),
      fiefs: toNumber(row.fiefs),
      activeLastWeek: toNumber(row.active),
      gold: toNumber(row.gold),
      villagers: toNumber(row.villagers),
      raidsRepelled: toNumber(row.raids_repelled),
      raidsSuffered: toNumber(row.raids_suffered),
      expeditionsSent: toNumber(row.expeditions_sent),
    },
    fiefs: ranked.rows.map((fief) => ({
      accountId: fief.account_id,
      listed: fief.listed,
      createdAtMs: fief.created_at.getTime(),
      name: fief.name ?? '',
      gold: toNumber(fief.gold),
    })),
  };
  caches.set(ctx, fresh);
  return fresh;
}

/** O feudo ativo do jogador, lido agora (não do cache). */
async function ownFief(
  ctx: AppContext,
  accountId: string,
): Promise<{ stats: FiefStats; createdAtMs: number } | null> {
  const found = await ctx.pool.query<Record<string, string | Date | null>>(
    `select
       g.created_at,
       g.state -> 'settlement' ->> 'name' as name,
       floor(coalesce((g.state -> 'settlement' -> 'resources' ->> 'gold')::numeric, 0) / 1000)::bigint as gold,
       coalesce((g.state -> 'settlement' -> 'population' ->> 'villagers')::bigint, 0) as villagers,
       coalesce((
         select sum(value::numeric) from jsonb_each_text(coalesce(g.state -> 'army' -> 'units', '{}'::jsonb))
       ), 0)::bigint as soldiers,
       coalesce(jsonb_array_length(g.state -> 'guild' -> 'heroes'), 0) as heroes,
       coalesce((g.state -> 'stats' ->> 'raids_repelled')::bigint, 0) as raids_repelled,
       coalesce((g.state -> 'stats' ->> 'raids_suffered')::bigint, 0) as raids_suffered,
       coalesce((
         select sum(value::numeric) from jsonb_each_text(coalesce(g.state -> 'stats', '{}'::jsonb))
         where key like 'expeditionsSent:%'
       ), 0)::bigint as expeditions_sent,
       coalesce((
         select sum(value::numeric) from jsonb_each_text(coalesce(g.state -> 'stats', '{}'::jsonb))
         where key like 'constructionsStarted:%'
       ), 0)::bigint as constructions_started
     from games g
     where g.account_id = $1 and g.status = 'active'`,
    [accountId],
  );
  const row = found.rows[0];
  if (row === undefined) {
    return null;
  }
  const createdAt = row.created_at as Date;
  const num = (key: string) => toNumber(row[key] as string | null);
  return {
    createdAtMs: createdAt.getTime(),
    stats: {
      settlementName: (row.name as string | null) ?? '',
      gold: num('gold'),
      villagers: num('villagers'),
      soldiers: num('soldiers'),
      heroes: num('heroes'),
      raidsRepelled: num('raids_repelled'),
      raidsSuffered: num('raids_suffered'),
      expeditionsSent: num('expeditions_sent'),
      constructionsStarted: num('constructions_started'),
      daysReigning: Math.max(0, Math.floor((ctx.clock().getTime() - createdAt.getTime()) / DAY_MS)),
    },
  };
}

/** `GET /v1/stats` (ADR 0021). */
export async function readStats(ctx: AppContext, accountId: string): Promise<StatsResponse> {
  const preference = await readRankingPreference(ctx, accountId);
  const snap = await snapshot(ctx);
  // A saída do ranking vale na hora: quem está na frente é conferido contra a preferência e a
  // exclusão de agora, e não contra as do instante da consulta guardada.
  const front = snap.fiefs.filter((fief) => fief.listed).slice(0, RANKING_SIZE * 5);
  const stillListed = new Set<string>();
  if (front.length > 0) {
    const live = await ctx.pool.query<{ id: string }>(
      `select id from accounts a where a.id = any($1::uuid[]) and a.ranking_listed and ${COUNTED_ACCOUNT}`,
      [front.map((fief) => fief.accountId)],
    );
    for (const { id } of live.rows) {
      stillListed.add(id);
    }
  }
  const ranking: RankingEntry[] = front
    .filter((fief) => stillListed.has(fief.accountId))
    .slice(0, RANKING_SIZE)
    .map((fief, index) => ({
      position: index + 1,
      settlementName: fief.name,
      gold: fief.gold,
      mine: fief.accountId === accountId,
    }));

  const own = await ownFief(ctx, accountId);
  let position: number | null = null;
  if (own !== null) {
    // A posição é a do ouro de agora contra os outros feudos listados da consulta guardada.
    const ahead = snap.fiefs.filter(
      (fief) =>
        fief.listed &&
        fief.accountId !== accountId &&
        (fief.gold > own.stats.gold ||
          (fief.gold === own.stats.gold && fief.createdAtMs < own.createdAtMs)),
    ).length;
    position = ahead + 1;
    const shown = ranking.find((entry) => entry.mine);
    if (shown !== undefined) {
      // A linha do jogador mostra o ouro de agora, como as estatísticas dele.
      shown.gold = own.stats.gold;
      shown.settlementName = own.stats.settlementName;
    } else if (preference.listed) {
      ranking.push({
        position: Math.max(position, ranking.length + 1),
        settlementName: own.stats.settlementName,
        gold: own.stats.gold,
        mine: true,
      });
    }
  }
  const others = snap.fiefs.filter((fief) => fief.listed && fief.accountId !== accountId).length;
  const [legacy] = await ctx.db
    .select({ points: sql<number>`coalesce(sum(${legacyLedger.points}), 0)`.mapWith(Number) })
    .from(legacyLedger)
    .where(eq(legacyLedger.accountId, accountId));
  return {
    generatedAt: new Date(snap.atMs).toISOString(),
    kingdom: snap.kingdom,
    ranking,
    rankedFiefs: others + (preference.listed && own !== null ? 1 : 0),
    me: {
      listed: preference.listed,
      position,
      fief: own?.stats ?? null,
      legacy: legacy?.points ?? 0,
    },
  };
}

export async function readRankingPreference(
  ctx: AppContext,
  accountId: string,
): Promise<RankingPreference> {
  const [row] = await ctx.db
    .select({ listed: accounts.rankingListed })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)));
  if (row === undefined) {
    throw notFound('Conta');
  }
  return { listed: row.listed };
}

/** Sai do ranking ou volta a ele; vale para todos os feudos da conta, na hora. */
export async function setRankingPreference(
  ctx: AppContext,
  accountId: string,
  listed: boolean,
): Promise<RankingPreference> {
  const [row] = await ctx.db
    .update(accounts)
    .set({ rankingListed: listed })
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
    .returning({ listed: accounts.rankingListed });
  if (row === undefined) {
    throw notFound('Conta');
  }
  // Quem volta ao ranking aparece já nesta instância; nas outras, quando o cache se renovar.
  forgetStats(ctx);
  return { listed: row.listed };
}
