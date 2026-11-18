import { relics } from '@lotg/content';
import { emit } from './chronicle';
import { nextDayBoundary } from './clock';
import { reject } from './rejections';
import { relicIsActive, rescaleExpeditionRemainders } from './relics';
import type { GameEvent, GameState, Rejection } from './types';

/** Fonte única da recusa: usada pela ordem e pelo bloqueio da visão. */
export function placeRelicBlock(state: GameState, relicId: unknown): Rejection | null {
  if (state.settlement.buildings.chapel === 0) return reject('CHAPEL_REQUIRED');
  const item = state.settlement.relics.find((entry) => entry.defId === relicId);
  if (item === undefined) return reject('RELIC_NOT_FOUND');
  if (item.placed) return reject('RELIC_ALREADY_PLACED');
  if (
    state.settlement.relics.filter((entry) => entry.placed).length >=
    state.settlement.buildings.chapel
  )
    return reject('NO_RELIC_SLOT');
  return null;
}

export function placeRelic(
  draft: GameState,
  relicId: unknown,
  atMs: number,
  events: GameEvent[],
): Rejection | null {
  const block = placeRelicBlock(draft, relicId);
  if (block !== null) return block;
  const item = draft.settlement.relics.find((entry) => entry.defId === relicId)!;
  item.placed = true;
  item.effectiveFromMs = nextDayBoundary(atMs);
  emit(
    events,
    draft,
    atMs,
    'relicPlaced',
    { relicId: item.defId, effectiveFromMs: item.effectiveFromMs },
    { reliquia: relics[item.defId].label },
  );
  return null;
}

export function removeRelic(
  draft: GameState,
  relicId: unknown,
  atMs: number,
  events: GameEvent[],
): Rejection | null {
  const item = draft.settlement.relics.find((entry) => entry.defId === relicId);
  if (item === undefined) return reject('RELIC_NOT_FOUND');
  if (!item.placed) return reject('RELIC_NOT_PLACED');
  if (item.defId === 'hermitsLamp' && relicIsActive(draft, item.defId, atMs)) {
    const { num, den } = relics.hermitsLamp.duration;
    rescaleExpeditionRemainders(draft, atMs, { num: den, den: num });
  }
  item.placed = false;
  item.effectiveFromMs = null;
  emit(
    events,
    draft,
    atMs,
    'relicRemoved',
    { relicId: item.defId },
    { reliquia: relics[item.defId].label },
  );
  return null;
}

/** Se a Queda reduzir a Capela, conserva os primeiros lugares e guarda o excedente. */
export function settleRelicSlots(draft: GameState, atMs: number, events: GameEvent[]): void {
  const placed = draft.settlement.relics.filter((entry) => entry.placed);
  for (const item of placed.slice(draft.settlement.buildings.chapel))
    removeRelic(draft, item.defId, atMs, events);
}
