import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { heroLimit } from './heroes';
import { currentShape } from './migrations';
import { cloneState, createInitialState } from './state';
import { offersPerRotation } from './tavern';
import { command, HOUR } from './test-helpers';
import { nextEventAt } from './timeline';
import type { Command, DifficultyId, GameEvent, GameState } from './types';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;

/**
 * Um feudo de verdade (objetivos, Conselho, lobos, moral, fome e a carta da estrangeira no
 * caminho, com os sorteios deles), com o Salão no nível 3 e a obra da Taverna pedida em um
 * instante qualquer: a inauguração, as rotações, as contratações, o festival e as melhorias da
 * Taverna caem em instantes que nenhum teste escolheu.
 */
const scenario = fc.record({
  seed: fc.constantFrom('pedra-alta', 'vau-do-corvo', 'taverna-7'),
  timeScale: fc.constantFrom(3, 1, 0.5),
  difficulty: fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
  workers: fc.tuple(fc.nat(3), fc.nat(2), fc.nat(1), fc.nat(3)),
  // Em milésimos, para o resto do acumulador nascer "quebrado".
  gold: fc.integer({ min: 150_000, max: 900_000 }),
  wood: fc.integer({ min: 200_000, max: 900_000 }),
  warmUpMs: fc.nat(2 * DAY_REAL),
  // Em tempo real: no ritmo 3 são até 12 dias de jogo por ms sorteado.
  firstRealMs: fc.integer({ min: 1, max: 3 * DAY_REAL }),
  secondRealMs: fc.integer({ min: 1, max: 3 * DAY_REAL }),
  hire: fc.nat(2),
  festival: fc.boolean(),
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
  // este teste prova. A fila fica livre para a Taverna.
  warm.settlement.buildings.townHall = Math.max(3, warm.settlement.buildings.townHall);
  warm.settlement.constructionQueues = warm.settlement.constructionQueues.map(() => null);
  warm.settlement.planned = [];
  Object.assign(warm.settlement.resources, { wood: plan.wood, stone: 400_000, gold: plan.gold });
  let state: GameState = warm;
  const [farm, lumberMill, quarry, goldMine] = plan.workers;
  for (const cmd of [
    command('setWorkers', { building: 'farm', count: farm }),
    command('setWorkers', { building: 'lumberMill', count: lumberMill }),
    command('setWorkers', { building: 'quarry', count: quarry }),
    command('setWorkers', { building: 'goldMine', count: goldMine }),
    command('startConstruction', { building: 'tavern' }),
  ]) {
    state = order(state, cmd);
  }
  return state;
}

/** As ordens da Taverna que o plano manda dar agora, as que o feudo aceitar. */
function tavernOrders(state: GameState, plan: Scenario): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const orders: Command[] = [];
  const offer =
    current.guild.tavernOffers[plan.hire % Math.max(1, current.guild.tavernOffers.length)];
  if (offer !== undefined) {
    orders.push(command('hireHero', { offerId: offer.offerId }));
  }
  if (plan.festival) {
    orders.push(command('holdFestival', {}));
  }
  if (plan.upgrade) {
    orders.push(command('startConstruction', { building: 'tavern' }));
  }
  for (const cmd of orders) {
    const before = current;
    const result = applyCommand(current, cmd, current.lastProcessedAt);
    if (result.ok) {
      // Uma ordem não sorteia e não gasta identificador de oferta.
      expect(result.state.rng).toStrictEqual(before.rng);
      expect(result.state.ids.offer).toBe(before.ids.offer);
      current = result.state;
      events.push(...result.events);
      expectTavernInvariants(current);
    }
  }
  return { state: current, events };
}

/** O que vale em todo estado em repouso, com Taverna ou sem. */
function expectTavernInvariants(state: GameState): void {
  const { guild, settlement } = state;
  const { tavern, tavernOffers } = guild;
  // O estado inteiro continua na forma da versão: é o que o servidor confere ao gravar.
  expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();
  if (settlement.buildings.tavern === 0) {
    expect(tavernOffers).toEqual([]);
    expect(tavern.nextRotationAtMs).toBeNull();
    expect(state.rng.tavern).toBeUndefined();
  } else {
    // A rotação marcada é sempre futura, e a lista nunca passa do que o nível traz.
    expect(tavern.nextRotationAtMs).toBeGreaterThan(state.lastProcessedAt);
    expect(tavernOffers.length).toBeLessThanOrEqual(3);
    expect(new Set(tavernOffers.map((offer) => offer.templateId)).size).toBe(tavernOffers.length);
    const names = [
      ...tavernOffers.map((offer) => offer.name),
      ...guild.heroes.map((hero) => hero.name),
    ];
    expect(new Set(names).size).toBe(names.length);
  }
  expect(settlement.resources.gold).toBeGreaterThanOrEqual(0);
  // Em repouso o próximo evento é sempre depois de agora.
  expect(nextEventAt(state)).toBeGreaterThan(state.lastProcessedAt);
}

