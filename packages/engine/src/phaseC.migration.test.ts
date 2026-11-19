import { describe, expect, it } from 'vitest';
import { currentShape, migrateState } from './migrations';
import { stateV43 } from './migrations/v43';
import { revealWaveThree } from './hordePlan';
import { newGame } from './test-helpers';
import { siegeYard } from './siege.test-helpers';

describe('Fase C: passo 43 → 44', () => {
  it('acrescenta memória nula sem mudar gerador, ids ou prazos', () => {
    const { previousYearFormation, ...horde } = newGame().horde;
    void previousYearFormation;
    const old = { ...newGame(), schemaVersion: 43, horde };
    const before = JSON.stringify(old);
    expect(stateV43(old, '')).toBeNull();
    const migrated = migrateState(old, { timeScale: 1 });
    expect(migrated).toEqual({
      ...old,
      schemaVersion: 44,
      migratedAtMs: 0,
      horde: { ...horde, previousYearFormation: null },
    });
    expect(JSON.stringify(old)).toBe(before);
    expect(migrateState(migrated, { timeScale: 1 })).toBe(migrated);
  });

  it('valida memória e ondas que ultrapassam o teto histórico', () => {
    const state = siegeYard('ironKing', 1, 8);
    expect(currentShape(state, '')).toBeNull();
    state.horde.previousYearFormation = { total: 20, byUnit: { archer: 19 } };
    expect(currentShape(state, '')).toMatch(/previousYearFormation/);
    state.horde.previousYearFormation = { total: 20, byUnit: { archer: 20 } };
    expect(currentShape(state, '')).toBeNull();
    state.horde.wavePlan!.waves[0]!.composition[0]!.count = 1000;
    expect(currentShape(state, '')).toMatch(/tamanho máximo/);
  });

  it('não esconde divergência do presságio ao validar ondas grandes', () => {
    const state = siegeYard('ironKing', 1, 8);
    revealWaveThree(state, state.lastProcessedAt, []);
    const before = JSON.stringify(state);
    expect(currentShape(state, '')).toBeNull();
    expect(JSON.stringify(state)).toBe(before);
    state.horde.omens[0]!.reveals[0]!.count += 1;
    expect(currentShape(state, '')).toMatch(/contagem difere/);
  });
});
