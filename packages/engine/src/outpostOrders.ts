import { balance, terrains } from '@lotg/content';

import { emit } from './chronicle';
import { amountsData, missingResources, payResources } from './construction';
import { nextId } from './ids';
import { reject } from './rejections';
import type { GameEvent, GameState, Outpost, Rejection } from './types';

function isMapKey(state: GameState, key: unknown): key is Outpost['hex'] {
  return typeof key === 'string' && Object.hasOwn(state.map.hexes, key);
}

export function claimOutpostBlock(state: GameState, key: Outpost['hex']): Rejection | null {
  const hex = state.map.hexes[key];
  if (!hex || hex.fog === 'unknown' || hex.fog === 'sighted') return reject('HEX_NOT_EXPLORED');
  if (
    key === '0,0' ||
    hex.fog !== 'explored' ||
    !balance.outposts.resources[hex.terrain] ||
    state.map.outposts.some((post) => post.hex === key)
  )
    return reject('NOT_CLAIMABLE');
  const { townHallLevel, limit, cost } = balance.outposts;
  if (state.settlement.buildings.townHall < townHallLevel)
    return reject('GATE_LOCKED', { level: townHallLevel });
  if (state.map.outposts.length >= limit) return reject('OUTPOST_LIMIT');
  const missing = missingResources(state, cost);
  return missing === null ? null : reject('INSUFFICIENT_RESOURCES', { missing });
}

export function claimOutpost(
  draft: GameState,
  key: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (!isMapKey(draft, key)) return reject('HEX_NOT_EXPLORED');
  const blocked = claimOutpostBlock(draft, key);
  if (blocked) return blocked;
  const { cost, durationMs } = balance.outposts;
  const id = nextId(draft, 'outpost');
  const readyAtMs = nowMs + durationMs;
  payResources(draft, cost);
  draft.map.outposts.push({ id, hex: key, status: 'building', readyAtMs });
  emit(
    events,
    draft,
    nowMs,
    'outpostStarted',
    { outpostId: id, hex: key, readyAtMs, ...amountsData('spent', cost) },
    { lugar: terrains[draft.map.hexes[key]!.terrain].label },
  );
  return null;
}
