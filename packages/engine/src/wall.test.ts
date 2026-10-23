import { balance, buildings } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import {
  palisadeStoneAtLevel,
  wallFullHp,
  wallHpPerWing,
  wallRepairQuote,
  wallTotalHp,
} from './wall';

describe('muralha: a vida por nível (V4E-T1.3, contas puras)', () => {
  it('o nível 0 não tem muralha; os níveis seguem a tabela e o teto repete o último', () => {
    expect(wallHpPerWing(0)).toBe(0);
    expect(wallHpPerWing(1)).toBe(60);
    expect(wallHpPerWing(2)).toBe(100);
    expect(wallHpPerWing(6)).toBe(800);
    expect(wallHpPerWing(9)).toBe(800);
    expect(wallFullHp(3)).toEqual({ left: 200, center: 200, right: 200 });
    expect(wallTotalHp(3)).toBe(600);
  });
});

describe('muralha: o reparo', () => {
  it('a pedra do nível: base no 1, base × 1,6 no 2 e a tabela da Muralha dali em diante', () => {
    expect([1, 2, 3, 4, 5, 6].map(palisadeStoneAtLevel)).toEqual([50, 80, 450, 720, 1152, 1843]);
    expect(palisadeStoneAtLevel(0)).toBe(0);
  });

  it('reparar tudo custa metade da pedra do nível e ouro igual à pedra', () => {
    expect(wallRepairQuote(3, wallTotalHp(3))).toEqual({
      stone: 225,
      gold: 225,
      durationMs: 12 * balance.wall.repair.quarterMs,
    });
  });

  it('é proporcional ao que falta, arredondado para cima: 25% de uma ala leva um quarto de hora', () => {
    const quote = wallRepairQuote(3, 50);
    expect(quote.durationMs).toBe(15 * 60_000);
    expect(quote.stone).toBe(Math.ceil((225 * 50) / 600));
    expect(quote.gold).toBe(quote.stone);
    expect(wallRepairQuote(3, 1).durationMs).toBe(Math.ceil((4 * 15 * 60_000) / 200));
  });

  it('nada faltando, sem muralha ou falta além do total: zero ou o total', () => {
    expect(wallRepairQuote(3, 0)).toEqual({ stone: 0, gold: 0, durationMs: 0 });
    expect(wallRepairQuote(0, 40)).toEqual({ stone: 0, gold: 0, durationMs: 0 });
    expect(wallRepairQuote(2, 9999)).toEqual(wallRepairQuote(2, wallTotalHp(2)));
  });

  it('a pedra e o prazo só crescem com o que falta', () => {
    let previous = wallRepairQuote(5, 0);
    for (let missing = 1; missing <= wallTotalHp(5); missing += 37) {
      const quote = wallRepairQuote(5, missing);
      expect(quote.stone).toBeGreaterThanOrEqual(previous.stone);
      expect(quote.durationMs).toBeGreaterThanOrEqual(previous.durationMs);
      previous = quote;
    }
  });

  it('a tabela de pedra confere com o conteúdo', () => {
    expect(buildings.palisade.futureLevels?.map((level) => level.cost.stone)).toEqual([
      450, 720, 1152, 1843,
    ]);
  });
});
