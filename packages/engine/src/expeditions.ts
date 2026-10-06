import {
  balance,
  buildings,
  type ExpeditionCrossroadsNode,
  type ExpeditionModelDef,
  expeditionModels,
  type ExpeditionNode,
  type ExpeditionOption,
  type ExpeditionOutcomeId,
  type ExpeditionTrial,
  expeditionTexts,
  type ExpeditionVariant,
  heroClasses,
  heroTraits,
  POSTURE_IDS,
  type PostureId,
  type Ratio,
} from '@lotg/content';

import { emit } from './chronicle';
import { seasonAt } from './clock';
import { buildingWithArticle } from './construction';
import { fillText, joinList, plural } from './format';
import { canDepart, captives, teamPower } from './heroes';
import { hashText } from './hash';
import { reject } from './rejections';
import { tileWithArticle } from './outcomes';
import type {
  Expedition,
  ExpeditionLogEntry,
  GameEvent,
  GameState,
  Hero,
  Rejection,
} from './types';
import { MILLI, realToGameMs } from './units';

/**
 * As expedições (GDD §9.2; ADR 0017, decisões 1, 7 e 9; ADR 0018, decisões 11 a 13): as contas,
 * sem sorteio e sem dar identificador. Quem anda os nós, sorteia e devolve a equipe, em
 * instantes da linha do tempo, é `expeditionTurn.ts`; quem cumpre as ordens,
 * `expeditionOrders.ts`; quem mostra, `expeditionsView.ts`. Este módulo serve aos três e à linha
 * do tempo. A variante do grafo sai de `hashText` (`hash.ts`), que é uma conta sobre um texto e
 * não toca fluxo nenhum.
 */

const { expeditions: rules } = balance;

export function isPosture(value: unknown): value is PostureId {
  return (POSTURE_IDS as readonly unknown[]).includes(value);
}

/** O nível da Guilda dos Aventureiros; zero enquanto ela não foi erguida. */
export function guildLevel(state: GameState): number {
  return state.settlement.buildings.guild;
}

/**
 * Quantas expedições a Guilda de um nível sustenta ao mesmo tempo (`slotsByGuildLevel`). Um
 * nível além da lista vale o último número dela. Zero sem a Guilda.
 */
export function slotsAtLevel(level: number): number {
  if (level <= 0) {
    return 0;
  }
  const { slotsByGuildLevel } = rules;
  return slotsByGuildLevel[Math.min(level, slotsByGuildLevel.length) - 1] ?? 0;
}

export function expeditionSlots(state: GameState): number {
  return slotsAtLevel(guildLevel(state));
}

/** "1 expedição", "2 expedições". */
export function expeditionsText(count: number): string {
  return plural(count, 'expedição', 'expedições');
}

/** O modelo do conteúdo; `null` para um identificador que o conteúdo não tem (ou já não tem). */
export function modelOf(modelId: unknown): ExpeditionModelDef | null {
  return expeditionModels.find((entry) => entry.id === modelId) ?? null;
}

/** O grafo de uma variante de um modelo; `null` quando o conteúdo já não o tem. */
export function variantOf(modelId: string, variant: number): ExpeditionVariant | null {
  return modelOf(modelId)?.variants[variant] ?? null;
}

/** Um nó de um grafo, pela chave; `null` quando o conteúdo já não o tem. */
export function nodeIn(variant: ExpeditionVariant | null, nodeId: string): ExpeditionNode | null {
  return variant !== null && Object.hasOwn(variant.nodes, nodeId)
    ? (variant.nodes[nodeId] ?? null)
    : null;
}

/** O nó em que uma expedição está. */
export function nodeOf(expedition: Expedition): ExpeditionNode | null {
  return nodeIn(variantOf(expedition.modelId, expedition.variant), expedition.nodeId);
}

