import { balance } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { dailyVolume, gameDay, priceBounds, quote, seasonalFactor } from './market';
import { currentShape } from './migrations';
import { cloneState, createInitialState } from './state';
import { storageCapacity } from './storage';
import { command, DAY, HOUR, marketStall, tradeOrder, YEAR } from './test-helpers';
import { nextEventAt } from './timeline';
import type {
  Command,
  DifficultyId,
  GameEvent,
  GameState,
  MarketResourceId,
  TradeDirectionId,
} from './types';
import { deriveViewState } from './view';

const { market: rules } = balance;
const RESOURCES = rules.resources;
const DAY_REAL = 24 * HOUR;

const resource = fc.constantFrom<MarketResourceId>(...RESOURCES);
const direction = fc.constantFrom<TradeDirectionId>('buy', 'sell');
const deal = fc.record({ resource, direction, amount: fc.integer({ min: 1, max: 260 }) });

/**
 * Um feudo de verdade (objetivos, Conselho, lobos, moral, fome e a carta da estrangeira no
 * caminho, com os sorteios deles), com o Salão no nível 3 e a obra do Mercado pedida em um
 * instante qualquer: a inauguração, os passeios do preço, as negociações e as melhorias do
 * Mercado caem em instantes que nenhum teste escolheu.
 */
