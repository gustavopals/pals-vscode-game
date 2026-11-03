import {
  applyCommand,
  createInitialState,
  deriveEngineViewState as deriveViewState,
  type Command,
  type GameState,
} from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { simulate } from '../simulate';
import { toCsv } from '../report';
import { erguerFerreiro, forjarArmas } from './policies';
import type { Act } from './types';

/**
 * O Ferreiro no simulador (V4B-T2.6): a política de erguê-lo só age depois do Quartel (Fase C) e
 * por isso fica inerte; a de forjar age com o Ferreiro de pé. O CSV traz a coluna `weapons`.
 */
describe('o Ferreiro do Explorador (V4B-T2.6)', () => {
  it('a partida do Explorador não ergue o Ferreiro nem forja (ele é do militar), e o CSV traz weapons', async () => {
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      timeScale: 3,
      strategy: 'explorador',
      sessionsPerDay: 2,
    });
    expect(result.finalState.settlement.buildings.smithy).toBe(0);
    // V4H-T3: a arma vem do objetivo 18, sem Ferreiro nem forja. A matriz e o impacto
    // estão em docs/balance-v0.4.md, seção 16 (junção com a Vigília e a Fortaleza sem Ameaça).
    expect(result.finalState.objectives.completed).toContain('trainTenSoldiers');
    expect(result.finalState.settlement.weapons).toBe(1);
    expect(result.rows.every((row) => row.weapons === 0 || row.weapons === 1)).toBe(true);
    expect(result.events.filter((event) => event.type === 'weaponsForged')).toEqual([]);
    const header = toCsv(result.rows).split('\n')[0]?.split(',') ?? [];
    expect(header).toContain('weapons');
    expect(header).toContain('smithy');
  });

  it('forjar armas põe o maior lote que o estoque paga, uma vez, e não faz nada sem Ferreiro', async () => {
    const stall: GameState = createInitialState('ferreiro', {
      settlementName: 'Pedra Alta',
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 20,
      difficulty: 'lord',
      timeScale: 1,
    });
    stall.settlement.buildings.townHall = 4;
    stall.settlement.buildings.smithy = 1;
    stall.settlement.resources.iron = 100_000;
    stall.settlement.resources.wood = 100_000;
    let state = stall;
    const act: Act = async (type, payload) => {
      const result = applyCommand(
        state,
        { commandId: `t-${type}`, type, payload } as Command,
        state.lastProcessedAt,
      );
      if (result.ok) {
        state = result.state;
      }
      return deriveViewState(state, state.lastProcessedAt);
    };
    const view = deriveViewState(state, 0);
    const after = await forjarArmas.run(view, act);
    expect(state.settlement.forge).toMatchObject({ kind: 'weapons', amount: 10 });
    // Com a forja ocupada, não repete.
    const again = await forjarArmas.run(after, act);
    expect(again.smithy.forge?.amount).toBe(10);
    // E erguer o Ferreiro é inerte sem Quartel.
    const bare = deriveViewState(stall, 0);
    const kept = await erguerFerreiro.run(bare, act);
    expect(kept).toBe(bare);
  });
});
