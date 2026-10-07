import { balance, caravanTexts } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  ambushLoss,
  ambushPercent,
  caravanSlots,
  caravanUnitPrice,
  maxSendable,
  nextCaravanArrivalAt,
  slotsAtLevel,
} from './caravans';
import { priceBounds, quote } from './market';
import { currentShape } from './migrations';
import { cloneState } from './state';
import {
  accept,
  addHero,
  apply,
  AUTUMN,
  caravanOrder,
  caravanPost,
  command,
  DAY,
  eventsOfType,
  guildHall,
  HOUR,
  MINUTE,
  QUOTE_OF_NOW,
  refuse,
  SPRING,
  SUMMER,
  tradeOrder,
  WINTER,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';
import { MILLI } from './units';
import { deriveViewState } from './view';

const { caravan: rules } = balance.market;
const TRIP = rules.tripMs;

/** O que a matriz QA-10 mediu sem escolta, com a Torre nos níveis 0, 1 e 2 (de 1.000 cada). */
const QA10_MEASURED = [116, 50, 24];
/** O índice de uma semente da matriz emboscada sem Torre e salva pela Torre no nível 1. */
const TOWER_SAVES = 0;
/** Uma semente em que a primeira caravana sem escolta, com a Torre no nível 2, é emboscada. */
const AMBUSH_SEED = 'qa-10-32';

/** A semente do teste de névoa e os dois valores do contador de caravanas que dão finais diferentes. */
const FOG_SEED = 'nevoa-caravana';
const FOG_ISSUED: [number, number] = [0, 1];

const view = (state: GameState) => deriveViewState(state, state.lastProcessedAt);
const gold = (state: GameState) => state.settlement.resources.gold;
const stored = (state: GameState) => JSON.parse(JSON.stringify(state)) as GameState;
const caravanStreams = (state: GameState) =>
  Object.keys(state.rng).filter((key) => key.startsWith('caravan:'));

/** O feudo das caravanas com Edda e Rolf no feudo, prontos. */
const withHeroes =
  (edit: (draft: GameState) => void = () => {}) =>
  (draft: GameState) => {
    addHero(draft, { name: 'Edda', gender: 'f', classId: 'warrior' });
    addHero(draft, { name: 'Rolf', classId: 'archer' });
    edit(draft);
  };

/** Envia uma caravana agora e a leva até a chegada: o estado de antes, o de depois e os eventos. */
function trip(
  start: GameState,
  amount = 300,
  escortHeroId: string | null = null,
): { sent: GameState; arrived: GameState; events: GameEvent[]; arrivesAt: number } {
  const sent = accept(start, caravanOrder('wood', amount, escortHeroId));
  const arrivesAt = start.lastProcessedAt + TRIP;
  const arrived = advanceTo(sent.state, arrivesAt);
  return {
    sent: sent.state,
    arrived: arrived.state,
    events: [...sent.events, ...arrived.events],
    arrivesAt,
  };
}

describe('as contas das caravanas (V3E-T2.1; ADR 0018, decisão 17)', () => {
  it('os lugares na estrada: nenhum até o Mercado Nv1, um no Nv2 e no Nv3, dois no Nv4 e no Nv5', () => {
    expect([0, 1, 2, 3, 4, 5].map(slotsAtLevel)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(caravanSlots(caravanPost(0, undefined, { level: 4 }))).toBe(2);
  });

  it('a chance de emboscada é 10%, 5% e 2% com a Torre nos níveis 0, 1 e 2, e nunca passa do piso', () => {
    expect([0, 1, 2].map(ambushPercent)).toEqual([10, 5, 2]);
    expect(ambushPercent(7)).toBe(2);
  });

  it('a emboscada leva metade da carga, arredondada para baixo', () => {
    expect([1, 2, 3, 299, 300].map(ambushLoss)).toEqual([0, 1, 1, 149, 150]);
  });

  it('o preço da caravana é o de venda de agora × 23/20, arredondado para baixo, em milésimos', () => {
    const state = caravanPost();
    // Madeira na base: 1,20 de compra, 1,02 de venda; × 1,15 dá 1,173.
    expect(quote(state, 'wood').sell).toBe(1020);
    expect(caravanUnitPrice(state, 'wood')).toBe(1173);
    // Comida: 0,85 × 1,15 = 0,9775, arredondado para baixo.
    expect(caravanUnitPrice(state, 'food')).toBe(977);
    expect(caravanUnitPrice(state, 'stone')).toBe(1955);
    // No outono a comida vale mais no Mercado, e na caravana também.
    const autumn = caravanPost(AUTUMN + HOUR);
    expect(caravanUnitPrice(autumn, 'food')).toBe(
      Math.floor((quote(autumn, 'food').sell * 23) / 20),
    );
    expect(caravanUnitPrice(autumn, 'food')).toBeGreaterThan(caravanUnitPrice(state, 'food'));
  });
});

describe('comprar no balcão e enviar por caravana nunca rende (resposta do autor de 2026-10-07; revisão da Fase E, D1)', () => {
  const RESOURCES = balance.market.resources;

  it('a reprodução do defeito: Mercado Nv2, preços na base, escolta, comprar 300 e enviar 300 no mesmo instante perde ouro nos três recursos', () => {
    for (const resource of RESOURCES) {
      const start = caravanPost(
        0,
        withHeroes((draft) => {
          // Lugar no depósito para a compra caber.
          draft.settlement.resources[resource] = 100_000;
        }),
      );
      const bought = accept(start, tradeOrder(start, resource, 'buy', 300)).state;
      const sent = accept(bought, caravanOrder(resource, 300, 'hero-1')).state;
      const arrived = advanceTo(sent, TRIP).state;
      // O mesmo feudo sem a manobra: a Mina e o soldo andam igual nos dois.
      const idle = advanceTo(start, TRIP).state;
      expect(arrived.settlement.resources[resource]).toBe(idle.settlement.resources[resource]);
      const profit = gold(arrived) - gold(idle);
      expect(profit).toBe(300 * (caravanUnitPrice(start, resource) - quote(start, resource).buy));
      expect(profit).toBeLessThan(0);
    }
  });

  it('em todo preço entre o piso e o teto, em todo recurso e em toda estação, a caravana paga menos do que a compra do mesmo dia cobra', () => {
    let worst = -Infinity;
    for (const season of [SPRING, SUMMER, AUTUMN, WINTER]) {
      const state = cloneState(caravanPost(season + HOUR));
      for (const resource of RESOURCES) {
        const { floor, ceiling } = priceBounds(resource);
        for (let price = floor; price <= ceiling; price += 1) {
          state.market.prices[resource] = price;
          const margin = caravanUnitPrice(state, resource) - quote(state, resource).buy;
          worst = Math.max(worst, margin);
          if (margin >= 0) {
            throw new Error(`${resource} a ${price} em ${season}: a caravana rende ${margin}`);
          }
        }
      }
    }
    // O melhor caso para quem tenta: ainda perde ao menos um milésimo e meio por cento do preço.
    expect(worst).toBeLessThan(0);
  });

  it('por propriedade: comprar e enviar no mesmo dia, com qualquer quantidade, preço e escolta, nunca deixa mais ouro do que não fazer nada', () => {
    fc.assert(
      fc.property(
        fc.record({
          resource: fc.constantFrom(...RESOURCES),
          season: fc.constantFrom(SPRING, SUMMER, AUTUMN, WINTER),
          share: fc.integer({ min: 0, max: 1000 }),
          amount: fc.integer({ min: 1, max: 300 }),
          escorted: fc.boolean(),
          level: fc.constantFrom(2, 3, 4, 5),
          waitMs: fc.integer({ min: 0, max: DAY - 2 * MINUTE }),
        }),
        (plan) => {
          const { floor, ceiling } = priceBounds(plan.resource);
          const start = caravanPost(
            plan.season + MINUTE,
            withHeroes((draft) => {
              draft.settlement.resources[plan.resource] = 100_000;
              draft.market.prices[plan.resource] =
                floor + Math.floor(((ceiling - floor) * plan.share) / 1000);
            }),
            { level: plan.level, tower: 2 },
          );
          const bought = accept(start, tradeOrder(start, plan.resource, 'buy', plan.amount)).state;
          // A carga parte no mesmo dia de jogo, logo ou mais tarde.
          const later = advanceTo(bought, bought.lastProcessedAt + plan.waitMs).state;
          const sent = accept(
            later,
            caravanOrder(plan.resource, plan.amount, plan.escorted ? 'hero-1' : null),
          ).state;
          const end = sent.lastProcessedAt + TRIP;
          const arrived = advanceTo(sent, end).state;
          const idle = advanceTo(start, end).state;
          expect(gold(arrived)).toBeLessThan(gold(idle));
        },
      ),
      { numRuns: 60 },
    );
  });

  it('a especulação sazonal continua, limitada (GDD §5.9): comida comprada no último dia do verão e enviada no primeiro do outono rende 0,27 por unidade na base', () => {
    const summer = caravanPost(AUTUMN - HOUR, (draft) => {
      draft.settlement.resources.food = 100_000;
    });
    const autumn = cloneState(summer);
    autumn.lastProcessedAt = AUTUMN + MINUTE;
    expect(quote(summer, 'food').buy).toBe(1000);
    // 1,00 × 1,3 × 0,85 = 1,105 no balcão; × 1,15 = 1,270 na caravana.
    expect(quote(autumn, 'food').sell).toBe(1105);
    expect(caravanUnitPrice(autumn, 'food')).toBe(1270);
  });
});

describe('a ordem de enviar (V3E-T2.2)', () => {
  it('tira a carga do estoque, fixa o preço, marca a chegada 4 h de jogo adiante e não conta no volume do dia', () => {
    const start = caravanPost(5 * DAY + 10 * MINUTE);
    const before = start.settlement.resources.wood;
    const { state, events } = accept(start, caravanOrder('wood', 300));
    expect(state.settlement.resources.wood).toBe(before - 300 * MILLI);
    // O ouro só entra na chegada.
    expect(gold(state)).toBe(gold(start));
    expect(state.market.caravans).toEqual([
      {
        id: 'caravan-1',
        resource: 'wood',
        amount: 300,
        unitPrice: 1173,
        arrivesAtMs: start.lastProcessedAt + 4 * HOUR,
        escortHeroId: null,
      },
    ]);
    expect(state.market.tradedToday).toEqual({ food: 0, wood: 0, stone: 0 });
    expect(state.stats.caravansSent).toBe(1);
    expect(state.stats.sold_wood).toBeUndefined();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'caravanSent',
      atMs: start.lastProcessedAt,
      data: {
        caravanId: 'caravan-1',
        resource: 'wood',
        amount: 300,
        unitPrice: 1173,
        arrivesAtMs: start.lastProcessedAt + 4 * HOUR,
        escorted: 0,
        spent_wood: 300,
      },
    });
    expect(events[0]?.text).toBe(
      'No 6º dia da Primavera, uma caravana deixou Pedra Alta rumo a Porto do Rio, com 300 de madeira. Vai sem escolta.',
    );
    expect(currentShape(stored(state), '')).toBeNull();
  });

  it('não sorteia, e o fluxo da caravana nem nasce: a ordem só gasta um identificador', () => {
    const start = caravanPost(0, withHeroes());
    const { state } = accept(start, caravanOrder('wood', 300));
    expect(state.rng).toStrictEqual(start.rng);
    expect(caravanStreams(state)).toEqual([]);
    expect(state.ids).toEqual({ ...start.ids, caravan: 1 });
    // A recusada não gasta nem isso.
    const refused = apply(state, caravanOrder('stone', 10));
    expect(refused.ok).toBe(false);
  });

  it('com escolta, o herói fica fora do feudo e a Crônica diz quem vai', () => {
    const start = caravanPost(0, withHeroes());
    const { state, events } = accept(start, caravanOrder('food', 120, 'hero-1'));
    expect(state.market.caravans[0]).toMatchObject({ escortHeroId: 'hero-1', amount: 120 });
    expect(state.guild.heroes.map((hero) => hero.status)).toEqual(['escort', 'idle']);
    expect(events[0]).toMatchObject({
      type: 'caravanSent',
      data: { escorted: 1, heroId: 'hero-1', spent_food: 120 },
    });
    expect(events[0]?.text).toBe(
      'No 1º dia da Primavera, uma caravana deixou Pedra Alta rumo a Porto do Rio, com 120 de comida. Edda vai de escolta.',
    );
    expect(currentShape(stored(state), '')).toBeNull();
  });

  it('pede o Mercado no nível 2: sem ele e no nível 1 a recusa diz o nível e onde o feudo está', () => {
    expect(refuse(caravanPost(0, undefined, { level: 0 }), caravanOrder('wood', 10))).toEqual({
      code: 'MARKET_LEVEL_REQUIRED',
      message: 'As caravanas pedem o Mercado no nível 2: o feudo ainda não o tem.',
    });
    expect(refuse(caravanPost(0, undefined, { level: 1 }), caravanOrder('wood', 10))).toEqual({
      code: 'MARKET_LEVEL_REQUIRED',
      message: 'As caravanas pedem o Mercado no nível 2: o do feudo está no nível 1.',
    });
  });

  it('uma caravana por vez no Mercado Nv2 e Nv3, duas no Nv4: a recusa diz quantas e o que abre mais uma', () => {
    const one = accept(caravanPost(), caravanOrder('wood', 100)).state;
    expect(refuse(one, caravanOrder('stone', 50))).toEqual({
      code: 'CARAVAN_LIMIT',
      message:
        'O Mercado Nv2 mantém 1 caravana na estrada por vez: espere a chegada, ou amplie o Mercado (no nível 4, 2 caravanas).',
    });
    const big = caravanPost(0, undefined, { level: 4 });
    const two = accept(accept(big, caravanOrder('wood', 100)).state, caravanOrder('stone', 50));
    expect(two.state.market.caravans.map((entry) => entry.id)).toEqual(['caravan-1', 'caravan-2']);
    expect(refuse(two.state, caravanOrder('food', 50))).toEqual({
      code: 'CARAVAN_LIMIT',
      message: 'O Mercado Nv4 mantém 2 caravanas na estrada por vez: espere a chegada.',
    });
    // O lugar volta na chegada.
    const back = advanceTo(one, one.lastProcessedAt + TRIP).state;
    expect(apply(back, caravanOrder('stone', 50)).ok).toBe(true);
  });

  it('o que não é uma carga é recusado: outro recurso, quantidade que não é inteiro de 1 a 300', () => {
    const state = caravanPost();
    const order = (payload: Record<string, unknown>) =>
      refuse(state, command('sendCaravan', { quoteDay: QUOTE_OF_NOW, ...payload } as never));
    expect(order({ resource: 'gold', amount: 10, escortHeroId: null })).toEqual({
      code: 'INVALID_AMOUNT',
      message: 'Uma caravana leva um recurso só: comida, madeira ou pedra.',
    });
    for (const amount of [0, -5, 1.5, 301, Number.NaN, '10']) {
      expect(order({ resource: 'wood', amount, escortHeroId: null })).toEqual({
        code: 'INVALID_AMOUNT',
        message: 'Uma caravana leva de uma a 300 unidades, em número inteiro.',
      });
    }
    expect(apply(state, caravanOrder('wood', 1)).ok).toBe(true);
    expect(apply(state, caravanOrder('wood', 300)).ok).toBe(true);
  });

  it('a cotação de ontem é recusada (E-15): o dia virou entre a tela e o envio, e nada sai do estoque; a de hoje vale', () => {
    const state = caravanPost();
    const stale = caravanOrder('wood', 100, null, state.market.quoteDay + 1);
    expect(refuse(state, stale)).toEqual({
      code: 'PRICE_CHANGED',
      message: 'O dia virou e o preço do Mercado mudou: confira o preço de hoje e peça de novo.',
    });
    expect(apply(state, caravanOrder('wood', 100, null, state.market.quoteDay)).ok).toBe(true);
    // A cotação velha é conferida antes da carga e da escolta, como em `trade`.
    expect(refuse(state, caravanOrder('wood', 0, 'hero-9', state.market.quoteDay + 1)).code).toBe(
      'PRICE_CHANGED',
    );
    // O que abre o Mercado e a estrada vem antes: sem lugar, a cotação nem é lida.
    const busy = accept(state, caravanOrder('wood', 10)).state;
    expect(refuse(busy, caravanOrder('wood', 10, null, busy.market.quoteDay + 1)).code).toBe(
      'CARAVAN_LIMIT',
    );
  });

  it('a carga que o estoque não tem é recusada com o que falta', () => {
    const state = caravanPost(0, (draft) => {
      draft.settlement.resources.stone = 99_500;
    });
    expect(refuse(state, caravanOrder('stone', 120))).toEqual({
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 21 pedra.',
    });
    expect(apply(state, caravanOrder('stone', 99)).ok).toBe(true);
  });

  it('a escolta que não serve ao feudo, ou que não pode partir, é recusada com o nome e o motivo', () => {
    const hall = guildHall(0, withHeroes(), { level: 1 });
    hall.settlement.buildings.market = 4;
    expect(refuse(hall, caravanOrder('wood', 10, 'hero-9'))).toMatchObject({
      code: 'HERO_NOT_FOUND',
    });
    // Edda em expedição.
    const away = accept(
      hall,
      command('sendExpedition', { modelId: 'patrol', heroIds: ['hero-1'], posture: 'balanced' }),
    ).state;
    expect(refuse(away, caravanOrder('wood', 10, 'hero-1'))).toEqual({
      code: 'HERO_UNAVAILABLE',
      message: 'Edda não pode partir agora: já está em expedição.',
    });
    // Rolf já em escolta: nem outra caravana, nem expedição.
    const escorting = accept(away, caravanOrder('wood', 10, 'hero-2')).state;
    expect(refuse(escorting, caravanOrder('stone', 10, 'hero-2'))).toEqual({
      code: 'HERO_UNAVAILABLE',
      message: 'Rolf não pode partir agora: já escolta uma caravana.',
    });
    // Ferido e em cativeiro.
    const hurt = cloneState(hall);
    Object.assign(hurt.guild.heroes[0] ?? {}, {
      status: 'injured',
      injury: { severity: 'light', untilMs: HOUR },
    });
    Object.assign(hurt.guild.heroes[1] ?? {}, {
      status: 'captured',
      captivity: { sinceMs: 0, modelId: 'patrol' },
    });
    expect(refuse(hurt, caravanOrder('wood', 10, 'hero-1')).message).toBe(
      'Edda não pode partir agora: ainda se recupera dos ferimentos.',
    );
    expect(refuse(hurt, caravanOrder('wood', 10, 'hero-2')).message).toBe(
      'Rolf não pode partir agora: está em cativeiro.',
    );
  });

  it('as recusas vêm em ordem: o nível, o lugar na estrada, a carga, o estoque e, por último, a escolta', () => {
    const low = caravanPost(0, undefined, { level: 1 });
    expect(refuse(low, caravanOrder('wood', 0, 'hero-9')).code).toBe('MARKET_LEVEL_REQUIRED');
    const busy = accept(caravanPost(), caravanOrder('wood', 10)).state;
    expect(refuse(busy, caravanOrder('wood', 0, 'hero-9')).code).toBe('CARAVAN_LIMIT');
    const free = caravanPost();
    expect(refuse(free, caravanOrder('wood', 0, 'hero-9')).code).toBe('INVALID_AMOUNT');
    free.settlement.resources.wood = 5_000;
    expect(refuse(free, caravanOrder('wood', 10, 'hero-9')).code).toBe('INSUFFICIENT_RESOURCES');
    expect(refuse(free, caravanOrder('wood', 5, 'hero-9')).code).toBe('HERO_NOT_FOUND');
  });
});

