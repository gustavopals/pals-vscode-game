import { describe, expect, it } from 'vitest';
import { currentShape, migrateState } from './migrations';
import { v39ToV40 } from './migrations/v39';
import { stateV40 } from './migrations/v40';
import { newGame } from './test-helpers';

const frozen = import.meta.glob<string>('./__fixtures__/state-v39-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('Cerco: estado 39 → 40', () => {
  it.each(Object.keys(frozen))('migra %s sem prazo, sorteio ou mutação', (file) => {
    const before = JSON.parse(frozen[file]!);
    const copy = JSON.stringify(before);
    const after = v39ToV40.migrate(before, {
      timeScale: before.settings.timeScale,
      boundaryMs: before.lastProcessedAt,
    });
    expect(after).toEqual({
      ...before,
      schemaVersion: 40,
      siege: null,
      settlement: { ...before.settlement, militia: null, reconstructionUntilMs: null },
    });
    expect(stateV40(after, '')).toBeNull();
    expect(JSON.stringify(before)).toBe(copy);
    expect(migrateState(after, { timeScale: before.settings.timeScale })).toMatchObject({
      ...after,
      schemaVersion: 41,
    });
  });
  it('exige os campos novos e recusa cerco incompleto', () => {
    const state = newGame();
    expect(state.schemaVersion).toBe(41);
    expect(currentShape({ ...state, siege: {} }, '')).not.toBeNull();
    const { militia, ...settlement } = state.settlement;
    expect(militia).toBeNull();
    expect(currentShape({ ...state, settlement }, '')).not.toBeNull();
  });
});
