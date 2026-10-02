import { describe, expect, it } from 'vitest';

import { formatSummary, longestWasteStreak, summarize, worstWasteStreak } from './report';
import { type HourRow, simulate, type SimulationResult } from './simulate';

// Uma partida curta só para ter linhas de verdade; o desperdício de cada hora é reescrito.
const base = await simulate({
  seed: 'pedra-alta-golden',
  days: 1,
  strategy: 'economico',
  sessionsPerDay: 2,
});

/** As primeiras horas da partida com o desperdício acumulado de cada uma trocado pelo de `wasted`. */
function withWaste(
  wasted: Array<Partial<Record<'food' | 'wood' | 'stone', number>>>,
  timeScale?: number,
): SimulationResult {
  const rows = wasted.map((entry, index): HourRow => {
    const row = base.rows[index];
    if (row === undefined) {
      throw new Error(`A partida de base só tem ${base.rows.length} horas.`);
    }
    return { ...row, wasted: { food: 0, wood: 0, stone: 0, gold: 0, ...entry } };
  });
  return {
    ...base,
    options: { ...base.options, ...(timeScale === undefined ? {} : { timeScale }) },
    rows,
  };
}

const wood = (...values: number[]) => values.map((value) => ({ wood: value }));

describe('a maior sequência desperdiçando um recurso (GDD §15.2; ADR 0013, decisão 17)', () => {
  it('sem desperdício, zero', () => {
    expect(longestWasteStreak(withWaste(wood(0, 0, 0, 0)).rows, 'wood')).toBe(0);
    expect(longestWasteStreak([], 'wood')).toBe(0);
  });

  it('conta as horas seguidas em que o acumulado subiu; a hora parada corta a sequência', () => {
    // Sobe nas horas 2, 3 e 4, para na 5, sobe na 6 e na 7.
    const rows = withWaste(wood(0, 5, 9, 12, 12, 20, 21, 21)).rows;
    expect(longestWasteStreak(rows, 'wood')).toBe(3);
  });

  it('a primeira hora conta quando já fecha com desperdício', () => {
    expect(longestWasteStreak(withWaste(wood(4, 8, 8)).rows, 'wood')).toBe(2);
  });

  it('cada recurso por si: a madeira parar não corta a sequência da pedra', () => {
    const rows = withWaste([
      { wood: 1, stone: 1 },
      { wood: 1, stone: 2 },
      { wood: 2, stone: 3 },
      { wood: 2, stone: 4 },
    ]).rows;
    expect(longestWasteStreak(rows, 'wood')).toBe(1);
    expect(longestWasteStreak(rows, 'stone')).toBe(4);
    expect(longestWasteStreak(rows, 'food')).toBe(0);
  });

  it('o resumo a dá em horas de jogo: as horas reais seguidas vezes o ritmo', () => {
    const waste = wood(0, 5, 9, 12, 12, 20);
    expect(summarize(withWaste(waste)).wasteStreakGameHours).toEqual({
      food: 0,
      wood: 3,
      stone: 0,
    });
    expect(summarize(withWaste(waste, 3)).wasteStreakGameHours).toEqual({
      food: 0,
      wood: 9,
      stone: 0,
    });
    expect(summarize(withWaste(waste, 0.5)).wasteStreakGameHours.wood).toBe(1.5);
  });

  it('o pior recurso da partida: o de maior sequência; no empate, o primeiro da ordem', () => {
    const summary = summarize(
      withWaste([
        { food: 1, stone: 1 },
        { food: 2, stone: 2 },
        { food: 2, stone: 3 },
      ]),
    );
    expect(worstWasteStreak(summary)).toEqual({ resource: 'stone', gameHours: 3 });
    expect(worstWasteStreak(summarize(withWaste(wood(0, 0))))).toEqual({
      resource: 'food',
      gameHours: 0,
    });
  });

  it('o resumo de uma partida diz a sequência de cada recurso, em horas de jogo', () => {
    const text = formatSummary(withWaste(wood(0, 5, 9, 12, 12, 20), 3));
    expect(text).toContain(
      'Maior sequência desperdiçando, em horas de jogo: food 0, wood 9, stone 0 (meta do GDD §15.2 para 2 sessões por dia: até 8)\n',
    );
    expect(formatSummary(withWaste(wood(0, 5), 0.5))).toContain('food 0, wood 0,5, stone 0');
  });
});