describe('a chegada (V3E-T2.3)', () => {
  it('é um instante da linha do tempo: um milissegundo antes a carga ainda está na estrada; nele, o ouro entra', () => {
    const start = caravanPost(5 * DAY + 10 * MINUTE, withHeroes());
    const sent = accept(start, caravanOrder('wood', 300, 'hero-1')).state;
    const arrivesAt = start.lastProcessedAt + TRIP;
    expect(nextCaravanArrivalAt(sent)).toBe(arrivesAt);
    const almost = advanceTo(sent, arrivesAt - 1);
    expect(almost.state.market.caravans).toHaveLength(1);
    expect(eventsOfType(almost.events, 'caravanArrived')).toEqual([]);
    expect(nextEventAt(almost.state)).toBe(arrivesAt);
    const there = advanceTo(almost.state, arrivesAt);
    expect(there.state.market.caravans).toEqual([]);
    const [arrival] = eventsOfType(there.events, 'caravanArrived');
    expect(arrival).toMatchObject({
      atMs: arrivesAt,
      data: {
        caravanId: 'caravan-1',
        resource: 'wood',
        amount: 300,
        sold: 300,
        unitPrice: 1173,
        gold: 351_900,
        gained_gold: 351.9,
        escorted: 1,
        heroId: 'hero-1',
      },
    });
    expect(arrival?.text).toBe(
      'No 8º dia da Primavera, a caravana de Pedra Alta chegou a Porto do Rio e vendeu 300 de madeira, por 351,9 de ouro. Edda, que a escoltava, está de volta.',
    );
    expect(there.state.stats).toMatchObject({
      caravansSent: 1,
      caravansArrived: 1,
      caravanGold: 351_900,
    });
    expect(there.state.stats.caravansAmbushed).toBeUndefined();
  });

  it('o preço é o fixado no envio: a viagem atravessa duas viradas de dia, o Mercado anda, e a caravana vende pelo que levou', () => {
    const start = caravanPost(5 * DAY + 10 * MINUTE, withHeroes());
    const fixed = caravanUnitPrice(start, 'wood');
    const { sent, arrived, events, arrivesAt } = trip(start, 300, 'hero-1');
    // Duas viradas no caminho: o preço do Mercado já é outro, e o dia da cotação também.
    expect(Math.floor(arrivesAt / DAY) - Math.floor(start.lastProcessedAt / DAY)).toBe(2);
    expect(arrived.market.quoteDay).toBe(sent.market.quoteDay + 8);
    expect(arrived.market.prices.wood).not.toBe(start.market.prices.wood);
    expect(caravanUnitPrice(arrived, 'wood')).not.toBe(fixed);
    const [arrival] = eventsOfType(events, 'caravanArrived');
    expect(arrival?.data).toMatchObject({ unitPrice: fixed, gold: 300 * fixed });
    // O ouro que entrou é exatamente carga × preço fixado, além do que o soldo levou.
    const without = advanceTo(
      accept(
        caravanPost(
          5 * DAY + 10 * MINUTE,
          withHeroes((draft) => {
            draft.settlement.resources.wood -= 300 * MILLI;
            const [edda] = draft.guild.heroes;
            if (edda !== undefined) {
              edda.status = 'idle';
            }
          }),
        ),
        command('setWorkers', { building: 'farm', count: 0 }),
      ).state,
      arrivesAt,
    ).state;
    expect(gold(arrived) - gold(without)).toBe(300 * fixed);
  });

  it('com escolta não há sorteio: o fluxo da caravana nunca nasce, e o herói volta pronto no instante da chegada', () => {
    const start = caravanPost(0, withHeroes());
    const { sent, arrived, events, arrivesAt } = trip(start, 300, 'hero-1');
    expect(caravanStreams(sent)).toEqual([]);
    expect(caravanStreams(arrived)).toEqual([]);
    expect(eventsOfType(events, 'caravanAmbushed')).toEqual([]);
    // Fora até a chegada, e de volta nela.
    const almost = advanceTo(sent, arrivesAt - 1).state;
    expect(almost.guild.heroes[0]?.status).toBe('escort');
    expect(arrived.guild.heroes[0]?.status).toBe('idle');
    // De volta, pode ir de novo na mesma hora.
    expect(apply(arrived, caravanOrder('stone', 10, 'hero-1')).ok).toBe(true);
    expect(currentShape(stored(arrived), '')).toBeNull();
  });

  it('a carga de uma unidade não tem o que perder: nem sem escolta ela sorteia', () => {
    for (let index = 0; index < 60; index += 1) {
      const { arrived, events } = trip(caravanPost(0, undefined, { seed: `uma-${index}` }), 1);
      expect(eventsOfType(events, 'caravanAmbushed')).toEqual([]);
      expect(arrived.stats.caravanGold).toBe(1173);
    }
  });
});

