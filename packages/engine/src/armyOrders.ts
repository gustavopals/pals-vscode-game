import { balance, campaignTexts, formationTexts, units, WING_IDS } from '@lotg/content';

import {
  armyCap,
  barracksLevel,
  barracksRequiresText,
  isUnitId,
  soldierCount,
  trainingBatchMax,
  trainingCost,
  trainingDurationMs,
  trainingLotKey,
  trainingRefund,
  trainingWeapons,
  troopText,
} from './army';
import { availableUnits, formationCount } from './campaign';
import { commandingBlock, findFormation, nominationReason } from './formations';
import { canDepart } from './heroes';
import { buildDefender } from './raidArmy';
import { watchtowerLevel } from './threat';
import { emit } from './chronicle';
import { amountsData, missingResources, payResources } from './construction';
import { reject } from './rejections';
import { storeResource } from './storage';
import type { Formation, GameEvent, GameState, Rejection } from './types';
import { MILLI, paceScaled } from './units';

/**
 * As ordens do Quartel (GDD §10.2; ADR 0019, decisão 7). **Nenhuma sorteia**: o lote termina no
 * instante marcado (`army.training.endsAtMs`), que `advanceTo` resolve (`armyTurn.ts`).
 */

/** O motivo de uma ordem de treino de `amount` soldados de `unit` ser recusada agora; `null` se seria aceita. */
export function trainingBlock(state: GameState, unit: unknown, amount: unknown): Rejection | null {
  if (!isUnitId(unit)) {
    return reject('INVALID_UNIT');
  }
  const level = barracksLevel(state);
  if (level === 0) {
    return reject('BARRACKS_REQUIRED', { note: barracksRequiresText(state) });
  }
  const batchMax = trainingBatchMax(state);
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > batchMax) {
    return reject('INVALID_AMOUNT', {
      note: `Treine um número inteiro de soldados, de 1 a ${batchMax}.`,
    });
  }
  if (state.army.training !== null) {
    return reject('TRAINING_BUSY');
  }
  const room = armyCap(state) - soldierCount(state);
  if (amount > room) {
    return reject('ARMY_LIMIT', {
      count: Math.max(0, room),
      level,
      capacity: paceScaled(balance.army.capPerLevel, state.settings.timeScale),
    });
  }
  const { populationFloor } = balance.morale;
  const spare = Math.max(0, state.settlement.population.villagers - populationFloor);
  if (amount > spare) {
    return reject('NOT_ENOUGH_VILLAGERS', {
      count: spare,
      note: `O soldado sai da população, e o feudo guarda ao menos ${populationFloor} aldeões.`,
    });
  }
  const weapons = trainingWeapons(unit, amount);
  if (weapons > state.settlement.weapons) {
    return reject('NOT_ENOUGH_WEAPONS', { count: weapons - state.settlement.weapons });
  }
  const missing = missingResources(state, trainingCost(unit), amount);
  if (missing !== null) {
    return reject('INSUFFICIENT_RESOURCES', { missing });
  }
  return null;
}

/**
 * A ordem de treinar (`trainSoldiers`). As recusas, na ordem de `trainingBlock`: a unidade que
 * não existe, o Quartel que falta, a quantidade, um lote já no pátio, o limite do exército, os
 * aldeões que o piso protege, as armas e os recursos. Aceita, cobra o custo inteiro **agora** e
 * fixa o instante do fim com o nível que o Quartel tem neste momento.
 */
export function trainSoldiers(
  draft: GameState,
  unit: unknown,
  amount: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const blocked = trainingBlock(draft, unit, amount);
  if (blocked !== null) {
    return blocked;
  }
  const kind = unit as keyof typeof units;
  const count = amount as number;
  payResources(draft, trainingCost(kind), count);
  draft.settlement.weapons -= trainingWeapons(kind, count);
  draft.army.training = {
    unit: kind,
    amount: count,
    startedAtMs: nowMs,
    endsAtMs: nowMs + trainingDurationMs(barracksLevel(draft), kind, count),
  };
  emit(
    events,
    draft,
    nowMs,
    'trainingStarted',
    {
      unit: kind,
      amount: count,
      ...amountsData(
        'spent',
        Object.fromEntries(
          Object.entries(trainingCost(kind)).map(([resource, each]) => [resource, each * count]),
        ),
      ),
      spent_weapons: trainingWeapons(kind, count),
    },
    { tropa: troopText(kind, count) },
  );
  return null;
}

/**
 * A ordem de cancelar o lote em treino (`cancelTraining`): devolve 80% do custo, arredondando
 * para baixo, e as armas inteiras que couberem nos 80%. Os recursos entram no que cabe no
 * depósito; o resto é desperdício contado.
 */
export function cancelTraining(
  draft: GameState,
  lotKey: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const batch = draft.army.training;
  if (batch === null) {
    return reject('NOT_TRAINING');
  }
  // O lote que o jogador viu terminou e outro entrou: cancelar este seria cancelar o que ele não viu.
  if (trainingLotKey(batch) !== lotKey) {
    return reject('TRAINING_CHANGED');
  }
  const refund = trainingRefund(batch.unit, batch.amount);
  const gained: Record<string, number> = {};
  const lost: Record<string, number> = {};
  for (const [resource, milli] of Object.entries(refund.resources)) {
    const stored = storeResource(draft, resource as 'food', milli);
    if (stored > 0) {
      gained[resource] = stored / MILLI;
    }
    if (stored < milli) {
      lost[resource] = (milli - stored) / MILLI;
    }
  }
  draft.settlement.weapons += refund.weapons;
  draft.army.training = null;
  emit(
    events,
    draft,
    nowMs,
    'trainingCancelled',
    {
      unit: batch.unit,
      amount: batch.amount,
      ...amountsData('gained', gained),
      ...amountsData('lost', lost),
      weapons_back: refund.weapons,
    },
    { tropa: troopText(batch.unit, batch.amount) },
  );
  return null;
}

