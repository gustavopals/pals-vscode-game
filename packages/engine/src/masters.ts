import {
  balance,
  MASTER_IDS,
  type MasterId,
  masters as masterDefs,
  masterTexts,
  type Ratio,
} from '@lotg/content';

import type { GameState, Master, ProductionBuildingId } from './types';

/**
 * Os Mestres (GDD §5.4; ADR 0018, decisão 18): as perguntas que o resto do motor faz sobre
 * eles. Aqui nada muda o estado além do fim da adaptação; quem entrega um Mestre é
 * `masterTurn.ts`, e quem o põe em um edifício, `masterOrders.ts`.
 *
 * **O desenho.** O Mestre **não é um dos `population.villagers`**: mora em `settlement.masters`.
 * As contas de habitante (casa, comida, lenha, casas cheias, piso) somam os dois
 * (`inhabitants`); as contas de aldeão (ofício, adaptação por coortes, quem parte, deserta ou se
 * fere) continuam só com `population.villagers` e por isso **não alcançam o Mestre por
 * construção**: nenhuma delas tem como escolhê-lo. No edifício, ele é um braço a mais, fora de
 * `settlement.workers` (que é o que a ordem `setWorkers` define) e fora das coortes: a
 * adaptação dele é um prazo só, o dele.
 */

/** "Mestre Odo", "Mestra Berta": o nome com o tratamento. */
export function masterLabel(masterId: MasterId): string {
  const def = masterDefs[masterId];
  return `${def.gender === 'f' ? masterTexts.titleFeminine : masterTexts.titleMasculine} ${def.name}`;
}

export function isMasterId(value: unknown): value is MasterId {
  return (MASTER_IDS as readonly unknown[]).includes(value);
}

/**
 * Os habitantes do feudo: os aldeões e os Mestres. É quem ocupa casa, come e queima lenha, e é
 * o número que o piso de população protege.
 */
export function inhabitants(state: GameState): number {
  const { population, masters } = state.settlement;
  return population.villagers + masters.length;
}

/** O Mestre que trabalha em `building`; `null` sem nenhum. Cabe um por edifício. */
export function masterOf(state: GameState, building: ProductionBuildingId): Master | null {
  return state.settlement.masters.find((master) => master.building === building) ?? null;
}

/** Este Mestre ainda se adapta no instante `atMs`. */
export function masterAdaptingAt(master: Master, atMs: number): boolean {
  return master.adaptingUntilMs !== null && master.adaptingUntilMs > atMs;
}

/**
 * O braço que o Mestre de `building` é no instante `atMs`: `adapted` rende inteiro e dá o bônus;
 * `adapting` rende a fração de quem acabou de chegar e não dá bônus nenhum; `null` sem Mestre.
 */
export function masterArmAt(
  state: GameState,
  building: ProductionBuildingId,
  atMs: number,
): 'adapted' | 'adapting' | null {
  const master = masterOf(state, building);
  if (master === null) {
    return null;
  }
  return masterAdaptingAt(master, atMs) ? 'adapting' : 'adapted';
}

/** Quantos braços o Mestre soma a `building`: um, se há Mestre nele. */
export function masterArms(state: GameState, building: ProductionBuildingId): number {
  return masterOf(state, building) === null ? 0 : 1;
}

/** O fator do Mestre na produção, em fração exata: `1 + bônus`. Com 3/20, é 23/20. */
export function masterRatio(): Ratio {
  const { num, den } = balance.masters.bonus;
  return { num: den + num, den };
}

/** O bônus em pontos percentuais, para a visão: 15. */
export function masterBonusPercent(): number {
  const { num, den } = balance.masters.bonus;
  return Math.round((num * 1000) / den) / 10;
}

/** Este Mestre já chegou: está no feudo ou espera à porta. Um Mestre com nome é um só. */
export function hasMaster(state: GameState, masterId: MasterId): boolean {
  const { masters, mastersWaiting } = state.settlement;
  return (
    masters.some((master) => master.masterId === masterId) ||
    mastersWaiting.some((master) => master.masterId === masterId)
  );
}

/** Ainda cabe um Mestre no estado, somando os do feudo e os que esperam à porta. */
export function mastersHaveRoom(state: GameState): boolean {
  const { masters, mastersWaiting } = state.settlement;
  return masters.length + mastersWaiting.length < balance.masters.rosterCap;
}

/** Instante em que o próximo Mestre termina a adaptação; `null` sem nenhum em adaptação. */
export function nextMasterAdaptationEndAt(state: GameState): number | null {
  const ends = state.settlement.masters.flatMap((master) =>
    master.adaptingUntilMs === null ? [] : [master.adaptingUntilMs],
  );
  return ends.length === 0 ? null : Math.min(...ends);
}

/**
 * Os Mestres cujo prazo de adaptação venceu até `atMs` passam a render inteiro e a dar o bônus.
 * Não há linha na Crônica: só a taxa muda, e por isso o instante é evento da linha do tempo.
 * A lista é trocada, nunca alterada no lugar: as previsões da visão rodam isto sobre cópias rasas.
 */
export function finishMasterAdaptations(draft: GameState, atMs: number): void {
  const { settlement } = draft;
  if (
    settlement.masters.some(
      (master) => master.adaptingUntilMs !== null && master.adaptingUntilMs <= atMs,
    )
  ) {
    settlement.masters = settlement.masters.map((master) =>
      master.adaptingUntilMs !== null && master.adaptingUntilMs <= atMs
        ? { ...master, adaptingUntilMs: null }
        : master,
    );
  }
}
