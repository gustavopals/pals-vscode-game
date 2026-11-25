import { balance, terrains } from '@lotg/content';

import { emit } from './chronicle';
import { hexDistance } from './hexmap';
import type { GameEvent, GameState, Outpost, ResourceId } from './types';

function outpostIdNumber(id: string): number {
  return Number(id.slice(8));
}

function hexKeyDistance(hex: Outpost['hex']): number {
  const comma = hex.indexOf(',');
  return hexDistance(Number(hex.slice(0, comma)), Number(hex.slice(comma + 1)));
}

/** "Veio de Ferro (-3,0)": o terreno e a coordenada de um posto avançado. */
export function outpostPlace(state: GameState, hex: Outpost['hex']): string {
  return `${terrains[state.map.hexes[hex]!.terrain].label} (${hex})`;
}

export function activeOutpostsFor(state: GameState, resource: ResourceId): Outpost[] {
  return state.map.outposts.filter(
    ({ hex, status }) =>
      status === 'active' && balance.outposts.resources[state.map.hexes[hex]!.terrain] === resource,
  );
}

/**
 * O posto avançado ativo mais distante do feudo (`0,0`) por `hexDistance` (ADR 0022, D-24).
 * Sem sorteio: em empate na distância, escolhe o de menor identificador numérico (`outpost-1`
 * antes de `outpost-2`). Devolve `null` sem nenhum posto ativo.
 */
export function farthestActiveOutpost(state: GameState): Outpost | null {
  let target: Outpost | null = null;
  let maxDistance = -1;
  for (const post of state.map.outposts) {
    if (post.status !== 'active') continue;
    const distance = hexKeyDistance(post.hex);
    if (
      target === null ||
      distance > maxDistance ||
      (distance === maxDistance && outpostIdNumber(post.id) < outpostIdNumber(target.id))
    ) {
      target = post;
      maxDistance = distance;
    }
  }
  return target;
}

/**
 * Danifica o posto ativo mais distante quando um ataque rompe a defesa (V5F-T2; D-24).
 * Marca `status = 'damaged'` (o hexágono continua `claimed`), anota o posto no relatório da
 * batalha quando informado e emite `outpostDamaged`. Sem posto ativo, não altera nada.
 */
export function damageFarthestOutpost(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  battleId?: string,
): Outpost | null {
  const post = farthestActiveOutpost(draft);
  if (post === null) return null;
  post.status = 'damaged';
  post.readyAtMs = null;
  if (battleId !== undefined) {
    const index = draft.army.reports.findIndex((report) => report.id === battleId);
    if (index !== -1) {
      draft.army.reports[index] = {
        ...draft.army.reports[index]!,
        damagedOutpost: { id: post.id, hex: post.hex },
      };
    }
  }
  emit(
    events,
    draft,
    atMs,
    'outpostDamaged',
    { outpostId: post.id, hex: post.hex, ...(battleId === undefined ? {} : { battleId }) },
    { lugar: outpostPlace(draft, post.hex) },
  );
  return post;
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
