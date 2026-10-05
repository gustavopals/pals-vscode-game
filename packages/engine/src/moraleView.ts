import { balance, buildings } from '@lotg/content';

import { nextDayBoundary } from './clock';
import { buildingWithArticle } from './construction';
import type { CraftOutlook } from './craftProjection';
import { moraleRatio, producerOf } from './economy';
import { decimal, durationText, plural, sentenceCase, thousands } from './format';
import {
  aboveFloor,
  clampMorale,
  famineDesertionsOwedAt,
  foodReserveMissing,
  foodReserveNeeded,
  MAX_MORALE,
  moraleBand,
  moraleEffectEndsAt,
  moraleSum,
  type MoraleTerm,
  moraleTermsAt,
  nextFamineDesertionAt,
  recruitsKeepingFoodReserve,
} from './morale';
import { housingVacancy } from './population';
import { storageCapacity, storagePlace, storeOf } from './storage';
import type { GameState, MoraleLevelView, MoraleView } from './types';
import { HOUR_MS, MILLI, realSecondsCeil, SECOND_MS } from './units';

const { morale: rules } = balance;

/** O número, a faixa e o fator na produção de uma moral. */
function level(value: number): MoraleLevelView {
  const band = moraleBand(value);
  const { num, den } = moraleRatio(value);
  return { value, band: band.id, bandLabel: band.label, multiplierPercent: (num * 100) / den };
}

/** "× 1,09", com três casas: a moral anda de 0,005 em 0,005. */
function times(value: number): string {
  const { num, den } = moraleRatio(value);
  return `× ${decimal(num / den, 3)}`;
}

/** "20%": uma chance do conteúdo, como a tela a diz. */
function percent({ num, den }: { num: number; den: number }): string {
  return `${decimal((num * 100) / den)}%`;
}

/** "na Fazenda", "na Serraria": onde pôr gente para o recurso voltar. */
function atProducerOf(resource: 'food' | 'wood'): string {
  const { article, label } = buildings[producerOf(resource)];
  return `n${article} ${label}`;
}

const people = (count: number) => plural(count, 'habitante', 'habitantes');
const HOUSING_REMEDY = 'melhore as Habitações ou o Salão';

