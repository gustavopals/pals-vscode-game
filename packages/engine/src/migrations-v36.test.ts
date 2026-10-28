import { describe, expect, it } from 'vitest';

import { currentShape, migrateState, StateMigrationError } from './migrations';
import { stateV36 } from './migrations/v36';
import { stateV35, v35ToV36 } from './migrations/v35';
import { stateV37 } from './migrations/v37';
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
      fromMs: 0,
      untilMs: DAY,
      label: 'Carta: Boicote',
    };
    expect(currentShape({ ...state, market: { ...state.market, effects: [good] } }, '')).toBeNull();

    const goodV36 = {
      resource: 'food',
      factor: { num: 6, den: 5 },
      untilMs: DAY,
      label: 'Carta: Boicote',
    };
    const v36State = {
      ...before,
      schemaVersion: 36,
      market: { ...(before.market as object), effects: [goodV36] },
    };
    expect(stateV36(v36State, '')).toBeNull();

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

  it('stateV36 e stateV37 recusam efeitos vencidos (untilMs <= lastProcessedAt)', () => {
    const before = JSON.parse(fixtures['./__fixtures__/state-v35-fresh.json']!);
    const v36State = {
      ...before,
      schemaVersion: 36,
      lastProcessedAt: DAY,
      market: {
        ...(before.market as object),
        effects: [
          {
            resource: 'food',
            factor: { num: 6, den: 5 },
            untilMs: DAY,
            label: 'Carta: Boicote',
          },
        ],
      },
    };
    expect(stateV36(v36State, '')).toContain('efeito que já devia ter terminado');

    const v36ExpiredPast = {
      ...v36State,
      market: {
        ...(before.market as object),
        effects: [
          {
            resource: 'food',
            factor: { num: 6, den: 5 },
            untilMs: DAY - 100,
            label: 'Carta: Boicote',
          },
        ],
      },
    };
    expect(stateV36(v36ExpiredPast, '')).toContain('efeito que já devia ter terminado');

    const v37State = {
      ...v36State,
      schemaVersion: 37,
      guild: { ...(v36State.guild as object), tavern: { extraOffer: false } },
      market: {
        ...(before.market as object),
        effects: [
          {
            resource: 'food',
            factor: { num: 6, den: 5 },
            fromMs: 0,
            untilMs: DAY,
            label: 'Carta: Boicote',
          },
        ],
      },
    };
    expect(stateV37(v37State, '')).toContain('efeito que já devia ter terminado');
    expect(() => migrateState(v37State, { timeScale: 1 })).toThrow(StateMigrationError);
  });
});
