import { describe, expect, it } from 'vitest';

import {
  balance,
  BUILDING_IDS,
  buildings,
  chronicleTemplates,
  DIFFICULTY_IDS,
  EVENT_TYPES,
  ITEM_RARITY_IDS,
  itemRarities,
} from './index';
import { BalanceSchema, BuildingsSchema, ItemRaritiesSchema } from './schemas';

describe('Ferreiro (GDD §5.1, §6.1 e §6.2; ADR 0019, decisão 4)', () => {
  const { smithy, storage, difficulties, construction } = balance;

  it('o edifício: nasce no nível 0, pede o Salão no nível 4, custa 200, 200 e 150, leva 20 min e vai ao nível 6', () => {
    expect(BUILDING_IDS).toContain('smithy');
    expect(BuildingsSchema.safeParse(buildings).error).toBeUndefined();
    const def = buildings.smithy;
    expect(def.initialLevel).toBe(0);
    expect(def.maxLevel).toBe(6);
    expect(def.requires).toEqual({ townHall: 4 });
    expect(def.baseCost).toEqual({ wood: 200, stone: 200, gold: 150 });
    expect(def.baseDurationMs).toBe(20 * 60_000);
    expect(def.produces).toBeNull();
    expect(def.maxLevelNote).toBeUndefined();
  });

  it('a forja: 2 de ferro e 1 de madeira por arma, 6 min de jogo, +1/10 por nível, lotes de até 10', () => {
    expect(BalanceSchema.safeParse(balance).error).toBeUndefined();
    expect(smithy).toEqual({
      weaponsLabel: 'Armas',
      recipe: { iron: 2, wood: 1 },
      perWeaponMs: 6 * 60_000,
      speedPerLevel: { num: 1, den: 10 },
      batchMax: 10,
    });
  });

  it('cada nível do Ferreiro cabe no depósito nas três dificuldades, com o Armazém que o Salão daquele nível deixa erguer', () => {
    const def = buildings.smithy;
    const { num, den } = construction.costFactor;
    const warehouse = storage.buildings.warehouse;
    if (warehouse === undefined) {
      throw new Error('Falta o Armazém no conteúdo.');
    }
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
          expect(cost[resource] ?? 0, `nível ${target}, ${id}, ${resource}`).toBeLessThanOrEqual(
            cap,
          );
        }
      }
    }
  });

  it('o lote cabe no depósito e as frases da Crônica dizem a quantidade', () => {
    const warehouse = storage.buildings.warehouse;
    expect(smithy.batchMax * smithy.recipe.iron).toBeLessThanOrEqual(warehouse?.level1 ?? 0);
    for (const type of ['forgeStarted', 'forgeCancelled', 'weaponsForged'] as const) {
      expect(EVENT_TYPES).toContain(type);
      expect(chronicleTemplates[type]).toContain('{quantidade}');
    }
  });
});

describe('desgaste e reparo do equipamento (GDD §9.1; ADR 0019, decisão 5)', () => {
  const { equipment } = balance;

  it('a durabilidade por raridade é 8, 10, 14 e 20 usos', () => {
    expect(ItemRaritiesSchema.safeParse(itemRarities).error).toBeUndefined();
    expect(
      Object.fromEntries(ITEM_RARITY_IDS.map((id) => [id, itemRarities[id].durability])),
    ).toEqual({ common: 8, uncommon: 10, rare: 14, epic: 20 });
  });

  it('o desgaste é 1 ponto por expedição; o reparo, 1 ou 2 de ferro por ponto e 2 min de jogo por ponto', () => {
    expect(BalanceSchema.safeParse(balance).error).toBeUndefined();
    expect(equipment.wearPerExpedition).toBe(1);
    expect(equipment.repair).toEqual({
      ironPerPoint: { common: 1, uncommon: 1, rare: 2, epic: 2 },
      msPerPoint: 2 * 60_000,
    });
  });

  it('o ferro de um reparo inteiro, de qualquer raridade, cabe no depósito', () => {
    const warehouse = balance.storage.buildings.warehouse;
    for (const id of ITEM_RARITY_IDS) {
      const cost = itemRarities[id].durability * equipment.repair.ironPerPoint[id];
      expect(cost, id).toBeLessThanOrEqual(warehouse?.level1 ?? 0);
    }
  });

  it('as frases da Crônica do desgaste e do reparo existem e dizem o item', () => {
    for (const type of ['itemWorn', 'repairStarted', 'itemRepaired'] as const) {
      expect(EVENT_TYPES).toContain(type);
      expect(chronicleTemplates[type]).toContain('{item}');
    }
    expect(chronicleTemplates.repairStarted).toContain('{quantidade}');
  });
});
