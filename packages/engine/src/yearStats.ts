import { featRules, LINE_IDS, UNIT_IDS, WING_IDS, type UnitId } from '@lotg/content';

import type { BattlePosts } from './battle';
import { inhabitants } from './masters';
import type { GameEventType, GameState } from './types';

/** Contadores do ano corrente: o mapa aberto de estatísticas já existe no estado 40. */
export const YEAR_STAT_PREFIX = 'chronicle:';

const COMBATANT_IDS = [...UNIT_IDS, 'militia'] as const;

export function yearStat(state: GameState, key: string): number {
  return state.stats[`${YEAR_STAT_PREFIX}${key}`] ?? 0;
}

function increment(state: GameState, key: string): void {
  const stat = `${YEAR_STAT_PREFIX}${key}`;
  state.stats[stat] = (state.stats[stat] ?? 0) + 1;
}

/** Mesma população habitante da visão: aldeões, Mestres e soldados; heróis não ocupam casa. */
export function recordYearPopulation(state: GameState): void {
  const population = inhabitants(state);
  state.stats[`${YEAR_STAT_PREFIX}populationMax`] = Math.max(
    yearStat(state, 'populationMax'),
    population,
  );
}

/** Cada ocorrência conta uma vez, na emissão real; prévias e nós intermediários não contam. */
export function recordYearEvent(
  state: GameState,
  type: GameEventType,
  data: Record<string, string | number>,
): void {
  recordYearPopulation(state);
  switch (type) {
    case 'battleFought':
      increment(state, 'battles');
      if (data.outcome === 'victory' || data.outcome === 'held') increment(state, 'battlesWon');
      break;
    case 'expeditionSent':
      increment(state, 'expeditions');
      if (data.modelId === 'sabotage') increment(state, 'sabotages');
      break;
    case 'cardAnswered':
    case 'cardExpired':
      increment(state, 'cards');
      break;
    case 'warlordSlain':
      increment(state, 'warlordsSlain');
      break;
    case 'heroRescued':
      increment(state, 'heroesRescued');
      break;
  }
}

/** Retrato numérico dos postos efetivamente usados no ensaio, antes de sofrer baixas. */
export function recordYearRehearsal(
  state: GameState,
  posts: BattlePosts<UnitId | 'militia'>,
): void {
  for (const wing of WING_IDS)
    for (const line of LINE_IDS) {
      const post = posts[wing][line];
      for (const unit of COMBATANT_IDS) {
        state.stats[`${YEAR_STAT_PREFIX}rehearsal:${wing}:${line}:${unit}`] =
          post?.unit === unit ? post.count : 0;
      }
    }
}

/** A Finta compara o ensaio com a primeira onda; perdas nas ondas seguintes não são mudanças. */
export function recordYearFeint(state: GameState, posts: BattlePosts<UnitId | 'militia'>): void {
  let before = 0;
  let after = 0;
  let overlap = 0;
  for (const wing of WING_IDS)
    for (const line of LINE_IDS) {
      const post = posts[wing][line];
      for (const unit of COMBATANT_IDS) {
        const previous = yearStat(state, `rehearsal:${wing}:${line}:${unit}`);
        const current = post?.unit === unit ? post.count : 0;
        before += previous;
        after += current;
        overlap += Math.min(previous, current);
      }
    }
  const total = Math.max(before, after);
  const { num, den } = featRules.feintChangedShare;
  state.stats[`${YEAR_STAT_PREFIX}feint`] =
    before > 0 && after > 0 && (total - overlap) * den > total * num ? 1 : 0;
}

/** Tamanho limitado: não acumula uma cópia dos contadores para cada ano. */
export function resetYearStats(state: GameState): void {
  for (const key of Object.keys(state.stats)) {
    if (key.startsWith(YEAR_STAT_PREFIX)) delete state.stats[key];
  }
  recordYearPopulation(state);
}
