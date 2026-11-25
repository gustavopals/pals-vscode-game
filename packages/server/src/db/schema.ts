import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Esquema do GDD §14.6. Toda relação de propriedade usa ON DELETE CASCADE:
// conta → sessões → refresh tokens; conta → partidas → comandos, eventos e Crônicas;
// o Legado pertence à conta e referencia a partida que o concedeu.

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * O que está gravado em `games.state`: o `GameState` de **alguma** versão do motor, não
 * necessariamente a atual. Só o nome do feudo pode ser lido direto daqui (existe desde a versão
 * 1); todo o resto só depois de `loadGame`, que migra o estado para a versão do motor.
 */
export type StoredGameState = {
  readonly schemaVersion: number;
  readonly settlement: { readonly name: string };
};

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey(),
    displayName: text('display_name').notNull(),
    githubId: text('github_id').unique('accounts_github_id_key'),
    /** HMAC-SHA256 hexadecimal do Código do Reino normalizado; nunca o código em claro. */
    recoveryCodeHash: text('recovery_code_hash').unique('accounts_recovery_code_hash_key'),
    createdAt: instant('created_at').notNull(),
    lastSeenAt: instant('last_seen_at').notNull(),
    deletedAt: instant('deleted_at'),
    /** Os feudos da conta aparecem no ranking de ouro de `GET /v1/stats` (ADR 0021). */
    rankingListed: boolean('ranking_listed').notNull().default(true),
  },
  (table) => [index('accounts_deleted_at_idx').on(table.deletedAt)],
);

/** Uma sessão é uma família de refresh tokens de uma máquina, com validade absoluta. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    deviceLabel: text('device_label'),
    createdAt: instant('created_at').notNull(),
    expiresAt: instant('expires_at').notNull(),
    revokedAt: instant('revoked_at'),
  },
  (table) => [index('sessions_account_id_idx').on(table.accountId)],
);

/** Todos os hashes da família ficam guardados até a sessão expirar: é o que detecta reuso. */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    createdAt: instant('created_at').notNull(),
    usedAt: instant('used_at'),
  },
  (table) => [
    index('refresh_tokens_session_id_idx').on(table.sessionId),
    // No máximo um token não utilizado por família.
    uniqueIndex('refresh_tokens_one_unused_per_session')
      .on(table.sessionId)
      .where(sql`used_at is null`),
  ],
);

/**
 * Temporadas semanais compartilhadas (GDD §11.6; ADR 0022, D-25 a D-28).
 * Calendário em horário fixo de Brasília (`America/Sao_Paulo`, UTC−3, sem horário de verão desde
 * o Decreto 9.772/2019): abre segunda 00:00, aceita entradas até terça (limite exclusivo quarta
 * 00:00) e fecha no domingo 23:59, quando as partidas ativas da Temporada são arquivadas e a
 * semente pode ser revelada.
 */
