import { describe, expect, it } from 'vitest';

import { CommandSchema } from './commands';

const order = {
  commandId: '10000000-0000-4000-8000-000000000001',
  type: 'setVigilHour',
  payload: { hourLocal: 20, timezone: 'UTC' },
};

describe('ordem da Hora da Vigília', () => {
  it('recebe só hora e fuso; o offset é calculado no servidor', () => {
    expect(CommandSchema.parse(order)).toEqual(order);
    for (const extra of [
      { utcOffsetMinutes: -180 },
      { timezoneResolved: true },
      { resolvedVigil: {} },
    ]) {
      expect(
        CommandSchema.safeParse({ ...order, payload: { ...order.payload, ...extra } }).success,
      ).toBe(false);
    }
  });
});
