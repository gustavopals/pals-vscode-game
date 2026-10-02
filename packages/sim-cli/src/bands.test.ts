import { describe, expect, it } from 'vitest';

import { type Band, bandFor, cellKey, checkBand, SLACK } from './bands';
import type { Summary } from './report';

const band: Band = {
  villagers: { min: 23, max: 29 },
  townHallMin: 3,
  famineHoursMax: 0,
  coldHoursMax: 0,
  surplusMax: { wood: 10_518, stone: 4_400, gold: 1_719 },
};

/** Uma partida dentro da faixa, com o que cada teste trocar. */
function summary(overrides: Partial<Summary> = {}): Summary {
  return {
    hours: 168,
    villagers: 26,
    capacity: 35,
    townHall: 3,
    famineHours: 0,
    firstFamineHour: null,
    coldHours: 0,
    firstColdHour: null,
    commandsAccepted: 55,
    commandsRefused: 0,
    refusedByCode: {},
    queueIdleHours: 168,
    plannedIdleHours: 0,
    freeVillagerHours: 252,
    freePerHour: 1.5,
    surplus: { wood: 10_017, stone: 4_190, gold: 1_637 },
    wasted: { food: 0, wood: 0, stone: 0 },
    wasteHours: 0,
    stock: { food: 162, wood: 10_017, stone: 4_190, gold: 1_637 },
    ...overrides,
  };
}

describe('conferência de uma partida contra a faixa', () => {
  it('dentro da faixa, nenhum problema; os limites são inclusivos', () => {
    expect(checkBand(band, summary())).toEqual([]);
    expect(checkBand(band, summary({ villagers: 23 }))).toEqual([]);
    expect(checkBand(band, summary({ villagers: 29 }))).toEqual([]);
    expect(
      checkBand(band, summary({ surplus: { wood: 10_518, stone: 4_400, gold: 1_719 } })),
    ).toEqual([]);
  });

  it('falha quando o excedente parado passa do limite, dizendo o material e os dois números', () => {
    expect(
      checkBand(band, summary({ surplus: { wood: 10_519, stone: 4_190, gold: 1_637 } })),
    ).toEqual(['excedente parado de madeira: 10519, acima do limite de 10518']);
    expect(
      checkBand(band, summary({ surplus: { wood: 10_017, stone: 9_000, gold: 2_000 } })),
    ).toEqual([
      'excedente parado de pedra: 9000, acima do limite de 4400',
      'excedente parado de ouro: 2000, acima do limite de 1719',
    ]);
  });

  it('excedente menor do que o medido nunca é problema: a faixa só tem teto', () => {
    expect(checkBand(band, summary({ surplus: { wood: 0, stone: 0, gold: 0 } }))).toEqual([]);
  });

  it('falha com população fora da faixa, para menos e para mais', () => {
    expect(checkBand(band, summary({ villagers: 22 }))).toEqual([
      'população 22, fora da faixa de 23 a 29',
    ]);
    expect(checkBand(band, summary({ villagers: 30 }))).toEqual([
      'população 30, fora da faixa de 23 a 29',
    ]);
  });

  it('falha com o Salão abaixo do nível medido e com mais fome do que a medida', () => {
    expect(checkBand(band, summary({ townHall: 2 }))).toEqual([
      'Salão no nível 2, abaixo do nível 3',
    ]);
    expect(checkBand(band, summary({ townHall: 6 }))).toEqual([]);
    expect(checkBand(band, summary({ famineHours: 4, firstFamineHour: 30 }))).toEqual([
      '4 h de fome, acima do limite de 0 h',
    ]);
  });

  it('falha com mais horas de frio do que as medidas', () => {
    expect(checkBand(band, summary({ coldHours: 3, firstColdHour: 150 }))).toEqual([
      '3 h de frio, acima do limite de 0 h',
    ]);
    expect(
      checkBand({ ...band, coldHoursMax: 3 }, summary({ coldHours: 3, firstColdHour: 150 })),
    ).toEqual([]);
  });

  it('falha com qualquer ordem recusada, dizendo os códigos', () => {
    expect(
      checkBand(band, summary({ commandsRefused: 3, refusedByCode: { QUEUE_BUSY: 2, FAMINE: 1 } })),
    ).toEqual(['3 ordens recusadas pelo motor (FAMINE:1;QUEUE_BUSY:2)']);
  });
});

describe('faixas a partir da linha de base medida', () => {
  it('a folga é pequena e explícita: 10% na população, 5% nos tetos', () => {
    expect(SLACK).toEqual({ villagersPercent: 10, ceilingPercent: 5 });
    // Regular, 7 dias reais, ritmo 3: 64 aldeões, Salão Nv7, o Armazém no nível máximo e cheio
    // (5.100 de madeira e 5.100 de pedra) e 9.409 de ouro parado.
    expect(bandFor(cellKey('week', 3, 'regular'))).toEqual({
      villagers: { min: 57, max: 71 },
      townHallMin: 7,
      famineHoursMax: 0,
      coldHoursMax: 0,
      surplusMax: { wood: 5_355, stone: 5_355, gold: 9_880 },
    });
  });

  it('só há faixa na dificuldade Senhor e nos ritmos medidos', () => {
    expect(bandFor(cellKey('week', 3, 'regular'), 'lord')).not.toBeNull();
    expect(bandFor(cellKey('week', 3, 'regular'), 'peasant')).toBeNull();
    expect(bandFor(cellKey('week', 3, 'regular'), 'ironKing')).toBeNull();
    expect(bandFor(cellKey('week', 2, 'regular'))).toBeNull();
  });
});