export const seasons = pgTable(
  'seasons',
  {
    id: uuid('id').primaryKey(),
    /** Semana ISO em Brasília (ex.: `"2026-W48"`). Única por semana civil. */
    code: text('code').notNull().unique('seasons_code_key'),
    /** Segunda-feira 00:00:00.000 de Brasília (`03:00:00.000Z`). */
    startsAt: instant('starts_at').notNull().unique('seasons_starts_at_key'),
    /** Quarta-feira 00:00:00.000 de Brasília (limite exclusivo; entradas até terça 23:59:59). */
    joinEndsAt: instant('join_ends_at').notNull(),
    /** Domingo 23:59:00.000 de Brasília: fecho previsto da Temporada e publicação do ranking. */
    endsAt: instant('ends_at').notNull(),
    /** Semente compartilhada da semana; nunca exposta antes de `status = 'closed'` (D-27). */
    seed: text('seed').notNull(),
    /** Dificuldade fixa (D-26: `lord`). */
    difficulty: text('difficulty').notNull(),
    /** Ritmo fixo (D-26: `3`). */
    timeScale: numeric('time_scale').notNull(),
    status: text('status', { enum: ['open', 'closed'] }).notNull(),
    /** Instante em que a Temporada foi fechada após arquivar todas as partidas ativas dela. */
    closedAt: instant('closed_at'),
    createdAt: instant('created_at').notNull(),
  },
  (table) => [
    index('seasons_open_ends_at_idx')
      .on(table.endsAt)
      .where(sql`status = 'open'`),
  ],
);

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** `null` para partida pessoal; referencia `seasons.id` para partida de Temporada (D-25). */
    seasonId: uuid('season_id').references(() => seasons.id, { onDelete: 'restrict' }),
    status: text('status', { enum: ['active', 'archived'] }).notNull(),
    seed: text('seed').notNull(),
    difficulty: text('difficulty').notNull(),
    timeScale: numeric('time_scale').notNull(),
    timezone: text('timezone').notNull(),
    vigilHour: smallint('vigil_hour').notNull(),
    /** Espelho de `state.schemaVersion`, para consultas; quem decide a migração é o estado. */
    schemaVersion: integer('schema_version').notNull(),
    /** O `GameState` inteiro; sempre escrito por completo, nunca em pedaços. */
    state: jsonb('state').$type<StoredGameState>().notNull(),
    stateVersion: bigint('state_version', { mode: 'number' }).notNull(),
    lastProcessedAt: instant('last_processed_at').notNull(),
    createdAt: instant('created_at').notNull(),
    updatedAt: instant('updated_at').notNull(),
  },
  (table) => [
    // Dois índices parciais independentes (D-25): no máximo uma ativa pessoal por conta, e no
    // máximo uma partida por conta em cada Temporada (ativa ou arquivada, garantindo uma única
    // entrada no ranking semanal).
    uniqueIndex('games_one_active_personal_per_account')
      .on(table.accountId)
      .where(sql`status = 'active' and season_id is null`),
    uniqueIndex('games_one_per_account_season')
      .on(table.accountId, table.seasonId)
      .where(sql`season_id is not null`),
    index('games_stale_idx')
      .on(table.lastProcessedAt)
      .where(sql`status = 'active'`),
    index('games_account_id_idx').on(table.accountId),
    index('games_season_id_idx')
      .on(table.seasonId)
      .where(sql`season_id is not null`),
  ],
);

/** Log de comandos para replay e recibo de idempotência, na mesma linha (ADR 0004). */
export const commands = pgTable(
  'commands',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    /** O `commandId` gerado pelo cliente. Único dentro da partida. */
    id: uuid('id').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    seq: bigint('seq', { mode: 'number' }).notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    /** SHA-256 do JSON canônico de `{ type, payload }`. */
    requestHash: text('request_hash').notNull(),
    serverTime: instant('server_time').notNull(),
    result: text('result', { enum: ['accepted', 'rejected'] }).notNull(),
    errorCode: text('error_code'),
    responseStatus: smallint('response_status').notNull(),
    responseBody: jsonb('response_body').notNull(),
  },
  (table) => [
    primaryKey({ name: 'commands_pkey', columns: [table.gameId, table.id] }),
    uniqueIndex('commands_game_seq_key').on(table.gameId, table.seq),
    index('commands_account_id_idx').on(table.accountId),
  ],
);

export const gameEvents = pgTable(
  'game_events',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    seq: bigint('seq', { mode: 'number' }).notNull(),
    at: instant('at').notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload')
      .$type<{ atMs: number; text: string; data: Record<string, string | number> }>()
      .notNull(),
  },
  (table) => [primaryKey({ name: 'game_events_pkey', columns: [table.gameId, table.seq] })],
);

/** Crédito de Legado na conta pelo fechamento de um ano da partida. */
export const legacyLedger = pgTable(
  'legacy_ledger',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    points: integer('points').notNull(),
  },
  (table) => [
    uniqueIndex('legacy_ledger_game_year_key').on(table.gameId, table.year),
    index('legacy_ledger_account_id_idx').on(table.accountId),
  ],
);

/** Crônica do Ano. A tabela existe desde a v0.1; as linhas chegam com o cerco, na v0.4. */
export const chronicles = pgTable(
  'chronicles',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    summary: jsonb('summary').notNull(),
    score: integer('score').notNull(),
    result: text('result').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (table) => [primaryKey({ name: 'chronicles_pkey', columns: [table.gameId, table.year] })],
);

export type AccountRow = typeof accounts.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type SeasonRow = typeof seasons.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type CommandRow = typeof commands.$inferSelect;
export type GameEventRow = typeof gameEvents.$inferSelect;
