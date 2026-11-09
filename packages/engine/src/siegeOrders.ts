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

/** Ficha 11.5: a prontidão reserva um limite; o trabalho só para ao começar a batalha. */
export function readyMilitiaCount(state: GameState): number {
  const share = balance.army.militia.readyShare;
  return Math.min(
    ableVillagers(state),
    Math.floor((state.settlement.population.villagers * share.num) / share.den),
  );
}

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

/** O avanço precede a ordem: a onda da visão precisa continuar sendo a da decisão aberta. */
function decidedWave(draft: GameState, wave: unknown, nowMs: number): SiegeWaveNumber | null {
  if (!waveDecisionOpen(draft, nowMs)) return null;
  const decided = (draft.siege!.current + 1) as SiegeWaveNumber;
  return wave === decided ? decided : null;
}

export function swapWaveFormation(
  draft: GameState,
  waveNumber: unknown,
  formationId: unknown,
  nowMs: number,
  events: GameEvent[],
): SiegeRejection | null {
  const wave = decidedWave(draft, waveNumber, nowMs);
  if (wave === null) return { code: 'NO_WAVE_DECISION', message: siegeTexts.noDecision };
  if (!formationValid(draft, formationId)) return reject('FORMATION_NOT_FOUND');
  const siege = draft.siege!;
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
  waveNumber: unknown,
  nowMs: number,
  events: GameEvent[],
): SiegeRejection | null {
  if (decidedWave(draft, waveNumber, nowMs) === null)
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

export type MilitiaCallCheck = {
  maxCount: number;
  warningMs: number;
  untilMs: number | null;
  rejection: SiegeRejection | null;
};

/**
 * Validação única da convocação da milícia (GDD §11.3; ADR 0020, decisão 21; V4G-T2.10).
 * Compartilhada entre `callMilitia` e `siegeView` para que a oferta e a recusa nunca divirjam.
 */
export function checkMilitiaCall(
  state: GameState,
  count?: unknown,
  nowMs = state.lastProcessedAt,
  fromCouncil = false,
): MilitiaCallCheck {
  const totalVillagers = state.settlement.population.villagers;
  const maxShare = balance.army.militia.maxShare;
  const maxByVillagers = Math.floor((totalVillagers * maxShare.num) / maxShare.den);
  const maxAble = ableVillagers(state);
  const maxCount = Math.min(maxByVillagers, maxAble);
  const requested = count === undefined ? maxCount : count;

  const tower = watchtowerLevel(state);
  const perks = watchtowerPerks(tower);
  const warningMs = fromCouncil
    ? Math.max(0, (state.siege?.atMs ?? nowMs) - nowMs)
    : perks === null
      ? 0
      : watchtowerWarningMs(state, perks);

  if (state.settlement.militia !== null) {
    return {
      maxCount,
      warningMs,
      untilMs: state.settlement.militia.untilMs,
      rejection: { code: 'MILITIA_ACTIVE', message: siegeTexts.militiaActive },
    };
  }

  if (perks === null && !fromCouncil) {
    return {
      maxCount,
      warningMs,
      untilMs: null,
      rejection: { code: 'MILITIA_NOT_ALLOWED', message: siegeTexts.militiaNotAllowed },
    };
  }

  const deadline = nowMs + warningMs;
  const qualifyingTimes: number[] = [];

  for (const raid of state.horde.scheduledRaids) {
    if (!fromCouncil && raid.size === 'strong' && raid.atMs >= nowMs && raid.atMs <= deadline) {
      qualifyingTimes.push(raid.atMs);
    }
  }

  const siege = state.siege;
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
    return {
      maxCount,
      warningMs,
      untilMs: null,
      rejection: { code: 'MILITIA_NOT_ALLOWED', message: siegeTexts.militiaNotAllowed },
    };
  }

  const untilMs = Math.min(...qualifyingTimes);

  if (
    !Number.isSafeInteger(requested) ||
    (requested as number) < 1 ||
    (requested as number) > maxCount
  ) {
    return {
      maxCount,
      warningMs,
      untilMs,
      rejection: {
        code: 'INVALID_MILITIA_AMOUNT',
        message: maxCount === 0 ? siegeTexts.militiaUnavailable : siegeTexts.militiaAmount,
      },
    };
  }

  const isSiege = siege !== null && siege.nextWaveAtMs === untilMs;
  const waveNumber = isSiege ? ((siege.current + 1) as SiegeWaveNumber) : null;
  const formationId =
    isSiege && waveNumber !== null
      ? (siege.plan[waveNumber] ?? state.army.activeFormationId)
      : state.army.activeFormationId;
  const formation = state.army.formations.find((f) => f.id === formationId) ?? null;
  const defender = buildDefender(formation, availableUnits(state), () => null);
  const hasFreeSlot = MILITIA_POST_PRIORITY.some(
    (slot) => defender.posts[slot.wing][slot.line] === null,
  );
  if (!hasFreeSlot) {
    return {
      maxCount,
      warningMs,
      untilMs,
      rejection: { code: 'NO_MILITIA_SLOT', message: siegeTexts.militiaNoSlot },
    };
  }

  return { maxCount, warningMs, untilMs, rejection: null };
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
  fromCouncil = false,
): SiegeRejection | null {
  const check = checkMilitiaCall(draft, count, nowMs, fromCouncil);
  if (check.rejection !== null) return check.rejection;

  const amount = count as number;
  draft.settlement.militia = { count: amount, untilMs: check.untilMs! };
  releaseExcessWorkers(draft);
  draft.stats.militiaCalled = (draft.stats.militiaCalled ?? 0) + amount;
  emit(events, draft, nowMs, 'militiaCalled', { count: amount }, { quantidade: amount });
  return null;
}