/** Quantas vezes o feudo já enviou um modelo: é o que faz as variantes se revezarem. */
export function timesSent(state: GameState, modelId: string): number {
  return state.stats[`expeditionsSent:${modelId}`] ?? 0;
}

/**
 * A variante do grafo de quem enviasse o modelo agora (ADR 0017, decisão 9): uma conta sobre a
 * semente, o modelo e quantas vezes ele já foi enviado, **sem sorteio**. Cada partida começa em
 * uma variante própria e passa por todas antes de repetir.
 */
export function nextVariant(state: GameState, model: ExpeditionModelDef): number {
  const count = model.variants.length;
  return (
    ((hashText(`${state.seed}:${model.id}`) % count) + (timesSent(state, model.id) % count)) % count
  );
}

/** O fator de duração de uma expedição enviada em `atMs`: o da estação (o verão encurta). */
export function durationFactorAt(atMs: number): Ratio {
  const { num, den } = seasonAt(atMs).effects.expeditionDuration;
  return { num, den };
}

/** A duração de um nó com o fator fixado no envio, em ms de jogo: arredondada para baixo, nunca zero. */
export function scaledDuration(durationMs: number, factor: Ratio): number {
  return Math.max(1, Math.floor((durationMs * factor.num) / factor.den));
}

/** Os heróis de uma equipe, na ordem dos identificadores dados; quem já não serve ao feudo fica de fora. */
export function heroesOf(state: GameState, heroIds: readonly string[]): Hero[] {
  const team: Hero[] = [];
  for (const heroId of heroIds) {
    const hero = state.guild.heroes.find((entry) => entry.id === heroId);
    if (hero !== undefined) {
      team.push(hero);
    }
  }
  return team;
}

/**
 * Um registro do percurso sem nada além do nó, do instante e do desfecho: quem o escreve põe
 * por cima o que aconteceu (`gained`, `harm`, a opção de uma escolha…).
 */
export function logEntry(
  nodeId: string,
  atMs: number,
  outcome: ExpeditionLogEntry['outcome'],
): ExpeditionLogEntry {
  return {
    nodeId,
    atMs,
    outcome,
    optionId: null,
    decidedBy: null,
    gained: { food: 0, wood: 0, stone: 0, gold: 0 },
    xp: 0,
    harm: null,
    leveled: [],
    found: [],
    revealed: null,
    cleared: null,
    rescued: null,
    lootLost: false,
    standout: null,
    lesson: null,
  };
}

/**
 * Por que o destino não está aberto pelo que o mundo diz dele, sem ponto, ou `null` quando
 * está (ADR 0018, decisão 12): o que aparece por descoberta e ainda não foi revelado, o Resgate
 * sem ninguém em cativeiro ou com tantos Resgates em curso quantos são os cativos, e o tile de
 * ameaça que está limpo ou que já tem uma equipe a caminho (revisão da Fase D, M-R4).
 */
export function accessLock(state: GameState, model: ExpeditionModelDef): string | null {
  const { access } = model;
  if (access.kind === 'discovered') {
    return state.map.discovered.includes(model.id) ? null : expeditionTexts.lockedUnknown;
  }
  if (access.kind === 'captive') {
    const held = captives(state).length;
    if (held === 0) {
      return expeditionTexts.lockedNoCaptive;
    }
    // Um Resgate solta um cativo: a equipe a mais arriscaria a pele para voltar sem ninguém.
    return rescuesUnderWay(state) >= held ? expeditionTexts.lockedRescueUnderWay : null;
  }
  if (access.kind === 'tile') {
    const lugar = tileWithArticle(state, access.tileId) ?? 'o lugar';
    if (state.map.tiles[access.tileId]?.threatActive !== true) {
      return fillText(expeditionTexts.lockedCleared, { lugar });
    }
    // O tile só se limpa uma vez por ano: a segunda equipe arriscaria por nada.
    const { tileId } = access;
    const underWay = state.guild.expeditions.some((expedition) => {
      const other = modelOf(expedition.modelId)?.access;
      return other?.kind === 'tile' && other.tileId === tileId;
    });
    return underWay ? fillText(expeditionTexts.lockedTileUnderWay, { lugar }) : null;
  }
  return null;
}

