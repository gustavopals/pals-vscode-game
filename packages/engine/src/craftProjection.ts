import { PRODUCTION_BUILDING_IDS } from '@lotg/content';

import { DAYS_PER_YEAR, isDayBoundary, nextDayBoundary, nextSeasonBoundary } from './clock';
import {
  experienceChange,
  finishAdaptations,
  nextAdaptationEndAt,
  tallyCraftExperience,
} from './craft';
import { coldRelief } from './cold';
import {
  applyContinuous,
  firewoodRate,
  foodCoversConsumption,
  foodRunsOutIn,
  netRates,
  woodRunsOutIn,
} from './economy';
import { moraleAt } from './morale';
import { nextAutoStart, planCost } from './planned';
import { recoverInjured } from './raids';
import { settleIndicators } from './scarcity';
import type { GameState, PlannedConstruction, ResourceId } from './types';
import { MILLI, positiveEntries } from './units';

type Rates = Record<ResourceId, number>;

/** Um prazo em ms de jogo: a partir do estado a que a pergunta foi feita. */
type Deadline = { inMs: number };

/** "Em quantos ms isto acontece, com as taxas que este estado tem?"; `null` se não acontece. */
export type Probe<T extends Deadline> = (state: GameState, rates: Rates) => T | null;

/**
 * Um trecho da projeção: o estado no começo dele, as taxas que valem nele e até quando valem.
 * No último trecho, `untilMs` é infinito (o ofício se acomodou: a taxa de agora vale até o fim)
 * ou o instante em que a comida ou a lenha acabaria (daí em diante a visão não adivinha). Na
 * projeção que atravessa a escassez (`stretchesOf`, `throughScarcity`), esse instante só fecha
 * um trecho, e o seguinte começa com a fome ou o frio aberto.
 */
type Stretch = { atMs: number; state: GameState; rates: Rates; untilMs: number };

/**
 * Com todo mundo adaptado, nenhum ferido por voltar ao ofício e nenhuma experiência por mudar,
 * o ofício não mexe mais nas taxas.
 */
function craftSettled(state: GameState): boolean {
  return (
    state.settlement.adaptation.length === 0 &&
    state.settlement.injured.length === 0 &&
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
 * o ofício (com os trabalhadores e os feridos que voltam a ele) e a moral (um número, que a
 * cópia rasa já separa). O resto (obras, planejadas, relógio) é compartilhado e ninguém aqui o
 * toca.
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
      workers: { ...settlement.workers },
      injured: settlement.injured.map((hurt) => ({ ...hurt })),
    },
  };
}

/**
 * Encerra, na cópia, a fome e o frio que as taxas dela já não sustentam: é o que `settleScarcity`
 * faz no motor ao fim de cada instante com eventos, sem a Crônica nem a fila de recrutamento.
 * Só encerra: o começo de uma escassez é onde a projeção comum para. A fome vem antes do frio, e
 * a conferência se repete, porque o fim de uma tira a penalidade que segurava a outra. A
 * projeção que atravessa a escassez usa a conferência inteira do motor (`settleIndicators`).
 */
function relieveScarcity(draft: GameState): void {
  const { settlement } = draft;
  for (let moved = true; moved;) {
    moved = false;
    if (settlement.famine !== null && foodCoversConsumption(draft)) {
      settlement.famine = null;
      moved = true;
    }
    if (settlement.cold !== null && coldRelief(draft) !== null) {
      settlement.cold = null;
      moved = true;
    }
  }
}

/** O instante, depois de `at`, em que o próximo ferido da cópia sara; `null` sem nenhum. */
function recoveryAfter(state: GameState, at: number): number | null {
  const untilMs = state.settlement.injured[0]?.untilMs;
  return untilMs === undefined ? null : Math.max(untilMs, at + 1);
}

