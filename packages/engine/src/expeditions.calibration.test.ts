import {
  balance,
  type ExpeditionCrossroadsNode,
  type ExpeditionModelDef,
  expeditionModels,
  type ExpeditionOption,
  type ExpeditionOutcomeId,
  type ExpeditionStageNode,
  type ExpeditionVariant,
  HERO_CLASS_IDS,
  type HeroClassId,
  heroClasses,
  type HeroTraitId,
  items,
  POSTURE_IDS,
  type PostureId,
} from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { optionLock, outcomeOf, postureChoice } from './expeditions';
import { heroPower, teamPower } from './heroes';
import type { Hero } from './types';

/**
 * A calibragem do catálogo (roadmap da v0.3, V3D-T3.4 e T3.6): para cada modelo, a distribuição
 * **exata** dos desfechos de equipes de referência, com a sorte enumerada de ponta a ponta (de
 * `luck.min` a `luck.max`, um valor por nó, independentes), sem amostrar. O teste confere que o
 * rótulo de risco de cada modelo diz a verdade **nas três Posturas**, que os rótulos ordenam o
 * risco, que nenhuma opção de encruzilhada é a melhor para toda equipe e que a Patrulha não
 * domina por hora de herói (revisão da Fase D, B10 a B12).
 *
 * As tabelas ficam em `__golden__/expedition-calibration.md`: são as de `docs/balance-v0.3.md`,
 * seção 8, e as das fichas de `docs/content-v0.3.md`. Mexer em uma dificuldade, em um peso ou em
 * uma recompensa muda o arquivo, e o diff mostra o que a mudança fez a cada equipe
 * (`UPDATE_GOLDEN=1` regrava).
 *
 * **O que a conta não vê:** a equipe é a que partiu, em todo nó (quem é capturado no meio do
 * caminho continuaria contando); os itens e os traços ficam de fora das equipes de referência.
 */

const { expeditions: rules } = balance;
const LUCKS = Array.from(
  { length: rules.luck.max - rules.luck.min + 1 },
  (_, index) => rules.luck.min + index,
);
const OUTCOMES: readonly ExpeditionOutcomeId[] = ['full', 'success', 'setback', 'disaster'];
/** As tabelas da calibragem, juntadas para o golden. */
const written: string[] = [];
const show = (text: string): void => {
  written.push(text);
};

const hero = (classId: HeroClassId, level: number, traits: HeroTraitId[] = []): Hero => ({
  id: 'hero-1',
  name: heroClasses[classId].label,
  gender: 'm',
  classId,
  level,
  xp: 0,
  traits,
  status: 'idle',
  injury: null,
  captivity: null,
  equipment: { weapon: null, armor: null, accessory: null },
  joinedAtMs: 0,
  freedAtMs: null,
  discontent: false,
});

/** A classe mais fraca na conta geral do poder: é com ela que a equipe "fraca" se completa. */
const WEAKEST = [...HERO_CLASS_IDS].sort(
  (a, b) => heroPower(hero(a, 1)) - heroPower(hero(b, 1)),
)[0] as HeroClassId;

type TeamKind = 'weak' | 'min' | 'ample';
const TEAM_LABELS: Record<TeamKind, string> = {
  weak: 'Fraca',
  min: 'Mínima',
  ample: 'Com folga',
};

/**
 * As equipes de referência de um modelo:
 *
 * - **mínima**: o menor número de heróis, no menor nível que o modelo aceita, com as classes que
 *   ele exige e o resto na ordem do conteúdo (Guerreiro, Arqueiro, Mago, Clérigo). É a do ADR
 *   0017: "um Guerreiro de nível 1 sozinho", "dois heróis de nível 2";
 * - **fraca**: a mínima, com a classe mais fraca na conta geral (o Clérigo) no lugar das que o
 *   modelo não exige;
 * - **com folga**: o maior número de heróis, dois níveis acima do mínimo, na mesma ordem.
 */
function referenceTeam(model: ExpeditionModelDef, kind: TeamKind): Hero[] {
  const { teamMin, teamMax, minHeroLevel, classes } = model.requires;
  const size = kind === 'ample' ? teamMax : teamMin;
  const level = kind === 'ample' ? minHeroLevel + 2 : minHeroLevel;
  const fill = HERO_CLASS_IDS.filter((id) => !classes.includes(id));
  const picked: HeroClassId[] = [...classes];
  for (let index = 0; picked.length < size; index += 1) {
    picked.push(kind === 'weak' ? WEAKEST : (fill[index % fill.length] as HeroClassId));
  }
  return picked.slice(0, size).map((classId) => hero(classId, level));
}

