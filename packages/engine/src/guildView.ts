import {
  balance,
  guildTexts,
  heroAttributes,
  heroClasses,
  heroStatuses,
  heroTraits,
  type Ratio,
} from '@lotg/content';

import { buildingWithArticle } from './construction';
import type { CraftOutlook } from './craftProjection';
import { netRates, producerOf, stockBalance } from './economy';
import { storageCapacity } from './storage';
import { decimal, durationText, plural } from './format';
import {
  classLabel,
  heroFactors,
  heroLimit,
  heroPower,
  isLoyal,
  namedHeroOf,
  paidHeroes,
  rosterHasRoom,
  traitLabel,
  wageRate,
} from './heroes';
import type {
  ArrivingHeroView,
  GameState,
  GuildView,
  Hero,
  HeroView,
  WageArrearsView,
} from './types';
import { HOUR_MS, MILLI, realSecondsCeil, SECOND_MS } from './units';
import { nextDiscontentAt, nextWageDepartureAt, wageArrearsDurationAt } from './wages';

/**
 * Os heróis e o soldo na visão (GDD §9.1; ADR 0017, decisões 3, 5 e 7). Só lê o estado: não
 * sorteia, não dá identificador e não anda o tempo. Tudo o que é prazo ou taxa sai em tempo
 * real, no ritmo `timeScale`.
 */

const { heroes: rules } = balance;

function realSecondsFloor(gameMs: number, timeScale: number): number {
  return Math.max(0, Math.floor(gameMs / timeScale / SECOND_MS));
}

/** " ÷ 10", " × 3", " × 3 ÷ 2", ou nada para o peso inteiro: como o peso entra na conta escrita. */
function weightText({ num, den }: Ratio): string {
  return `${num === 1 ? '' : ` × ${num}`}${den === 1 ? '' : ` ÷ ${den}`}`;
}

/**
 * "(14 de ataque + 16 de defesa + 120 de vida ÷ 10) × 1,08 (Nv2) × 0,8 (descontente) = 36,288":
 * os atributos que o conteúdo pesa, com o peso de cada um, e um termo para cada fator da conta
 * de `heroPower`. O nível aparece sempre; o Descontente, só quando vale.
 */
function powerBreakdown(hero: Hero): string {
  const { attributes } = heroClasses[hero.classId];
  const base = Object.entries(rules.power)
    .map(
      ([attribute, weight]) =>
        `${attributes[attribute as keyof typeof attributes]} de ${
          heroAttributes[attribute as keyof typeof attributes].label
        }${weightText(weight)}`,
    )
    .join(' + ');
  const factors = heroFactors(hero)
    .map(({ ratio, label }) => ` × ${decimal(ratio.num / ratio.den, 3)} (${label})`)
    .join('');
  return `(${base})${factors} = ${decimal(heroPower(hero) / MILLI, 3)}`;
}

function heroView(hero: Hero, timeScale: number): HeroView {
  return {
    id: hero.id,
    name: hero.name,
    classLabel: classLabel(hero),
    level: hero.level,
    xp: hero.xp,
    xpToNext: rules.xpToNext[hero.level - 1] ?? null,
    traits: hero.traits.map((trait) => ({
      label: traitLabel(trait, hero.gender),
      text: heroTraits[trait].text,
    })),
    statusText: heroStatuses[hero.status].label,
    power: heroPower(hero) / MILLI,
    powerBreakdown: powerBreakdown(hero),
    wagePerHour: rules.wagePerHour * timeScale,
    discontent: hero.discontent,
  };
}

/** Um prazo de tempo real do conteúdo, por extenso: "12 h". */
const realText = (realMs: number): string => durationText(realMs / SECOND_MS);

/**
 * O atraso em frases: o que ele é, o que os prazos cobram (em tempo real, como o conteúdo os
 * dá, iguais em qualquer ritmo), quem fica e o que fecha a conta. Os prazos que andam
 * (`discontentInSeconds`, `nextDepartureInSeconds`) ficam fora da frase: a tela os conta.
 */
