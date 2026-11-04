import { describe, expect, it } from 'vitest';

import { currentShape, migrateState } from './migrations';
import { createInitialState } from './state';
import { settings } from './test-helpers';

const frozen = import.meta.glob<string>('./__fixtures__/state-v40-smithy-forging.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const old = () => JSON.parse(Object.values(frozen)[0]!);

describe('passo 40 → 41 do lote 3', () => {
  it('preserva lote, prazos, gerador e identidades, sem alterar a entrada', () => {
    const before = old();
    const frozen = JSON.stringify(before);
    const state = migrateState(before, { timeScale: 1 });
    expect(state.schemaVersion).toBe(42);
    expect(state.council.bonuses).toEqual({
      smithySpeed: null,
      smithyBatch: null,
      repairDiscount: null,
      revealedRaidId: null,
    });
    expect(state.settlement.forge).toEqual(before.settlement.forge);
    expect(state.rng).toEqual(before.rng);
    expect(state.ids).toEqual(before.ids);
    expect(state.migratedAtMs).toBe(before.lastProcessedAt);
    expect(JSON.stringify(before)).toBe(frozen);
    expect(migrateState(state, { timeScale: 1 })).toBe(state);
  });

  it('confere o estado inicial e recusa bônus e rendimento fora da forma', () => {
    const state = createInitialState('lote3-guarda', settings);
    expect(currentShape(state, '')).toBeNull();
    state.council.bonuses.smithyBatch = { extra: 11, untilMs: 1 };
    expect(currentShape(state, '')).toContain('bônus acima do limite');
    state.council.bonuses.smithyBatch = null;
    state.settlement.forge = { kind: 'weapons', amount: 10, extra: 1, startedAtMs: 0, endsAtMs: 1 };
    expect(currentShape(state, '')).toContain('rendimento inválido');
  });
});
