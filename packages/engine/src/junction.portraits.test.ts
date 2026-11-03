import { describe, expect, it } from 'vitest';

import { currentShape, migrateState } from './migrations';
import type { StoredState } from './migrations/step';

const portraits = import.meta.glob<string>('./__fixtures__/state-v*-market-council-effects.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('terceira junção: retratos congelados do Mercado', () => {
  it.each([39, 40])('migra a variante histórica v%s sem reescrever seu retrato', (version) => {
    const raw = portraits[`./__fixtures__/state-v${version}-market-council-effects.json`]!;
    const before = JSON.parse(raw) as StoredState;
    const effects = (before.market as StoredState).effects as StoredState[];
    const migrated = migrateState(before, { timeScale: 1 });
    expect(currentShape(migrated, '')).toBeNull();
    expect(migrated.market.effects).toEqual(
      effects.map((effect) => ({ ...effect, fromMs: before.lastProcessedAt })),
    );
    expect(JSON.stringify(before)).toBe(JSON.stringify(JSON.parse(raw)));
    const invalid = structuredClone(before);
    ((invalid.market as StoredState).effects as StoredState[])[0]!.factor = { num: -1, den: 10 };
    expect(() => migrateState(invalid, { timeScale: 1 })).toThrow(/factor/);
    const missing = structuredClone(migrated);
    delete (missing.market.effects[0] as unknown as StoredState).fromMs;
    expect(() => migrateState(missing, { timeScale: 1 })).toThrow(/fromMs/);
  });
});