describe('a matriz QA-10: a mesma caravana com e sem escolta, com a Torre de Vigia nos níveis 0, 1 e 2', () => {
  const RUNS = 1000;
  /** Uma caravana de 300 de madeira por semente, em cada uma das seis células. */
  function measure(tower: number, escorted: boolean): { ambushed: Set<number>; draws: number } {
    const ambushed = new Set<number>();
    let draws = 0;
    for (let index = 0; index < RUNS; index += 1) {
      const start = caravanPost(0, withHeroes(), { seed: `qa-10-${index}`, tower });
      const fixed = caravanUnitPrice(start, 'wood');
      const { sent, arrived, events } = trip(start, 300, escorted ? 'hero-1' : null);
      const hits = eventsOfType(events, 'caravanAmbushed');
      const safe = eventsOfType(events, 'caravanArrived');
      expect(hits.length + safe.length).toBe(1);
      // O fluxo não existe antes da chegada e não sobra depois dela (R1).
      expect(caravanStreams(sent)).toEqual([]);
      expect(caravanStreams(arrived)).toEqual([]);
      expect(arrived.market.caravans).toEqual([]);
      // O herói solto na chegada, com escolta ou sem.
      expect(arrived.guild.heroes.map((hero) => hero.status)).toEqual(['idle', 'idle']);
      const [hit] = hits;
      if (hit === undefined) {
        // A carga inteira, pelo preço fixado no envio.
        expect(safe[0]?.data).toMatchObject({ sold: 300, gold: 300 * fixed, unitPrice: fixed });
      } else {
        ambushed.add(index);
        // Metade da carga se perde; a outra metade é vendida pelo preço fixado.
        expect(hit.data).toMatchObject({
          amount: 300,
          lost: 150,
          ambushed_wood: 150,
          sold: 150,
          unitPrice: fixed,
          gold: 150 * fixed,
          gained_gold: (150 * fixed) / MILLI,
          riskPercent: ambushPercent(tower),
          watchtowerLevel: tower,
        });
        expect(arrived.stats.caravansAmbushed).toBe(1);
      }
      if (index < 40) {
        // Sem escolta, um sorteio: o fluxo, se existisse ainda, estaria uma palavra adiante.
        draws += escorted ? 0 : 1;
        expect(currentShape(stored(arrived), '')).toBeNull();
      }
    }
    return { ambushed, draws };
  }

  it('com escolta nenhuma caravana é emboscada, em nenhum nível da Torre, em 1.000 sementes por célula', () => {
    for (const tower of [0, 1, 2]) {
      expect(measure(tower, true).ambushed.size, `Torre ${tower}`).toBe(0);
    }
  });

  it('sem escolta a frequência fica na faixa de 10%, 5% e 2%, em 1.000 sementes por nível da Torre', () => {
    const cells = [0, 1, 2].map((tower) => measure(tower, false).ambushed);
    const [open, watched, guarded] = cells;
    if (open === undefined || watched === undefined || guarded === undefined) {
      throw new Error('A matriz tem três níveis de Torre.');
    }
    // As faixas são as de três desvios-padrão de uma binomial de 1.000 tentativas.
    expect(open.size).toBeGreaterThanOrEqual(72);
    expect(open.size).toBeLessThanOrEqual(128);
    expect(watched.size).toBeGreaterThanOrEqual(30);
    expect(watched.size).toBeLessThanOrEqual(70);
    expect(guarded.size).toBeGreaterThanOrEqual(7);
    expect(guarded.size).toBeLessThanOrEqual(33);
    // Os números medidos, para o registro (docs/balance-v0.3.md, seção 12): mudar o gerador ou
    // o nome do fluxo muda estes três, e é mudança de regra.
    expect(cells.map((cell) => cell.size)).toEqual(QA10_MEASURED);
    // A Torre só tira risco: a caravana emboscada com a Torre mais alta também o seria com a
    // mais baixa (o sorteio é o mesmo; só a chance muda).
    for (const index of guarded) {
      expect(watched.has(index)).toBe(true);
    }
    for (const index of watched) {
      expect(open.has(index)).toBe(true);
    }
  });

  it('vale a Torre do instante da chegada: a que é erguida com a carga na estrada já baixa o risco', () => {
    // Uma semente em que a caravana é emboscada sem Torre e escapa com a Torre no nível 1.
    const seed = `qa-10-${TOWER_SAVES}`;
    const bare = trip(caravanPost(0, undefined, { seed, tower: 0 }));
    expect(eventsOfType(bare.events, 'caravanAmbushed')).toHaveLength(1);
    const watched = trip(caravanPost(0, undefined, { seed, tower: 1 }));
    expect(eventsOfType(watched.events, 'caravanAmbushed')).toEqual([]);
    // A mesma caravana, enviada sem Torre, com a obra da Torre pedida depois do envio.
    const sent = accept(caravanPost(0, undefined, { seed, tower: 0 }), caravanOrder('wood', 300));
    const building = accept(sent.state, command('startConstruction', { building: 'watchtower' }));
    const done = building.state.settlement.constructionQueues[0]?.finishesAtMs ?? 0;
    expect(done).toBeLessThan(TRIP);
    const arrived = advanceTo(building.state, TRIP);
    expect(arrived.state.settlement.buildings.watchtower).toBe(1);
    expect(eventsOfType(arrived.events, 'caravanAmbushed')).toEqual([]);
    expect(eventsOfType(arrived.events, 'caravanArrived')).toHaveLength(1);
  });
});