/**
 * Os trechos em que o ofício e a moral, sozinhos, mudam as taxas: a cada virada de dia a
 * experiência dos edifícios sobe ou cai e a moral é recalculada, quem trocou de ofício passa a
 * render inteiro quando a adaptação termina, e o ferido que sara volta ao edifício dele. É a
 * conta de `advanceTo`, trecho a trecho, sobre cópias, só com a produção contínua e esses eventos. O relógio das cópias não anda: a estação
 * é a de agora, e nada mais acontece nelas (nem obras, nem aldeões, nem ordens, nem sorteios:
 * a previsão não conta com o colono que pode chegar nem com o aldeão que pode partir). A fome e
 * o frio abertos acabam na cópia no instante em que acabariam no motor (`relieveScarcity`): dali
 * em diante as taxas já não levam a penalidade.
 *
 * A projeção comum para quando a comida ou a lenha acabam: daí em diante "cheio em" e o início
 * das obras não adivinham. Com `throughScarcity`, ela atravessa esse instante como o motor: abre
 * a fome ou o frio na cópia, com a penalidade e o peso na moral, e segue, mesmo com o ofício e
 * a moral acomodados, enquanto houver comida ou lenha por acabar. São duas perguntas. O fim da
 * escassez aberta: o frio que abre minutos antes de os lavradores renderem inteiro não impede a
 * fome de acabar ali, e a visão que parasse nele mandaria pôr mais gente na Fazenda à toa. E o
 * começo da segunda escassez ("acaba em"): a lenha que acaba antes da comida não tira o prazo
 * da comida, só o adianta.
 */
function stretchesOf(state: GameState, throughScarcity = false): Stretch[] {
  const stretches: Stretch[] = [];
  let current = state;
  let at = state.lastProcessedAt;
  for (;;) {
    const rates = netRates(current);
    const settled = craftSettled(current) && moraleSettled(current, at);
    const scarce =
      at +
      Math.min(
        foodRunsOutIn(current, rates) ?? Infinity,
        woodRunsOutIn(current, rates) ?? Infinity,
      );
    // Acomodado, o ofício não muda mais nada sozinho. Só a projeção que atravessa a escassez
    // ainda tem o que andar: a comida ou a lenha que acabam mais adiante abrem a fome ou o frio,
    // e a penalidade e a moral voltam a mexer nas taxas.
    const done = settled && (!throughScarcity || scarce === Infinity);
    if (done || stretches.length + 1 >= MAX_STRETCHES) {
      stretches.push({ atMs: at, state: current, rates, untilMs: Infinity });
      return stretches;
    }
    const step = settled
      ? // Nenhuma virada muda nada até lá: o trecho vai direto ao instante em que algo acaba.
        Infinity
      : Math.min(
          nextDayBoundary(at),
          nextAdaptationEndAt(current) ?? Infinity,
          // Na cópia o relógio não anda: o prazo do ferido é comparado com o instante da projeção.
          recoveryAfter(current, at) ?? Infinity,
        );
    if (scarce <= step && !throughScarcity) {
      stretches.push({ atMs: at, state: current, rates, untilMs: scarce });
      return stretches;
    }
    const until = Math.min(scarce, step);
    stretches.push({ atMs: at, state: current, rates, untilMs: until });
    const next = fork(current);
    applyContinuous(next, until - at);
    if (until === step) {
      // Na ordem do motor: o ferido que sara volta antes da contagem da virada.
      recoverInjured(next, step, []);
      if (isDayBoundary(step)) {
        tallyCraftExperience(next, step, []);
        next.settlement.morale = moraleAt(next, step);
      }
      finishAdaptations(next, step);
    }
    if (throughScarcity) {
      // Como no fim de todo instante com eventos no motor: abre o que acabou, encerra o que voltou.
      settleIndicators(next, until);
    } else {
      // Quem passou a render inteiro, ou a moral que subiu, pode encerrar a fome e o frio.
      relieveScarcity(next);
    }
    current = next;
    at = until;
  }
}

/**
 * A primeira resposta de `probe` nos trechos que cabe no trecho em que foi dada e antes de
 * `untilMs`, com o prazo contado de `start`; `null` quando não vem.
 */
function findIn<T extends Deadline>(
  stretches: readonly Stretch[],
  start: number,
  probe: Probe<T>,
  untilMs: number,
): T | null {
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
  /**
   * O feudo como a projeção o encontra no instante `atMs` de jogo, de agora em diante: uma
   * cópia com os estoques, o ofício e a moral daquele instante. Em uma virada de dia, já com a
   * experiência e a moral que ela conta. O relógio da cópia não anda, como o dos trechos.
   * `null` quando a comida ou a lenha acabam antes de `atMs`: dali em diante a visão não adivinha.
   */
  stateAt: (atMs: number) => GameState | null;
};

