import {
  balance,
  type ExpeditionModelDef,
  expeditionModels,
  type ExpeditionTrial,
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
  teamOutlook,
  teamSizeText,
  variantOf,
} from './expeditions';
import { lessonText, trialTemplate } from './expeditionReport';
import { durationText, fillText, joinList, sentenceCase } from './format';
import { canDepart, heroPowerRatio, powerWeights } from './heroes';
import { isMasterId, masterLabel } from './masters';
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
  Hero,
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

/**
 * A prova mais dura do primeiro trecho, até a primeira encruzilhada: a de maior dificuldade (no
 * empate, a primeira). `null` quando o trecho não tem prova.
 */
function firstStretchTrial(variant: ExpeditionVariant): ExpeditionTrial | null {
  let hardest: ExpeditionTrial | null = null;
  let nodeId = variant.start;
  for (let steps = 0; steps <= rules.graph.maxSteps; steps += 1) {
    const node = nodeIn(variant, nodeId);
    if (node === null || node.kind === 'crossroads' || node.kind === 'return') {
      break;
    }
    if (node.trial !== undefined && node.trial.difficulty > (hardest?.difficulty ?? 0)) {
      hardest = node.trial;
    }
    nodeId = node.next;
  }
  return hardest;
}

/**
 * O que a equipe precisa valer contra uma prova (ADR 0018, decisão 13), em poder inteiro:
 * `comfort` é o menor poder com que **nem a pior sorte** tira o Sucesso, e `risk`, o menor com
 * que a pior sorte ainda dá Revés (abaixo dele, pode dar Desastre). São a dificuldade vezes os
 * limiares do conteúdo, com a sorte no mínimo, arredondados para cima.
 */
function fitThresholds(difficulty: number): { comfort: number; risk: number } {
  const { luck, outcome } = rules;
  const needed = ({ num, den }: { num: number; den: number }) =>
    Math.ceil((difficulty * luck.base * num) / (luck.min * den));
  return { comfort: needed(outcome.success), risk: needed(outcome.setback) };
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
    const trial = firstStretchTrial(variant);
    const fit = trial === null ? null : fitThresholds(trial.difficulty);
    const weights = powerWeights(trial?.weights);
    // O poder de um herói contra a prova mais dura do primeiro trecho, em milésimos inteiros.
    const against = (hero: Hero): number => {
      const { num, den } = heroPowerRatio(hero, weights);
      return Math.floor(num / den);
    };
    const outlook = teamOutlook(state, model, against);
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
      firstStretchDifficulty: trial?.difficulty ?? null,
      fit:
        fit === null
          ? null
          : {
              comfortPower: fit.comfort,
              riskPower: fit.risk,
              text: fillText(expeditionTexts.fit, { folga: fit.comfort, risco: fit.risk }),
            },
      // O poder de cada herói que pode partir **contra a prova mais dura do primeiro trecho**,
      // com os pesos dela; sem prova à vista, o poder da ficha. A Postura fica de fora: o traço
      // que rende mais em uma delas só entra depois do envio.
      heroFit: state.guild.heroes
        .filter(canDepart)
        .map((hero) => ({ heroId: hero.id, power: against(hero) / MILLI })),
      locked: blocked !== null,
      lockedReason: blocked?.message ?? null,
      eligibleHeroIds: outlook.eligible.map((hero) => hero.id),
      canSend: blocked === null && outlook.shortfall === null,
      suggestedTeam:
        blocked === null && outlook.shortfall === null
          ? outlook.suggested.map((hero) => hero.id)
          : [],
      sendBlockedReason:
        blocked !== null
          ? blocked.message
          : outlook.shortfall === null
            ? null
            : fillText(expeditionTexts.noTeam, { motivo: outlook.shortfall }),
      firstStretchText: firstStretchText(variant),
      rescue: model.access.kind === 'captive',
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
  if (entry.master !== null && isMasterId(entry.master)) {
    notes.push(fillText(expeditionTexts.reportMaster, { mestre: masterLabel(entry.master) }));
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
        outcome: entry.outcome,
        outcomeLabel,
        notes: [],
        standoutName: null,
        lessonText: null,
      });
      continue;
    }
    if (node.kind === 'return') {
      continue;
    }
    const { trial } = node;
    const outcome = entry.outcome === 'passed' || entry.outcome === 'chosen' ? null : entry.outcome;
    // A mesma frase da Crônica: a do desfecho, com quem se destacou e, no desfecho ruim, a lição.
    const template =
      trial === undefined || outcome === null
        ? node.text
        : trialTemplate(trial, outcome, entry.lesson);
    const found = gainedText(entry.gained);
    views.push({
      title: node.title,
      text: `${narrate(
        'expeditionNodeResolved',
        state,
        entry.atMs,
        { heroi: entry.standout ?? expeditionTexts.theTeam },
        template,
      )}${found === '' ? '' : ` ${fillText(expeditionTexts.loot, { saque: found })}`}`,
      outcome: entry.outcome,
      outcomeLabel,
      notes: logNotes(state, entry),
      standoutName: entry.standout,
      lessonText:
        trial !== undefined && entry.lesson !== null ? lessonText(entry.lesson, trial) : null,
    });
  }
  return views;
}

