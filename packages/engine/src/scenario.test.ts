import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { command, HOUR, newGame } from './test-helpers';
import type { Command, GameEvent, GameState } from './types';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;

/** Sete dias reais de um jogador de duas sessões por dia: ordens com os seus instantes. */
const script: Array<[hour: number, order: Command]> = [
  // Dia 1: os quatro objetivos.
  [0, command('setWorkers', { building: 'farm', count: 2 })],
  [0, command('startConstruction', { building: 'housing' })],
  [0, command('recruitVillagers', { quantity: 3 })],
  [1, command('setWorkers', { building: 'lumberMill', count: 3 })],
  [1, command('setWorkers', { building: 'quarry', count: 2 })],
  [1, command('setWorkers', { building: 'goldMine', count: 1 })],
  [8, command('startConstruction', { building: 'townHall' })],
  [12, command('recruitVillagers', { quantity: 5 })],
  [12, command('recruitVillagers', { quantity: 3 })],
  [12, command('startConstruction', { building: 'lumberMill' })],
  [12, command('planConstruction', { building: 'farm' })],
  // Dia 2: mais braços na madeira e no ouro; uma obra cancelada.
  [24, command('setWorkers', { building: 'lumberMill', count: 4 })],
  [24, command('setWorkers', { building: 'goldMine', count: 3 })],
  [24, command('startConstruction', { building: 'farm' })],
  [36, command('startConstruction', { building: 'quarry' })],
  [36, command('cancelConstruction', { building: 'quarry' })],
  [36, command('startConstruction', { building: 'housing' })],
  [36, command('setWorkers', { building: 'quarry', count: 9 })],
  // Dia 3: o feudo ganha nome novo e o Salão sobe.
  [48, command('recruitVillagers', { quantity: 4 })],
  [48, command('startConstruction', { building: 'goldMine' })],
  [48, command('renameSettlement', { name: 'Pedra Alta do Norte' })],
  [60, command('setWorkers', { building: 'quarry', count: 4 })],
  [60, command('startConstruction', { building: 'townHall' })],
  // Dia 4: o senhor tira todos da Fazenda e gasta a comida em recrutas. A fome vem.
  [72, command('setWorkers', { building: 'farm', count: 0 })],
  [72, command('setWorkers', { building: 'lumberMill', count: 6 })],
  [72, command('recruitVillagers', { quantity: 5 })],
  [72, command('startConstruction', { building: 'housing' })],
  [84, command('recruitVillagers', { quantity: 5 })],
  [84, command('startConstruction', { building: 'quarry' })],
  // Dia 5: ordens dadas com o feudo faminto.
  [108, command('recruitVillagers', { quantity: 1 })],
  [108, command('startConstruction', { building: 'lumberMill' })],
  // Dia 6: de volta à Fazenda; a fome acaba.
  [132, command('setWorkers', { building: 'lumberMill', count: 2 })],
  [132, command('setWorkers', { building: 'farm', count: 8 })],
  [132, command('startConstruction', { building: 'farm' })],
  // Dia 7: últimas obras antes da virada do ano.
  [144, command('startConstruction', { building: 'townHall' })],
  [144, command('unplanConstruction', { building: 'farm' })],
  [156, command('recruitVillagers', { quantity: 3 })],
  [156, command('startConstruction', { building: 'goldMine' })],
];

function runScenario() {
  let state: GameState = newGame('pedra-alta-golden');
  const events: GameEvent[] = [];
  const orders: Array<Record<string, unknown>> = [];
  const days: Array<Record<string, unknown>> = [];

  const advance = (toMs: number) => {
    const result = advanceTo(state, toMs);
    state = result.state;
    events.push(...result.events);
  };

  let cursor = 0;
  for (let day = 1; day <= 7; day += 1) {
    for (; cursor < script.length; cursor += 1) {
      const [hour, order] = script[cursor] as [number, Command];
      if (hour * HOUR >= day * DAY_REAL) {
        break;
      }
      advance(hour * HOUR);
      const result = applyCommand(state, order, state.lastProcessedAt);
      if (result.ok) {
        state = result.state;
        events.push(...result.events);
      }
      orders.push({
        hour,
        type: order.type,
        payload: order.payload,
        result: result.ok ? 'accepted' : result.code,
      });
    }
    advance(day * DAY_REAL);
    days.push({ day, eventsSoFar: events.length, state });
  }
  return { state, events, orders, days };
}

describe('cenário golden de 7 dias', () => {
  it('estado a cada 24 h, ordens e eventos idênticos ao golden', async () => {
    const { orders, days, events } = runScenario();
    await expect(`${JSON.stringify({ orders, days, events }, null, 1)}\n`).toMatchFileSnapshot(
      './__golden__/scenario-7-days.json',
    );
  });

  it('rodar duas vezes dá exatamente o mesmo resultado', () => {
    expect(runScenario()).toStrictEqual(runScenario());
  });

  it('o roteiro passa pelos momentos que o golden quer congelar', () => {
    const { state, events, orders } = runScenario();
    const types = new Set(events.map((event) => event.type));
    for (const type of [
      'constructionFinished',
      'constructionCancelled',
      'recruitmentFinished',
      'objectiveCompleted',
      'famineStarted',
      'famineEnded',
      'seasonChanged',
      'yearStarted',
      'settlementRenamed',
    ]) {
      expect(types).toContain(type);
    }
    expect(orders.some((order) => order.result !== 'accepted')).toBe(true);
    expect(orders.filter((order) => order.result === 'accepted').length).toBeGreaterThan(30);
    expect(state.lastProcessedAt).toBe(7 * DAY_REAL);
    expect(state.clock.year).toBe(2);
    expect(state.objectives.active).toEqual([]);
    expect(deriveViewState(state, state.lastProcessedAt).settlement.name).toBe(
      'Pedra Alta do Norte',
    );
  });
});
