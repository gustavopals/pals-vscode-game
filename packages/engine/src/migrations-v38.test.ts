import { describe, expect, it } from 'vitest';

import { currentShape, migrateState, StateMigrationError } from './migrations';
import { stateV38 } from './migrations/v38';
import { stateV37, v37ToV38 } from './migrations/v37';
import { quietGame } from './test-helpers';

const fixtures = import.meta.glob<string>('./__fixtures__/state-v37-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('37 → 38: contadores de sabotagem da Fortaleza (V4F-T1.2)', () => {
  it.each(Object.entries(fixtures))(
    '%s: só acrescenta horde.sabotages zerado, sem sortear ou criar prazo',
    (_, raw) => {
      const before = JSON.parse(raw);
      expect(stateV37(before, '')).toBeNull();
      const after = v37ToV38.migrate(before, { timeScale: 1, boundaryMs: before.lastProcessedAt });
      expect(after).toEqual({
        ...before,
        schemaVersion: 38,
        horde: {
          ...before.horde,
          sabotages: { attempts: 0, successes: 0, alerted: false },
        },
      });
      // O passo termina na v38; a campanha só entra no passo seguinte, sem mudar esta prova.
      expect(stateV38(after, '')).toBeNull();
      expect(JSON.stringify(before)).toBe(JSON.stringify(JSON.parse(raw)));
      const loaded = migrateState(before, { timeScale: 1 });
      expect(currentShape(loaded, '')).toBeNull();
      expect(loaded.migratedAtMs).toBe(before.lastProcessedAt);
      expect(migrateState(loaded, { timeScale: 1 })).toBe(loaded);
    },
  );

  it('recusa contadores ausentes ou com formato inválido', () => {
    const state = quietGame();
    expect(currentShape(state, '')).toBeNull();

    for (const bad of [
      { ...state, horde: { ...state.horde, sabotages: null } },
      {
        ...state,
        horde: { ...state.horde, sabotages: { attempts: -1, successes: 0, alerted: false } },
      },
      {
        ...state,
        horde: { ...state.horde, sabotages: { attempts: 0, successes: -1, alerted: false } },
      },
      {
        ...state,
        horde: { ...state.horde, sabotages: { attempts: 0, successes: 0, alerted: 'yes' } },
      },
      {
        ...state,
        horde: {
          ...state.horde,
          sabotages: { attempts: 0, successes: 0, alerted: false, extra: 1 },
        },
      },
    ]) {
      expect(currentShape(bad, '')).not.toBeNull();
      expect(() => migrateState(bad, { timeScale: 1 })).toThrow(StateMigrationError);
    }

    const missing = JSON.parse(JSON.stringify(state));
    delete missing.horde.sabotages;
    expect(currentShape(missing, '')).not.toBeNull();
    expect(() => migrateState(missing, { timeScale: 1 })).toThrow(StateMigrationError);
  });
});
