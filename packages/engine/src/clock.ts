import { balance, type SeasonDef } from '@lotg/content';

const { dayMs, seasons } = balance.calendar;

export const DAY_MS = dayMs;
export const DAYS_PER_YEAR = seasons.reduce((sum, season) => sum + season.days, 0);
export const YEAR_MS = DAYS_PER_YEAR * DAY_MS;

/** Ano de jogo, a partir de 1. */
export function yearOf(ms: number): number {
  return Math.floor(ms / YEAR_MS) + 1;
}

/** Dia dentro do ano, de 0 a 83. */
export function dayIndex(ms: number): number {
  return Math.floor((ms % YEAR_MS) / DAY_MS);
}

type SeasonSpan = { season: SeasonDef; firstDay: number };

function seasonSpan(day: number): SeasonSpan {
  let firstDay = 0;
  for (const season of seasons) {
    if (day < firstDay + season.days) {
      return { season, firstDay };
    }
    firstDay += season.days;
  }
  throw new Error(`Dia do ano fora do calendário: ${day}`);
}

/** Estação de um dia do ano (0–23 primavera, 24–47 verão, 48–71 outono, 72–83 inverno). */
export function seasonOf(day: number): SeasonDef {
  return seasonSpan(day).season;
}

/** Dia dentro da estação, a partir de 1. */
export function dayOfSeason(day: number): number {
  return day - seasonSpan(day).firstDay + 1;
}

/** Primeira virada de dia estritamente depois de `ms`. */
export function nextDayBoundary(ms: number): number {
  return (Math.floor(ms / DAY_MS) + 1) * DAY_MS;
}

/** Primeira virada de estação estritamente depois de `ms`. */
export function nextSeasonBoundary(ms: number): number {
  const yearStart = Math.floor(ms / YEAR_MS) * YEAR_MS;
  const span = seasonSpan(dayIndex(ms));
  return yearStart + (span.firstDay + span.season.days) * DAY_MS;
}

export function isDayBoundary(ms: number): boolean {
  return ms % DAY_MS === 0;
}

export function isSeasonBoundary(ms: number): boolean {
  return isDayBoundary(ms) && dayOfSeason(dayIndex(ms)) === 1;
}

export function isYearBoundary(ms: number): boolean {
  return ms % YEAR_MS === 0;
}

export type CalendarDate = {
  year: number;
  season: SeasonDef;
  dayOfSeason: number;
  /** Dia do ano, a partir de 1. */
  dayOfYear: number;
};

export function calendarAt(ms: number): CalendarDate {
  const day = dayIndex(ms);
  return {
    year: yearOf(ms),
    season: seasonOf(day),
    dayOfSeason: dayOfSeason(day),
    dayOfYear: day + 1,
  };
}

/** "a Primavera", "o Verão". */
export function seasonWithArticle(season: SeasonDef): string {
  return `${season.article} ${season.label}`;
}

/** "da Primavera", "do Verão". */
export function ofSeason(season: SeasonDef): string {
  return `d${season.article} ${season.label}`;
}
