import { emit } from './chronicle';
import {
  calendarAt,
  isDayBoundary,
  isSeasonBoundary,
  isYearBoundary,
  nextDayBoundary,
  seasonWithArticle,
  yearOf,
} from './clock';
import { finishConstructions } from './construction';
import { CATALOG, type Catalog, settleCouncil, turnCouncilYear } from './council';
import { drawCard } from './councilTurn';
import { finishAdaptations, tallyCraftExperience } from './craft';
import { applyContinuous } from './economy';
import { turnMorale } from './moraleTurn';
import { hasStartablePlan, settlePlanned } from './planned';
import { finishRecruitments } from './population';
import { settleScarcity } from './scarcity';
import { cloneState } from './state';
import { turnThreat } from './threat';
import { announceFilled, fullStores, isStorageFull, reportWaste } from './storage';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';

function processCalendar(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog,
): void {
  if (!isDayBoundary(atMs)) {
    return;
  }
  // O fecho do dia que acabou vem antes de o novo amanhecer.
  reportWaste(draft, atMs, events);
  const date = calendarAt(atMs);
  if (isYearBoundary(atMs)) {
    draft.clock.year = yearOf(atMs);
    draft.clock.yearStartMs = atMs;
    emit(events, draft, atMs, 'yearStarted', { year: date.year });
    // O Conselho esquece as cartas vistas no ano que acabou; o resto da história continua.
    turnCouncilYear(draft, atMs);
  }
  if (isSeasonBoundary(atMs)) {
    emit(
      events,
      draft,
      atMs,
      'seasonChanged',
      { season: date.season.id },
      { aEstacao: seasonWithArticle(date.season) },
    );
  }
  emit(events, draft, atMs, 'dayStarted', { dayOfYear: date.dayOfYear });
  // O dia virou: cada ofício conta a experiência com quem está no edifício agora.
  tallyCraftExperience(draft, atMs, events);
  // Depois a moral: o recálculo, os sorteios de chegada e de partida e a deserção por fome.
  turnMorale(draft, atMs, events);
  // E, com a moral do dia já calculada (ela é um dos requisitos das cartas), o sorteio do Conselho.
  drawCard(draft, atMs, events, catalog);
  // Por último a Ameaça: sobe com os tiles ativos e com a estação do dia que acabou.
  turnThreat(draft, atMs, events);
}

/** Processa, sobre o rascunho, os eventos discretos de um instante. */
export type EventProcessor = (draft: GameState, atMs: number, events: GameEvent[]) => void;

/**
 * Eventos discretos cujo instante é exatamente `atMs`, em ordem fixa: obras concluídas, aldeões
 * que chegam, virada do dia (o desperdício do dia que acabou, o ano, a estação, o dia, a
 * experiência do ofício, a moral: recálculo, sorteios e deserção, o sorteio do Conselho e a
 * subida da Ameaça), as cartas do Conselho que expiram, os efeitos escondidos que acontecem e
 * as continuações que chegam (`settleCouncil`), fim de adaptação de quem trocou de ofício,
 * início automático das planejadas, objetivos (`settlePlanned`, que repete os dois enquanto um
 * der motivo ao outro) e, por fim, fome e frio. Os estoques que encheram são registrados
 * depois de tudo, por `advanceWith` e por `applyCommand` (`announceFilled`).
 *
 * `catalog` são as cartas do Conselho: o jogo usa as do conteúdo; outro catálogo só existe em
 * teste (`processEventsWith`).
 */
export function processEventsAt(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): void {
  finishConstructions(draft, atMs, events);
  finishRecruitments(draft, atMs, events);
  processCalendar(draft, atMs, events, catalog);
  settleCouncil(draft, atMs, events, catalog);
  finishAdaptations(draft, atMs);
  settlePlanned(draft, atMs, events);
  settleScarcity(draft, atMs, events);
}

