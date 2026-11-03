import { balance, feats, featRules, type FeatId } from '@lotg/content';

import { emit } from './chronicle';
import { yearOf } from './clock';
import type { GameEvent, GameState } from './types';
import { recordYearPopulation, resetYearStats, yearStat } from './yearStats';

/** Fecha o ano após restoreTiles e antes da Ameaça, sem sorteio nem lista nova no estado. */
export function endYear(draft: GameState, atMs: number, events: GameEvent[]): void {
  const year = yearOf(atMs) - 1;
  recordYearPopulation(draft);
  const result = draft.stats[`siegeResult:${year}`];
  const won = result === 1 || result === 2;
  const achieved: Record<FeatId, boolean> = {
    firstWinter: won,
    intactWall: result === 2,
    hordeKingslayer: yearStat(draft, 'warlordsSlain') > 0,
    feint: won && yearStat(draft, 'feint') === 1,
    saboteur: yearStat(draft, 'sabotages') >= featRules.sabotagesPerYear,
    rescue: yearStat(draft, 'heroesRescued') > 0,
  };
  const earned = feats.filter((feat) => achieved[feat.id]).map((feat) => feat.id);
  const populationMax = yearStat(draft, 'populationMax');
  const battles = yearStat(draft, 'battles');
  const battlesWon = yearStat(draft, 'battlesWon');
  const expeditions = yearStat(draft, 'expeditions');
  const cards = yearStat(draft, 'cards');
  const weights = balance.score;
  const score =
    populationMax * weights.populationMax +
    battlesWon * weights.battlesWon +
    expeditions * weights.expeditions +
    cards * weights.cards +
    (won ? weights.siegeVictory : 0) +
    (result === 2 ? weights.siegeGlorious : 0) +
    earned.length * weights.feat;
  draft.stats.yearScore = score;
  draft.stats.yearFeats = earned.length;
  draft.stats.yearsEnded = (draft.stats.yearsEnded ?? 0) + 1;
  emit(
    events,
    draft,
    atMs,
    'yearEnded',
    {
      year,
      populationMax,
      battles,
      battlesWon,
      expeditions,
      cards,
      siegeResult:
        result === 0 ? 'fall' : result === 1 ? 'victory' : result === 2 ? 'glorious' : 'none',
      score,
      feats: earned.join(','),
    },
    { ano: year, pontos: score },
  );
  resetYearStats(draft);
}