describe('uma caravana pode ser emboscada (GDD §16.2, critério 5): cenário com semente fixa', () => {
  it('sem escolta e com a Torre no nível 2, a caravana desta semente perde metade da carga e vende a outra', () => {
    const start = caravanPost(9 * DAY + 30 * MINUTE, undefined, { seed: AMBUSH_SEED, tower: 2 });
    const { arrived, events, arrivesAt } = trip(start, 251);
    const [hit] = eventsOfType(events, 'caravanAmbushed');
    expect(eventsOfType(events, 'caravanArrived')).toEqual([]);
    expect(hit).toMatchObject({
      type: 'caravanAmbushed',
      atMs: arrivesAt,
      data: {
        caravanId: 'caravan-1',
        resource: 'wood',
        amount: 251,
        lost: 125,
        ambushed_wood: 125,
        sold: 126,
        unitPrice: 1173,
        gold: 126 * 1173,
        gained_gold: 147.798,
        riskPercent: 2,
        watchtowerLevel: 2,
      },
    });
    expect(hit?.text).toBe(
      'No 12º dia da Primavera, a caravana de Pedra Alta caiu em uma emboscada a caminho de Porto do Rio: levaram 125 de madeira. O que restou, 126 de madeira, foi vendido por 147,798 de ouro.',
    );
    expect(arrived.stats).toMatchObject({
      caravansSent: 1,
      caravansArrived: 1,
      caravansAmbushed: 1,
      caravanGold: 126 * 1173,
    });
    expect(arrived.market.caravans).toEqual([]);
    expect(caravanStreams(arrived)).toEqual([]);
    // A mesma caravana, da mesma semente, com escolta chega inteira.
    const escorted = trip(
      caravanPost(9 * DAY + 30 * MINUTE, withHeroes(), { seed: AMBUSH_SEED, tower: 2 }),
      251,
      'hero-1',
    );
    expect(eventsOfType(escorted.events, 'caravanAmbushed')).toEqual([]);
    expect(eventsOfType(escorted.events, 'caravanArrived')[0]?.data).toMatchObject({
      sold: 251,
      gold: 251 * 1173,
    });
  });
});

