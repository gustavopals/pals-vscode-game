import {
  balance,
  CHRONICLE_PLACEHOLDERS,
  type ExpeditionCrossroadsNode,
  type ExpeditionModelDef,
  expeditionModels,
  type ExpeditionNode,
  type ExpeditionOutcomeId,
  type ExpeditionTrial,
  type ExpeditionVariant,
  HERO_CLASS_IDS,
  type HeroClassId,
  type HeroTraitId,
} from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { nextVariant, outcomeOf } from './expeditions';
import { teamPower } from './heroes';
import { entityStream, nextInt } from './random';
import { cloneState } from './state';
import {
  accept,
  addHero,
  command,
  everyDestinationOpen,
  guildHall,
  nextVariantIs,
  quietCouncil,
  quietHorde,
  send,
} from './test-helpers';
import type { ExpeditionReportView, GameEvent, GameState, Hero } from './types';
import { deriveViewState } from './view';

/**
 * O catálogo percorrido de ponta a ponta (roadmap da v0.3, V3D-T3.7): **os testes são gerados a
 * partir do conteúdo**. Cada variante de cada modelo é andada por todos os ramos (cada opção de
 * cada encruzilhada), com cada desfecho posto à força em todo nó com prova; a névoa é conferida
 * em todo grafo com encruzilhada; e o relatório de cada modelo, com semente fixa, é golden
 * (critério 3 do GDD §16.2).
 */

const { expeditions: rules } = balance;
const OUTCOMES: readonly ExpeditionOutcomeId[] = ['full', 'success', 'setback', 'disaster'];
const LUCKS = Array.from(
  { length: rules.luck.max - rules.luck.min + 1 },
  (_, index) => rules.luck.min + index,
);
const STREAM = entityStream('expedition', 'expedition-1');
/** O que é de outra versão e não pode aparecer em frase nenhuma de expedição. */
const FUTURE =
  /\bferros?\b|\barmas?\b|relíquia|\bplantas?\b|\bunidades?\b|presságio|exército|\bmestres?\b|\bmercado/i;

type Path = { name: string; choices: Record<string, string> };
type Graph = {
  name: string;
  model: ExpeditionModelDef;
  index: number;
  variant: ExpeditionVariant;
};

const graphs: Graph[] = expeditionModels.flatMap((model) =>
  model.variants.map((variant, index) => ({
    name: `${model.id}/${'ABC'[index]}`,
    model,
    index,
    variant,
  })),
);

const crossroadsOf = (variant: ExpeditionVariant): Array<[string, ExpeditionCrossroadsNode]> =>
  Object.entries(variant.nodes).flatMap(([key, node]) =>
    node.kind === 'crossroads' ? [[key, node] as [string, ExpeditionCrossroadsNode]] : [],
  );

/** Todos os ramos de um grafo: uma escolha para cada encruzilhada. */
function pathsOf(variant: ExpeditionVariant): Path[] {
  let paths: Path[] = [{ name: 'sem encruzilhada', choices: {} }];
  for (const [key, node] of crossroadsOf(variant)) {
    paths = paths.flatMap((path) =>
      node.options.map((option) => ({
        name: path.name === 'sem encruzilhada' ? option.id : `${path.name}+${option.id}`,
        choices: { ...path.choices, [key]: option.id },
      })),
    );
  }
  return paths;
}

/** Os nós que um caminho atravessa, na ordem, pelas chaves. */
function keysOf(variant: ExpeditionVariant, choices: Record<string, string>): string[] {
  const keys: string[] = [];
  let key = variant.start;
  for (let steps = 0; steps < 20; steps += 1) {
    const node = variant.nodes[key] as ExpeditionNode;
    keys.push(key);
    if (node.kind === 'return') {
      return keys;
    }
    key =
      node.kind === 'crossroads'
        ? (node.options.find((option) => option.id === choices[key])?.next ?? '')
        : node.next;
  }
  throw new Error('Grafo sem retorno.');
}

/**
 * Uma equipe que pode tomar o caminho: do tamanho máximo do modelo, no nível mínimo, com as
 * classes que o modelo e as opções escolhidas pedem (o resto na ordem do conteúdo) e, no
 * primeiro herói, os traços que as opções pedem.
 */
