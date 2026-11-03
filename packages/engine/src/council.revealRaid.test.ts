import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { currentShape } from './migrations';
import { cloneState } from './state';
import { accept, command, dealt, gameAt, HOUR, SUMMER } from './test-helpers';

function revealed() {
  const state = gameAt(SUMMER + HOUR);
  state.settlement.buildings.watchtower = 1;
  state.horde.scheduledRaids = [
    {
      id: 'card:test',
      atMs: state.lastProcessedAt + HOUR,
      kind: 'scripted',
      enemy: 'raiders',
      size: 'light',
      composition: null,
      announcedAtMs: state.lastProcessedAt,
    },
  ];
  const pending = dealt(state, 'warCouncil').state;
  const instanceId = pending.council.pending.find(
    (card) => card.cardId === 'warCouncil',
  )!.instanceId;
  return accept(pending, command('answerCard', { instanceId, optionId: 'hear' })).state;
}

describe('revelação de incursão pelo Conselho', () => {
  it('conserva a revelação até a resolução e limpa somente o id resolvido', () => {
    const state = revealed();
    expect(state.council.bonuses.revealedRaidId).toBe('card:test');
    const raidAt = state.horde.scheduledRaids[0]!.atMs;
    expect(advanceTo(state, raidAt - 1).state.council.bonuses.revealedRaidId).toBe('card:test');
    const resolved = advanceTo(state, raidAt);
    expect(
      resolved.events.some(
        (event) => event.type === 'raidSuffered' || event.type === 'raidRepelled',
      ),
    ).toBe(true);
    expect(resolved.state.council.bonuses.revealedRaidId).toBeNull();
    expect(currentShape(resolved.state, '')).toBeNull();
    expect(state.council.bonuses.revealedRaidId).toBe('card:test');
  });

  it('limpa revelação órfã ao acomodar o estado, sem mudar a forma histórica', () => {
    const state = cloneState(revealed());
    state.horde.scheduledRaids = [];
    expect(currentShape(state, '')).toBeNull();
    const settled = advanceTo(state, state.lastProcessedAt + 1);
    expect(settled.state.council.bonuses.revealedRaidId).toBeNull();
    expect(advanceTo(settled.state, settled.state.lastProcessedAt)).toEqual({
      state: settled.state,
      events: [],
    });
  });
});
