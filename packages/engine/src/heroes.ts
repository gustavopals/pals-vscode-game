import { balance, HERO_ATTRIBUTE_IDS, heroClasses, heroTraits, type Ratio } from '@lotg/content';

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
 * O herói está no feudo. Só quem está pode partir por soldo em atraso e ser dispensado: quem
 * está fora (em expedição ou em escolta, da Fase D em diante) só parte depois de voltar.
 */
export function isAtHome(hero: Hero): boolean {
  return hero.status === 'idle';
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
 * Quantos heróis o feudo pode contratar (ADR 0017, decisão 5): `limitBase` sem Taverna; cada
 * nível dela soma um, quando ela existir (V3C-T2, que passa a receber o estado aqui). O limite barra a contratação; a recompensa
 * de uma carta ou de uma expedição não é barrada por ele, só pelo teto da lista.
 */
export function heroLimit(): number {
  return rules.limitBase;
}

/**
 * Um fator do poder de um herói: a fração que entra na conta e o nome com que ele aparece na
 * explicação do número ("× 1,08 (Nv2)").
 */
export type HeroFactor = { id: 'level' | 'discontent'; ratio: Ratio; label: string };

/**
 * Os fatores que multiplicam os atributos de um herói agora, na ordem em que a explicação os
 * mostra: o nível (`+levelBonus` por nível acima do primeiro, **sem compor**) e, com o soldo em
 * atraso, o Descontente. É **a** lista: `heroPower` multiplica todos e a visão escreve um termo
 * para cada um que mexe. Classe, traço e item entram aqui com as tarefas deles.
 */
export function heroFactors(hero: Hero): HeroFactor[] {
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
  return factors;
}

/**
 * O poder-base de uma classe, em fração de milésimos: a soma dos atributos que o conteúdo pesa
 * (`balance.heroes.power`: ataque + defesa + vida ÷ 10), cada um com o peso dele.
 */
function basePower(hero: Hero): Ratio {
  const { attributes } = heroClasses[hero.classId];
  let num = 0;
  let den = 1;
  for (const attribute of HERO_ATTRIBUTE_IDS) {
    const weight = rules.power[attribute];
    if (weight === undefined) {
      continue;
    }
    num = num * weight.den + attributes[attribute] * MILLI * weight.num * den;
    den *= weight.den;
  }
  return { num, den };
}

/**
 * O poder de um herói, em milésimos (ADR 0017, decisão 7): o poder-base da classe vezes os
 * fatores de `heroFactors`, em frações, com **um** arredondamento para baixo no fim. Um
 * Guerreiro de nível 1 vale 42.000; no nível 2, 45.360; Descontente, 4/5 disso.
 */
export function heroPower(hero: Hero): number {
  let { num, den } = basePower(hero);
  for (const { ratio } of heroFactors(hero)) {
    num *= ratio.num;
    den *= ratio.den;
  }
  return Math.floor(num / den);
}
