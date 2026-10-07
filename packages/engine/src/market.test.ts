import { balance, buildings } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  dailyVolume,
  gameDay,
  marketReserve,
  maxBuyable,
  maxSellable,
  priceBounds,
  priceZone,
  quote,
  quoteOf,
  remainingToday,
  surplusSellable,
  walkedPrice,
} from './market';
import { turnMarket } from './marketTurn';
import { priceText } from './marketView';
import { planCost } from './planned';
import { currentShape } from './migrations';
import { cloneState } from './state';
import { storageCapacity } from './storage';
import {
  accept,
  apply,
  AUTUMN,
  command,
  DAY,
  eventsOfType,
  HOUR,
  marketScenario,
  marketStall,
  MINUTE,
  newGame,
  refuse,
  SUMMER,
  tavernSite,
  tradeOrder,
  WINTER,
  YEAR,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState, MarketResourceId } from './types';
import { deriveViewState } from './view';

const { market: rules } = balance;
const RESOURCES = rules.resources;
const BASE = rules.basePrice;
/** A obra do Mercado do cenário termina 15 minutos de jogo depois da ordem. */
const OPENS = buildings.market.baseDurationMs;
const SEEDS = Array.from({ length: 50 }, (_, index) => `mercado-${index + 1}`);

const view = (state: GameState) => deriveViewState(state, state.lastProcessedAt);
const priceRow = (state: GameState, resource: MarketResourceId) => {
  const row = view(state).market.prices.find((entry) => entry.resource === resource);
  if (row === undefined) {
    throw new Error(`A visão não traz o preço de ${resource}.`);
  }
  return row;
};
const gold = (state: GameState) => state.settlement.resources.gold;
const stock = (state: GameState, resource: MarketResourceId) =>
  state.settlement.resources[resource];
const types = (events: GameEvent[]) => events.map((event) => event.type);

/** O Mercado Nv1 posto de pé no começo de um dia, com os preços onde o teste pedir. */
function stallWith(
  atMs: number,
  prices: Partial<Record<MarketResourceId, number>> = {},
  edit: (draft: GameState) => void = () => {},
  custom: Parameters<typeof marketStall>[2] = {},
): GameState {
  return marketStall(
    atMs,
    (draft) => {
      Object.assign(draft.market.prices, prices);
      Object.assign(draft.market.previousPrices, prices);
      edit(draft);
    },
    custom,
  );
}

/** Os preços de cada dia, de um Mercado que já está de pé, virada por virada, pelo passo do motor. */
function walk(seed: string, days: number): { prices: number[][]; events: GameEvent[] } {
  const draft = cloneState(marketStall(0, undefined, { seed }));
  const prices: number[][] = [];
  const events: GameEvent[] = [];
  for (let day = 1; day <= days; day += 1) {
    turnMarket(draft, day * DAY, events);
    prices.push(RESOURCES.map((resource) => draft.market.prices[resource]));
  }
  return { prices, events };
}

describe('o Mercado como edifício (GDD §6.1; ADR 0018, decisão 16)', () => {
  it('pede o Salão no nível 3, e sem ele a obra é recusada com o que falta', () => {
    const early = tavernSite(0, (draft) => {
      draft.settlement.buildings.townHall = 2;
    });
    expect(refuse(early, command('startConstruction', { building: 'market' }))).toEqual({
      code: 'GATE_LOCKED',
      message: 'Melhore antes o Salão do Senhor para o nível 3.',
    });
  });

  it('é erguido com 150 de madeira, 100 de pedra e 150 de ouro, em 15 minutos de jogo, com a frase de fundação', () => {
    const site = tavernSite();
    const { state, events, opensAt } = marketScenario();
    expect(opensAt).toBe(OPENS);
    expect(state.settlement.buildings.market).toBe(1);
    expect(stock(site, 'wood') - stock(state, 'wood')).toBe(150_000);
    expect(stock(site, 'stone') - stock(state, 'stone')).toBe(100_000);
    expect(gold(site) - gold(state)).toBe(150_000);
    const founded = eventsOfType(events, 'buildingFounded');
    expect(founded).toHaveLength(1);
    expect(founded[0]?.data.building).toBe('market');
    expect(founded[0]?.text).toContain('o Mercado');
  });

  it('a lista de obras diz o que cada nível negocia, do primeiro ao quinto', () => {
    const effectAt = (level: number) =>
      view(
        marketStall(0, (draft) => (draft.settlement.buildings.townHall = 8), { level }),
      ).constructions.available.find((entry) => entry.building === 'market')?.effect;
    expect(view(tavernSite()).constructions.available.map((entry) => entry.building)).toContain(
      'market',
    );
    expect(
      view(tavernSite()).constructions.available.find((entry) => entry.building === 'market')
        ?.effect,
    ).toBe('Negocia até 200 de cada recurso por dia de jogo, entre compras e vendas.');
    // Do nível 2 em diante a obra também diz as caravanas (V3E-T2).
    expect(effectAt(1)).toBe(
      'Negocia até 400 de cada recurso por dia de jogo, entre compras e vendas, e mantém 1 caravana na estrada para Porto do Rio.',
    );
    expect(effectAt(4)).toBe(
      'Negocia até 1.000 de cada recurso por dia de jogo, entre compras e vendas, e mantém 2 caravanas na estrada para Porto do Rio.',
    );
  });
});

