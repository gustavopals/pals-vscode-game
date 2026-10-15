import {
  balance,
  type ExpeditionOutcomeId,
  expeditionOutcomes,
  expeditionPostures,
  type ExpeditionStageNode,
  expeditionTemplates,
  heroTraits,
  type Ratio,
  RESOURCE_IDS,
  type ResourceId,
} from '@lotg/content';

import { emit } from './chronicle';
import { lowerFirst } from './council';
import { stowItem } from './equipment';
import {
  enterNode,
  expeditionLabel,
  heroesOf,
  logEntry,
  modelOf,
  nodeOf,
  outcomeOf,
  postureChoice,
  powerAgainst,
  teamNames,
} from './expeditions';
import { lessonOf, standoutOf, trialTemplate } from './expeditionReport';
import { joinList } from './format';
import { itemDefOf } from './heroes';
import { nextId } from './ids';
import { deliverMaster, masterCanArrive } from './masterTurn';
import {
  applyHarm,
  clearTile,
  grantXp,
  type Harm,
  harmCandidates,
  harmOf,
  rescueCaptive,
  revealDestination,
} from './outcomes';
import { chance, dropStream, entityStream, nextInt, pickWeighted, type RngStream } from './random';
import { describeLoss, storeResource } from './storage';
import type {
  Expedition,
  ExpeditionLogEntry,
  ExpeditionReport,
  GameEvent,
  GameState,
  Hero,
  Item,
} from './types';
import { MILLI } from './units';
import { chargeReturned } from './wages';

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
 * Sorteia quem sofre, no fluxo dado. **Só se sorteia o que pode acontecer**: sem candidato
 * ninguém sofre, e com um só é ele, nos dois casos sem gastar o fluxo.
 */
export function drawVictim(
  draft: GameState,
  stream: RngStream,
  candidates: ReadonlyArray<{ hero: Hero; weight: number }>,
): Hero | null {
  const live = candidates.filter((entry) => entry.weight > 0);
  if (live.length <= 1) {
    return live[0]?.hero ?? null;
  }
  return pickWeighted(draft, stream, live)?.hero ?? null;
}

/** A parte de um desfecho que só vem a partir do Sucesso: item, revelação, tile limpo, cativo solto. */
const succeeded = (outcome: ExpeditionLogEntry['outcome']): boolean =>
  outcome === 'full' || outcome === 'success' || outcome === 'passed';

/** O traço de saque da equipe (o Ganancioso): o primeiro da equipe que o tem; dois não somam. */
function lootTrait(team: readonly Hero[]): { ratio: Ratio; lossPercent: number } | null {
  for (const hero of team) {
    for (const trait of hero.traits) {
      const { greed } = heroTraits[trait].effects;
      if (greed !== undefined) {
        return greed;
      }
    }
  }
  return null;
}

const hasTracker = (team: readonly Hero[]): boolean =>
  team.some((hero) => hero.traits.some((trait) => heroTraits[trait].effects.revealsOnSetback));

