import {
  balance,
  HERO_ATTRIBUTE_IDS,
  type HeroAttributeId,
  heroClasses,
  type HeroTraitId,
  heroTraits,
  type NamedHeroDef,
  namedHeroes,
  type PostureId,
  type Ratio,
} from '@lotg/content';

import type { GameState, Hero } from './types';
import { MILLI } from './units';

/**
 * Derivações puras sobre os heróis (GDD §9.1; ADR 0017, decisões 3, 5 e 7): quem é Leal, quem
 * está no feudo, quem recebe soldo, o limite de contratação e o poder. Nada aqui é gravado, e
 * nada aqui cria herói, dá identificador ou sorteia: a visão e a linha do tempo leem este módulo.
 */

const { heroes: rules } = balance;

/** O traço Leal: nunca fica Descontente nem parte por soldo em atraso. */
export function isLoyal(hero: Hero): boolean {
  return hero.traits.some((trait) => heroTraits[trait].effects.loyalInArrears === true);
}

/**
 * O herói está no feudo. Só quem está pode partir por soldo em atraso, ser dispensado e sair em
 * expedição: quem está fora (em expedição; em escolta, da Fase E em diante) só parte depois de
 * voltar.
 */
export function isAtHome(hero: Hero): boolean {
  return hero.status === 'idle';
}

/** "Guerreira", "Arqueiro": a classe como a ficha a mostra, concordando com o herói. */
export function classLabel(hero: Pick<Hero, 'classId' | 'gender'>): string {
  const def = heroClasses[hero.classId];
  return hero.gender === 'f' ? def.labelFeminine : def.label;
}

/** "Corajosa", "Leal": o traço como a ficha o mostra, concordando com o herói. */
export function traitLabel(trait: HeroTraitId, gender: Hero['gender']): string {
  const def = heroTraits[trait];
  return gender === 'f' ? def.labelFeminine : def.label;
}

/** O herói com nome do conteúdo; `null` para um identificador que o conteúdo não tem (ou já não tem). */
export function namedHeroOf(namedHeroId: string): NamedHeroDef | null {
  return Object.hasOwn(namedHeroes, namedHeroId)
    ? namedHeroes[namedHeroId as keyof typeof namedHeroes]
    : null;
}

/**
 * Cabe mais um herói na lista: o teto é `balance.heroes.rosterCap`, o único número que faz uma
 * recompensa esperar. O limite de contratação (`heroLimit`) é outro, menor, e só barra a Taverna.
 */
export function rosterHasRoom(state: GameState): boolean {
  return state.guild.heroes.length < rules.rosterCap;
}

/**
 * Instante, em ms de jogo, em que o próximo herói prometido chega; `null` sem nenhum a caminho.
 * Quem já tem o instante vencido espera lugar na lista e não entra aqui: o lugar abre em uma
 * virada de dia ou por uma ordem, que já são instantes do motor.
 */
export function nextHeroArrivalAt(state: GameState): number | null {
  const next = state.guild.arriving.find((entry) => entry.atMs > state.lastProcessedAt);
  return next === undefined ? null : next.atMs;
}

/**
 * Quantos heróis recebem soldo: todos os que servem ao feudo, estejam nele ou fora. O único
 * que não recebe é o capturado (ADR 0017, decisão 3), e a captura é da Fase D.
 */
export function paidHeroes(state: GameState): number {
  return state.guild.heroes.length;
}

/** O soldo de toda a equipe, em milésimos de ouro por hora de jogo. */
export function wageRate(state: GameState): number {
  return paidHeroes(state) * rules.wagePerHour * MILLI;
}

/**
 * Quantos heróis o feudo pode contratar (ADR 0017, decisão 5): `limitBase` sem Taverna, e cada
 * nível dela soma `heroLimitPerLevel` (1 sem Taverna, 6 no nível 5). Derivado do nível, nunca
 * gravado: o lugar abre no instante em que a obra da Taverna termina. O limite barra a
 * contratação; a recompensa de uma carta ou de uma expedição não é barrada por ele, só pelo
 * teto da lista.
 */
export function heroLimit(state: GameState): number {
  return rules.limitBase + state.settlement.buildings.tavern * balance.tavern.heroLimitPerLevel;
}

/**
 * A moral que um herói soma ao feudo pelos traços dele (o Devoto; ADR 0017, "Os oito traços"):
 * zero para quem não tem traço assim. Só conta com o herói no feudo; quem decide é a conta da
 * moral (`moraleTermsAt`).
 */
export function traitMorale(hero: Hero): number {
  return hero.traits.reduce((sum, trait) => sum + (heroTraits[trait].effects.morale ?? 0), 0);
}

/**
 * Um fator do poder de um herói: a fração que entra na conta e o nome com que ele aparece na
 * explicação do número ("× 1,08 (Nv2)").
 */
export type HeroFactor = { id: 'level' | 'discontent' | 'trait'; ratio: Ratio; label: string };