describe('o preço que anda (V3E-T1.2)', () => {
  it('o passo e a volta à base saem de uma conta só, com um arredondamento para baixo', () => {
    // No preço-base não há volta: só o passo.
    expect(walkedPrice('food', 1000, 50)).toBe(1050);
    expect(walkedPrice('food', 1000, -50)).toBe(950);
    expect(walkedPrice('food', 1000, 0)).toBe(1000);
    // Acima da base, um décimo da distância volta: 1100 − 10.
    expect(walkedPrice('food', 1100, 0)).toBe(1090);
    // 1100 + 40,7 − 10 = 1130,7.
    expect(walkedPrice('food', 1100, 37)).toBe(1130);
    // Abaixo da base, a volta empurra para cima: 900 − 29,7 + 10 = 880,3.
    expect(walkedPrice('food', 900, -33)).toBe(880);
    // A conta inteira, contra a mesma conta em frações exatas, em todo passo e em uma faixa de
    // preços larga para cada recurso.
    const { num, den } = rules.walk.reversion;
    for (const resource of RESOURCES) {
      const { floor, ceiling } = priceBounds(resource);
      const base = BigInt(BASE[resource]);
      for (let price = floor; price <= ceiling; price += 7) {
        for (
          let step = -rules.walk.maxStepPerMille;
          step <= rules.walk.maxStepPerMille;
          step += 1
        ) {
          const numerator =
            BigInt(price) * BigInt(1000 + step) * BigInt(den) +
            (base - BigInt(price)) * BigInt(num) * 1000n;
          const exact = Number(numerator / (1000n * BigInt(den)));
          expect(walkedPrice(resource, price, step)).toBe(
            Math.min(ceiling, Math.max(floor, exact)),
          );
        }
      }
    }
  });

  it('o preço fora da faixa (um conteúdo que mudou) volta para dentro no primeiro passeio', () => {
    expect(walkedPrice('food', 100, -50)).toBe(600);
    expect(walkedPrice('food', 5000, 50)).toBe(1600);
    expect(walkedPrice('stone', 100, 0)).toBe(1200);
    expect(walkedPrice('wood', 9000, 0)).toBe(1920);
  });

  it('em 50 sementes, por dois anos de jogo, todo preço fica entre o piso e o teto, e anda', () => {
    const lowest: Record<string, number> = {};
    const highest: Record<string, number> = {};
    let moved = 0;
    for (const seed of SEEDS) {
      const { prices } = walk(seed, (2 * YEAR) / DAY);
      expect(prices).toHaveLength(168);
      prices.forEach((day, index) => {
        RESOURCES.forEach((resource, at) => {
          const price = day[at] ?? 0;
          const { floor, ceiling } = priceBounds(resource);
          expect(Number.isInteger(price)).toBe(true);
          expect(price).toBeGreaterThanOrEqual(floor);
          expect(price).toBeLessThanOrEqual(ceiling);
          lowest[resource] = Math.min(lowest[resource] ?? price, price);
          highest[resource] = Math.max(highest[resource] ?? price, price);
          const before = index === 0 ? BASE[resource] : (prices[index - 1]?.[at] ?? 0);
          // Nunca mais do que o passo e a volta juntos: 5% do preço e um décimo da distância.
          const limit = Math.ceil(
            (before * rules.walk.maxStepPerMille) / 1000 + Math.abs(BASE[resource] - before) / 10,
          );
          expect(Math.abs(price - before)).toBeLessThanOrEqual(limit + 1);
          moved += price === before ? 0 : 1;
        });
      });
    }
    // O passeio passa mesmo dos dois lados da base, em todo recurso.
    for (const resource of RESOURCES) {
      expect(lowest[resource]).toBeLessThan(BASE[resource] * 0.9);
      expect(highest[resource]).toBeGreaterThan(BASE[resource] * 1.1);
    }
    expect(moved).toBeGreaterThan(50 * 168 * 3 * 0.9);
  });

  it('a mesma semente dá os mesmos preços, e outra semente, outros', () => {
    expect(walk('mercado-1', 84)).toStrictEqual(walk('mercado-1', 84));
    expect(walk('mercado-1', 84).prices).not.toStrictEqual(walk('mercado-2', 84).prices);
    // Os três recursos não andam juntos: cada um tem o sorteio dele.
    const { prices } = walk('mercado-1', 84);
    const ratios = prices.map((day) => RESOURCES.map((id, at) => (day[at] ?? 0) / BASE[id]));
    expect(ratios.some(([food, wood]) => food !== wood)).toBe(true);
  });

  it('sem Mercado nada se sorteia: os preços ficam na base, e o fluxo não nasce', () => {
    const fresh = newGame('sem-mercado');
    const later = advanceTo(fresh, 30 * DAY + 17 * MINUTE).state;
    expect(later.settlement.buildings.market).toBe(0);
    expect(later.market).toStrictEqual(fresh.market);
    expect(later.market).toStrictEqual({
      prices: { food: 1000, wood: 1200, stone: 2000 },
      previousPrices: { food: 1000, wood: 1200, stone: 2000 },
      quoteDay: 0,
      tradedToday: { food: 0, wood: 0, stone: 0 },
      caravans: [],
    });
    expect(later.rng.market).toBeUndefined();
  });

  it('o Mercado que fica pronto no meio do dia negocia pela base até a primeira virada, e o preço anda no instante exato dela', () => {
    const start = 5 * DAY + 20 * MINUTE;
    const { state, opensAt } = marketScenario(start, undefined, { seed: 'mercado-3' });
    expect(opensAt).toBe(start + OPENS);
    expect(state.market).toStrictEqual(newGame().market);
    expect(state.rng.market).toBeUndefined();
    expect(view(state).market.quoteDay).toBe(0);
    expect(priceRow(state, 'wood')).toMatchObject({ buy: 1200, sell: 1020, trend: 'flat' });
    // Negocia já, pela base, com o volume do dia.
    const sold = accept(state, tradeOrder(state, 'wood', 'sell', 100));
    expect(gold(sold.state) - gold(state)).toBe(102_000);

    const turn = 6 * DAY;
    const before = advanceTo(sold.state, turn - 1).state;
    expect(before.market.prices).toStrictEqual({ ...BASE });
    expect(before.market.tradedToday.wood).toBe(100);
    expect(before.rng.market).toBeUndefined();

    const after = advanceTo(before, turn).state;
    expect(after.market.quoteDay).toBe(7);
    expect(after.market.quoteDay).toBe(gameDay(turn));
    expect(after.market.previousPrices).toStrictEqual({ ...BASE });
    expect(after.market.tradedToday).toStrictEqual({ food: 0, wood: 0, stone: 0 });
    expect(after.rng.market).toBeDefined();
    for (const resource of RESOURCES) {
      // Da base, o primeiro passo é só o passo: até 5% para cada lado.
      const step = after.market.prices[resource] - BASE[resource];
      expect(Math.abs(step)).toBeLessThanOrEqual((BASE[resource] * 50) / 1000);
    }
    expect(after.market.prices).not.toStrictEqual({ ...BASE });
    // Um passeio por dia, e nenhum entre as viradas.
    const midday = advanceTo(after, turn + DAY - 1).state;
    expect(midday.market).toStrictEqual(after.market);
    expect(midday.rng.market).toStrictEqual(after.rng.market);
    expect(advanceTo(midday, turn + DAY).state.market.quoteDay).toBe(8);
  });

  it('o Mercado que fica pronto no instante exato de uma virada já tem o preço dela: a obra termina antes de o dia virar', () => {
    const turn = 9 * DAY;
    const site = tavernSite(turn - OPENS, undefined, { seed: 'mercado-4' });
    const ordered = accept(site, command('startConstruction', { building: 'market' })).state;
    expect(ordered.settlement.constructionQueues[0]?.finishesAtMs).toBe(turn);
    const { state, events } = advanceTo(ordered, turn);
    expect(types(events).indexOf('buildingFounded')).toBeLessThan(
      types(events).indexOf('dayStarted'),
    );
    expect(state.market.quoteDay).toBe(10);
    expect(state.rng.market).toBeDefined();
    // E o que termina um milissegundo depois espera a virada seguinte.
    const late = tavernSite(turn - OPENS + 1, undefined, { seed: 'mercado-4' });
    const opened = advanceTo(
      accept(late, command('startConstruction', { building: 'market' })).state,
      turn + 1,
    ).state;
    expect(opened.settlement.buildings.market).toBe(1);
    expect(opened.market.quoteDay).toBe(0);
    expect(opened.rng.market).toBeUndefined();
  });

  it('pelo jogo, dia a dia, os preços são os do passo do motor: um passeio por virada, na ordem do conteúdo', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const expected = walk(seed, 30).prices;
      let state = marketStall(0, undefined, { seed });
      const seen: number[][] = [];
      for (let day = 1; day <= 30; day += 1) {
        state = advanceTo(state, day * DAY).state;
        seen.push(RESOURCES.map((resource) => state.market.prices[resource]));
        expect(state.market.quoteDay).toBe(day + 1);
      }
      expect(seen).toStrictEqual(expected);
    }
  });

  it('30 dias sem acesso sorteiam o mesmo que 30 dias de visitas, com a tela aberta em cada uma', () => {
    for (const seed of ['mercado-1', 'mercado-7', 'mercado-13']) {
      for (const timeScale of [3, 1, 0.5]) {
        const start = marketStall(
          3 * HOUR + 11,
          (draft) => {
            Object.assign(draft.settlement.workers, { farm: 2, lumberMill: 1, goldMine: 1 });
          },
          { seed, timeScale },
        );
        const end = start.lastProcessedAt + 30 * DAY;
        const away = advanceTo(start, end);
        let state = start;
        const events: GameEvent[] = [];
        // Uma visita a cada 5 h e 13 min de jogo: cai no meio dos dias, nunca na virada.
        for (
          let at = start.lastProcessedAt + 5 * HOUR + 13 * MINUTE;
          at < end;
          at += 5 * HOUR + 13 * MINUTE
        ) {
          const step = advanceTo(state, at);
          state = step.state;
          events.push(...step.events);
          deriveViewState(state, at, { timeScale });
          nextEventAt(state);
        }
        const last = advanceTo(state, end);
        events.push(...last.events);
        expect(last.state).toStrictEqual(away.state);
        expect(last.state.rng).toStrictEqual(away.state.rng);
        expect(events).toStrictEqual(away.events);
        expect(away.state.market.quoteDay).toBe(gameDay(end));
      }
    }
  });
});

