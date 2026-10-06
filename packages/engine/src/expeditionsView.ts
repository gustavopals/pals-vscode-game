import {
  balance,
  type ExpeditionModelDef,
  expeditionModels,
  expeditionOutcomes,
  expeditionPostures,
  expeditionTexts,
  type ExpeditionVariant,
  heroClasses,
  items as itemDefs,
  POSTURE_IDS,
} from '@lotg/content';

import { narrate } from './chronicle';
import { seasonAt } from './clock';
import {
  destinationBlock,
  durationFactorAt,
  expeditionLabel,
  expeditionSlots,
  expeditionsText,
  guildLevel,
  heroesOf,
  isKnownDestination,
  nextVariant,
  nodeIn,
  nodeOf,
  optionLock,
  postureChoice,
  scaledDuration,
  slotsAtLevel,
  teamSizeText,
  variantOf,
} from './expeditions';
import { durationText, fillText, joinList, sentenceCase } from './format';
import { canDepart } from './heroes';
import { tileWithArticle } from './outcomes';
import { describeLoss } from './storage';
import type {
  BuildingId,
  CrossroadsView,
  Expedition,
  ExpeditionLogEntry,
  ExpeditionLogView,
  ExpeditionOfferView,
  ExpeditionReport,
  ExpeditionReportView,
  ExpeditionView,
  GameState,
  PendingDecisionView,
  PostureView,
  ResourceId,
} from './types';
import { MILLI, realSecondsCeil, SECOND_MS } from './units';

/**
 * As expedições na visão (GDD §9.2 e §9.4; ADR 0018, decisões 11 e 13). Só lê o estado: não
 * sorteia, não dá identificador e não anda o tempo. Tudo o que é prazo sai em tempo real, no
 * ritmo `timeScale`.
 *
 * **A névoa.** De um grafo só sai o que a equipe já alcançou e, antes do envio, o primeiro
 * trecho, até a primeira encruzilhada. Nunca saem: a dificuldade e o conteúdo dos nós depois de
 * uma encruzilhada que a equipe ainda não decidiu (nem o título, nem o saque), a sorte, o estado
 * do fluxo `expedition:<id>`, a variante do grafo e a chave de um nó. De uma opção de
 * encruzilhada saem o nome, a pista e se a equipe pode tomá-la; para onde ela leva, não.
 */

const { expeditions: rules } = balance;

/** O que a Guilda de um nível dá, sem maiúscula nem ponto: "sustenta 2 expedições por vez". */
function guildGivesText(level: number): string {
  return fillText(expeditionTexts.gives, { expedicoes: expeditionsText(slotsAtLevel(level)) });
}

/**
 * O que a obra da Guilda dos Aventureiros muda, para ficar ao lado do custo: "Sustenta 2
 * expedições por vez." `null` para os outros edifícios.
 */
export function guildEffect(building: BuildingId, targetLevel: number): string | null {
  return building === 'guild' ? `${sentenceCase(guildGivesText(targetLevel))}.` : null;
}

export function posturesView(): PostureView[] {
  return POSTURE_IDS.map((id) => ({ id, ...expeditionPostures[id] }));
}

/**
 * O primeiro trecho de um grafo em uma frase: cada nó até a primeira encruzilhada, com a
 * dificuldade dos que têm prova, e o que vem depois dele (a encruzilhada, sem dizer o que há
 * além dela, ou o caminho de volta).
 */
function firstStretchText(variant: ExpeditionVariant): string {
  const parts: string[] = [];
  let nodeId = variant.start;
  for (let steps = 0; steps <= rules.graph.maxSteps; steps += 1) {
    const node = nodeIn(variant, nodeId);
    if (node === null) {
      break;
    }
    if (node.kind === 'crossroads') {
      return `${parts.join(' · ')}${parts.length > 0 ? '. ' : ''}${expeditionTexts.stretchCrossroads}`;
    }
    if (node.kind === 'return') {
      return `${parts.join(' · ')}${parts.length > 0 ? '. ' : ''}${expeditionTexts.stretchReturn}`;
    }
    parts.push(
      node.trial === undefined
        ? fillText(expeditionTexts.stretchPassage, { no: node.title })
        : fillText(expeditionTexts.stretchTrial, {
            no: node.title,
            dificuldade: node.trial.difficulty,
          }),
    );
    nodeId = node.next;
  }
  return parts.join(' · ');
}

