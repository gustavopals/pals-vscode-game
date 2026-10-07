import { describe, expect, it } from 'vitest';

import {
  balance,
  CHRONICLE_PLACEHOLDERS,
  chronicleTemplates,
  EVENT_TYPES,
  expeditionModels,
  expeditionTexts,
  heroNames,
  MASTER_IDS,
  masters,
  masterTemplates,
  masterTexts,
  namedHeroes,
  PRODUCTION_BUILDING_IDS,
} from './index';
import {
  BalanceSchema,
  expeditionModelsSchema,
  MastersSchema,
  MasterTemplatesSchema,
  MasterTextsSchema,
} from './schemas';

describe('Mestres (GDD §5.4; ADR 0018, decisão 18)', () => {
  it('os números do ADR: +15%, um por edifício, adaptação de um dia de jogo', () => {
    expect(BalanceSchema.safeParse(balance).error).toBeUndefined();
    expect(balance.masters.bonus).toEqual({ num: 3, den: 20 });
    expect(balance.masters.maxPerBuilding).toBe(1);
    expect(balance.masters.adaptationMs).toBe(balance.calendar.dayMs);
    // A adaptação do Mestre é a de quem troca de ofício: o mesmo dia de jogo.
    expect(balance.masters.adaptationMs).toBe(balance.craft.adaptationMs);
  });

  it('os ids publicados estão fixados: mudar um pede passo de migração', () => {
    expect(MASTER_IDS).toEqual(['odo', 'berta', 'gil', 'ximena']);
  });

  it('a ficha: nome, tratamento e ofício de origem, um de cada edifício produtivo', () => {
    expect(MastersSchema.safeParse(masters).error).toBeUndefined();
    expect(masters.odo).toEqual({
      name: 'Odo',
      gender: 'm',
      origin: 'quarry',
      originText: 'canteiro das pedreiras velhas',
    });
    expect(MASTER_IDS.map((id) => masters[id].origin).sort()).toEqual(
      [...PRODUCTION_BUILDING_IDS].sort(),
    );
    expect(
      MastersSchema.safeParse({ ...masters, odo: { ...masters.odo, origin: 'tavern' } }).success,
    ).toBe(false);
  });

  it('o teto nunca tira a recompensa de ninguém: todo Mestre com nome cabe nele, e há edifício para todos', () => {
    expect(MASTER_IDS.length).toBeLessThanOrEqual(balance.masters.rosterCap);
    expect(balance.masters.rosterCap).toBeLessThanOrEqual(
      PRODUCTION_BUILDING_IDS.length * balance.masters.maxPerBuilding,
    );
  });

  it('nenhum Mestre tem o nome de um herói: a Crônica nunca fala de dois com o mesmo nome', () => {
    const names = MASTER_IDS.map((id) => masters[id].name);
    expect(new Set(names).size).toBe(names.length);
    const heroes = [
      ...heroNames.map((entry) => entry.name),
      ...Object.values(namedHeroes).map((hero) => hero.name),
    ];
    expect(names.filter((name) => heroes.includes(name))).toEqual([]);
  });

  it('as linhas da Crônica existem, dizem de quem falam e a alocação diz onde', () => {
    for (const type of ['masterArrived', 'masterWaiting', 'masterAssigned'] as const) {
      expect(EVENT_TYPES).toContain(type);
      expect(chronicleTemplates[type]).toContain('{mestre}');
    }
    expect(chronicleTemplates.masterAssigned).toContain('{edificio}');
    expect(CHRONICLE_PLACEHOLDERS).toContain('mestre');
    expect(MasterTemplatesSchema.safeParse(masterTemplates).error).toBeUndefined();
    expect(
      MasterTemplatesSchema.safeParse({ ...masterTemplates, released: 'Alguém largou o ofício.' })
        .success,
    ).toBe(false);
  });

  it('as frases da tela não escrevem número de regra', () => {
    expect(MasterTextsSchema.safeParse(masterTexts).error).toBeUndefined();
    expect(
      MasterTextsSchema.safeParse({ ...masterTexts, bonus: '+15% na produção.' }).success,
    ).toBe(false);
    expect(expeditionTexts.reportMaster).toContain('{mestre}');
  });

  it('no catálogo: Odo nos três guardiões das Ruínas (1 em 4) e Berta nos três chefes do Pântano (1 em 3), sempre no último nó com prova', () => {
    expect(
      expeditionModelsSchema(balance.expeditions).safeParse(expeditionModels).error,
    ).toBeUndefined();
    const found: Array<[string, number, string, string, number]> = [];
    for (const model of expeditionModels) {
      for (const [index, variant] of model.variants.entries()) {
        for (const node of Object.values(variant.nodes)) {
          if (node.kind === 'crossroads' || node.kind === 'return') {
            continue;
          }
          const drop = node.rewards?.master;
          if (drop === undefined) {
            continue;
          }
          found.push([model.id, index, node.kind, drop.id, drop.chance.num / drop.chance.den]);
          // Depois do Mestre nada mais sorteia na expedição: o nó seguinte é a volta.
          expect(variant.nodes[node.next]?.kind, `${model.id}/${index}`).toBe('return');
          expect(node.trial, `${model.id}/${index}`).toBeDefined();
        }
      }
    }
    expect(found).toEqual([
      ['ruins', 0, 'boss', 'odo', 1 / 4],
      ['ruins', 1, 'boss', 'odo', 1 / 4],
      ['ruins', 2, 'boss', 'odo', 1 / 4],
      ['swamp', 0, 'boss', 'berta', 1 / 3],
      ['swamp', 1, 'boss', 'berta', 1 / 3],
      ['swamp', 2, 'boss', 'berta', 1 / 3],
    ]);
  });
});
