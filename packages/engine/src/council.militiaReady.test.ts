import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { currentShape, migrateState } from './migrations';
import { readySiege } from './siege.test-helpers';
import { accept, command, dealt } from './test-helpers';

describe('A véspera: milícia pronta (§11.5)', () => {
  it('preserva o trabalho até a batalha e convoca no máximo 25% dos aldeões', () => {
    const state = readySiege();
    state.army.formations[0]!.posts.right.front = null;
    state.settlement.buildings.watchtower = 0;
    Object.assign(state.settlement.buildings, { farm: 8, lumberMill: 8, quarry: 8, goldMine: 8 });
    state.settlement.workers = { farm: 10, lumberMill: 10, quarry: 5, goldMine: 5 };
    const pending = dealt(state, 'siegeEve').state;
    const instanceId = pending.council.pending.find(
      (card) => card.cardId === 'siegeEve',
    )!.instanceId;
    const answered = accept(pending, command('answerCard', { instanceId, optionId: 'vigil' }));
    expect(currentShape(answered.state, '')).toBeNull();
    expect(migrateState(JSON.parse(JSON.stringify(answered.state)), { timeScale: 1 })).toEqual(
      answered.state,
    );
    expect(answered.state.settlement.militia).toBeNull();
    expect(answered.state.settlement.workers).toEqual(state.settlement.workers);
    expect(answered.events.some((event) => event.type === 'militiaCalled')).toBe(false);
    const battle = advanceTo(answered.state, state.siege!.atMs);
    const called = battle.events.filter((event) => event.type === 'militiaCalled');
    expect(called).toMatchObject([{ atMs: state.siege!.atMs, data: { count: 7 } }]);
    const report = battle.state.army.reports.at(-1)!;
    expect(
      report.casualties.filter((post) => post.owner === 'player' && post.unit === 'militia'),
    ).toMatchObject([{ start: 7 }]);
    expect(battle.state.settlement.militia).toBeNull();
    expect(battle.state.stats.militiaReady).toBeUndefined();
  });
});
