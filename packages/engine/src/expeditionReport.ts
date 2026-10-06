import {
  type ExpeditionTrial,
  expeditionPostures,
  expeditionTexts,
  heroTraits,
  ITEM_SLOT_IDS,
  type PostureId,
} from '@lotg/content';

import { fillText } from './format';
import { heroPowerRatio, itemDefOf, powerWeights } from './heroes';
import type { ExpeditionLesson, GameState, Hero } from './types';

/**
 * O que o relatório de uma expedição diz de um nó além do desfecho (GDD §9.4; roadmap da v0.3,
 * V3D-T3.5): **quem se destacou** e **o que o desfecho ruim ensina**. As duas escolhas são
 * contas sobre a equipe como ela chegou ao nó, feitas na resolução dele e guardadas no registro
 * do percurso: **nada aqui sorteia**, e o relatório lido depois diz o mesmo que a Crônica disse
 * na hora, mesmo que o herói tenha subido de nível ou partido.
 */

/** `hero-12` → 12: a ordem de chegada ao feudo, que desempata. */
const heroNumber = (hero: Hero): number => Number(hero.id.slice(hero.id.lastIndexOf('-') + 1));

/**
 * Quem se destacou em um nó com prova: o herói de **maior poder contra o nó** (os atributos que
 * o nó pesa, com os fatores dele: nível, Descontente, o traço da Postura e os itens). No empate,
 * o de menor identificador. `null` para uma equipe vazia.
 */
export function standoutOf(
  team: readonly Hero[],
  trial: ExpeditionTrial,
  posture: PostureId,
): Hero | null {
  const weights = powerWeights(trial.weights);
  let best: Hero | null = null;
  let bestPower = { num: 0, den: 1 };
  for (const hero of team) {
    const power = heroPowerRatio(hero, weights, posture);
    const ahead = power.num * bestPower.den - bestPower.num * power.den;
    if (best === null || ahead > 0 || (ahead === 0 && heroNumber(hero) < heroNumber(best))) {
      best = hero;
      bestPower = power;
    }
  }
  return best;
}

/**
 * O que um Revés ou um Desastre ensina, **o primeiro que valer**, nesta ordem:
 *
 * 1. `class`: o nó favorece uma classe (`trial.helps`), a equipe não a tinha e o nó tem a frase
 *    para isso (`trial.lesson`; o nó a que só se chega com a classe não a tem, e a equipe que a
 *    perdeu no caminho recebe uma das lições seguintes);
 * 2. `posture`: alguém da equipe rende mais em outra Postura (o Corajoso fora da Ousada, o
 *    Prudente fora da Cautelosa); o primeiro, na ordem da equipe;
 * 3. `item`: alguém partiu com um espaço vago havendo no arsenal um item para ele; o primeiro,
 *    na ordem da equipe;
 * 4. `strength`: nada disso; faltou força, e ainda cabia mais um herói na equipe (`teamMax` é o
 *    tamanho máximo do destino);
 * 5. `level`: faltou força, e a equipe já ia completa: "mais gente" não é conselho que se siga.
 *
 * Só usa o que o jogador pode saber: as classes e os traços da equipe, a Postura que ele
 * escolheu, o equipamento e o arsenal. Não diz a sorte nem quanto faltou.
 */
export function lessonOf(
  state: GameState,
  team: readonly Hero[],
  trial: ExpeditionTrial,
  posture: PostureId,
  teamMax: number,
): ExpeditionLesson {
  if (trial.lesson !== undefined && !team.some((hero) => hero.classId === trial.helps)) {
    return { kind: 'class', heroName: null, posture: null };
  }
  for (const hero of team) {
    for (const trait of hero.traits) {
      const boost = heroTraits[trait].effects.expeditionPower;
      if (boost !== undefined && boost.posture !== posture) {
        return { kind: 'posture', heroName: hero.name, posture: boost.posture };
      }
    }
  }
  const spare = new Set(state.guild.inventory.map((item) => itemDefOf(item)?.slot));
  for (const hero of team) {
    if (ITEM_SLOT_IDS.some((slot) => hero.equipment[slot] === null && spare.has(slot))) {
      return { kind: 'item', heroName: hero.name, posture: null };
    }
  }
  return { kind: team.length < teamMax ? 'strength' : 'level', heroName: null, posture: null };
}

/** A lição em uma frase: a do nó quando faltou a classe, e a geral nos outros casos. */
export function lessonText(lesson: ExpeditionLesson, trial: ExpeditionTrial): string {
  if (lesson.kind === 'class' && trial.lesson !== undefined) {
    return trial.lesson;
  }
  if (lesson.kind === 'posture' && lesson.posture !== null) {
    return fillText(expeditionTexts.lessonPosture, {
      heroi: lesson.heroName ?? '',
      postura: expeditionPostures[lesson.posture].label,
    });
  }
  if (lesson.kind === 'item') {
    return fillText(expeditionTexts.lessonItem, { heroi: lesson.heroName ?? '' });
  }
  // A lição de classe de um nó que perdeu a frase (o conteúdo mudou) cai na da força.
  return lesson.kind === 'level'
    ? expeditionTexts.lessonStrengthFull
    : expeditionTexts.lessonStrength;
}

/**
 * O modelo da frase de um nó com prova, pronto para a Crônica e para o relatório: a frase do
 * desfecho e, quando há lição, a lição depois dela. A lição já vem preenchida; da frase do
 * desfecho ficam as lacunas (`{dia}`, `{daEstacao}`, `{feudo}`, `{heroi}`), que `narrate` preenche.
 */
export function trialTemplate(
  trial: ExpeditionTrial,
  outcome: keyof ExpeditionTrial['outcomes'],
  lesson: ExpeditionLesson | null,
): string {
  const sentence = trial.outcomes[outcome];
  return lesson === null ? sentence : `${sentence} ${lessonText(lesson, trial)}`;
}