const teamText = (team: readonly Hero[]): string =>
  `${team.map((entry) => heroClasses[entry.classId].label).join(' + ')} Nv${team[0]?.level ?? 1}`;

type Distribution = Record<ExpeditionOutcomeId, number>;

/** A distribuição do desfecho de um nó para uma equipe: quantas sortes dão cada um, em fração. */
function trialOdds(
  team: readonly Hero[],
  node: ExpeditionStageNode,
  posture: PostureId,
): Distribution {
  const odds: Distribution = { full: 0, success: 0, setback: 0, disaster: 0 };
  if (node.trial === undefined) {
    return { ...odds, full: 1 };
  }
  const power = teamPower(team, node.trial.weights, posture);
  for (const luck of LUCKS) {
    odds[outcomeOf(power, luck, node.trial.difficulty)] += 1 / LUCKS.length;
  }
  return odds;
}

/** Os nós com prova de um caminho, do nó dado até o retorno, com a Postura decidindo as encruzilhadas. */
function stagesFrom(
  variant: ExpeditionVariant,
  start: string,
  team: readonly Hero[],
  posture: PostureId,
): ExpeditionStageNode[] {
  const stages: ExpeditionStageNode[] = [];
  let key = start;
  for (let steps = 0; steps < 20; steps += 1) {
    const node = variant.nodes[key];
    if (node === undefined || node.kind === 'return') {
      return stages;
    }
    if (node.kind === 'crossroads') {
      const choice = postureChoice(team, node, posture);
      if (choice === null) {
        return stages;
      }
      key = choice.option.next;
      continue;
    }
    stages.push(node);
    key = node.next;
  }
  throw new Error('Grafo sem retorno.');
}

type PathOdds = {
  /** Nenhuma prova abaixo do Sucesso. */
  pass: number;
  /** O pior desfecho do caminho foi o Revés. */
  setback: number;
  /** Houve ao menos um Desastre. */
  disaster: number;
  /** Houve ao menos um Desastre em um nó que captura. */
  capture: number;
};

/** O pior desfecho de um caminho, com os nós independentes e a equipe inteira em todos. */
function pathOdds(
  team: readonly Hero[],
  stages: readonly ExpeditionStageNode[],
  posture: PostureId,
): PathOdds {
  let pass = 1;
  let noDisaster = 1;
  let noCapture = 1;
  for (const node of stages) {
    const odds = trialOdds(team, node, posture);
    pass *= odds.full + odds.success;
    noDisaster *= 1 - odds.disaster;
    if (node.trial?.onDisaster === 'capture') {
      noCapture *= 1 - odds.disaster;
    }
  }
  return {
    pass,
    setback: noDisaster - pass,
    disaster: 1 - noDisaster,
    capture: 1 - noCapture,
  };
}