function arrearsText(state: GameState): string {
  const { heroes } = state.guild;
  const { arrears } = rules;
  const unpaid = plural(paidHeroes(state), 'herói não recebe', 'heróis não recebem');
  const { num, den } = arrears.discontentFactor;
  const cut = decimal(((den - num) * 100) / den);
  const sentences = [`Soldo em atraso: o cofre está vazio e ${unpaid}.`];
  if (heroes.every(isLoyal)) {
    const women = heroes.every((hero) => hero.gender === 'f');
    sentences.push(
      heroes.length === 1
        ? `${women ? 'Ela' : 'Ele'} é Leal: não fica descontente nem parte.`
        : `São ${women ? 'todas' : 'todos'} Leais: não ficam descontentes nem partem.`,
    );
  } else {
    sentences.push(
      `Com ${realText(arrears.discontentAfterRealMs)} de atraso, quem não é Leal fica descontente e perde ${cut}% dos atributos; com ${realText(arrears.leaveAfterRealMs)}, parte um herói a cada ${realText(arrears.leaveEveryRealMs)}, o que chegou por último. As duas coisas acontecem na virada do dia.`,
    );
    const { wageArrears } = state.guild;
    const started = wageArrears === null ? 0 : wageArrears.sinceMs - wageArrears.carriedMs;
    if (heroes.some((hero) => !isLoyal(hero) && hero.joinedAtMs > started)) {
      sentences.push('Para quem chegou com o atraso já aberto, os dois prazos contam da chegada.');
    }
  }
  const mine = buildingWithArticle(producerOf('gold'));
  sentences.push(
    `O que não foi pago não vira dívida: o atraso fecha quando o ouro voltar a sobrar. Para isso, ponha gente n${mine} ou dispense um herói.`,
  );
  return sentences.join(' ');
}

function arrearsView(state: GameState, timeScale: number): WageArrearsView | null {
  if (state.guild.wageArrears === null) {
    return null;
  }
  const now = state.lastProcessedAt;
  const until = (atMs: number | null) =>
    atMs === null ? null : realSecondsCeil(atMs - now, timeScale);
  return {
    secondsElapsed: realSecondsFloor(wageArrearsDurationAt(state, now), timeScale),
    text: arrearsText(state),
    discontentInSeconds: until(nextDiscontentAt(state)),
    nextDepartureInSeconds: until(nextWageDepartureAt(state)),
  };
}

/**
 * Por quanto tempo real o ouro ainda paga a equipe: o instante em que o atraso abriria, na
 * projeção do ofício (`CraftOutlook.goldRunsOutIn`). Zero com o atraso aberto; `null` sem herói
 * e quando o ouro não acaba.
 */
function coveredForSeconds(
  state: GameState,
  timeScale: number,
  outlook: CraftOutlook,
): number | null {
  if (state.guild.wageArrears !== null) {
    return 0;
  }
  const { goldRunsOutIn } = outlook;
  return goldRunsOutIn === null ? null : realSecondsFloor(goldRunsOutIn, timeScale);
}

/**
 * O soldo depois de chegarem os prometidos que têm instante marcado (`wage.afterArrivals`):
 * quanto a equipe passa a custar e por quanto tempo real o ouro a paga, somando o soldo de cada
 * um a partir do instante em que chega. A conta é pelo **saldo de agora** (o que a Mina entrega
 * hoje), trecho a trecho, em inteiros; se a projeção do ofício já diz que o ouro acaba antes da
 * primeira chegada, vale o prazo dela, o mesmo de `coveredForSeconds`. Quem espera lugar à
 * porta não entra na conta: não tem instante. `null` sem ninguém a caminho.
 */
