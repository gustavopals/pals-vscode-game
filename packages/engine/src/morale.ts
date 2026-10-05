import { balance, type MoraleBandDef, type MoraleTermId } from '@lotg/content';

import { DAY_MS, nextDayBoundary, seasonAt } from './clock';
import { consumptionRate, stockBalance } from './economy';
import { famineDurationAt } from './famine';
import { housingCapacity } from './population';
import type { GameState, MoraleEffect } from './types';
import { HOUR_MS, MILLI, realToGameMs } from './units';

/**
 * A moral do feudo (GDD §5.7; ADR 0013, decisão 19): as contas, sem sorteio nenhum. Quem recalcula,
 * sorteia e tira gente do feudo na virada do dia é `moraleTurn.ts`; quem mostra, `moraleView.ts`.
 * Este módulo só lê o estado, e por isso serve aos dois e às previsões da visão.
 */

const { morale: rules } = balance;

/** O máximo da moral: o teto da faixa mais alta. O mínimo é zero. */
export const MAX_MORALE = rules.bands[rules.bands.length - 1]?.max ?? 0;

export function clampMorale(value: number): number {
  return Math.max(0, Math.min(MAX_MORALE, value));
}

/** A faixa de uma moral: a primeira cujo teto ela não passa. */
export function moraleBand(value: number): MoraleBandDef {
  const band =
    rules.bands.find((entry) => value <= entry.max) ?? rules.bands[rules.bands.length - 1];
  if (band === undefined) {
    throw new Error('O conteúdo não tem faixas de moral.');
  }
  return band;
}

/**
 * Um termo da conta da moral. `famineDays` leva os dias inteiros de fome que o termo conta, e
 * `effect`, o efeito temporário de onde ele vem: é o que a explicação precisa para dar nome a cada um.
 */
export type MoraleTerm =
  | { id: Exclude<MoraleTermId, 'famineDays' | 'effect'>; amount: number }
  | { id: 'famineDays'; amount: number; days: number }
  | { id: 'effect'; amount: number; effect: MoraleEffect };

/**
 * A comida que vale o bônus da reserva, na escala do acumulador (milésimos × ms): o que os
 * habitantes de agora comem em `foodReserve.coverMs`, sem contar o que a Fazenda produz.
 */
export function foodReserveNeeded(state: GameState): number {
  return consumptionRate(state) * rules.foodReserve.coverMs;
}

/**
 * Quantos aldeões uma ordem de recrutamento dada agora pode chamar, até `maxQuantity`, sem
 * gastar a comida guardada: depois de pago o custo, o estoque ainda cobre a reserva de todas as
 * bocas, as de quem já está a caminho e as novas. `null` quando a reserva já não cobre nem as
 * bocas que estão a caminho: recrutar não tem mais o que tirar dela.
 */
export function recruitsKeepingFoodReserve(state: GameState, maxQuantity: number): number | null {
  const { population, recruitmentQueue } = state.settlement;
  const perMouth = balance.consumption.foodPerVillagerPerHour * MILLI * rules.foodReserve.coverMs;
  const perRecruit = (balance.recruitment.cost.food ?? 0) * MILLI * HOUR_MS;
  const stock = stockBalance(state, 'food');
  const mouths = population.villagers + recruitmentQueue.length;
  const keeps = (quantity: number) =>
    stock - perRecruit * quantity >= perMouth * (mouths + quantity);
  if (!keeps(0)) {
    return null;
  }
  let quantity = 0;
  while (quantity < maxQuantity && keeps(quantity + 1)) {
    quantity += 1;
  }
  return quantity;
}

/** Quanto falta no estoque para a reserva, em milésimos (arredondado para cima); 0 quando cobre. */
export function foodReserveMissing(state: GameState): number {
  const missing = foodReserveNeeded(state) - stockBalance(state, 'food');
  return missing <= 0 ? 0 : Math.ceil(missing / HOUR_MS);
}

