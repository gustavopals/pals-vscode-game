import {
  balance,
  heroAttributes,
  heroClasses,
  heroStatuses,
  heroTraits,
  type Ratio,
} from '@lotg/content';

import { buildingWithArticle } from './construction';
import type { CraftOutlook } from './craftProjection';
import { producerOf } from './economy';
import { decimal, durationText, plural } from './format';
import { heroFactors, heroLimit, heroPower, isLoyal, paidHeroes, wageRate } from './heroes';
import type { GameState, GuildView, Hero, HeroView, WageArrearsView } from './types';
import { MILLI, realSecondsCeil, SECOND_MS } from './units';
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
    classLabel: heroClasses[hero.classId].label,
    level: hero.level,
    xp: hero.xp,
    xpToNext: rules.xpToNext[hero.level - 1] ?? null,
    traits: hero.traits.map((trait) => ({
      label: heroTraits[trait].label,
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
    sentences.push(
      heroes.length === 1
        ? 'Ele é Leal: não fica descontente nem parte.'
        : 'São todos Leais: não ficam descontentes nem partem.',
    );
  } else {
    sentences.push(
      `Com ${realText(arrears.discontentAfterRealMs)} de atraso, quem não é Leal fica descontente e perde ${cut}% dos atributos; com ${realText(arrears.leaveAfterRealMs)}, parte um herói a cada ${realText(arrears.leaveEveryRealMs)}, o que chegou por último. As duas coisas acontecem na virada do dia.`,
    );
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

export function guildView(state: GameState, timeScale: number, outlook: CraftOutlook): GuildView {
  return {
    heroLimit: heroLimit(),
    heroes: state.guild.heroes.map((hero) => heroView(hero, timeScale)),
    wage: {
      perHour: (wageRate(state) * timeScale) / MILLI,
      coveredForSeconds: coveredForSeconds(state, timeScale, outlook),
      arrears: arrearsView(state, timeScale),
    },
  };
}
