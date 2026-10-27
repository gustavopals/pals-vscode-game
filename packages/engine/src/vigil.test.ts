import { describe, expect, it } from 'vitest';

import { vigilAt, type VigilClock } from './vigil';

const HOUR = 3_600_000;
const origin = Date.UTC(2026, 9, 27, 13);
const clock = (timeScale: number, utcOffsetMinutes: number, hourLocal = 20): VigilClock => ({
  realOriginMs: origin,
  timeScale,
  vigil: { hourLocal, utcOffsetMinutes },
});

/** Cálculo independente: percorre as horas UTC, com Date só no teste. */
function independent(settings: VigilClock, start: number): number {
  const minimumReal = settings.realOriginMs + (start + 6 * HOUR) / settings.timeScale;
  const endReal = settings.realOriginMs + (start + 24 * HOUR) / settings.timeScale;
  for (let real = Math.ceil(minimumReal / HOUR) * HOUR; real < endReal; real += HOUR) {
    const local = new Date(real + settings.vigil.utcOffsetMinutes * 60_000);
    if (local.getUTCHours() === settings.vigil.hourLocal && local.getUTCMinutes() === 0) {
      return Math.ceil((real - settings.realOriginMs) * settings.timeScale);
    }
  }
  return start + 12 * HOUR;
}

describe('a conta pura da Vigília', () => {
  it.each([0.5, 1, 3])('confere cada hora nos três fusos, ritmo %s', (pace) => {
    for (const offset of [-180, 0, 540]) {
      for (let hour = 0; hour < 24; hour += 1) {
        for (const start of [120 * HOUR, 144 * HOUR, 312 * HOUR]) {
          const settings = clock(pace, offset, hour);
          const before = structuredClone(settings);
          expect(vigilAt(settings, start)).toBe(independent(settings, start));
          expect(settings).toEqual(before);
          expect(Number.isSafeInteger(vigilAt(settings, start))).toBe(true);
        }
      }
    }
  });

  it('inclui a Vigília exatamente em +6 h e exclui a do fim da janela', () => {
    expect(vigilAt(clock(1, 0, 19), 0)).toBe(6 * HOUR);
    expect(vigilAt(clock(1, 0, 13), 0)).toBe(12 * HOUR);
  });

  it('usa +12 h quando não cabe uma Vigília e cruza a meia-noite com offset negativo', () => {
    expect(vigilAt(clock(3, -180, 20), 0)).toBe(12 * HOUR);
    expect(vigilAt(clock(1, -180, 0), 0)).toBe(14 * HOUR);
  });

  it('aceita offset fracionado em horas, origem com milissegundos e época negativa', () => {
    for (const realOriginMs of [origin + 1, -13 * HOUR - 17]) {
      const settings = { ...clock(0.5, 345), realOriginMs };
      const at = vigilAt(settings, 0);
      expect(at).toBeGreaterThanOrEqual(6 * HOUR);
      expect(Number.isSafeInteger(at)).toBe(true);
      const local = realOriginMs + at / settings.timeScale + 345 * 60_000;
      const date = new Date(local);
      expect(date.getUTCHours()).toBe(20);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCMilliseconds()).toBeLessThanOrEqual(1);
    }
  });
});