/** Quantos Resgates estão em curso: as expedições de um modelo que só existe com um cativo. */
export function rescuesUnderWay(state: GameState): number {
  return state.guild.expeditions.filter(
    (expedition) => modelOf(expedition.modelId)?.access.kind === 'captive',
  ).length;
}

/**
 * O destino aparece na lista da Guilda: os abertos e os de tile, sempre; os de descoberta, depois
 * de revelados; o Resgate, enquanto houver um cativo. **O que não aparece não sai do servidor.**
 */
export function isKnownDestination(state: GameState, model: ExpeditionModelDef): boolean {
  if (model.access.kind === 'tile') {
    return true;
  }
  if (model.access.kind === 'captive') {
    return captives(state).length > 0;
  }
  return accessLock(state, model) === null;
}

/** "Edda", "Edda e Rolf". */
export function teamNames(team: ReadonlyArray<{ name: string }>): string {
  return joinList(team.map((hero) => hero.name));
}

/**
 * O desfecho de um nó (ADR 0017, decisão 7), por multiplicação cruzada, sem divisão: compara
 * `poder × sorte` com a dificuldade vezes o limiar de cada desfecho, do melhor ao pior. `power`
 * vem em milésimos; `luck` é o inteiro sorteado, com `rules.luck.base` como valor neutro.
 */
export function outcomeOf(power: number, luck: number, difficulty: number): ExpeditionOutcomeId {
  const reaches = ({ num, den }: Ratio) =>
    power * luck * den >= difficulty * MILLI * rules.luck.base * num;
  if (reaches(rules.outcome.full)) {
    return 'full';
  }
  if (reaches(rules.outcome.success)) {
    return 'success';
  }
  return reaches(rules.outcome.setback) ? 'setback' : 'disaster';
}

/** O poder de uma equipe contra a prova de um nó, em milésimos (`teamPower`). */
export function powerAgainst(
  team: readonly Hero[],
  trial: ExpeditionTrial,
  posture: PostureId,
): number {
  return teamPower(team, trial.weights, posture);
}

/**
 * Por que a equipe não pode tomar uma opção de encruzilhada, sem ponto ("requer um Guerreiro na
 * equipe", "requer na equipe alguém com o traço Rastreador"), ou `null` quando pode.
 */
export function optionLock(team: readonly Hero[], option: ExpeditionOption): string | null {
  const { requires } = option;
  if (requires === undefined) {
    return null;
  }
  if ('trait' in requires) {
    const { trait } = requires;
    return team.some((hero) => hero.traits.includes(trait))
      ? null
      : fillText(expeditionTexts.optionNeedsTrait, { traco: heroTraits[trait].label });
  }
  const needed = requires.heroClass;
  return team.some((hero) => hero.classId === needed)
    ? null
    : fillText(expeditionTexts.optionNeedsClass, { classe: `um ${heroClasses[needed].label}` });
}

/** O que a Postura faz em uma encruzilhada: a opção que vale, a marcada e se valeu a reserva. */
export type PostureChoice = {
  option: ExpeditionOption;
  /** A opção marcada para a Postura, quando ela está fora do alcance da equipe; `null` no resto. */
  blocked: ExpeditionOption | null;
};

/**
 * A opção que a Postura toma no fim do prazo (ADR 0018, decisão 11): a marcada na encruzilhada;
 * se ela está fora do alcance da equipe, a da Cautelosa, que não tem requisito. `null` só para
 * uma encruzilhada sem a opção marcada, o que o teste de conteúdo não deixa existir.
 */
