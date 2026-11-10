import {
  balance,
  buildings,
  type ResourceAmounts,
  UNIT_IDS,
  type UnitId,
  units,
} from '@lotg/content';

import { plural } from './format';
import type { GameState } from './types';
import { MILLI, paceScaled } from './units';

/**
 * O exército (GDD §5.2, §6.1 e §10.2; ADR 0019, decisão 7): as contas puras. Nada aqui sorteia
 * nem muda o estado. O soldado já saiu de `population.villagers` quando existe aqui, mas mora
 * nas casas e come (`inhabitants`, em `masters.ts`); não trabalha, não deserta e não conta no
 * piso de aldeões.
 */

export function isUnitId(value: unknown): value is UnitId {
  return (UNIT_IDS as readonly unknown[]).includes(value);
}

/** O nível do Quartel; 0 sem ele. */
export function barracksLevel(state: GameState): number {
  return state.settlement.buildings.barracks;
}

/** Quantos soldados há, de toda unidade. O lote em treino ainda não conta. */
export function soldierCount(state: GameState): number {
  return UNIT_IDS.reduce((sum, id) => sum + state.army.units[id], 0);
}

/** O limite de soldados no nível de agora: `10 × nível`; 0 sem o Quartel. */
export function armyCap(state: GameState): number {
  return balance.army.capPerLevel * barracksLevel(state);
}

/** Teto de um lote de treino: cresce com o ritmo, sem alterar as vagas do Quartel. */
export function trainingBatchMax(state: GameState): number {
  return paceScaled(balance.army.batchMax, state.settings.timeScale);
}

/**
 * O tempo de um lote no nível dado, em ms de jogo: `quantidade × tempo do soldado`, com cada
 * nível acima do 1 somando `trainingSpeedPerLevel` à velocidade. Uma conta só, com um
 * arredondamento para baixo; o tempo é fixado quando o lote começa.
 */
export function trainingDurationMs(level: number, unit: UnitId, amount: number): number {
  const { trainingSpeedPerLevel } = balance.army;
  const steps = Math.max(0, level - 1);
  return Math.floor(
    (amount * units[unit].trainMs * trainingSpeedPerLevel.den) /
      (trainingSpeedPerLevel.den + steps * trainingSpeedPerLevel.num),
  );
}

/** O custo em recursos de um lote, em unidades (sem as armas, que são contagem à parte). */
export function trainingCost(unit: UnitId): ResourceAmounts {
  return units[unit].cost;
}

/** As armas inteiras de um lote. */
export function trainingWeapons(unit: UnitId, amount: number): number {
  return units[unit].weapons * amount;
}

/** O que cancelar devolve: 80% de cada recurso (em milésimos) e das armas (inteiras), para baixo. */
export function trainingRefund(
  unit: UnitId,
  amount: number,
): { resources: ResourceAmounts; weapons: number } {
  const { cancelRefund } = balance.construction;
  const back = (value: number) => Math.floor((value * cancelRefund.num) / cancelRefund.den);
  const resources: ResourceAmounts = {};
  for (const [resource, each] of Object.entries(units[unit].cost)) {
    resources[resource as keyof ResourceAmounts] = back(each * amount * MILLI);
  }
  return { resources, weapons: back(trainingWeapons(unit, amount)) };
}

/** O instante em que o lote em treino termina; `null` sem lote. */
export function nextTrainingEndAt(state: GameState): number | null {
  return state.army.training?.endsAtMs ?? null;
}

/**
 * A comida que os soldados comem a mais do que comeriam como aldeões, em milésimos por hora de
 * jogo. O aldeão come `foodPerVillagerPerHour`; o soldado, `foodPerSoldierPerHour`.
 */
export function soldierFoodRate(state: GameState): number {
  const { foodPerSoldierPerHour } = balance.army;
  return Math.floor(
    (soldierCount(state) * MILLI * foodPerSoldierPerHour.num) / foodPerSoldierPerHour.den,
  );
}

/** O que os soldados comem a mais do que comeriam como aldeões, em milésimos por hora de jogo. */
export function soldierFoodExtra(state: GameState): number {
  return (
    soldierFoodRate(state) -
    soldierCount(state) * balance.consumption.foodPerVillagerPerHour * MILLI
  );
}

/**
 * A identidade do lote em treino: derivada do instante em que começou, da unidade e da
 * quantidade (um lote por vez; nada sorteia nem pede identificador). O cancelamento a confere.
 */
export function trainingLotKey(batch: {
  unit: UnitId;
  amount: number;
  startedAtMs: number;
}): string {
  return `${batch.startedAtMs}:${batch.unit}:${batch.amount}`;
}

/** "3 lanceiros", "1 espadachim": a tropa de um lote, nas frases da Crônica e da visão. */
export function troopText(unit: UnitId, amount: number): string {
  const def = units[unit];
  return plural(amount, def.label.toLowerCase(), def.pluralLabel);
}

/** A recusa de quem pede o Quartel sem ele de pé: o nome dele e o que o abre. */
export function barracksRequiresText(state: GameState): string {
  const level = buildings.barracks.requires.townHall;
  return level === undefined || state.settlement.buildings.townHall >= level
    ? ''
    : ` O Quartel pede ${buildings.townHall.article} ${buildings.townHall.label} no nível ${level}.`;
}