/** O processador de eventos do jogo com outro catálogo de cartas: só para os testes do Conselho. */
export function processEventsWith(catalog: Catalog): EventProcessor {
  return (draft, atMs, events) => processEventsAt(draft, atMs, events, catalog);
}

/**
 * O estado como a moral da próxima virada do dia vai encontrá-lo, se nenhuma ordem chegar
 * antes: tudo o que acontece até lá e, na própria virada, o que vem antes da moral na ordem do
 * instante e mexe na conta dela (as obras que terminam e os aldeões que chegam). É o que a
 * visão usa para dizer, termo a termo, para onde a moral vai.
 *
 * Não sorteia nada: os sorteios são da virada, e ela não é processada aqui. O resultado só
 * serve à visão; o calendário dele não foi virado.
 */
export function stateAtNextMoraleTurn(state: GameState): GameState {
  const turn = nextDayBoundary(state.lastProcessedAt);
  // Um milissegundo antes da virada o estado está em repouso e o próximo evento é ela mesma:
  // o último milissegundo é um trecho de taxas constantes, como em `advanceWith`.
  const draft = cloneState(advanceTo(state, turn - 1).state);
  applyContinuous(draft, turn - draft.lastProcessedAt);
  draft.lastProcessedAt = turn;
  draft.clock.gameTimeMs = turn;
  const unused: GameEvent[] = [];
  finishConstructions(draft, turn, unused);
  finishRecruitments(draft, turn, unused);
  return draft;
}

/**
 * O laço de `advanceTo`, com o processador de eventos por parâmetro. O jogo só usa
 * `processEventsAt`; outro processador só existe em teste (`test-helpers.ts`), para provar a
 * divisão de intervalo com eventos que nenhuma regra tem ainda.
 */
export function advanceWith(
  state: GameState,
  gameTimeMs: number,
  processEvents: EventProcessor,
): { state: GameState; events: GameEvent[] } {
  if (gameTimeMs <= state.lastProcessedAt) {
    return { state, events: [] };
  }
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  // Um estado em repouso já passou por aqui e nada muda. Um estado que acabou de ser migrado
  // pode não estar em repouso pelas regras novas (inverno sem madeira, por exemplo): a fome e o
  // frio abrem ou fecham na fronteira, com a linha na Crônica, antes de o tempo andar. Sem isto
  // o próximo evento seria "agora" e o mesmo instante seria processado duas vezes. O mesmo vale
  // para uma planejada automática que já pode começar (um custo que o conteúdo baixou, por
  // exemplo): ela começa aqui, e não no primeiro instante em que alguém olhar.
  if (hasStartablePlan(draft)) {
    settlePlanned(draft, draft.lastProcessedAt, events);
  }
  settleScarcity(draft, draft.lastProcessedAt, events);
  while (draft.lastProcessedAt < gameTimeMs) {
    const next = Math.min(nextEventAt(draft) ?? gameTimeMs, gameTimeMs);
    // Cheio antes do trecho e ainda cheio depois dele: o episódio é o mesmo (`announceFilled`).
    const wasFull = fullStores(draft);
    applyContinuous(draft, next - draft.lastProcessedAt);
    const stillFull = wasFull.filter((resource) => isStorageFull(draft, resource));
    draft.lastProcessedAt = next;
    draft.clock.gameTimeMs = next;
    processEvents(draft, next, events);
    announceFilled(draft, next, events, stillFull);
  }
  return { state: draft, events };
}

/**
 * Avança o estado até `gameTimeMs`, trecho a trecho entre eventos discretos. Dentro de cada
 * trecho as taxas são constantes, então avançar de uma vez dá exatamente o mesmo estado e os
 * mesmos eventos que avançar em qualquer número de passos. Não muta a entrada.
 */
export function advanceTo(
  state: GameState,
  gameTimeMs: number,
): { state: GameState; events: GameEvent[] } {
  return advanceWith(state, gameTimeMs, processEventsAt);
}
