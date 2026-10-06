import { balance, type WageArrearsRelief, wageArrearsReliefs } from '@lotg/content';

import { emit } from './chronicle';
import { DAY_MS, nextDayBoundary } from './clock';
import { goldCoversWages, goldRunsOutIn } from './economy';
import { isAtHome, isLoyal, wageRate } from './heroes';
import { reject } from './rejections';
import type { GameEvent, GameState, Hero, Rejection } from './types';
import { realToGameMs } from './units';

/**
 * O soldo em atraso (GDD §9.1; ADR 0017, decisão 3), no molde da fome (`famine.ts`): abre no
 * instante exato em que o ouro acaba com soldo a pagar, fecha quando volta a haver ouro para a
 * equipe, e o que reabre logo é o mesmo. As consequências (Descontente, herói que parte) contam
 * tempo real e são cobradas na virada do dia de jogo, como a deserção por fome.
 */

const { arrears: rules } = balance.heroes;

/** Os prazos do atraso, que o conteúdo dá em tempo real, em ms de jogo no ritmo desta partida. */
export function wageArrearsPace(state: GameState): {
  discontentAfterMs: number;
  leaveAfterMs: number;
  leaveEveryMs: number;
  resumeWithinMs: number;
} {
  const { timeScale } = state.settings;
  return {
    discontentAfterMs: realToGameMs(rules.discontentAfterRealMs, timeScale),
    leaveAfterMs: realToGameMs(rules.leaveAfterRealMs, timeScale),
    leaveEveryMs: realToGameMs(rules.leaveEveryRealMs, timeScale),
    resumeWithinMs: realToGameMs(rules.resumeWithinRealMs, timeScale),
  };
}

/**
 * Há quanto tempo de jogo o atraso aberto dura em `atMs`, contando o que ele já tinha durado
 * antes de reabrir; zero sem atraso. É a duração que o Descontente e as partidas leem.
 */
export function wageArrearsDurationAt(state: GameState, atMs: number): number {
  const { wageArrears } = state.guild;
  return wageArrears === null ? 0 : Math.max(0, atMs - wageArrears.sinceMs) + wageArrears.carriedMs;
}

/**
 * A conta que a virada do dia em `atMs` cobra: a do atraso aberto ou, sem ele, a do que fechou
 * há menos de `resumeWithinRealMs` (o que reabrir dali é o mesmo atraso, e a virada o cobra
 * como tal). `durationMs` é a duração que conta para os prazos (a do fechado parou no instante
 * em que ele fechou), `untilMs`, o instante até onde ela foi contada, e `departed`, os heróis
 * que ele já cobrou. `null` sem nada a cobrar.
 */
export type WageLedger = { open: boolean; durationMs: number; untilMs: number; departed: number };

export function wageLedgerAt(state: GameState, atMs: number): WageLedger | null {
  const { wageArrears, lastWageArrears } = state.guild;
  if (wageArrears !== null) {
    return {
      open: true,
      durationMs: wageArrearsDurationAt(state, atMs),
      untilMs: atMs,
      departed: wageArrears.departed,
    };
  }
  if (
    lastWageArrears !== null &&
    atMs - lastWageArrears.endedAtMs < wageArrearsPace(state).resumeWithinMs
  ) {
    return {
      open: false,
      durationMs: lastWageArrears.lastedMs,
      untilMs: lastWageArrears.endedAtMs,
      departed: lastWageArrears.departed,
    };
  }
  return null;
}

/**
 * O atraso **vivido por um herói**: a duração da conta, limitada ao tempo desde que ele chegou.
 * É o que os prazos dele leem (revisão da Fase C, M-R1): quem entra em um atraso velho só fica
 * Descontente depois de `discontentAfterRealMs` de atraso com ele no feudo, e só pode partir
 * depois de `leaveAfterRealMs`. Para quem já estava quando o atraso abriu, é a duração inteira.
 *
 * A conta é `min(duração, até − chegada)`: o começo que vale para ele é o maior entre o começo
 * efetivo do atraso (`sinceMs − carriedMs`) e a chegada. O estado não guarda os intervalos em
 * que um atraso retomado esteve fechado, então quem chegou **durante** um deles conta também o
 * resto desse intervalo: no máximo a janela de retomada, a favor do prazo e contra o herói.
 */