/**
 * Os fatores que multiplicam os atributos de um herói agora, na ordem em que a explicação os
 * mostra: o nível (`+levelBonus` por nível acima do primeiro, **sem compor**), com o soldo em
 * atraso o Descontente e, **em uma expedição enviada com a Postura dada**, o traço que rende
 * mais nela (o Corajoso na Ousada, o Prudente na Cautelosa; ADR 0017, "Os oito traços"). É **a**
 * lista: `heroPower` e `teamPower` multiplicam todos e a visão escreve um termo para cada um
 * que mexe. Sem Postura (a ficha do herói no feudo) nenhum traço entra. Item entra aqui com a
 * tarefa dele.
 */
export function heroFactors(hero: Hero, posture: PostureId | null = null): HeroFactor[] {
  const { levelBonus, arrears } = rules;
  const factors: HeroFactor[] = [
    {
      id: 'level',
      ratio: { num: levelBonus.den + levelBonus.num * (hero.level - 1), den: levelBonus.den },
      label: `Nv${hero.level}`,
    },
  ];
  if (hero.discontent) {
    factors.push({ id: 'discontent', ratio: arrears.discontentFactor, label: 'descontente' });
  }
  if (posture !== null) {
    for (const trait of hero.traits) {
      const boost = heroTraits[trait].effects.expeditionPower;
      if (boost !== undefined && boost.posture === posture) {
        factors.push({
          id: 'trait',
          ratio: boost.ratio,
          label: traitLabel(trait, hero.gender).toLowerCase(),
        });
      }
    }
  }
  return factors;
}

/** Os pesos de atributo de uma conta de poder: os do conteúdo, e por cima os que um nó troca. */
export type PowerWeights = Partial<Record<HeroAttributeId, Ratio>>;

/**
 * Os pesos que valem em um nó: os de `balance.heroes.power` (ataque, defesa e vida ÷ 10) com os
 * do nó por cima. Um peso do nó **troca** o do atributo, ou o acrescenta quando o atributo não
 * pesava ("perícia pesa ×1,5" é `skill: 3/2` somado aos padrões).
 */
export function powerWeights(nodeWeights: PowerWeights = {}): PowerWeights {
  return { ...rules.power, ...nodeWeights };
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x === 0 ? 1 : x;
}

/** Uma fração na forma mais simples: é o que mantém numerador e denominador pequenos na soma. */
function reduced(num: number, den: number): Ratio {
  const divisor = gcd(num, den);
  const ratio = { num: num / divisor, den: den / divisor };
  if (!Number.isSafeInteger(ratio.num) || !Number.isSafeInteger(ratio.den)) {
    // Atributos, pesos e fatores do conteúdo estão longe disto: é defeito de conteúdo.
    throw new Error('A conta do poder passou do maior inteiro seguro.');
  }
  return ratio;
}

/**
 * O poder de um herói como fração exata, em milésimos: a soma dos atributos que os pesos
 * contam, cada um vezes o peso dele, vezes os fatores de `heroFactors`. Sem arredondar.
 */
export function heroPowerRatio(
  hero: Hero,
  weights: PowerWeights = rules.power,
  posture: PostureId | null = null,
): Ratio {
  const { attributes } = heroClasses[hero.classId];
  let sum: Ratio = { num: 0, den: 1 };
  for (const attribute of HERO_ATTRIBUTE_IDS) {
    const weight = weights[attribute];
    if (weight === undefined) {
      continue;
    }
    sum = reduced(
      sum.num * weight.den + attributes[attribute] * MILLI * weight.num * sum.den,
      sum.den * weight.den,
    );
  }
  for (const { ratio } of heroFactors(hero, posture)) {
    sum = reduced(sum.num * ratio.num, sum.den * ratio.den);
  }
  return sum;
}

/**
 * O poder de um herói, em milésimos (ADR 0017, decisão 7): o poder-base da classe vezes os
 * fatores de `heroFactors`, em frações, com **um** arredondamento para baixo no fim. Um
 * Guerreiro de nível 1 vale 42.000; no nível 2, 45.360; Descontente, 4/5 disso. É o poder
 * **geral**, o da ficha: com os pesos do conteúdo e sem Postura.
 */
export function heroPower(hero: Hero): number {
  const { num, den } = heroPowerRatio(hero);
  return Math.floor(num / den);
}

/**
 * O poder de uma equipe contra um nó, em milésimos (ADR 0017, decisão 7; a conta do peso de
 * atributo é do plano de V3D-T1, pendência A-5): `Σ por herói Σ por atributo (atributo × peso)`,
 * com os pesos do nó por cima dos padrões, vezes os fatores de cada herói (nível, Descontente e
 * o traço da Postura), tudo em frações, com **um** arredondamento para baixo no fim da soma.
 */
export function teamPower(
  heroes: readonly Hero[],
  nodeWeights: PowerWeights | undefined,
  posture: PostureId,
): number {
  const weights = powerWeights(nodeWeights);
  let sum: Ratio = { num: 0, den: 1 };
  for (const hero of heroes) {
    const power = heroPowerRatio(hero, weights, posture);
    sum = reduced(sum.num * power.den + power.num * sum.den, sum.den * power.den);
  }
  return Math.floor(sum.num / sum.den);
}