describe('duas caravanas no mesmo instante, e o fluxo de cada uma (ADR 0017, decisão 9)', () => {
  const pair = (seed: string, firstEscorted: boolean) => {
    const start = caravanPost(0, withHeroes(), { seed, level: 4 });
    const first = accept(start, caravanOrder('wood', 300, firstEscorted ? 'hero-1' : null));
    const second = accept(first.state, caravanOrder('stone', 200));
    return advanceTo(second.state, TRIP);
  };
  const outcome = (events: GameEvent[], caravanId: string) =>
    events.find(
      (event) =>
        (event.type === 'caravanArrived' || event.type === 'caravanAmbushed') &&
        event.data.caravanId === caravanId,
    );

  it('chegam na ordem do identificador, cada uma com a sua linha, e as duas saem da lista', () => {
    const { state, events } = pair('duas-1', false);
    const arrivals = events.filter(
      (event) => event.type === 'caravanArrived' || event.type === 'caravanAmbushed',
    );
    expect(arrivals.map((event) => event.data.caravanId)).toEqual(['caravan-1', 'caravan-2']);
    expect(arrivals.every((event) => event.atMs === TRIP)).toBe(true);
    expect(state.market.caravans).toEqual([]);
    expect(caravanStreams(state)).toEqual([]);
    expect(state.stats.caravansArrived).toBe(2);
  });

  it('a ordem de chegada é a do identificador mesmo com a lista fora de ordem, e caravan-10 vem depois de caravan-9', () => {
    const start = caravanPost(0, undefined, { level: 4 });
    start.ids.caravan = 8;
    const sent = accept(accept(start, caravanOrder('wood', 10)).state, caravanOrder('stone', 10));
    expect(sent.state.market.caravans.map((entry) => entry.id)).toEqual([
      'caravan-9',
      'caravan-10',
    ]);
    const swapped = cloneState(sent.state);
    swapped.market.caravans.reverse();
    const { events } = advanceTo(swapped, TRIP);
    expect(
      events
        .filter((event) => event.type === 'caravanArrived' || event.type === 'caravanAmbushed')
        .map((event) => event.data.caravanId),
    ).toEqual(['caravan-9', 'caravan-10']);
  });

  it('uma não muda a sorte da outra: a segunda termina igual com a primeira sorteando, sem sortear, ou chegando antes', () => {
    let ambushed = 0;
    for (let index = 0; index < 300; index += 1) {
      const seed = `duas-${index}`;
      const both = pair(seed, false);
      const escorted = pair(seed, true);
      const second = outcome(both.events, 'caravan-2');
      expect(second?.type).toBeDefined();
      // A primeira com escolta não sorteia; a segunda termina do mesmo jeito.
      expect(outcome(escorted.events, 'caravan-2')?.type).toBe(second?.type);
      expect(outcome(escorted.events, 'caravan-2')?.data).toEqual(second?.data);
      ambushed += second?.type === 'caravanAmbushed' ? 1 : 0;
      if (index < 60) {
        // A primeira enviada uma hora antes: as duas chegam em instantes diferentes.
        const start = caravanPost(0, withHeroes(), { seed, level: 4 });
        const early = accept(start, caravanOrder('wood', 300)).state;
        const later = accept(advanceTo(early, HOUR).state, caravanOrder('stone', 200)).state;
        const apart = advanceTo(later, HOUR + TRIP);
        expect(outcome(apart.events, 'caravan-2')?.type).toBe(second?.type);
        expect(outcome(apart.events, 'caravan-1')?.type).toBe(
          outcome(both.events, 'caravan-1')?.type,
        );
      }
    }
    // O teste passou por caravanas emboscadas e por caravanas que chegaram.
    expect(ambushed).toBeGreaterThan(10);
    expect(ambushed).toBeLessThan(60);
  });

  it('o fluxo de uma caravana que chegou não reaparece: 60 dias depois, com outras caravanas, `rng` não tem nenhum (R1)', () => {
    let state = caravanPost(0, withHeroes(), { seed: 'r1', level: 4 });
    const seen: string[] = [];
    for (let round = 0; round < 30; round += 1) {
      state = accept(state, caravanOrder('wood', 20, round % 3 === 0 ? 'hero-1' : null)).state;
      state = accept(state, caravanOrder('stone', 20)).state;
      state.settlement.resources.wood = 2_000_000;
      state.settlement.resources.stone = 900_000;
      const result = advanceTo(state, state.lastProcessedAt + TRIP);
      state = cloneState(result.state);
      seen.push(...caravanStreams(state));
      expect(currentShape(stored(state), '')).toBeNull();
    }
    expect(seen).toEqual([]);
    expect(state.ids.caravan).toBe(60);
    expect(state.market.caravans).toEqual([]);
    expect(state.stats.caravansArrived).toBe(60);
    expect(caravanStreams(advanceTo(state, state.lastProcessedAt + 60 * DAY).state)).toEqual([]);
  });
});