/** A maior dificuldade do primeiro trecho, até a primeira encruzilhada; `null` sem prova nele. */
function firstStretchDifficulty(variant: ExpeditionVariant): number | null {
  let hardest: number | null = null;
  let nodeId = variant.start;
  for (let steps = 0; steps <= rules.graph.maxSteps; steps += 1) {
    const node = nodeIn(variant, nodeId);
    if (node === null || node.kind === 'crossroads' || node.kind === 'return') {
      break;
    }
    if (node.trial !== undefined) {
      hardest = Math.max(hardest ?? 0, node.trial.difficulty);
    }
    nodeId = node.next;
  }
  return hardest;
}

function requirementsText(model: ExpeditionModelDef): string {
  const { requires } = model;
  const sentences = [fillText(expeditionTexts.team, { equipe: teamSizeText(requires) })];
  if (requires.minHeroLevel > 1) {
    sentences.push(fillText(expeditionTexts.minLevel, { nivel: requires.minHeroLevel }));
  }
  for (const needed of requires.classes) {
    sentences.push(
      fillText(expeditionTexts.needsClass, { classe: `um ${heroClasses[needed].label}` }),
    );
  }
  return sentences.join(' ');
}

/**
 * Os destinos que a Guilda conhece, na ordem do conteúdo; nenhum sem ela. A duração é a de quem
 * enviasse **agora** (o fator da estação é fixado no envio), e o primeiro trecho é o da variante
 * que sairia agora, que é uma conta e não um sorteio.
 */
function offersView(state: GameState, timeScale: number): ExpeditionOfferView[] {
  if (guildLevel(state) === 0) {
    return [];
  }
  const now = state.lastProcessedAt;
  const factor = durationFactorAt(now);
  const wait = durationText(rules.crossroadsWaitRealMs / SECOND_MS);
  const season = seasonAt(now);
  const shortened = factor.num !== factor.den;
  const views: ExpeditionOfferView[] = [];
  for (const model of expeditionModels) {
    const variant = model.variants[nextVariant(state, model)];
    // O destino que ainda não foi revelado, e o Resgate sem cativo, não saem do servidor.
    if (variant === undefined || !isKnownDestination(state, model)) {
      continue;
    }
    const hasCrossroads = Object.values(variant.nodes).some((node) => node.kind === 'crossroads');
    const notes: string[] = [];
    if (hasCrossroads) {
      notes.push(fillText(expeditionTexts.durationNote, { espera: wait }));
    }
    if (shortened) {
      notes.push(fillText(expeditionTexts.summer, { estacao: season.label }));
    }
    const blocked = destinationBlock(state, model.id);
    views.push({
      modelId: model.id,
      label: model.label,
      riskText: model.riskLabel,
      durationSeconds: realSecondsCeil(scaledDuration(model.durationMs, factor), timeScale),
      durationNote: notes.join(' '),
      requirementsText: requirementsText(model),
      teamMin: model.requires.teamMin,
      teamMax: model.requires.teamMax,
      teamMinLevel: model.requires.minHeroLevel,
      firstStretchDifficulty: firstStretchDifficulty(variant),
      locked: blocked !== null,
      lockedReason: blocked?.message ?? null,
      firstStretchText: firstStretchText(variant),
    });
  }
  return views;
}

function gainedText(gained: Record<ResourceId, number>): string {
  return describeLoss(gained);
}

/**
 * O percurso em frases, um passo por registro: o título do nó, a frase (a do desfecho, a do nó
 * sem prova, ou quem decidiu na encruzilhada) e o desfecho em palavra. A frase é a mesma da
 * Crônica, com a data do instante em que aconteceu. Um registro de um nó que o conteúdo já não
 * tem fica de fora.
 */
const itemLabel = (defId: string): string =>
  Object.hasOwn(itemDefs, defId) ? itemDefs[defId as keyof typeof itemDefs].label : 'um item';

/**
 * O que um passo fez à equipe e ao mundo, uma frase por fato, na ordem em que aconteceu: o
 * saque que a cobiça perdeu, quem sofreu, o que foi achado, o destino revelado, o tile limpo, o
 * cativo solto e quem subiu de nível. Só nomes e fatos: nenhum número de regra.
 */