/**
 * Dias de jogo inteiros de fome em `atMs`; zero sem fome. A fome que reabriu dentro da janela
 * continua a conta de onde tinha parado (`famineDurationAt`).
 */
export function famineDaysAt(state: GameState, atMs: number): number {
  return Math.floor(famineDurationAt(state, atMs) / DAY_MS);
}

/**
 * O frio conta em `atMs`: está aberto e a estação daquele instante queima lenha. O frio sempre
 * termina na virada para a primavera (GDD §4.1), e quem o fecha é o acerto de fome e frio, o
 * último passo do instante: a moral, que é recalculada antes, já não o conta nessa virada.
 */
export function coldCountsAt(state: GameState, atMs: number): boolean {
  return (
    state.settlement.cold !== null && seasonAt(atMs).effects.firewoodPerVillagerPerHour.num > 0
  );
}

/** Os efeitos temporários que ainda entram na conta de uma virada em `atMs`. */
export function effectsAt(state: GameState, atMs: number): MoraleEffect[] {
  return state.settlement.moraleEffects.filter((effect) => effect.untilMs >= atMs);
}

/**
 * Os termos da moral em `atMs`, com o estado como está: a base e, na ordem do conteúdo, só os
 * que valem. É **a** conta: a virada do dia soma estes termos, e a visão escreve um nome para
 * cada um. Com `atMs` na próxima virada, responde "para onde a moral vai, se nada mudar?".
 */
export function moraleTermsAt(state: GameState, atMs: number): MoraleTerm[] {
  const { settlement } = state;
  const terms: MoraleTerm[] = [{ id: 'base', amount: rules.base }];
  if (foodReserveMissing(state) === 0) {
    terms.push({ id: 'foodReserve', amount: rules.foodReserve.bonus });
  }
  if (settlement.famine !== null) {
    terms.push({ id: 'famine', amount: rules.famine });
    const days = famineDaysAt(state, atMs);
    if (days > 0) {
      terms.push({ id: 'famineDays', amount: rules.faminePerDay * days, days });
    }
  }
  if (settlement.population.villagers >= housingCapacity(state)) {
    terms.push({ id: 'housingFull', amount: rules.housingFull });
  }
  if (coldCountsAt(state, atMs)) {
    terms.push({ id: 'cold', amount: rules.cold });
  }
  for (const effect of effectsAt(state, atMs)) {
    terms.push({ id: 'effect', amount: effect.amount, effect });
  }
  return terms;
}

/** A soma dos termos, antes do limite: pode passar de 100 ou ficar abaixo de zero. */
export function moraleSum(terms: readonly MoraleTerm[]): number {
  return terms.reduce((sum, term) => sum + term.amount, 0);
}

/** A moral que uma virada de dia em `atMs` daria a este estado: a soma dos termos, limitada. */
export function moraleAt(state: GameState, atMs: number): number {
  return clampMorale(moraleSum(moraleTermsAt(state, atMs)));
}

/**
 * Os dois prazos da deserção por fome em ms de jogo: a carência e o passo, que o conteúdo dá em
 * **tempo real**, no ritmo desta partida (GDD §5.6; ADR 0016, item 2).
 */
export function famineDesertionPace(state: GameState): { graceMs: number; stepMs: number } {
  const { timeScale } = state.settings;
  return {
    graceMs: realToGameMs(rules.famineDesertionAfterRealMs, timeScale),
    stepMs: realToGameMs(rules.famineDesertionEveryRealMs, timeScale),
  };
}

/**
 * Quantos aldeões o prazo da deserção já deve em `atMs`, desde o começo desta fome (GDD §5.6):
 * nenhum enquanto ela dura menos que a carência; a partir dela, o primeiro e mais um a cada
 * passo. Zero sem fome e na dificuldade em que a fome não faz partir. Quem cobra é a virada do
 * dia (`moraleTurn.ts`), descontando os que a fome já tinha cobrado (`famine.deserted`).
 */