describe('o herói em escolta (GDD §9.1: um herói faz uma coisa por vez)', () => {
  const escorting = () => {
    const hall = guildHall(0, withHeroes(), { level: 1 });
    hall.settlement.buildings.market = 2;
    return accept(hall, caravanOrder('wood', 100, 'hero-1')).state;
  };

  it('não parte em expedição, não é dispensado e não mexe no arsenal até a caravana chegar', () => {
    const state = escorting();
    expect(
      refuse(
        state,
        command('sendExpedition', { modelId: 'patrol', heroIds: ['hero-1'], posture: 'balanced' }),
      ),
    ).toEqual({
      code: 'HERO_UNAVAILABLE',
      message: 'Edda não pode partir agora: já escolta uma caravana.',
    });
    expect(refuse(state, command('dismissHero', { heroId: 'hero-1' }))).toEqual({
      code: 'HERO_BUSY',
      message: 'Edda está fora do feudo: a dispensa espera a volta.',
    });
    // Rolf, que ficou, parte normalmente.
    expect(
      apply(
        state,
        command('sendExpedition', { modelId: 'patrol', heroIds: ['hero-2'], posture: 'balanced' }),
      ).ok,
    ).toBe(true);
    const back = advanceTo(state, TRIP).state;
    expect(apply(back, command('dismissHero', { heroId: 'hero-1' })).ok).toBe(true);
  });

  it('recebe soldo na estrada: o ouro cai no mesmo ritmo com ela no feudo ou em escolta', () => {
    const home = guildHall(0, withHeroes(), { level: 1 });
    home.settlement.buildings.market = 2;
    home.settlement.resources.wood -= 100 * MILLI;
    const away = escorting();
    const until = TRIP - MINUTE;
    expect(gold(advanceTo(away, until).state)).toBe(gold(advanceTo(home, until).state));
    expect(view(away).guild.heroes[0]).toMatchObject({ atHome: false, canDepart: false });
    expect(view(away).guild.heroes[0]?.wagePerHour).toBe(view(home).guild.heroes[0]?.wagePerHour);
  });

  it('a ficha diz que ela escolta a caravana e quando volta, em tempo real', () => {
    const state = advanceTo(escorting(), HOUR).state;
    expect(view(state).guild.heroes[0]?.statusText).toBe('Escolta a caravana: volta em 3 h');
    const fast = accept(
      caravanPost(0, withHeroes(), { timeScale: 3 }),
      caravanOrder('wood', 100, 'hero-1'),
    ).state;
    expect(deriveViewState(fast, 0, { timeScale: 3 }).guild.heroes[0]?.statusText).toBe(
      'Escolta a caravana: volta em 1 h 20 min',
    );
    expect(view(state).guild.heroes[1]?.statusText).toBe('No feudo');
  });

  /** O cofre vazio e ninguém na Mina: o atraso abre na hora. */
  const broke = (atMs: number, edit: (draft: GameState) => void, level = 4) => {
    const start = caravanPost(atMs, edit, { level });
    start.settlement.resources.gold = 0;
    return accept(start, command('setWorkers', { building: 'goldMine', count: 0 })).state;
  };

  it('no soldo em atraso é herói fora: deve, não parte na estrada, e é cobrado no instante em que volta (revisão da Fase E, R2)', () => {
    // Rolf, no feudo, parte no prazo, na virada. Edda, na estrada, não parte enquanto está
    // fora; quando volta com o prazo vencido, parte ali mesmo, depois de entregar a carga.
    const { leaveAfterRealMs, leaveEveryRealMs } = balance.heroes.arrears;
    let state = broke(0, withHeroes());
    state = accept(state, caravanOrder('stone', 1, 'hero-1')).state;
    // A tela diz o que espera quem está fora.
    expect(view(state).guild.wage.arrears?.text).toContain(
      'Quem está fora do feudo não parte na estrada: se o prazo já tiver vencido, parte no instante em que voltar.',
    );
    expect(view(broke(0, withHeroes())).guild.wage.arrears?.text).not.toContain('na estrada');
    const events: GameEvent[] = [];
    const deadline = leaveAfterRealMs + 2 * leaveEveryRealMs + DAY;
    while (state.lastProcessedAt < deadline && state.guild.heroes.length > 0) {
      const next = advanceTo(state, state.lastProcessedAt + TRIP);
      events.push(...next.events);
      state = next.state;
      const edda = state.guild.heroes.find((hero) => hero.id === 'hero-1');
      if (edda !== undefined && edda.status === 'idle') {
        state = accept(state, caravanOrder('stone', 1, 'hero-1')).state;
      }
    }
    const left = eventsOfType(events, 'heroLeft');
    expect(left.map((event) => event.data.heroId)).toEqual(['hero-2', 'hero-1']);
    // Rolf parte em uma virada de dia; Edda, no instante de uma chegada, logo depois da linha
    // da caravana que escoltava.
    expect((left[0]?.atMs ?? 1) % DAY).toBe(0);
    const eddaLeft = left[1] as GameEvent;
    const sameInstant = events.filter((event) => event.atMs === eddaLeft.atMs);
    const kinds = sameInstant.map((event) => event.type as string);
    expect(kinds).toContain('caravanArrived');
    expect(kinds.indexOf('heroLeft')).toBeGreaterThan(kinds.indexOf('caravanArrived'));
    expect(eddaLeft.atMs % TRIP).toBe(0);
    // Ela nunca partiu de dentro da estrada: até a chegada que a cobrou, esteve a serviço.
    expect(state.guild.heroes).toEqual([]);
    expect(state.market.caravans).toEqual([]);
    expect(currentShape(stored(state), '')).toBeNull();
  });

  it('a manobra da escolta perpétua já não blinda o herói: 120 dias de jogo reenviando 1 de madeira a cada chegada, fora de toda virada (R2)', () => {
    // Antes da correção: 60 chegadas e nenhum `heroLeft`. O herói devido só era cobrado em uma
    // virada de dia em casa, e ele nunca estava em casa em uma virada.
    let state = broke(
      30 * MINUTE,
      (draft) => void addHero(draft, { name: 'Rolf', classId: 'archer' }),
      2,
    );
    const events: GameEvent[] = [];
    let sent = 0;
    const end = state.lastProcessedAt + 120 * DAY;
    while (state.lastProcessedAt < end) {
      const rolf = state.guild.heroes[0];
      if (rolf !== undefined && rolf.status === 'idle') {
        state = accept(state, caravanOrder('wood', 1, 'hero-1')).state;
        sent += 1;
      }
      const next = advanceTo(state, Math.min(end, state.lastProcessedAt + TRIP));
      events.push(...next.events);
      state = next.state;
    }
    // Nenhuma chegada cai em uma virada de dia.
    const arrivals = eventsOfType(events, 'caravanArrived');
    expect(arrivals.every((event) => event.atMs % DAY !== 0)).toBe(true);
    // O Descontente é marcado na virada, com ele fora; a partida, na volta em que o prazo vence.
    const sour = eventsOfType(events, 'heroDiscontent');
    expect(sour).toHaveLength(1);
    expect((sour[0]?.atMs ?? 1) % DAY).toBe(0);
    const left = eventsOfType(events, 'heroLeft');
    expect(left).toHaveLength(1);
    // Cada 1 de madeira paga 35 minutos de soldo: o atraso vivido chega às 24 h reais (ritmo 1)
    // na sétima chegada, 28 h de jogo depois do primeiro envio.
    expect(left[0]?.atMs).toBe(30 * MINUTE + 7 * TRIP);
    expect(arrivals).toHaveLength(7);
    expect(sent).toBe(7);
    expect(arrivals.at(-1)?.atMs).toBe(left[0]?.atMs);
    expect(state.guild.heroes).toEqual([]);
    expect(state.guild.wageArrears).toBeNull();
    // Cortar o avanço em volta da chegada que cobra dá o mesmo estado e os mesmos eventos.
    const before = advanceTo(
      accept(
        broke(30 * MINUTE, (draft) => void addHero(draft, { name: 'Rolf', classId: 'archer' }), 2),
        caravanOrder('wood', 1, 'hero-1'),
      ).state,
      30 * MINUTE + TRIP - 1,
    );
    const whole = advanceTo(before.state, 30 * MINUTE + TRIP + HOUR);
    const split = advanceTo(
      advanceTo(before.state, 30 * MINUTE + TRIP).state,
      30 * MINUTE + TRIP + HOUR,
    );
    expect(split.state).toEqual(whole.state);
  });

  it('a volta não cobra duas vezes: de duas escoltas que voltam com meia hora de diferença, o prazo que deve um herói leva um só', () => {
    const { leaveAfterRealMs } = balance.heroes.arrears;
    // Edda e Rolf saem com meia hora de diferença, e as duas chegadas caem depois das 24 h.
    let state = broke(leaveAfterRealMs - TRIP + 10 * MINUTE, withHeroes());
    // O atraso está aberto há 24 h reais menos a viagem, mais dez minutos.
    state.guild.wageArrears = { sinceMs: 0, carriedMs: 0, departed: 0 };
    for (const hero of state.guild.heroes) {
      hero.joinedAtMs = 0;
    }
    state = accept(state, caravanOrder('stone', 1, 'hero-1')).state;
    state = advanceTo(state, state.lastProcessedAt + 30 * MINUTE).state;
    state = accept(state, caravanOrder('stone', 1, 'hero-2')).state;
    const first = leaveAfterRealMs + 10 * MINUTE;
    const later = advanceTo(state, first + 30 * MINUTE);
    const left = eventsOfType(later.events, 'heroLeft');
    // Na primeira chegada o prazo deve um herói, e é Edda quem volta: parte. Meia hora depois
    // o prazo ainda deve um só, já cobrado: Rolf volta e fica.
    expect(left.map((event) => [event.data.heroId, event.atMs])).toEqual([['hero-1', first]]);
    expect(later.state.guild.heroes.map((hero) => [hero.id, hero.status])).toEqual([
      ['hero-2', 'idle'],
    ]);
    // A virada seguinte não cobra de novo o que a volta já cobrou.
    const turn = advanceTo(later.state, Math.ceil((first + 30 * MINUTE) / DAY) * DAY);
    expect(eventsOfType(turn.events, 'heroLeft')).toEqual([]);
  });
});

