import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { currentShape, migrateState } from './migrations';
import { stateV34, v34ToV35 } from './migrations/v34';
import { DAY, WINTER } from './test-helpers';
import { deriveViewState } from './view';

const fixtures = import.meta.glob<string>('./__fixtures__/state-v34-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('34 → 35: origem real e Vigília', () => {
  it.each(Object.entries(fixtures))(
    '%s: só acrescenta contexto civil, sem prazo ou sorteio',
    (_, raw) => {
      const before = JSON.parse(raw) as Record<string, unknown>;
      const input = JSON.stringify(before);
      const context = {
        timeScale: 1,
        realOriginMs: 1_792_100_123_456,
        utcOffsetMinutes: -180,
        timezoneResolved: true,
      };
      const after = v34ToV35.migrate(before, {
        ...context,
        boundaryMs: before.lastProcessedAt as number,
      });
      expect(stateV34(before, '')).toBeNull();
      expect(currentShape(after, '')).toBeNull();
      expect(after).toEqual({
        ...before,
        schemaVersion: 35,
        settings: {
          ...(before.settings as object),
          realOriginMs: context.realOriginMs,
          vigil: {
            hourLocal: (before.settings as { vigilHourLocal: number }).vigilHourLocal,
            utcOffsetMinutes: -180,
            timezoneResolved: true,
          },
        },
      });
      expect(JSON.stringify(before)).toBe(input);
      expect(migrateState(after, context)).toBe(after);
    },
  );

  it.each([null, DAY])(
    'não marca nada numa fronteira no inverno, migratedAtMs %s',
    (migratedAtMs) => {
      const before = JSON.parse(fixtures['./__fixtures__/state-v34-fresh.json']!) as Record<
        string,
        unknown
      >;
      before.lastProcessedAt = WINTER + DAY / 2;
      before.clock = { gameTimeMs: before.lastProcessedAt, year: 1, yearStartMs: 0 };
      before.migratedAtMs = migratedAtMs;
      const after = migrateState(before, { timeScale: 1, realOriginMs: 1000 });
      expect(after.horde.scheduledRaids).toEqual(
        (before.horde as object as { scheduledRaids: unknown }).scheduledRaids,
      );
      expect(after.settings.realOriginMs).toBe(1000);
      expect(after.migratedAtMs).toBe(before.lastProcessedAt);
      expect(
        advanceTo(after, after.lastProcessedAt + 1).events.filter((e) =>
          /vigil|siege/i.test(e.type),
        ),
      ).toEqual([]);
    },
  );

  it('fallback UTC é explícito na visão; a guarda recusa hora, offset, origem e campos extras', () => {
    const state = migrateState(JSON.parse(fixtures['./__fixtures__/state-v34-fresh.json']!), {
      timeScale: 1,
    });
    expect(state.settings.vigil).toEqual({
      hourLocal: state.settings.vigilHourLocal,
      utcOffsetMinutes: 0,
      timezoneResolved: false,
    });
    expect(deriveViewState(state, state.lastProcessedAt).settlement.vigil.warning).toContain('UTC');
    for (const edit of [
      { realOriginMs: 0.5 },
      { realOriginMs: null },
      { vigil: { ...state.settings.vigil, hourLocal: 24 } },
      { vigil: { ...state.settings.vigil, hourLocal: 1 } },
      { vigil: { ...state.settings.vigil, utcOffsetMinutes: 841 } },
      { vigil: { ...state.settings.vigil, utcOffsetMinutes: -180 } },
      { vigil: { ...state.settings.vigil, extra: true } },
      { extra: true },
    ])
      expect(
        currentShape({ ...state, settings: { ...state.settings, ...edit } }, ''),
      ).not.toBeNull();
  });
});
