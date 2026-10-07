import { balance, PRODUCTION_BUILDING_IDS } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { inhabitants } from './masters';
import { currentShape } from './migrations';
import { aboveFloor } from './morale';
import { ableVillagers, assignedWorkers, housingVacancy } from './population';
import { cloneState, createInitialState } from './state';
import { addHero, bringMaster, command, HOUR, settings } from './test-helpers';
import { nextEventAt } from './timeline';
import type {
  Command,
  DifficultyId,
  GameEvent,
  GameState,
  PostureId,
  ProductionBuildingId,
} from './types';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;

/**
 * Um feudo de verdade (objetivos, Conselho, lobos, moral, fome, a carta da estrangeira e os
 * sorteios deles), com a Guilda de pé, três heróis fortes e as Ruínas reveladas: é lá que mora
 * Odo. O senhor passa pelo feudo em instantes quaisquer: manda a equipe às Ruínas, dá e tira o
 * edifício dos Mestres, ergue Habitações, recruta e mexe nos aldeões. Às vezes outro Mestre já
 * espera à porta, com as casas cheias. As chegadas, as entradas de quem esperava e o fim de
 * cada adaptação caem em instantes que nenhum teste escolheu.
 */
const scenario = fc.record({
  seed: fc.constantFrom('pedra-alta', 'vau-do-corvo', 'porto-do-rio', 'serra-do-lobo'),
  timeScale: fc.constantFrom(3, 1, 0.5),
  difficulty: fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
  // O Salão no nível 3 e as Habitações no 1 abrigam vinte: com 20 as casas estão cheias.
  villagers: fc.constantFrom(12, 19, 20, 20),
  atDoor: fc.constantFrom('none', 'gil', 'gil', 'both'),
  workers: fc.tuple(fc.nat(3), fc.nat(2), fc.nat(1), fc.nat(1)),
  food: fc.integer({ min: 0, max: 400_000 }),
  gold: fc.integer({ min: 100_000, max: 900_000 }),
  warmUpMs: fc.nat(DAY_REAL),
  visits: fc.array(
    fc.record({
      afterRealMs: fc.integer({ min: 1, max: 3 * HOUR }),
      ruins: fc.boolean(),
      posture: fc.constantFrom<PostureId>('cautious', 'balanced', 'bold'),
      assign: fc.array(
        fc.record({
          which: fc.nat(3),
          building: fc.constantFrom<ProductionBuildingId | null>(...PRODUCTION_BUILDING_IDS, null),
        }),
        { maxLength: 2 },
      ),
      housing: fc.boolean(),
      recruit: fc.nat(2),
      staff: fc.option(
        fc.record({
          building: fc.constantFrom<ProductionBuildingId>(...PRODUCTION_BUILDING_IDS),
          count: fc.nat(4),
        }),
        { nil: null },
      ),
    }),
    { minLength: 6, maxLength: 12 },
  ),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;
type Visit = Scenario['visits'][number];

function prepare(plan: Scenario): GameState {
  const state = cloneState(
    createInitialState(plan.seed, {
      ...settings,
      timeScale: plan.timeScale,
      difficulty: plan.difficulty,
    }),
  );
  const [farm, lumberMill, quarry, goldMine] = plan.workers;
  Object.assign(state.settlement.buildings, { townHall: 3, guild: 1 });
  state.settlement.population.villagers = plan.villagers;
  Object.assign(state.settlement.workers, { farm, lumberMill, quarry, goldMine });
  Object.assign(state.settlement.resources, {
    food: plan.food,
    gold: plan.gold,
    wood: 480_000,
    stone: 480_000,
  });
  state.map.discovered = ['ruins'];
  addHero(state, { name: 'Edda', gender: 'f', classId: 'warrior', level: 6, traits: ['brave'] });
  addHero(state, { name: 'Rolf', classId: 'archer', level: 6, traits: ['loyal'] });
  addHero(state, { name: 'Brann', classId: 'warrior', level: 6, traits: ['loyal'] });
  if (plan.atDoor !== 'none') {
    bringMaster(state, 'gil');
  }
  if (plan.atDoor === 'both') {
    bringMaster(state, 'ximena');
  }
  return advanceTo(state, Math.round(plan.warmUpMs * plan.timeScale)).state;
}

/** As ordens de uma visita, lidas da visão: aceitas ou recusadas, o estado segue. */
function visit(state: GameState, plan: Visit): { state: GameState; events: GameEvent[] } {
  const now = state.lastProcessedAt;
  const view = deriveViewState(state, now);
  const orders: Command[] = [];
  for (const { which, building } of plan.assign) {
    const master = view.masters[which % Math.max(1, view.masters.length)];
    if (master !== undefined) {
      orders.push(command('assignMaster', { masterId: master.id, building }));
    }
  }
  if (plan.ruins) {
    const free = view.guild.heroes.filter((hero) => hero.canDepart);
    orders.push(
      command('sendExpedition', {
        modelId: 'ruins',
        heroIds: free.map((hero) => hero.id),
        posture: plan.posture,
      }),
    );
  }
  for (const pending of view.pendingDecisions) {
    if (pending.kind === 'crossroads') {
      const expedition = view.guild.expeditions.find((entry) => entry.id === pending.id);
      const option = expedition?.crossroads?.options.find((entry) => entry.lockedReason === null);
      if (expedition !== undefined && option !== undefined) {
        orders.push(
          command('chooseExpeditionPath', { expeditionId: expedition.id, optionId: option.id }),
        );
      }
    }
  }
  if (plan.housing) {
    orders.push(command('startConstruction', { building: 'housing' }));
  }
  if (plan.recruit > 0) {
    orders.push(command('recruitVillagers', { quantity: plan.recruit }));
  }
  if (plan.staff !== null) {
    orders.push(command('setWorkers', plan.staff));
  }
  let current = state;
  const events: GameEvent[] = [];
  for (const order of orders) {
    const before = current;
    const result = applyCommand(current, order, now);
    if (result.ok) {
      // Uma ordem não sorteia, e a de um Mestre não cria entidade.
      expect(result.state.rng).toStrictEqual(before.rng);
      if (order.type === 'assignMaster') {
        expect(result.state.ids).toStrictEqual(before.ids);
      }
      current = result.state;
      events.push(...result.events);
    }
  }
  return { state: current, events };
}

const stored = (state: GameState) => JSON.parse(JSON.stringify(state)) as GameState;

/** O que tem de valer em qualquer instante de qualquer partida com Mestres. */
function expectInvariants(state: GameState, known: Map<string, string>): void {
  const { settlement } = state;
  // O estado inteiro continua na forma da versão: é o que o servidor confere ao gravar.
  expect(currentShape(stored(state), '')).toBeNull();
  // Em repouso ninguém espera à porta com vaga aberta.
  if (settlement.mastersWaiting.length > 0) {
    expect(housingVacancy(state)).toBeLessThanOrEqual(0);
  }
  // A soma dos trabalhadores nunca passa dos aldeões que podem trabalhar: o Mestre fica fora
  // das duas contas.
  expect(assignedWorkers(state)).toBeLessThanOrEqual(ableVillagers(state));
  expect(ableVillagers(state)).toBeGreaterThanOrEqual(0);
  // Um Mestre nunca some nem troca de identidade: quem entrou, ou esperava, continua.
  const present = new Map(
    [...settlement.masters, ...settlement.mastersWaiting].map((entry) => [
      entry.id,
      entry.masterId as string,
    ]),
  );
  for (const [id, masterId] of known) {
    expect(present.get(id)).toBe(masterId);
  }
  for (const [id, masterId] of present) {
    known.set(id, masterId);
  }
  expect(present.size).toBeLessThanOrEqual(balance.masters.rosterCap);
  // Só se adapta quem tem edifício, e o prazo nunca passa de um dia de jogo à frente.
  for (const master of settlement.masters) {
    if (master.adaptingUntilMs !== null) {
      expect(master.building).not.toBeNull();
      expect(master.adaptingUntilMs).toBeGreaterThan(state.lastProcessedAt);
      expect(master.adaptingUntilMs - state.lastProcessedAt).toBeLessThanOrEqual(
        balance.masters.adaptationMs,
      );
    }
  }
  // O piso protege os aldeões, com quantos Mestres houver, e Mestre nenhum tem fluxo de sorteio.
  expect(aboveFloor(state)).toBe(settlement.population.villagers > balance.morale.populationFloor);
  expect(inhabitants(state)).toBe(settlement.population.villagers + settlement.masters.length);
  expect(Object.keys(state.rng).filter((key) => key.startsWith('master'))).toEqual([]);
  const next = nextEventAt(state);
  expect(next === null || next >= state.lastProcessedAt).toBe(true);
}

describe('a divisão de intervalo com Mestres chegando, esperando e trocando de edifício', () => {
  it('avançar de uma vez ou em dois pedaços dá o mesmo estado, os mesmos eventos, o mesmo gerador e os mesmos contadores, com ordens entre os avanços, nos três ritmos', () => {
    let found = 0;
    let waited = 0;
    let admitted = 0;
    let assigned = 0;
    let adapted = 0;
    let lost = 0;
    const paces = new Set<number>();
    fc.assert(
      fc.property(scenario, (plan) => {
        let state = prepare(plan);
        const known = new Map<string, string>();
        expectInvariants(state, known);
        for (const step of plan.visits) {
          const target = state.lastProcessedAt + Math.round(step.afterRealMs * plan.timeScale);
          const middle = state.lastProcessedAt + Math.floor((target - state.lastProcessedAt) / 3);
          const direct = advanceTo(state, target);
          const half = advanceTo(state, middle);
          // O estado passa pelo banco no corte: é o que o servidor faz entre duas leituras.
          const split = advanceTo(stored(half.state), target);
          expect(split.state).toStrictEqual(direct.state);
          expect(split.state.rng).toStrictEqual(direct.state.rng);
          expect(split.state.ids).toStrictEqual(direct.state.ids);
          expect([...half.events, ...split.events]).toStrictEqual(direct.events);
          expectInvariants(half.state, new Map(known));
          expectInvariants(direct.state, known);
          // A visão e a linha do tempo não tocam o gerador nem os contadores.
          const frozen = JSON.stringify(direct.state);
          deriveViewState(direct.state, target, { timeScale: plan.timeScale });
          nextEventAt(direct.state);
          expect(JSON.stringify(direct.state)).toBe(frozen);

          const adaptingBefore = state.settlement.masters.filter(
            (entry) => entry.adaptingUntilMs !== null,
          ).length;
          const adaptingAfter = direct.state.settlement.masters.filter(
            (entry) => entry.adaptingUntilMs !== null,
          ).length;
          adapted += Math.max(0, adaptingBefore - adaptingAfter);
          for (const event of direct.events) {
            if (event.type === 'masterWaiting') {
              waited += 1;
            }
            if (event.type === 'masterArrived') {
              admitted += 1;
              found += event.data.master === 'odo' ? 1 : 0;
            }
            if (event.type === 'villagerLeft' || event.type === 'villagerDeserted') {
              lost += 1;
            }
          }

          const ordered = visit(direct.state, step);
          assigned += ordered.events.filter((event) => event.type === 'masterAssigned').length;
          expectInvariants(ordered.state, known);
          state = stored(ordered.state);
        }
        paces.add(plan.timeScale);
      }),
      { numRuns: 120 },
    );
    // A propriedade passou mesmo pelo que diz provar: Mestres achados em expedição, Mestres que
    // esperavam à porta e entraram (os que não são Odo), ordens aceitas, adaptações que
    // terminaram no caminho e aldeões que partiram ou desertaram com Mestres no feudo.
    expect(found).toBeGreaterThan(8);
    expect(admitted - found).toBeGreaterThan(20);
    expect(assigned).toBeGreaterThan(200);
    expect(adapted).toBeGreaterThan(60);
    expect(lost).toBeGreaterThan(10);
    expect(waited).toBeGreaterThanOrEqual(0);
    expect([...paces].sort()).toEqual([0.5, 1, 3]);
  });

  it('30 dias sem acesso com um Mestre à porta e outro em adaptação dão o mesmo que 30 dias de visitas com a tela aberta', () => {
    fc.assert(
      fc.property(scenario, (plan) => {
        const start = prepare(plan);
        let ordered = start;
        for (const step of plan.visits.slice(0, 3)) {
          ordered = visit(ordered, step).state;
        }
        const end = ordered.lastProcessedAt + 30 * DAY_REAL * plan.timeScale;
        const away = advanceTo(ordered, end);
        let visiting = ordered;
        const told: GameEvent[] = [];
        for (let day = 1; day <= 30; day += 1) {
          const at = ordered.lastProcessedAt + day * DAY_REAL * plan.timeScale;
          const next = advanceTo(visiting, at);
          deriveViewState(next.state, at, { timeScale: plan.timeScale });
          told.push(...next.events);
          visiting = stored(next.state);
        }
        expect(visiting).toStrictEqual(away.state);
        expect(told).toStrictEqual(away.events);
        // Trinta dias depois ninguém se adapta, e quem estava no feudo continua nele.
        expect(away.state.settlement.masters.every((entry) => entry.adaptingUntilMs === null)).toBe(
          true,
        );
        expect(away.state.settlement.masters.length).toBeGreaterThanOrEqual(
          ordered.settlement.masters.length,
        );
        expectInvariants(away.state, new Map());
      }),
      { numRuns: 12 },
    );
  });
});
