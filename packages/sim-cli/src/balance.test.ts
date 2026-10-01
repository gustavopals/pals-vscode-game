import { describe, expect, it } from 'vitest';

import { formatSummary, summarize, toCsv } from './report';
import { simulate } from './simulate';

const twoSessions = await simulate({
  seed: 'pedra-alta-golden',
  days: 7,
  strategy: 'economico',
  sessionsPerDay: 2,
});

describe('faixa de balanceamento da v0.1 (bot econômico)', () => {
  // Se uma faixa falhar, o ajuste é nos números de @lotg/content, nunca no bot.
  it('com 2 sessões por dia: população de 20 a 40, Salão Nv3 ou mais e nenhuma fome no dia 7', () => {
    const summary = summarize(twoSessions);
    expect(summary.villagers).toBeGreaterThanOrEqual(20);
    expect(summary.villagers).toBeLessThanOrEqual(40);
    expect(summary.townHall).toBeGreaterThanOrEqual(3);
    expect(summary.famineHours).toBe(0);
    expect(twoSessions.events.some((event) => event.type === 'famineStarted')).toBe(false);
  });

  it('com 1 sessão por dia: nenhuma fome nas primeiras 24 h', async () => {
    const lazy = await simulate({
      seed: 'pedra-alta-golden',
      days: 7,
      strategy: 'economico',
      sessionsPerDay: 1,
    });
    expect(lazy.rows.slice(0, 24).some((row) => row.famine)).toBe(false);
    const firstFamine = lazy.events.find((event) => event.type === 'famineStarted');
    expect(firstFamine === undefined || firstFamine.atMs > 24 * 3_600_000).toBe(true);
  });

  it('o bot não dá ordens que o motor recusa', () => {
    expect(twoSessions.commands.refused).toEqual({});
    expect(twoSessions.commands.accepted).toBeGreaterThan(20);
  });
});

describe('simulação', () => {
  it('produz uma linha por hora: 168 em 7 dias, e o ano vira no fim', () => {
    expect(twoSessions.rows).toHaveLength(168);
    expect(twoSessions.rows.map((row) => row.hour)).toEqual(
      Array.from({ length: 168 }, (_, index) => index + 1),
    );
    expect(twoSessions.rows[0]).toMatchObject({ realDay: 1, season: 'spring', year: 1 });
    expect(twoSessions.rows[167]).toMatchObject({ realDay: 7, season: 'spring', year: 2 });
    expect(twoSessions.finalState.lastProcessedAt).toBe(168 * 3_600_000);
  });

  it('a mesma semente produz CSVs idênticos', async () => {
    const again = await simulate(twoSessions.options);
    expect(toCsv(again.rows)).toBe(toCsv(twoSessions.rows));
    expect(again.finalState).toStrictEqual(twoSessions.finalState);
  });

  it('o CSV tem cabeçalho e 168 linhas de dados', () => {
    const lines = toCsv(twoSessions.rows).trimEnd().split('\n');
    expect(lines).toHaveLength(169);
    expect(lines[0]).toBe(
      'hour,real_day,year,season,day_of_season,food,wood,stone,gold,' +
        'food_per_hour,wood_per_hour,stone_per_hour,gold_per_hour,' +
        'villagers,capacity,free,in_training,' +
        'townHall,farm,lumberMill,quarry,goldMine,housing,famine',
    );
    const columns = lines[0]?.split(',').length;
    expect(lines.every((line) => line.split(',').length === columns)).toBe(true);
  });

  it('o resumo diz população, níveis, fome e comandos', () => {
    const text = formatSummary(twoSessions);
    expect(text).toContain(
      'Semente pedra-alta-golden · estratégia economico · 7 dias · 2 sessões/dia',
    );
    expect(text).toMatch(/População: \d+ de \d+ vagas/);
    expect(text).toContain('Fome: nenhuma');
    expect(text).toMatch(/Comandos: \d+ aceitos, 0 recusados\n/);
  });

  it('o resumo conta as horas de fome quando o bot não joga o bastante', async () => {
    const abandoned = await simulate({
      seed: 's',
      days: 3,
      strategy: 'economico',
      sessionsPerDay: 1,
    });
    const starved = { ...abandoned, rows: abandoned.rows.map((row) => ({ ...row, famine: true })) };
    expect(summarize(starved)).toMatchObject({ famineHours: 72, firstFamineHour: 1 });
    expect(formatSummary(starved)).toContain('Fome: 72 h, a primeira na hora 1');
  });
});
