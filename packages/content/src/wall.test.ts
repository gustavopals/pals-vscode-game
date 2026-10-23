import { describe, expect, it } from 'vitest';

import { balance, buildings, DIFFICULTY_IDS } from './index';
import { BalanceSchema, BuildingsSchema } from './schemas';

function growRounded(value: number, num: number, den: number, steps: number): number {
  return Math.floor((2 * value * num ** steps + den ** steps) / (2 * den ** steps));
}

describe('Muralha de Pedra, Baluarte e Torre Nv3+ (V4E-T1.1; ADR 0020)', () => {
  const { construction, storage, difficulties } = balance;

  it('o conteúdo vale pelos schemas', () => {
    expect(BuildingsSchema.safeParse(buildings).error).toBeUndefined();
    expect(BalanceSchema.safeParse(balance).error).toBeUndefined();
  });

  it('regra 6: nada acima do nível 2 aparece ao jogador (o teto continua 2)', () => {
    expect(buildings.palisade.maxLevel).toBe(2);
    expect(buildings.watchtower.maxLevel).toBe(2);
    expect(balance.threat.watchtowerLevels).toHaveLength(2);
    expect(balance.threat.palisadeLevels).toHaveLength(2);
  });

  it('a Paliçada: nomes por faixa e o ouro de 2.000, 6.000, 18.000 e 54.000', () => {
    const levels = buildings.palisade.futureLevels ?? [];
    expect(levels.map((level) => level.label)).toEqual([
      'Muralha de Pedra',
      'Muralha de Pedra',
      'Baluarte',
      'Baluarte',
    ]);
    expect(levels.map((level) => level.cost.gold)).toEqual([2_000, 6_000, 18_000, 54_000]);
    expect(levels[0]?.cost).toEqual({ wood: 300, stone: 450, gold: 2_000 });
    expect(levels[0]?.durationMs).toBe(60 * 60_000);
  });

  it('madeira e pedra crescem × 1,6 por nível a partir de 300 e 450; o tempo, × 1,5', () => {
    const levels = buildings.palisade.futureLevels ?? [];
    levels.forEach((level, index) => {
      expect(level.cost.wood, `madeira ${index + 3}`).toBe(growRounded(300, 8, 5, index));
      expect(level.cost.stone, `pedra ${index + 3}`).toBe(growRounded(450, 8, 5, index));
      expect(level.durationMs, `tempo ${index + 3}`).toBe(
        Math.floor((60 * 60_000 * 3 ** index) / 2 ** index),
      );
    });
  });

  it('a Torre Nv3 a Nv5 sai da regra geral a partir do Nv2', () => {
    const def = buildings.watchtower;
    expect(def.futureLevels).toHaveLength(3);
    (def.futureLevels ?? []).forEach((level, index) => {
      const steps = index + 2;
      for (const [resource, base] of Object.entries(def.baseCost)) {
        const key = resource as 'wood' | 'stone' | 'gold';
        expect(level.cost[key], `${key} nível ${index + 3}`).toBe(
          growRounded(base, construction.costFactor.num, construction.costFactor.den, steps),
        );
      }
      expect(level.durationMs).toBe(
        Math.floor(
          (def.baseDurationMs * construction.timeFactor.num ** steps) /
            construction.timeFactor.den ** steps,
        ),
      );
    });
  });

  it('a Torre: 3, 4 e 5 h reais, o dano de 12 × (nível − 2) e o que revela da composição', () => {
    const levels = balance.threat.futureWatchtowerLevels ?? [];
    expect(levels.map((level) => level.warningRealMs / 3_600_000)).toEqual([3, 4, 5]);
    expect(levels.map((level) => level.towerDamage)).toEqual(
      [3, 4, 5].map((level) => balance.battle.towers.damagePerLevel * (level - 2)),
    );
    expect(levels.map((level) => level.composition)).toEqual([
      'archetypes',
      'approximate',
      'exact',
    ]);
    expect(balance.battle.towers.fromLevel).toBe(3);
  });

  it('a vida por ala: 60 e 100 nos dois primeiros níveis, e só cresce', () => {
    const { hpByLevel } = balance.wall;
    expect(hpByLevel).toHaveLength(6);
    expect(hpByLevel.slice(0, 2)).toEqual([60, 100]);
    hpByLevel.forEach((hp, index) => {
      expect(hp).toBeGreaterThan(hpByLevel[index - 1] ?? 0);
    });
  });

  it('o reparo: metade da pedra, ouro igual à pedra, 15 min por 25%', () => {
    expect(balance.wall.repair).toEqual({
      stoneRatio: { num: 1, den: 2 },
      goldRatio: { num: 1, den: 1 },
      quarterMs: 15 * 60_000,
    });
  });

  it('todo nível novo cabe no depósito nas três dificuldades, com o Armazém que o Salão daquele nível deixa erguer', () => {
    const warehouse = storage.buildings.warehouse;
    if (warehouse === undefined) {
      throw new Error('Falta o Armazém no conteúdo.');
    }
    const tooBig: string[] = [];
    for (const id of ['palisade', 'watchtower'] as const) {
      const def = buildings[id];
      (def.futureLevels ?? []).forEach((level, index) => {
        const target = def.maxLevel + 1 + index;
        const townHall = Math.max(
          def.requires.townHall ?? 1,
          target - construction.gateLevelsAboveTownHall,
        );
        expect(townHall, `${id} ${target}`).toBeLessThanOrEqual(buildings.townHall.maxLevel);
        const warehouseLevel = Math.min(
          buildings.warehouse.maxLevel,
          townHall + construction.gateLevelsAboveTownHall,
        );
        const stored = warehouse.level1 + warehouse.perLevel * (warehouseLevel - 1);
        expect(level.durationMs).toBeLessThanOrEqual(construction.maxDurationMs);
        for (const difficulty of DIFFICULTY_IDS) {
          const factor = difficulties[difficulty].storageCapacity;
          const cap = Math.floor((stored * factor.num) / factor.den);
          for (const resource of warehouse.resources) {
            if ((level.cost[resource] ?? 0) > cap) {
              tooBig.push(`${id} ${target} ${difficulty} ${resource}`);
            }
          }
        }
      });
    }
    expect(tooBig).toEqual([]);
  });
});
