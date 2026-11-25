import type { DifficultyId, ScenarioId } from '@lotg/content';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * Fuso de referência das Temporadas (GDD §11.6; ADR 0022, D-26): Brasília fixo em UTC−3.
 * O Brasil aboliu o horário de verão pelo Decreto 9.772/2019; usar deslocamento fixo de −180 min
 * evita divergência entre versões de ICU e garante a mesma fronteira de semana em toda réplica.
 */
export const SEASON_TIMEZONE = 'America/Sao_Paulo' as const;
export const BRASILIA_UTC_OFFSET_MINUTES = -180;
const BRASILIA_OFFSET_MS = BRASILIA_UTC_OFFSET_MINUTES * MINUTE_MS;

/** Regras fixas de toda Temporada (D-26): 3× (Rápido), Senhor, cenário padrão para todos. */
export const SEASON_DIFFICULTY: DifficultyId = 'lord';
export const SEASON_TIME_SCALE = 3;
export const SEASON_SCENARIO: ScenarioId = 'standard';

export type SeasonWindow = {
  /** Semana ISO em Brasília (`YYYY-Www`, ex.: `"2026-W48"`). */
  code: string;
  /** Segunda-feira 00:00:00.000 de Brasília (`03:00:00.000Z`). */
  startsAt: Date;
  /** Quarta-feira 00:00:00.000 de Brasília (limite exclusivo; entradas até terça 23:59:59). */
  joinEndsAt: Date;
  /** Domingo 23:59:00.000 de Brasília: fecho da semana e horário de publicação do ranking. */
  endsAt: Date;
};

/**
 * Calcula a janela da Temporada semanal que contém `now`, sempre no fuso fixo de Brasília (UTC−3):
 * - abre segunda-feira 00:00 BRT (`startsAt`);
 * - aceita entradas toda segunda e terça-feira BRT (`now < joinEndsAt`, quarta 00:00 BRT);
 * - fecha e publica o ranking no domingo às 23:59 BRT (`endsAt`);
 * - a semana seguinte abre um minuto depois, segunda 00:00 BRT (`startsAt + 7 dias`).
 */
export function seasonWindowAt(now: Date): SeasonWindow {
  // Desloca o relógio UTC em −3 h para ler ano/mês/dia/dia-da-semana de Brasília via `getUTC*`.
  const local = new Date(now.getTime() + BRASILIA_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const mondayLocalMs = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );
  const startsAt = new Date(mondayLocalMs - BRASILIA_OFFSET_MS);
  const joinEndsAt = new Date(startsAt.getTime() + 2 * DAY_MS);
  const endsAt = new Date(startsAt.getTime() + WEEK_MS - MINUTE_MS);

  // Semana ISO 8601 (segunda a domingo): o ano ISO é o da quinta-feira da mesma semana.
  const thursday = new Date(mondayLocalMs + 3 * DAY_MS);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week1MondayMs = Date.UTC(isoYear, 0, 4 - ((jan4.getUTCDay() + 6) % 7));
  const isoWeek = Math.round((mondayLocalMs - week1MondayMs) / WEEK_MS) + 1;
  const code = `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;

  return { code, startsAt, joinEndsAt, endsAt };
}
