import type {
  Command as EngineCommand,
  PendingDecisionView,
  RejectionCode as EngineRejectionCode,
  ViewState as EngineViewState,
} from '@lotg/engine';
import { advanceTo, deriveViewState } from '@lotg/engine';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { readySiege } from '../../engine/src/siege.test-helpers';
import {
  type Command,
  CommandSchema,
  PROTOCOL_VERSION,
  type RejectionCode,
  type ViewState,
  ViewStateSchema,
} from './index';

const commandId = '11111111-1111-4111-8111-111111111111';

describe('protocolo 4: o Cerco', () => {
  it('iguala os contratos públicos completos e a decisão do motor', () => {
    expect(PROTOCOL_VERSION).toBe(4);
    expectTypeOf<Command>().toEqualTypeOf<EngineCommand>();
    expectTypeOf<ViewState>().toEqualTypeOf<EngineViewState>();
    expectTypeOf<RejectionCode>().toEqualTypeOf<EngineRejectionCode>();
    expectTypeOf<ViewState['pendingDecisions'][number]>().toEqualTypeOf<PendingDecisionView>();
  });

  it.each([0.5, 1, 3])(
    'lê a decisão pública entre ondas no ritmo %s sem revelar composição',
    (pace) => {
      const before = readySiege('lord', pace);
      const state = advanceTo(before, before.siege!.atMs).state;
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(ViewStateSchema.parse(view)).toEqual(view);
      expect(view.pendingDecisions).toContainEqual({
        kind: 'siegeWave',
        id: 'siege-1-2',
        title: expect.any(String),
        wave: 2,
        expiresInSeconds: 3600,
        options: [
          { formationId: null, label: expect.any(String), selected: true },
          { formationId: 'formation-1', label: 'Muralha Firme', selected: false },
        ],
      });
      expect(JSON.stringify(view.siege)).not.toMatch(/composition|warlord|reductionPercent|rng/);

      const decision = view.pendingDecisions.find((entry) => entry.kind === 'siegeWave')!;
      for (const changed of [
        { ...decision, wave: 4 },
        { ...decision, options: undefined },
        { ...decision, composition: {} },
        { ...decision, options: [{ formationId: null, label: 'Defesa', selected: 'sim' }] },
      ]) {
        expect(ViewStateSchema.safeParse({ ...view, pendingDecisions: [changed] }).success).toBe(
          false,
        );
      }
      expect(
        ViewStateSchema.safeParse({ ...view, siege: { ...view.siege, waves: state.siege!.waves } })
          .success,
      ).toBe(false);
    },
  );

  it('valida as quatro ordens do cerco e recusa campos que viriam do estado', () => {
    const valid: Command[] = [
      { commandId, type: 'setBattlePlan', payload: { wave: 1, formationId: null } },
      { commandId, type: 'setBattlePlan', payload: { wave: 3, formationId: 'formation-1' } },
      { commandId, type: 'swapWaveFormation', payload: { formationId: null } },
      { commandId, type: 'swapWaveFormation', payload: { formationId: 'formation-1' } },
      { commandId, type: 'emergencyRepair', payload: {} },
      { commandId, type: 'callMilitia', payload: { count: 5 } },
      // A faixa é regra do motor: inteiros fora dela chegam à recusa legível (422).
      { commandId, type: 'callMilitia', payload: { count: -1 } },
    ];
    for (const command of valid) expect(CommandSchema.parse(command)).toEqual(command);
    for (const command of [
      { type: 'setBattlePlan', payload: { wave: 4, formationId: null } },
      { type: 'swapWaveFormation', payload: {} },
      { type: 'swapWaveFormation', payload: { formationId: 1 } },
      { type: 'swapWaveFormation', payload: { formationId: 'x', atMs: 1 } },
      { type: 'emergencyRepair', payload: { cost: 0 } },
      { type: 'callMilitia', payload: { count: 1.5 } },
    ]) {
      expect(CommandSchema.safeParse({ commandId, ...command }).success).toBe(false);
    }
  });
});
