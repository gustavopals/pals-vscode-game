import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, currentShape, migrateState } from './migrations';
import { stateV43 } from './migrations/v43';
import { revealWaveThree } from './hordePlan';
import { mapBeforeGrid, gameAt, HOUR, YEAR, newGame } from './test-helpers';
import { siegeYard } from './siege.test-helpers';

describe('Fase C: passo 43 → 44', () => {
  it('acrescenta memória nula sem mudar gerador, ids ou prazos', () => {
    const { previousYearFormation, ...horde } = newGame().horde;
    void previousYearFormation;
    const { vows: initialVows, ...withoutVows } = newGame();
    const old = { ...withoutVows, schemaVersion: 43, horde, map: mapBeforeGrid(withoutVows.map) };
    const before = JSON.stringify(old);
    expect(stateV43(old, '')).toBeNull();
    const migrated = migrateState(old, { timeScale: 1 });
    expect(migrated).toEqual({
      ...old,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      map: newGame().map,
      vows: initialVows,
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

  it.each([0.5, 1, 3])(
    'usa a fronteira e o ritmo gravado %s para a janela, sem efeitos retroativos',
    (pace) => {
      const fresh = gameAt(YEAR + HOUR);
      fresh.settings.timeScale = pace;
      const { vows, ...withoutVows } = fresh;
      const { previousYearFormation, ...horde } = withoutVows.horde;
      void vows;
      void previousYearFormation;
      const old = {
        ...withoutVows,
        horde,
        map: mapBeforeGrid(fresh.map),
        schemaVersion: 43,
        migratedAtMs: 0,
      };
      const before = JSON.stringify(old);
      const migrated = migrateState(old, { timeScale: 7 });
      expect(migrated.vows).toEqual({
        year: 2,
        taken: [],
        nextTaken: null,
        closesAtMs: YEAR + 24 * HOUR * pace,
      });
      expect(migrated.migratedAtMs).toBe(YEAR + HOUR);
      expect(migrated.rng).toEqual(fresh.rng);
      expect(migrated.ids).toEqual(fresh.ids);
      expect(JSON.stringify(old)).toBe(before);
    },
  );

  it('recusa Votos repetidos, desconhecidos, de outro ano ou já impostos', () => {
    const state = newGame();
    expect(
      currentShape({ ...state, vows: { ...state.vows, taken: ['noWalls', 'noWalls'] } }, ''),
    ).toMatch(/repetidos/);
    expect(
      currentShape({ ...state, vows: { ...state.vows, taken: ['missing'] } }, ''),
    ).not.toBeNull();
    expect(currentShape({ ...state, vows: { ...state.vows, year: 2 } }, '')).toMatch(
      /ano diferente/,
    );
    expect(currentShape({ ...state, vows: { ...state.vows, nextTaken: [] } }, '')).toMatch(
      /rescaldo/,
    );
    state.settings.difficulty = 'ironKing';
    expect(
      currentShape({ ...state, vows: { ...state.vows, taken: ['mortalHeroes'] } }, ''),
    ).toMatch(/já imposto/);
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