/**
 * A ordem de dispensar (`disbandSoldiers`): `amount` soldados de `unit` viram aldeões sem
 * ofício, **sem devolver o custo**. As recusas: a unidade que não existe, a quantidade que não
 * é um inteiro de 1 até quantos há (`INVALID_AMOUNT`) e quem não há (`NOT_ENOUGH_SOLDIERS`).
 */
export function disbandSoldiers(
  draft: GameState,
  unit: unknown,
  amount: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (!isUnitId(unit)) {
    return reject('INVALID_UNIT');
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1) {
    return reject('INVALID_AMOUNT', {
      note: 'Dispense um número inteiro de soldados, a partir de 1.',
    });
  }
  const have = availableUnits(draft)[unit];
  if (amount > have) {
    return reject('NOT_ENOUGH_SOLDIERS', { count: have });
  }
  draft.army.units[unit] -= amount;
  draft.settlement.population.villagers += amount;
  emit(
    events,
    draft,
    nowMs,
    'soldiersDisbanded',
    {
      unit,
      amount,
      soldiers: draft.army.units[unit],
      villagers: draft.settlement.population.villagers,
    },
    { tropa: troopText(unit, amount) },
  );
  return null;
}

/** A fotografia da tropa que pode partir; o plano pode pedir mais soldados do que existem. */
function departingFormation(state: GameState, formation: Formation): Formation {
  const player = buildDefender(formation, availableUnits(state), (heroId) => {
    const hero = state.guild.heroes.find((entry) => entry.id === heroId);
    return hero !== undefined && canDepart(hero) && hero.injury === null ? hero.classId : null;
  });
  return {
    id: formation.id,
    name: formation.name,
    posts: player.posts as unknown as Formation['posts'],
    commanders: Object.fromEntries(
      WING_IDS.map((wing) => [
        wing,
        player.posts[wing].front === null && player.posts[wing].back === null
          ? null
          : (player.commanders[wing]?.heroId ?? null),
      ]),
    ) as Formation['commanders'],
  };
}

/** Validação sem sorteio, usada pela ordem e pela visão. */
export function attackCampBlock(state: GameState, formationId: unknown): Rejection | null {
  if (state.army.campaign !== null) return reject('ARMY_AWAY');
  const camp = state.map.tiles.raiderCamp;
  // O tile só é conhecido com a Torre. A recusa é a mesma com tile ausente, oculto ou limpo.
  if (camp?.type !== 'raiderCamp' || !camp.threatActive || watchtowerLevel(state) === 0)
    return reject('CAMP_NOT_FOUND');
  const formation = findFormation(state, formationId);
  if (formation === undefined) return reject('FORMATION_NOT_FOUND');
  const departing = departingFormation(state, formation);
  if (formationCount(departing) === 0) return reject('NO_SOLDIERS');
  for (const wing of WING_IDS) {
    if (departing.posts[wing].front === null && departing.posts[wing].back === null) continue;
    const heroId = formation.commanders[wing];
    if (heroId === null) continue;
    const hero = state.guild.heroes.find((entry) => entry.id === heroId);
    if (hero === undefined) return reject('HERO_NOT_FOUND');
    if (!canDepart(hero) || hero.injury !== null) {
      return reject('HERO_UNAVAILABLE', {
        label: hero.name,
        remedy: nominationReason(hero) ?? formationTexts.heroInjured,
      });
    }
    if (formation.id !== state.army.activeFormationId) {
      const blocked = commandingBlock(state, hero);
      if (blocked !== null) return blocked;
    }
  }
  if (
    WING_IDS.filter((wing) => departing.commanders[wing] !== null).length <
    balance.army.campaign.minCommanders
  ) {
    return reject('HERO_UNAVAILABLE', {
      label: campaignTexts.label,
      remedy: campaignTexts.commanderRequired,
    });
  }
  return null;
}

/** A ordem só reserva tropa e marca os instantes. O fluxo battle:<id> nasce na chegada. */
export function attackCamp(
  draft: GameState,
  formationId: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const blocked = attackCampBlock(draft, formationId);
  if (blocked !== null) return blocked;
  const formation = departingFormation(draft, findFormation(draft, formationId)!);
  const { travelMs } = balance.army.campaign;
  draft.army.campaign = {
    formationId: formation.id,
    formation,
    tile: 'raiderCamp',
    departsAtMs: nowMs,
    battleAtMs: nowMs + travelMs,
    returnsAtMs: nowMs + travelMs * 2,
    report: null,
  };
  for (const heroId of Object.values(formation.commanders)) {
    const hero = draft.guild.heroes.find((entry) => entry.id === heroId);
    if (hero !== undefined) hero.status = 'campaign';
  }
  emit(events, draft, nowMs, 'armyMarched', {
    formationId: formation.id,
    tileId: 'raiderCamp',
    soldiers: formationCount(formation),
  });
  return null;
}
