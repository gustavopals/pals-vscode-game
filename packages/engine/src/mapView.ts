import { terrains, tileTypes } from '@lotg/content';
import { expeditionLabel } from './expeditions';
import { mapCoordinates, siteDestination } from './hexmap';
import type { GameState, ViewState, MapHexView, MapActionView } from './types';

export function mapView(
  state: GameState,
  guild: ViewState['guild'],
  army: ViewState['army'],
): ViewState['map'] {
  const hexes = mapCoordinates.map(({ q, r }): MapHexView => {
    const hex = state.map.hexes[`${q},${r}`]!;
    if (hex.fog === 'unknown') return { q, r };
    const terrain = terrains[hex.terrain];
    const visible = { q, r, terrain: hex.terrain, terrainLabel: terrain.label };
    if (hex.fog === 'sighted') return { ...visible, fog: hex.fog };
    let site = hex.site ?? null;
    const tile = site && state.map.tiles[site];
    // O terreno pode estar explorado antes de o Acampamento ou a Fortaleza aparecer.
    if ((site === 'hordeFortress' || site === 'raiderCamp') && !tile) site = null;
    const destination = site && siteDestination(site);
    const actions: MapActionView[] = [];
    if (
      destination &&
      guild.available.some((offer) => offer.modelId === destination && offer.canSend)
    )
      actions.push({ type: 'sendExpedition', modelId: destination });
    if (
      site === 'raiderCamp' &&
      army.campAssault.formations.some((formation) => formation.canAttack)
    )
      actions.push({ type: 'attackCamp' });
    let label: string = terrain.label;
    if (q === 0 && r === 0) label = state.settlement.name;
    else if (tile) label = tileTypes[tile.type].label;
    else if (destination) label = expeditionLabel(destination);
    return { ...visible, fog: hex.fog, site, label, detail: terrain.detail, actions };
  });
  return { radius: state.map.radius, hexes };
}
