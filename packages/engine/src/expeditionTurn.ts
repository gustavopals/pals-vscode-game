import {
  balance,
  expeditionOutcomes,
  expeditionPostures,
  type ExpeditionStageNode,
  expeditionTemplates,
  RESOURCE_IDS,
  type ResourceId,
} from '@lotg/content';

import { emit } from './chronicle';
import { lowerFirst } from './council';
import {
  enterNode,
  expeditionLabel,
  heroesOf,
  nodeOf,
  outcomeOf,
  postureChoice,
  powerAgainst,
  teamNames,
} from './expeditions';
import { dropStream, entityStream, nextInt } from './random';
import { describeLoss, storeResource } from './storage';
import type { Expedition, ExpeditionLogEntry, GameEvent, GameState } from './types';
import { MILLI } from './units';

/**
 * As expedições na linha do tempo (GDD §9.2; ADR 0017, decisões 7 e 9; ADR 0018, decisão 11): o
 * fim de um nó, o prazo de uma encruzilhada e a volta para casa. É o único ponto das expedições
 * que sorteia, e só `advanceTo` chega aqui: as ordens (`expeditionOrders.ts`) não sorteiam.
 *
 * Cada expedição sorteia **só no próprio fluxo**, `expedition:<id>`: mandar uma segunda equipe
 * não muda a sorte da primeira, e a ordem em que duas são processadas não muda a de nenhuma.
 */

const { expeditions: rules } = balance;

const noAmounts = (): Record<ResourceId, number> => ({ food: 0, wood: 0, stone: 0, gold: 0 });

/** "22 de ouro e 15 de madeira", a partir de unidades inteiras. */
function describeUnits(amounts: Record<ResourceId, number>): string {
  return describeLoss(amounts);
}

/** As chaves `<prefixo>_<recurso>` de um evento, só para o que é maior que zero. */
function amountKeys(prefix: string, amounts: Record<ResourceId, number>): Record<string, number> {
  return Object.fromEntries(
    RESOURCE_IDS.filter((resource) => amounts[resource] > 0).map((resource) => [
      `${prefix}_${resource}`,
      amounts[resource],
    ]),
  );
}

/**
 * Resolve o nó em que a equipe está, no instante em que ele termina (ADR 0017, decisão 7).
 *
 * **A ordem dos sorteios dentro do nó é fixa**, todos no fluxo da expedição:
 *
 * 1. a **sorte**, um inteiro de `luck.min` a `luck.max`, uma vez, só em nó com dificuldade;
 * 2. (quem sofre o desfecho entra aqui, com V3D-T2: nesta tarefa o desfecho não toca o herói);
 * 3. as **quantidades do saque**, na ordem dos recursos do conteúdo, cada uma um inteiro da
 *    faixa do nó. Só se sorteia o que pode acontecer: a faixa de um valor só não gasta sorteio,
 *    e o desfecho que não deixa trazer nada (o Desastre) não sorteia quantidade nenhuma.
 *
 * O desfecho decide a parte do saque do nó que a equipe traz (`lootShare`) e a frase. O poder é
 * o da equipe **neste instante**, com os pesos do nó: quem ficou Descontente no caminho rende
 * menos aqui.
 */
