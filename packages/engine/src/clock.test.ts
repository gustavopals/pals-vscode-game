import { describe, expect, it } from 'vitest';

import {
  calendarAt,
  DAY_MS,
  dayIndex,
  dayOfSeason,
  DAYS_PER_YEAR,
  isSeasonBoundary,
  nextDayBoundary,
  nextSeasonBoundary,
  ofSeason,
  seasonOf,
  seasonWithArticle,
  YEAR_MS,
  yearOf,
} from './clock';

describe('calendário', () => {
  it('o ano tem 84 dias de 2 horas, ou 168 horas', () => {
    expect(DAYS_PER_YEAR).toBe(84);
    expect(YEAR_MS).toBe(168 * 3_600_000);
  });

  it('dayIndex conta os dias dentro do ano e recomeça no ano seguinte', () => {
    expect(dayIndex(0)).toBe(0);
    expect(dayIndex(DAY_MS - 1)).toBe(0);
    expect(dayIndex(DAY_MS)).toBe(1);
    expect(dayIndex(YEAR_MS - 1)).toBe(83);
    expect(dayIndex(YEAR_MS)).toBe(0);
    expect(yearOf(YEAR_MS - 1)).toBe(1);
    expect(yearOf(YEAR_MS)).toBe(2);
  });

  it.each([
    [0, 'spring', 1],
    [23, 'spring', 24],
    [24, 'summer', 1],
    [47, 'summer', 24],
    [48, 'autumn', 1],
    [71, 'autumn', 24],
    [72, 'winter', 1],
    [83, 'winter', 12],
  ])('dia %i do ano é %s, dia %i da estação', (day, season, ofSeasonDay) => {
    expect(seasonOf(day).id).toBe(season);
    expect(dayOfSeason(day)).toBe(ofSeasonDay);
  });

  it('recusa um dia fora do calendário', () => {
    expect(() => seasonOf(84)).toThrow();
  });

  it('as viradas são sempre estritamente futuras', () => {
    expect(nextDayBoundary(0)).toBe(DAY_MS);
    expect(nextDayBoundary(DAY_MS - 1)).toBe(DAY_MS);
    expect(nextDayBoundary(DAY_MS)).toBe(2 * DAY_MS);
    expect(nextSeasonBoundary(0)).toBe(24 * DAY_MS);
    expect(nextSeasonBoundary(24 * DAY_MS)).toBe(48 * DAY_MS);
    expect(nextSeasonBoundary(72 * DAY_MS + 5)).toBe(YEAR_MS);
    expect(nextSeasonBoundary(YEAR_MS)).toBe(YEAR_MS + 24 * DAY_MS);
  });

  it('reconhece as viradas de estação', () => {
    expect(isSeasonBoundary(24 * DAY_MS)).toBe(true);
    expect(isSeasonBoundary(25 * DAY_MS)).toBe(false);
    expect(isSeasonBoundary(24 * DAY_MS + 1)).toBe(false);
    expect(isSeasonBoundary(YEAR_MS)).toBe(true);
  });

  it('monta a data e os rótulos em português', () => {
    const date = calendarAt(YEAR_MS + 50 * DAY_MS + 123);
    expect(date).toMatchObject({ year: 2, dayOfSeason: 3, dayOfYear: 51 });
    expect(date.season.label).toBe('Outono');
    expect(ofSeason(date.season)).toBe('do Outono');
    expect(seasonWithArticle(seasonOf(0))).toBe('a Primavera');
    expect(ofSeason(seasonOf(0))).toBe('da Primavera');
  });
});
