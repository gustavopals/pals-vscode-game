import { expeditionPostures } from '@lotg/content';

import { emit } from './chronicle';
import { lowerFirst } from './council';
import {
  destinationBlock,
  durationFactorAt,
  enterNode,
  expeditionLabel,
  heroesOf,
  isPosture,
  logEntry,
  modelOf,
  nextVariant,
  nodeOf,
  optionLock,
  teamBlock,
  teamNames,
  timesSent,
} from './expeditions';
import { nextId } from './ids';
import { reject } from './rejections';
import type { Expedition, GameEvent, GameState, Rejection } from './types';

/**
 * As ordens das expedições (GDD §9.2; ADR 0018, decisão 11): enviar uma equipe e escolher o
 * caminho em uma encruzilhada. **Nenhuma sorteia**: a variante do grafo sai de uma conta sobre a
 * semente, e o primeiro sorteio de uma expedição é o do fim de um nó, em `expeditionTurn.ts`.
 * Enviar cria uma entidade, com `nextId(draft, 'expedition')`.
 */

/**
 * A ordem de enviar (`sendExpedition`). As recusas, na ordem: sem a Guilda (`GUILD_REQUIRED`);
 * todos os lugares ocupados (`EXPEDITION_LIMIT`); o destino fora do alcance
 * (`EXPEDITION_LOCKED`); um herói que já não serve ao feudo (`HERO_NOT_FOUND`) ou que está fora
 * (`HERO_UNAVAILABLE`); e a equipe ou a Postura que não servem (`TEAM_INVALID`).
 *
 * Aceita, fixa a variante do grafo (uma conta, sem sorteio) e o fator de duração da estação
 * deste instante, que vale para todos os nós (o que a tela mostrava antes do envio é o que
 * vale), tira os heróis do feudo e põe a equipe no primeiro nó. O evento não leva a variante:
 * o servidor entrega `data` inteiro a quem joga.
 */
export function sendExpedition(
  draft: GameState,
  modelId: unknown,
  heroIds: unknown,
  posture: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const blocked = destinationBlock(draft, modelId);
  if (blocked !== null) {
    return blocked;
  }
  const model = modelOf(modelId);
  if (model === null) {
    return reject('EXPEDITION_LOCKED');
  }
  const unfit = teamBlock(draft, model, heroIds);
  if (unfit !== null) {
    return unfit;
  }
  if (!isPosture(posture)) {
    return reject('TEAM_INVALID', { label: model.label, remedy: 'escolha a Postura da equipe' });
  }
  const team = heroesOf(draft, heroIds as string[]);
  const variant = nextVariant(draft, model);
  const start = model.variants[variant]?.start ?? '';
  const sentKey = `expeditionsSent:${model.id}`;
  draft.stats[sentKey] = timesSent(draft, model.id) + 1;
  draft.stats.expeditionsSent = (draft.stats.expeditionsSent ?? 0) + 1;
  const expedition: Expedition = {
    id: nextId(draft, 'expedition'),
    modelId: model.id,
    variant,
    heroIds: team.map((hero) => hero.id),
    posture,
    sentAtMs: nowMs,
    durationFactor: durationFactorAt(nowMs),
    status: 'traveling',
    nodeId: start,
    nodeEndsAtMs: null,
    crossroads: null,
    loot: { resources: { food: 0, wood: 0, stone: 0, gold: 0 }, items: [] },
    log: [],
  };
  for (const hero of team) {
    hero.status = 'expedition';
  }
  draft.guild.expeditions.push(expedition);
  emit(
    events,
    draft,
    nowMs,
    'expeditionSent',
    {
      expeditionId: expedition.id,
      modelId: model.id,
      posture,
      heroes: team.length,
      heroIds: expedition.heroIds.join(','),
    },
    { expedicao: model.label, herois: teamNames(team) },
  );
  enterNode(draft, expedition, start, nowMs, events);
  return null;
}

/**
 * A ordem de escolher o caminho (`chooseExpeditionPath`). As recusas, na ordem: a expedição não
 * está em uma encruzilhada (`CROSSROADS_DECIDED` quando ela, ou o relatório dela, já tem uma
 * escolha registrada, isto é, o prazo venceu ou outra aba respondeu; `EXPEDITION_NOT_WAITING`
 * no resto); a encruzilhada não tem a opção (`INVALID_OPTION`); a equipe não pode tomá-la
 * (`OPTION_LOCKED`, com o que falta).
 *
 * **O prazo resolve antes de um comando no mesmo instante**: `advanceTo` já processou o prazo
 * deste instante quando a ordem chega aqui, e ela encontra a expedição a caminho.
 */
export function chooseExpeditionPath(
  draft: GameState,
  expeditionId: unknown,
  optionId: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const { guild } = draft;
  const expedition = guild.expeditions.find((entry) => entry.id === expeditionId);
  const node = expedition === undefined ? null : nodeOf(expedition);
  if (
    expedition === undefined ||
    expedition.status !== 'atCrossroads' ||
    node?.kind !== 'crossroads'
  ) {
    const log =
      expedition?.log ?? guild.reports.find((entry) => entry.expeditionId === expeditionId)?.log;
    return reject(
      log?.some((entry) => entry.outcome === 'chosen') === true
        ? 'CROSSROADS_DECIDED'
        : 'EXPEDITION_NOT_WAITING',
    );
  }
  const option = node.options.find((entry) => entry.id === optionId);
  if (option === undefined) {
    return reject('INVALID_OPTION', { label: node.title, crossroads: true });
  }
  const lock = optionLock(heroesOf(draft, expedition.heroIds), option);
  if (lock !== null) {
    return reject('OPTION_LOCKED', { remedy: lock, crossroads: true });
  }
  expedition.log.push({
    ...logEntry(expedition.nodeId, nowMs, 'chosen'),
    optionId: option.id,
    decidedBy: 'player',
  });
  draft.stats.crossroadsChosen = (draft.stats.crossroadsChosen ?? 0) + 1;
  emit(
    events,
    draft,
    nowMs,
    'expeditionPathChosen',
    {
      expeditionId: expedition.id,
      modelId: expedition.modelId,
      optionId: option.id,
      decidedBy: 'player',
      posture: expedition.posture,
    },
    {
      expedicao: expeditionLabel(expedition.modelId),
      opcao: lowerFirst(option.label),
      postura: expeditionPostures[expedition.posture].label.toLowerCase(),
    },
  );
  enterNode(draft, expedition, option.next, nowMs, events);
  return null;
}
