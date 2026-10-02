import { balance, craftGuilds, PRODUCTION_BUILDING_IDS, type Ratio } from '@lotg/content';

import { emit } from './chronicle';
import { nextDayBoundary } from './clock';
import type { GameEvent, GameState, ProductionBuildingId } from './types';

/**
 * Os trabalhadores de um edifício, separados pelo que rendem: quem já conhece o ofício e quem
 * chegou há menos de um dia de jogo e ainda rende uma fração (GDD §5.4).
 */
export type Hands = { adapted: number; adapting: number };

/**
 * Trabalhadores de `building` ainda em adaptação no instante `atMs`: os das coortes que só
 * terminam depois dele. Com `atMs` no futuro, responde "e naquele dia?" para as previsões.
 */
export function adaptingAt(state: GameState, building: ProductionBuildingId, atMs: number): number {
  return state.settlement.adaptation.reduce(
    (sum, cohort) =>
      cohort.building === building && cohort.untilMs > atMs ? sum + cohort.count : sum,
    0,
  );
}

/** Os braços de `building` em um instante: quem rende inteiro e quem rende a fração. */
export function handsAt(state: GameState, building: ProductionBuildingId, atMs: number): Hands {
  const adapting = adaptingAt(state, building, atMs);
  return { adapted: state.settlement.workers[building] - adapting, adapting };
}

/** Os braços de `building` agora. */
export function handsOf(state: GameState, building: ProductionBuildingId): Hands {
  return handsAt(state, building, state.lastProcessedAt);
}

/**
 * Quem acabou de chegar a `building` entra em adaptação até `nowMs + adaptationMs`. É uma
 * coorte: quantos, onde e até quando. Duas levas do mesmo instante no mesmo edifício são a
 * mesma coorte. Como o prazo é o mesmo para todos, a lista fica sempre em ordem de término, e
 * a coorte mais nova de um edifício é a última dele.
 */
export function beginAdaptation(
  draft: GameState,
  building: ProductionBuildingId,
  count: number,
  nowMs: number,
): void {
  if (count <= 0) {
    return;
  }
  const { adaptation } = draft.settlement;
  const untilMs = nowMs + balance.craft.adaptationMs;
  const same = adaptation.find(
    (cohort) => cohort.building === building && cohort.untilMs === untilMs,
  );
  if (same !== undefined) {
    same.count += count;
    return;
  }
  adaptation.push({ building, count, untilMs });
}

/**
 * `count` trabalhadores saem de `building`: primeiro os das coortes mais novas, depois os já
 * adaptados (que não estão em coorte nenhuma). Quem acabou de chegar sai primeiro: desfazer uma
 * troca não custa um veterano, e a penalidade não se multiplica.
 */
export function leaveAdaptation(
  draft: GameState,
  building: ProductionBuildingId,
  count: number,
): void {
  const { adaptation } = draft.settlement;
  let leaving = count;
  for (let index = adaptation.length - 1; index >= 0 && leaving > 0; index -= 1) {
    const cohort = adaptation[index];
    if (cohort === undefined || cohort.building !== building) {
      continue;
    }
    const taken = Math.min(cohort.count, leaving);
    cohort.count -= taken;
    leaving -= taken;
    if (cohort.count === 0) {
      adaptation.splice(index, 1);
    }
  }
}

/**
 * As coortes cujo prazo venceu até `atMs` passam a render inteiro. Não há linha na Crônica: só
 * a taxa muda. O instante é evento da linha do tempo (`nextAdaptationEndAt`).
 */
export function finishAdaptations(draft: GameState, atMs: number): void {
  const { settlement } = draft;
  if (settlement.adaptation.some((cohort) => cohort.untilMs <= atMs)) {
    settlement.adaptation = settlement.adaptation.filter((cohort) => cohort.untilMs > atMs);
  }
}

/** Instante, em ms de jogo, em que a próxima coorte termina a adaptação; `null` sem nenhuma. */
export function nextAdaptationEndAt(state: GameState): number | null {
  const { adaptation } = state.settlement;
  return adaptation.length === 0 ? null : Math.min(...adaptation.map((cohort) => cohort.untilMs));
}