export function postureChoice(
  team: readonly Hero[],
  node: ExpeditionCrossroadsNode,
  posture: PostureId,
): PostureChoice | null {
  const find = (id: string) => node.options.find((entry) => entry.id === id);
  const marked = find(node.posture[posture]);
  const safe = find(node.posture.cautious);
  if (marked !== undefined && optionLock(team, marked) === null) {
    return { option: marked, blocked: null };
  }
  if (safe !== undefined) {
    return { option: safe, blocked: marked !== undefined && marked !== safe ? marked : null };
  }
  return marked === undefined ? null : { option: marked, blocked: null };
}

/**
 * "Erga a Guilda dos Aventureiros primeiro: ela abre com o Salão do Senhor Nv3.", ou só "Erga a
 * Guilda dos Aventureiros primeiro." quando o Salão já chegou lá.
 */
export function guildRequired(state: GameState): Rejection {
  const level = buildings.guild.requires.townHall;
  return reject('GUILD_REQUIRED', {
    label: buildingWithArticle('guild'),
    ...(level === undefined || state.settlement.buildings.townHall >= level
      ? {}
      : { remedy: `ela abre com ${buildingWithArticle('townHall')} Nv${level}` }),
  });
}

/**
 * Por que **nenhuma** equipe poderia partir para um destino agora, ou `null` quando alguma pode:
 * sem a Guilda, com todos os lugares ocupados, ou com o destino fora do alcance (o conteúdo não
 * o tem, ele pede um nível maior da Guilda, ainda não foi revelado, não há cativo a resgatar,
 * ou o tile dele está limpo). É a primeira parte das recusas de
 * `sendExpedition`, na ordem, e é o que a visão mostra em cada destino.
 */
export function destinationBlock(state: GameState, modelId: unknown): Rejection | null {
  const level = guildLevel(state);
  if (level === 0) {
    return guildRequired(state);
  }
  const slots = expeditionSlots(state);
  if (state.guild.expeditions.length >= slots) {
    const canGrow = slotsAtLevel(buildings.guild.maxLevel) > slots;
    return reject('EXPEDITION_LIMIT', {
      label: `${buildings.guild.label} Nv${level}`,
      count: slots,
      remedy: canGrow
        ? `espere uma equipe voltar ou melhore ${buildingWithArticle('guild')}`
        : 'espere uma equipe voltar',
    });
  }
  const model = modelOf(modelId);
  if (model === null) {
    return reject('EXPEDITION_LOCKED');
  }
  if (level < model.requires.guildLevel) {
    return reject('EXPEDITION_LOCKED', {
      remedy: `pede ${buildingWithArticle('guild')} no nível ${model.requires.guildLevel}`,
    });
  }
  const lock = accessLock(state, model);
  return lock === null ? null : reject('EXPEDITION_LOCKED', { remedy: lock });
}

/** "1 herói", "de 1 a 2 heróis". */
export function teamSizeText({ teamMin, teamMax }: ExpeditionModelDef['requires']): string {
  return teamMin === teamMax
    ? plural(teamMin, 'herói', 'heróis')
    : `de ${teamMin} a ${plural(teamMax, 'herói', 'heróis')}`;
}

/**
 * Por que esta equipe não serve para o destino, ou `null` quando serve: um herói que já não
 * serve ao feudo (`HERO_NOT_FOUND`), um que não pode partir (`HERO_UNAVAILABLE`, com o nome e o
 * motivo: está em expedição, em cativeiro, ou ainda se recupera de um ferimento) e, por último, o que o modelo pede e a equipe não tem (`TEAM_INVALID`: o tamanho, o
 * nível ou a classe, dizendo o que falta).
 */