describe('a Crônica sem ruído (V3E-T1.5)', () => {
  it('as marcas são 85% e 115% da base (revisão da Fase E, R3), e o preço na marca já está na zona', () => {
    expect(priceBounds('food')).toEqual({ floor: 600, ceiling: 1600, low: 850, high: 1150 });
    expect(priceZone('food', 851)).toBe('mid');
    expect(priceZone('food', 850)).toBe('low');
    expect(priceZone('food', 1149)).toBe('mid');
    expect(priceZone('food', 1150)).toBe('high');
    expect(priceZone('stone', 2000)).toBe('mid');
  });

  it('a mudança de todo dia não gera linha: só o preço que entra em uma das zonas, e uma vez por entrada', () => {
    let swings = 0;
    for (const seed of SEEDS) {
      const draft = cloneState(marketStall(0, undefined, { seed }));
      for (let day = 1; day <= (2 * YEAR) / DAY; day += 1) {
        const before = { ...draft.market.prices };
        const events: GameEvent[] = [];
        turnMarket(draft, day * DAY, events);
        const expected = RESOURCES.flatMap((resource) => {
          const zone = priceZone(resource, draft.market.prices[resource]);
          return zone !== 'mid' && zone !== priceZone(resource, before[resource])
            ? [{ resource, mark: zone, price: draft.market.prices[resource] }]
            : [];
        });
        expect(events.map((event) => event.data)).toStrictEqual(expected);
        expect(events.every((event) => event.type === 'marketPriceSwing')).toBe(true);
        swings += events.length;
      }
    }
    // Medido (revisão da Fase E, R3): 221 linhas em 50 partidas de dois anos de jogo, nos três
    // recursos: 2,2 por ano de jogo. São algumas por ano, e não uma por semana (um ano tem 12
    // semanas de jogo). Com as marcas a 80% e 125% eram 6 ao todo; a 90% e 110%, 1.226.
    expect(swings).toBe(221);
  });

  it('o preço que sobe até a marca de cima e o que cai até a de baixo têm cada um a sua frase, com o recurso', () => {
    // A madeira a um passo da marca de cima (1.380) e a pedra a um passo da de baixo (1.700):
    // em alguma das sementes o passo do dia as leva para dentro.
    const found: Record<string, GameEvent> = {};
    for (const seed of SEEDS) {
      const draft = cloneState(stallWith(0, { wood: 1379, stone: 1701 }, undefined, { seed }));
      const events: GameEvent[] = [];
      turnMarket(draft, DAY, events);
      for (const event of events) {
        found[String(event.data.mark)] ??= event;
      }
    }
    expect(found.high?.data).toMatchObject({ resource: 'wood', mark: 'high' });
    expect(found.high?.text).toBe(
      'No 2º dia da Primavera, faltou madeira nas bancas do Mercado de Pedra Alta: o preço subiu muito além do costume.',
    );
    expect(found.low?.data).toMatchObject({ resource: 'stone', mark: 'low' });
    expect(found.low?.text).toBe(
      'No 2º dia da Primavera, sobrou pedra nas bancas do Mercado de Pedra Alta: o preço caiu muito abaixo do costume.',
    );
    // Quem já está na zona e continua nela não é notícia de novo.
    const inside = cloneState(stallWith(0, { wood: 1900 }));
    const quiet: GameEvent[] = [];
    turnMarket(inside, DAY, quiet);
    expect(priceZone('wood', inside.market.prices.wood)).toBe('high');
    expect(quiet.filter((event) => event.data.resource === 'wood')).toEqual([]);
  });

  it('a comida mais cara no outono é o calendário, e não uma linha da Crônica', () => {
    const summerEnd = stallWith(AUTUMN - HOUR, {}, undefined, { seed: 'mercado-2' });
    const { state, events } = advanceTo(summerEnd, AUTUMN);
    expect(priceRow(state, 'food').buy).toBeGreaterThan(priceBounds('food').high);
    expect(eventsOfType(events, 'marketPriceSwing')).toEqual([]);
  });
});