function resolveStage(
  draft: GameState,
  expedition: Expedition,
  node: ExpeditionStageNode,
  atMs: number,
  events: GameEvent[],
): void {
  const stream = entityStream('expedition', expedition.id);
  const team = heroesOf(draft, expedition.heroIds);
  const { trial } = node;
  let outcome: ExpeditionLogEntry['outcome'] = 'passed';
  let share = { num: 1, den: 1 };
  let template = node.text;
  if (trial !== undefined) {
    const luck = rules.luck.min + nextInt(draft, stream, rules.luck.max - rules.luck.min + 1);
    const result = outcomeOf(powerAgainst(team, trial, expedition.posture), luck, trial.difficulty);
    outcome = result;
    share = rules.lootShare[result];
    template = trial.outcomes[result];
  }
  const gained = noAmounts();
  if (node.rewards !== undefined && share.num > 0) {
    for (const resource of RESOURCE_IDS) {
      const range = node.rewards.resources[resource];
      if (range === undefined) {
        continue;
      }
      const amount =
        range.max > range.min
          ? range.min + nextInt(draft, stream, range.max - range.min + 1)
          : range.min;
      gained[resource] = Math.floor((amount * share.num) / share.den);
      expedition.loot.resources[resource] += gained[resource];
    }
  }
  expedition.log.push({
    nodeId: expedition.nodeId,
    atMs,
    outcome,
    optionId: null,
    decidedBy: null,
    gained,
  });
  emit(
    events,
    draft,
    atMs,
    'expeditionNodeResolved',
    {
      expeditionId: expedition.id,
      modelId: expedition.modelId,
      outcome,
      ...amountKeys('found', gained),
    },
    {
      expedicao: expeditionLabel(expedition.modelId),
      no: node.title,
      desfecho: expeditionOutcomes[outcome].label.toLowerCase(),
      herois: teamNames(team),
    },
    template,
  );
  enterNode(draft, expedition, node.next, atMs, events);
}

/**
 * A equipe volta para casa: o saque entra no estoque pelo depósito (o que não cabe é
 * desperdício contado, como todo ganho discreto), os heróis voltam a ficar no feudo, o percurso
 * vira relatório (os mais antigos saem) e a expedição deixa a lista.
 *
 * **Apagar o fluxo de sorteio é o último passo dela neste instante**: nada sorteia em
 * `expedition:<id>` depois do `dropStream`, e o identificador nunca volta, então o fluxo não
 * renasce (README do motor, "O que a fundação não prova", R1).
 */
function returnHome(
  draft: GameState,
  expedition: Expedition,
  atMs: number,
  events: GameEvent[],
): void {
  const { guild } = draft;
  const team = heroesOf(draft, expedition.heroIds);
  const stored = noAmounts();
  const wasted = noAmounts();
  for (const resource of RESOURCE_IDS) {
    const milli = expedition.loot.resources[resource] * MILLI;
    stored[resource] = storeResource(draft, resource, milli);
    wasted[resource] = milli - stored[resource];
  }
  for (const hero of team) {
    hero.status = 'idle';
  }
  guild.reports.push({
    expeditionId: expedition.id,
    modelId: expedition.modelId,
    variant: expedition.variant,
    heroNames: team.map((hero) => hero.name),
    posture: expedition.posture,
    sentAtMs: expedition.sentAtMs,
    returnedAtMs: atMs,
    log: expedition.log,
    loot: expedition.loot,
    wasted,
  });
  guild.reports = guild.reports.slice(-rules.reportsKept);
  guild.expeditions = guild.expeditions.filter((entry) => entry.id !== expedition.id);
  draft.stats.expeditionsReturned = (draft.stats.expeditionsReturned ?? 0) + 1;
  const { resources } = expedition.loot;
  const empty = RESOURCE_IDS.every((resource) => resources[resource] === 0);
  const cut = RESOURCE_IDS.some((resource) => wasted[resource] > 0);
  const lost = Object.fromEntries(
    RESOURCE_IDS.map((resource) => [resource, wasted[resource] / MILLI]),
  ) as Record<ResourceId, number>;
  emit(
    events,
    draft,
    atMs,
    'expeditionReturned',
    {
      expeditionId: expedition.id,
      modelId: expedition.modelId,
      heroes: team.length,
      heroIds: expedition.heroIds.join(','),
      ...amountKeys('loot', resources),
      ...Object.fromEntries(
        RESOURCE_IDS.filter((resource) => stored[resource] > 0).map((resource) => [
          `gained_${resource}`,
          stored[resource] / MILLI,
        ]),
      ),
      ...amountKeys('lost', lost),
    },
    {
      expedicao: expeditionLabel(expedition.modelId),
      herois: teamNames(team),
      saque: describeUnits(resources),
      perda: describeLoss(lost),
    },
    empty ? expeditionTemplates.returnedEmpty : cut ? expeditionTemplates.returnedCut : undefined,
  );
  // O último passo da expedição neste instante: nada mais sorteia no fluxo dela.
  dropStream(draft, entityStream('expedition', expedition.id));
}