describe('divisão de intervalo com a Taverna no caminho: rotação, contratação e festival', () => {
  it('advanceTo(t3) é idêntico a advanceTo(t2) seguido de advanceTo(t3): estado, eventos, gerador e contadores', () => {
    let founded = 0;
    let rotations = 0;
    let hired = 0;
    let feasts = 0;
    let ended = 0;
    let upgraded = 0;
    fc.assert(
      fc.property(scenario, (plan) => {
        const start = prepare(plan);
        const t1 = start.lastProcessedAt + Math.round(plan.firstRealMs * plan.timeScale);
        // As ordens da Taverna em um instante qualquer, depois de a obra (quase sempre) acabar.
        const first = advanceTo(start, t1);
        const ordered = tavernOrders(first.state, plan);
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
        expectTavernInvariants(half.state);
        expectTavernInvariants(direct.state);

        // O caminho inteiro, das ordens da fundação ao fim, de uma vez só e com o corte nas
        // ordens: quem só avança chega ao mesmo estado de antes delas.
        expect(advanceTo(advanceTo(start, t1 - 1).state, t1).state).toStrictEqual(first.state);

        const all = [...first.events, ...ordered.events, ...direct.events];
        founded += all.filter(
          (event) => event.type === 'buildingFounded' && event.data.building === 'tavern',
        ).length;
        hired += all.filter((event) => event.type === 'heroHired').length;
        feasts += all.filter((event) => event.type === 'festivalHeld').length;
        ended += all.filter((event) => event.type === 'festivalEnded').length;
        upgraded += all.filter(
          (event) => event.type === 'constructionFinished' && event.data.building === 'tavern',
        ).length;
        // Cada rotação dá identificador a todas as ofertas dela: o contador conta as trocas.
        const offers = direct.state.ids.offer ?? 0;
        rotations += offers > 0 ? Math.floor(offers / 2) : 0;
        // Ninguém é contratado além do limite, e todo contratado tem identificador.
        const heroes = direct.state.guild.heroes.length;
        expect(heroes).toBeLessThanOrEqual(Math.max(heroLimit(direct.state), 1) + 1);
        expect(direct.state.ids.hero ?? 0).toBeGreaterThanOrEqual(heroes);
      }),
      { numRuns: 150 },
    );
    // A propriedade passou mesmo pelo que diz provar.
    expect(founded).toBeGreaterThan(100);
    expect(rotations).toBeGreaterThan(150);
    expect(hired).toBeGreaterThan(40);
    expect(feasts).toBeGreaterThan(20);
    expect(ended).toBeGreaterThan(5);
    expect(upgraded).toBeGreaterThan(10);
  });

  it('vale em dez pedaços, com o estado passando pelo banco e com ordens da Taverna em cada corte', () => {
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
            expectTavernInvariants(direct.state);
            // No corte, o senhor passa pela Taverna.
            state = JSON.parse(JSON.stringify(tavernOrders(direct.state, plan).state)) as GameState;
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('no instante exato de cada rotação a lista já é a nova: a oferta antiga é recusada, e a nova, aceita ou recusada por outro motivo', () => {
    let checked = 0;
    fc.assert(
      fc.property(scenario, (plan) => {
        let state = advanceTo(
          prepare(plan),
          prepare(plan).lastProcessedAt + Math.round(plan.firstRealMs * plan.timeScale),
        ).state;
        for (let turn = 0; turn < 3; turn += 1) {
          const at = state.guild.tavern.nextRotationAtMs;
          if (at === null) {
            return;
          }
          const old = state.guild.tavernOffers.map((offer) => offer.offerId);
          const expected = offersPerRotation(advanceTo(state, at).state);
          state = advanceTo(state, at).state;
          expect(state.guild.tavernOffers).toHaveLength(expected);
          for (const offerId of old) {
            const result = applyCommand(state, command('hireHero', { offerId }), at);
            expect(result.ok).toBe(false);
            expect(!result.ok && result.code).toBe('OFFER_GONE');
            checked += 1;
          }
          const [fresh] = state.guild.tavernOffers;
          if (fresh !== undefined) {
            const result = applyCommand(state, command('hireHero', { offerId: fresh.offerId }), at);
            expect(result.ok || result.code !== 'OFFER_GONE').toBe(true);
          }
        }
      }),
      { numRuns: 60 },
    );
    expect(checked).toBeGreaterThan(100);
  });

  it('a visão de qualquer desses feudos não muda o estado, e só mostra os candidatos que o estado tem', () => {
    fc.assert(
      fc.property(scenario, (plan) => {
        const start = prepare(plan);
        const state = advanceTo(
          start,
          start.lastProcessedAt + Math.round(plan.firstRealMs * plan.timeScale),
        ).state;
        const frozen = JSON.stringify(state);
        const view = deriveViewState(state, state.lastProcessedAt);
        nextEventAt(state);
        expect(JSON.stringify(state)).toBe(frozen);
        expect(view.tavern.offers.map((offer) => offer.offerId)).toEqual(
          state.guild.tavernOffers.map((offer) => offer.offerId),
        );
        expect(view.tavern.level).toBe(state.settlement.buildings.tavern);
        expect(view.guild.heroLimit).toBe(heroLimit(state));
        for (const offer of view.tavern.offers) {
          // "Pode contratar" na tela é a ordem ser aceita.
          const result = applyCommand(
            state,
            command('hireHero', { offerId: offer.offerId }),
            state.lastProcessedAt,
          );
          expect(result.ok).toBe(offer.blockedReason === null);
          if (!result.ok) {
            expect(result.message).toBe(offer.blockedReason);
          }
        }
        const feast = applyCommand(state, command('holdFestival', {}), state.lastProcessedAt);
        expect(feast.ok).toBe(view.tavern.festival.available);
        if (!feast.ok) {
          expect(feast.message).toBe(view.tavern.festival.blockedReason);
        }
      }),
      { numRuns: 80 },
    );
  });
});