/**
 * O caminho de volta, como o último passo do relatório de quem voltou: a frase do nó de retorno
 * do grafo, com a data da chegada. `null` quando o conteúdo já não tem o grafo.
 */
function returnStep(state: GameState, report: ExpeditionReport): ExpeditionLogView | null {
  const variant = variantOf(report.modelId, report.variant);
  const node = Object.values(variant?.nodes ?? {}).find((entry) => entry.kind === 'return');
  if (node === undefined || node.kind !== 'return') {
    return null;
  }
  return {
    title: node.title,
    text: narrate('expeditionReturned', state, report.returnedAtMs, {}, node.text),
    outcome: 'passed',
    outcomeLabel: expeditionOutcomes.passed.label,
    notes: [],
    standoutName: null,
    lessonText: null,
  };
}

/**
 * O que a jornada custou, em uma frase: quem se feriu, quem ficou em cativeiro, quem não voltou
 * e o saque que se perdeu no caminho. "Sem perdas…" quando nada disso aconteceu.
 */
function lossesText(report: ExpeditionReport): string {
  const losses: string[] = [];
  for (const { harm } of report.log) {
    if (harm !== null) {
      const template = {
        light: expeditionTexts.lossLight,
        severe: expeditionTexts.lossSevere,
        captured: expeditionTexts.lossCaptured,
        died: expeditionTexts.lossDied,
      }[harm.kind];
      losses.push(fillText(template, { heroi: harm.heroName }));
    }
  }
  if (report.log.some((entry) => entry.lootLost)) {
    losses.push(expeditionTexts.lossLoot);
  }
  // Cada perda já tem vírgula dentro ("Rolf, com um ferimento leve"): entre elas, ponto e vírgula.
  return losses.length === 0
    ? expeditionTexts.lossesNone
    : fillText(expeditionTexts.losses, { perdas: losses.join('; ') });
}

/**
 * O que a jornada deixou além do saque, uma frase por fato, na ordem em que aconteceu: o caminho
 * novo, o tile limpo, o cativo solto e quem subiu de nível. `null` sem nenhum.
 */
function deedsText(state: GameState, report: ExpeditionReport): string | null {
  const deeds: string[] = [];
  for (const entry of report.log) {
    if (entry.revealed !== null) {
      deeds.push(
        fillText(expeditionTexts.reportRevealed, { destino: expeditionLabel(entry.revealed) }),
      );
    }
    if (entry.cleared !== null) {
      deeds.push(
        fillText(expeditionTexts.reportCleared, {
          lugar: tileWithArticle(state, entry.cleared) ?? '',
        }),
      );
    }
    if (entry.rescued !== null) {
      deeds.push(fillText(expeditionTexts.reportRescued, { heroi: entry.rescued }));
    }
    if (entry.master !== null && isMasterId(entry.master)) {
      deeds.push(fillText(expeditionTexts.reportMaster, { mestre: masterLabel(entry.master) }));
    }
    for (const { heroName, level } of entry.leveled) {
      deeds.push(fillText(expeditionTexts.reportLeveled, { heroi: heroName, nivel: level }));
    }
  }
  return deeds.length === 0 ? null : deeds.join(' ');
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
    log: [
      ...logView(state, report, report.log),
      ...(report.lost ? [] : [returnStep(state, report)].filter((step) => step !== null)),
    ],
    lossesText: lossesText(report),
    deedsText: deedsText(state, report),
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