export function teamBlock(
  state: GameState,
  model: ExpeditionModelDef,
  heroIds: unknown,
): Rejection | null {
  const ids = Array.isArray(heroIds) ? (heroIds as unknown[]) : [];
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    return reject('TEAM_INVALID', { label: model.label });
  }
  const team: Hero[] = [];
  for (const heroId of ids) {
    const hero = state.guild.heroes.find((entry) => entry.id === heroId);
    if (hero === undefined) {
      return reject('HERO_NOT_FOUND');
    }
    if (!canDepart(hero)) {
      return reject('HERO_UNAVAILABLE', {
        label: hero.name,
        remedy:
          hero.status === 'injured'
            ? expeditionTexts.heroInjured
            : hero.status === 'captured'
              ? expeditionTexts.heroCaptured
              : expeditionTexts.heroAway,
      });
    }
    team.push(hero);
  }
  const shortfall = teamShortfall(model, team);
  return shortfall === null
    ? null
    : reject('TEAM_INVALID', { label: model.label, remedy: shortfall });
}

/**
 * O que falta a uma equipe para o que o modelo pede, sem ponto ("a jornada pede 2 heróis",
 * "Rolf ainda não chegou ao nível 3", "falta um Mago"), ou `null` quando ela serve: o tamanho,
 * depois o nível, depois a classe. **É a fonte única**: a recusa da ordem (`teamBlock`) e o que
 * a visão diz de cada destino (`teamOutlook`) saem daqui.
 */
export function teamShortfall(model: ExpeditionModelDef, team: readonly Hero[]): string | null {
  const { requires } = model;
  if (team.length < requires.teamMin || team.length > requires.teamMax) {
    return fillText(expeditionTexts.shortSize, { equipe: teamSizeText(requires) });
  }
  const green = team.find((hero) => hero.level < requires.minHeroLevel);
  if (green !== undefined) {
    return fillText(expeditionTexts.shortLevel, {
      heroi: green.name,
      nivel: requires.minHeroLevel,
    });
  }
  const missing = requires.classes.find((needed) => !team.some((hero) => hero.classId === needed));
  if (missing !== undefined) {
    return fillText(expeditionTexts.shortClass, { classe: `um ${heroClasses[missing].label}` });
  }
  return null;
}

/** Quem pode ir a um destino, a equipe que o motor montaria e, sem equipe possível, o que falta. */
export type TeamOutlook = {
  /** Quem pode ir, na ordem da lista do feudo: está pronto e tem o nível que o modelo pede. */
  eligible: Hero[];
  /** A menor equipe que serve, com os mais fortes contra o primeiro trecho; vazia sem nenhuma. */
  suggested: Hero[];
  /** O que falta para haver uma equipe, sem ponto; `null` quando há. */
  shortfall: string | null;
};

/**
 * A equipe que o feudo pode mandar a um destino **agora**, pelo que o modelo pede (o tamanho, o
 * nível e a classe; o destino fechado é conta de `destinationBlock`).
 *
 * - **Quem pode ir**: quem está pronto (`canDepart`) e tem o nível do modelo.
 * - **A equipe sugerida** é a menor que serve: um herói de cada classe exigida (o de maior
 *   `power`; no empate, o que chegou antes) e, até o tamanho mínimo, os de maior `power` que
 *   sobram. Se alguma equipe serve, esta serve: as classes exigidas são distintas, e o resto do
 *   modelo só pede gente.
 * - **O que falta** vem de `teamShortfall`, a mesma conta da recusa da ordem, sobre essa equipe;
 *   quando falta gente, a frase diz quantos podem partir.
 *
 * `power` é o poder de cada herói contra a prova mais dura do primeiro trecho (o que a visão
 * mostra em `heroFit`). Não sorteia e não muda nada.
 */