/**
 * Resolve o nó em que a equipe está, no instante em que ele termina (ADR 0017, decisões 7 e 8).
 *
 * **A ordem dos sorteios dentro do nó é fixa**, todos no fluxo da expedição, e **só se sorteia o
 * que pode acontecer**:
 *
 * 1. a **sorte**, um inteiro de `luck.min` a `luck.max`, uma vez, só em nó com dificuldade;
 * 2. **quem sofre** o desfecho, por peso (`harmCandidates`), só no Revés e no Desastre, e só com
 *    mais de um candidato (com um só é ele; sem nenhum, ninguém);
 * 3. **a cobiça** do Ganancioso: com um na equipe, em nó com dificuldade que renderia algo, a
 *    chance de o saque do nó se perder;
 * 4. as **quantidades do saque**, na ordem dos recursos do conteúdo, cada uma um inteiro da
 *    faixa do nó (a faixa de um valor só não gasta sorteio);
 * 5. o **item**: a chance de achar um (a chance certa não gasta sorteio) e, achado, qual da
 *    lista (a lista de um só não gasta sorteio);
 * 6. o **Mestre**: a chance de a equipe o encontrar (a chance certa não gasta sorteio), só a
 *    partir do Sucesso e **só se ele ainda pode chegar** (`masterCanArrive`): quem já está no
 *    feudo ou à porta não é sorteado. O Mestre não é saque: a cobiça não o perde.
 *
 * O Desastre não deixa trazer nada: não sorteia cobiça, quantidade, item nem Mestre. O saque que
 * a cobiça perdeu também não sorteia quantidade nem item. O item só vem a partir do Sucesso.
 *
 * Sorteado tudo, o que o nó faz, sem sorteio, na ordem das linhas da Crônica: a frase do nó
 * (com quem se destacou e, no Revés e no Desastre, a lição: `expeditionReport.ts`); o
 * dano a quem foi sorteado; o item; o destino revelado; o tile limpo; o cativo solto; o Mestre,
 * que toma a estrada do feudo neste instante (`deliverMaster`: entra, ou espera à porta); e a
 * experiência de **quem continua na equipe**, com os níveis. O poder é o da equipe **como chegou
 * ao nó**, com os pesos dele: quem ficou Descontente no caminho rende menos aqui, e quem se fere
 * aqui ainda lutou.
 *
 * **Se ninguém da equipe fica de pé** (todos capturados ou mortos), a expedição termina aqui e o
 * saque se perde (`endLost`).
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
  const label = expeditionLabel(expedition.modelId);
  const { trial, rewards } = node;
  const entry = logEntry(expedition.nodeId, atMs, 'passed');
  let share = { num: 1, den: 1 };
  let template = node.text;
  let victim: Hero | null = null;
  let harm: Harm | null = null;
  if (trial !== undefined) {
    // 1. A sorte.
    const luck = rules.luck.min + nextInt(draft, stream, rules.luck.max - rules.luck.min + 1);
    const result = outcomeOf(powerAgainst(team, trial, expedition.posture), luck, trial.difficulty);
    entry.outcome = result;
    share = rules.lootShare[result];
    // Quem se destacou e, no Revés e no Desastre, o que o desfecho ensina: contas sobre a equipe
    // como chegou ao nó, sem sorteio, guardadas no registro para o relatório dizer o mesmo.
    entry.standout = standoutOf(team, trial, expedition.posture)?.name ?? null;
    entry.lesson =
      result === 'setback' || result === 'disaster'
        ? lessonOf(
            draft,
            team,
            trial,
            expedition.posture,
            // "Mais gente" só é conselho com a equipe abaixo do tamanho máximo do destino.
            modelOf(expedition.modelId)?.requires.teamMax ?? team.length,
          )
        : null;
    template = trialTemplate(trial, result, entry.lesson);
    // 2. Quem sofre.
    harm = harmOf(draft, result, trial.onDisaster);
    if (harm !== null) {
      victim = drawVictim(draft, stream, harmCandidates(team, node.kind, harm));
    }
  }
  const greed = lootTrait(team);
  const yields =
    share.num > 0 &&
    (rewards?.resources !== undefined || (rewards?.item !== undefined && succeeded(entry.outcome)));
  // 3. A cobiça.
  if (trial !== undefined && greed !== null && yields) {
    entry.lootLost = chance(draft, stream, { num: greed.lossPercent, den: 100 });
  }
  const found: Item[] = [];
  if (yields && !entry.lootLost) {
    // 4. As quantidades.
    for (const resource of RESOURCE_IDS) {
      const range = rewards?.resources?.[resource];
      if (range === undefined) {
        continue;
      }
      const amount =
        range.max > range.min
          ? range.min + nextInt(draft, stream, range.max - range.min + 1)
          : range.min;
      const boost = greed?.ratio ?? { num: 1, den: 1 };
      entry.gained[resource] = Math.floor(
        (amount * share.num * boost.num) / (share.den * boost.den),
      );
      expedition.loot.resources[resource] += entry.gained[resource];
    }
    // 5. O item.
    const drop = rewards?.item;
    if (drop !== undefined && succeeded(entry.outcome)) {
      const got = drop.chance.num >= drop.chance.den || chance(draft, stream, drop.chance);
      const defId = !got
        ? undefined
        : drop.from.length > 1
          ? drop.from[nextInt(draft, stream, drop.from.length)]
          : drop.from[0];
      if (defId !== undefined) {
        // Um instante da linha do tempo cria a entidade: o item nasce com o identificador dele.
        const item: Item = { id: nextId(draft, 'item'), defId };
        found.push(item);
        expedition.loot.items.push(item);
        entry.found.push(defId);
      }
    }
  }
  // 6. O Mestre.
  const masterDrop = rewards?.master;
  if (
    masterDrop !== undefined &&
    succeeded(entry.outcome) &&
    masterCanArrive(draft, masterDrop.id) &&
    (masterDrop.chance.num >= masterDrop.chance.den || chance(draft, stream, masterDrop.chance))
  ) {
    entry.master = masterDrop.id;
  }
  if (victim !== null && harm !== null) {
    entry.harm = { heroName: victim.name, kind: harm.kind };
  }
  emit(
    events,
    draft,
    atMs,
    // O Revés e o Desastre têm o tipo deles: é o que a Crônica mostra de um nó (pendência D-12).
    entry.outcome === 'setback' || entry.outcome === 'disaster'
      ? 'expeditionNodeFailed'
      : 'expeditionNodeResolved',
    {
      expeditionId: expedition.id,
      modelId: expedition.modelId,
      outcome: entry.outcome,
      ...amountKeys('found', entry.gained),
      ...(entry.lootLost ? { lootLost: 1 } : {}),
    },
    {
      expedicao: label,
      no: node.title,
      desfecho: expeditionOutcomes[entry.outcome].label.toLowerCase(),
      herois: teamNames(team),
      heroi: entry.standout ?? teamNames(team),
    },
    template,
  );
  if (victim !== null && harm !== null) {
    applyHarm(draft, expedition, victim, harm, label, atMs, events);
  }
  for (const item of found) {
    emit(
      events,
      draft,
      atMs,
      'itemFound',
      {
        expeditionId: expedition.id,
        modelId: expedition.modelId,
        itemId: item.id,
        defId: item.defId,
      },
      { expedicao: label, item: itemDefOf(item)?.label ?? '' },
    );
  }
  const reveals = rewards?.reveals;
  if (
    reveals !== undefined &&
    (succeeded(entry.outcome) || (entry.outcome === 'setback' && hasTracker(team))) &&
    revealDestination(draft, reveals)
  ) {
    entry.revealed = reveals;
    emit(
      events,
      draft,
      atMs,
      'destinationRevealed',
      { expeditionId: expedition.id, modelId: expedition.modelId, revealed: reveals },
      { expedicao: label, destino: expeditionLabel(reveals) },
    );
  }
  if (succeeded(entry.outcome)) {
    const tileId = rewards?.clearsTile;
    if (tileId !== undefined && clearTile(draft, expedition, tileId, label, atMs, events)) {
      entry.cleared = tileId;
    }
    if (rewards?.rescues === true) {
      entry.rescued = rescueCaptive(draft, expedition, label, atMs, events)?.name ?? null;
    }
  }
  if (entry.master !== null) {
    // Um instante da linha do tempo cria a entidade: o Mestre nasce com o identificador dele.
    deliverMaster(draft, entry.master, atMs, events);
  }
  const standing = heroesOf(draft, expedition.heroIds);
  if (trial !== undefined) {
    const ratio = rules.xpShare[entry.outcome as ExpeditionOutcomeId];
    entry.xp = Math.floor((trial.xp * ratio.num) / ratio.den);
    entry.leveled = grantXp(draft, standing, entry.xp, atMs, events);
  }
  expedition.log.push(entry);
  if (standing.length === 0) {
    endLost(draft, expedition, atMs, events);
    return;
  }
  enterNode(draft, expedition, node.next, atMs, events);
}

/** Os nomes de quem foi: quem voltou, na ordem da equipe, e depois quem o percurso levou. */
function reportNames(expedition: Expedition, team: readonly Hero[]): string[] {
  const names = team.map((hero) => hero.name);
  for (const { harm } of expedition.log) {
    if (
      harm !== null &&
      (harm.kind === 'captured' || harm.kind === 'died') &&
      !names.includes(harm.heroName)
    ) {
      names.push(harm.heroName);
    }
  }
  return names;
}

