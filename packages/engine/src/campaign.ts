import { campaignTexts, LINE_IDS, WING_IDS } from '@lotg/content';

import type { Formation, GameState, UnitId } from './types';

/** O total do Quartel inclui quem partiu; só os que ficaram podem defender ou ser dispensados. */
export function availableUnits(state: GameState): Record<UnitId, number> {
  const left = { ...state.army.units };
  const formation = state.army.campaign?.formation;
  if (formation === undefined) return left;
  for (const wing of WING_IDS)
    for (const line of LINE_IDS) {
      const post = formation.posts[wing][line];
      if (post !== null) left[post.unit] -= post.count;
    }
  return left;
}

export function formationCount(formation: Formation): number {
  return WING_IDS.reduce(
    (total, wing) =>
      total + LINE_IDS.reduce((sum, line) => sum + (formation.posts[wing][line]?.count ?? 0), 0),
    0,
  );
}

/** A unidade reservada não é derivada da formação salva: editar o plano não move quem partiu. */
export function campaignWarning(state: GameState): string | null {
  return state.army.campaign === null ? null : campaignTexts.away;
}

export function nextCampaignEventAt(state: GameState): number | null {
  const campaign = state.army.campaign;
  return campaign === null
    ? null
    : campaign.report === null
      ? campaign.battleAtMs
      : campaign.returnsAtMs;
}