function teamFor(
  { model, variant }: Graph,
  choices: Record<string, string>,
): Array<{ classId: HeroClassId; traits: HeroTraitId[] }> {
  const classes: HeroClassId[] = [...model.requires.classes];
  const traits: HeroTraitId[] = [];
  for (const [key, node] of crossroadsOf(variant)) {
    const requires = node.options.find((option) => option.id === choices[key])?.requires;
    if (requires !== undefined && 'trait' in requires) {
      traits.push(requires.trait);
    } else if (requires !== undefined && !classes.includes(requires.heroClass)) {
      classes.push(requires.heroClass);
    }
  }
  for (const classId of HERO_CLASS_IDS) {
    if (classes.length < model.requires.teamMax && !classes.includes(classId)) {
      classes.push(classId);
    }
  }
  return classes
    .slice(0, model.requires.teamMax)
    .map((classId, index) => ({ classId, traits: index === 0 ? traits : [] }));
}

const NAMES = ['Edda', 'Rolf', 'Isolda', 'Brann'];

/** A Guilda no nível mais alto, sem ninguém: feita uma vez por semente, e copiada por teste. */
const BASES = new Map<string, GameState>();
function baseOf(seed: string): GameState {
  const known = BASES.get(seed);
  if (known !== undefined) {
    return known;
  }
  const base = guildHall(
    0,
    (draft) => {
      quietCouncil(draft);
      quietHorde(draft);
      // Lugar no depósito para o saque, e ouro para o soldo da jornada.
      Object.assign(draft.settlement.resources, { wood: 0, stone: 0, gold: 200_000 });
    },
    { level: 4, seed },
  );
  BASES.set(seed, base);
  return base;
}

/** A Guilda no nível mais alto, com a equipe pronta, todo destino aberto e o resto do feudo calado. */
function ready(graph: Graph, choices: Record<string, string>, seed = 'catalogo'): GameState {
  const draft = cloneState(baseOf(seed));
  for (const [index, spec] of teamFor(graph, choices).entries()) {
    addHero(draft, {
      name: NAMES[index] ?? `Herói ${index}`,
      gender: index % 2 === 0 ? 'f' : 'm',
      classId: spec.classId,
      traits: spec.traits,
      level: graph.model.requires.minHeroLevel,
    });
  }
  everyDestinationOpen(draft);
  return draft;
}

const teamIds = (graph: Graph, choices: Record<string, string>): string[] =>
  teamFor(graph, choices).map((_, index) => `hero-${index + 1}`);

/**
 * O estado do gerador que faz a próxima sorte de uma expedição ser a pedida. A primeira saída
 * do gerador depende só do estado do fluxo (da segunda palavra dele): procura-se uma vez por
 * sorte, e o resultado serve a todo teste.
 */
const STREAMS = new Map<number, number[]>();
function streamFor(luck: number): number[] {
  const known = STREAMS.get(luck);
  if (known !== undefined) {
    return known;
  }
  for (let word = 1; word < 20_000; word += 1) {
    // O gerador só olha o fluxo e o contador de identidades: basta um estado com os dois.
    const probe = {
      rng: { [STREAM]: [1, word, 3, 4] },
      ids: { expedition: 1 },
    } as unknown as GameState;
    if (rules.luck.min + nextInt(probe, STREAM, LUCKS.length) === luck) {
      STREAMS.set(luck, [1, word, 3, 4]);
      return [1, word, 3, 4];
    }
  }
  throw new Error(`Nenhum estado do gerador deu a sorte ${luck}.`);
}

/** O desfecho que nenhuma equipe alcança em um nó: o teste diz quais são, e são poucos. */
class Unreachable extends Error {
  constructor(outcome: string, difficulty: number) {
    super(`Nenhuma equipe chega ao desfecho ${outcome} contra ${difficulty}.`);
  }
}

/**
 * Os desfechos que não existem: na estrada velha da Patrulha (vontade, um herói só) nem um
 * Arqueiro Descontente chega ao Desastre. A frase dele fica no conteúdo, para o dia em que a
 * dificuldade mudar.
 */
const UNREACHABLE = ['patrol/C por sem encruzilhada, disaster'];

/** Quem partiu e ainda pode estar na equipe: quem serve ao feudo e não ficou em cativeiro. */
const ableOf = (state: GameState, sentIds: readonly string[]): string[] =>
  sentIds.filter((id) =>
    state.guild.heroes.some((hero) => hero.id === id && hero.status !== 'captured'),
  );

