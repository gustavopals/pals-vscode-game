import { describe, expect, it } from 'vitest';

import {
  balance,
  chronicleTemplates,
  DIFFICULTY_IDS,
  equipmentTexts,
  type ExpeditionModelDef,
  expeditionModels,
  type ExpeditionStageNode,
  HERO_TRAIT_IDS,
  guildTexts,
  heroDismissalTemplates,
  heroHarmTemplates,
  heroTraits,
  ITEM_IDS,
  ITEM_RARITY_IDS,
  ITEM_SLOT_IDS,
  itemRarities,
  items,
  itemSlots,
  startingTiles,
} from './index';
import {
  BalanceSchema,
  EquipmentTextsSchema,
  expeditionModelsSchema,
  HeroHarmTemplatesSchema,
  ItemRaritiesSchema,
  ItemsSchema,
  ItemSlotsSchema,
} from './schemas';

/**
 * O conteúdo dos desfechos (V3D-T2; ADR 0017, decisão 8 e "Os oito traços"; ADR 0018, decisões
 * 14 e 15): ferimentos, captura por dificuldade, experiência, itens, destinos revelados e o
 * Covil limpo.
 */

const HOUR = 3_600_000;
const MINUTE = 60_000;
type Loose = Record<string, unknown>;

const modelOf = (id: string): ExpeditionModelDef => {
  const model = expeditionModels.find((entry) => entry.id === id);
  if (model === undefined) {
    throw new Error(`Modelo ${id} fora do catálogo.`);
  }
  return model;
};

const stagesOf = (model: ExpeditionModelDef): ExpeditionStageNode[] =>
  model.variants.flatMap((variant) =>
    Object.values(variant.nodes).filter(
      (node): node is ExpeditionStageNode => node.kind !== 'crossroads' && node.kind !== 'return',
    ),
  );

const ratioOf = ({ num, den }: { num: number; den: number }) => num / den;

describe('ferimento, captura e morte (ADR 0017, decisão 8)', () => {
  it('o ferimento leve dura 2 h de jogo e o grave, 12 h de jogo', () => {
    expect(balance.injuries.durationMs).toEqual({ light: 2 * HOUR, severe: 12 * HOUR });
  });

  it('no sorteio de quem sofre, o Corajoso pesa 6 contra 5 dos outros', () => {
    expect(balance.injuries.harmWeight).toBe(5);
    expect(heroTraits.brave.effects.harmWeight).toBe(6);
    const others = HERO_TRAIT_IDS.filter(
      (id) => id !== 'brave' && heroTraits[id].effects.harmWeight !== undefined,
    );
    expect(others).toEqual([]);
  });

  it('onde o nó marca captura: Camponês fere, Senhor captura, Rei de Ferro mata', () => {
    expect(DIFFICULTY_IDS.map((id) => balance.difficulties[id].heroCapture)).toEqual([
      'injury',
      'capture',
      'death',
    ]);
  });

  it('cada caso tem frase própria na Crônica, e nenhuma flexiona o herói', () => {
    expect(HeroHarmTemplatesSchema.safeParse(heroHarmTemplates).error).toBeUndefined();
    expect(Object.keys(heroHarmTemplates)).toEqual(['light', 'severe', 'spared']);
    const phrases = [
      ...Object.values(heroHarmTemplates),
      chronicleTemplates.heroInjured,
      chronicleTemplates.heroRecovered,
      chronicleTemplates.heroCaptured,
      chronicleTemplates.heroDied,
      chronicleTemplates.heroRescued,
      chronicleTemplates.heroLeveledUp,
    ];
    for (const phrase of phrases) {
      expect(phrase).toContain('{heroi}');
      // A frase serve a Edda e a Rolf: nada de "ferido", "levado", "pronto" ou "o traz".
      expect(phrase).not.toMatch(/\b(ferido|ferida|levado|levada|pronto|pronta|dele|dela)\b/);
    }
  });

  it('desistir de quem está em cativeiro tem frase própria, com e sem item, e nenhuma flexiona o herói', () => {
    expect(Object.keys(heroDismissalTemplates)).toEqual(['captive', 'captiveWithItems']);
    for (const phrase of Object.values(heroDismissalTemplates)) {
      expect(phrase).toMatch(/^No \{dia\}º dia \{daEstacao\}, /);
      expect(phrase).toContain('{heroi}');
      expect(phrase.replace(/\{(dia|daEstacao|feudo|heroi)\}/g, '')).not.toMatch(/[{}]/);
      expect(phrase).not.toMatch(/\b(ele|ela|dele|dela|preso|presa|o levava|buscá-lo)\b/);
    }
    expect(guildTexts.dismissCaptive).not.toMatch(/\b(ele|dele|buscá-lo|preso)\b/);
  });

  it('o schema recusa ferimento leve mais longo que o grave e dificuldade sem a regra da captura', () => {
    const parse = (edit: (draft: Loose) => void) => {
      const draft = JSON.parse(JSON.stringify(balance)) as Loose;
      edit(draft);
      return BalanceSchema.safeParse(draft).success;
    };
    expect(parse(() => undefined)).toBe(true);
    expect(
      parse((draft) => (((draft.injuries as Loose).durationMs as Loose).light = 13 * HOUR)),
    ).toBe(false);
    expect(parse((draft) => delete ((draft.difficulties as Loose).lord as Loose).heroCapture)).toBe(
      false,
    );
    expect(
      parse((draft) => (((draft.difficulties as Loose).lord as Loose).heroCapture = 'exile')),
    ).toBe(false);
    expect(parse((draft) => ((draft.equipment as Loose).inventoryCap = 0))).toBe(false);
  });
});

