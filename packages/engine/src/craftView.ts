import { balance, buildings } from '@lotg/content';

import { buildingWithArticle } from './construction';
import { experienceChange, handsOf, occupancyOf, occupiedFrom } from './craft';
import { effectiveWorkers, productionRate } from './economy';
import { decimal, durationText, plural, shareText } from './format';
import type { GameState, ProductionBuildingId, ViewState } from './types';
import { MILLI, realSecondsCeil } from './units';

type WorkerRow = ViewState['workers'][number];

/** O que a visão diz do ofício de um edifício: os campos de `workers[]` desta mecânica. */
type CraftRow = Pick<
  WorkerRow,
  | 'perNewWorkerPerHour'
  | 'experience'
  | 'masteryBonusPercent'
  | 'occupiedFrom'
  | 'experienceTrend'
  | 'experienceNote'
  | 'adapting'
  | 'adaptationEndsInSeconds'
  | 'adaptingCohorts'
>;

const hands = (count: number) => plural(count, 'trabalhador', 'trabalhadores');
/** "na Serraria", "no Salão do Senhor". */
const inBuilding = (building: ProductionBuildingId) =>
  `n${buildings[building].article} ${buildings[building].label}`;

/** O bônus da mestria com `experience`, em pontos percentuais com uma casa: 40 → 12. */
function masteryPercent(experience: number): number {
  const { masteryBonus, maxExperience } = balance.craft;
  return (
    Math.round((masteryBonus.num * experience * 1000) / (masteryBonus.den * maxExperience)) / 10
  );
}

/**
 * As regras da troca de ofício e da experiência, em frases, com o prazo no ritmo da partida. É
 * o que a lista de alocação mostra antes de o jogador confirmar: o custo da troca não pode ser
 * surpresa.
 */
export function workersRulesView(timeScale: number): ViewState['workersRules'] {
  const {
    adaptationMs,
    adaptationMultiplier,
    experiencePerDay,
    experienceLossPerDay,
    maxExperience,
    occupiedWorkersPerLevel,
  } = balance.craft;
  const adaptationSeconds = realSecondsCeil(adaptationMs, timeScale);
  const maxBonus = masteryPercent(maxExperience);
  return {
    adaptationSeconds,
    adaptationText: `Quem troca de ofício produz ${shareText(adaptationMultiplier)} por ${durationText(adaptationSeconds)}.`,
    removalText: 'Ao tirar trabalhadores, saem primeiro os que ainda estão em adaptação.',
    experienceText:
      `A experiência do ofício vai de 0 a ${maxExperience}: a cada virada do dia, sobe ${experiencePerDay} ` +
      `no edifício com ao menos ${hands(occupiedWorkersPerLevel)} por nível e cai ${experienceLossPerDay} no edifício vazio. ` +
      `No máximo, a produção rende ${decimal(maxBonus)}% a mais.`,
    experienceMax: maxExperience,
    masteryMaxBonusPercent: maxBonus,
  };
}

/** Por que a experiência sobe, para ou cai, e o que fazer: uma frase para cada situação. */
function experienceNote(state: GameState, building: ProductionBuildingId): string {
  const { experiencePerDay, experienceLossPerDay, maxExperience } = balance.craft;
  const { settlement } = state;
  const experience = settlement.craftExperience[building];
  const needed = occupiedFrom(state, building);
  const occupancy = occupancyOf(state, building);
  if (occupancy === 'empty') {
    return experience > 0
      ? `Sem ninguém ${inBuilding(building)}, o ofício se perde: ${experienceLossPerDay} de experiência a menos a cada virada do dia.`
      : `Ninguém trabalha ${inBuilding(building)}. Com ao menos ${hands(needed)}, a experiência sobe ${experiencePerDay} a cada virada do dia.`;
  }
  if (experience >= maxExperience) {
    return `Ofício dominado: ${decimal(masteryPercent(experience))}% a mais de produção. Só se perde se ninguém trabalhar ${inBuilding(building)}.`;
  }
  if (occupancy === 'occupied') {
    return `A experiência sobe ${experiencePerDay} a cada virada do dia enquanto houver ao menos ${hands(needed)}.`;
  }
  const missing = needed - settlement.workers[building];
  return (
    `A experiência não sobe: ${buildingWithArticle(building)} no nível ${settlement.buildings[building]} ` +
    `pede ao menos ${hands(needed)} (${missing === 1 ? 'falta 1' : `faltam ${missing}`}).`
  );
}

/** As levas em adaptação de um edifício, da que termina antes à que termina depois. */
function cohortsOf(state: GameState, building: ProductionBuildingId, timeScale: number) {
  const now = state.lastProcessedAt;
  return state.settlement.adaptation
    .filter((cohort) => cohort.building === building && cohort.untilMs > now)
    .sort((a, b) => a.untilMs - b.untilMs)
    .map((cohort) => ({
      count: cohort.count,
      endsInSeconds: realSecondsCeil(cohort.untilMs - now, timeScale),
    }));
}

/**
 * Os campos do ofício de um edifício na visão, em tempo real: a experiência e o que ela rende,
 * para onde ela vai na próxima virada do dia e por quê, e quem ainda se adapta, até quando.
 */
export function craftRow(
  state: GameState,
  building: ProductionBuildingId,
  timeScale: number,
): CraftRow {
  const experience = state.settlement.craftExperience[building];
  const change = experienceChange(state, building);
  const cohorts = cohortsOf(state, building, timeScale);
  const newcomer = productionRate(state, building, { adapted: 0, adapting: 1 });
  let trend: CraftRow['experienceTrend'] = 'steady';
  if (change !== 0) {
    trend = change > 0 ? 'rising' : 'falling';
  }
  return {
    perNewWorkerPerHour: (newcomer * timeScale) / MILLI,
    experience,
    masteryBonusPercent: masteryPercent(experience),
    occupiedFrom: occupiedFrom(state, building),
    experienceTrend: trend,
    experienceNote: experienceNote(state, building),
    adapting: cohorts.reduce((sum, cohort) => sum + cohort.count, 0),
    adaptationEndsInSeconds: cohorts[cohorts.length - 1]?.endsInSeconds ?? null,
    adaptingCohorts: cohorts,
  };
}

/**
 * O primeiro termo da explicação da produção de um edifício: os braços que entram na conta. Com
 * todo mundo adaptado, "4 trabalhadores". Com gente em adaptação, o termo diz quantos, até
 * quando, quanto valem e por quantos contam: "4 trabalhadores (2 em adaptação por 38 min,
 * valendo metade: contam como 3)". Com mais de uma leva, o prazo é o da última ("por até").
 */
export function handsClause(
  state: GameState,
  building: ProductionBuildingId,
  timeScale: number,
): string {
  const workers = state.settlement.workers[building];
  const cohorts = cohortsOf(state, building, timeScale);
  const last = cohorts[cohorts.length - 1];
  if (last === undefined) {
    return hands(workers);
  }
  const adapting = cohorts.reduce((sum, cohort) => sum + cohort.count, 0);
  const { num, den } = effectiveWorkers(handsOf(state, building));
  const span = `${cohorts.length > 1 ? 'por até' : 'por'} ${durationText(last.endsInSeconds)}`;
  const worth = `valendo ${shareText(balance.craft.adaptationMultiplier)}`;
  const counts = `${workers === 1 ? 'conta' : 'contam'} como ${decimal(num / den)}`;
  return `${hands(workers)} (${adapting} em adaptação ${span}, ${worth}: ${counts})`;
}