describe('a ordem dentro da virada do dia (V3E-T1.2; roadmap §0.7)', () => {
  it('o preço anda depois da moral e antes do sorteio do Conselho e da Ameaça', () => {
    const turn = 20 * DAY;
    const build = (seed: string) =>
      stallWith(
        turn - HOUR,
        { wood: 1379 },
        (draft) => {
          // A moral cai de faixa nesta virada, uma carta é sorteada nela, e a Ameaça cruza os 40
          // diante da Torre de Vigia.
          draft.settlement.morale = 100;
          draft.council.nextDrawAtMs = turn;
          draft.map.threat = 38;
          draft.settlement.buildings.watchtower = 1;
        },
        { seed },
      );
    const seed = SEEDS.find((candidate) =>
      advanceTo(build(candidate), turn).events.some((event) => event.type === 'marketPriceSwing'),
    );
    expect(seed).toBeDefined();
    const { events } = advanceTo(build(seed ?? ''), turn);
    const order = types(events);
    expect(order).toEqual(expect.arrayContaining(['moraleBandChanged', 'cardDrawn', 'threatRose']));
    expect(order.indexOf('dayStarted')).toBeLessThan(order.indexOf('moraleBandChanged'));
    expect(order.indexOf('moraleBandChanged')).toBeLessThan(order.indexOf('marketPriceSwing'));
    expect(order.indexOf('marketPriceSwing')).toBeLessThan(order.indexOf('cardDrawn'));
    expect(order.indexOf('cardDrawn')).toBeLessThan(order.indexOf('threatRose'));
    expect(events.every((event) => event.atMs === turn)).toBe(true);
  });

  it('a ordem dada no instante da virada encontra a virada resolvida: a cotação de ontem é recusada, e a de hoje vale pelo preço novo', () => {
    const turn = 12 * DAY;
    const yesterday = advanceTo(
      marketStall(turn - 3 * DAY, undefined, { seed: 'mercado-5' }),
      turn - 1,
    ).state;
    const stale = tradeOrder(yesterday, 'stone', 'sell', 50);
    // Um milissegundo antes da virada a ordem vale, pelo preço de ontem.
    const early = accept(yesterday, stale);
    expect(gold(early.state) - gold(yesterday)).toBe(50 * quote(yesterday, 'stone').sell);

    const today = advanceTo(yesterday, turn).state;
    expect(today.market.quoteDay).toBe(yesterday.market.quoteDay + 1);
    expect(today.market.prices.stone).not.toBe(yesterday.market.prices.stone);
    expect(refuse(today, stale)).toEqual({
      code: 'PRICE_CHANGED',
      message: 'O dia virou e o preço do Mercado mudou: confira o preço de hoje e peça de novo.',
    });
    const fresh = accept(today, tradeOrder(today, 'stone', 'sell', 50));
    expect(gold(fresh.state) - gold(today)).toBe(50 * quote(today, 'stone').sell);
    expect(fresh.events[0]?.data).toMatchObject({
      quoteDay: 13,
      unitPrice: quote(today, 'stone').sell,
    });
  });
});

describe('o volume diário (V3E-T1.3)', () => {
  it('é 200 por nível e por recurso: vender exatamente até o limite passa, e a unidade seguinte é recusada', () => {
    const stall = marketStall();
    expect(dailyVolume(stall)).toBe(200);
    const sold = accept(stall, tradeOrder(stall, 'stone', 'sell', 140)).state;
    expect(remainingToday(sold, 'stone')).toBe(60);
    expect(refuse(sold, tradeOrder(sold, 'stone', 'sell', 61))).toEqual({
      code: 'DAILY_VOLUME_EXCEEDED',
      message:
        'O Mercado Nv1 negocia 200 de pedra por dia, entre compras e vendas: hoje ainda cabem 60.',
    });
    const full = accept(sold, tradeOrder(sold, 'stone', 'sell', 60)).state;
    expect(full.market.tradedToday.stone).toBe(200);
    expect(remainingToday(full, 'stone')).toBe(0);
    expect(refuse(full, tradeOrder(full, 'stone', 'sell', 1))).toEqual({
      code: 'DAILY_VOLUME_EXCEEDED',
      message:
        'O Mercado Nv1 negocia 200 de pedra por dia, entre compras e vendas: hoje não cabe mais nada. O volume volta na virada do dia.',
    });
    // A recusa não negocia nada, nem um pedaço.
    expect(apply(full, tradeOrder(full, 'stone', 'sell', 1)).ok).toBe(false);
    expect(stock(full, 'stone')).toBe(stock(stall, 'stone') - 200_000);
    // Cada recurso tem o seu volume.
    expect(remainingToday(full, 'food')).toBe(200);
    expect(apply(full, tradeOrder(full, 'food', 'sell', 200)).ok).toBe(true);
  });

  it('soma compra e venda: quem comprou 50 só vende mais 150, e a que falta 1 unidade diz isso', () => {
    const stall = marketStall();
    const bought = accept(stall, tradeOrder(stall, 'stone', 'buy', 50)).state;
    expect(bought.market.tradedToday.stone).toBe(50);
    const sold = accept(bought, tradeOrder(bought, 'stone', 'sell', 149)).state;
    expect(sold.market.tradedToday.stone).toBe(199);
    expect(refuse(sold, tradeOrder(sold, 'stone', 'buy', 2)).message).toBe(
      'O Mercado Nv1 negocia 200 de pedra por dia, entre compras e vendas: hoje ainda cabe 1 unidade.',
    );
    expect(refuse(sold, tradeOrder(sold, 'stone', 'sell', 2)).code).toBe('DAILY_VOLUME_EXCEEDED');
    expect(apply(sold, tradeOrder(sold, 'stone', 'buy', 1)).ok).toBe(true);
  });

  it('zera na virada do dia, no mesmo passo do preço, e não acumula: 30 dias fora valem o volume de um dia', () => {
    const stall = marketStall(4 * DAY + HOUR);
    const full = accept(stall, tradeOrder(stall, 'food', 'sell', 200)).state;
    const before = advanceTo(full, 5 * DAY - 1).state;
    expect(remainingToday(before, 'food')).toBe(0);
    const turned = advanceTo(before, 5 * DAY).state;
    expect(turned.market.tradedToday).toStrictEqual({ food: 0, wood: 0, stone: 0 });
    expect(remainingToday(turned, 'food')).toBe(200);
    expect(apply(turned, tradeOrder(turned, 'food', 'sell', 200)).ok).toBe(true);

    const away = advanceTo(stall, 34 * DAY + HOUR).state;
    expect(remainingToday(away, 'food')).toBe(200);
    expect(refuse(away, tradeOrder(away, 'food', 'sell', 201)).code).toBe('DAILY_VOLUME_EXCEEDED');
  });

  it('cresce com o nível, e o nível que fica pronto no meio do dia já vale: o que foi negociado continua contando', () => {
    expect(dailyVolume(marketStall(0, undefined, { level: 2 }))).toBe(400);
    expect(dailyVolume(marketStall(0, undefined, { level: 5 }))).toBe(1000);
    expect(dailyVolume(tavernSite())).toBe(0);
    const stall = marketStall(DAY + 10 * MINUTE);
    const full = accept(stall, tradeOrder(stall, 'stone', 'sell', 200)).state;
    const building = accept(full, command('startConstruction', { building: 'market' })).state;
    const ready = building.settlement.constructionQueues[0]?.finishesAtMs ?? 0;
    expect(ready).toBeLessThan(2 * DAY);
    const raised = advanceTo(building, ready).state;
    expect(raised.settlement.buildings.market).toBe(2);
    expect(raised.market.tradedToday.stone).toBe(200);
    expect(remainingToday(raised, 'stone')).toBe(200);
  });
});