export function teamOutlook(
  state: GameState,
  model: ExpeditionModelDef,
  power: (hero: Hero) => number,
): TeamOutlook {
  const { requires } = model;
  const eligible = state.guild.heroes.filter(
    (hero) => canDepart(hero) && hero.level >= requires.minHeroLevel,
  );
  // Do mais forte ao mais fraco; a ordenação é estável, e o empate fica na ordem de chegada.
  const ranked = [...eligible].sort((a, b) => power(b) - power(a));
  const picked: Hero[] = [];
  for (const needed of requires.classes) {
    const found = ranked.find((hero) => hero.classId === needed && !picked.includes(hero));
    if (found !== undefined) {
      picked.push(found);
    }
  }
  for (const hero of ranked) {
    if (picked.length >= requires.teamMin) {
      break;
    }
    if (!picked.includes(hero)) {
      picked.push(hero);
    }
  }
  // Na ordem da lista do feudo: é a ordem em que a ordem de envio os receberia da tela.
  const suggested = eligible.filter((hero) => picked.includes(hero));
  const shortfall = teamShortfall(model, suggested);
  if (shortfall === null) {
    return { eligible, suggested, shortfall: null };
  }
  const short = eligible.length < requires.teamMin;
  return {
    eligible,
    suggested: [],
    shortfall: short
      ? fillText(
          eligible.length === 0 ? expeditionTexts.shortNobody : expeditionTexts.shortPeople,
          {
            pedido: `${teamSizeText(requires)}${
              requires.minHeroLevel > 1
                ? fillText(expeditionTexts.shortAtLevel, { nivel: requires.minHeroLevel })
                : ''
            }`,
            prontos: plural(eligible.length, 'pode', 'podem'),
          },
        )
      : shortfall,
  };
}

/**
 * Instante, em ms de jogo, do próximo evento de expedição: o fim do nó em que alguma está ou o
 * prazo de uma encruzilhada. `null` sem expedição em curso.
 */
export function nextExpeditionEventAt(state: GameState): number | null {
  let next: number | null = null;
  for (const expedition of state.guild.expeditions) {
    const at = expedition.crossroads?.decidesAtMs ?? expedition.nodeEndsAtMs;
    if (at !== null && (next === null || at < next)) {
      next = at;
    }
  }
  return next;
}

/** O nome do destino de uma expedição; o do conteúdo, ou um nome neutro para o modelo que ele já não tem. */
export function expeditionLabel(modelId: string): string {
  return modelOf(modelId)?.label ?? 'Expedição';
}

/**
 * A equipe chega a um nó em `atMs`. Em um nó comum ou no retorno, marca o fim dele com a duração
 * do conteúdo vezes o fator fixado no envio. Em uma encruzilhada, para: grava o prazo de decisão
 * (o tempo real do conteúdo convertido **agora**, com o ritmo da partida; ADR 0017, decisão 1) e
 * avisa na Crônica. Não sorteia nada: chegar a um nó não é resolvê-lo.
 *
 * Um nó que o conteúdo já não tem (o grafo mudou com a expedição em curso) manda a equipe para
 * casa: ela volta no instante seguinte, com o que já juntou.
 */
export function enterNode(
  draft: GameState,
  expedition: Expedition,
  nodeId: string,
  atMs: number,
  events: GameEvent[],
): void {
  expedition.nodeId = nodeId;
  const node = nodeOf(expedition);
  if (node === null) {
    expedition.status = 'returning';
    expedition.nodeEndsAtMs = atMs + 1;
    expedition.crossroads = null;
    return;
  }
  if (node.kind === 'crossroads') {
    expedition.status = 'atCrossroads';
    expedition.nodeEndsAtMs = null;
    expedition.crossroads = {
      decidesAtMs: atMs + realToGameMs(rules.crossroadsWaitRealMs, draft.settings.timeScale),
    };
    emit(
      events,
      draft,
      atMs,
      'expeditionAtCrossroads',
      { expeditionId: expedition.id, modelId: expedition.modelId },
      { expedicao: expeditionLabel(expedition.modelId), no: node.title },
    );
    return;
  }
  expedition.status = node.kind === 'return' ? 'returning' : 'traveling';
  expedition.nodeEndsAtMs = atMs + scaledDuration(node.durationMs, expedition.durationFactor);
  expedition.crossroads = null;
}
