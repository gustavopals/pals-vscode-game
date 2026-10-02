import { describe, expect, it } from 'vitest';

import { HOUR, runWeekScenario as runScenario } from './test-helpers';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;

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