export function heroArrearsMs(ledger: WageLedger, hero: Hero): number {
  return Math.max(0, Math.min(ledger.durationMs, ledger.untilMs - hero.joinedAtMs));
}

/**
 * Quantos heróis o atraso já deve em `atMs`: zero antes de `leaveAfterRealMs` e, a partir dele,
 * `⌊(duração − carência) ÷ passo⌋ + 1`. É a conta da deserção por fome (`famineDesertionsOwedAt`),
 * com os prazos do soldo. Conta também o atraso que fechou dentro da janela (`wageLedgerAt`).
 */
export function wageDeparturesOwedAt(state: GameState, atMs: number): number {
  const { leaveAfterMs, leaveEveryMs } = wageArrearsPace(state);
  const ledger = wageLedgerAt(state, atMs);
  if (ledger === null || ledger.durationMs < leaveAfterMs) {
    return 0;
  }
  return Math.floor((ledger.durationMs - leaveAfterMs) / leaveEveryMs) + 1;
}

/**
 * Por que o atraso fecharia agora, ou `null` se ele continua: `noHeroes` quando já não há a
 * quem pagar (o último herói partiu ou foi dispensado), `paid` quando há ouro de novo para a
 * equipe: o saldo já não é negativo, ou o estoque cobre o soldo.
 */
export function wageArrearsRelief(state: GameState): WageArrearsRelief | null {
  if (wageRate(state) === 0) {
    return 'noHeroes';
  }
  return goldCoversWages(state) ? 'paid' : null;
}

/**
 * Um passo do atraso no instante `atMs`: abre ou fecha, conforme o estado de agora, e diz se
 * mexeu. Como `stepFamine`, só toca no indicador e no estoque: a Crônica e o Descontente ficam
 * com `settleWageArrears`. Troca os objetos de `guild` em vez de alterá-los, e não toca nos
 * heróis: é o que deixa a projeção da visão usá-lo em uma cópia rasa.
 *
 * Abre no instante exato em que o ouro não cobre nem mais um milissegundo de soldo. Enquanto
 * dura, o ouro não fica negativo e **não há dívida**: só se paga o que existe (`flowRate`), e o
 * que a Mina entrega vai inteiro para o soldo. Fecha no primeiro instante de evento ou de comando
 * em que o saldo de ouro deixa de ser negativo (a Mina paga a equipe inteira; o zero exato
 * fecha), ou em que o estoque voltou a cobrir ao menos um instante de soldo (um ganho discreto:
 * recompensa, carta), ou em que não há mais herói. É o contrário exato da condição que abre: o
 * atraso nunca fecha e reabre no mesmo passo.
 *
 * **O atraso que reabre logo é o mesmo.** O que fecha deixa em `lastWageArrears` o instante, a
 * duração e os heróis que tinha cobrado; o que abre antes de a janela (`resumeWithinRealMs`)
 * passar continua dali, e o tempo em dia não conta. No fim exato da janela, ou depois, é novo.
 */
export function stepWageArrears(draft: GameState, atMs: number): boolean {
  const { guild, settlement } = draft;
  const { wageArrears, lastWageArrears } = guild;
  if (wageArrears !== null) {
    if (wageArrearsRelief(draft) === null) {
      return false;
    }
    guild.lastWageArrears = {
      endedAtMs: atMs,
      lastedMs: wageArrearsDurationAt(draft, atMs),
      departed: wageArrears.departed,
    };
    guild.wageArrears = null;
    return true;
  }
  if (goldRunsOutIn(draft) !== 0) {
    return false;
  }
  // O que sobra é menos de um milissegundo de soldo: zera para o atraso ter um estado único.
  settlement.resources.gold = 0;
  settlement.accumulators.gold = 0;
  const resumes =
    lastWageArrears !== null &&
    atMs - lastWageArrears.endedAtMs < wageArrearsPace(draft).resumeWithinMs;
  guild.wageArrears = resumes
    ? { sinceMs: atMs, carriedMs: lastWageArrears.lastedMs, departed: lastWageArrears.departed }
    : { sinceMs: atMs, carriedMs: 0, departed: 0 };
  guild.lastWageArrears = null;
  return true;
}

/**
 * Abre ou fecha o atraso no instante `atMs`, com a Crônica: o último passo de `settleScarcity`,
 * depois da fome e do frio. `before` é o atraso que o instante encontrou: a Crônica só registra
 * o que mudou entre o começo e o fim dele.
 *
 * Fechado o atraso, ninguém continua Descontente; reaberto dentro da janela, quem já estava
 * volta a estar (`resumeDiscontent`). A lista de heróis é trocada, não alterada: a previsão da
 * visão chama `settleScarcity` em uma cópia que divide os heróis com o estado.
 */
