import { balance, siegeTexts } from '@lotg/content';

import { emit } from './chronicle';
import { availableUnits } from './campaign';
import { missingResources, payResources } from './construction';
import { ableVillagers, releaseExcessWorkers } from './population';
import { buildDefender, MILITIA_POST_PRIORITY } from './raidArmy';
import { reject } from './rejections';
import { waveDecisionOpen } from './siege';
import { watchtowerLevel, watchtowerPerks, watchtowerWarningMs } from './threat';
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

/**
 * Convocação da milícia de aldeões (GDD §11.3; ADR 0020, decisão 21).
 * Permitida somente quando houver incursão forte ou cerco/onda marcados dentro da antecedência da Torre de Vigia.
 * Até 50% dos aldeões (limitados aos aldeões aptos).
 */
export function callMilitia(
  draft: GameState,
  count: unknown,
  nowMs: number,
  events: GameEvent[],
): SiegeRejection | null {
  if (draft.settlement.militia !== null) {
    return { code: 'MILITIA_ACTIVE', message: siegeTexts.militiaActive };
  }

  const tower = watchtowerLevel(draft);
  const perks = watchtowerPerks(tower);
  if (perks === null) {
    return { code: 'MILITIA_NOT_ALLOWED', message: siegeTexts.militiaNotAllowed };
  }

  const warningMs = watchtowerWarningMs(draft, perks);
  const deadline = nowMs + warningMs;
  const qualifyingTimes: number[] = [];

  for (const raid of draft.horde.scheduledRaids) {
    if (raid.size === 'strong' && raid.atMs >= nowMs && raid.atMs <= deadline) {
      qualifyingTimes.push(raid.atMs);
    }
  }

  const siege = draft.siege;
  if (
    siege !== null &&
    siege.result === null &&
    siege.nextWaveAtMs !== null &&
    siege.nextWaveAtMs >= nowMs &&
    siege.nextWaveAtMs <= deadline
  ) {
    qualifyingTimes.push(siege.nextWaveAtMs);
  }

  if (qualifyingTimes.length === 0) {
    return { code: 'MILITIA_NOT_ALLOWED', message: siegeTexts.militiaNotAllowed };
  }

  const totalVillagers = draft.settlement.population.villagers;
  const maxShare = balance.army.militia.maxShare;
  const maxByVillagers = Math.floor((totalVillagers * maxShare.num) / maxShare.den);
  const maxAble = ableVillagers(draft);
  const maxAllowed = Math.min(maxByVillagers, maxAble);

  if (!Number.isSafeInteger(count) || (count as number) < 1 || (count as number) > maxAllowed) {
    return { code: 'INVALID_MILITIA_AMOUNT', message: siegeTexts.militiaAmount };
  }

  const amount = count as number;
  const untilMs = Math.min(...qualifyingTimes);

  const isSiege = siege !== null && siege.nextWaveAtMs === untilMs;
  const waveNumber = isSiege ? ((siege.current + 1) as SiegeWaveNumber) : null;
  const formationId =
    isSiege && waveNumber !== null
      ? (siege.plan[waveNumber] ?? draft.army.activeFormationId)
      : draft.army.activeFormationId;
  const formation = draft.army.formations.find((f) => f.id === formationId) ?? null;
  const defender = buildDefender(formation, availableUnits(draft), () => null);
  const hasFreeSlot = MILITIA_POST_PRIORITY.some(
    (slot) => defender.posts[slot.wing][slot.line] === null,
  );
  if (!hasFreeSlot) {
    return { code: 'NO_MILITIA_SLOT', message: siegeTexts.militiaNoSlot };
  }

  draft.settlement.militia = { count: amount, untilMs };
  releaseExcessWorkers(draft);
  draft.stats.militiaCalled = (draft.stats.militiaCalled ?? 0) + amount;
  emit(events, draft, nowMs, 'militiaCalled', { count: amount }, { quantidade: amount });
  return null;
}