/**
 * A mestria: o fator de produção de um edifício com `experience` de experiência do ofício,
 * `1 + bônus × experiência ÷ máximo`, em fração exata (GDD §5.3). Com 3/10 e 100, é
 * `(1000 + 3 × experiência) / 1000`.
 */
export function masteryRatio(experience: number): Ratio {
  const { masteryBonus, maxExperience } = balance.craft;
  const den = masteryBonus.den * maxExperience;
  return { num: den + masteryBonus.num * experience, den };
}

/** Quantos trabalhadores `building` pede para contar como ocupado: um tanto por nível. */
export function occupiedFrom(state: GameState, building: ProductionBuildingId): number {
  return state.settlement.buildings[building] * balance.craft.occupiedWorkersPerLevel;
}

/**
 * Como a virada do dia encontra um edifício. `occupied`: tem ao menos um trabalhador por nível,
 * e a experiência sobe. `empty`: não tem ninguém, e ela cai. `short`: tem gente, mas menos do
 * que o nível pede: nem sobe nem cai.
 */
export type Occupancy = 'occupied' | 'short' | 'empty';

export function occupancyOf(
  state: GameState,
  building: ProductionBuildingId,
  workers: number = state.settlement.workers[building],
): Occupancy {
  if (workers === 0) {
    return 'empty';
  }
  return workers >= occupiedFrom(state, building) ? 'occupied' : 'short';
}

/**
 * Os trabalhadores com que a próxima virada do dia vai encontrar `building`, se nenhuma ordem
 * chegar antes: os de agora e os feridos que saram até lá e voltam a ele (GDD §8.2). É com
 * eles que a visão diz para onde a experiência vai: o ferido que volta a tempo não deixa o
 * ofício se perder.
 */
export function workersAtNextTurn(state: GameState, building: ProductionBuildingId): number {
  const turn = nextDayBoundary(state.lastProcessedAt);
  const returning = state.settlement.injured.filter(
    (hurt) => hurt.building === building && hurt.untilMs <= turn,
  ).length;
  return state.settlement.workers[building] + returning;
}

/**
 * O que uma virada do dia faz com a experiência de `building` com `workers` trabalhadores nele:
 * o ganho, a perda (negativa) ou zero, já com os limites de 0 e do máximo. Sem `workers`, vale
 * quem está no edifício agora: é a conta da própria virada.
 */
export function experienceChange(
  state: GameState,
  building: ProductionBuildingId,
  workers?: number,
): number {
  const { experiencePerDay, experienceLossPerDay, maxExperience } = balance.craft;
  const experience = state.settlement.craftExperience[building];
  const occupancy = occupancyOf(state, building, workers);
  if (occupancy === 'occupied') {
    return Math.min(experiencePerDay, maxExperience - experience);
  }
  return occupancy === 'empty' ? -Math.min(experienceLossPerDay, experience) : 0;
}

/**
 * A virada do dia de jogo conta a experiência do ofício de cada edifício produtivo, com os
 * trabalhadores que ele tem naquele instante (em adaptação ou não). O edifício que chega ao
 * máximo ganha a linha na Crônica, uma vez por ano: `craftMasteredYear` guarda o ano da última,
 * para quem perde a mão e a recupera no mesmo ano não repetir a festa.
 */
export function tallyCraftExperience(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement, clock } = draft;
  const { maxExperience } = balance.craft;
  for (const building of PRODUCTION_BUILDING_IDS) {
    const change = experienceChange(draft, building);
    if (change === 0) {
      continue;
    }
    settlement.craftExperience[building] += change;
    const mastered = settlement.craftExperience[building] === maxExperience;
    if (mastered && settlement.craftMasteredYear[building] !== clock.year) {
      settlement.craftMasteredYear[building] = clock.year;
      const { artisans, feat } = craftGuilds[building];
      emit(
        events,
        draft,
        atMs,
        'craftMastered',
        { building, experience: maxExperience },
        { artifices: artisans, feito: feat },
      );
    }
  }
}