/** Devolve à equipe todo mundo que partiu e ainda pode estar nela (o teste tira gente dela). */
function regrouped(state: GameState, sentIds: readonly string[]): GameState {
  const next = cloneState(state);
  const [expedition] = next.guild.expeditions;
  if (expedition === undefined) {
    return next;
  }
  expedition.heroIds = ableOf(next, sentIds);
  for (const hero of next.guild.heroes) {
    if (expedition.heroIds.includes(hero.id)) {
      hero.status = 'expedition';
    }
  }
  return next;
}

/**
 * Põe o desfecho à força no nó em que a expedição está, **sem tocar a regra**: escolhe quantos
 * dos heróis que partiram continuam na equipe, em que nível estão e a sorte, de modo que a conta
 * do motor dê o desfecho pedido, e deixa o gerador a um passo dessa sorte. Quando nem um herói
 * só, de nível 1, é fraco o bastante, ele fica Descontente (com o soldo em atraso aberto, como
 * em `weakened`) e, se o caminho já não pede a classe de ninguém (`classesFree`), vira Clérigo.
 */
function forced(
  state: GameState,
  sentIds: readonly string[],
  trial: ExpeditionTrial,
  outcome: ExpeditionOutcomeId,
  classesFree: boolean,
): GameState {
  const able = ableOf(state, sentIds);
  const [current] = state.guild.expeditions;
  if (current === undefined) {
    throw new Error('Não há expedição em curso.');
  }
  for (const weak of [false, true]) {
    for (let size = able.length; size >= 1; size -= 1) {
      for (let level = 1; level <= balance.heroes.maxLevel; level += 1) {
        const kept = able.slice(0, size);
        // A conta primeiro, em cópias dos heróis; o estado só é copiado quando ela fecha.
        const reshape = (hero: Hero): Hero => ({
          ...hero,
          level,
          xp: 0,
          status: 'expedition',
          discontent: weak ? true : hero.discontent,
          classId: weak && classesFree ? 'cleric' : hero.classId,
        });
        const team = state.guild.heroes.filter((hero) => kept.includes(hero.id)).map(reshape);
        const power = teamPower(team, trial.weights, current.posture);
        const luck = LUCKS.find((value) => outcomeOf(power, value, trial.difficulty) === outcome);
        if (luck === undefined) {
          continue;
        }
        const next = cloneState(state);
        const [expedition] = next.guild.expeditions;
        if (expedition === undefined) {
          throw new Error('Não há expedição em curso.');
        }
        next.guild.heroes = next.guild.heroes.map((hero) =>
          kept.includes(hero.id)
            ? reshape(hero)
            : able.includes(hero.id)
              ? { ...hero, status: 'idle', injury: null }
              : hero,
        );
        if (weak) {
          next.guild.wageArrears = { sinceMs: next.lastProcessedAt, carriedMs: 0, departed: 0 };
          next.guild.lastWageArrears = null;
          next.settlement.resources.gold = 0;
        }
        expedition.heroIds = kept;
        next.rng[STREAM] = streamFor(luck);
        return next;
      }
    }
  }
  throw new Unreachable(outcome, trial.difficulty);
}

type Journey = { state: GameState; events: GameEvent[]; report: ExpeditionReportView };

/** Anda um caminho inteiro, com o desfecho dado em todo nó com prova (`null`: a sorte decide). */
function walk(
  graph: Graph,
  choices: Record<string, string>,
  outcome: ExpeditionOutcomeId | null,
  seed?: string,
): Journey {
  const sentIds = teamIds(graph, choices);
  const sent = send(ready(graph, choices, seed), graph.model.id, sentIds, 'balanced', graph.index);
  let { state } = sent;
  const events = [...sent.events];
  for (let steps = 0; steps < 30; steps += 1) {
    const [expedition] = state.guild.expeditions;
    if (expedition === undefined) {
      const [report] = deriveViewState(state, state.lastProcessedAt).guild.reports;
      if (report === undefined) {
        throw new Error('A expedição terminou sem relatório.');
      }
      return { state, events, report };
    }
    if (expedition.crossroads !== null) {
      const chosen = accept(
        regrouped(state, sentIds),
        command('chooseExpeditionPath', {
          expeditionId: expedition.id,
          optionId: choices[expedition.nodeId] ?? '',
        }),
      );
      state = chosen.state;
      events.push(...chosen.events);
      continue;
    }
    const node = graph.variant.nodes[expedition.nodeId];
    if (
      outcome !== null &&
      node !== undefined &&
      node.kind !== 'crossroads' &&
      node.kind !== 'return' &&
      node.trial !== undefined
    ) {
      // Depois da última encruzilhada o caminho já não pede a classe de ninguém.
      const ahead = keysOf(graph.variant, choices);
      const classesFree = !ahead
        .slice(ahead.indexOf(expedition.nodeId))
        .some((key) => graph.variant.nodes[key]?.kind === 'crossroads');
      state = forced(state, sentIds, node.trial, outcome, classesFree);
    }
    const advanced = advanceTo(state, state.guild.expeditions[0]?.nodeEndsAtMs ?? 0);
    state = advanced.state;
    events.push(...advanced.events);
  }
  throw new Error('A expedição não terminou.');
}

