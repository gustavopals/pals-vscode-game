import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  createInitialState,
  deriveViewState,
  applyCommand,
  type ViewState as EngineViewState,
  type Command as EngineCommand,
} from '@lotg/engine';
import { YearEndedDataSchema } from '@lotg/content';
import {
  CommandSchema,
  PROTOCOL_VERSION,
  ViewStateSchema,
  GameEventSchema,
  type ViewState,
  type Command,
} from './index';

describe('Votos no protocolo 4 por adição', () => {
  it('iguala os tipos, aceita takeVows e dá bloco vazio aos caches anteriores', () => {
    expect(PROTOCOL_VERSION).toBe(4);
    expectTypeOf<ViewState>().toEqualTypeOf<EngineViewState>();
    expectTypeOf<Command>().toEqualTypeOf<EngineCommand>();
    const state = createInitialState('vows-protocol', {
      settlementName: 'Casa dos Votos',
      timezone: 'UTC',
      vigilHourLocal: 20,
      difficulty: 'lord',
      timeScale: 3,
    });
    const view = deriveViewState(state, 0);
    expect(ViewStateSchema.parse(view)).toEqual(view);
    expect(view.vows.offer).toHaveLength(4);
    const oldView = Object.fromEntries(Object.entries(view).filter(([key]) => key !== 'vows'));
    expect(ViewStateSchema.parse(oldView).vows).toEqual({
      offer: [],
      taken: [],
      closesInSeconds: 0,
    });
    const order = CommandSchema.parse({
      commandId: '0b2f7d0e-6f0a-4c35-9f43-6f5a0c1d2e3f',
      type: 'takeVows',
      payload: { vows: ['scarceFood'] },
    });
    const result = applyCommand(state, order, 0);
    if (!result.ok) throw new Error(result.message);
    for (const event of result.events)
      expect(
        GameEventSchema.safeParse({ ...event, seq: 1, at: '2026-11-19T00:00:00.000Z' }).error,
      ).toBeUndefined();
    expect(deriveViewState(result.state, 0).pendingDecisions).toEqual(view.pendingDecisions);
    const unknown = CommandSchema.parse({ ...order, payload: { vows: ['unknown-vow'] } });
    expect(applyCommand(state, unknown, 0)).toMatchObject({ ok: false, code: 'VOW_UNAVAILABLE' });
  });

  it('lê yearEnded antigo sem campos novos e o novo com Legado', () => {
    const old = {
      year: 1,
      populationMax: 5,
      battles: 0,
      battlesWon: 0,
      expeditions: 0,
      cards: 0,
      siegeResult: 'none',
      score: 5,
      feats: '',
    };
    expect(YearEndedDataSchema.parse(old)).toEqual(old);
    expect(YearEndedDataSchema.parse({ ...old, vows: 'scarceFood', legacy: 6 }).legacy).toBe(6);
  });
});
