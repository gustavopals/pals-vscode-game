import { describe, expect, it } from 'vitest';

import { toCsv } from '../report';
import { simulate } from '../simulate';
import { economicoPolicies } from './economico';
import { militarPolicies } from './militar';

/**
 * A guerra no simulador (V4C-T1.8; decisão 25 do ADR 0019): a política mínima do econômico e o
 * bot `militar`.
 */
describe('os bots na guerra (V4C-T1.8)', () => {
  it('o econômico ergue o Quartel e treina Lanceiros e Arqueiros sem pôr o feudo com fome', async () => {
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      timeScale: 3,
      strategy: 'economico',
      sessionsPerDay: 2,
    });
    const last = result.rows.at(-1);
    expect(result.finalState.settlement.buildings.barracks).toBe(1);
    expect(last?.soldiers).toBeGreaterThan(0);
    expect(last?.soldiersByUnit.swordsman).toBeUndefined();
    expect(last?.trainingBatches).toBeGreaterThan(0);
    expect(last?.armyFood).toBeGreaterThan(0);
    expect(result.rows.some((row) => row.famine)).toBe(false);
    // Nem o Ferreiro, que é do militar.
    expect(result.finalState.settlement.buildings.smithy).toBe(0);
  });

  it('o CSV traz as colunas do exército', async () => {
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 1,
      timeScale: 3,
      strategy: 'militar',
      sessionsPerDay: 2,
    });
    const header = toCsv(result.rows).split('\n')[0]?.split(',') ?? [];
    for (const name of ['soldiers', 'soldiers_by_unit', 'training_batches', 'army_food']) {
      expect(header).toContain(name);
    }
  });

  it('o militar é o econômico com o Ferreiro e a forja', async () => {
    const names = militarPolicies.map((policy) => policy.name);
    expect(names.slice(0, 2)).toEqual(['erguer o Ferreiro', 'forjar armas']);
    expect(names).toHaveLength(economicoPolicies.length + 2);
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      timeScale: 3,
      strategy: 'militar',
      sessionsPerDay: 2,
    });
    expect(result.finalState.settlement.buildings.smithy).toBeGreaterThan(0);
    expect(result.rows.at(-1)?.soldiers).toBeGreaterThan(0);
  });
});