export function craftForecast(state: GameState): CraftForecast {
  const start = state.lastProcessedAt;
  let stretches: Stretch[] | null = null;
  return {
    find(probe, untilMs = Infinity) {
      stretches ??= stretchesOf(state);
      return findIn(stretches, start, probe, untilMs);
    },
    stateAt(atMs) {
      stretches ??= stretchesOf(state);
      // De trás para frente: o trecho que começa em `atMs` já passou pela virada.
      for (let index = stretches.length - 1; index >= 0; index -= 1) {
        const stretch = stretches[index] as Stretch;
        if (stretch.atMs > atMs) {
          continue;
        }
        const span = atMs - stretch.atMs;
        // No último trecho o ofício já se acomodou, e ele vale "até o fim": a escassez que
        // encerraria um trecho comum é conferida aqui.
        const scarce = Math.min(
          foodRunsOutIn(stretch.state, stretch.rates) ?? Infinity,
          woodRunsOutIn(stretch.state, stretch.rates) ?? Infinity,
        );
        if (atMs > stretch.untilMs || scarce < span) {
          return null;
        }
        const copy = fork(stretch.state);
        applyContinuous(copy, span);
        return copy;
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
 *
 * `foodRunsOutIn` e `woodRunsOutIn` são o instante em que a fome e o frio abrem. A conta
 * atravessa o começo da outra escassez no caminho, como o motor: no inverno, a lenha que acaba
 * antes da comida abre o frio na cópia, com a penalidade e o peso na moral, e a comida acaba
 * mais cedo por isso; a visão que parasse ali diria "−10/h" sem prazo nenhum. Como toda
 * previsão, não conta com quem chega nem com quem parte: a fome longa que faz desertar muda as
 * bocas e a lareira, e o prazo da lenha além dela é o de um feudo de que ninguém partiu.
 *
 * O prazo da lenha conta com a madeira que a próxima obra automática leva quando começar: o
 * motor a inicia sozinho, sem olhar a lareira (GDD §6.3).
 *
 * `famineEndsIn` e `coldEndsIn` são o fim da fome e do frio abertos, quando eles acabam sozinhos
 * antes de a estação virar: quem ainda se adapta passa a render inteiro, ou a virada do dia muda
 * a moral ou a experiência, e a produção volta a cobrir as bocas ou a lareira. `null` sem fome
 * (ou sem frio) e quando, sem uma ordem do jogador, não acabam. A conta atravessa o começo da
 * outra escassez no caminho (a lenha que acaba enquanto a fome dura), como o motor.
 */
export type CraftOutlook = {
  foodRunsOutIn: number | null;
  woodRunsOutIn: number | null;
  autoStart: { plan: PlannedConstruction; inMs: number } | null;
  famineEndsIn: number | null;
  coldEndsIn: number | null;
};

type AutoStart = NonNullable<CraftOutlook['autoStart']>;

const inFamine = (state: GameState) => state.settlement.famine !== null;
const inCold = (state: GameState) => state.settlement.cold !== null;

/**
 * Em quantos ms, a contar de `start`, a fome (ou o frio) abre nos trechos da projeção que
 * atravessa a escassez: o começo do primeiro trecho que a encontra aberta depois de um que não
 * a tinha. É o instante em que a comida (ou a lenha) acaba, ou a virada em que o saldo fica
 * negativo com o estoque vazio. `null` quando não abre; a que já está aberta no começo não
 * conta, só a que voltar a abrir depois de acabar.
 */
function opensIn(
  stretches: readonly Stretch[],
  start: number,
  open: (state: GameState) => boolean,
): number | null {
  let wasOpen = true;
  for (const stretch of stretches) {
    const isOpen = open(stretch.state);
    if (isOpen && !wasOpen) {
      return stretch.atMs - start;
    }
    wasOpen = isOpen;
  }
  return null;
}

/** Em quantos ms a comida ou a lenha acabam, o que vier primeiro, com as taxas deste estado. */
const somethingRunsOut: Probe<Deadline> = (state, rates) => {
  const first = Math.min(
    foodRunsOutIn(state, rates) ?? Infinity,
    woodRunsOutIn(state, rates) ?? Infinity,
  );
  return first === Infinity ? null : { inMs: first };
};

/**
 * "Em quantos ms a fome (ou o frio) abre?", para o feudo de `state`: a resposta de `opensIn` na
 * projeção que atravessa a escassez (`through`, feita só se for preciso), com dois cuidados.
 *
 * Enquanto nada acaba, as duas projeções andam os mesmos trechos: no feudo em que a projeção
 * comum (`forecast`) não vê a comida nem a lenha acabando, nenhuma escassez abre, e a outra nem
 * é feita.
 *
 * A escassez que abre primeiro tem o prazo de sempre, caia onde cair. A que abre **depois** de
 * outra só tem prazo dentro da estação de agora: a projeção não vira a estação, e do outro lado
 * dela a fome e o frio que a cópia carrega já não são os do motor (o frio acaba na primavera).
 * Além da virada, a visão não adivinha.
 */
function scarcityOpenings(
  state: GameState,
  forecast: CraftForecast,
  through: () => Stretch[],
): (open: (draft: GameState) => boolean) => number | null {
  const now = state.lastProcessedAt;
  const seasonEnd = nextSeasonBoundary(now);
  const first = forecast.find(somethingRunsOut)?.inMs ?? null;
  return (open) => {
    if (first === null) {
      return null;
    }
    const found = opensIn(through(), now, open);
    return found === null || found <= first || now + found < seasonEnd ? found : null;
  };
}

/**
 * Quando a lenha acaba se a próxima obra automática começar antes: a projeção vai até o instante
 * em que ela começa, paga o custo e segue dali, com o relógio da cópia posto nesse instante.
 * `plain` é o prazo sem a obra, e vale quando ela não leva madeira, quando a lenha acaba antes
 * de ela começar ou quando ela só começa depois de a estação virar (aí a conta é outra, e a
 * visão não adivinha).
 */
function woodRunsOutAfter(
  state: GameState,
  forecast: CraftForecast,
  autoStart: AutoStart | null,
  plain: number | null,
): number | null {
  // Fora da estação da lenha a madeira não cai sozinha: não há prazo a corrigir.
  if (autoStart === null || firewoodRate(state) === 0) {
    return plain;
  }
  if (plain !== null && plain <= autoStart.inMs) {
    return plain;
  }
  const cost = planCost(autoStart.plan);
  const at = state.lastProcessedAt + autoStart.inMs;
  if ((cost.wood ?? 0) <= 0 || at >= nextSeasonBoundary(state.lastProcessedAt)) {
    return plain;
  }
  const paid = forecast.stateAt(at);
  if (paid === null) {
    return plain;
  }
  // `stateAt` devolve uma cópia: o estoque é dela; o relógio, dividido com o estado, é trocado.
  paid.lastProcessedAt = at;
  paid.clock = { ...paid.clock, gameTimeMs: at };
  for (const [resource, amount] of positiveEntries(cost)) {
    paid.settlement.resources[resource] -= amount * MILLI;
  }
  const opens = scarcityOpenings(paid, craftForecast(paid), () => stretchesOf(paid, true));
  const rest = opens(inCold);
  return rest === null ? null : autoStart.inMs + rest;
}

export function craftOutlook(state: GameState, forecast: CraftForecast): CraftOutlook {
  const now = state.lastProcessedAt;
  const autoStart = forecast.find(nextAutoStart);
  // A projeção anda na estação de agora: além da virada, a conta é outra.
  const seasonEnd = nextSeasonBoundary(now);
  const { famine, cold } = state.settlement;
  // O começo e o fim de uma escassez não param no começo da outra: a projeção que a atravessa.
  let through: Stretch[] | null = null;
  const crossing = () => (through ??= stretchesOf(state, true));
  const over = (ended: (draft: GameState) => boolean): number | null => {
    const probe: Probe<Deadline> = (draft) => (ended(draft) ? { inMs: 0 } : null);
    return findIn(crossing(), now, probe, seasonEnd)?.inMs ?? null;
  };
  const opens = scarcityOpenings(state, forecast, crossing);
  return {
    famineEndsIn: famine === null ? null : over((draft) => !inFamine(draft)),
    coldEndsIn: cold === null ? null : over((draft) => !inCold(draft)),
    foodRunsOutIn: opens(inFamine),
    woodRunsOutIn: woodRunsOutAfter(state, forecast, autoStart, opens(inCold)),
    autoStart,
  };
}