describe('a ordem de negociar (V3E-T1.4)', () => {
  it('sem Mercado é recusada com o que o abre', () => {
    const site = tavernSite();
    expect(refuse(site, tradeOrder(site, 'wood', 'sell', 10))).toEqual({
      code: 'MARKET_REQUIRED',
      message: 'Erga o Mercado primeiro.',
    });
    const early = tavernSite(0, (draft) => (draft.settlement.buildings.townHall = 2));
    expect(refuse(early, tradeOrder(early, 'wood', 'sell', 10)).message).toBe(
      'Erga o Mercado primeiro: ele abre com o Salão do Senhor Nv3.',
    );
  });

  it('o que não é uma negociação é recusado: quantidade que não é inteiro a partir de 1, ouro por ouro, sentido que não existe', () => {
    const stall = marketStall();
    const order = (payload: object) =>
      refuse(
        stall,
        command('trade', { ...tradeOrder(stall, 'wood', 'sell', 10).payload, ...payload } as never),
      );
    for (const amount of [0, -5, 1.5, Number.NaN, Number.MAX_VALUE, '10', null]) {
      expect(order({ amount }), String(amount)).toEqual({
        code: 'INVALID_AMOUNT',
        message: 'Negocie um número inteiro de unidades, a partir de 1.',
      });
    }
    expect(order({ resource: 'gold' })).toEqual({
      code: 'INVALID_AMOUNT',
      message: 'O Mercado só negocia comida, madeira e pedra, por ouro.',
    });
    expect(order({ resource: 'iron' }).code).toBe('INVALID_AMOUNT');
    expect(order({ direction: 'barter' })).toEqual({
      code: 'INVALID_AMOUNT',
      message: 'No Mercado se compra ou se vende.',
    });
  });

  it('compra pelo preço do dia e vende a 85% dele, com as quantidades exatas no evento e a frase na Crônica', () => {
    const stall = stallWith(2 * DAY, { stone: 2100 });
    expect(quote(stall, 'stone')).toEqual({ buy: 2100, sell: 1785 });
    const bought = accept(stall, tradeOrder(stall, 'stone', 'buy', 40));
    expect(gold(stall) - gold(bought.state)).toBe(84_000);
    expect(stock(bought.state, 'stone') - stock(stall, 'stone')).toBe(40_000);
    expect(bought.events).toHaveLength(1);
    expect(bought.events[0]).toEqual({
      type: 'marketTraded',
      atMs: 2 * DAY,
      text: 'No 3º dia da Primavera, o senhor de Pedra Alta comprou no Mercado 40 de pedra, por 84 de ouro.',
      data: {
        resource: 'stone',
        direction: 'buy',
        amount: 40,
        unitPrice: 2100,
        gold: 84_000,
        quoteDay: 0,
        remainingToday: 160,
        gained_stone: 40,
        spent_gold: 84,
      },
    });
    const sold = accept(bought.state, tradeOrder(bought.state, 'stone', 'sell', 7));
    expect(gold(sold.state) - gold(bought.state)).toBe(7 * 1785);
    expect(sold.events[0]).toEqual({
      type: 'marketTraded',
      atMs: 2 * DAY,
      text: 'No 3º dia da Primavera, o senhor de Pedra Alta vendeu no Mercado 7 de pedra, por 12,495 de ouro.',
      data: {
        resource: 'stone',
        direction: 'sell',
        amount: 7,
        unitPrice: 1785,
        gold: 12_495,
        quoteDay: 0,
        remainingToday: 153,
        spent_stone: 7,
        gained_gold: 12.495,
      },
    });
    expect(sold.state.stats).toMatchObject({ bought_stone: 40, sold_stone: 7 });
    expect(sold.state.market.tradedToday).toStrictEqual({ food: 0, wood: 0, stone: 47 });
    // A ordem não sorteia e não dá identificador a ninguém.
    expect(sold.state.rng).toStrictEqual(stall.rng);
    expect(sold.state.ids).toStrictEqual(stall.ids);
    expect(currentShape(JSON.parse(JSON.stringify(sold.state)), '')).toBeNull();
  });

  it('o ouro pago arredonda para cima e o recebido, para baixo, em milésimos, uma vez por unidade', () => {
    // 1001 × 1,3 = 1301,3: a compra custa 1302. A venda paga 1001 × 1,3 × 0,85 = 1106,105: 1106.
    expect(quoteOf(1001, { num: 13, den: 10 })).toEqual({ buy: 1302, sell: 1106 });
    expect(quoteOf(1000, { num: 1, den: 1 })).toEqual({ buy: 1000, sell: 850 });
    // 1203 × 0,85 = 1022,55.
    expect(quoteOf(1203, { num: 1, den: 1 })).toEqual({ buy: 1203, sell: 1022 });
    const autumn = stallWith(AUTUMN + DAY, { food: 1001 });
    expect(quote(autumn, 'food')).toEqual({ buy: 1302, sell: 1106 });
    const sold = accept(autumn, tradeOrder(autumn, 'food', 'sell', 3)).state;
    expect(gold(sold) - gold(autumn)).toBe(3 * 1106);
    // Dividir a ordem não muda o ouro: 3 de uma vez valem o mesmo que 1, 1 e 1.
    let piecewise = autumn;
    for (let unit = 0; unit < 3; unit += 1) {
      piecewise = accept(piecewise, tradeOrder(piecewise, 'food', 'sell', 1)).state;
    }
    expect(gold(piecewise)).toBe(gold(sold));
  });

  it('faltando ouro para a compra, ou estoque para a venda, diz quanto falta', () => {
    const poor = marketStall(0, (draft) => {
      Object.assign(draft.settlement.resources, { gold: 30_000, stone: 10_500 });
    });
    // 20 de pedra custam 40 de ouro: faltam 10.
    expect(refuse(poor, tradeOrder(poor, 'stone', 'buy', 20))).toEqual({
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 10 ouro.',
    });
    expect(apply(poor, tradeOrder(poor, 'stone', 'buy', 15)).ok).toBe(true);
    // Há 10,5 de pedra: vendem-se 10, e a décima primeira não existe inteira.
    expect(refuse(poor, tradeOrder(poor, 'stone', 'sell', 11))).toEqual({
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 1 pedra.',
    });
    const sold = accept(poor, tradeOrder(poor, 'stone', 'sell', 10)).state;
    expect(stock(sold, 'stone')).toBe(500);
  });

  it('comprar até o limite do depósito passa, e a compra que não cabe é recusada inteira, nunca cortada', () => {
    // O Armazém Nv4 guarda 2.800 de pedra em Senhor; o feudo tem 2.750.
    const stall = marketStall(0, (draft) => {
      draft.settlement.resources.stone = 2_750_000;
    });
    expect(storageCapacity(stall, 'stone')).toBe(2_800_000);
    expect(refuse(stall, tradeOrder(stall, 'stone', 'buy', 51))).toEqual({
      code: 'STORAGE_FULL',
      message: 'A compra não cabe: o Armazém guarda 2.800 de pedra, e só cabem mais 50.',
    });
    expect(stock(stall, 'stone')).toBe(2_750_000);
    const filled = accept(stall, tradeOrder(stall, 'stone', 'buy', 50));
    expect(stock(filled.state, 'stone')).toBe(2_800_000);
    expect(filled.state.settlement.wasted.stone).toBe(0);
    expect(filled.state.stats.wasted_stone).toBeUndefined();
    // A compra encheu o depósito: a linha do estoque cheio sai, como em todo ganho.
    expect(types(filled.events)).toEqual(['marketTraded', 'storageFilled']);
    expect(refuse(filled.state, tradeOrder(filled.state, 'stone', 'buy', 1))).toEqual({
      code: 'STORAGE_FULL',
      message: 'A compra não cabe: o Armazém guarda 2.800 de pedra, e está cheio.',
    });
    // Com meio milésimo de folga não cabe uma unidade inteira.
    const almost = marketStall(0, (draft) => {
      draft.settlement.resources.stone = 2_799_001;
    });
    expect(refuse(almost, tradeOrder(almost, 'stone', 'buy', 1)).code).toBe('STORAGE_FULL');
    const oneLeft = marketStall(0, (draft) => {
      draft.settlement.resources.stone = 2_799_000;
    });
    expect(refuse(oneLeft, tradeOrder(oneLeft, 'stone', 'buy', 2)).message).toBe(
      'A compra não cabe: o Armazém guarda 2.800 de pedra, e só cabe mais 1 unidade.',
    );
    expect(apply(oneLeft, tradeOrder(oneLeft, 'stone', 'buy', 1)).ok).toBe(true);
  });

  it('a compra obedece ao depósito da dificuldade, e a comida, ao Celeiro', () => {
    const king = marketStall(0, (draft) => (draft.settlement.resources.food = 0), {
      difficulty: 'ironKing',
    });
    const cap = (storageCapacity(king, 'food') ?? 0) / 1000;
    expect(cap).toBe(1280);
    const all = marketStall(0, (draft) => (draft.settlement.resources.food = 0), {
      difficulty: 'ironKing',
      level: 5,
    });
    expect(maxBuyable(all, 'food')).toBe(1000);
    const nearly = marketStall(0, (draft) => (draft.settlement.resources.food = 1_000_000), {
      difficulty: 'ironKing',
      level: 5,
    });
    expect(maxBuyable(nearly, 'food')).toBe(280);
    expect(refuse(nearly, tradeOrder(nearly, 'food', 'buy', 281)).message).toBe(
      'A compra não cabe: o Celeiro guarda 1.280 de comida, e só cabem mais 280.',
    );
  });

  it('as recusas vêm em ordem: a cotação antes do volume, o volume antes do que falta, o que falta antes do depósito', () => {
    const stall = marketStall(0, (draft) => {
      Object.assign(draft.settlement.resources, { gold: 0, stone: 2_800_000 });
    });
    const stale = command('trade', {
      resource: 'stone',
      direction: 'buy',
      amount: 500,
      quoteDay: 3,
    });
    expect(refuse(stall, stale).code).toBe('PRICE_CHANGED');
    expect(refuse(stall, tradeOrder(stall, 'stone', 'buy', 500)).code).toBe(
      'DAILY_VOLUME_EXCEEDED',
    );
    expect(refuse(stall, tradeOrder(stall, 'stone', 'buy', 5)).code).toBe('INSUFFICIENT_RESOURCES');
    const rich = cloneState(stall);
    rich.settlement.resources.gold = 1_000_000;
    expect(refuse(rich, tradeOrder(rich, 'stone', 'buy', 5)).code).toBe('STORAGE_FULL');
  });
});