function logNotes(state: GameState, entry: ExpeditionLogEntry): string[] {
  const notes: string[] = [];
  if (entry.lootLost) {
    notes.push(expeditionTexts.reportLootLost);
  }
  if (entry.harm !== null) {
    const template = {
      light: expeditionTexts.reportLight,
      severe: expeditionTexts.reportSevere,
      captured: expeditionTexts.reportCaptured,
      died: expeditionTexts.reportDied,
    }[entry.harm.kind];
    notes.push(fillText(template, { heroi: entry.harm.heroName }));
  }
  for (const defId of entry.found) {
    notes.push(fillText(expeditionTexts.reportFound, { item: itemLabel(defId) }));
  }
  if (entry.revealed !== null) {
    notes.push(
      fillText(expeditionTexts.reportRevealed, { destino: expeditionLabel(entry.revealed) }),
    );
  }
  if (entry.cleared !== null) {
    notes.push(
      fillText(expeditionTexts.reportCleared, {
        lugar: tileWithArticle(state, entry.cleared) ?? '',
      }),
    );
  }
  if (entry.rescued !== null) {
    notes.push(fillText(expeditionTexts.reportRescued, { heroi: entry.rescued }));
  }
  for (const { heroName, level } of entry.leveled) {
    notes.push(fillText(expeditionTexts.reportLeveled, { heroi: heroName, nivel: level }));
  }
  return notes;
}

function logView(
  state: GameState,
  source: Pick<Expedition, 'modelId' | 'variant' | 'posture'>,
  log: readonly ExpeditionLogEntry[],
): ExpeditionLogView[] {
  const variant = variantOf(source.modelId, source.variant);
  const posture = expeditionPostures[source.posture].label;
  const views: ExpeditionLogView[] = [];
  for (const entry of log) {
    const node = nodeIn(variant, entry.nodeId);
    if (node === null) {
      continue;
    }
    const outcomeLabel = expeditionOutcomes[entry.outcome].label;
    if (node.kind === 'crossroads') {
      const option = node.options.find((candidate) => candidate.id === entry.optionId);
      if (option === undefined) {
        continue;
      }
      const template =
        entry.decidedBy === 'player'
          ? expeditionTexts.decidedByPlayer
          : entry.decidedBy === 'posture'
            ? expeditionTexts.decidedByPosture
            : expeditionTexts.decidedByFallback;
      views.push({
        title: node.title,
        text: fillText(template, { opcao: option.label, postura: posture }),
        outcomeLabel,
        notes: [],
      });
      continue;
    }
    if (node.kind === 'return') {
      continue;
    }
    const template =
      node.trial === undefined || entry.outcome === 'passed' || entry.outcome === 'chosen'
        ? node.text
        : node.trial.outcomes[entry.outcome];
    const found = gainedText(entry.gained);
    views.push({
      title: node.title,
      text: `${narrate('expeditionNodeResolved', state, entry.atMs, {}, template)}${
        found === '' ? '' : ` ${fillText(expeditionTexts.loot, { saque: found })}`
      }`,
      outcomeLabel,
      notes: logNotes(state, entry),
    });
  }
  return views;
}

function crossroadsView(
  state: GameState,
  expedition: Expedition,
  timeScale: number,
): CrossroadsView | null {
  const node = nodeOf(expedition);
  if (expedition.crossroads === null || node?.kind !== 'crossroads') {
    return null;
  }
  const team = heroesOf(state, expedition.heroIds);
  const choice = postureChoice(team, node, expedition.posture);
  if (choice === null) {
    return null;
  }
  const postureLabel = expeditionPostures[expedition.posture].label;
  return {
    title: node.title,
    text: node.text,
    decidesInSeconds: realSecondsCeil(
      expedition.crossroads.decidesAtMs - state.lastProcessedAt,
      timeScale,
    ),
    postureLabel,
    postureOptionId: choice.option.id,
    postureOptionLabel: choice.option.label,
    postureText:
      choice.blocked === null
        ? fillText(expeditionTexts.postureDecides, {
            postura: postureLabel,
            opcao: choice.option.label,
          })
        : fillText(expeditionTexts.postureFallsBack, {
            postura: postureLabel,
            marcada: choice.blocked.label,
            opcao: choice.option.label,
          }),
    options: node.options.map((option) => {
      const lock = optionLock(team, option);
      return {
        id: option.id,
        label: option.label,
        hint: option.hint,
        locked: lock !== null,
        lockedReason: lock === null ? null : `${sentenceCase(lock)}.`,
      };
    }),
  };
}

