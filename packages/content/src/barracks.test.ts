import { describe, expect, it } from 'vitest';

import {
  balance,
  BUILDING_IDS,
  buildings,
  chronicleTemplates,
  COUNTER_CYCLE,
  DIFFICULTY_IDS,
  EVENT_TYPES,
  UNIT_IDS,
  units,
} from './index';
import { BalanceSchema, BuildingsSchema, UnitsSchema } from './schemas';

describe('Quartel (GDD §6.1 e §6.2; ADR 0019, decisão 7)', () => {
  const { army, storage, difficulties, construction } = balance;

  it('o edifício: nasce no nível 0, pede o Salão no nível 4, custa 150, 150 e 100, leva 20 min e vai ao nível 8', () => {
    expect(BUILDING_IDS).toContain('barracks');
    expect(BuildingsSchema.safeParse(buildings).error).toBeUndefined();
    const def = buildings.barracks;
    expect(def.initialLevel).toBe(0);
    expect(def.maxLevel).toBe(8);
    expect(def.requires).toEqual({ townHall: 4 });
    expect(def.baseCost).toEqual({ wood: 150, stone: 150, gold: 100 });
    expect(def.baseDurationMs).toBe(20 * 60_000);
    expect(def.produces).toBeNull();
  });

  it('o exército: 10 por nível, 5% por nível, lotes de até 10, 1,5 de comida por hora', () => {
    expect(BalanceSchema.safeParse(balance).error).toBeUndefined();
    expect(army).toEqual({
      capPerLevel: 10,
      trainingSpeedPerLevel: { num: 1, den: 20 },
      batchMax: 10,
      foodPerSoldierPerHour: { num: 3, den: 2 },
      // As formações salvas (V4C-T2; ADR 0019, decisão 9).
      formationsCap: 5,
      postMax: 20,
      postMaxFromLevel: { level: 5, max: 30 },
      formationNameMinLength: 1,
      formationNameMaxLength: 30,
    });
  });

  it('cada nível do Quartel cabe no depósito nas três dificuldades, com o Armazém que o Salão daquele nível deixa erguer', () => {
    const def = buildings.barracks;
    const { num, den } = construction.costFactor;
    const warehouse = storage.buildings.warehouse;
    if (warehouse === undefined) {
      throw new Error('Falta o Armazém no conteúdo.');
    }
    const tooBig: string[] = [];
    for (let target = 1; target <= def.maxLevel; target += 1) {
      const steps = target - 1;
      const cost = Object.fromEntries(
        Object.entries(def.baseCost).map(([resource, base]) => [
          resource,
          Math.floor((2 * base * num ** steps + den ** steps) / (2 * den ** steps)),
        ]),
      );
      const townHall = Math.max(
        def.requires.townHall ?? 1,
        target - construction.gateLevelsAboveTownHall,
      );
      expect(townHall, `nível ${target}`).toBeLessThanOrEqual(buildings.townHall.maxLevel);
      const level = Math.min(
        buildings.warehouse.maxLevel,
        townHall + construction.gateLevelsAboveTownHall,
      );
      const stored = warehouse.level1 + warehouse.perLevel * (level - 1);
      for (const id of DIFFICULTY_IDS) {
        const factor = difficulties[id].storageCapacity;
        const cap = Math.floor((stored * factor.num) / factor.den);
        for (const resource of warehouse.resources) {
          if ((cost[resource] ?? 0) > cap) {
            tooBig.push(`${id} ${target}`);
            break;
          }
        }
      }
    }
    // Com 250 de madeira no nível 1 (o número do ADR 0019) o nível 8 não cabia em Camponês nem
    // em Senhor, e o 7 e o 8 não cabiam em Rei de Ferro. O autor respondeu à pendência C-1 em
    // 2026-10-21: a madeira-base passa a 150, e todo nível cabe.
    expect(tooBig).toEqual([]);
  });
});

describe('unidades (GDD §10.2)', () => {
  it('são cinco, na ordem da tabela, e a forma do conteúdo vale', () => {
    expect(UNIT_IDS).toEqual(['spearman', 'swordsman', 'archer', 'knight', 'shieldbearer']);
    expect(UnitsSchema.safeParse(units).error).toBeUndefined();
    expect(Object.keys(units)).toEqual([...UNIT_IDS]);
  });

  it('os números são os da tabela do GDD §10.2', () => {
    const row = (id: (typeof UNIT_IDS)[number]) => {
      const def = units[id];
      return [def.attack, def.defense, def.health, def.initiative, def.line, def.trainMs / 60_000];
    };
    expect(row('spearman')).toEqual([6, 4, 20, 3, 'front', 10]);
    expect(row('swordsman')).toEqual([8, 5, 24, 3, 'front', 12]);
    expect(row('archer')).toEqual([7, 2, 16, 4, 'back', 10]);
    expect(row('knight')).toEqual([10, 6, 30, 5, 'front', 15]);
    expect(row('shieldbearer')).toEqual([3, 9, 30, 2, 'front', 12]);
    expect(units.spearman.cost).toEqual({ food: 30, gold: 10, wood: 5 });
    expect(units.swordsman.cost).toEqual({ food: 40, gold: 20 });
    expect(units.swordsman.weapons).toBe(1);
    expect(units.knight.cost).toEqual({ food: 60, gold: 60 });
    expect(units.knight.weapons).toBe(1);
    expect(units.shieldbearer.cost).toEqual({ food: 40, gold: 15, wood: 10, stone: 5 });
  });

  it('nenhuma unidade custa ferro direto; o ferro entra pela arma inteira', () => {
    for (const id of UNIT_IDS) {
      expect(Object.keys(units[id].cost), id).not.toContain('iron');
      expect(Number.isInteger(units[id].weapons), id).toBe(true);
    }
    expect(UNIT_IDS.filter((id) => units[id].weapons > 0)).toEqual(['swordsman', 'knight']);
  });

  it('o ciclo de contra-ataques fecha em quatro e o Escudeiro é neutro', () => {
    expect(COUNTER_CYCLE).toEqual(['swordsman', 'spearman', 'knight', 'archer']);
    COUNTER_CYCLE.forEach((id, index) => {
      expect(units[id].counters).toBe(COUNTER_CYCLE[(index + 1) % COUNTER_CYCLE.length]);
    });
    expect(units.shieldbearer.counters).toBeNull();
    const beaten = UNIT_IDS.map((id) => units[id].counters).filter((id) => id !== null);
    expect(new Set(beaten).size).toBe(beaten.length);
  });

  it('as frases da Crônica do Quartel dizem a tropa pronta, no plural certo', () => {
    for (const type of [
      'trainingStarted',
      'trainingCancelled',
      'soldiersTrained',
      'trainingShortfall',
      'soldiersDisbanded',
    ] as const) {
      expect(EVENT_TYPES).toContain(type);
      expect(chronicleTemplates[type]).toContain('{tropa}');
    }
  });
});
