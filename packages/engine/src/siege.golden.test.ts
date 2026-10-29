import { balance } from '@lotg/content';
import { expect, it } from 'vitest';

import { buildBattleReport } from './battleReport';
import { fightBattle } from './battleTurn';
import { buildDefender, toHordePosts } from './raidArmy';
import { siegeYard, WINTER, wingHp } from './siege.test-helpers';
import { wallForBattle, applyWallDamage } from './wallRepair';
import { vigilAt } from './vigil';

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