function expeditionView(
  state: GameState,
  expedition: Expedition,
  timeScale: number,
): ExpeditionView {
  const node = nodeOf(expedition);
  const title = node?.title ?? '';
  const statusText =
    expedition.status === 'atCrossroads'
      ? expeditionTexts.waiting
      : expedition.status === 'returning'
        ? expeditionTexts.returning
        : fillText(expeditionTexts.traveling, { no: title });
  return {
    id: expedition.id,
    label: expeditionLabel(expedition.modelId),
    postureLabel: expeditionPostures[expedition.posture].label,
    teamNames: heroesOf(state, expedition.heroIds).map((hero) => hero.name),
    statusText,
    nodeTitle: title,
    nodeEndsInSeconds:
      expedition.nodeEndsAtMs === null
        ? null
        : realSecondsCeil(expedition.nodeEndsAtMs - state.lastProcessedAt, timeScale),
    log: logView(state, expedition, expedition.log),
    crossroads: crossroadsView(state, expedition, timeScale),
  };
}

/**
 * "Para o arsenal: Lança de caça." e, para o que não coube, "Sem lugar no arsenal, viraram ouro:
 * Arco de freixo."; `null` sem item. Os vendidos saem da lista dos guardados pela ordem.
 */
function itemsText(report: ExpeditionReport): string | null {
  const sold = [...report.sold];
  const kept: string[] = [];
  for (const item of report.loot.items) {
    const index = sold.indexOf(item.defId);
    if (index === -1) {
      kept.push(itemLabel(item.defId));
    } else {
      sold.splice(index, 1);
    }
  }
  const parts: string[] = [];
  if (kept.length > 0) {
    parts.push(fillText(expeditionTexts.lootItems, { itens: joinList(kept) }));
  }
  if (report.sold.length > 0) {
    parts.push(
      fillText(expeditionTexts.lootItemsSold, { itens: joinList(report.sold.map(itemLabel)) }),
    );
  }
  return parts.length === 0 ? null : parts.join(' ');
}

function reportView(state: GameState, report: ExpeditionReport): ExpeditionReportView {
  const { resources } = report.loot;
  const brought = describeLoss(resources);
  const lost = describeLoss(
    Object.fromEntries(
      Object.entries(report.wasted).map(([resource, milli]) => [resource, milli / MILLI]),
    ),
  );
  return {
    expeditionId: report.expeditionId,
    label: expeditionLabel(report.modelId),
    postureLabel: expeditionPostures[report.posture].label,
    teamNames: [...report.heroNames],
    log: logView(state, report, report.log),
    lootText: report.lost
      ? expeditionTexts.lootAllLost
      : brought === ''
        ? expeditionTexts.lootNone
        : lost === ''
          ? fillText(expeditionTexts.loot, { saque: brought })
          : fillText(expeditionTexts.lootCut, { saque: brought, perda: lost }),
    itemsText: itemsText(report),
    lost: report.lost,
  };
}

/** A frase do alto da aba com a Guilda de pé: quantas expedições ela sustenta e o que falta para enviar. */
export function guildReadyText(state: GameState): string {
  const slots = expeditionsText(expeditionSlots(state));
  if (state.guild.expeditions.length >= expeditionSlots(state)) {
    return fillText(expeditionTexts.full, { expedicoes: slots });
  }
  if (!state.guild.heroes.some(canDepart)) {
    return expeditionTexts.noneHome;
  }
  return fillText(expeditionTexts.ready, { expedicoes: slots });
}

/** O que a visão da Guilda ganha com as expedições, e as decisões que elas deixam à espera. */
export type ExpeditionsView = {
  building: BuildingId;
  built: boolean;
  level: number;
  slots: number;
  postures: PostureView[];
  available: ExpeditionOfferView[];
  expeditions: ExpeditionView[];
  reports: ExpeditionReportView[];
  pendingDecisions: PendingDecisionView[];
};

export function expeditionsView(state: GameState, timeScale: number): ExpeditionsView {
  const level = guildLevel(state);
  const expeditions = state.guild.expeditions.map((expedition) =>
    expeditionView(state, expedition, timeScale),
  );
  return {
    building: 'guild',
    built: level > 0,
    level,
    slots: expeditionSlots(state),
    postures: posturesView(),
    available: offersView(state, timeScale),
    expeditions,
    // Do mais novo ao mais antigo: é o último que o jogador quer ler primeiro.
    reports: [...state.guild.reports].reverse().map((report) => reportView(state, report)),
    pendingDecisions: expeditions.flatMap((expedition) =>
      expedition.crossroads === null
        ? []
        : [
            {
              kind: 'crossroads' as const,
              id: expedition.id,
              title: `${expedition.label}: ${expedition.crossroads.title}`,
              expiresInSeconds: expedition.crossroads.decidesInSeconds,
            },
          ],
    ),
  };
}
