import { describe, expect, it } from 'vitest';

import { EVEN_LUCK, resolveBattle, type BattleInput } from './battle';
import { SCENARIOS } from './battle.test';
import { buildBattleReport } from './battleReport';
import { barracksYard } from './test-helpers';
import { deriveViewState } from './view';

const stateWith = (indexes: number[]) => {
  const state = barracksYard();
  for (const [order, index] of indexes.entries()) {
    state.army.reports.push(
      buildBattleReport(
        `battle-${String(order + 1)}`,
        order,
        resolveBattle(SCENARIOS[index]?.input as BattleInput, EVEN_LUCK),
      ),
    );
  }
  return state;
};

const reportsOf = (indexes: number[]) => {
  const state = stateWith(indexes);
  return deriveViewState(state, state.lastProcessedAt, { timeScale: 3 }).army.reports;
};

describe('os relatórios de batalha na visão (V4D-T4.3)', () => {
  it('sem batalha, a lista é vazia', () => {
    expect(reportsOf([])).toEqual([]);
  });

  it('vem do mais novo ao mais antigo, com tudo em frase', () => {
    const reports = reportsOf([0, 4]);
    expect(reports.map((report) => report.id)).toEqual(['battle-2', 'battle-1']);
    const first = reports[1];
    expect(first?.factors.length).toBeGreaterThan(0);
    expect(
      first?.factors.every((entry) => entry.text.length > 10 && !entry.text.includes('{')),
    ).toBe(true);
    expect(first?.rounds.length).toBe(first?.roundsCount);
    expect(first?.rounds[0]?.attacks.every((text) => !text.includes('{'))).toBe(true);
    expect(first?.casualties.some((entry) => entry.owner === 'player')).toBe(true);
    expect(first?.wall.length).toBeGreaterThan(0);
  });

  it('o comandante sem herói na lista não quebra, e a Defesa ativa vira "Ajustar formação"', () => {
    const state = stateWith([5]);
    const view = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 }).army.reports[0];
    expect(view?.adjustFormationId).toBeNull();
    state.army.formations.push({
      id: 'formation-1',
      name: 'Formação 1',
      posts: {
        left: { front: null, back: null },
        center: { front: null, back: null },
        right: { front: null, back: null },
      },
      commanders: { left: null, center: null, right: null },
    });
    state.army.activeFormationId = 'formation-1';
    const again = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 }).army.reports[0];
    expect(again?.adjustFormationId).toBe('formation-1');
    for (const commander of again?.commanders ?? []) {
      expect(commander.name.length).toBeGreaterThan(0);
    }
  });
});
