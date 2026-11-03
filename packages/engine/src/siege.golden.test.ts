import { balance, type DifficultyId } from '@lotg/content';
import { expect, it } from 'vitest';

import { advanceTo } from './advance';
import { buildBattleReport } from './battleReport';
import { fightBattle } from './battleTurn';
import { buildDefender, toHordePosts } from './raidArmy';
import { readySiege, siegeYard, WINTER, wingHp } from './siege.test-helpers';
import { wallForBattle, applyWallDamage } from './wallRepair';
import { vigilAt } from './vigil';
import type { GameEvent } from './types';

/** Referência fixada ANTES do motor do cerco: só usa a batalha e a preparação já existentes. */
export function referenceSiege() {
  const state = siegeYard();
  const atMs = vigilAt(state.settings, WINTER);
  const reports = [];
  for (const wave of state.horde.wavePlan!.waves) {
    const time = atMs + (wave.number - 1) * 3_600_000;
    const defender = buildDefender(state.army.formations[0]!, state.army.units, () => null);
    const { id, resolution } = fightBattle(state, {
      mode: 'defense',
      player: defender,
      horde: { posts: toHordePosts(wave.composition) },
      wall: wallForBattle(state),
      watchtowerLevel: 5,
      heroCapture: balance.difficulties.lord.heroCapture,
    });
    const report = buildBattleReport(id, time, resolution, 'formation-1');
    applyWallDamage(state, report, time, []);
    for (const loss of report.casualties) {
      if (loss.owner === 'player')
        state.army.units[loss.unit as keyof typeof state.army.units] -= loss.lost;
    }
    reports.push({
      wave: wave.number,
      atMs: time,
      outcome: report.outcome,
      ending: report.ending,
      rounds: report.rounds,
      casualties: report.casualties,
      wall: report.wall,
    });
    if (report.outcome === 'defeat') break;
  }
  return {
    atMs,
    reports,
    units: state.army.units,
    wall: wingHp(state),
    ids: state.ids,
    rng: state.rng,
  };
}

it('fixa um cerco completo de referência antes de implementar o motor', async () => {
  const result = referenceSiege();
  expect(result.reports).toHaveLength(3);
  expect(result.reports.every((report) => report.outcome !== 'defeat')).toBe(true);
  await expect(`${JSON.stringify(result, null, 2)}\n`).toMatchFileSnapshot(
    './__golden__/siege-reference.json',
  );
});

export function completeSiegeByDifficulty(difficulty: DifficultyId) {
  let state = readySiege(difficulty);
  const waves: Array<{
    wave: number;
    atMs: number;
    outcome: string;
    events: GameEvent[];
    wall: { left: number; center: number; right: number };
    armyRemaining: Record<string, number>;
  }> = [];

  while (state.siege !== null && state.siege.result === null && state.siege.nextWaveAtMs !== null) {
    const atMs = state.siege.nextWaveAtMs;
    const step = advanceTo(state, atMs);
    state = step.state;
    const report = state.army.reports.at(-1)!;
    waves.push({
      wave: state.siege!.current,
      atMs,
      outcome: report.outcome,
      events: step.events,
      wall: { ...state.settlement.wall.hp },
      armyRemaining: { ...state.army.units },
    });
  }

  return {
    difficulty,
    result: state.siege!.result,
    breached: state.siege!.breached,
    deaths: state.siege!.deaths,
    wall: { ...state.settlement.wall.hp },
    army: { ...state.army.units },
    waves,
  };
}

it('grava o cerco completo por dificuldade no motor (Camponês, Senhor, Rei de Ferro)', async () => {
  const results = {
    peasant: completeSiegeByDifficulty('peasant'),
    lord: completeSiegeByDifficulty('lord'),
    ironKing: completeSiegeByDifficulty('ironKing'),
  };

  expect(results.peasant.waves).toHaveLength(3);
  expect(results.lord.waves).toHaveLength(3);
  expect(results.ironKing.waves).toHaveLength(3);

  await expect(`${JSON.stringify(results, null, 2)}\n`).toMatchFileSnapshot(
    './__golden__/siege-by-difficulty.json',
  );
});