describe('comprar barato e vender caro', () => {
  it('comprar comida no último dia do verão e vender no primeiro do outono dá lucro, e é intencional (GDD §5.9)', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const summer = stallWith(
        AUTUMN - HOUR,
        {},
        (draft) => (draft.settlement.resources.food = 500_000),
        { seed },
      );
      expect(quote(summer, 'food').buy).toBe(1000);
      const bought = accept(summer, tradeOrder(summer, 'food', 'buy', 100)).state;
      const spent = gold(summer) - gold(bought);
      expect(spent).toBe(100_000);
      const autumn = advanceTo(bought, AUTUMN).state;
      // No pior passo (−5%), a comida vale 950 × 1,3 × 0,85 = 1049,75 na venda.
      expect(quote(autumn, 'food').sell).toBeGreaterThanOrEqual(1049);
      const sold = accept(autumn, tradeOrder(autumn, 'food', 'sell', 100)).state;
      expect(gold(sold) - gold(autumn)).toBeGreaterThan(spent);
    }
  });

  it('no mesmo dia, comprar e vender de volta sempre perde: 15% e o arredondamento', () => {
    for (const at of [SUMMER + DAY, AUTUMN + 3 * DAY, WINTER + DAY]) {
      for (const price of [600, 999, 1001, 1337, 1600]) {
        const stall = stallWith(at, { food: price }, (draft) => {
          draft.settlement.resources.food = 0;
        });
        const bought = accept(stall, tradeOrder(stall, 'food', 'buy', 60)).state;
        const back = accept(bought, tradeOrder(bought, 'food', 'sell', 60)).state;
        expect(stock(back, 'food')).toBe(stock(stall, 'food'));
        expect(gold(back)).toBeLessThan(gold(stall));
        // Sessenta idas e voltas de uma unidade perdem o mesmo que uma de sessenta.
        let churn = stall;
        for (let unit = 0; unit < 60; unit += 1) {
          churn = accept(churn, tradeOrder(churn, 'food', 'buy', 1)).state;
        }
        for (let unit = 0; unit < 60; unit += 1) {
          churn = accept(churn, tradeOrder(churn, 'food', 'sell', 1)).state;
        }
        expect(gold(churn)).toBe(gold(back));
      }
    }
  });
});