export function settleWageArrears(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  before: GameState['guild']['wageArrears'],
): void {
  const { guild } = draft;
  if (before === null) {
    if (guild.wageArrears !== null) {
      emit(events, draft, atMs, 'wageArrearsStarted', { heroes: guild.heroes.length });
      resumeDiscontent(draft, atMs);
    }
    return;
  }
  if (guild.wageArrears !== null) {
    return;
  }
  if (guild.heroes.some((hero) => hero.discontent)) {
    guild.heroes = guild.heroes.map((hero) =>
      hero.discontent ? { ...hero, discontent: false } : hero,
    );
  }
  const reason: WageArrearsRelief = guild.heroes.length === 0 ? 'noHeroes' : 'paid';
  emit(
    events,
    draft,
    atMs,
    'wageArrearsEnded',
    { reason, sinceMs: before.sinceMs, departed: guild.lastWageArrears?.departed ?? 0 },
    {},
    wageArrearsReliefs[reason],
  );
}

/**
 * O atraso que reabre dentro da janela é o mesmo, e quem ele já tinha deixado Descontente volta
 * a estar **no instante em que reabre**, sem linha nova na Crônica (a linha é da virada em que
 * ficou). Sem isso, fechar e reabrir o atraso tiraria o Descontente de graça até a virada
 * seguinte. Em um atraso novo a duração é zero e ninguém muda. Troca a lista, não os heróis.
 */
function resumeDiscontent(draft: GameState, atMs: number): void {
  const { guild } = draft;
  const ledger = wageLedgerAt(draft, atMs);
  if (ledger === null) {
    return;
  }
  const { discontentAfterMs } = wageArrearsPace(draft);
  const sours = (hero: Hero) =>
    !hero.discontent && !isLoyal(hero) && heroArrearsMs(ledger, hero) >= discontentAfterMs;
  if (guild.heroes.some(sours)) {
    guild.heroes = guild.heroes.map((hero) => (sours(hero) ? { ...hero, discontent: true } : hero));
  }
}

/**
 * Quem parte primeiro: entre os que estão no feudo, o que chegou por último (o maior
 * `joinedAtMs`); no empate, o de maior número no identificador. Sem sorteio.
 */
function lastArrived(heroes: readonly Hero[]): Hero | null {
  const number = (hero: Hero) => Number(hero.id.slice(hero.id.lastIndexOf('-') + 1));
  let last: Hero | null = null;
  for (const hero of heroes) {
    if (!isAtHome(hero)) {
      continue;
    }
    if (
      last === null ||
      hero.joinedAtMs > last.joinedAtMs ||
      (hero.joinedAtMs === last.joinedAtMs && number(hero) > number(last))
    ) {
      last = hero;
    }
  }
  return last;
}

/** Quem a conta já pode levar: não é Leal e já viveu `leaveAfterRealMs` de atraso. */
function mayLeaveNow(state: GameState, ledger: WageLedger): Hero[] {
  const { leaveAfterMs } = wageArrearsPace(state);
  return state.guild.heroes.filter(
    (hero) => !isLoyal(hero) && heroArrearsMs(ledger, hero) >= leaveAfterMs,
  );
}

/**
 * O herói que a próxima virada do dia ainda leva **com o atraso já fechado**: a conta do que
 * fechou dentro da janela (`wageLedgerAt`) deve mais do que cobrou, a virada cai dentro da
 * janela e há quem possa partir. `null` no caso comum. É a visão que pergunta: quem paga um
 * atraso velho precisa saber que o prazo vencido ainda é cobrado.
 */
export function lingeringDeparture(state: GameState): { atMs: number; hero: Hero } | null {
  if (state.guild.wageArrears !== null) {
    return null;
  }
  const atMs = nextDayBoundary(state.lastProcessedAt);
  const ledger = wageLedgerAt(state, atMs);
  if (ledger === null || wageDeparturesOwedAt(state, atMs) <= ledger.departed) {
    return null;
  }
  const hero = lastArrived(mayLeaveNow(state, ledger));
  return hero === null ? null : { atMs, hero };
}

