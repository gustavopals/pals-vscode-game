import { balance, terrains } from '@lotg/content';

import { emit } from './chronicle';
import { amountsData, missingResources, payResources } from './construction';
import { nextId } from './ids';
import { outpostPlace } from './outposts';
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

export function repairOutpostBlock(state: GameState, outpostId: string): Rejection | null {
  const post = state.map.outposts.find((entry) => entry.id === outpostId);
  if (!post || post.status !== 'damaged') return reject('OUTPOST_NOT_DAMAGED');
  const missing = missingResources(state, balance.outposts.repairCost);
  return missing === null ? null : reject('INSUFFICIENT_RESOURCES', { missing });
}

/**
 * Repara um posto avançado danificado (V5F-T2; D-24): cobra madeira e pedra e devolve o posto
 * imediatamente a `active` (sem obra). O hexágono permanece `claimed`.
 */
export function repairOutpost(
  draft: GameState,
  outpostId: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (typeof outpostId !== 'string') return reject('OUTPOST_NOT_DAMAGED');
  const blocked = repairOutpostBlock(draft, outpostId);
  if (blocked) return blocked;
  const post = draft.map.outposts.find((entry) => entry.id === outpostId)!;
  const { repairCost } = balance.outposts;
  payResources(draft, repairCost);
  post.status = 'active';
  post.readyAtMs = null;
  emit(
    events,
    draft,
    nowMs,
    'outpostRepaired',
    { outpostId: post.id, hex: post.hex, ...amountsData('spent', repairCost) },
    { lugar: outpostPlace(draft, post.hex) },
  );
  return null;
}
