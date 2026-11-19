import { vows, vowTexts, type VowId } from '@lotg/content';
import type { GameState, VowView, VowsView } from './types';
import { realSecondsCeil } from './units';
import { offeredVows, vowOfferYear } from './vows';

export function vowsView(state: GameState, timeScale: number): VowsView {
  const year = vowOfferYear(state);
  const toView = (id: VowId): VowView => ({
    id,
    label: vows[id].label,
    legacyBonusPercent: vows[id].legacyBonusPercent,
    description: vowTexts.forYear
      .replace('{ano}', String(year))
      .replace('{efeito}', vows[id].description),
  });
  const closesInSeconds = realSecondsCeil(
    Math.max(0, state.vows.closesAtMs - state.lastProcessedAt),
    timeScale,
  );
  return {
    offer: closesInSeconds > 0 ? offeredVows(state).map(toView) : [],
    taken: (year === state.vows.year ? state.vows.taken : (state.vows.nextTaken ?? [])).map(toView),
    closesInSeconds,
  };
}