/** A média das três variantes de um modelo, para uma equipe e uma Postura. */
function modelOdds(model: ExpeditionModelDef, kind: TeamKind, posture: PostureId): PathOdds {
  const team = referenceTeam(model, kind);
  const sum: PathOdds = { pass: 0, setback: 0, disaster: 0, capture: 0 };
  for (const variant of model.variants) {
    const odds = pathOdds(team, stagesFrom(variant, variant.start, team, posture), posture);
    for (const key of Object.keys(sum) as Array<keyof PathOdds>) {
      sum[key] += odds[key] / model.variants.length;
    }
  }
  return sum;
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

type Yield = { resources: number; xp: number };

/**
 * O que um caminho rende em média, com a sorte enumerada: os recursos (todos somados, na parte
 * que cada desfecho deixa trazer) e a experiência de cada herói.
 */
function pathYield(
  team: readonly Hero[],
  stages: readonly ExpeditionStageNode[],
  posture: PostureId,
): Yield {
  const total: Yield = { resources: 0, xp: 0 };
  for (const node of stages) {
    const odds = trialOdds(team, node, posture);
    const share = (table: typeof rules.lootShare) =>
      OUTCOMES.reduce((sum, id) => sum + (odds[id] * table[id].num) / table[id].den, 0);
    for (const range of Object.values(node.rewards?.resources ?? {})) {
      total.resources += (share(rules.lootShare) * (range.min + range.max)) / 2;
    }
    if (node.trial !== undefined) {
      total.xp += share(rules.xpShare) * node.trial.xp;
    }
  }
  return total;
}

/**
 * O rendimento de um modelo **por hora de jogo de cada herói** que vai, na média das variantes:
 * é o que diz se vale mais mandar um herói a este destino ou a outro no mesmo tempo. A duração
 * é a anunciada (sem a espera das encruzilhadas).
 */
function yieldPerHeroHour(model: ExpeditionModelDef, kind: TeamKind, posture: PostureId): Yield {
  const team = referenceTeam(model, kind);
  const hours = model.durationMs / 3_600_000;
  const sum: Yield = { resources: 0, xp: 0 };
  for (const variant of model.variants) {
    const got = pathYield(team, stagesFrom(variant, variant.start, team, posture), posture);
    sum.resources += got.resources / model.variants.length;
    sum.xp += got.xp / model.variants.length;
  }
  return { resources: sum.resources / (team.length * hours), xp: sum.xp / hours };
}

/**
 * A régua do teste para comparar caminhos, **que não é regra do jogo**: o que um caminho rende
 * em média, em ouro, com o que a jornada veio buscar valendo muito (limpar o tile, soltar o
 * cativo, revelar um destino) e o dano descontado (o Revés fere de leve, o Desastre fere
 * gravemente ou captura). Serve só para dizer para que equipe cada opção é a escolha razoável.
 */
const WORTH = { clears: 150, rescues: 250, reveals: 60, light: 40, severe: 150, capture: 400 };

function expectedWorth(
  team: readonly Hero[],
  stages: readonly ExpeditionStageNode[],
  posture: PostureId,
): number {
  let worth = 0;
  for (const node of stages) {
    const odds = trialOdds(team, node, posture);
    const share = OUTCOMES.reduce(
      (sum, id) => sum + (odds[id] * rules.lootShare[id].num) / rules.lootShare[id].den,
      0,
    );
    const succeeded = odds.full + odds.success;
    const { rewards, trial } = node;
    for (const range of Object.values(rewards?.resources ?? {})) {
      worth += (share * (range.min + range.max)) / 2;
    }
    if (rewards?.item !== undefined) {
      const { chance, from } = rewards.item;
      const mean = from.reduce((sum, id) => sum + items[id].value, 0) / from.length;
      worth += (succeeded * chance.num * mean) / chance.den;
    }
    worth += succeeded * (rewards?.clearsTile === undefined ? 0 : WORTH.clears);
    worth += succeeded * (rewards?.rescues === true ? WORTH.rescues : 0);
    worth += succeeded * (rewards?.reveals === undefined ? 0 : WORTH.reveals);
    if (trial !== undefined) {
      worth -= odds.setback * WORTH.light;
      worth -= odds.disaster * (trial.onDisaster === 'capture' ? WORTH.capture : WORTH.severe);
    }
  }
  return worth;
}

/**
 * As equipes com que cada encruzilhada é posta à prova: de todo tamanho que o modelo aceita, em
 * quatro níveis, com as composições abaixo (as que têm as classes que o modelo exige) e, quando
 * uma opção pede um traço, as mesmas com o traço no primeiro herói.
 */
const COMPOSITIONS: readonly HeroClassId[][] = [
  ['warrior'],
  ['archer'],
  ['mage'],
  ['cleric'],
  ['warrior', 'archer'],
  ['warrior', 'warrior'],
  ['archer', 'archer'],
  ['warrior', 'cleric'],
  ['warrior', 'mage'],
  ['archer', 'mage'],
  ['archer', 'cleric'],
  ['mage', 'cleric'],
  ['cleric', 'cleric'],
  ['warrior', 'archer', 'mage'],
  ['warrior', 'archer', 'cleric'],
  ['warrior', 'mage', 'cleric'],
  ['archer', 'mage', 'cleric'],
  ['mage', 'cleric', 'cleric'],
  ['warrior', 'warrior', 'mage'],
];

function panelOf(model: ExpeditionModelDef, node: ExpeditionCrossroadsNode): Hero[][] {
  const { teamMin, teamMax, minHeroLevel, classes } = model.requires;
  const traits = node.options.flatMap((option) =>
    option.requires !== undefined && 'trait' in option.requires ? [option.requires.trait] : [],
  );
  const teams: Hero[][] = [];
  for (const composition of COMPOSITIONS) {
    if (
      composition.length < teamMin ||
      composition.length > teamMax ||
      !classes.every((needed) => composition.includes(needed))
    ) {
      continue;
    }
    for (const level of [0, 1, 2, 4].map((above) => minHeroLevel + above)) {
      teams.push(composition.map((classId) => hero(classId, level)));
      for (const trait of traits) {
        teams.push(
          composition.map((classId, index) => hero(classId, level, index === 0 ? [trait] : [])),
        );
      }
    }
  }
  return teams;
}

type OptionVerdict = {
  option: ExpeditionOption;
  /** A equipe do painel para a qual esta opção rende mais do que as outras, com a maior vantagem. */
  goodFor: { team: Hero[]; pass: number } | null;
  /** A equipe que pode tomá-la e para a qual ela é a pior das que pode tomar, ou a que nem pode. */
  badFor: { team: Hero[]; pass: number | null } | null;
  bestCount: number;
  ableCount: number;
};

/** Para cada opção de uma encruzilhada: para quantas equipes do painel é a melhor, e exemplos. */
function verdictsOf(
  model: ExpeditionModelDef,
  variant: ExpeditionVariant,
  node: ExpeditionCrossroadsNode,
): OptionVerdict[] {
  const verdicts: OptionVerdict[] = node.options.map((option) => ({
    option,
    goodFor: null,
    badFor: null,
    bestCount: 0,
    ableCount: 0,
  }));
  let bestMargin: number[] = node.options.map(() => -Infinity);
  let worstMargin: number[] = node.options.map(() => Infinity);
  for (const team of panelOf(model, node)) {
    const scored = node.options.map((option) => {
      if (optionLock(team, option) !== null) {
        return null;
      }
      const stages = stagesFrom(variant, option.next, team, 'balanced');
      return {
        worth: expectedWorth(team, stages, 'balanced'),
        pass: pathOdds(team, stages, 'balanced').pass,
      };
    });
    const top = Math.max(...scored.map((entry) => entry?.worth ?? -Infinity));
    scored.forEach((entry, index) => {
      const verdict = verdicts[index] as OptionVerdict;
      if (entry === null) {
        if (verdict.badFor === null) {
          verdict.badFor = { team, pass: null };
        }
        return;
      }
      verdict.ableCount += 1;
      const others = Math.max(
        ...scored.map((other, at) => (at === index ? -Infinity : (other?.worth ?? -Infinity))),
      );
      const margin = entry.worth - others;
      if (entry.worth === top) {
        verdict.bestCount += 1;
        if (margin > (bestMargin[index] as number)) {
          bestMargin = bestMargin.map((value, at) => (at === index ? margin : value));
          verdict.goodFor = { team, pass: entry.pass };
        }
      } else if (margin < (worstMargin[index] as number)) {
        worstMargin = worstMargin.map((value, at) => (at === index ? margin : value));
        verdict.badFor = { team, pass: entry.pass };
      }
    });
  }
  return verdicts;
}

const crossroadsOf = (variant: ExpeditionVariant): ExpeditionCrossroadsNode[] =>
  Object.values(variant.nodes).filter((node) => node.kind === 'crossroads');

describe('a calibragem do catálogo (roadmap da v0.3, V3D-T3.6)', () => {
  it('um Guerreiro de nível 1 sozinho passa a Patrulha em mais de 9 de cada 10, e nenhuma classe chega ao Desastre nela (ADR 0017)', () => {
    const patrol = expeditionModels.find((model) => model.id === 'patrol') as ExpeditionModelDef;
    const passOf = (classId: HeroClassId) => {
      const team = [hero(classId, 1)];
      return patrol.variants.map((variant) =>
        pathOdds(team, stagesFrom(variant, variant.start, team, 'balanced'), 'balanced'),
      );
    };
    const warrior = passOf('warrior');
    expect(warrior.reduce((sum, odds) => sum + odds.pass, 0) / 3).toBeGreaterThan(0.9);
    for (const classId of HERO_CLASS_IDS) {
      expect(
        passOf(classId).every((odds) => odds.disaster === 0),
        classId,
      ).toBe(true);
    }
    // Cada variante tem a classe dela: nenhuma classe é a melhor nas três.
    const best = patrol.variants.map((variant) => {
      const node = variant.nodes[variant.start];
      return node !== undefined && node.kind !== 'crossroads' && node.kind !== 'return'
        ? node.trial?.helps
        : undefined;
    });
    expect(new Set(best).size).toBe(3);
  });

  /**
   * **O que cada rótulo de risco promete** (revisão da Fase D, B11 e B12), medido nas três
   * Posturas para a equipe mínima (e, onde dito, para a fraca):
   *
   * - **Baixo**: a mínima passa em 9 de cada 10 em qualquer Postura, e nem ela nem a fraca chegam
   *   ao Desastre em Postura nenhuma.
   * - **Baixo a médio**: a mínima passa em 6 de cada 10 na Equilibrada e não chega ao Desastre na
   *   Cautelosa nem na Equilibrada; na Ousada o Desastre existe e não é frequente (até 15%).
   *   Ninguém é capturado.
   * - **Médio**: na Equilibrada a mínima passa em pelo menos um quarto das vezes e em não mais
   *   de dois terços (o Revés é comum) e quase nunca chega ao Desastre (até 10%); o Desastre é
   *   possível para quem vai fraco ou ousa; a Cautelosa não captura a mínima.
   * - **Alto**: na Equilibrada a mínima passa em menos de um quarto das vezes; **a captura
   *   acontece**: na Ousada para a mínima, e também na Equilibrada para quem vai mais fraco do
   *   que ela.
   *
   * E os rótulos ordenam o risco: na Equilibrada, a mínima passa mais em todo destino de um
   * rótulo do que em qualquer destino do rótulo seguinte.
   *
   * **Um limite da regra dos desfechos, que a régua respeita:** no mesmo nó, quem pode chegar ao
   * Desastre nunca chega ao Sucesso (o Desastre pede menos de 70% da dificuldade com a pior
   * sorte, e o Sucesso, 100% com a melhor: `0,7 ÷ 0,85 < 1 ÷ 1,15` não se cruzam). Por isso a
   * equipe mínima só é capturada onde ela não passa, e "captura na Equilibrada para a mínima"
   * exigiria um caminho da Equilibrada em que ela nunca passa.
   */
  const RISK_ORDER = ['Baixo', 'Baixo a médio', 'Médio', 'Alto'];

  it.each(expeditionModels.map((model) => [model.label, model] as const))(
    '%s: o rótulo de risco diz a verdade para a equipe mínima nas três Posturas, e a equipe com folga passa',
    (_label, model) => {
      const of = (kind: TeamKind, posture: PostureId) => modelOdds(model, kind, posture);
      const min = of('min', 'balanced');
      const ample = of('ample', 'balanced');
      const anyPosture = (kind: TeamKind, key: keyof PathOdds) =>
        Math.max(...POSTURE_IDS.map((posture) => of(kind, posture)[key]));
      // Nenhum modelo em que a mínima nunca passa, nem em que nunca falha.
      expect(min.pass).toBeGreaterThan(0);
      expect(min.pass).toBeLessThan(1);
      expect(ample.pass).toBeGreaterThanOrEqual(0.75);
      expect(ample.pass).toBeGreaterThanOrEqual(min.pass);
      expect(RISK_ORDER).toContain(model.riskLabel);
      if (model.riskLabel === 'Baixo') {
        for (const posture of POSTURE_IDS) {
          expect(of('min', posture).pass, posture).toBeGreaterThanOrEqual(0.9);
        }
        expect(anyPosture('min', 'disaster')).toBe(0);
        expect(anyPosture('weak', 'disaster')).toBe(0);
      } else if (model.riskLabel === 'Baixo a médio') {
        expect(min.pass).toBeGreaterThanOrEqual(0.6);
        expect(min.pass).toBeLessThanOrEqual(0.95);
        expect(min.disaster).toBe(0);
        expect(of('min', 'cautious').disaster).toBe(0);
        // A Ousada arrisca, mas o Desastre não é frequente (B12).
        expect(of('min', 'bold').disaster).toBeGreaterThan(0);
        expect(of('min', 'bold').disaster).toBeLessThanOrEqual(0.15);
        expect(anyPosture('min', 'capture')).toBe(0);
        expect(anyPosture('weak', 'capture')).toBe(0);
      } else if (model.riskLabel === 'Médio') {
        expect(min.pass).toBeGreaterThanOrEqual(0.25);
        expect(min.pass).toBeLessThanOrEqual(2 / 3);
        expect(min.disaster).toBeLessThanOrEqual(0.1);
        expect(
          Math.max(anyPosture('min', 'disaster'), anyPosture('weak', 'disaster')),
        ).toBeGreaterThan(0);
        expect(of('min', 'cautious').capture).toBe(0);
        expect(ample.pass - min.pass).toBeGreaterThanOrEqual(0.2);
      } else {
        expect(min.pass).toBeLessThan(0.25);
        // A captura acontece: para a mínima na Ousada, e na Equilibrada para quem vai mais fraco.
        expect(of('min', 'bold').capture).toBeGreaterThan(0);
        expect(of('weak', 'balanced').capture).toBeGreaterThan(0);
        expect(ample.pass - min.pass).toBeGreaterThanOrEqual(0.2);
      }
    },
  );

  it('os rótulos ordenam o risco: na Equilibrada, a mínima passa mais em todo destino de um rótulo do que em qualquer destino do seguinte (B11)', () => {
    const passes = RISK_ORDER.map((label) =>
      expeditionModels
        .filter((model) => model.riskLabel === label)
        .map((model) => modelOdds(model, 'min', 'balanced').pass),
    );
    for (const [index, safer] of passes.entries()) {
      expect(safer.length, RISK_ORDER[index]).toBeGreaterThan(0);
      const riskier = passes[index + 1];
      if (riskier !== undefined) {
        expect(Math.min(...safer), RISK_ORDER[index]).toBeGreaterThan(Math.max(...riskier));
      }
    }
  });

  it('a Patrulha é a porta de entrada, não a mina de ouro: por hora de herói rende menos recurso e menos experiência do que qualquer outro destino (B10)', () => {
    const patrol = expeditionModels.find((model) => model.id === 'patrol') as ExpeditionModelDef;
    for (const kind of ['min', 'ample'] as const) {
      const base = yieldPerHeroHour(patrol, kind, 'balanced');
      for (const model of expeditionModels) {
        // O Resgate não vai atrás de saque: o que ele rende é quem volta.
        if (model.id === 'patrol' || model.access.kind === 'captive') {
          continue;
        }
        const other = yieldPerHeroHour(model, kind, 'balanced');
        expect(other.resources, `${model.id}, ${kind}: recursos`).toBeGreaterThan(base.resources);
        expect(other.xp, `${model.id}, ${kind}: experiência`).toBeGreaterThan(base.xp);
      }
    }
    // E continua sendo a única que revela as Ruínas, em toda variante.
    for (const variant of patrol.variants) {
      const node = variant.nodes[variant.start];
      expect(
        node !== undefined && node.kind !== 'crossroads' && node.kind !== 'return'
          ? node.rewards?.reveals
          : undefined,
      ).toBe('ruins');
    }
  });

  it('nas Ruínas, o guardião captura: a pendência A-6 (com o guardião em 90 ninguém era capturado)', () => {
    const ruins = expeditionModels.find((model) => model.id === 'ruins') as ExpeditionModelDef;
    const level = ruins.requires.minHeroLevel;
    const pairs = COMPOSITIONS.filter((composition) => composition.length === 2).map(
      (composition) => composition.map((classId) => hero(classId, level)),
    );
    const ample = referenceTeam(ruins, 'ample');
    for (const variant of ruins.variants) {
      const boss = Object.values(variant.nodes).find((node) => node.kind === 'boss');
      if (boss === undefined || boss.kind !== 'boss') {
        throw new Error('Variante das Ruínas sem guardião.');
      }
      expect(boss.trial?.onDisaster).toBe('capture');
      // Alguma dupla de nível 2 pode ficar lá (a que não tem a classe que o guardião pede);
      // três de nível 4, nunca.
      expect(pairs.some((pair) => trialOdds(pair, boss, 'balanced').disaster > 0)).toBe(true);
      expect(trialOdds(ample, boss, 'balanced').disaster).toBe(0);
    }
  });

  it('em toda encruzilhada, cada opção com risco é a melhor para alguma equipe e não é a melhor para outra: a da Equilibrada não domina (V3D-T3.4)', () => {
    for (const model of expeditionModels) {
      for (const [index, variant] of model.variants.entries()) {
        for (const node of crossroadsOf(variant)) {
          const size = panelOf(model, node).length;
          for (const verdict of verdictsOf(model, variant, node)) {
            const where = `${model.id}/${index}/${verdict.option.id}`;
            // Nenhuma opção é a melhor para toda equipe.
            expect(verdict.bestCount, where).toBeLessThan(size);
            expect(verdict.badFor, where).not.toBeNull();
            if (verdict.option.id === node.posture.cautious) {
              continue;
            }
            expect(verdict.bestCount, where).toBeGreaterThan(0);
            expect(verdict.goodFor, where).not.toBeNull();
          }
        }
      }
    }
  });

  it('em toda encruzilhada, o caminho da Cautelosa é a escolha de alguma equipe: aquela para a qual todo outro caminho dá Revés ou pior em metade das vezes', () => {
    // Antes da encruzilhada o jogador não sabe em que variante está: duas variantes com a mesma
    // encruzilhada (as duas primeiras da Floresta) contam juntas.
    for (const model of expeditionModels) {
      for (const [index, variant] of model.variants.entries()) {
        for (const node of crossroadsOf(variant)) {
          const siblings = model.variants.filter((other) =>
            crossroadsOf(other).some(
              (entry) => JSON.stringify(entry.options) === JSON.stringify(node.options),
            ),
          );
          const wary = panelOf(model, node).some((team) =>
            siblings.some((sibling) =>
              node.options
                .filter(
                  (option) =>
                    option.id !== node.posture.cautious && optionLock(team, option) === null,
                )
                .every(
                  (option) =>
                    pathOdds(team, stagesFrom(sibling, option.next, team, 'balanced'), 'balanced')
                      .pass <= 0.5,
                ),
            ),
          );
          expect(wary, `${model.id}/${index}`).toBe(true);
        }
      }
    }
  });
});

/** As tabelas, para os documentos e para o diff de quem mexer no catálogo. */
describe('as tabelas da calibragem (golden)', () => {
  it('a distribuição dos desfechos por modelo, equipe e Postura', () => {
    const lines = [
      '| Modelo | Risco | Equipe | Cautelosa: passa | Equilibrada: passa / Revés / Desastre | Ousada: passa / Revés / Desastre | Captura (Equilibrada / Ousada) |',
      '|---|---|---|---:|---|---|---|',
    ];
    for (const model of expeditionModels) {
      for (const kind of ['weak', 'min', 'ample'] as const) {
        const [cautious, balanced, bold] = POSTURE_IDS.map((posture) =>
          modelOdds(model, kind, posture),
        ) as [PathOdds, PathOdds, PathOdds];
        const triple = (odds: PathOdds) =>
          `${percent(odds.pass)} / ${percent(odds.setback)} / ${percent(odds.disaster)}`;
        lines.push(
          `| ${model.label} | ${model.riskLabel} | ${TEAM_LABELS[kind]}: ${teamText(referenceTeam(model, kind))} | ${percent(cautious.pass)} | ${triple(balanced)} | ${triple(bold)} | ${percent(balanced.capture)} / ${percent(bold.capture)} |`,
        );
      }
    }
    show(`\n${lines.join('\n')}\n`);
  });

  it('cada prova, nó a nó, para as três equipes de referência', () => {
    const lines = [
      '| Modelo | Var. | Nó | Dif. | Pesa | Favorece | Desastre | Fraca P/S/R/D | Mínima P/S/R/D | Com folga P/S/R/D |',
      '|---|---|---|---:|---|---|---|---|---|---|',
    ];
    for (const model of expeditionModels) {
      for (const [index, variant] of model.variants.entries()) {
        for (const node of Object.values(variant.nodes)) {
          if (node.kind === 'crossroads' || node.kind === 'return' || node.trial === undefined) {
            continue;
          }
          const cell = (kind: TeamKind) => {
            const odds = trialOdds(referenceTeam(model, kind), node, 'balanced');
            return OUTCOMES.map((id) => Math.round(odds[id] * LUCKS.length)).join('/');
          };
          lines.push(
            `| ${model.label} | ${'ABC'[index]} | ${node.title} | ${node.trial.difficulty} | ${weightsText(node)} | ${heroClasses[node.trial.helps].label} | ${node.trial.onDisaster === 'capture' ? 'captura' : 'fere'} | ${cell('weak')} | ${cell('min')} | ${cell('ample')} |`,
          );
        }
      }
    }
    show(`\nEm ${LUCKS.length} sortes:\n\n${lines.join('\n')}\n`);
  });

  it('cada opção de encruzilhada: para quem é a escolha razoável e para quem é ruim', () => {
    const lines = [
      '| Modelo | Var. | Opção | Postura | Requisito | Razoável para | Ruim para | Melhor para (equipes do painel) |',
      '|---|---|---|---|---|---|---|---:|',
    ];
    for (const model of expeditionModels) {
      for (const [index, variant] of model.variants.entries()) {
        for (const node of crossroadsOf(variant)) {
          const size = panelOf(model, node).length;
          for (const verdict of verdictsOf(model, variant, node)) {
            const postures = POSTURE_IDS.filter((id) => node.posture[id] === verdict.option.id)
              .map((id) => ({ cautious: 'Cautelosa', balanced: 'Equilibrada', bold: 'Ousada' })[id])
              .join(', ');
            const good = verdict.goodFor;
            const bad = verdict.badFor;
            lines.push(
              `| ${model.label} | ${'ABC'[index]} | ${verdict.option.label} | ${postures} | ${requirementText(verdict.option)} | ${good === null ? '—' : `${teamText(good.team)}${traitText(good.team)} (passa em ${percent(good.pass)})`} | ${bad === null ? '—' : bad.pass === null ? `${teamText(bad.team)} (não pode)` : `${teamText(bad.team)}${traitText(bad.team)} (passa em ${percent(bad.pass)})`} | ${verdict.bestCount} de ${size} |`,
            );
          }
        }
      }
    }
    show(`\n${lines.join('\n')}\n`);
  });

  it('o rendimento por hora de jogo de cada herói, na Equilibrada', () => {
    const lines = [
      '| Modelo | Duração | Equipe | Recursos por hora de herói | Experiência por hora, de cada herói |',
      '|---|---:|---|---:|---:|',
    ];
    const one = (value: number): string => value.toFixed(1).replace('.', ',');
    for (const model of expeditionModels) {
      for (const kind of ['min', 'ample'] as const) {
        const got = yieldPerHeroHour(model, kind, 'balanced');
        lines.push(
          `| ${model.label} | ${model.durationMs / 60_000} min | ${TEAM_LABELS[kind]}: ${teamText(referenceTeam(model, kind))} | ${one(got.resources)} | ${one(got.xp)} |`,
        );
      }
    }
    show(`\n${lines.join('\n')}\n`);
  });

  it('as quatro tabelas são as do arquivo', async () => {
    expect(written).toHaveLength(4);
    await expect(
      [
        '# Calibragem do catálogo de expedições\n',
        'Gerado por `expeditions.calibration.test.ts`; não edite à mão. As equipes de referência, a régua e o que a conta não vê estão descritos no teste.\n',
        '## Por modelo, equipe e Postura',
        written[0],
        '## Cada prova, para as três equipes',
        written[1],
        '## Cada opção de encruzilhada',
        written[2],
        '## Por hora de jogo de cada herói',
        written[3],
      ].join('\n'),
    ).toMatchFileSnapshot('./__golden__/expedition-calibration.md');
  });
});

function weightsText(node: ExpeditionStageNode): string {
  const labels: Record<string, string> = {
    health: 'vida',
    attack: 'ataque',
    defense: 'defesa',
    speed: 'velocidade',
    skill: 'perícia',
    will: 'vontade',
  };
  const weights = Object.entries(node.trial?.weights ?? {});
  return weights.length === 0
    ? 'o padrão'
    : weights
        .map(([id, ratio]) => `${labels[id]} ×${String(ratio.num / ratio.den).replace('.', ',')}`)
        .join(', ');
}

function requirementText(option: ExpeditionOption): string {
  const { requires } = option;
  if (requires === undefined) {
    return '—';
  }
  return 'trait' in requires ? `traço ${requires.trait}` : heroClasses[requires.heroClass].label;
}

function traitText(team: readonly Hero[]): string {
  const traits = team.flatMap((entry) => entry.traits);
  return traits.length === 0 ? '' : `, com ${traits.join(', ')}`;
}
