import { advanceTo, deriveViewState } from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { accept, campaignYard, command } from '../../engine/src/test-helpers';
import { CommandSchema } from './commands';
import { RejectionCodeSchema, ViewStateSchema } from './view';

const commandId = 'b04409c1-c6c6-4a36-ab5c-a28c528b61dc';

describe('contrato da campanha ofensiva', () => {
  it('aceita só formationId; não recebe tropa, relógio nem resultado do cliente', () => {
    expect(
      CommandSchema.safeParse({
        commandId,
        type: 'attackCamp',
        payload: { formationId: 'formation-1' },
      }).success,
    ).toBe(true);
    for (const payload of [
      {},
      { formationId: '' },
      { formationId: 'formation-1', battleAtMs: 1 },
      { formationId: 'formation-1', report: {} },
    ]) {
      expect(CommandSchema.safeParse({ commandId, type: 'attackCamp', payload }).success).toBe(
        false,
      );
    }
    for (const code of ['ARMY_AWAY', 'CAMP_NOT_FOUND', 'NO_SOLDIERS', 'FORMATION_IN_CAMPAIGN'])
      expect(RejectionCodeSchema.safeParse(code).success).toBe(true);
  });

  it('a visão lê a ida e a volta com o relatório completo e os avisos', () => {
    const start = accept(
      campaignYard(),
      command('attackCamp', { formationId: 'formation-1' }),
    ).state;
    const arrival = start.army.campaign!.battleAtMs;
    for (const state of [
      start,
      advanceTo(start, arrival).state,
      advanceTo(start, arrival * 2).state,
    ]) {
      const view = deriveViewState(state, state.lastProcessedAt);
      const parsed = ViewStateSchema.safeParse(view);
      expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(
        true,
      );
    }
  });
});