/**
 * As consequências do atraso, cobradas na virada do dia de jogo (GDD §9.1; ADR 0017, decisão 3),
 * sem sorteio e em ordem fixa. **Os prazos de cada herói contam do atraso vivido por ele**
 * (`heroArrearsMs`): para quem já estava no feudo é a duração do atraso; para quem chegou
 * depois, conta da chegada.
 *
 * 1. **Descontente.** Todo herói que não é Leal, ainda não está Descontente e já viveu
 *    `discontentAfterRealMs` de atraso passa a estar, na ordem do identificador, com uma linha
 *    para cada um. O atraso que reabriu dentro da janela já chega com a duração que tinha, e
 *    quem deixou de estar Descontente quando ele fechou volta a estar no instante em que ele
 *    reabre (`resumeDiscontent`), sem linha: a virada só anuncia quem nunca esteve.
 * 2. **Partidas.** Os devidos são os do atraso (`wageDeparturesOwedAt`: a partir de
 *    `leaveAfterRealMs`, mais um a cada `leaveEveryRealMs`). Partem os que o prazo deve e este
 *    atraso ainda não cobrou, um a um: o que chegou por último entre os que **podem partir**
 *    (não são Leais e já viveram `leaveAfterRealMs` de atraso) e estão no feudo. **Não há piso
 *    de heróis.** Se quem pode partir está todo fora, o devido **continua devido** e parte na
 *    primeira virada em que houver quem. Se **ninguém pode partir ainda** (só restam Leais, ou
 *    quem chegou há pouco), a conta fecha no que era devido, perdoada, como o aldeão que o piso
 *    da população segurou: o recém-chegado não herda o que ficou para trás, e parte no primeiro
 *    passo do prazo que vencer depois das `leaveAfterRealMs` dele. Por isso ninguém parte em
 *    bloco, e ninguém parte antes do prazo que a tela anunciou.
 *
 * **O atraso que fechou dentro da janela também é cobrado** (`wageLedgerAt`): o que reabrir dali
 * é o mesmo atraso, então a virada que o encontra fechado há menos de `resumeWithinRealMs`
 * cobra as partidas que a duração dele já devia, e a conta fica no registro
 * (`lastWageArrears.departed`) para quando ele reabrir. Sem isso, fechar o atraso um instante
 * antes de cada virada e reabri-lo um instante depois seguraria os heróis para sempre. Com o
 * atraso fechado ninguém fica Descontente (o soldo está em dia): só as partidas são cobradas.
 *
 * A virada do dia já é um instante da linha do tempo: avançar de uma vez ou aos pedaços
 * encontra as mesmas viradas, e a cobrança não ganha instante próprio.
 */
export function turnWages(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { guild } = draft;
  const ledger = wageLedgerAt(draft, atMs);
  if (ledger === null) {
    return;
  }
  const { discontentAfterMs } = wageArrearsPace(draft);
  if (ledger.open) {
    for (const hero of guild.heroes) {
      if (hero.discontent || isLoyal(hero) || heroArrearsMs(ledger, hero) < discontentAfterMs) {
        continue;
      }
      hero.discontent = true;
      emit(events, draft, atMs, 'heroDiscontent', { heroId: hero.id }, { heroi: hero.name });
    }
  }
  const owed = wageDeparturesOwedAt(draft, atMs);
  let { departed } = ledger;
  while (departed < owed) {
    const due = mayLeaveNow(draft, ledger);
    if (due.length === 0) {
      // Ninguém pode partir ainda (só Leais, ou quem chegou há pouco): o devido fica perdoado.
      departed = owed;
      break;
    }
    const leaver = lastArrived(due);
    if (leaver === null) {
      // Quem poderia partir está fora: continua devido para a virada em que tiver voltado.
      break;
    }
    guild.heroes = guild.heroes.filter((hero) => hero.id !== leaver.id);
    departed += 1;
    emit(
      events,
      draft,
      atMs,
      'heroLeft',
      { heroId: leaver.id, heroes: guild.heroes.length },
      { heroi: leaver.name },
    );
  }
  if (guild.wageArrears !== null) {
    guild.wageArrears = { ...guild.wageArrears, departed };
  } else if (guild.lastWageArrears !== null) {
    guild.lastWageArrears = { ...guild.lastWageArrears, departed };
  }
}