/** Fecha a expedição neste instante: sai da lista, e o fluxo de sorteio dela é apagado por último. */
function close(draft: GameState, expedition: Expedition, report: ExpeditionReport): void {
  const { guild } = draft;
  guild.reports.push(report);
  guild.reports = guild.reports.slice(-rules.reportsKept);
  guild.expeditions = guild.expeditions.filter((entry) => entry.id !== expedition.id);
  // O último passo da expedição neste instante: nada mais sorteia no fluxo dela, e o
  // identificador nunca volta, então o fluxo não renasce (README do motor, "O que a fundação
  // não prova", R1).
  dropStream(draft, entityStream('expedition', expedition.id));
}

/**
 * Ninguém da equipe ficou de pé (todos capturados ou mortos): a expedição termina no nó, sem
 * caminho de volta, e **o saque se perde** (os recursos e os itens que ela trazia). O relatório
 * fica, dizendo isso, e a Crônica tem a linha dela.
 */
function endLost(
  draft: GameState,
  expedition: Expedition,
  atMs: number,
  events: GameEvent[],
): void {
  draft.stats.expeditionsLost = (draft.stats.expeditionsLost ?? 0) + 1;
  emit(
    events,
    draft,
    atMs,
    'expeditionLost',
    { expeditionId: expedition.id, modelId: expedition.modelId },
    { expedicao: expeditionLabel(expedition.modelId) },
  );
  close(draft, expedition, {
    expeditionId: expedition.id,
    modelId: expedition.modelId,
    variant: expedition.variant,
    heroNames: reportNames(expedition, []),
    posture: expedition.posture,
    sentAtMs: expedition.sentAtMs,
    returnedAtMs: atMs,
    log: expedition.log,
    loot: { resources: noAmounts(), items: [] },
    wasted: noAmounts(),
    sold: [],
    lost: true,
  });
}

