import {
  expeditionMapTemplate,
  mapRules,
  relics,
  sanctuaryConsolationTemplate,
  sanctuaryReward,
} from '@lotg/content';

import { emit } from './chronicle';
import { hexDistance, hexNeighbors, mapCoordinates, siteDestination, type Axial } from './hexmap';
import { grantRelic } from './relics';
import { storeResource } from './storage';
import type { Expedition, GameEvent, GameState } from './types';
import { MILLI } from './units';

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

/**
 * O Santuário entrega uma relíquia uma única vez por partida quando explorado (GDD §8.1; D-6).
 * Sem sorteio: percorre `sanctuaryReward.from` e concede a primeira que o feudo ainda não possui
 * via `grantRelic`. Com todas as oito já no feudo, credita `consolationGold` em ouro.
 */
function claimSanctuary(draft: GameState, key: string, atMs: number, events: GameEvent[]): void {
  if ((draft.stats.sanctuaryClaimed ?? 0) > 0) return;
  draft.stats.sanctuaryClaimed = 1;
  const next = sanctuaryReward.from.find(
    (id) => !draft.settlement.relics.some((entry) => entry.defId === id),
  );
  if (next !== undefined) {
    emit(
      events,
      draft,
      atMs,
      'sanctuaryExplored',
      { hex: key, relicId: next },
      { reliquia: relics[next].label },
    );
    grantRelic(draft, next, atMs, events);
    return;
  }
  storeResource(draft, 'gold', sanctuaryReward.consolationGold * MILLI);
  emit(
    events,
    draft,
    atMs,
    'sanctuaryExplored',
    { hex: key, gained_gold: sanctuaryReward.consolationGold },
    { quantidade: sanctuaryReward.consolationGold },
    sanctuaryConsolationTemplate,
  );
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

  const newlyExplored: `${number},${number}`[] = [];
  const targetKey = `${target.q},${target.r}` as const;
  let count = advanceFog(hexes[targetKey]!, 'explored');
  if (count > 0) newlyExplored.push(targetKey);
  if (tracker) {
    const extra = nearestFrontier(hexes, patrol ? home : target);
    if (extra !== undefined) {
      const extraKey = `${extra.q},${extra.r}` as const;
      const added = advanceFog(hexes[extraKey]!, 'explored');
      if (added > 0) {
        count += added;
        newlyExplored.push(extraKey);
      }
    }
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
    for (const key of newlyExplored) {
      if (hexes[key]!.terrain === 'sanctuary') {
        claimSanctuary(draft, key, atMs, events);
      }
    }
  }
}
