import {
  balance,
  VOW_IDS,
  vows,
  vowRules,
  type HeroCaptureRuleId,
  type Ratio,
  type VowId,
} from '@lotg/content';
import { YEAR_MS, yearOf } from './clock';
import type { GameState } from './types';
import { realToGameMs } from './units';

/** A escolha corrente continua valendo no rescaldo, mesmo após escolher o ano seguinte. */
export function vowsForYear(state: GameState, year: number): readonly VowId[] {
  if (state.vows.year === year) return state.vows.taken;
  return state.vows.year + 1 === year ? (state.vows.nextTaken ?? []) : [];
}

export function vowIsActive(state: GameState, id: VowId, atMs = state.lastProcessedAt): boolean {
  return vowsForYear(state, yearOf(atMs)).includes(id);
}

export function offeredVows(state: GameState): VowId[] {
  const difficulty = balance.difficulties[state.settings.difficulty];
  return VOW_IDS.filter((id) => {
    if (id === 'mortalHeroes') return difficulty.heroCapture !== 'death';
    if (id === 'cunningHorde') {
      const target = vows.cunningHorde.cunning;
      return difficulty.cunning.num * target.den < target.num * difficulty.cunning.den;
    }
    return true;
  });
}

export function vowOfferYear(state: GameState, atMs = state.lastProcessedAt): number {
  const year = yearOf(atMs);
  return state.siege?.year === year &&
    state.siege.result !== null &&
    state.siege.endedAtMs !== null &&
    state.siege.endedAtMs <= atMs
    ? year + 1
    : year;
}

export function nextVowCloseAt(state: GameState): number | null {
  return state.vows.closesAtMs > state.lastProcessedAt ? state.vows.closesAtMs : null;
}

/** Sem evento adicional: a conclusão do Cerco já é um instante da linha do tempo. */
export function openVowsAfterSiege(draft: GameState, atMs: number): void {
  if (draft.vows.nextTaken === null)
    draft.vows.closesAtMs =
      yearOf(atMs) * YEAR_MS + realToGameMs(vowRules.choiceWindowRealMs, draft.settings.timeScale);
}

/** Depois de yearEnded, antes das regras do ano que começa. */
export function turnVowsYear(draft: GameState, atMs: number): void {
  const year = yearOf(atMs);
  if (year <= draft.vows.year) return;
  const selected = draft.vows.year + 1 === year ? draft.vows.nextTaken : null;
  draft.vows = {
    year,
    taken: selected ?? [],
    nextTaken: null,
    closesAtMs:
      selected === null
        ? (year - 1) * YEAR_MS + realToGameMs(vowRules.choiceWindowRealMs, draft.settings.timeScale)
        : atMs,
  };
}

export function heroCaptureRule(state: GameState): HeroCaptureRuleId {
  return vowIsActive(state, 'mortalHeroes')
    ? 'death'
    : balance.difficulties[state.settings.difficulty].heroCapture;
}

export function hordeCunning(state: GameState): Ratio {
  return vowIsActive(state, 'cunningHorde')
    ? vows.cunningHorde.cunning
    : balance.difficulties[state.settings.difficulty].cunning;
}

/** A pontuação já inclui os pontos dos Feitos; não os soma outra vez. */
export function legacyPoints(score: number, selected: readonly VowId[]): number {
  const bonus = selected.reduce((sum, id) => sum + vows[id].legacyBonusPercent, 0);
  return Math.floor((score * (100 + bonus)) / 100);
}