/** "22 de ouro e um item (Lança de caça)": o saque em palavras, com os itens. */
function describeLoot(loot: Expedition['loot']): string {
  const parts: string[] = [];
  if (RESOURCE_IDS.some((resource) => loot.resources[resource] > 0)) {
    parts.push(describeLoss(loot.resources));
  }
  const labels = loot.items.map((item) => itemDefOf(item)?.label ?? 'um item sem nome');
  if (labels.length === 1) {
    parts.push(`um item (${labels[0]})`);
  } else if (labels.length > 1) {
    parts.push(`${labels.length} itens (${joinList(labels)})`);
  }
  return parts.join(' e ');
}

/**
 * A equipe volta para casa: o saque entra no estoque pelo depósito (o que não cabe é
 * desperdício contado, como todo ganho discreto), os itens vão para o arsenal (o que não cabe
 * vira ouro, com linha na Crônica), os heróis voltam a ficar no feudo (**quem se feriu e ainda
 * não sarou fica em recuperação**), o percurso vira relatório (os mais antigos saem) e a
 * expedição deixa a lista.
 */
function returnHome(
  draft: GameState,
  expedition: Expedition,
  atMs: number,
  events: GameEvent[],
  recalled = false,
  completed = !recalled,
): void {
  const team = heroesOf(draft, expedition.heroIds);
  const stored = noAmounts();
  const wasted = noAmounts();
  for (const resource of RESOURCE_IDS) {
    const milli = expedition.loot.resources[resource] * MILLI;
    stored[resource] = storeResource(draft, resource, milli);
    wasted[resource] = milli - stored[resource];
  }
  for (const hero of team) {
    hero.status = hero.injury === null ? 'idle' : 'injured';
  }
  draft.stats.expeditionsReturned = (draft.stats.expeditionsReturned ?? 0) + 1;
  // Por modelo, só a que chegou ao fim do caminho: a recolhida antes e a que volta porque o
  // conteúdo deixou de ter o nó não contam (objetivo "Explore as Ruínas").
  if (completed) {
    const doneKey = `expeditionsReturned:${expedition.modelId}`;
    draft.stats[doneKey] = (draft.stats[doneKey] ?? 0) + 1;
  }
  const { resources, items: carried } = expedition.loot;
  const empty = carried.length === 0 && RESOURCE_IDS.every((resource) => resources[resource] === 0);
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
      ...(carried.length > 0 ? { items: carried.length } : {}),
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
      saque: describeLoot(expedition.loot),
      perda: describeLoss(lost),
    },
    empty
      ? expeditionTemplates[recalled ? 'recalledEmpty' : 'returnedEmpty']
      : cut
        ? expeditionTemplates[recalled ? 'recalledCut' : 'returnedCut']
        : recalled
          ? expeditionTemplates.recalled
          : undefined,
  );
  // Depois da linha da volta: o item que não cabe no arsenal vira ouro, com a linha dele.
  const sold = carried.filter((item) => !stowItem(draft, item, atMs, events));
  close(draft, expedition, {
    expeditionId: expedition.id,
    modelId: expedition.modelId,
    variant: expedition.variant,
    heroNames: reportNames(expedition, team),
    posture: expedition.posture,
    sentAtMs: expedition.sentAtMs,
    returnedAtMs: atMs,
    log: expedition.log,
    loot: expedition.loot,
    wasted,
    sold: sold.map((item) => item.defId),
    lost: false,
  });
  // Depois do saque e do relatório: quem volta com o soldo em atraso e o prazo vencido é
  // cobrado na volta (revisão da Fase E, R2; `chargeReturned`).
  chargeReturned(
    draft,
    team.map((hero) => hero.id),
    atMs,
    events,
  );
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
    // O conteúdo já não tem esta encruzilhada: a equipe volta com o que juntou, e a volta não
    // conta como o destino concluído.
    returnHome(draft, expedition, atMs, events, false, false);
    return;
  }
  const fallback = choice.blocked !== null;
  expedition.log.push({
    ...logEntry(expedition.nodeId, atMs, 'chosen'),
    optionId: choice.option.id,
    decidedBy: fallback ? 'cautiousFallback' : 'posture',
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

/**
 * A expedição ficou sem caminho: está a caminho ou parada em uma encruzilhada, e o conteúdo já
 * não tem o modelo, a variante ou o nó em que ela está, ou o nó já não é do tipo que o estado
 * diz (a equipe "parada na encruzilhada" de um nó que deixou de ser encruzilhada, ou de uma
 * encruzilhada que perdeu as opções).
 */
function isStranded(draft: GameState, expedition: Expedition): boolean {
  // Quem já está voltando tem o instante da chegada marcado e termina nele, com nó ou sem nó
  // (`stepExpedition`): é assim que `enterNode` manda para casa a equipe cujo nó de destino
  // sumiu. Chamá-la aqui anteciparia a volta de quem parou o avanço naquele instante, e a
  // divisão de intervalo deixaria de ser exata.
  if (expedition.status === 'returning') {
    return false;
  }
  const node = nodeOf(expedition);
  if (node === null) {
    return true;
  }
  if (expedition.status === 'atCrossroads') {
    return (
      node.kind !== 'crossroads' ||
      postureChoice(heroesOf(draft, expedition.heroIds), node, expedition.posture) === null
    );
  }
  return node.kind === 'crossroads';
}

/**
 * Manda para casa, **neste instante**, toda expedição que ficou sem caminho (`isStranded`): os
 * heróis voltam ao feudo, o saque que ela tinha entra no depósito, o relatório fica, o fluxo de
 * sorteio dela é apagado e a Crônica diz o que houve (`expeditionTemplates.recalled`). Não
 * sorteia nada.
 *
 * É a acomodação **na fronteira** (`advanceWith`, antes de o tempo andar; revisão da Fase D,
 * M-R6): o conteúdo só muda entre uma publicação e outra, e sem isto a equipe ficava parada até
 * o prazo, com a tela dizendo "Parada na encruzilhada" e nenhuma opção a escolher. Em um estado
 * em repouso não há o que fazer, e nada muda.
 */
export function recallStranded(draft: GameState, atMs: number, events: GameEvent[]): void {
  for (const id of draft.guild.expeditions.map((entry) => entry.id)) {
    const expedition = draft.guild.expeditions.find((entry) => entry.id === id);
    if (expedition !== undefined && isStranded(draft, expedition)) {
      returnHome(draft, expedition, atMs, events, true);
    }
  }
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
    // O fim do caminho de volta, ou um nó que o conteúdo já não tem: esta volta não conta como
    // o destino concluído.
    returnHome(draft, expedition, atMs, events, false, node?.kind === 'return');
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
