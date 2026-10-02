import { PRODUCTION_BUILDING_IDS } from '@lotg/content';

import { DAYS_PER_YEAR, isDayBoundary, nextDayBoundary } from './clock';
import {
  experienceChange,
  finishAdaptations,
  nextAdaptationEndAt,
  tallyCraftExperience,
} from './craft';
import { applyContinuous, foodRunsOutIn, netRates, woodRunsOutIn } from './economy';
import { moraleAt } from './morale';
import { nextAutoStart } from './planned';
import type { GameState, PlannedConstruction, ResourceId } from './types';

type Rates = Record<ResourceId, number>;

/** Um prazo em ms de jogo: a partir do estado a que a pergunta foi feita. */
type Deadline = { inMs: number };

/** "Em quantos ms isto acontece, com as taxas que este estado tem?"; `null` se não acontece. */
export type Probe<T extends Deadline> = (state: GameState, rates: Rates) => T | null;

/**
 * Um trecho da projeção: o estado no começo dele, as taxas que valem nele e até quando valem.
 * No último trecho, `untilMs` é infinito (o ofício se acomodou: a taxa de agora vale até o fim)
 * ou o instante em que a comida ou a lenha acabaria (daí em diante a visão não adivinha).
 */
type Stretch = { atMs: number; state: GameState; rates: Rates; untilMs: number };

/** Com todo mundo adaptado e nenhuma experiência por mudar, o ofício não mexe mais nas taxas. */
function craftSettled(state: GameState): boolean {
  return (
    state.settlement.adaptation.length === 0 &&
    PRODUCTION_BUILDING_IDS.every((building) => experienceChange(state, building) === 0)
  );
}

/**
 * A próxima virada do dia não mexe na moral: com as condições deste estado, a conta dá o que
 * ela já vale. A comida guardada que enche ou acaba mais adiante não entra aqui: a projeção
 * confere de novo a cada virada por que passa, e para de olhar quando a moral se acomoda.
 */
function moraleSettled(state: GameState, atMs: number): boolean {
  return moraleAt(state, nextDayBoundary(atMs)) === state.settlement.morale;
}

/**
 * Até onde a projeção anda, em trechos: dois anos de jogo de viradas. O ofício se acomoda em
 * semanas e a moral, em dias; o limite só existe para a visão nunca depender de uma conta que
 * não termina.
 */
const MAX_STRETCHES = 2 * DAYS_PER_YEAR;

/**
 * Uma cópia do estado só no que a projeção altera: estoques, restos, desperdício, contadores,
 * o ofício e a moral (um número, que a cópia rasa já separa). O resto (obras, planejadas,
 * relógio) é compartilhado e ninguém aqui o toca.
 */
function fork(state: GameState): GameState {
  const { settlement } = state;
  return {
    ...state,
    stats: { ...state.stats },
    settlement: {
      ...settlement,
      resources: { ...settlement.resources },
      accumulators: { ...settlement.accumulators },
      wasted: { ...settlement.wasted },
      craftExperience: { ...settlement.craftExperience },
      craftMasteredYear: { ...settlement.craftMasteredYear },
      adaptation: settlement.adaptation.map((cohort) => ({ ...cohort })),
    },
  };
}

/**
 * Os trechos em que o ofício e a moral, sozinhos, mudam as taxas: a cada virada de dia a
 * experiência dos edifícios sobe ou cai e a moral é recalculada, e quem trocou de ofício passa
 * a render inteiro quando a adaptação termina. É a conta de `advanceTo`, trecho a trecho, sobre
 * cópias, só com a produção contínua e esses eventos. O relógio das cópias não anda: a estação
 * é a de agora, e nada mais acontece nelas (nem obras, nem aldeões, nem ordens, nem sorteios:
 * a previsão não conta com o colono que pode chegar nem com o aldeão que pode partir).
 */
