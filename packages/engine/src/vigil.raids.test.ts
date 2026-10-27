import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { nextRehearsalMarkAt } from './raids';
import { gameAt, HOUR } from './test-helpers';
import { vigilAt } from './vigil';

const id = 'raidersYear1Rehearsal';
const start = 120 * HOUR;

describe('o ensaio na Vigília (V4G-T1.3)', () => {
  it.each([0.5, 1, 3])('marca e resolve no instante exato nos três fusos, ritmo %s', (pace) => {
    for (const offset of [-180, 0, 540]) {
      const initial = gameAt(start - HOUR, (draft) => {
        draft.settings.timeScale = pace;
        draft.settings.realOriginMs = Date.UTC(2026, 9, 27, 13, 17, 42, 333);
        draft.settings.vigil = { hourLocal: 20, utcOffsetMinutes: offset, timezoneResolved: true };
        draft.horde.scheduledRaids = [];
        draft.map.threat = 0;
      });
      const arrivesAt = vigilAt(initial.settings, start);
      const markAt = arrivesAt - 6 * HOUR;
      expect(nextRehearsalMarkAt(initial)).toBe(markAt);
      const beforeMark = advanceTo(initial, markAt - 1);
      expect(beforeMark.state.horde.scheduledRaids.some((raid) => raid.id === id)).toBe(false);
      const marked = advanceTo(beforeMark.state, markAt);
      expect(marked.state.horde.scheduledRaids.find((raid) => raid.id === id)?.atMs).toBe(
        arrivesAt,
      );
      const beforeArrival = advanceTo(marked.state, arrivesAt - 1);
      expect(beforeArrival.events.some((event) => event.type === 'battleFought')).toBe(false);
      const arrived = advanceTo(beforeArrival.state, arrivesAt);
      expect(
        arrived.events.some((event) => event.type === 'battleFought' && event.atMs === arrivesAt),
      ).toBe(true);
      expect(arrived.state.horde.scheduledRaids.some((raid) => raid.id === id)).toBe(false);
      const direct = advanceTo(initial, arrivesAt);
      expect(arrived.state).toEqual(direct.state);
      expect([
        ...beforeMark.events,
        ...marked.events,
        ...beforeArrival.events,
        ...arrived.events,
      ]).toEqual(direct.events);
      expect(nextRehearsalMarkAt(arrived.state)).toBeNull();
    }
  });

  it('um estado que começa dentro da antecedência não depende do primeiro corte', () => {
    // Regressão da propriedade: um corte de observação nunca marca tardiamente o ensaio.
    // A marcação tardia é exclusiva da ordem que acabou de mudar a preferência.
    const start = gameAt(135 * HOUR, (draft) => {
      draft.horde.scheduledRaids = [];
    });
    const direct = advanceTo(start, 139 * HOUR);
    const first = advanceTo(start, 135 * HOUR + 1);
    const second = advanceTo(first.state, 139 * HOUR);
    expect(second.state).toEqual(direct.state);
    expect([...first.events, ...second.events]).toEqual(direct.events);
  });

  it('uma incursão antiga marcada mantém o prazo, mesmo com a nova conta', () => {
    const state = gameAt(start - HOUR, (draft) => {
      draft.horde.scheduledRaids = [
        {
          id,
          atMs: start,
          kind: 'scripted',
          enemy: 'horde',
          size: 'strong',
          announcedAtMs: null,
          composition: null,
        },
      ];
    });
    expect(nextRehearsalMarkAt(state)).toBeNull();
    expect(
      advanceTo(state, start).events.some((e) => e.type === 'battleFought' && e.atMs === start),
    ).toBe(true);
  });
});
