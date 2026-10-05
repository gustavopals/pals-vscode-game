import { balance, type WageArrearsRelief, wageArrearsReliefs } from '@lotg/content';

import { emit } from './chronicle';
import { nextDayBoundary } from './clock';
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
 * Quantos heróis o atraso já deve em `atMs`: zero antes de `leaveAfterRealMs` e, a partir dele,
 * `⌊(duração − carência) ÷ passo⌋ + 1`. É a conta da deserção por fome (`famineDesertionsOwedAt`),
 * com os prazos do soldo.
 */
export function wageDeparturesOwedAt(state: GameState, atMs: number): number {
  const { leaveAfterMs, leaveEveryMs } = wageArrearsPace(state);
  const duration = wageArrearsDurationAt(state, atMs);
  if (state.guild.wageArrears === null || duration < leaveAfterMs) {
    return 0;
  }
  return Math.floor((duration - leaveAfterMs) / leaveEveryMs) + 1;
}

/**
 * Por que o atraso fecharia agora, ou `null` se ele continua: `noHeroes` quando já não há a
 * quem pagar (o último herói partiu ou foi dispensado), `paid` quando há ouro de novo para a
 * equipe, no saldo ou no estoque.
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
 * em que o saldo de ouro é positivo, ou em que o estoque voltou a cobrir ao menos um instante de
 * soldo (um ganho discreto: recompensa, carta), ou em que não há mais herói. É o contrário exato
 * da condição que abre: o atraso nunca fecha e reabre no mesmo passo.
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
 * Fechado o atraso, ninguém continua Descontente. A lista de heróis é trocada, não alterada: a
 * previsão da visão chama `settleScarcity` em uma cópia que divide os heróis com o estado.
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
 * Quem parte primeiro: entre os que estão no feudo e não são Leais, o que chegou por último
 * (o maior `joinedAtMs`); no empate, o de maior número no identificador. Sem sorteio.
 */
function lastArrived(heroes: readonly Hero[]): Hero | null {
  const number = (hero: Hero) => Number(hero.id.slice(hero.id.lastIndexOf('-') + 1));
  let last: Hero | null = null;
  for (const hero of heroes) {
    if (!isAtHome(hero) || isLoyal(hero)) {
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

/**
 * As consequências do atraso, cobradas na virada do dia de jogo (GDD §9.1; ADR 0017, decisão 3),
 * sem sorteio e em ordem fixa:
 *
 * 1. **Descontente.** Com o atraso durando `discontentAfterRealMs` ou mais, todo herói que não
 *    é Leal e ainda não está Descontente passa a estar, na ordem do identificador, com uma
 *    linha para cada um. O atraso que reabriu dentro da janela já chega com a duração que
 *    tinha: quem deixou de estar Descontente quando ele fechou volta a estar nesta virada.
 * 2. **Partidas.** A partir de `leaveAfterRealMs`, partem os heróis que o prazo já deve e que
 *    este atraso ainda não cobrou, um a um: o que chegou por último entre os que estão no feudo
 *    e não são Leais. **Não há piso de heróis.** Se o devido não pode partir porque os que não
 *    são Leais estão todos fora, ele **continua devido** enquanto o atraso durar e parte na
 *    primeira virada em que houver quem; se só restam Leais (ou ninguém), a conta fecha no que
 *    era devido, perdoada, como o aldeão que o piso da população segurou.
 *
 * A virada do dia já é um instante da linha do tempo: avançar de uma vez ou aos pedaços
 * encontra as mesmas viradas, e a cobrança não ganha instante próprio.
 */
export function turnWages(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { guild } = draft;
  const arrears = guild.wageArrears;
  if (arrears === null) {
    return;
  }
  if (wageArrearsDurationAt(draft, atMs) >= wageArrearsPace(draft).discontentAfterMs) {
    for (const hero of guild.heroes) {
      if (hero.discontent || isLoyal(hero)) {
        continue;
      }
      hero.discontent = true;
      emit(events, draft, atMs, 'heroDiscontent', { heroId: hero.id }, { heroi: hero.name });
    }
  }
  const owed = wageDeparturesOwedAt(draft, atMs);
  let { departed } = arrears;
  while (departed < owed) {
    if (guild.heroes.every(isLoyal)) {
      // Só restam Leais, ou ninguém: o que o prazo devia fica perdoado.
      departed = owed;
      break;
    }
    const leaver = lastArrived(guild.heroes);
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
  guild.wageArrears = { ...arrears, departed };
}

/**
 * A virada de dia em que quem não é Leal fica Descontente, em ms de jogo: a primeira em que o
 * atraso já dura `discontentAfterRealMs`. `null` sem atraso e quando não há quem fique (todos
 * já estão, ou são Leais). É o prazo que a visão mostra, e não um instante da linha do tempo.
 */
export function nextDiscontentAt(state: GameState): number | null {
  const { wageArrears, heroes } = state.guild;
  if (wageArrears === null || heroes.every((hero) => hero.discontent || isLoyal(hero))) {
    return null;
  }
  const dueAt =
    wageArrears.sinceMs + wageArrearsPace(state).discontentAfterMs - wageArrears.carriedMs;
  return firstTurnFrom(state, dueAt);
}

/**
 * A virada de dia que cobra a próxima partida, em ms de jogo: a primeira em que o prazo deve
 * mais um herói do que este atraso já cobrou. `null` sem atraso e quando ninguém pode partir
 * (não há herói no feudo que não seja Leal).
 */
export function nextWageDepartureAt(state: GameState): number | null {
  const { wageArrears, heroes } = state.guild;
  if (wageArrears === null || lastArrived(heroes) === null) {
    return null;
  }
  const { leaveAfterMs, leaveEveryMs } = wageArrearsPace(state);
  // O instante em que o atraso passa a dever `departed + 1` heróis.
  const dueAt =
    wageArrears.sinceMs +
    leaveAfterMs +
    wageArrears.departed * leaveEveryMs -
    wageArrears.carriedMs;
  return firstTurnFrom(state, dueAt);
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
 * Nesta fase todo herói está no feudo. A recusa de quem está fora (`HERO_BUSY`) entra com a
 * primeira tarefa que tira um herói do feudo, na Fase D.
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
