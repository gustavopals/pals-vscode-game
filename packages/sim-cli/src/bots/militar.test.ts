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

  it('o militar é o econômico com o Ferreiro, a forja e a formação', async () => {
    const names = militarPolicies.map((policy) => policy.name);
    expect(names.slice(0, 2)).toEqual(['erguer o Ferreiro', 'forjar armas']);
    expect(names.at(-1)).toBe('montar a formação');
    expect(names).toHaveLength(economicoPolicies.length + 3);
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      timeScale: 3,
      strategy: 'militar',
      sessionsPerDay: 2,
    });
    expect(result.finalState.settlement.buildings.smithy).toBeGreaterThan(0);
    expect(result.rows.at(-1)?.soldiers).toBeGreaterThan(0);
    // A formação do bot: monta com o que tem e a ativa, sem comandante (V4C-T2).
    const { formations, activeFormationId } = result.finalState.army;
    expect(formations).toHaveLength(1);
    expect(activeFormationId).toBe(formations[0]?.id);
    expect(Object.values(formations[0]?.commanders ?? {}).every((id) => id === null)).toBe(true);
  });

  it('o econômico não monta formação: ela é do militar', async () => {
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      timeScale: 3,
      strategy: 'economico',
      sessionsPerDay: 2,
    });
    expect(result.finalState.army.formations).toEqual([]);
  });
});
