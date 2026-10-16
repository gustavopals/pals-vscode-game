import { describe, expect, it } from 'vitest';

import { simulate } from '../simulate';

/**
 * O ferro no simulador (V4B-T1.8): o Explorador acha a Mina Abandonada pela Floresta Antiga, manda
 * a equipe quando a conhece e vende todo o ferro que trouxe (até o Ferreiro, V4B-T2, o ferro não
 * tem uso). O CSV traz a coluna `iron`.
 */
describe('o ferro do Explorador (V4B-T1.8)', () => {
  it('acha a Mina, traz ferro e o vende no Mercado', async () => {
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      timeScale: 3,
      strategy: 'explorador',
      sessionsPerDay: 2,
    });
    const { finalState, rows } = result;
    expect(finalState.map.discovered).toContain('abandonedMine');
    expect(Math.max(...rows.map((row) => row.stock.iron))).toBeGreaterThan(0);
    expect(finalState.stats.sold_iron ?? 0).toBeGreaterThan(0);
    expect(finalState.settlement.resources.iron).toBe(0);
  });
});
