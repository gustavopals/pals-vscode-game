import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  createInitialState,
  deriveViewState,
  applyCommand,
  type ViewState as EngineViewState,
  type Command as EngineCommand,
} from '@lotg/engine';
import {
  CommandSchema,
  PROTOCOL_VERSION,
  ViewStateSchema,
  GameEventSchema,
  type ViewState,
  type Command,
} from './index';
import { grantRelic } from '../../engine/src/relics';

describe('protocolo aditivo das relíquias', () => {
  it('continua 4, iguala tipos ao motor e valida a visão, as duas ordens e os três eventos', () => {
    expect(PROTOCOL_VERSION).toBe(4);
    expectTypeOf<ViewState>().toEqualTypeOf<EngineViewState>();
    expectTypeOf<Command>().toEqualTypeOf<EngineCommand>();
    const state = createInitialState('relics-protocol', {
      settlementName: 'Capela Alta',
      timezone: 'UTC',
      vigilHourLocal: 20,
      difficulty: 'lord',
      timeScale: 3,
    });
    state.settlement.buildings.chapel = 1;
    const events: Parameters<typeof grantRelic>[3] = [];
    grantRelic(state, 'oakHeart', 0, events);
    const commandId = '0b2f7d0e-6f0a-4c35-9f43-6f5a0c1d2e3f';
    const place = CommandSchema.parse({
      commandId,
      type: 'placeRelic',
      payload: { relicId: 'oakHeart' },
    });
    const placed = applyCommand(state, place, 0);
    if (!placed.ok) throw new Error(placed.message);
    const view = deriveViewState(placed.state, 0);
    expect(ViewStateSchema.parse(view)).toEqual(view);
    const oldView = Object.fromEntries(Object.entries(view).filter(([key]) => key !== 'relics'));
    expect(ViewStateSchema.parse(oldView).relics).toEqual({ slots: 0, items: [] });
    expect(view.relics.items[0]).toMatchObject({
      placed: true,
      active: false,
      effectiveInSeconds: 2_400,
    });
    const remove = CommandSchema.parse({
      commandId,
      type: 'removeRelic',
      payload: { relicId: 'oakHeart' },
    });
    const removed = applyCommand(placed.state, remove, 0);
    if (!removed.ok) throw new Error(removed.message);
    for (const [index, event] of [...events, ...placed.events, ...removed.events]
      .filter((entry) => entry.type.startsWith('relic'))
      .entries()) {
      expect(
        GameEventSchema.safeParse({ ...event, seq: index + 1, at: '2026-11-18T00:00:00.000Z' })
          .success,
      ).toBe(true);
    }
    expect(
      CommandSchema.safeParse({ commandId, type: 'grantRelic', payload: { relicId: 'oakHeart' } })
        .success,
    ).toBe(false);
    expect(
      CommandSchema.safeParse({
        commandId,
        type: 'placeRelic',
        payload: { relicId: 'oakHeart', effectiveFromMs: 0 },
      }).success,
    ).toBe(false);
    expect(
      ViewStateSchema.safeParse({ ...view, relics: { ...view.relics, slots: -1 } }).success,
    ).toBe(false);
  });
});