/**
 * O prazo da encruzilhada venceu sem resposta: vale a opção marcada para a Postura da
 * expedição; se ela está fora do alcance desta equipe, a da Cautelosa (ADR 0018, decisão 11).
 * Não sorteia nada.
 */
function decideByPosture(
  draft: GameState,
  expedition: Expedition,
  atMs: number,
  events: GameEvent[],
): void {
  const node = nodeOf(expedition);
  const team = heroesOf(draft, expedition.heroIds);
  const choice = node?.kind === 'crossroads' ? postureChoice(team, node, expedition.posture) : null;
  if (choice === null) {
    // O conteúdo já não tem esta encruzilhada: a equipe volta com o que juntou.
    returnHome(draft, expedition, atMs, events);
    return;
  }
  const fallback = choice.blocked !== null;
  expedition.log.push({
    nodeId: expedition.nodeId,
    atMs,
    outcome: 'chosen',
    optionId: choice.option.id,
    decidedBy: fallback ? 'cautiousFallback' : 'posture',
    gained: noAmounts(),
  });
  draft.stats.crossroadsByPosture = (draft.stats.crossroadsByPosture ?? 0) + 1;
  emit(
    events,
    draft,
    atMs,
    'expeditionPostureDecided',
    {
      expeditionId: expedition.id,
      modelId: expedition.modelId,
      optionId: choice.option.id,
      decidedBy: 'posture',
      posture: expedition.posture,
      fallback: fallback ? 1 : 0,
    },
    {
      expedicao: expeditionLabel(expedition.modelId),
      opcao: lowerFirst(choice.option.label),
      postura: expeditionPostures[expedition.posture].label.toLowerCase(),
    },
    fallback ? expeditionTemplates.postureFallback : undefined,
  );
  enterNode(draft, expedition, choice.option.next, atMs, events);
}

/** O que uma expedição tem a fazer em `atMs`, uma coisa por vez; diz se fez algo. */
function stepExpedition(
  draft: GameState,
  expedition: Expedition,
  atMs: number,
  events: GameEvent[],
): boolean {
  if (expedition.crossroads !== null) {
    if (expedition.crossroads.decidesAtMs > atMs) {
      return false;
    }
    decideByPosture(draft, expedition, atMs, events);
    return true;
  }
  if (expedition.nodeEndsAtMs === null || expedition.nodeEndsAtMs > atMs) {
    return false;
  }
  const node = nodeOf(expedition);
  if (node === null || node.kind === 'return' || node.kind === 'crossroads') {
    // O fim do caminho de volta, ou um nó que o conteúdo já não tem.
    returnHome(draft, expedition, atMs, events);
    return true;
  }
  resolveStage(draft, expedition, node, atMs, events);
  return true;
}

/**
 * As expedições em um instante da linha do tempo: os nós que terminam e os prazos de
 * encruzilhada que vencem, **na ordem do identificador da expedição** (a da lista: `expedition-9`
 * antes de `expedition-10`). Como cada uma sorteia no próprio fluxo, a ordem não muda o
 * resultado de nenhuma; ela só fixa a ordem das linhas da Crônica e a do saque no depósito.
 *
 * Roda depois das incursões e da Taverna e antes das planejadas, dos objetivos e da conta do
 * ouro (`processEventsAt`): o saque que chega neste instante já conta para a obra que esperava
 * recurso e para o soldo.
 */
export function settleExpeditions(draft: GameState, atMs: number, events: GameEvent[]): void {
  for (const id of draft.guild.expeditions.map((entry) => entry.id)) {
    for (;;) {
      const expedition = draft.guild.expeditions.find((entry) => entry.id === id);
      if (expedition === undefined || !stepExpedition(draft, expedition, atMs, events)) {
        break;
      }
    }
  }
}