const scenario = fc.record({
  seed: fc.constantFrom('pedra-alta', 'vau-do-corvo', 'mercado-7'),
  timeScale: fc.constantFrom(3, 1, 0.5),
  difficulty: fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
  workers: fc.tuple(fc.nat(3), fc.nat(2), fc.nat(1), fc.nat(3)),
  // Em milésimos, para o resto do acumulador nascer "quebrado".
  gold: fc.integer({ min: 150_000, max: 900_000 }),
  wood: fc.integer({ min: 200_000, max: 500_000 }),
  food: fc.integer({ min: 50_000, max: 500_000 }),
  warmUpMs: fc.nat(2 * DAY_REAL),
  // Em tempo real: no ritmo 3 são até 12 dias de jogo por ms sorteado.
  firstRealMs: fc.integer({ min: 1, max: 3 * DAY_REAL }),
  secondRealMs: fc.integer({ min: 1, max: 3 * DAY_REAL }),
  deals: fc.array(deal, { minLength: 0, maxLength: 6 }),
  upgrade: fc.boolean(),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

function order(state: GameState, cmd: Command): GameState {
  const result = applyCommand(state, cmd, state.lastProcessedAt);
  return result.ok ? result.state : state;
}

function prepare(plan: Scenario): GameState {
  const fresh = createInitialState(plan.seed, {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: plan.difficulty,
    timeScale: plan.timeScale,
  });
  const warm = cloneState(advanceTo(fresh, Math.round(plan.warmUpMs * plan.timeScale)).state);
  // O Salão no nível 3 e o material da obra, postos direto: o caminho até eles não é o que
  // este teste prova. A fila fica livre para o Mercado.
  warm.settlement.buildings.townHall = Math.max(3, warm.settlement.buildings.townHall);
  warm.settlement.constructionQueues = warm.settlement.constructionQueues.map(() => null);
  warm.settlement.planned = [];
  Object.assign(warm.settlement.resources, {
    food: plan.food,
    wood: plan.wood,
    stone: 400_000,
    gold: plan.gold,
  });
  let state: GameState = warm;
  const [farm, lumberMill, quarry, goldMine] = plan.workers;
  for (const cmd of [
    command('setWorkers', { building: 'farm', count: farm }),
    command('setWorkers', { building: 'lumberMill', count: lumberMill }),
    command('setWorkers', { building: 'quarry', count: quarry }),
    command('setWorkers', { building: 'goldMine', count: goldMine }),
    command('startConstruction', { building: 'market' }),
  ]) {
    state = order(state, cmd);
  }
  return state;
}

/** O que vale em todo estado em repouso, com Mercado ou sem. */
function expectMarketInvariants(state: GameState): void {
  const { market, settlement } = state;
  // O estado inteiro continua na forma da versão: é o que o servidor confere ao gravar.
  expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();
  for (const id of RESOURCES) {
    const { floor, ceiling } = priceBounds(id);
    expect(market.prices[id]).toBeGreaterThanOrEqual(floor);
    expect(market.prices[id]).toBeLessThanOrEqual(ceiling);
    // O volume do dia nunca é passado, nem por um nível que acabou de ficar pronto.
    expect(market.tradedToday[id]).toBeLessThanOrEqual(Math.max(dailyVolume(state), 0));
    expect(market.tradedToday[id]).toBeGreaterThanOrEqual(0);
  }
  if (settlement.buildings.market === 0) {
    expect(market.quoteDay).toBe(0);
    expect(state.rng.market).toBeUndefined();
  } else if (market.quoteDay !== 0) {
    // Depois do primeiro passeio, a cotação é sempre a do dia de hoje.
    expect(market.quoteDay).toBe(gameDay(state.lastProcessedAt));
  }
  expect(settlement.resources.gold).toBeGreaterThanOrEqual(0);
  for (const id of RESOURCES) {
    expect(settlement.resources[id]).toBeGreaterThanOrEqual(0);
  }
  expect(nextEventAt(state)).toBeGreaterThan(state.lastProcessedAt);
}

/** As negociações que o plano manda fazer agora, as que o Mercado aceitar, e a melhoria dele. */
function marketOrders(state: GameState, plan: Scenario): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const orders: Command[] = plan.deals.map((entry) =>
    command('trade', { ...entry, quoteDay: state.market.quoteDay }),
  );
  if (plan.upgrade) {
    orders.push(command('startConstruction', { building: 'market' }));
  }
  for (const cmd of orders) {
    const before = current;
    const result = applyCommand(current, cmd, current.lastProcessedAt);
    if (result.ok) {
      // Uma ordem não sorteia e não dá identificador a ninguém.
      expect(result.state.rng).toStrictEqual(before.rng);
      expect(result.state.ids).toStrictEqual(before.ids);
      current = result.state;
      events.push(...result.events);
      expectMarketInvariants(current);
    }
  }
  return { state: current, events };
}

describe('divisão de intervalo com o Mercado no caminho: o passeio do preço e as negociações', () => {
  it('advanceTo(t3) é idêntico a advanceTo(t2) seguido de advanceTo(t3): estado, eventos, gerador e contadores, nos três ritmos', () => {
    let founded = 0;
    let walks = 0;
    let trades = 0;
    let upgraded = 0;
    const paces = new Set<number>();
    fc.assert(
      fc.property(scenario, (plan) => {
        const start = prepare(plan);
        const t1 = start.lastProcessedAt + Math.round(plan.firstRealMs * plan.timeScale);
        // As negociações em um instante qualquer, depois de a obra (quase sempre) acabar.
        const first = advanceTo(start, t1);
        const ordered = marketOrders(first.state, plan);
        const frozen = JSON.stringify(ordered.state);
        const t3 = t1 + Math.round(plan.secondRealMs * plan.timeScale);
        const t2 = t1 + Math.floor((t3 - t1) / 3);

        const direct = advanceTo(ordered.state, t3);
        const half = advanceTo(ordered.state, t2);
        const split = advanceTo(half.state, t3);

        expect(split.state).toStrictEqual(direct.state);
        expect(split.state.rng).toStrictEqual(direct.state.rng);
        expect(split.state.ids).toStrictEqual(direct.state.ids);
        expect([...half.events, ...split.events]).toStrictEqual(direct.events);
        expect(JSON.stringify(ordered.state)).toBe(frozen);
        expectMarketInvariants(half.state);
        expectMarketInvariants(direct.state);

        // Quem só avança chega, com um corte um milissegundo antes, ao mesmo estado.
        expect(advanceTo(advanceTo(start, t1 - 1).state, t1).state).toStrictEqual(first.state);

        const all = [...first.events, ...ordered.events, ...direct.events];
        const opened = all.filter(
          (event) => event.type === 'buildingFounded' && event.data.building === 'market',
        );
        founded += opened.length;
        trades += all.filter((event) => event.type === 'marketTraded').length;
        upgraded += all.filter(
          (event) => event.type === 'constructionFinished' && event.data.building === 'market',
        ).length;
        // Um passeio por virada de dia com o Mercado de pé, e nenhum antes: o dia da cotação
        // conta as viradas desde a obra.
        const openedAt = opened[0]?.atMs;
        if (openedAt !== undefined) {
          const turns = Math.floor(t3 / DAY) - Math.ceil(openedAt / DAY) + 1;
          expect(direct.state.market.quoteDay).toBe(turns > 0 ? gameDay(t3) : 0);
          walks += Math.max(0, turns);
          paces.add(plan.timeScale);
        }
      }),
      { numRuns: 150 },
    );
    // A propriedade passou mesmo pelo que diz provar.
    expect(founded).toBeGreaterThan(100);
    expect(walks).toBeGreaterThan(500);
    expect(trades).toBeGreaterThan(60);
    expect(upgraded).toBeGreaterThan(3);
    expect([...paces].sort()).toEqual([0.5, 1, 3]);
  });

  it('vale em dez pedaços, com o estado passando pelo banco e com negociações em cada corte', () => {
    let trades = 0;
    fc.assert(
      fc.property(
        scenario,
        fc.array(fc.integer({ min: 1, max: DAY_REAL }), { minLength: 9, maxLength: 9 }),
        (plan, cuts) => {
          let state = prepare(plan);
          for (const cut of cuts) {
            // Sem ordem nenhuma, o trecho inteiro de uma vez dá o mesmo que em dois pedaços.
            const target = state.lastProcessedAt + Math.round(cut * plan.timeScale);
            const middle = state.lastProcessedAt + Math.floor((target - state.lastProcessedAt) / 2);
            const direct = advanceTo(state, target);
            const half = advanceTo(state, middle);
            const split = advanceTo(JSON.parse(JSON.stringify(half.state)) as GameState, target);
            expect(split.state).toStrictEqual(direct.state);
            expect([...half.events, ...split.events]).toStrictEqual(direct.events);
            expectMarketInvariants(direct.state);
            // No corte, o senhor passa pelo Mercado.
            const visit = marketOrders(direct.state, plan);
            trades += visit.events.filter((event) => event.type === 'marketTraded').length;
            state = JSON.parse(JSON.stringify(visit.state)) as GameState;
          }
        },
      ),
      { numRuns: 50 },
    );
    expect(trades).toBeGreaterThan(100);
  });

  it('no instante exato de cada virada a cotação já é a nova: a ordem com a de ontem é recusada, e a mesma ordem com a de hoje não é recusada por isso', () => {
    let checked = 0;
    fc.assert(
      fc.property(scenario, deal, (plan, wanted) => {
        const start = prepare(plan);
        let state = advanceTo(
          start,
          start.lastProcessedAt + Math.round(plan.firstRealMs * plan.timeScale),
        ).state;
        for (let turn = 0; turn < 3; turn += 1) {
          if (state.settlement.buildings.market === 0) {
            return;
          }
          const yesterday = state.market.quoteDay;
          const at = (Math.floor(state.lastProcessedAt / DAY) + 1) * DAY;
          state = advanceTo(state, at).state;
          expect(state.market.quoteDay).toBe(gameDay(at));
          const stale = applyCommand(
            state,
            command('trade', { ...wanted, quoteDay: yesterday }),
            at,
          );
          expect(stale.ok).toBe(false);
          expect(!stale.ok && stale.code).toBe('PRICE_CHANGED');
          const fresh = applyCommand(
            state,
            command('trade', { ...wanted, quoteDay: state.market.quoteDay }),
            at,
          );
          expect(fresh.ok || fresh.code !== 'PRICE_CHANGED').toBe(true);
          checked += 1;
        }
      }),
      { numRuns: 60 },
    );
    expect(checked).toBeGreaterThan(60);
  });

  it('a visão de qualquer desses feudos não muda o estado, e o que ela diz que cabe é exatamente o que a ordem aceita', () => {
    let rows = 0;
    fc.assert(
      fc.property(scenario, (plan) => {
        const start = prepare(plan);
        const state = marketOrders(
          advanceTo(start, start.lastProcessedAt + Math.round(plan.firstRealMs * plan.timeScale))
            .state,
          plan,
        ).state;
        const frozen = JSON.stringify(state);
        const view = deriveViewState(state, state.lastProcessedAt);
        nextEventAt(state);
        expect(JSON.stringify(state)).toBe(frozen);
        expect(view.market.level).toBe(state.settlement.buildings.market);
        expect(view.market.quoteDay).toBe(state.market.quoteDay);
        expect(view.market.prices).toHaveLength(view.market.level === 0 ? 0 : RESOURCES.length);
        for (const row of view.market.prices) {
          rows += 1;
          expect(row.remainingToday + row.tradedToday).toBe(view.market.dailyVolume);
          for (const [side, max, reason] of [
            ['buy', row.maxBuyable, row.buyBlockedReason],
            ['sell', row.maxSellable, row.sellBlockedReason],
          ] as const) {
            const attempt = (amount: number) =>
              applyCommand(
                state,
                tradeOrder(state, row.resource, side, amount),
                state.lastProcessedAt,
              );
            expect(max).toBeGreaterThanOrEqual(0);
            expect(attempt(max + 1).ok).toBe(false);
            if (max > 0) {
              const done = attempt(max);
              expect(done.ok).toBe(true);
              expect(reason).toBeNull();
              // O ouro da ordem é a quantidade vezes o preço da visão, sem outra conta.
              if (done.ok) {
                const delta =
                  done.state.settlement.resources.gold - state.settlement.resources.gold;
                expect(delta).toBe(side === 'buy' ? -max * row.buy : max * row.sell);
              }
            } else {
              const refused = attempt(1);
              expect(!refused.ok && refused.message).toBe(reason);
            }
          }
        }
      }),
      { numRuns: 80 },
    );
    expect(rows).toBeGreaterThan(80);
  });
});

/**
 * O valor do feudo em um dia do Mercado, em milésimos de milésimo de ouro: o ouro mais cada
 * estoque negociável pelo preço `side` daquele dia. Tudo inteiro: o ouro em milésimos vezes mil,
 * e o estoque (milésimos de unidade) vezes o preço (milésimos de ouro por unidade).
 */
function worth(state: GameState, prices: Record<MarketResourceId, number>): number {
  const { resources } = state.settlement;
  return RESOURCES.reduce((sum, id) => sum + resources[id] * prices[id], resources.gold * 1000);
}

const day = fc.record({
  // Um instante qualquer de dois anos: todas as estações, com e sem o fator da comida.
  atMs: fc.integer({ min: 0, max: 2 * YEAR - 1 }),
  level: fc.integer({ min: 1, max: 5 }),
  difficulty: fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
  // O preço de cada recurso em qualquer ponto entre o piso e o teto, como fração da faixa.
  prices: fc.tuple(fc.nat(1000), fc.nat(1000), fc.nat(1000)),
  // Estoques e ouro em milésimos, "quebrados".
  gold: fc.integer({ min: 0, max: 3_000_000 }),
  stocks: fc.tuple(fc.nat(1_600_000), fc.nat(2_800_000), fc.nat(2_800_000)),
  deals: fc.array(fc.record({ resource, direction, amount: fc.integer({ min: 1, max: 40 }) }), {
    minLength: 1,
    maxLength: 60,
  }),
});

function marketDay(plan: typeof day extends fc.Arbitrary<infer T> ? T : never): GameState {
  return marketStall(
    plan.atMs,
    (draft) => {
      RESOURCES.forEach((id, index) => {
        const { floor, ceiling } = priceBounds(id);
        const price = floor + Math.floor(((ceiling - floor) * (plan.prices[index] ?? 0)) / 1000);
        draft.market.prices[id] = price;
        draft.market.previousPrices[id] = price;
        draft.settlement.resources[id] = Math.min(
          plan.stocks[index] ?? 0,
          storageCapacity(draft, id) ?? 0,
        );
      });
      draft.settlement.resources.gold = plan.gold;
    },
    { level: plan.level, difficulty: plan.difficulty },
  );
}

describe('nenhuma sequência de compra e venda no mesmo dia dá lucro (critério 4; QA-09)', () => {
  it('cada ordem aceita mantém ou diminui o valor do feudo, pelo preço de compra e pelo de venda do dia; nunca o aumenta', () => {
    let accepted = 0;
    let roundTrips = 0;
    let autumnDays = 0;
    fc.assert(
      fc.property(day, (plan) => {
        const start = marketDay(plan);
        const buyAt = { food: 0, wood: 0, stone: 0 };
        const sellAt = { food: 0, wood: 0, stone: 0 };
        for (const id of RESOURCES) {
          const today = quote(start, id);
          buyAt[id] = today.buy;
          sellAt[id] = today.sell;
          // A venda paga sempre menos que a compra cobra, com qualquer preço e estação.
          expect(today.sell).toBeLessThan(today.buy);
        }
        const { num, den } = seasonalFactor('food', plan.atMs);
        autumnDays += num === den ? 0 : 1;
        let state = start;
        for (const wanted of plan.deals) {
          const result = applyCommand(
            state,
            tradeOrder(state, wanted.resource, wanted.direction, wanted.amount),
            state.lastProcessedAt,
          );
          if (!result.ok) {
            continue;
          }
          accepted += 1;
          const before = state;
          state = result.state;
          // Pelo preço de compra: a compra troca ouro por estoque do mesmo valor, e a venda
          // perde a margem. Pelo de venda: a compra perde a margem, e a venda troca igual.
          const byBuy = worth(state, buyAt) - worth(before, buyAt);
          const bySell = worth(state, sellAt) - worth(before, sellAt);
          if (wanted.direction === 'buy') {
            expect(byBuy).toBe(0);
            expect(bySell).toBeLessThan(0);
          } else {
            expect(byBuy).toBeLessThan(0);
            expect(bySell).toBe(0);
          }
          // Só o ouro e o recurso da ordem mudam, pelas quantidades do evento.
          const [event] = result.events;
          expect(event?.type).toBe('marketTraded');
          expect(state.settlement.resources.gold - before.settlement.resources.gold).toBe(
            (wanted.direction === 'buy' ? -1 : 1) * Number(event?.data.gold),
          );
          expect(
            state.settlement.resources[wanted.resource] -
              before.settlement.resources[wanted.resource],
          ).toBe((wanted.direction === 'buy' ? 1 : -1) * wanted.amount * 1000);
          expect(state.settlement.wasted).toStrictEqual(before.settlement.wasted);
        }
        // O dia inteiro: o valor nunca sobe por nenhuma das duas réguas.
        expect(worth(state, buyAt)).toBeLessThanOrEqual(worth(start, buyAt));
        expect(worth(state, sellAt)).toBeLessThanOrEqual(worth(start, sellAt));
        // E a pergunta do jogador: quem termina o dia com ao menos o estoque que tinha, de
        // todo recurso, não tem mais ouro; e quem termina com mais ouro tem menos de alguma
        // coisa.
        const { resources: now } = state.settlement;
        const { resources: then } = start.settlement;
        const keptStock = RESOURCES.every((id) => now[id] >= then[id]);
        if (keptStock) {
          roundTrips += 1;
          expect(now.gold).toBeLessThanOrEqual(then.gold);
          if (state !== start && RESOURCES.every((id) => now[id] === then[id])) {
            // Ida e volta completa: perdeu a margem de cada unidade.
            expect(now.gold).toBeLessThan(then.gold);
          }
        }
        if (now.gold > then.gold) {
          expect(RESOURCES.some((id) => now[id] < then[id])).toBe(true);
        }
      }),
      { numRuns: 400 },
    );
    expect(accepted).toBeGreaterThan(1200);
    expect(roundTrips).toBeGreaterThan(20);
    expect(autumnDays).toBeGreaterThan(50);
  });

  it('nem com o dia passando: sem ninguém trabalhando, o valor do feudo só cai entre a primeira ordem e a última do mesmo dia', () => {
    let accepted = 0;
    fc.assert(
      fc.property(
        day,
        fc.array(fc.integer({ min: 0, max: 20 * 60_000 }), { minLength: 60, maxLength: 60 }),
        (plan, waits) => {
          const start = marketDay(plan);
          const dayEnd = (Math.floor(plan.atMs / DAY) + 1) * DAY;
          const buyAt = { food: 0, wood: 0, stone: 0 };
          for (const id of RESOURCES) {
            buyAt[id] = quote(start, id).buy;
          }
          let state = start;
          plan.deals.forEach((wanted, index) => {
            // O tempo anda entre as ordens, sem sair do dia: ninguém trabalha no feudo do
            // cenário, e os aldeões comem.
            const at = Math.min(dayEnd - 1, state.lastProcessedAt + (waits[index] ?? 0));
            state = advanceTo(state, at).state;
            const result = applyCommand(
              state,
              tradeOrder(state, wanted.resource, wanted.direction, wanted.amount),
              at,
            );
            if (result.ok) {
              accepted += 1;
              state = result.state;
            }
            expect(quote(state, wanted.resource).buy).toBe(buyAt[wanted.resource]);
          });
          expect(worth(state, buyAt)).toBeLessThanOrEqual(worth(start, buyAt));
        },
      ),
      { numRuns: 100 },
    );
    expect(accepted).toBeGreaterThan(250);
  });
});