describe('as caravanas na visão (V3E-T2.4)', () => {
  it('a oferta existe sempre: sem o Mercado no nível 2 diz por que não, e não oferece recurso nem escolta', () => {
    for (const level of [0, 1]) {
      const { caravans, caravanOffer } = view(caravanPost(0, withHeroes(), { level })).market;
      expect(caravans).toEqual([]);
      expect(caravanOffer).toMatchObject({
        available: false,
        destination: 'Porto do Rio',
        maxUnits: 300,
        slots: 0,
        slotsInUse: 0,
        resources: [],
        eligibleEscortIds: [],
      });
      expect(caravanOffer.blockedReason).toContain('As caravanas pedem o Mercado no nível 2');
    }
  });

  it('diz o preço que cada recurso fixaria hoje, de onde ele vem, o prazo real e o máximo que dá para mandar', () => {
    const state = caravanPost(
      0,
      withHeroes((draft) => {
        draft.settlement.resources.stone = 120_900;
      }),
    );
    const { caravanOffer } = view(state).market;
    expect(caravanOffer).toMatchObject({
      available: true,
      blockedReason: null,
      maxUnits: 300,
      priceRatioText: 'O preço de venda do dia × 1,15, fixado no envio.',
      tripSeconds: 4 * 3600,
      lossText:
        'A emboscada leva 50% da carga, arredondada para baixo; o resto é vendido pelo preço fixado.',
      slots: 1,
      slotsInUse: 0,
      eligibleEscortIds: ['hero-1', 'hero-2'],
    });
    expect(caravanOffer.resources).toEqual([
      {
        resource: 'food',
        label: 'Comida',
        unitPrice: 977,
        unitPriceText: '0,977',
        breakdown: '0,977 = 0,85 (venda de hoje) × 1,15.',
        maxSendable: 300,
      },
      {
        resource: 'wood',
        label: 'Madeira',
        unitPrice: 1173,
        unitPriceText: '1,173',
        breakdown: '1,173 = 1,02 (venda de hoje) × 1,15.',
        maxSendable: 300,
      },
      {
        resource: 'stone',
        label: 'Pedra',
        unitPrice: 1955,
        unitPriceText: '1,955',
        breakdown: '1,955 = 1,70 (venda de hoje) × 1,15.',
        maxSendable: 120,
      },
    ]);
    // O preço e o máximo da visão são exatamente o que a ordem cumpre.
    for (const row of caravanOffer.resources) {
      expect(maxSendable(state, row.resource)).toBe(row.maxSendable);
      const sent = accept(state, caravanOrder(row.resource, row.maxSendable)).state;
      expect(sent.market.caravans[0]?.unitPrice).toBe(row.unitPrice);
      if (row.maxSendable < 300) {
        expect(apply(state, caravanOrder(row.resource, row.maxSendable + 1)).ok).toBe(false);
      }
    }
    // No ritmo Rápido a viagem dura um terço do tempo real.
    expect(
      deriveViewState(caravanPost(0, undefined, { timeScale: 3 }), 0, { timeScale: 3 }).market
        .caravanOffer.tripSeconds,
    ).toBe((4 * 3600) / 3);
  });

  it('explica o risco termo a termo, com a Torre de agora: 10% sem ela, −5 por nível, nunca menos de 2%', () => {
    const offer = (tower: number) => view(caravanPost(0, undefined, { tower })).market.caravanOffer;
    expect(offer(0)).toMatchObject({
      riskPercent: 10,
      riskText:
        '10% de chance de emboscada sem escolta; com escolta, nenhuma. Conta a Torre de Vigia que o feudo tiver na chegada.',
      riskBreakdown: '10% na estrada, cada nível da Torre de Vigia tira 5; com escolta, nenhum.',
    });
    expect(offer(1)).toMatchObject({
      riskPercent: 5,
      riskBreakdown: '10% na estrada, −5 pela Torre de Vigia Nv1; com escolta, nenhum.',
    });
    expect(offer(2)).toMatchObject({
      riskPercent: 2,
      riskBreakdown:
        '10% na estrada, −10 pela Torre de Vigia Nv2, nunca menos de 2%; com escolta, nenhum.',
    });
    expect(offer(2).riskText).toContain('2% de chance');
  });

  it('com a estrada cheia a oferta diz por quê, e o máximo de cada recurso é zero', () => {
    const state = accept(caravanPost(0, withHeroes()), caravanOrder('wood', 100, 'hero-1')).state;
    const { caravanOffer } = view(state).market;
    expect(caravanOffer).toMatchObject({ available: false, slots: 1, slotsInUse: 1 });
    expect(caravanOffer.blockedReason).toBe(
      'O Mercado Nv2 mantém 1 caravana na estrada por vez: espere a chegada, ou amplie o Mercado (no nível 4, 2 caravanas).',
    );
    expect(caravanOffer.resources.map((row) => row.maxSendable)).toEqual([0, 0, 0]);
    // Quem já escolta não é oferecido de novo.
    expect(caravanOffer.eligibleEscortIds).toEqual(['hero-2']);
  });

  it('mostra cada caravana na estrada: a carga, o preço fixado, a chegada em tempo real e a escolta', () => {
    const start = caravanPost(0, withHeroes(), { level: 4 });
    const first = accept(start, caravanOrder('wood', 300, 'hero-1')).state;
    const second = accept(advanceTo(first, HOUR).state, caravanOrder('stone', 45)).state;
    expect(view(second).market.caravans).toEqual([
      {
        id: 'caravan-1',
        resource: 'wood',
        amount: 300,
        cargoText: '300 de madeira',
        unitPrice: 1173,
        unitPriceText: '1,173',
        goldText: '351,9',
        destination: 'Porto do Rio',
        arrivesInSeconds: 3 * 3600,
        escortName: 'Edda',
        text: 'A caminho de Porto do Rio com 300 de madeira, a 1,173 de ouro a unidade. Escolta: Edda.',
      },
      {
        id: 'caravan-2',
        resource: 'stone',
        amount: 45,
        cargoText: '45 de pedra',
        unitPrice: 1955,
        unitPriceText: '1,955',
        goldText: '87,975',
        destination: 'Porto do Rio',
        arrivesInSeconds: 4 * 3600,
        escortName: null,
        text: 'A caminho de Porto do Rio com 45 de pedra, a 1,955 de ouro a unidade. Sem escolta.',
      },
    ]);
  });

  it('a lista de obras diz o que o Mercado ganha com as caravanas em cada nível', () => {
    const texts = [1, 2, 4].map((level) => view(caravanPost(0, undefined, { level })).market.text);
    expect(texts[0]).toBe(
      'Mercado Nv1: negocia até 200 de cada recurso por dia de jogo, entre compras e vendas.',
    );
    expect(texts[1]).toBe(
      'Mercado Nv2: negocia até 400 de cada recurso por dia de jogo, entre compras e vendas, e mantém 1 caravana na estrada para Porto do Rio.',
    );
    expect(texts[2]).toContain('mantém 2 caravanas na estrada para Porto do Rio');
    expect(caravanTexts.destination).toBe('Porto do Rio');
  });

  it('não muda o estado, não sorteia e não dá identificador, com caravanas na estrada; `nextEventAt` também não', () => {
    const start = caravanPost(0, withHeroes(), { level: 4 });
    const state = accept(
      accept(start, caravanOrder('wood', 300, 'hero-1')).state,
      caravanOrder('stone', 100),
    ).state;
    for (const at of [state, advanceTo(state, TRIP - 1).state]) {
      const frozen = JSON.stringify(at);
      view(at);
      deriveViewState(at, at.lastProcessedAt, { timeScale: 3 });
      nextEventAt(at);
      expect(JSON.stringify(at)).toBe(frozen);
      expect(caravanStreams(at)).toEqual([]);
    }
  });

  it('a previsão da moral não resolve a caravana que chega antes da virada: a visão não sorteia a emboscada', () => {
    // A caravana chega 10 minutos antes da próxima virada de dia.
    const start = caravanPost(2 * DAY - 10 * MINUTE - TRIP + 2 * DAY);
    const sent = accept(start, caravanOrder('wood', 300)).state;
    const close = advanceTo(sent, start.lastProcessedAt + TRIP - 5 * MINUTE).state;
    const frozen = JSON.stringify(close);
    const seen = view(close);
    expect(JSON.stringify(close)).toBe(frozen);
    expect(seen.market.caravans).toHaveLength(1);
    expect(JSON.stringify(seen)).not.toContain('caravanAmbushed');
  });
});

