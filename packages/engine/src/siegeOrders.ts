import { siegeTexts } from '@lotg/content';

import { emit } from './chronicle';
import { missingResources, payResources } from './construction';
import { reject } from './rejections';
import { waveDecisionOpen } from './siege';
import { wallFullHp } from './wall';
import { currentRepairQuote, wallRepairBlocked } from './wallRepair';
import type { GameEvent, GameState, SiegeRejection, SiegeWaveNumber } from './types';

function formationValid(draft: GameState, id: unknown): boolean {
  return id === null || (typeof id === 'string' && draft.army.formations.some((f) => f.id === id));
}

export function setBattlePlan(
  draft: GameState,
  wave: unknown,
  formationId: unknown,
  nowMs: number,
  events: GameEvent[],
): SiegeRejection | null {
  const siege = draft.siege;
  if (siege === null) return { code: 'SIEGE_NOT_SCHEDULED', message: siegeTexts.notScheduled };
  if (siege.current > 0 || siege.result !== null)
    return { code: 'SIEGE_STARTED', message: siegeTexts.started };
  if (![1, 2, 3].includes(wave as number))
    return { code: 'INVALID_WAVE', message: siegeTexts.invalidWave };
  if (!formationValid(draft, formationId)) return reject('FORMATION_NOT_FOUND');
  const number = wave as SiegeWaveNumber;
  const id = formationId as string | null;
  if (siege.plan[number] === id) return null;
  siege.plan[number] = id;
  emit(
    events,
    draft,
    nowMs,
    'battlePlanSet',
    { wave: number, formationId: id ?? '' },
    {
      onda: siegeTexts.waves[number],
      formacao: draft.army.formations.find((f) => f.id === id)?.name ?? siegeTexts.defaultFormation,
    },
  );
  return null;
}

export function swapWaveFormation(
  draft: GameState,
  formationId: unknown,
  nowMs: number,
  events: GameEvent[],
): SiegeRejection | null {
  if (!waveDecisionOpen(draft, nowMs))
    return { code: 'NO_WAVE_DECISION', message: siegeTexts.noDecision };
  if (!formationValid(draft, formationId)) return reject('FORMATION_NOT_FOUND');
  const siege = draft.siege!;
  const wave = (siege.current + 1) as SiegeWaveNumber;
  const id = formationId as string | null;
  if (siege.plan[wave] === id) return null;
  siege.plan[wave] = id;
  emit(
    events,
    draft,
    nowMs,
    'waveFormationSwapped',
    { wave, formationId: id ?? '' },
    {
      onda: siegeTexts.waves[wave],
      formacao: draft.army.formations.find((f) => f.id === id)?.name ?? siegeTexts.defaultFormation,
    },
  );
  return null;
}

/** Reparo imediato entre ondas. O ADR exige o ouro igual à pedra, além da decisão 20. */
export function emergencyRepair(
  draft: GameState,
  nowMs: number,
  events: GameEvent[],
): SiegeRejection | null {
  if (!waveDecisionOpen(draft, nowMs))
    return { code: 'NO_WAVE_DECISION', message: siegeTexts.noDecision };
  const blocked = wallRepairBlocked(draft);
  if (blocked !== null) return blocked;
  const quote = currentRepairQuote(draft);
  const cost = { stone: quote.stone, gold: quote.gold };
  const missing = missingResources(draft, cost);
  if (missing !== null) return reject('INSUFFICIENT_RESOURCES', { missing });
  payResources(draft, cost);
  draft.settlement.wall.hp = wallFullHp(draft.settlement.buildings.palisade);
  emit(events, draft, nowMs, 'wallRepaired', {
    emergency: 1,
    spent_stone: quote.stone,
    spent_gold: quote.gold,
    palisadeLevel: draft.settlement.buildings.palisade,
  });
  return null;
}