describe('o Mercado na visão (V3E-T1.6)', () => {
  it('existe sempre: sem o edifício diz como obtê-lo, e não mostra preço nenhum', () => {
    // As caravanas têm os testes delas (`market.caravans.test.ts`).
    const { caravans, caravanOffer, ...early } = view(newGame()).market;
    expect(caravans).toEqual([]);
    expect(caravanOffer.available).toBe(false);
    expect(early).toEqual({
      building: 'market',
      level: 0,
      text: 'O Mercado abre com o Salão do Senhor Nv3: nele o feudo compra e vende comida, madeira e pedra por ouro.',
      quoteDay: 0,
      nextChangeInSeconds: null,
      dailyVolume: 0,
      prices: [],
    });
    expect(view(tavernSite()).market.text).toBe(
      'Erga o Mercado: nele o feudo compra e vende comida, madeira e pedra por ouro.',
    );
    expect(maxBuyable(tavernSite(), 'food')).toBe(0);
    expect(maxSellable(tavernSite(), 'food')).toBe(0);
  });

  it('com o Mercado, traz o preço de hoje de cada recurso, na ordem do conteúdo, e o prazo real até ele mudar', () => {
    const stall = stallWith(6 * DAY + 30 * MINUTE, { wood: 1260 }, (draft) => {
      draft.market.previousPrices.wood = 1230;
      draft.market.quoteDay = 7;
      draft.rng.market = [1, 2, 3, 4];
    });
    const market = view(stall).market;
    expect(market.level).toBe(1);
    expect(market.text).toBe(
      'Mercado Nv1: negocia até 200 de cada recurso por dia de jogo, entre compras e vendas.',
    );
    expect(market.quoteDay).toBe(7);
    expect(market.dailyVolume).toBe(200);
    // Falta 1 h 30 min de jogo para a virada: no ritmo 1, 5.400 s; no Rápido, um terço.
    expect(market.nextChangeInSeconds).toBe(5400);
    expect(
      deriveViewState(stall, stall.lastProcessedAt, { timeScale: 3 }).market.nextChangeInSeconds,
    ).toBe(1800);
    expect(market.prices.map((row) => row.resource)).toEqual(['food', 'wood', 'stone']);
    expect(market.prices[1]).toEqual({
      resource: 'wood',
      label: 'Madeira',
      buy: 1260,
      sell: 1071,
      buyText: '1,26',
      sellText: '1,071',
      baseText: '1,20',
      trend: 'up',
      breakdown: '1,26 (cotação de hoje; a base é 1,20). A venda paga 85%: 1,071.',
      tradedToday: 0,
      remainingToday: 200,
      // O Armazém do canteiro está cheio de madeira.
      maxBuyable: 0,
      maxSellable: 200,
      // Fora do inverno e sem obra automática, o feudo não guarda madeira (E-43).
      surplusSellable: 200,
      reserve: 0,
      surplusText: 'O feudo não guarda madeira agora: o que há no estoque pode sair.',
      buyBlockedReason: 'A compra não cabe: o Armazém guarda 2.800 de madeira, e está cheio.',
      sellBlockedReason: null,
    });
    expect(market.prices[0]).toMatchObject({ buyText: '1,00', sellText: '0,85', trend: 'flat' });
    expect(market.prices[2]).toMatchObject({ buyText: '2,00', sellText: '1,70', baseText: '2,00' });
  });

  it('os preços por extenso têm duas casas, e a terceira quando ela existe', () => {
    expect(priceText(1000)).toBe('1,00');
    expect(priceText(1300)).toBe('1,30');
    expect(priceText(1105)).toBe('1,105');
    expect(priceText(850)).toBe('0,85');
    expect(priceText(7)).toBe('0,007');
    expect(priceText(1_234_560)).toBe('1.234,56');
  });

  it('no outono e no inverno a explicação mostra o fator da estação sobre a comida, e só sobre ela', () => {
    const autumn = stallWith(AUTUMN + 2 * DAY, {});
    expect(priceRow(autumn, 'food')).toMatchObject({
      buy: 1300,
      sell: 1105,
      breakdown:
        '1,30 = 1,00 (cotação de hoje; a base é 1,00) × 1,3 (Outono). A venda paga 85%: 1,105.',
    });
    expect(priceRow(autumn, 'wood').breakdown).toBe(
      '1,20 (cotação de hoje; a base é 1,20). A venda paga 85%: 1,02.',
    );
    const winter = stallWith(WINTER + DAY, { food: 950 });
    expect(priceRow(winter, 'food').breakdown).toBe(
      '1,235 = 0,95 (cotação de hoje; a base é 1,00) × 1,3 (Inverno). A venda paga 85%: 1,049.',
    );
    expect(priceRow(stallWith(SUMMER, {}), 'food').buy).toBe(1000);
    expect(priceRow(stallWith(YEAR, {}), 'food').buy).toBe(1000);
  });

  it('a tendência compara o preço de hoje com o de ontem: na virada para o outono a comida sobe pela estação, e na da primavera cai', () => {
    const flat = stallWith(AUTUMN - HOUR, {}, undefined, { seed: 'mercado-6' });
    expect(priceRow(flat, 'food').trend).toBe('flat');
    const autumn = advanceTo(flat, AUTUMN).state;
    expect(priceRow(autumn, 'food').trend).toBe('up');
    for (const resource of ['wood', 'stone'] as const) {
      const { prices, previousPrices } = autumn.market;
      const expected =
        prices[resource] === previousPrices[resource]
          ? 'flat'
          : prices[resource] > previousPrices[resource]
            ? 'up'
            : 'down';
      expect(priceRow(autumn, resource).trend).toBe(expected);
    }
    const spring = advanceTo(
      stallWith(YEAR - HOUR, {}, undefined, { seed: 'mercado-6' }),
      YEAR,
    ).state;
    expect(priceRow(spring, 'food').trend).toBe('down');
    // No meio do outono a tendência é só a do passeio: o fator é o mesmo nos dois dias.
    const mid = advanceTo(stallWith(AUTUMN + 4 * DAY + HOUR, {}), AUTUMN + 6 * DAY).state;
    const { prices, previousPrices } = mid.market;
    expect(priceRow(mid, 'food').trend).toBe(
      prices.food === previousPrices.food
        ? 'flat'
        : prices.food > previousPrices.food
          ? 'up'
          : 'down',
    );
  });

  it('o máximo que se compra e se vende já conta o volume, o ouro, o estoque e o depósito, e é exatamente o que a ordem aceita', () => {
    const cases: Array<[string, (draft: GameState) => void]> = [
      ['o volume manda', () => {}],
      ['o ouro manda', (draft) => (draft.settlement.resources.gold = 77_777)],
      ['o depósito manda', (draft) => (draft.settlement.resources.stone = 2_733_400)],
      ['o estoque manda', (draft) => (draft.settlement.resources.stone = 41_999)],
      [
        'sem ouro e sem estoque',
        (draft) => Object.assign(draft.settlement.resources, { gold: 0, stone: 0 }),
      ],
      ['parte do volume gasta', (draft) => (draft.market.tradedToday.stone = 163)],
    ];
    for (const [name, edit] of cases) {
      const stall = stallWith(3 * DAY, { stone: 2037 }, edit);
      const row = priceRow(stall, 'stone');
      expect(row.maxBuyable, name).toBe(maxBuyable(stall, 'stone'));
      expect(row.maxSellable, name).toBe(maxSellable(stall, 'stone'));
      for (const [direction, max, reason] of [
        ['buy', row.maxBuyable, row.buyBlockedReason],
        ['sell', row.maxSellable, row.sellBlockedReason],
      ] as const) {
        if (max > 0) {
          expect(apply(stall, tradeOrder(stall, 'stone', direction, max)).ok, name).toBe(true);
          expect(reason, name).toBeNull();
        } else {
          expect(reason, name).toBe(
            refuse(stall, tradeOrder(stall, 'stone', direction, 1)).message,
          );
        }
        expect(apply(stall, tradeOrder(stall, 'stone', direction, max + 1)).ok, name).toBe(false);
      }
    }
    const broke = stallWith(
      3 * DAY,
      { stone: 2037 },
      (draft) => (draft.settlement.resources.gold = 77_777),
    );
    // 77,777 de ouro a 2,037 por unidade: 38 unidades.
    expect(priceRow(broke, 'stone').maxBuyable).toBe(38);
  });

  it('o excedente: quanto dá para vender hoje sem tirar do feudo a comida guardada, a lenha do inverno e as obras automáticas (E-43)', () => {
    const base = (edit: (draft: GameState) => void, atMs = 3 * DAY) =>
      marketStall(atMs, (draft) => {
        draft.settlement.population.villagers = 5;
        draft.settlement.recruitmentQueue = [];
        draft.settlement.planned = [];
        edit(draft);
      });
    // Comida: cinco bocas guardam um dia real de consumo (24 h de jogo × 1 por hora): 120.
    const fed = base((draft) => (draft.settlement.resources.food = 500_000));
    expect(marketReserve(fed, 'food')).toEqual({ units: 120, reasons: ['foodReserve'] });
    expect(priceRow(fed, 'food')).toMatchObject({
      maxSellable: 200,
      // 380 acima da reserva, e o volume do dia é 200.
      surplusSellable: 200,
      reserve: 120,
      surplusText: 'O feudo guarda 120 de comida: a comida guardada que sustenta a moral.',
    });
    const tight = base((draft) => (draft.settlement.resources.food = 150_999));
    expect(priceRow(tight, 'food')).toMatchObject({ maxSellable: 150, surplusSellable: 30 });
    const short = base((draft) => (draft.settlement.resources.food = 100_000));
    expect(priceRow(short, 'food')).toMatchObject({ maxSellable: 100, surplusSellable: 0 });
    // Vender o excedente inteiro não toca a comida guardada.
    const sold = accept(tight, tradeOrder(tight, 'food', 'sell', 30)).state;
    expect(sold.settlement.resources.food).toBeGreaterThanOrEqual(120_000);
    expect(surplusSellable(sold, 'food')).toBe(0);
    // Madeira e pedra fora do inverno e sem obra automática: nada a guardar.
    expect(priceRow(fed, 'wood')).toMatchObject({
      reserve: 0,
      surplusSellable: priceRow(fed, 'wood').maxSellable,
      surplusText: 'O feudo não guarda madeira agora: o que há no estoque pode sair.',
    });
    // No inverno, a lenha do resto da estação: 5 habitantes queimam 2,5 por hora de jogo, e
    // faltam 10 dias de jogo (20 h) menos uma hora para a primavera.
    const cold = base(
      (draft) => (draft.settlement.resources.wood = 100_000),
      WINTER + 2 * DAY + HOUR,
    );
    const burned = Math.ceil((5 * 0.5 * (10 * 2 - 1) * 1000) / 1000);
    expect(marketReserve(cold, 'wood')).toEqual({ units: burned, reasons: ['firewood'] });
    expect(priceRow(cold, 'wood').surplusSellable).toBe(100 - burned);
    expect(priceRow(cold, 'wood').surplusText).toBe(
      `O feudo guarda ${burned} de madeira: a lenha do resto do inverno.`,
    );
    // A obra automática reserva o custo dela, nos recursos que pede; a manual, não.
    const planning = base((draft) => {
      draft.settlement.resources.wood = 300_000;
      draft.settlement.planned = [
        { building: 'farm', targetLevel: draft.settlement.buildings.farm + 1, autoStart: true },
        {
          building: 'quarry',
          targetLevel: draft.settlement.buildings.quarry + 1,
          autoStart: false,
        },
      ];
    });
    const woodCost =
      planCost({
        building: 'farm',
        targetLevel: planning.settlement.buildings.farm + 1,
        autoStart: true,
      }).wood ?? 0;
    expect(woodCost).toBeGreaterThan(0);
    expect(woodCost).toBeLessThan(300);
    expect(marketReserve(planning, 'wood')).toEqual({ units: woodCost, reasons: ['planned'] });
    expect(priceRow(planning, 'wood')).toMatchObject({
      surplusSellable: Math.min(200, 300 - woodCost),
      surplusText: `O feudo guarda ${woodCost} de madeira: o custo das obras automáticas.`,
    });
    // O atalho nunca passa do que a ordem aceita.
    for (const state of [fed, tight, short, cold, planning]) {
      for (const row of deriveViewState(state, state.lastProcessedAt).market.prices) {
        expect(row.surplusSellable).toBeLessThanOrEqual(row.maxSellable);
        expect(row.surplusSellable).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('não muda o estado, não sorteia e não dá identificador; `nextEventAt` também não', () => {
    const { state } = marketScenario(7 * DAY + HOUR, undefined, { seed: 'mercado-8' });
    for (const subject of [state, advanceTo(state, 12 * DAY + 5 * MINUTE).state]) {
      const frozen = JSON.stringify(subject);
      for (const timeScale of [3, 1, 0.5]) {
        deriveViewState(subject, subject.lastProcessedAt, { timeScale });
      }
      nextEventAt(subject);
      expect(JSON.stringify(subject)).toBe(frozen);
    }
  });

  it('a virada do dia já era um instante da linha do tempo: o Mercado não cria outro', () => {
    const stall = marketStall(DAY + HOUR);
    const plain = tavernSite(DAY + HOUR);
    expect(nextEventAt(stall)).toBe(nextEventAt(plain));
  });
});

describe('a névoa do Mercado (roadmap §0.7, "Visão e privacidade")', () => {
  it('duas partidas com o mesmo hoje e amanhãs diferentes dão a mesma visão', () => {
    const today = advanceTo(marketStall(0, undefined, { seed: 'mercado-9' }), 4 * DAY + HOUR).state;
    const other = cloneState(today);
    // O mesmo hoje, outro futuro: o fluxo do Mercado em outro ponto.
    other.rng.market = [11, 22, 33, 44];
    expect(deriveViewState(other, other.lastProcessedAt)).toStrictEqual(
      deriveViewState(today, today.lastProcessedAt),
    );
    const next = (state: GameState) => advanceTo(state, 5 * DAY).state.market.prices;
    expect(next(other)).not.toStrictEqual(next(today));
  });

  it('o preço de amanhã, o de ontem e o gerador nunca saem na visão', () => {
    const today = advanceTo(marketStall(0, undefined, { seed: 'mercado-9' }), 4 * DAY + HOUR).state;
    const tomorrow = advanceTo(today, 5 * DAY).state;
    const shown = JSON.stringify(view(today));
    expect(shown).not.toContain('previousPrices');
    expect(shown).not.toContain('rng');
    expect(Object.keys(view(today).market)).toEqual([
      'building',
      'level',
      'text',
      'quoteDay',
      'nextChangeInSeconds',
      'dailyVolume',
      'prices',
      'caravans',
      'caravanOffer',
    ]);
    for (const resource of RESOURCES) {
      const price = tomorrow.market.prices[resource];
      const { buy, sell } = quote(tomorrow, resource);
      if (price !== today.market.prices[resource]) {
        const numbers = view(today).market.prices.flatMap((row) => [row.buy, row.sell]);
        expect(numbers).not.toContain(buy);
        expect(numbers).not.toContain(sell);
      }
    }
    for (const word of today.rng.market ?? []) {
      expect(shown).not.toContain(String(word));
    }
  });
});