describe('os traços cumprem o que a frase promete (ADR 0017, "Os oito traços")', () => {
  it('o Ganancioso traz um quarto a mais de recursos e perde o saque do nó em 10% das vezes', () => {
    expect(heroTraits.greedy.effects.greed).toEqual({ ratio: { num: 5, den: 4 }, lossPercent: 10 });
  });

  it('o Prudente não se fere de leve em nó de perigo, e o Rastreador garante a revelação no Revés', () => {
    expect(heroTraits.prudent.effects.dodgesSetbackIn).toEqual(['hazard']);
    expect(heroTraits.tracker.effects.revealsOnSetback).toBe(true);
  });

  it('o Carismático não promete o que é das cartas do lote 2 (V3F-T1)', () => {
    expect(heroTraits.charismatic.text).not.toMatch(/conselho/i);
    expect(heroTraits.charismatic.text).toMatch(/Taverna/);
  });
});

describe('o equipamento (ADR 0018, decisão 15)', () => {
  it('nenhum item é relíquia: nem a chave, nem o nome, nem a frase repetem as da Capela (revisão da Fase D, B23)', () => {
    // As relíquias do GDD, Apêndice D, são da v0.5: Chifre dos Ancestrais, Coração de Carvalho,
    // Olho do Vigia, Selo do Rei Antigo, Osso de Lobo, Lâmpada do Eremita, Pedra de Sal e Manto
    // do Inverno. Um item que as lembre promete o que esta versão não tem.
    const echoes =
      /rel[ií]quia|\b(selo|sinete|rei|osso de lobo|dente de lobo|chifre|ancestrais|coração de carvalho|olho do vigia|eremita|pedra de sal|manto)\b/i;
    for (const id of ITEM_IDS) {
      expect(id, id).not.toMatch(/relic|signet|king|wolf|bone/i);
      expect(items[id].label, id).not.toMatch(echoes);
      expect(items[id].text, id).not.toMatch(echoes);
    }
  });

  // Em 2026-10-06 (revisão da Fase D, B23) saíram `pilgrimRelic` e `oldKingSignet` e entraram
  // `travelerMedal` e `captainChain`, sem passo de migração: nenhuma versão publicada tem itens
  // (a produção está no estado 12), e nenhum retrato congelado guarda um item com essas chaves.
  it('os ids dos itens estão fixados: ficam gravados no estado', () => {
    expect(ITEM_IDS).toEqual([
      'huntingSpear',
      'ashBow',
      'veltharBlade',
      'emberStaff',
      'paddedJerkin',
      'boiledLeather',
      'riveredMail',
      'wardenPlate',
      'luckyCharm',
      'trackerHorn',
      'travelerMedal',
      'captainChain',
    ]);
    expect(Object.keys(items)).toEqual([...ITEM_IDS]);
  });

  it('três espaços, quatro raridades (sem Lendário), arsenal de 30', () => {
    expect(ITEM_SLOT_IDS).toEqual(['weapon', 'armor', 'accessory']);
    expect(ITEM_RARITY_IDS).toEqual(['common', 'uncommon', 'rare', 'epic']);
    expect(balance.equipment.inventoryCap).toBe(30);
    expect(ItemSlotsSchema.safeParse(itemSlots).error).toBeUndefined();
    expect(ItemRaritiesSchema.safeParse(itemRarities).error).toBeUndefined();
    expect(EquipmentTextsSchema.safeParse(equipmentTexts).error).toBeUndefined();
  });

  it('o catálogo passa pelo schema: cada espaço tem um item de cada raridade', () => {
    expect(ItemsSchema.safeParse(items).error).toBeUndefined();
    for (const slot of ITEM_SLOT_IDS) {
      const rarities = ITEM_IDS.filter((id) => items[id].slot === slot).map(
        (id) => items[id].rarity,
      );
      expect(rarities, slot).toEqual([...ITEM_RARITY_IDS]);
    }
  });

  it('uma raridade maior soma mais poder e vale mais ouro, e ninguém passa de 15%', () => {
    for (const slot of ITEM_SLOT_IDS) {
      const ladder = ITEM_IDS.filter((id) => items[id].slot === slot).map((id) => items[id]);
      for (const [index, item] of ladder.entries()) {
        const previous = ladder[index - 1];
        if (previous !== undefined) {
          expect(ratioOf(item.power)).toBeGreaterThan(ratioOf(previous.power));
          expect(item.value).toBeGreaterThan(previous.value);
        }
        expect(ratioOf(item.power)).toBeLessThanOrEqual(1.15);
      }
    }
  });

  it('nada de desgaste, reparo, venda ou versão futura no item', () => {
    for (const id of ITEM_IDS) {
      expect(Object.keys(items[id])).toEqual(['label', 'text', 'slot', 'rarity', 'power', 'value']);
    }
    expect(JSON.stringify(items)).not.toMatch(/durab|repar|lendári|relíquia/i);
  });

  it('o schema recusa item que tira poder, frase com número, espaço e raridade desconhecidos', () => {
    const parse = (changed: object) =>
      ItemsSchema.safeParse({ ...items, ashBow: { ...items.ashBow, ...changed } }).success;
    expect(parse({})).toBe(true);
    expect(parse({ power: { num: 1, den: 1 } })).toBe(false);
    expect(parse({ text: 'Soma 8% de poder.' })).toBe(false);
    expect(parse({ slot: 'ring' })).toBe(false);
    expect(parse({ rarity: 'legendary' })).toBe(false);
    expect(parse({ durability: 10 })).toBe(false);
    expect(parse({ label: items.huntingSpear.label })).toBe(false);
  });
});

