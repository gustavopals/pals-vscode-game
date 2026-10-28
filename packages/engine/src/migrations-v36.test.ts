import { describe, expect, it } from 'vitest';

import { currentShape, migrateState, StateMigrationError } from './migrations';
import { stateV36 } from './migrations/v36';
import { stateV35, v35ToV36 } from './migrations/v35';
import { DAY } from './test-helpers';

const fixtures = import.meta.glob<string>('./__fixtures__/state-v35-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const currentFixtures = import.meta.glob<string>('./__fixtures__/state-v36-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('35 → 36: fatores de carta no Mercado', () => {
  it.each(Object.entries(currentFixtures))(
    '%s: a recarga migra o retrato e é idempotente',
    (_, raw) => {
      const state = JSON.parse(raw);
      expect(stateV36(state, '')).toBeNull();
      const loaded = migrateState(state, { timeScale: 1 });
      expect(currentShape(loaded, '')).toBeNull();
      expect(migrateState(loaded, { timeScale: 1 })).toBe(loaded);
    },
  );
  it.each(Object.entries(fixtures))('%s: só acrescenta a lista vazia', (_, raw) => {
    const before = JSON.parse(raw) as Record<string, unknown>;
    const input = JSON.stringify(before);
    const context = { timeScale: 1, boundaryMs: before.lastProcessedAt as number };
    const after = v35ToV36.migrate(before, context);
    expect(stateV35(before, '')).toBeNull();
    expect(stateV36(after, '')).toBeNull();
    expect(after).toEqual({
      ...before,
      schemaVersion: 36,
      market: { ...(before.market as object), effects: [] },
    });
    expect(JSON.stringify(before)).toBe(input);
    const loaded = migrateState(before, context);
    expect(loaded.migratedAtMs).toBe(before.lastProcessedAt);
    expect(migrateState(loaded, context)).toBe(loaded);
  });

  it('a guarda aceita fatores vivos e recusa campos ausentes, extras, frações e recursos inválidos', () => {
    const before = JSON.parse(fixtures['./__fixtures__/state-v35-fresh.json']!);
    const state = migrateState(before, { timeScale: 1 });
    const good = {
      resource: 'food',
      factor: { num: 6, den: 5 },
      untilMs: DAY,
      label: 'Carta: Boicote',
    };
    expect(currentShape({ ...state, market: { ...state.market, effects: [good] } }, '')).toBeNull();
    for (const effects of [
      undefined,
      null,
      {},
      [null],
      [{ ...good, resource: 'gold' }],
      [{ ...good, factor: { num: 1, den: 0 } }],
      [{ ...good, factor: { num: 1.5, den: 1 } }],
      [{ ...good, factor: { num: -1, den: 1 } }],
      [{ ...good, untilMs: -1 }],
      [{ ...good, untilMs: 0.5 }],
      [{ ...good, label: '' }],
      [{ ...good, extra: true }],
    ]) {
      const invalid = { ...state, market: { ...state.market, effects } };
      expect(currentShape(invalid, '')).not.toBeNull();
      expect(() => migrateState(invalid, { timeScale: 1 })).toThrow(StateMigrationError);
    }
  });
});
