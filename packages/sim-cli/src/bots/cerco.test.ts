import { applyCommand, deriveViewState, type Command } from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { readySiege } from '../../../engine/src/siege.test-helpers';
import { responderCerco } from './policies';
import type { Act } from './types';

describe('política responderCerco (V4G-T2.10/Achado 1)', () => {
  it('salva o plano de batalha para as três ondas com a formação ativa', async () => {
    let state = readySiege();
    const commands: Command[] = [];
    const act: Act = async (type, payload) => {
      const command = { commandId: `cmd-${commands.length}`, type, payload } as Command;
      commands.push(command);
      const result = applyCommand(state, command, state.lastProcessedAt);
      if (result.ok) state = result.state;
      return deriveViewState(state, state.lastProcessedAt);
    };

    const initialView = deriveViewState(state, state.lastProcessedAt);
    expect(initialView.siege?.current).toBe(0);
    expect(initialView.siege?.plan).toEqual({ 1: null, 2: null, 3: null });

    const after = await responderCerco.run(initialView, act);

    expect(commands.filter((c) => c.type === 'setBattlePlan')).toHaveLength(3);
    expect(after.siege?.plan).toEqual({
      1: 'formation-1',
      2: 'formation-1',
      3: 'formation-1',
    });
  });
});