function stretchesOf(state: GameState): Stretch[] {
  const stretches: Stretch[] = [];
  let current = state;
  let at = state.lastProcessedAt;
  for (;;) {
    const rates = netRates(current);
    const settled = craftSettled(current) && moraleSettled(current, at);
    if (settled || stretches.length + 1 >= MAX_STRETCHES) {
      stretches.push({ atMs: at, state: current, rates, untilMs: Infinity });
      return stretches;
    }
    const scarce =
      at +
      Math.min(
        foodRunsOutIn(current, rates) ?? Infinity,
        woodRunsOutIn(current, rates) ?? Infinity,
      );
    const step = Math.min(nextDayBoundary(at), nextAdaptationEndAt(current) ?? Infinity);
    if (scarce <= step) {
      stretches.push({ atMs: at, state: current, rates, untilMs: scarce });
      return stretches;
    }
    stretches.push({ atMs: at, state: current, rates, untilMs: step });
    const next = fork(current);
    applyContinuous(next, step - at);
    if (isDayBoundary(step)) {
      tallyCraftExperience(next, step, []);
      next.settlement.morale = moraleAt(next, step);
    }
    finishAdaptations(next, step);
    current = next;
    at = step;
  }
}

/**
 * As previsões da visão ("cheio em", "acaba em", "a obra começa em") contam com as taxas de
 * agora **e com o que o ofício muda sozinho**. Sem isto, logo depois de uma realocação toda
 * previsão erraria pelo dobro, e a experiência adiantaria um pouco todos os prazos longos.
 *
 * `find` faz a mesma pergunta (`fillsIn`, `coversIn`, `foodRunsOutIn`) a cada trecho da projeção
 * e devolve a primeira resposta que cabe no trecho em que foi dada, com o prazo contado de
 * agora. `null` quando a resposta não vem até `untilMs`, ou quando a comida ou a lenha
 * acabariam antes. Os trechos são calculados uma vez, na primeira pergunta, e servem a todas.
 */
export type CraftForecast = {
  find: <T extends Deadline>(probe: Probe<T>, untilMs?: number) => T | null;
};

export function craftForecast(state: GameState): CraftForecast {
  const start = state.lastProcessedAt;
  let stretches: Stretch[] | null = null;
  return {
    find(probe, untilMs = Infinity) {
      stretches ??= stretchesOf(state);
      for (const stretch of stretches) {
        const found = probe(stretch.state, stretch.rates);
        const limit = Math.min(stretch.untilMs, untilMs);
        if (found !== null && stretch.atMs + found.inMs <= limit) {
          return { ...found, inMs: stretch.atMs + found.inMs - start };
        }
        if (limit >= untilMs) {
          return null;
        }
      }
      return null;
    },
  };
}

/** Embrulha um prazo em ms (ou `null`) no formato que `find` devolve. */
export function inMs(value: number | null): Deadline | null {
  return value === null ? null : { inMs: value };
}

/**
 * O que a visão prevê uma vez e usa em vários lugares: quando a comida e a lenha acabam e
 * quando a próxima planejada automática começa, já com o que o ofício muda no caminho. Cada
 * prazo é em ms de jogo a contar de agora; `null` quando não acontece. Lavradores em adaptação
 * que passam a render inteiro podem virar o saldo antes de a despensa esvaziar: aí o alarme de
 * "acaba em" não toca.
 */
export type CraftOutlook = {
  foodRunsOutIn: number | null;
  woodRunsOutIn: number | null;
  autoStart: { plan: PlannedConstruction; inMs: number } | null;
};

export function craftOutlook(forecast: CraftForecast): CraftOutlook {
  return {
    foodRunsOutIn: forecast.find((state, rates) => inMs(foodRunsOutIn(state, rates)))?.inMs ?? null,
    woodRunsOutIn: forecast.find((state, rates) => inMs(woodRunsOutIn(state, rates)))?.inMs ?? null,
    autoStart: forecast.find(nextAutoStart),
  };
}
