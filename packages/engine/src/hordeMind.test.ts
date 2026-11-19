import { balance, HORDE_UNIT_IDS, hordeBaseMix } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import {
  compositionWeights,
  drawComposition,
  omenChancePercent,
  omenClarity,
  omenText,
  summarizeFormation,
  type Draw,
} from './hordeMind';
import { nextUint32, seedStream } from './random';

/** Um gerador de teste sobre o xoshiro do motor, com a rejeição do `nextInt`. */
function drawFor(seed: string): Draw {
  const words = seedStream(seed, 'horde');
  return (max) => {
    const limit = 0x1_0000_0000 - (0x1_0000_0000 % max);
    let value = nextUint32(words);
    while (value >= limit) {
      value = nextUint32(words);
    }
    return value % max;
  };
}

const archers = summarizeFormation([
  { unit: 'archer', count: 18 },
  { unit: 'shieldbearer', count: 2 },
]);

describe('A Horda que aprende (V4E-T3, parte pura)', () => {
  it('resume a formação por arquétipo e ignora postos vazios', () => {
    expect(
      summarizeFormation([
        { unit: 'archer', count: 5 },
        { unit: 'archer', count: 3 },
        { unit: 'spearman', count: 0 },
      ]),
    ).toEqual({ total: 8, byUnit: { archer: 8 } });
    expect(summarizeFormation([])).toBeNull();
  });

  it('sem memória, os pesos são os da estação', () => {
    const { weights, scale } = compositionWeights('autumn', 'lord', null);
    expect(scale).toBe(1);
    expect(weights).toEqual(hordeBaseMix.autumn);
  });

  it('a formação de arqueiros aumenta lobos e cavalaria (critério 3)', () => {
    const blank = compositionWeights('autumn', 'lord', null);
    const learned = compositionWeights('autumn', 'lord', archers);
    const ratio = (id: 'wolf' | 'blackKnight' | 'raider', w: typeof blank) =>
      (w.weights[id] ?? 0) / w.scale;
    // Senhor: astúcia 1/2; 18 de 20 arqueiros: +100 × 1/2 × 9/10 = +45 aos arquétipos cavaleiro.
    expect(ratio('blackKnight', learned)).toBeCloseTo(25 + 45);
    expect(ratio('blackKnight', learned)).toBeGreaterThan(ratio('blackKnight', blank));
    expect(ratio('raider', learned)).toBe(35);
    const spring = compositionWeights('spring', 'lord', archers);
    expect((spring.weights.wolf ?? 0) / spring.scale).toBeCloseTo(70 + 45);
    expect(spring.weights.blackKnight).toBeUndefined();
  });

  it('a memória anterior soma metade da adaptação, sem reduzir a do ano corrente', () => {
    const previous = { total: 3, byUnit: { archer: 3 } } as const;
    const half = compositionWeights('autumn', 'lord', null, undefined, previous);
    expect(half.weights.blackKnight! / half.scale).toBe(25 + 25);
    const both = compositionWeights('autumn', 'lord', archers, undefined, previous);
    expect(both.weights.blackKnight! / both.scale).toBe(25 + 45 + 25);
  });

  it('a astúcia cresce com a dificuldade', () => {
    const at = (d: 'peasant' | 'lord' | 'ironKing') =>
      (compositionWeights('summer', d, archers).weights.wolf ?? 0) /
      compositionWeights('summer', d, archers).scale;
    expect(at('peasant')).toBeLessThan(at('lord'));
    expect(at('lord')).toBeLessThan(at('ironKing'));
  });

  it('a mesma memória e a mesma semente dão a mesma composição', () => {
    const weights = compositionWeights('autumn', 'ironKing', archers);
    const a = drawComposition(weights, 60, drawFor('semente-1'));
    const b = drawComposition(weights, 60, drawFor('semente-1'));
    expect(a).toEqual(b);
    expect(Object.values(a).reduce((x, y) => x + y, 0)).toBe(60);
    const c = drawComposition(weights, 60, drawFor('semente-2'));
    expect(c).not.toEqual(a);
  });

  it('com muitos arqueiros vistos, a composição tem mais lobos e cavaleiros que sem memória', () => {
    const count = (comp: Partial<Record<(typeof HORDE_UNIT_IDS)[number], number>>) =>
      (comp.wolf ?? 0) + (comp.blackKnight ?? 0);
    const draw = (memory: typeof archers, seed: string) =>
      drawComposition(compositionWeights('autumn', 'ironKing', memory), 400, drawFor(seed));
    expect(count(draw(archers, 'x'))).toBeGreaterThan(count(draw(null, 'x')));
  });

  it('sem peso nenhum não gasta o gerador', () => {
    let calls = 0;
    const result = drawComposition({ weights: {}, scale: 1 }, 5, (max) => {
      calls += 1;
      return max - 1;
    });
    expect(result).toEqual({});
    expect(calls).toBe(0);
  });

  it('a chance do presságio segue a Torre e respeita o teto', () => {
    expect([1, 2, 3, 4, 5].map(omenChancePercent)).toEqual([35, 45, 55, 65, 75]);
    expect(omenChancePercent(50)).toBe(balance.omens.maxChancePercent);
    expect([1, 2, 3, 4, 5, 9].map(omenClarity)).toEqual([
      'vague',
      'vague',
      'partial',
      'partial',
      'exact',
      'exact',
    ]);
  });

  it('o presságio diz só o que a onda tem', () => {
    const wave = {
      number: 2,
      mainWing: 'left',
      composition: { wolf: 31, raider: 10, shaman: 1 },
    } as const;
    expect(omenText(wave, 'vague')).toBe(
      'Corvos voam do norte em bandos: a Horda trará muitas feras.',
    );
    expect(omenText(wave, 'partial')).toBe(
      'Os vigias contam cerca de 30 lobos rumando para o vale, pela ala esquerda, na segunda noite.',
    );
    expect(omenText(wave, 'exact')).toBe(
      'Um desertor desenha no chão, para a segunda onda: 31 lobos, 10 saqueadores e 1 xamã.',
    );
    expect(omenText({ number: 1, mainWing: 'center', composition: {} }, 'exact')).toBeNull();
  });
});
