import { relics, relicTexts } from '@lotg/content';
import { durationText, fillText } from './format';
import { placeRelicBlock } from './relicOrders';
import { relicIsActive } from './relics';
import type { GameState, RelicsView } from './types';
import { realSecondsCeil } from './units';

export function relicsView(state: GameState, timeScale: number): RelicsView {
  return {
    slots: state.settlement.buildings.chapel,
    items: state.settlement.relics.map((item) => {
      const block = placeRelicBlock(state, item.defId);
      const seconds =
        item.effectiveFromMs === null
          ? null
          : realSecondsCeil(Math.max(0, item.effectiveFromMs - state.lastProcessedAt), timeScale);
      const active = relicIsActive(state, item.defId);
      return {
        relicId: item.defId,
        label: relics[item.defId].label,
        effectText: relics[item.defId].effectText,
        placed: item.placed,
        active,
        effectiveInSeconds: seconds,
        effectiveText:
          seconds === null
            ? null
            : active
              ? relicTexts.active
              : fillText(relicTexts.effective, { prazo: durationText(seconds) }),
        canPlace: block === null,
        canRemove: item.placed,
        blockedCode: block?.code ?? null,
        blockedReason: block?.message ?? null,
      };
    }),
  };
}
