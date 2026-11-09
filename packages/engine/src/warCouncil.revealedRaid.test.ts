import { LINE_IDS, WING_IDS } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { currentShape } from './migrations';
import { baseRaidComposition } from './raidArmy';
import { accept, command, dealt, formationYard, HOUR } from './test-helpers';
import { deriveViewState } from './view';
import { formationSignature, previewInputFor } from './warCouncilOrders';

/** A composição que uma carta tornou pública precisa alimentar também a prévia (GDD §10.5). */
describe('V4E-T5.1: a carta revela a incursão ao Conselho de Guerra', () => {
  it.each([1, 2, 3, 4])('a Torre Nv%s usa a composição exata revelada pela carta', (tower) => {
    const state = formationYard();
    state.settlement.buildings.watchtower = tower;
    state.horde.scheduledRaids = [
      {
        id: 'card:revealed',
        atMs: HOUR,
        kind: 'threat',
        enemy: 'horde',
        size: 'strong',
        announcedAtMs: 0,
        composition: [
          { wing: 'left', line: 'front', unit: 'ogre', count: 11 },
          { wing: 'center', line: 'back', unit: 'shaman', count: 3 },
        ],
      },
    ];
    const formation = state.army.formations[0]!;
    const previousSignature = formationSignature(state, formation);
    const previous = accept(state, command('simulateBattle', { formationId: formation.id })).state;
    const pending = dealt(previous, 'warCouncil').state;
    const instanceId = pending.council.pending.find((c) => c.cardId === 'warCouncil')!.instanceId;
    const revealed = accept(pending, command('answerCard', { instanceId, optionId: 'hear' })).state;
    expect(currentShape(revealed, '')).toBeNull();
    expect(deriveViewState(revealed, 0).threat.incoming?.compositionText).toContain('11 ogros');
    const enemy = previewInputFor(revealed, formation).enemy;
    for (const wing of WING_IDS) {
      for (const line of LINE_IDS) {
        const post = state.horde.scheduledRaids[0]!.composition!.find(
          (p) => p.wing === wing && p.line === line,
        );
        expect(enemy[wing][line]).toEqual(
          post === undefined ? null : { kind: 'known', unit: post.unit, count: post.count },
        );
      }
    }
    expect(formationSignature(revealed, formation)).not.toBe(previousSignature);
    expect(deriveViewState(revealed, 0).army.formations[0]?.previewStale).toBe(true);
    const simulated = accept(
      revealed,
      command('simulateBattle', { formationId: formation.id }),
    ).state;
    expect(simulated.army.preview!.enemy).toHaveLength(2);
    expect(simulated.army.preview!.enemy.every((p) => p.known)).toBe(true);
    expect(simulated.rng).toEqual(revealed.rng);
    expect(deriveViewState(simulated, 0).army.formations[0]?.previewStale).toBe(false);
  });

  it('a revelação de incursão migrada usa a base da estação e não vale para outro id', () => {
    const state = formationYard();
    state.settlement.buildings.watchtower = 1;
    state.horde.scheduledRaids = [
      {
        id: 'legacy',
        atMs: HOUR,
        kind: 'threat',
        enemy: 'wolves',
        size: 'light',
        announcedAtMs: 0,
        composition: null,
      },
    ];
    const formation = state.army.formations[0]!;
    state.council.bonuses.revealedRaidId = 'legacy';
    const input = previewInputFor(state, formation);
    const posts = baseRaidComposition('light', 'spring');
    for (const post of posts)
      expect(input.enemy[post.wing][post.line]).toEqual({
        kind: 'known',
        unit: post.unit,
        count: post.count,
      });
    state.settlement.buildings.watchtower = 0;
    expect(previewInputFor(state, formation).enemy).not.toEqual(input.enemy);
    state.settlement.buildings.watchtower = 1;
    state.council.bonuses.revealedRaidId = 'outro-id';
    expect(previewInputFor(state, formation).enemy).not.toEqual(input.enemy);
  });
});