function afterArrivals(
  state: GameState,
  timeScale: number,
  outlook: CraftOutlook,
): GuildView['wage']['afterArrivals'] {
  const now = state.lastProcessedAt;
  const coming = state.guild.arriving.filter(
    (entry) => entry.atMs > now && namedHeroOf(entry.namedHeroId) !== null,
  );
  if (coming.length === 0) {
    return null;
  }
  const wage = rules.wagePerHour * MILLI;
  const perHour = ((wageRate(state) + coming.length * wage) * timeScale) / MILLI;
  if (state.guild.wageArrears !== null) {
    return { perHour, coveredForSeconds: 0 };
  }
  const first = coming[0]?.atMs ?? now;
  if (outlook.goldRunsOutIn !== null && now + outlook.goldRunsOutIn <= first) {
    return { perHour, coveredForSeconds: realSecondsFloor(outlook.goldRunsOutIn, timeScale) };
  }
  const cap = (storageCapacity(state, 'gold') ?? Infinity) * HOUR_MS;
  let balance = stockBalance(state, 'gold');
  let rate = netRates(state).gold;
  let at = now;
  const runsOutAt = () => (rate < 0 ? at + Math.max(0, Math.floor(balance / -rate)) : Infinity);
  for (const entry of coming) {
    if (runsOutAt() <= entry.atMs) {
      break;
    }
    balance = Math.min(Math.max(balance, cap), balance + rate * (entry.atMs - at));
    rate -= wage;
    at = entry.atMs;
  }
  const out = runsOutAt();
  return {
    perHour,
    coveredForSeconds: out === Infinity ? null : realSecondsFloor(out - now, timeScale),
  };
}

/**
 * Os heróis prometidos, na ordem em que chegam: a promessa de uma carta não é segredo. Quem tem
 * o prazo vencido espera lugar na lista, que está no teto, e a frase diz o que abre o lugar. O
 * que o conteúdo já não tem não aparece: sai da lista sem chegar.
 */
function arrivingView(state: GameState, timeScale: number): ArrivingHeroView[] {
  const now = state.lastProcessedAt;
  const views: ArrivingHeroView[] = [];
  for (const entry of state.guild.arriving) {
    const named = namedHeroOf(entry.namedHeroId);
    if (named === null) {
      continue;
    }
    const waiting = entry.atMs <= now;
    views.push({
      name: named.name,
      classLabel: classLabel(named),
      traits: named.traits.map((trait) => ({
        label: traitLabel(trait, named.gender),
        text: heroTraits[trait].text,
      })),
      arrivesInSeconds: waiting ? 0 : realSecondsCeil(entry.atMs - now, timeScale),
      blockedReason:
        waiting && !rosterHasRoom(state)
          ? `O feudo já abriga ${plural(state.guild.heroes.length, 'herói', 'heróis')}, e não cabe mais nenhum: ${named.name} espera à porta até um lugar abrir.`
          : null,
    });
  }
  return views;
}

/**
 * A frase do alto da aba Guilda, pela equipe: sem herói, como o primeiro chega (ou que há um
 * prometido a caminho); com herói, que ainda não há para onde mandá-lo. Só escolhe entre as
 * frases do conteúdo: não promete data nem conta nada.
 */
function guildText(state: GameState, arriving: ArrivingHeroView[]): string {
  if (state.guild.heroes.length > 0) {
    return guildTexts.noDestination;
  }
  return arriving.length > 0 ? guildTexts.awaited : guildTexts.noHeroes;
}

export function guildView(state: GameState, timeScale: number, outlook: CraftOutlook): GuildView {
  const arriving = arrivingView(state, timeScale);
  return {
    text: guildText(state, arriving),
    dismissText: guildTexts.dismiss,
    heroLimit: heroLimit(state),
    heroes: state.guild.heroes.map((hero) => heroView(hero, timeScale)),
    arriving,
    wage: {
      perHour: (wageRate(state) * timeScale) / MILLI,
      coveredForSeconds: coveredForSeconds(state, timeScale, outlook),
      afterArrivals: afterArrivals(state, timeScale, outlook),
      arrears: arrearsView(state, timeScale),
    },
  };
}
