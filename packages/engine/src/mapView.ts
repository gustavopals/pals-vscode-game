import { balance, mapScenarios, mapTexts, terrains, tileTypes } from '@lotg/content';
import { costView } from './costView';
import { fillText } from './format';
import { claimOutpostBlock, repairOutpostBlock } from './outpostOrders';
import { describeAmounts } from './rejections';
import { realSecondsCeil } from './units';
import { expeditionLabel } from './expeditions';
import { mapCoordinates, siteDestination } from './hexmap';
import type { GameState, ViewState, MapHexView, MapActionView } from './types';

export function mapView(
  state: GameState,
  guild: ViewState['guild'],
  army: ViewState['army'],
  timeScale: number,
): ViewState['map'] {
  const hexes = mapCoordinates.map(({ q, r }): MapHexView => {
    const key = `${q},${r}` as const;
    const hex = state.map.hexes[key]!;
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
    const post = state.map.outposts.find((entry) => entry.hex === key);
    if (!post && claimOutpostBlock(state, key) === null)
      actions.push({ type: 'claimOutpost', hex: key });
    const repairBlocked = post?.status === 'damaged' ? repairOutpostBlock(state, post.id) : null;
    if (post?.status === 'damaged' && repairBlocked === null)
      actions.push({ type: 'repairOutpost', outpostId: post.id });
    let label: string = terrain.label;
    if (q === 0 && r === 0) label = state.settlement.name;
    else if (tile) label = tileTypes[tile.type].label;
    else if (destination) label = expeditionLabel(destination);
    const damagedDetail =
      post?.status === 'damaged'
        ? fillText(mapTexts.outpostDamagedDetail, {
            custo: describeAmounts(balance.outposts.repairCost),
          })
        : null;
    const detail =
      damagedDetail ??
      (hex.terrain === 'sanctuary' && (state.stats.sanctuaryClaimed ?? 0) > 0
        ? mapTexts.sanctuaryClaimedDetail
        : terrain.detail);
    return {
      ...visible,
      fog: hex.fog,
      site,
      label,
      detail,
      actions,
      ...(post && {
        outpost: {
          id: post.id,
          status: post.status,
          readyInSeconds:
            post.readyAtMs === null
              ? null
              : realSecondsCeil(post.readyAtMs - state.lastProcessedAt, timeScale),
          ...(damagedDetail !== null && {
            detail: damagedDetail,
            repairCost: costView(state, balance.outposts.repairCost),
            repairBlockedReason: repairBlocked?.message ?? null,
          }),
        },
      }),
    };
  });
  return {
    radius: state.map.radius,
    scenario: state.map.scenario,
    scenarioLabel: mapScenarios[state.map.scenario].label,
    hexes,
  };
}