const everyBranch = graphs.flatMap((graph) =>
  pathsOf(graph.variant).flatMap((path) =>
    OUTCOMES.map(
      (outcome) => [`${graph.name} por ${path.name}, ${outcome}`, graph, path, outcome] as const,
    ),
  ),
);

describe('o catálogo percorrido em todos os ramos (roadmap da v0.3, V3D-T3.7)', () => {
  it('são 18 grafos, e todo ramo de todo grafo é percorrido com os quatro desfechos', () => {
    expect(graphs).toHaveLength(18);
    expect(everyBranch.length).toBe(
      4 * graphs.reduce((sum, graph) => sum + pathsOf(graph.variant).length, 0),
    );
    // Toda opção de toda encruzilhada está em algum ramo.
    for (const graph of graphs) {
      for (const [key, node] of crossroadsOf(graph.variant)) {
        const taken = new Set(pathsOf(graph.variant).map((path) => path.choices[key]));
        expect([...taken].sort()).toEqual(node.options.map((option) => option.id).sort());
      }
    }
  });

  it.each(everyBranch)(
    '%s: termina, com uma frase por nó, sem lacuna solta e sem nada de outra versão',
    (name, graph, path, outcome) => {
      if (UNREACHABLE.includes(name)) {
        expect(() => walk(graph, path.choices, outcome)).toThrow(Unreachable);
        return;
      }
      const { state, events, report } = walk(graph, path.choices, outcome);
      expect(state.guild.expeditions).toEqual([]);
      const [stored] = state.guild.reports;
      const keys = keysOf(graph.variant, path.choices);
      const visited = (stored?.log ?? []).map((entry) => entry.nodeId);
      // O percurso é o do caminho, na ordem, até onde a equipe chegou (ela pode se perder).
      expect(visited).toEqual(keys.slice(0, visited.length));
      if (stored?.lost !== true) {
        expect(visited).toEqual(keys.slice(0, -1));
      }
      const bad = outcome === 'setback' || outcome === 'disaster';
      const names = new Set(report.teamNames);
      for (const entry of stored?.log ?? []) {
        const node = graph.variant.nodes[entry.nodeId] as ExpeditionNode;
        if (node.kind === 'crossroads' || node.kind === 'return') {
          expect(entry.outcome).toBe('chosen');
          continue;
        }
        expect(entry.outcome).toBe(node.trial === undefined ? 'passed' : outcome);
        expect(entry.standout === null).toBe(node.trial === undefined);
        expect(entry.lesson === null).toBe(node.trial === undefined || !bad);
        if (entry.standout !== null) {
          expect(names.has(entry.standout)).toBe(true);
        }
      }
      // Um passo por registro e, para quem voltou, o caminho de volta.
      expect(report.log).toHaveLength(visited.length + (report.lost ? 0 : 1));
      const texts = [
        ...report.log.flatMap((step) => [step.title, step.text, ...step.notes]),
        report.lootText,
        report.lossesText,
        report.deedsText ?? '',
        report.itemsText ?? '',
        ...events.map((event) => event.text),
      ];
      for (const text of texts) {
        expect(text).not.toMatch(/[{}]|undefined|null/);
      }
      // O que vem do grafo (os passos do relatório e as linhas dos nós) não fala de outra versão.
      const fromGraph = [
        ...report.log.flatMap((step) => [step.title, step.text]),
        ...events.filter((event) => event.type.startsWith('expeditionNode')).map((e) => e.text),
      ];
      for (const text of fromGraph) {
        expect(text).not.toMatch(FUTURE);
      }
      for (const step of report.log) {
        expect(step.text).toMatch(/^\p{Lu}.*\.$/u);
        if (step.standoutName !== null) {
          expect(step.text).toContain(step.standoutName);
        }
        if (step.lessonText !== null) {
          expect(step.text).toContain(step.lessonText);
        }
      }
      // A Crônica leva as mesmas frases: a linha do nó é o começo do passo do relatório.
      const resolved = events.filter(
        (event) => event.type === 'expeditionNodeResolved' || event.type === 'expeditionNodeFailed',
      );
      const stages = report.log.filter((step) => step.outcomeLabel !== 'Caminho escolhido');
      expect(resolved.length).toBe(stages.length - (report.lost ? 0 : 1));
      resolved.forEach((event, index) => {
        expect(stages[index]?.text.startsWith(event.text)).toBe(true);
      });
      // O nó que deu errado tem o tipo que a Crônica mostra; o que deu certo, o que ela guarda.
      for (const event of resolved) {
        const failed = event.data.outcome === 'setback' || event.data.outcome === 'disaster';
        expect(event.type).toBe(failed ? 'expeditionNodeFailed' : 'expeditionNodeResolved');
      }
      // O fecho diz o que custou: com Revés ou Desastre em algum nó, quase sempre alguém pagou.
      expect(report.lossesText.length).toBeGreaterThan(0);
      if ((stored?.log ?? []).some((entry) => entry.harm !== null)) {
        expect(report.lossesText).toMatch(/^O preço: /);
      }
    },
  );

  it('todo marcador das frases do catálogo é um dos que a Crônica preenche', () => {
    const known = new Set<string>(CHRONICLE_PLACEHOLDERS);
    const used = new Set(
      [...JSON.stringify(expeditionModels).matchAll(/\{([^}"]*)\}/g)].map((match) => match[1]),
    );
    expect([...used].filter((marker) => !known.has(marker ?? ''))).toEqual([]);
    expect([...used].sort()).toEqual(['daEstacao', 'dia', 'feudo', 'heroi']);
  });
});

describe('a névoa em todo grafo com encruzilhada (ADR 0018, decisão 13)', () => {
  const withCrossroads = graphs.filter((graph) => crossroadsOf(graph.variant).length > 0);

  it('só a Patrulha não tem encruzilhada', () => {
    expect(graphs.length - withCrossroads.length).toBe(3);
  });

  it.each(withCrossroads.map((graph) => [graph.name, graph] as const))(
    '%s: antes da escolha, a visão não traz título, frase nem lição de nó nenhum além da encruzilhada',
    (_name, graph) => {
      const [[crossKey, crossroads] = []] = crossroadsOf(graph.variant);
      if (crossKey === undefined || crossroads === undefined) {
        throw new Error('Grafo sem encruzilhada.');
      }
      // O que há antes dela, pelo caminho; o resto do grafo está além (menos o retorno, que
      // nunca sai na visão de uma expedição em curso).
      const before = new Set<string>();
      for (let key = graph.variant.start; key !== crossKey;) {
        before.add(key);
        const node = graph.variant.nodes[key];
        if (node === undefined || node.kind === 'crossroads' || node.kind === 'return') {
          break;
        }
        key = node.next;
      }
      const hidden = Object.entries(graph.variant.nodes).filter(
        ([key]) => key !== crossKey && !before.has(key),
      );
      expect(hidden.length).toBeGreaterThan(0);
      const secrets = hidden.flatMap(([, node]) =>
        node.kind === 'crossroads'
          ? [node.title]
          : node.kind === 'return' || node.trial === undefined
            ? [node.title, node.text ?? '']
            : [node.title, ...Object.values(node.trial.outcomes)].concat(node.trial.lesson ?? []),
      );
      const choices = { [crossKey]: crossroads.posture.cautious };
      const start = ready(graph, choices);
      const ids = teamIds(graph, choices);
      // Recém-enviada: a expedição em curso não diz nada do que há além da encruzilhada.
      const sent = send(start, graph.model.id, ids, 'bold', graph.index);
      const offered = JSON.stringify(deriveViewState(sent.state, 0).guild.expeditions);
      for (const secret of secrets) {
        expect(offered).not.toContain(secret.slice(0, 60));
      }
      // Parada na encruzilhada: as opções com as pistas, e nada do que há atrás de cada uma.
      let { state } = sent;
      for (
        let steps = 0;
        steps < 10 && state.guild.expeditions[0]?.crossroads === null;
        steps += 1
      ) {
        const expedition = state.guild.expeditions[0];
        const node = graph.variant.nodes[expedition?.nodeId ?? ''];
        if (
          node !== undefined &&
          node.kind !== 'crossroads' &&
          node.kind !== 'return' &&
          node.trial !== undefined
        ) {
          state = forced(state, ids, node.trial, 'success', false);
        }
        state = advanceTo(state, state.guild.expeditions[0]?.nodeEndsAtMs ?? 0).state;
      }
      const view = deriveViewState(state, state.lastProcessedAt);
      const [waiting] = view.guild.expeditions;
      expect(waiting?.crossroads?.options.map((option) => option.id)).toEqual(
        crossroads.options.map((option) => option.id),
      );
      const seen = JSON.stringify({ guild: view.guild, pending: view.pendingDecisions });
      for (const secret of secrets) {
        expect(seen).not.toContain(secret.slice(0, 60));
      }
      // A chave de um nó, a variante e para onde cada opção leva nunca saem.
      expect(seen).not.toContain('"next"');
      expect(seen).not.toContain('"variant"');
      expect(seen).not.toContain('"nodeId"');
    },
  );

  it.each(graphs.map((graph) => [graph.name, graph] as const))(
    '%s: o destino oferecido só mostra o primeiro trecho, e a régua da equipe é a da prova mais dura dele',
    (_name, graph) => {
      const draft = cloneState(ready(graph, {}));
      // A variante que sairia agora é a deste grafo.
      nextVariantIs(draft, graph.model.id, graph.index);
      const offer = deriveViewState(draft, 0).guild.available.find(
        (entry) => entry.modelId === graph.model.id,
      );
      if (offer === undefined) {
        throw new Error('O destino não está na lista.');
      }
      const first = graph.variant.nodes[graph.variant.start] as ExpeditionNode;
      expect(offer.firstStretchText.startsWith(first.title)).toBe(true);
      const stretch: number[] = [];
      for (let key = graph.variant.start; ;) {
        const node = graph.variant.nodes[key] as ExpeditionNode;
        if (node.kind === 'crossroads' || node.kind === 'return') {
          break;
        }
        if (node.trial !== undefined) {
          stretch.push(node.trial.difficulty);
        }
        key = node.next;
      }
      const hardest = stretch.length === 0 ? null : Math.max(...stretch);
      expect(offer.firstStretchDifficulty).toBe(hardest);
      expect(offer.fit === null).toBe(hardest === null);
      if (offer.fit !== null && hardest !== null) {
        // Com o poder da folga, a pior sorte ainda dá Sucesso; um a menos, não.
        const { comfortPower, riskPower } = offer.fit;
        expect(outcomeOf(comfortPower * 1000, rules.luck.min, hardest)).toBe('success');
        expect(outcomeOf((comfortPower - 1) * 1000, rules.luck.min, hardest)).toBe('setback');
        expect(outcomeOf(riskPower * 1000, rules.luck.min, hardest)).toBe('setback');
        expect(outcomeOf((riskPower - 1) * 1000, rules.luck.min, hardest)).toBe('disaster');
        expect(offer.fit.text).toContain(String(comfortPower));
      }
      // Um número por herói que pode partir, e nenhum de quem está em cativeiro.
      expect(offer.heroFit.map((entry) => entry.heroId)).toEqual(
        draft.guild.heroes.filter((hero) => hero.status === 'idle').map((hero) => hero.id),
      );
    },
  );
});

describe('o relatório de cada modelo, com semente fixa (critério 3 do GDD §16.2)', () => {
  it('a mesma semente e as mesmas ordens dão o mesmo relatório e a mesma Crônica (golden)', async () => {
    const run = () =>
      Object.fromEntries(
        expeditionModels.map((model) => {
          // A variante que a semente dá, sem escolher: é a que o jogador encontraria.
          const index = nextVariant(
            guildHall(0, () => {}, { level: 4, seed: 'relatorio-v03' }),
            model,
          );
          const variant = model.variants[index] as ExpeditionVariant;
          const graph: Graph = { name: model.id, model, index, variant };
          // Na encruzilhada, o senhor responde com o caminho do meio.
          const choices = Object.fromEntries(
            crossroadsOf(variant).map(([key, node]) => [key, node.posture.balanced]),
          );
          const { events, report } = walk(graph, choices, null, 'relatorio-v03');
          return [
            model.id,
            {
              variant: 'ABC'[index],
              events: events.map((event) => `${event.type}: ${event.text}`),
              report,
            },
          ];
        }),
      );
    const once = run();
    expect(run()).toStrictEqual(once);
    await expect(`${JSON.stringify(once, null, 1)}\n`).toMatchFileSnapshot(
      './__golden__/expedition-catalog.json',
    );
  });
});