export function famineDesertionsOwedAt(state: GameState, atMs: number): number {
  if (
    state.settlement.famine === null ||
    !balance.difficulties[state.settings.difficulty].famineDesertion
  ) {
    return 0;
  }
  const { graceMs, stepMs } = famineDesertionPace(state);
  const lasted = famineDurationAt(state, atMs);
  return lasted < graceMs ? 0 : Math.floor((lasted - graceMs) / stepMs) + 1;
}

/**
 * A primeira virada de dia, de `fromMs` em diante, em que o prazo da deserção deve mais um
 * aldeão do que esta fome já cobrou, se ela durar até lá; `null` sem fome e na dificuldade em
 * que a fome não faz partir. Só lê o estado: é a visão que pergunta.
 */
export function nextFamineDesertionAt(state: GameState, fromMs: number): number | null {
  const { famine } = state.settlement;
  if (famine === null || !balance.difficulties[state.settings.difficulty].famineDesertion) {
    return null;
  }
  const { graceMs, stepMs } = famineDesertionPace(state);
  // O instante em que a fome passa a dever o aldeão seguinte, e a virada que o cobra.
  const dueAt = famine.sinceMs - famine.carriedMs + graceMs + famine.deserted * stepMs;
  return Math.max(Math.ceil(dueAt / DAY_MS), Math.ceil(fromMs / DAY_MS)) * DAY_MS;
}

/** Acima do piso: o feudo ainda pode perder um aldeão (GDD §5.6). */
export function aboveFloor(state: GameState): boolean {
  return state.settlement.population.villagers > rules.populationFloor;
}

/**
 * Grava um efeito temporário sobre a moral. Gravar de novo o mesmo `id` troca o efeito no
 * lugar, sem somar: uma carta respondida duas vezes (um recibo que voltasse ao motor) não vale
 * em dobro. O efeito não mexe na moral na hora: entra na conta das viradas de dia até
 * `untilMs`, inclusive, e sai da lista na primeira virada em que já não conta.
 *
 * Quem cria o efeito escolhe `untilMs` como `agora + N dias de jogo`: ele conta em exatamente
 * `N` viradas, seja criado no meio de um dia ou em cima de uma virada (que, na ordem do
 * instante, já recalculou a moral antes). A moral o carrega por `N` dias de jogo inteiros, da
 * primeira virada depois dele até `moraleEffectEndsAt`.
 */
export function addMoraleEffect(draft: GameState, effect: MoraleEffect): void {
  const { id, label, amount, untilMs } = effect;
  if (id === '' || label === '') {
    throw new Error('Efeito de moral sem identificador ou sem nome.');
  }
  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw new Error(`Efeito de moral com valor inválido: ${String(amount)}.`);
  }
  if (!Number.isSafeInteger(untilMs) || untilMs <= draft.lastProcessedAt) {
    throw new Error(`Efeito de moral que já nasce vencido: ${String(untilMs)}.`);
  }
  const { moraleEffects } = draft.settlement;
  const entry = { id, label, amount, untilMs };
  const index = moraleEffects.findIndex((existing) => existing.id === id);
  if (index === -1) {
    moraleEffects.push(entry);
  } else {
    moraleEffects[index] = entry;
  }
}

/**
 * O instante em que a moral deixa de carregar um efeito: a primeira virada de dia depois de
 * `untilMs`, que é a primeira em que ele já não entra na conta.
 */
export function moraleEffectEndsAt(effect: MoraleEffect): number {
  return nextDayBoundary(effect.untilMs);
}

/**
 * Tira da lista os efeitos que a virada de `atMs` já não contou: os que venceram antes dela.
 * Enquanto um efeito está na lista, a moral que vale o tem na conta (ou vai ter, na próxima
 * virada).
 */
export function dropSpentEffects(draft: GameState, atMs: number): void {
  const { settlement } = draft;
  if (settlement.moraleEffects.some((effect) => effect.untilMs < atMs)) {
    settlement.moraleEffects = settlement.moraleEffects.filter((effect) => effect.untilMs >= atMs);
  }
}