/**
 * A virada de dia em que o próximo herói fica Descontente, em ms de jogo: a primeira em que
 * algum dos que ainda não estão (e não são Leais) já viveu `discontentAfterRealMs` de atraso.
 * `null` sem atraso e quando não há quem fique (todos já estão, ou são Leais). É o prazo que a
 * visão mostra, e não um instante da linha do tempo.
 */
export function nextDiscontentAt(state: GameState): number | null {
  const { wageArrears, heroes } = state.guild;
  if (wageArrears === null) {
    return null;
  }
  const { discontentAfterMs } = wageArrearsPace(state);
  const started = wageArrears.sinceMs - wageArrears.carriedMs;
  let dueAt: number | null = null;
  for (const hero of heroes) {
    if (hero.discontent || isLoyal(hero)) {
      continue;
    }
    const heroDueAt = Math.max(started, hero.joinedAtMs) + discontentAfterMs;
    dueAt = dueAt === null ? heroDueAt : Math.min(dueAt, heroDueAt);
  }
  return dueAt === null ? null : firstTurnFrom(state, dueAt);
}

/**
 * A virada de dia que cobra a próxima partida, em ms de jogo, se o atraso durar até lá e
 * ninguém chegar nem for dispensado: refaz, virada a virada, a conta de `turnWages` (os devidos
 * do prazo, quem já pode partir, e o devido que fica perdoado enquanto ninguém pode). `null`
 * sem atraso e quando ninguém pode partir (não há herói no feudo que não seja Leal).
 */
export function nextWageDepartureAt(state: GameState): number | null {
  const { wageArrears, heroes } = state.guild;
  if (wageArrears === null) {
    return null;
  }
  const { leaveAfterMs, leaveEveryMs } = wageArrearsPace(state);
  const started = wageArrears.sinceMs - wageArrears.carriedMs;
  const mayLeaveAt = (hero: Hero) => Math.max(started, hero.joinedAtMs) + leaveAfterMs;
  const leavers = heroes.filter((hero) => !isLoyal(hero));
  const first =
    lastArrived(leavers) === null ? null : Math.min(...leavers.filter(isAtHome).map(mayLeaveAt));
  if (first === null) {
    return null;
  }
  const owedAt = (atMs: number) =>
    atMs - started < leaveAfterMs
      ? 0
      : Math.floor((atMs - started - leaveAfterMs) / leaveEveryMs) + 1;
  let { departed } = wageArrears;
  // Da primeira virada depois de agora até um passo do prazo depois de alguém poder partir.
  const lastTurn = nextDayBoundary(Math.max(first, state.lastProcessedAt) + leaveEveryMs);
  for (let turn = nextDayBoundary(state.lastProcessedAt); turn <= lastTurn; turn += DAY_MS) {
    const owed = owedAt(turn);
    if (owed <= departed) {
      continue;
    }
    if (leavers.some((hero) => isAtHome(hero) && mayLeaveAt(hero) <= turn)) {
      return turn;
    }
    if (!leavers.some((hero) => mayLeaveAt(hero) <= turn)) {
      departed = owed;
    }
  }
  return null;
}

/** A primeira virada de dia depois de agora que cai em `dueAt` ou depois dele. */
function firstTurnFrom(state: GameState, dueAt: number): number {
  const next = nextDayBoundary(state.lastProcessedAt);
  return dueAt <= next ? next : nextDayBoundary(dueAt - 1);
}

/**
 * A ordem de dispensar um herói (GDD §9.1; ADR 0017, decisão 3): sempre possível, sem devolução
 * de ouro. Com o soldo em atraso, pode ser o que fecha a conta: `settleScarcity` confere depois
 * de toda ordem, e a dispensa não conta como herói cobrado pelo prazo.
 *
 * Quem está fora do feudo (em expedição) não pode ser dispensado antes de voltar (`HERO_BUSY`).
 */
export function dismissHero(
  draft: GameState,
  heroId: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const { guild } = draft;
  const hero = guild.heroes.find((entry) => entry.id === heroId);
  if (hero === undefined) {
    return reject('HERO_NOT_FOUND');
  }
  if (!isAtHome(hero)) {
    return reject('HERO_BUSY', { label: hero.name });
  }
  guild.heroes = guild.heroes.filter((entry) => entry.id !== hero.id);
  emit(
    events,
    draft,
    nowMs,
    'heroDismissed',
    { heroId: hero.id, heroes: guild.heroes.length },
    { heroi: hero.name },
  );
  return null;
}