/** O nome de um termo na explicação. O prazo da comida guardada sai no ritmo da partida. */
function termLabel(term: MoraleTerm, reserveText: string): string {
  switch (term.id) {
    case 'base':
      return 'Base';
    case 'foodReserve':
      return `Comida guardada para ${reserveText}`;
    case 'famine':
      return 'Fome';
    case 'famineDays':
      return `${plural(term.days, 'dia inteiro', 'dias inteiros')} de fome`;
    case 'housingFull':
      return 'Casas cheias';
    case 'cold':
      return 'Frio';
    case 'effect':
      return term.effect.label;
  }
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * A conta em uma linha: "50 (base) + 10 (comida guardada para 8 h) − 10 (casas cheias) = 50".
 * Quando a soma sai do intervalo, a linha diz a soma e o limite que a segurou.
 */
function breakdownText(terms: ReadonlyArray<{ label: string; amount: number }>): string {
  const sum = terms.reduce((total, term) => total + term.amount, 0);
  const parts = terms.map(({ label, amount }, index) => {
    const name = `(${lowerFirst(label)})`;
    if (index === 0) {
      return `${amount} ${name}`;
    }
    return `${amount < 0 ? '−' : '+'} ${Math.abs(amount)} ${name}`;
  });
  const total = String(sum).replace('-', '−');
  if (sum < 0) {
    return `${parts.join(' ')} = ${total}; a moral não desce de 0`;
  }
  if (sum > MAX_MORALE) {
    return `${parts.join(' ')} = ${total}; a moral não passa de ${MAX_MORALE}`;
  }
  return `${parts.join(' ')} = ${total}`;
}

/** Para onde a moral vai na próxima virada, em uma frase sem o prazo (que anda sozinho na tela). */
function nextText(value: number, next: MoraleLevelView): string {
  const lead = 'A moral só muda na virada do dia: na próxima,';
  if (next.value === value) {
    return `${lead} continua em ${value}.`;
  }
  const verb = next.value > value ? 'sobe' : 'cai';
  return `${lead} ${verb} de ${value} para ${next.value} (${next.bandLabel}).`;
}

/** A reserva de comida de um estado, em unidades: quanto ele pede e quanto lhe falta. */
function reserveOf(state: GameState): { needed: number; missing: number; neededMilli: number } {
  const neededMilli = Math.ceil(foodReserveNeeded(state) / HOUR_MS);
  return {
    neededMilli,
    needed: Math.ceil(neededMilli / MILLI),
    missing: Math.ceil(foodReserveMissing(state) / MILLI),
  };
}

/**
 * A comida guardada que vale o bônus, em unidades, com a frase que diz quanto é e o que falta.
 * Os números são os de agora; a frase diz também o que a virada do dia vai encontrar, quando
 * não é o mesmo: a reserva que o consumo leva antes dela, ou a que a produção completa. Quando
 * a reserva não cabe no depósito, a frase diz o que ampliar: esperar não resolve.
 */
function foodReserveView(
  state: GameState,
  atTurn: GameState,
  reserveText: string,
): MoraleView['foodReserve'] {
  const { bonus } = rules.foodReserve;
  const { villagers } = state.settlement.population;
  const { needed, missing, neededMilli } = reserveOf(state);
  const later = reserveOf(atTurn);
  const covered = missing === 0;
  const holdsAtNextTurn = later.missing === 0;
  const food = balance.resources.food.label.toLowerCase();
  const numbers = { covered, holdsAtNextTurn, needed, missing, bonus };
  if (covered && holdsAtNextTurn) {
    return {
      ...numbers,
      text: `Há ${food} guardada para ${reserveText} (${thousands(needed)} para ${people(villagers)}): a moral ganha ${bonus}.`,
    };
  }
  if (covered) {
    const mouths = people(atTurn.settlement.population.villagers);
    return {
      ...numbers,
      text:
        `Há ${food} guardada para ${reserveText} agora, mas não na virada do dia: lá serão precisos ${thousands(later.needed)} ` +
        `para ${mouths}, e faltarão ${thousands(later.missing)}. A moral deixa de ganhar ${bonus}.`,
    };
  }
  const goal =
    `Com ${thousands(needed)} de ${food} guardada (o que ${people(villagers)} ${villagers === 1 ? 'come' : 'comem'} em ${reserveText}), ` +
    `a moral ganha ${bonus}.`;
  return {
    ...numbers,
    text: holdsAtNextTurn
      ? `${goal} Faltam ${thousands(missing)}, e a produção os junta antes da virada do dia.`
      : `${goal} Faltam ${thousands(missing)}.${reserveBeyondStorage(state, neededMilli)}`,
  };
}

/**
 * Quando a reserva não cabe no depósito, juntar comida não resolve: a frase diz quanto ele
 * guarda e o que fazer com ele. Vazia quando a reserva cabe.
 */
function reserveBeyondStorage(state: GameState, neededMilli: number): string {
  const cap = storageCapacity(state, 'food');
  const place = storagePlace(state, 'food');
  const store = storeOf('food');
  if (cap === null || place === null || store === null || neededMilli <= cap) {
    return '';
  }
  const level = state.settlement.buildings[store.building];
  let remedy = 'não há como guardar tanto';
  if (level === 0) {
    remedy = `construa ${buildingWithArticle(store.building)}`;
  } else if (level < buildings[store.building].maxLevel) {
    remedy = `amplie ${buildingWithArticle(store.building)}`;
  }
  const where = sentenceCase(`${place.article} ${place.label}`);
  return ` ${where} só guarda ${thousands(cap / MILLI)}: ${remedy}.`;
}

/** Em quantos ms de jogo a fome e o frio abertos acabam sozinhos; `null` quando não acabam. */
type Relief = Pick<CraftOutlook, 'famineEndsIn' | 'coldEndsIn'>;

/** O que pesa na moral, do ponto de vista de quem pode agir: a fome e os dias dela são um peso só. */
type Burden =
  | { kind: 'famine' | 'cold' | 'housingFull'; amount: number }
  | { kind: 'effect'; amount: number; label: string; endsAtMs: number };

function burdensOf(terms: readonly MoraleTerm[]): Burden[] {
  const burdens: Burden[] = [];
  const famine = terms
    .filter((term) => term.id === 'famine' || term.id === 'famineDays')
    .reduce((sum, term) => sum + term.amount, 0);
  if (famine < 0) {
    burdens.push({ kind: 'famine', amount: famine });
  }
  for (const term of terms) {
    if (term.id === 'cold' || term.id === 'housingFull') {
      burdens.push({ kind: term.id, amount: term.amount });
    } else if (term.id === 'effect' && term.amount < 0) {
      burdens.push({
        kind: 'effect',
        amount: term.amount,
        label: term.effect.label,
        endsAtMs: moraleEffectEndsAt(term.effect),
      });
    }
  }
  return burdens;
}

/**
 * O que fazer: o que mais pesa na conta da próxima virada e a ação que o tira dela. No empate
 * vale a ordem da conta (a fome antes do frio, o frio antes das casas). Sem nada pesando, a
 * dica é o bônus da comida guardada, quando a próxima virada não o traz; com ele garantido,
 * não há o que dizer.
 */
function adviceText(
  state: GameState,
  terms: readonly MoraleTerm[],
  reserve: MoraleView['foodReserve'],
  timeScale: number,
  relief: Relief,
): string | null {
  const heaviest = burdensOf(terms).reduce<Burden | null>(
    (worst, burden) => (worst === null || burden.amount < worst.amount ? burden : worst),
    null,
  );
  if (heaviest === null) {
    return reserve.holdsAtNextTurn ? null : reserve.text;
  }
  const weight = `(−${Math.abs(heaviest.amount)})`;
  // Quando a fome ou o frio já acabam sozinhos (quem chegou ao ofício ainda se adapta), o
  // conselho diz o prazo: mandar mais gente abriria outra leva de adaptação à toa.
  const alone = (endsInMs: number) =>
    `em ${durationText(realSecondsCeil(endsInMs, timeScale))}, sem ninguém mudar de ofício, e a moral sobe na virada seguinte.`;
  switch (heaviest.kind) {
    case 'famine':
      if (relief.famineEndsIn !== null) {
        return `O que mais pesa é a fome ${weight}. Ela acaba sozinha ${alone(relief.famineEndsIn)}`;
      }
      return (
        `O que mais pesa é a fome ${weight}. Ponha mais gente ${atProducerOf('food')}: ` +
        'quando a comida voltar a sobrar, a fome acaba e a moral sobe na virada seguinte.'
      );
    case 'cold':
      if (relief.coldEndsIn !== null) {
        return `O que mais pesa é o frio ${weight}. Ele passa sozinho ${alone(relief.coldEndsIn)}`;
      }
      return (
        `O que mais pesa é o frio ${weight}. Ponha gente ${atProducerOf('wood')}: ` +
        'com lenha na lareira o frio passa, e a moral sobe na virada seguinte.'
      );
    case 'housingFull':
      return (
        `O que mais pesa são as casas cheias ${weight}. ${sentenceCase(HOUSING_REMEDY)}: ` +
        'com uma vaga livre, a moral sobe na virada seguinte.'
      );
    case 'effect': {
      const ends = realSecondsCeil(heaviest.endsAtMs - state.lastProcessedAt, timeScale);
      return `O que mais pesa é "${heaviest.label}" ${weight}: passa sozinho em ${durationText(ends)}.`;
    }
  }
}

/**
 * O que a moral e a fome longa fazem com a população nas viradas do dia, com a moral que a
 * próxima virada vai calcular e o feudo como ela vai encontrá-lo (`state` é o da virada; `now`,
 * o instante de quem olha): é com eles que os sorteios são feitos.
 *
 * A carência e o passo da deserção são **tempo real** (ADR 0016, item 2): saem do conteúdo como
 * estão, iguais em todo ritmo. O prazo até o próximo desertor é o da virada do dia que o cobra.
 */
function populationNotes(
  state: GameState,
  now: number,
  next: MoraleLevelView,
  timeScale: number,
): string[] {
  const { arrival, departure, populationFloor } = rules;
  const { settlement, settings } = state;
  const notes: string[] = [];
  if (next.value >= arrival.minMorale) {
    notes.push(
      housingVacancy(state) > 0
        ? `Com a moral em ${arrival.minMorale} ou mais e vaga nas casas, cada virada do dia tem ${percent(arrival.chance)} de chance de trazer um colono.`
        : `Com a moral em ${arrival.minMorale} ou mais, cada virada do dia poderia trazer um colono, mas não há vaga nas casas: ${HOUSING_REMEDY}.`,
    );
  }
  const canLose = aboveFloor(state);
  const mayLeave = next.value <= departure.maxMorale;
  if (mayLeave && canLose) {
    notes.push(
      `Com a moral em ${departure.maxMorale} ou menos, cada virada do dia tem ${percent(departure.chance)} de chance de levar um aldeão embora.`,
    );
  }
  const difficulty = balance.difficulties[settings.difficulty];
  const mayDesert = settlement.famine !== null && difficulty.famineDesertion;
  if (settlement.famine !== null && !difficulty.famineDesertion) {
    notes.push(`Em ${difficulty.label}, ninguém deserta por fome.`);
  }
  if (settlement.famine !== null && mayDesert && canLose) {
    const after = durationText(rules.famineDesertionAfterRealMs / SECOND_MS);
    const every = durationText(rules.famineDesertionEveryRealMs / SECOND_MS);
    // A virada de dia que cobra o próximo desertor, se a fome durar até lá.
    const turn = nextFamineDesertionAt(state, state.lastProcessedAt) ?? state.lastProcessedAt;
    const left = durationText(realSecondsCeil(turn - now, timeScale));
    notes.push(
      famineDesertionsOwedAt(state, state.lastProcessedAt) > 0
        ? `A fome já dura ${after} ou mais: deserta um aldeão a cada ${every} de fome, na virada do dia, até a comida voltar. Faltam ${left} para o próximo.`
        : `Depois de ${after} de fome, deserta um aldeão a cada ${every}, na virada do dia. Faltam ${left} para o primeiro.`,
    );
  }
  if (!canLose && (mayLeave || mayDesert)) {
    notes.push(
      `Restam ${plural(settlement.population.villagers, 'aldeão', 'aldeões')}: com ${populationFloor} ou menos, ninguém mais parte nem deserta.`,
    );
  }
  return notes;
}

/**
 * O que uma ordem de recrutamento dada agora custa à moral, para a tela mostrar ao lado do
 * custo em recursos: a comida guardada que os recrutas gastam e as casas que eles enchem, com
 * quantos chamar para evitar cada coisa. `null` quando recrutar não mexe na moral.
 */
export function recruitmentMoraleNote(state: GameState, maxQuantity: number): string | null {
  if (maxQuantity <= 0) {
    return null;
  }
  const notes: string[] = [];
  const recruits = (count: number) => plural(count, 'aldeão', 'aldeões');
  const safe = recruitsKeepingFoodReserve(state, maxQuantity);
  if (safe !== null && safe < maxQuantity) {
    const worth = `a comida guardada, que vale ${rules.foodReserve.bonus} de moral`;
    notes.push(
      safe === 0
        ? `Chamar aldeões agora gasta ${worth}.`
        : `Chamar mais de ${recruits(safe)} agora gasta ${worth}.`,
    );
  }
  // Quem enche as casas com esta ordem as encontra cheias quando o último chegar.
  const vacancy = housingVacancy(state);
  if (maxQuantity >= vacancy) {
    const penalty = `Com as casas cheias a moral perde ${Math.abs(rules.housingFull)}`;
    notes.push(
      vacancy > 1
        ? `${penalty}: para evitar, chame até ${vacancy - 1}.`
        : `${penalty}: é o que custa ocupar a última cama.`,
    );
  }
  return notes.length === 0 ? null : notes.join(' ');
}

/**
 * A moral na visão (GDD §5.7), em tempo real: o que ela vale, o que a próxima virada do dia
 * vai fazer dela, termo a termo, e o que o jogador pode mudar antes.
 *
 * `atTurn` é o estado como essa virada vai encontrá-lo se nenhuma ordem chegar antes
 * (`stateAtNextMoraleTurn`): a conta sai dele, e por isso é exatamente a que a virada vai
 * fazer. `relief` diz se a fome e o frio abertos acabam sozinhos, e quando: o conselho não
 * manda pôr gente onde já há gente que basta. A comida que o consumo leva embora antes da virada, o aldeão que chega e enche as
 * casas, a fome que abre no caminho: tudo já está na conta, antes de acontecer.
 */
export function moraleView(
  state: GameState,
  atTurn: GameState,
  timeScale: number,
  relief: Relief,
): MoraleView {
  const now = state.lastProcessedAt;
  const nextTurn = nextDayBoundary(now);
  const { morale, moraleEffects } = state.settlement;
  const current = level(morale);
  const terms = moraleTermsAt(atTurn, nextTurn);
  const next = level(clampMorale(moraleSum(terms)));
  const reserveText = durationText(realSecondsCeil(rules.foodReserve.coverMs, timeScale));
  const reserve = foodReserveView(state, atTurn, reserveText);
  const named = terms.map((term) => ({
    id: term.id,
    label: termLabel(term, reserveText),
    amount: term.amount,
  }));
  return {
    ...current,
    text:
      current.multiplierPercent === 100
        ? `Moral ${morale} (${current.bandLabel}): não mexe na produção.`
        : `Moral ${morale} (${current.bandLabel}): produção ${times(morale)}.`,
    terms: named,
    breakdown: breakdownText(named),
    nextUpdateInSeconds: realSecondsCeil(nextTurn - now, timeScale),
    next,
    nextText: nextText(morale, next),
    advice: adviceText(state, terms, reserve, timeScale, relief),
    foodReserve: reserve,
    notes: populationNotes(atTurn, now, next, timeScale),
    effects: moraleEffects.map((effect) => ({
      label: effect.label,
      amount: effect.amount,
      endsInSeconds: realSecondsCeil(moraleEffectEndsAt(effect) - now, timeScale),
    })),
  };
}
