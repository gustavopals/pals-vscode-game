import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { CURRENT_SCHEMA_VERSION, currentShape, migrateState } from './migrations';
import { stateV42 } from './migrations/v42';
import { stateV41 } from './migrations/v41';
import { cloneState, createInitialState } from './state';
import { DAY, settings } from './test-helpers';

const fixtures = import.meta.glob<string>('./__fixtures__/state-v41-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const currentFixtures = import.meta.glob<string>('./__fixtures__/state-v42-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('versão 41 → 42: prazos das expedições liberadas por carta', () => {
  it('os 63 retratos novos têm a forma v42, incluindo a janela ativa', () => {
    expect(Object.keys(currentFixtures)).toHaveLength(63);
    for (const [name, text] of Object.entries(currentFixtures)) {
      const state = JSON.parse(text);
      expect(stateV42(state, ''), name).toBeNull();
      const migrated = migrateState(state, { timeScale: state.settings.timeScale });
      expect(migrateState(migrated, { timeScale: migrated.settings.timeScale })).toBe(migrated);
    }
  });

  it('migra todos os retratos v41 sem criar prazo, destino, sorteio ou identidade', () => {
    expect(Object.keys(fixtures)).toHaveLength(62);
    for (const text of Object.values(fixtures)) {
      const before = JSON.parse(text);
      const after = migrateState(before, { timeScale: before.settings.timeScale });
      expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(after.map.expeditionUnlocks).toEqual({});
      expect(after).toEqual({
        ...before,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settlement: {
          ...before.settlement,
          buildings: { ...before.settlement.buildings, chapel: 0 },
          relics: [],
        },
        migratedAtMs: before.lastProcessedAt,
        map: { ...before.map, expeditionUnlocks: {} },
      });
      expect(JSON.stringify(before)).toBe(JSON.stringify(JSON.parse(text)));
      expect(migrateState(after, { timeScale: after.settings.timeScale })).toBe(after);
      expect(currentShape(after, '')).toBeNull();
    }
  });

  it.each([null, 1234])('não reconta prazo na fronteira com migratedAtMs %s', (migratedAtMs) => {
    const before = JSON.parse(
      Object.entries(fixtures).find(([name]) => name.endsWith('-fresh.json'))![1],
    );
    before.lastProcessedAt += 30 * DAY;
    before.migratedAtMs = migratedAtMs;
    const after = migrateState(before, { timeScale: before.settings.timeScale });
    expect(after.map.expeditionUnlocks).toEqual({});
    const advanced = advanceTo(after, after.lastProcessedAt + 1);
    expect(advanced.state.map.expeditionUnlocks).toEqual({});
    expect(advanced.events.some((event) => event.data.modelId === 'whiteWolfHunt')).toBe(false);
  });

  it('confere campo ausente, id desconhecido, prazo fracionário/negativo e destino sem prazo', () => {
    const state = createInitialState('lobo-guarda', settings);
    expect(state.map.expeditionUnlocks).toEqual({});
    expect(currentShape(state, '')).toBeNull();
    const old = JSON.parse(JSON.stringify(state));
    delete old.map.expeditionUnlocks;
    old.schemaVersion = 41;
    delete old.settlement.relics;
    delete old.settlement.buildings.chapel;
    expect(stateV41(old, '')).toBeNull();
    expect(stateV41({ ...state, schemaVersion: 41 }, '')).not.toBeNull();
    for (const invalid of [
      undefined,
      [],
      { missing: DAY },
      { whiteWolfHunt: -1 },
      { whiteWolfHunt: 0.5 },
      { whiteWolfHunt: NaN },
      { whiteWolfHunt: Infinity },
    ]) {
      const broken = cloneState(state);
      Object.assign(broken.map, { expeditionUnlocks: invalid });
      expect(currentShape(broken, ''), String(invalid)).not.toBeNull();
    }
    state.map.discovered.push('whiteWolfHunt');
    expect(currentShape(state, '')).not.toBeNull();
    state.map.expeditionUnlocks.whiteWolfHunt = DAY;
    expect(currentShape(state, '')).toBeNull();
    state.map.discovered = [];
    expect(currentShape(state, '')).not.toBeNull();
  });
});