describe('a névoa das caravanas (roadmap §0.7, "Visão e privacidade")', () => {
  it('a caravana que vai ser emboscada e a que não vai dão a mesma visão e os mesmos eventos até a chegada', () => {
    // A mesma semente e o mesmo feudo; só o número da caravana muda (o contador de identidades
    // de um dos feudos já tinha andado), e com ele o fluxo em que a emboscada será sorteada.
    const world = (issued: number) => {
      const start = caravanPost(3 * DAY + 20 * MINUTE, undefined, { seed: FOG_SEED });
      start.ids.caravan = issued;
      return start;
    };
    const [lucky, doomed] = FOG_ISSUED.map((issued) => {
      const start = world(issued);
      const id = `caravan-${issued + 1}`;
      const sent = accept(start, caravanOrder('wood', 300));
      const road = advanceTo(sent.state, start.lastProcessedAt + TRIP - 1);
      const end = advanceTo(road.state, start.lastProcessedAt + TRIP);
      // O que o jogador vê e lê, com o identificador trocado por um nome só.
      const anonymous = (value: unknown) => JSON.stringify(value).replaceAll(id, 'caravan-X');
      return {
        id,
        seenAtStart: anonymous(view(sent.state)),
        seenOnRoad: anonymous(view(road.state)),
        told: anonymous([...sent.events, ...road.events]),
        // Do estado, tudo menos os contadores de identidade (que nunca saem do servidor).
        kept: anonymous({ ...road.state, ids: null }),
        ending: end.events
          .filter((event) => event.type.startsWith('caravan'))
          .map((event) => event.type),
      };
    });
    if (lucky === undefined || doomed === undefined) {
      throw new Error('O cenário tem dois feudos.');
    }
    // Os finais são diferentes…
    expect(lucky.ending).toEqual(['caravanArrived']);
    expect(doomed.ending).toEqual(['caravanAmbushed']);
    // …e até um milissegundo antes da chegada nada distingue um feudo do outro: nem a visão,
    // nem a Crônica, nem o estado guardado.
    expect(doomed.seenAtStart).toBe(lucky.seenAtStart);
    expect(doomed.seenOnRoad).toBe(lucky.seenOnRoad);
    expect(doomed.told).toBe(lucky.told);
    expect(doomed.kept).toBe(lucky.kept);
  });

  it('o gerador, os contadores e a palavra emboscada-como-fato nunca saem na visão de uma caravana na estrada', () => {
    const state = accept(caravanPost(), caravanOrder('wood', 300)).state;
    const text = JSON.stringify(view(state));
    expect(text).not.toContain('"rng"');
    expect(text).not.toContain('"ids"');
    expect(text).not.toContain('arrivesAtMs');
    for (const key of Object.keys(view(state).market.caravans[0] ?? {})) {
      expect(key).not.toMatch(/ambush|outcome|lost|roll/i);
    }
  });
});

describe('o que as caravanas não mudam no Mercado', () => {
  it('a venda no balcão continua com o volume inteiro do dia depois de uma caravana', () => {
    const start = caravanPost();
    const sent = accept(start, caravanOrder('wood', 300)).state;
    // Mercado Nv2: 400 por dia e por recurso, e a caravana não gastou nada disso.
    expect(view(sent).market.prices.find((row) => row.resource === 'wood')).toMatchObject({
      tradedToday: 0,
      remainingToday: 400,
    });
    expect(apply(sent, tradeOrder(sent, 'wood', 'sell', 400)).ok).toBe(true);
  });
});
