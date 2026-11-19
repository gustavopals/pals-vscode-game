import { VOW_IDS, vows, vowTexts, type VowId } from '@lotg/content';
import { emit } from './chronicle';
import { joinList } from './format';
import { reject } from './rejections';
import type { GameEvent, GameState, Rejection } from './types';
import { offeredVows, vowOfferYear } from './vows';

export function takeVows(
  draft: GameState,
  selected: unknown,
  atMs: number,
  events: GameEvent[],
): Rejection | null {
  if (atMs >= draft.vows.closesAtMs) return reject('VOWS_CLOSED');
  const offered = offeredVows(draft);
  if (
    !Array.isArray(selected) ||
    selected.some((id) => !VOW_IDS.includes(id) || !offered.includes(id)) ||
    new Set(selected).size !== selected.length
  )
    return reject('VOW_UNAVAILABLE');
  // Ordem canônica, independente da ordem dos ids enviada pelo cliente.
  const taken = VOW_IDS.filter((id) => selected.includes(id)) as VowId[];
  const year = vowOfferYear(draft, atMs);
  if (year === draft.vows.year) draft.vows.taken = taken;
  else draft.vows.nextTaken = taken;
  draft.vows.closesAtMs = atMs;
  emit(
    events,
    draft,
    atMs,
    'vowsTaken',
    { year, vows: taken.join(',') },
    {
      ano: year,
      votos: taken.length === 0 ? vowTexts.none : joinList(taken.map((id) => vows[id].label)),
    },
  );
  return null;
}
