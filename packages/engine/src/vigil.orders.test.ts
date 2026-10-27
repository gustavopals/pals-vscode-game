import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { currentShape } from './migrations';
import { nextRehearsalMarkAt } from './raids';
import { command, gameAt, HOUR, newGame } from './test-helpers';
import type { GameState } from './types';
import { vigilAt } from './vigil';

function change(state: GameState, hourLocal: number, timezone = 'Asia/Tokyo', offset = 540) {
  const result = applyCommand(
    state,
    command('setVigilHour', { hourLocal, timezone }),
    state.lastProcessedAt,
    {
      vigil: { utcOffsetMinutes: offset, timezoneResolved: true },
    },
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  expect(currentShape(result.state, '')).toBeNull();
  return result;
}

describe('mudar a Vigília (V4G-T1.4)', () => {
  it('muda hora e fuso só para o que ainda não foi marcado, sem RNG, id ou custo', () => {
    const before = newGame();
    const copy = JSON.stringify(before);
    const after = change(before, 3);
    expect(before.settings.vigil.hourLocal).toBe(20);
    expect(JSON.stringify(before)).toBe(copy);
    expect(after.state.settings.timezone).toBe('Asia/Tokyo');
    expect(after.state.settings.vigil).toEqual({
      hourLocal: 3,
      utcOffsetMinutes: 540,
      timezoneResolved: true,
    });
    expect(nextRehearsalMarkAt(after.state)).not.toBe(nextRehearsalMarkAt(before));
    expect(after.state.horde.scheduledRaids).toEqual(before.horde.scheduledRaids);
    expect(after.state.rng).toEqual(before.rng);
    expect(after.state.ids).toEqual(before.ids);
    expect(after.state.settlement.resources).toEqual(before.settlement.resources);
    expect(after.events.map((event) => event.type)).toContain('vigilChanged');
  });

  it('marca agora se a nova preferência ainda é futura, mas a antecedência já começou', () => {
    const before = gameAt(130 * HOUR, (draft) => {
      draft.horde.scheduledRaids = [];
    });
    const after = change(before, 12, 'UTC', 0).state;
    expect(
      after.horde.scheduledRaids.find((raid) => raid.id === 'raidersYear1Rehearsal')?.atMs,
    ).toBe(132 * HOUR);
    expect(after.stats.vigilRehearsalMarked).toBe(1);
  });

  it('preserva o ensaio já marcado e não o repete depois da resolução', () => {
    const before = gameAt(119 * HOUR, (draft) => {
      draft.horde.scheduledRaids = [];
    });
    const arrives = vigilAt(before.settings, 120 * HOUR);
    const marked = advanceTo(before, arrives - 6 * HOUR).state;
    const after = change(marked, 1).state;
    expect(after.horde.scheduledRaids).toEqual(marked.horde.scheduledRaids);
    expect(nextRehearsalMarkAt(after)).toBeNull();
    const done = advanceTo(after, arrives).state;
    expect(nextRehearsalMarkAt(change(done, 23, 'UTC', 0).state)).toBeNull();
  });

  it.each([-1, 24, 1.5, Number.NaN])('recusa hora %s sem efeitos', (hourLocal) => {
    const state = newGame();
    const result = applyCommand(state, command('setVigilHour', { hourLocal, timezone: 'UTC' }), 0, {
      vigil: { utcOffsetMinutes: 0, timezoneResolved: true },
    });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_VIGIL' });
    expect(state.settings.vigil.hourLocal).toBe(20);
  });

  it('não aceita offset do cliente nem contexto ausente ou fuso não resolvido', () => {
    for (const context of [
      {},
      { vigil: { utcOffsetMinutes: 0, timezoneResolved: false } },
      { vigil: { utcOffsetMinutes: 841, timezoneResolved: true } },
    ]) {
      expect(
        applyCommand(
          newGame(),
          command('setVigilHour', { hourLocal: 20, timezone: 'UTC' }),
          0,
          context,
        ),
      ).toMatchObject({ ok: false, code: 'INVALID_VIGIL' });
    }
  });
});
