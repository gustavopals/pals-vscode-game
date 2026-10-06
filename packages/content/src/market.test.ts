import { describe, expect, it } from 'vitest';

import {
  balance,
  buildings,
  CHRONICLE_PLACEHOLDERS,
  chronicleTemplates,
  DIFFICULTY_IDS,
  EVENT_TYPES,
  MARKET_RESOURCE_IDS,
  marketTemplates,
  RESOURCE_IDS,
  SEASON_IDS,
  TRADE_DIRECTION_IDS,
} from './index';
import { BalanceSchema, BuildingsSchema, MarketTemplatesSchema } from './schemas';

describe('Mercado (GDD §4.1, §5.9 e §6.1; ADR 0018, decisão 16)', () => {
  const { market, storage, difficulties, construction } = balance;

  it('o edifício: nasce no nível 0, pede o Salão no nível 3, custa 150, 100 e 150, leva 15 min e vai ao nível 5', () => {
    const def = buildings.market;
    expect(BuildingsSchema.safeParse(buildings).error).toBeUndefined();
    expect(def.label).toBe('Mercado');
    expect(def.article).toBe('o');
    expect(def.initialLevel).toBe(0);
    expect(def.maxLevel).toBe(5);
    expect(def.requires).toEqual({ townHall: 3 });
    expect(def.baseCost).toEqual({ wood: 150, stone: 100, gold: 150 });
    expect(def.baseDurationMs).toBe(15 * 60_000);
    expect(def.produces).toBeNull();
    // O teto é o do GDD: não há frase de "nesta versão".
    expect(def.maxLevelNote).toBeUndefined();
  });

  it('cada nível vendido do Mercado cabe no depósito nas três dificuldades, com o Armazém que o Salão daquele nível deixa erguer', () => {
    const def = buildings.market;
    const { num, den } = construction.costFactor;
    const warehouse = storage.buildings.warehouse;
    if (warehouse === undefined) {
      throw new Error('Falta o Armazém no conteúdo.');
    }
    const costs: Array<Record<string, number>> = [];
    for (let target = 1; target <= def.maxLevel; target += 1) {
      const steps = target - 1;
      // arredondar(base × fator^obras), como o motor.
      const cost = Object.fromEntries(
        Object.entries(def.baseCost).map(([resource, base]) => [
          resource,
          Math.floor((2 * base * num ** steps + den ** steps) / (2 * den ** steps)),
        ]),
      );
      costs.push(cost);
      // O Salão que a obra pede: o do pré-requisito, e nunca mais de um nível abaixo do alvo.
      const townHall = Math.max(
        def.requires.townHall ?? 1,
        target - construction.gateLevelsAboveTownHall,
      );
      expect(townHall, `nível ${target}`).toBeLessThanOrEqual(buildings.townHall.maxLevel);
      // O Armazém que esse Salão deixa erguer, e o que ele guarda.
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
    // O ouro não tem depósito: nenhum nível fica preso por ele.
    expect(Object.keys(storage.buildings)).toEqual(['granary', 'warehouse']);
    expect(costs).toEqual([
      { wood: 150, stone: 100, gold: 150 },
      { wood: 240, stone: 160, gold: 240 },
      { wood: 384, stone: 256, gold: 384 },
      { wood: 614, stone: 410, gold: 614 },
      { wood: 983, stone: 655, gold: 983 },
    ]);
  });

  it('os números são os do ADR 0018: comida, madeira e pedra a 1,0, 1,2 e 2,0; venda a 85%; 200 por nível; passo de 5%, volta de um décimo, piso em 60% e teto em 160%', () => {
    expect(BalanceSchema.safeParse(balance).error).toBeUndefined();
    expect(MARKET_RESOURCE_IDS).toEqual(['food', 'wood', 'stone']);
    expect(TRADE_DIRECTION_IDS).toEqual(['buy', 'sell']);
    expect(market).toEqual({
      resources: ['food', 'wood', 'stone'],
      basePrice: { food: 1000, wood: 1200, stone: 2000 },
      sellRatio: { num: 17, den: 20 },
      dailyVolumePerLevel: 200,
      walk: {
        maxStepPerMille: 50,
        reversion: { num: 1, den: 10 },
        floor: { num: 3, den: 5 },
        ceiling: { num: 8, den: 5 },
      },
      seasonal: { food: { autumn: { num: 13, den: 10 }, winter: { num: 13, den: 10 } } },
      swing: { low: { num: 4, den: 5 }, high: { num: 5, den: 4 } },
    });
    // O ouro não se negocia por ouro, e o que se negocia é recurso do feudo.
    expect(market.resources).not.toContain('gold');
    for (const resource of market.resources) {
      expect(RESOURCE_IDS).toContain(resource);
    }
    // 85%: a margem do mercador é o que impede o lucro no mesmo dia.
    expect((market.sellRatio.num * 100) / market.sellRatio.den).toBe(85);
  });

  it('o piso, o teto e as marcas da Crônica dão milésimos inteiros em cada preço-base, e o passo nunca os pula de uma vez', () => {
    const { floor, ceiling } = market.walk;
    const bounds = market.resources.map((resource) => {
      const base = market.basePrice[resource];
      return [
        resource,
        (base * floor.num) / floor.den,
        (base * market.swing.low.num) / market.swing.low.den,
        base,
        (base * market.swing.high.num) / market.swing.high.den,
        (base * ceiling.num) / ceiling.den,
      ];
    });
    expect(bounds).toEqual([
      ['food', 600, 800, 1000, 1250, 1600],
      ['wood', 720, 960, 1200, 1500, 1920],
      ['stone', 1200, 1600, 2000, 2500, 3200],
    ]);
  });

  it('a estação só mexe no preço da comida, no outono e no inverno, e sempre para cima', () => {
    expect(Object.keys(market.seasonal)).toEqual(['food']);
    expect(Object.keys(market.seasonal.food ?? {})).toEqual(['autumn', 'winter']);
    for (const season of Object.keys(market.seasonal.food ?? {})) {
      expect(SEASON_IDS).toContain(season);
    }
    for (const factor of Object.values(market.seasonal.food ?? {})) {
      expect(factor.num / factor.den).toBe(1.3);
    }
  });

  it('comprar e vender no mesmo dia nunca dá lucro, com qualquer fator de estação: a venda paga menos que a compra cobra', () => {
    const { num, den } = market.sellRatio;
    expect(num).toBeLessThan(den);
    // Comprar no fim do verão e vender no outono dá lucro, e é intencional (GDD §5.9): o
    // fator do outono vezes a margem passa de 1.
    const autumn = market.seasonal.food?.autumn ?? { num: 1, den: 1 };
    expect(autumn.num * num).toBeGreaterThan(autumn.den * den);
  });

  it('o schema recusa a venda que paga o preço cheio, o piso acima da base, a marca fora do piso e do teto, a lista fora de ordem e o preço que não dá milésimos inteiros', () => {
    const parse = (changed: object) =>
      BalanceSchema.safeParse({ ...balance, market: { ...market, ...changed } }).success;
    const walk = (changed: object) => parse({ walk: { ...market.walk, ...changed } });
    expect(parse({})).toBe(true);
    expect(parse({ sellRatio: { num: 1, den: 1 } })).toBe(false);
    expect(parse({ sellRatio: { num: 21, den: 20 } })).toBe(false);
    expect(parse({ dailyVolumePerLevel: 0 })).toBe(false);
    expect(parse({ resources: ['wood', 'food', 'stone'] })).toBe(false);
    expect(parse({ resources: ['food', 'wood'] })).toBe(false);
    expect(parse({ basePrice: { food: 1000, wood: 1200 } })).toBe(false);
    expect(parse({ basePrice: { ...market.basePrice, food: 0 } })).toBe(false);
    // 1001 × 3/5 não é inteiro.
    expect(parse({ basePrice: { ...market.basePrice, food: 1001 } })).toBe(false);
    expect(walk({ maxStepPerMille: 0 })).toBe(false);
    expect(walk({ maxStepPerMille: 1000 })).toBe(false);
    expect(walk({ reversion: { num: 11, den: 10 } })).toBe(false);
    expect(walk({ floor: { num: 1, den: 1 } })).toBe(false);
    expect(walk({ ceiling: { num: 1, den: 1 } })).toBe(false);
    // A marca de baixo no piso, e a de cima no teto: nunca seriam cruzadas com sobra.
    expect(parse({ swing: { ...market.swing, low: market.walk.floor } })).toBe(false);
    expect(parse({ swing: { ...market.swing, high: market.walk.ceiling } })).toBe(false);
    expect(parse({ swing: { ...market.swing, low: { num: 1, den: 1 } } })).toBe(false);
    expect(parse({ seasonal: { gold: { autumn: { num: 13, den: 10 } } } })).toBe(false);
    expect(parse({ seasonal: { food: { monsoon: { num: 13, den: 10 } } } })).toBe(false);
    expect(parse({ seasonal: { food: { autumn: { num: 0, den: 10 } } } })).toBe(false);
  });

  it('a Crônica tem a frase da compra, a da venda e as do preço que cruza uma marca, e nenhuma traz número', () => {
    expect(MarketTemplatesSchema.safeParse(marketTemplates).error).toBeUndefined();
    expect(Object.keys(marketTemplates)).toEqual(['buy', 'sell', 'high', 'low']);
    for (const type of ['marketTraded', 'marketPriceSwing'] as const) {
      expect(EVENT_TYPES).toContain(type);
      expect(chronicleTemplates[type].startsWith('No {dia}º dia {daEstacao}, '), type).toBe(true);
      expect(chronicleTemplates[type], type).toContain('{recurso}');
    }
    const phrases = Object.values(marketTemplates);
    expect(new Set(phrases).size).toBe(phrases.length);
    for (const phrase of phrases) {
      expect(phrase.startsWith('No {dia}º dia {daEstacao}, ')).toBe(true);
      expect(phrase).toContain('{feudo}');
      expect(phrase).toContain('{recurso}');
      expect(phrase).not.toMatch(/\d/);
    }
    for (const marker of ['{quantidade}', '{preco}']) {
      expect(marketTemplates.buy).toContain(marker);
      expect(marketTemplates.sell).toContain(marker);
      expect(chronicleTemplates.marketTraded).toContain(marker);
    }
    expect(CHRONICLE_PLACEHOLDERS).toContain('preco');
    expect(
      MarketTemplatesSchema.safeParse({ ...marketTemplates, buy: 'Comprou-se {recurso}.' }).success,
    ).toBe(false);
    expect(
      MarketTemplatesSchema.safeParse({ ...marketTemplates, high: 'O preço subiu.' }).success,
    ).toBe(false);
  });
});
