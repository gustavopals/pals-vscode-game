import { balance, terrains } from '@lotg/content';

import { emit } from './chronicle';
import type { GameEvent, GameState, Outpost, ResourceId } from './types';

export function activeOutpostsFor(state: GameState, resource: ResourceId): Outpost[] {
  return state.map.outposts.filter(
    ({ hex, status }) =>
      status === 'active' && balance.outposts.resources[state.map.hexes[hex]!.terrain] === resource,
  );
}

export function nextOutpostReadyAt(state: GameState): number | null {
  let next: number | null = null;
  for (const { status, readyAtMs } of state.map.outposts) {
    if (status === 'building' && readyAtMs !== null && (next === null || readyAtMs < next)) {
      next = readyAtMs;
    }
  }
  return next;
}

export function finishOutposts(draft: GameState, atMs: number, events: GameEvent[]): void {
  // A lista conserva a ordem de emissão dos ids, inclusive depois de passar pelo JSONB.
  for (const post of draft.map.outposts) {
    if (post.status !== 'building' || post.readyAtMs === null || post.readyAtMs > atMs) continue;
    const hex = draft.map.hexes[post.hex]!;
    hex.fog = 'claimed';
    post.status = 'active';
    post.readyAtMs = null;
    emit(
      events,
      draft,
      atMs,
      'outpostClaimed',
      { outpostId: post.id, hex: post.hex },
      { lugar: terrains[hex.terrain].label },
    );
  }
}
