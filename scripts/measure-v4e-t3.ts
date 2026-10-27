/** Medição reproduzível, fora das políticas dos bots. Ver docs/balance-v0.4.md, seção 11. */
import { DIFFICULTY_IDS, SEASON_IDS } from '../packages/content/src/index';
import { botFor } from '../packages/sim-cli/src/bots';
import { prepararFinta, BAIT_FORMATION_NAME } from '../packages/sim-cli/src/bots/finta';
import { militarPolicies } from '../packages/sim-cli/src/bots/militar';
import { montarFormacao } from '../packages/sim-cli/src/bots/policies';
import { preparedFor } from '../packages/sim-cli/src/bots/economico';
import { botOf, type Bot } from '../packages/sim-cli/src/bots/types';
import { IDENTITY } from '../packages/sim-cli/src/identity';
import { MATRIX_SEEDS } from '../packages/sim-cli/src/matrix';
import { summarize } from '../packages/sim-cli/src/report';
import { simulate } from '../packages/sim-cli/src/simulate';

console.log(JSON.stringify({ identity: IDENTITY, regularSeeds: 50, militarySeeds: 10 }));
for (const difficulty of DIFFICULTY_IDS) {
  const seasons = Object.fromEntries(SEASON_IDS.map((season) => [season, { total: 0, hours: 0 }]));
  const measures: Array<{
    omens: number;
    fortress: number | null;
    suffered: number;
    repelled: number;
  }> = [];
  for (const seed of MATRIX_SEEDS) {
    const result = await simulate({
      seed,
      days: 7,
      timeScale: 1,
      difficulty,
      strategy: 'economico',
      sessionsPerDay: 2,
    });
    for (const row of result.rows) {
      seasons[row.season]!.total += row.threat;
      seasons[row.season]!.hours++;
    }
    const summary = summarize(result);
    measures.push({
      omens: summary.omens,
      fortress: summary.fortressDay,
      suffered: summary.raids.suffered,
      repelled: summary.raids.repelled,
    });
  }
  console.log(
    JSON.stringify({
      difficulty,
      regular: measures,
      threatBySeason: Object.fromEntries(
        Object.entries(seasons).map(([season, { total, hours }]) => [
          season,
          { total, hours, mean: total / hours },
        ]),
      ),
    }),
  );
  for (const feint of [false, true]) {
    const runs = [];
    for (const seed of MATRIX_SEEDS.slice(0, 10)) {
      const baitBattles = new Set<string>();
      const base = feint
        ? botFor('militar', 2)
        : botOf(
            preparedFor(
              militarPolicies.map((policy) => (policy === prepararFinta ? montarFormacao : policy)),
              12,
            ),
          );
      const bot: Bot = async (view, act) => {
        const bait = view.army.formations.find(
          (formation) => formation.name === BAIT_FORMATION_NAME,
        );
        for (const report of view.army.reports)
          if (bait !== undefined && report.adjustFormationId === bait.id)
            baitBattles.add(report.id);
        await base(view, act);
      };
      const result = await simulate({
        seed,
        days: 7,
        timeScale: 1,
        difficulty,
        strategy: 'militar',
        sessionsPerDay: 2,
        bot,
      });
      const summary = summarize(result);
      runs.push({
        seed,
        baitBattles: baitBattles.size,
        soldiers: result.rows.at(-1)!.soldiers,
        suffered: summary.raids.suffered,
        repelled: summary.raids.repelled,
        injured: summary.raids.injured,
        omens: summary.omens,
      });
    }
    console.log(JSON.stringify({ difficulty, feint, military: runs }));
  }
}