describe('os modelos e os desfechos (ADR 0018, decisões 12 e 14)', () => {
  it('toda prova dá experiência, e a parte dela desce com o desfecho sem zerar', () => {
    for (const model of expeditionModels) {
      for (const node of stagesOf(model)) {
        if (node.trial !== undefined) {
          expect(node.trial.xp, `${model.id}: ${node.title}`).toBeGreaterThan(0);
        }
      }
    }
    expect(balance.expeditions.xpShare).toEqual({
      full: { num: 5, den: 4 },
      success: { num: 1, den: 1 },
      setback: { num: 1, den: 2 },
      disaster: { num: 1, den: 4 },
    });
  });

  it('o Covil de Lobos: 2 h, 2 heróis, risco médio, conhecido desde sempre; o último nó limpa o tile, e lobo não captura', () => {
    const den = modelOf('wolfDen');
    expect(den.durationMs).toBe(2 * HOUR);
    expect(den.requires).toMatchObject({ teamMin: 2, teamMax: 2, guildLevel: 1 });
    expect(den.riskLabel).toBe('Médio');
    expect(den.access).toEqual({ kind: 'tile', tileId: 'wolfDen' });
    expect(startingTiles.map((tile) => tile.id)).toContain('wolfDen');
    for (const variant of den.variants) {
      // A subida, a encruzilhada diante da toca, os três jeitos de acabar o serviço e a volta.
      // O ousado e o do meio limpam o tile; o cauteloso, nunca.
      const clearing = Object.values(variant.nodes).filter(
        (node) => node.kind !== 'crossroads' && node.kind !== 'return' && node.rewards?.clearsTile,
      );
      expect(clearing).toHaveLength(2);
    }
    expect(stagesOf(den).every((node) => node.trial?.onDisaster !== 'capture')).toBe(true);
    expect(balance.threat.tileClearedDrop).toBe(30);
  });

  it('o Resgate: 2 h, 2 heróis, risco alto, só com alguém em cativeiro; os três jeitos de entrar libertam', () => {
    const rescue = modelOf('rescue');
    expect(rescue.durationMs).toBe(2 * HOUR);
    expect(rescue.requires).toMatchObject({ teamMin: 2, teamMax: 2 });
    expect(rescue.riskLabel).toBe('Alto');
    expect(rescue.access).toEqual({ kind: 'captive' });
    for (const variant of rescue.variants) {
      const freeing = Object.values(variant.nodes).filter(
        (node) => node.kind !== 'crossroads' && node.kind !== 'return' && node.rewards?.rescues,
      );
      expect(freeing).toHaveLength(3);
      // O cativeiro é onde o Desastre captura, por qualquer dos três caminhos.
      expect(
        freeing.every(
          (node) =>
            node.kind !== 'crossroads' &&
            node.kind !== 'return' &&
            node.trial?.onDisaster === 'capture',
        ),
      ).toBe(true);
    }
  });

  it('as Ruínas: 3 h, 2 a 3 heróis de nível 2, só depois de reveladas; toda Patrulha as revela', () => {
    const ruins = modelOf('ruins');
    expect(ruins.durationMs).toBe(3 * HOUR);
    expect(ruins.requires).toMatchObject({ teamMin: 2, teamMax: 3, minHeroLevel: 2 });
    expect(ruins.access).toEqual({ kind: 'discovered' });
    for (const variant of modelOf('patrol').variants) {
      const node = variant.nodes[variant.start];
      expect(node?.kind !== 'crossroads' && node?.kind !== 'return' && node?.rewards?.reveals).toBe(
        'ruins',
      );
    }
  });

  it('todo destino por descoberta é revelado por um destino que se alcança a partir de um aberto, e todo tile limpo existe', () => {
    // A Patrulha (aberta) revela as Ruínas, e as Ruínas revelam o Pântano: a cadeia fecha.
    const reachable = new Set<string>(
      expeditionModels.filter((model) => model.access.kind === 'open').map((model) => model.id),
    );
    for (let round = 0; round < expeditionModels.length; round += 1) {
      for (const model of expeditionModels) {
        if (reachable.has(model.id)) {
          for (const node of stagesOf(model)) {
            if (node.rewards?.reveals !== undefined) {
              reachable.add(node.rewards.reveals);
            }
          }
        }
      }
    }
    for (const model of expeditionModels) {
      if (model.access.kind === 'discovered') {
        expect(reachable.has(model.id), model.id).toBe(true);
      }
      if (model.access.kind === 'tile') {
        expect(startingTiles.map((tile) => tile.id)).toContain(model.access.tileId);
      }
      for (const node of stagesOf(model)) {
        const tile = node.rewards?.clearsTile;
        if (tile !== undefined) {
          expect(startingTiles.map((entry) => entry.id)).toContain(tile);
        }
      }
    }
  });

  it('a captura só está marcada onde alguém prende: no Resgate, nas Ruínas e no Pântano', () => {
    const capturing = expeditionModels
      .filter((model) => stagesOf(model).some((node) => node.trial?.onDisaster === 'capture'))
      .map((model) => model.id);
    expect(capturing).toEqual(['rescue', 'ruins', 'swamp']);
  });

  it('o schema recusa prova sem experiência, recompensa vazia, chance acima de 1, item repetido e acesso desconhecido', () => {
    const Catalog = expeditionModelsSchema(balance.expeditions);
    const broken = (edit: (models: Loose[]) => void): boolean => {
      const models = JSON.parse(JSON.stringify(expeditionModels)) as Loose[];
      edit(models);
      return !Catalog.safeParse(models).success;
    };
    const first = (models: Loose[], index: number) => {
      const variant = (models[index]?.variants as Loose[])[0] as Loose;
      return variant.nodes as Record<string, Loose>;
    };
    expect(broken(() => undefined)).toBe(false);
    expect(broken((models) => delete (first(models, 0).fences?.trial as Loose).xp)).toBe(true);
    expect(broken((models) => ((first(models, 0).fences as Loose).rewards = {}))).toBe(true);
    const item = (models: Loose[]) =>
      ((first(models, 1).deepWoods as Loose).rewards as Loose).item as Loose;
    expect(broken((models) => (item(models).chance = { num: 3, den: 2 }))).toBe(true);
    expect(broken((models) => (item(models).from = ['ashBow', 'ashBow']))).toBe(true);
    expect(broken((models) => (item(models).from = ['excalibur']))).toBe(true);
    expect(broken((models) => (item(models).from = []))).toBe(true);
    expect(broken((models) => ((models[0] as Loose).access = { kind: 'dated', day: 30 }))).toBe(
      true,
    );
    expect(broken((models) => delete (models[0] as Loose).access)).toBe(true);
    expect(
      broken((models) => (((first(models, 0).fences as Loose).rewards as Loose).reveals = 'moon')),
    ).toBe(true);
  });

  it('a duração de cada nó continua na faixa do conteúdo', () => {
    for (const model of expeditionModels) {
      for (const node of stagesOf(model)) {
        expect(node.durationMs).toBeGreaterThanOrEqual(5 * MINUTE);
        expect(node.durationMs).toBeLessThanOrEqual(60 * MINUTE);
      }
    }
  });
});
