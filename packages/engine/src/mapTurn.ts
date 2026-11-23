import { expeditionMapTemplate, mapRules } from '@lotg/content';

import { emit } from './chronicle';
import { hexDistance, hexNeighbors, mapCoordinates, siteDestination, type Axial } from './hexmap';
import type { Expedition, GameEvent, GameState } from './types';

type Hex = GameState['map']['hexes'][`${number},${number}`];
type Grid = GameState['map']['hexes'];

function isExplored(hex: Hex | undefined): boolean {
  return hex?.fog === 'explored' || hex?.fog === 'claimed';
}

function advanceFog(hex: Hex, next: 'sighted' | 'explored'): number {
  if (isExplored(hex) || hex.fog === next) return 0;
  hex.fog = next;
  return 1;
}

/** Desempata pela ordem da grade, independente das chaves do JSONB. */
function nearestFrontier(hexes: Grid, origin: Axial): Axial | undefined {
  let nearest: Axial | undefined;
  let bestDistance = Infinity;
  for (const candidate of mapCoordinates) {
    const { q, r } = candidate;
    const distance = hexDistance(q - origin.q, r - origin.r);
    if (distance >= bestDistance || isExplored(hexes[`${q},${r}`])) continue;
    if (
      hexNeighbors(candidate).some((neighbor) => isExplored(hexes[`${neighbor.q},${neighbor.r}`]))
    ) {
      nearest = candidate;
      bestDistance = distance;
    }
  }
  return nearest;
}

export function revealWatchtower(draft: GameState, atMs: number, events: GameEvent[]): void {
  const level = draft.settlement.buildings.watchtower;
  const { radius, hexes } = draft.map;
  const sight = Math.min(radius, mapRules.sightedRadius + level * mapRules.watchtowerRingsPerLevel);
  let count = 0;
  for (const { q, r } of mapCoordinates) {
    if (hexDistance(q, r) > sight) break;
    count += advanceFog(hexes[`${q},${r}`]!, 'sighted');
  }
  if (count > 0) emit(events, draft, atMs, 'mapRevealed', { source: 'watchtower', level, count });
}

export function revealExpedition(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  { id, modelId }: Pick<Expedition, 'id' | 'modelId'>,
  label: string,
  tracker: boolean,
): void {
  const { hexes } = draft.map;
  const patrol = modelId === 'patrol';
  const home = { q: 0, r: 0 };
  const target = patrol
    ? nearestFrontier(hexes, home)
    : mapCoordinates.find(({ q, r }) => {
        const site = hexes[`${q},${r}`]!.site;
        return site !== undefined && siteDestination(site) === modelId;
      });
  if (target === undefined) return;

  let count = advanceFog(hexes[`${target.q},${target.r}`]!, 'explored');
  if (tracker) {
    const extra = nearestFrontier(hexes, patrol ? home : target);
    if (extra !== undefined) count += advanceFog(hexes[`${extra.q},${extra.r}`]!, 'explored');
  }
  if (count > 0) {
    emit(
      events,
      draft,
      atMs,
      'mapRevealed',
      { source: 'expedition', expeditionId: id, modelId, count },
      { expedicao: label },
      expeditionMapTemplate,
    );
  }
}
