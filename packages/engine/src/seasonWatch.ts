import type { SeasonId } from '@lotg/content';

import { seasonAt } from './clock';
import type { GameState } from './types';

/**
 * As estações atravessadas sem frio (GDD §12.2: "Atravesse o inverno sem passar frio").
 *
 * O frio que abriu e passou não deixa marca no estado, então a conta é feita enquanto a estação
 * corre, em dois contadores de `stats`:
 *
 * - `coldSpellsThisSeason`: quantas vezes o frio começou na estação em curso. Só existe quando a
 *   estação é acompanhada **desde o primeiro instante**: nasce em zero na virada da estação. Uma
 *   partida que recebeu esta regra com a estação já em curso não o tem, e essa estação não conta
 *   pela metade (ADR 0014, decisão 12).
 * - `seasonsSurvived:<estação>`: quantas vezes a estação terminou com o contador acima em zero.
 *
 * Os dois só mudam em instantes de evento (a virada da estação, o frio que começa), e por isso
 * a divisão de intervalo continua exata.
 */
const COLD_SPELLS = 'coldSpellsThisSeason';

const survivedStat = (season: SeasonId) => `seasonsSurvived:${season}`;

/** Quantas vezes o feudo atravessou a estação inteira sem passar frio. */
export function seasonsSurvived(state: GameState, season: SeasonId): number {
  return state.stats[survivedStat(season)] ?? 0;
}

/**
 * Como vai a estação em curso: `clean`, acompanhada desde o começo e sem frio; `cold`, já teve
 * frio; `unwatched`, já corria quando a contagem começou.
 */
export function seasonWatch(state: GameState): 'clean' | 'cold' | 'unwatched' {
  const spells = state.stats[COLD_SPELLS];
  if (spells === undefined) {
    return 'unwatched';
  }
  return spells === 0 ? 'clean' : 'cold';
}

/**
 * A virada de estação em `atMs`: fecha a conta da que acabou e abre a da que começa. Roda na
 * virada do dia, antes dos objetivos e do acerto de fome e frio do mesmo instante: o frio que
 * começa no primeiro instante da estação nova já é dela.
 */
export function turnSeasonWatch(draft: GameState, atMs: number): void {
  const { stats } = draft;
  if (stats[COLD_SPELLS] === 0) {
    const ended = survivedStat(seasonAt(atMs - 1).id);
    stats[ended] = (stats[ended] ?? 0) + 1;
  }
  stats[COLD_SPELLS] = 0;
}

/** O frio começou: a estação em curso, se é acompanhada, já não é uma estação sem frio. */
export function noteColdStarted(draft: GameState): void {
  const { stats } = draft;
  if (stats[COLD_SPELLS] !== undefined) {
    stats[COLD_SPELLS] += 1;
  }
}
