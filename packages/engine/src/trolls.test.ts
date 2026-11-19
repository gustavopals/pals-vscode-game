import { DIFFICULTY_IDS, omenTexts } from '@lotg/content';
import { describe, expect, it } from 'vitest';
import { revealOmen, settleHordeTiles } from './hordePlan';
import { omenText } from './hordeMind';
import { currentShape, migrateState } from './migrations';
import { fightBattle } from './battleTurn';
import { buildBattleReport } from './battleReport';
import { previewInputFor } from './warCouncilOrders';
import { siegeYard } from './siege.test-helpers';
import { AUTUMN, gameAt, YEAR } from './test-helpers';

function trollHorde(year = 2, seed = 'trolls-1') {
  const state = gameAt((year - 1) * YEAR + AUTUMN);
  state.seed = seed;
  settleHordeTiles(state, state.lastProcessedAt, []);
  return state;
}

describe('Trolls — Ano 2 em diante', () => {
  it.each(DIFFICULTY_IDS)('não gera Trolls no Ano 1 em %s', (difficulty) => {
    for (let seed = 0; seed < 32; seed += 1) {
      const state = gameAt(AUTUMN);
      state.seed = `trolls-${seed}`;
      state.settings.difficulty = difficulty;
      settleHordeTiles(state, state.lastProcessedAt, []);
      expect(
        state.horde.wavePlan!.waves.flatMap((w) => w.composition).some((p) => p.unit === 'troll'),
      ).toBe(false);
    }
  });

  it('gera Trolls no Ano 2 e o presságio próprio só revela o que há na onda', () => {
    const state = trollHorde();
    const wave = state.horde.wavePlan!.waves[1]!;
    expect(wave.composition.some((p) => p.unit === 'troll')).toBe(true);
    state.settlement.buildings.watchtower = 5;
    revealOmen(state, wave, state.lastProcessedAt, []);
    expect(state.horde.omens[0]!.text).toContain('troll');
    expect(state.horde.omens[0]!.reveals).toEqual(wave.composition);
    expect(omenText({ number: 2, mainWing: 'left', composition: { troll: 12 } }, 'vague')).toBe(
      omenTexts.vague.troll,
    );
    const before = JSON.stringify(state);
    expect(currentShape(state, '')).toBeNull();
    expect(JSON.stringify(state)).toBe(before);
    state.horde.omens[0]!.reveals.find((post) => post.unit === 'troll')!.unit = 'ogre';
    expect(currentShape(state, '')).toMatch(/posto difere/);
  });

  it('a guarda recusa Troll em onda do Ano 1', () => {
    const state = trollHorde(1);
    state.horde.wavePlan!.waves[1]!.composition[0]!.unit = 'troll';
    expect(currentShape(state, '')).toMatch(/Ano 2/);
  });

  it('a prévia da onda usa a mistura pública do Ano 2 sem consultar a memória escondida', () => {
    const state = siegeYard('lord', 1, 2);
    const formation = state.army.formations[0]!;
    const input = previewInputFor(state, formation, 2);
    expect(input.mix?.troll).toBe(20);
    state.horde.previousYearFormation = { total: 20, byUnit: { archer: 20 } };
    state.horde.lastFormationSeen = { total: 17, byUnit: { spearman: 17 } };
    expect(previewInputFor(state, formation, 2)).toEqual(input);
    const firstYear = siegeYard();
    expect(previewInputFor(firstYear, firstYear.army.formations[0]!, 2).mix).toBeUndefined();
  });

  it('persiste e relê o relatório real com Trolls, conservando a unidade no JSON', () => {
    const state = trollHorde();
    const empty = { front: null, back: null };
    const { id, resolution } = fightBattle(state, {
      mode: 'defense',
      player: {
        posts: { left: empty, center: empty, right: empty },
        commanders: { left: null, center: null, right: null },
      },
      horde: {
        posts: {
          left: empty,
          center: { front: { unit: 'troll', count: 2 }, back: null },
          right: empty,
        },
      },
      wall: {},
      watchtowerLevel: 0,
      heroCapture: 'capture',
    });
    state.army.reports.push(buildBattleReport(id, state.lastProcessedAt, resolution));
    const serialized = JSON.stringify(state);
    expect(migrateState(JSON.parse(serialized), { timeScale: 1 })).toEqual(state);
    expect(JSON.stringify(state)).toBe(serialized);
    expect(state.army.reports[0]!.casualties.some((post) => post.unit === 'troll')).toBe(true);
  });
});
