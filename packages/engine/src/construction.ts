import {
  balance,
  BUILDING_IDS,
  buildings,
  foundingTemplates,
  type Ratio,
  RESOURCE_IDS,
  type ResourceAmounts,
} from '@lotg/content';

import { emit } from './chronicle';
import { seasonAt } from './clock';
import { sentenceCase } from './format';
import { reject } from './rejections';
import { type BeyondStorage, costBeyondStorage, storagePlace, storeResource } from './storage';
import type {
  BuildingId,
  Construction,
  GameEvent,
  GameState,
  Rejection,
  ResourceId,
} from './types';
import { MILLI, positiveEntries, scaleDown } from './units';

export function isBuildingId(value: unknown): value is BuildingId {
  return (BUILDING_IDS as readonly unknown[]).includes(value);
}

/** "a Serraria", "as Habitações". */
export function buildingWithArticle(building: BuildingId): string {
  const def = buildings[building];
  return `${def.article} ${def.label}`;
}

/** "da Serraria", "do Armazém", "das Habitações". */
export function ofBuilding(building: BuildingId): string {
  const def = buildings[building];
  return `d${def.article} ${def.label}`;
}

/** arredondar(valor × fator^passos), só com inteiros. */
function growRounded(value: number, factor: Ratio, steps: number): number {
  const num = value * factor.num ** steps;
  const den = factor.den ** steps;
  return Math.floor((2 * num + den) / (2 * den));
}

/**
 * Quantas obras o edifício já teve quando está em `fromLevel`: é o expoente do custo e do prazo.
 * Conta a partir do nível com que ele nasce, então a primeira obra sai sempre pelo custo base: a
 * melhoria 1 → 2 de quem nasce erguido e a construção 0 → 1 do Celeiro e do Armazém (GDD §6.2).
 */
function upgradeSteps(building: BuildingId, fromLevel: number): number {
  return fromLevel - buildings[building].initialLevel;
}

/** A obra que parte de `fromLevel` ergue o edifício do zero. */
export function isFounding(fromLevel: number): boolean {
  return fromLevel === 0;
}

/** Custo, em unidades, de levar um edifício de `fromLevel` para o nível seguinte (GDD §6.2). */
export function upgradeCost(building: BuildingId, fromLevel: number): ResourceAmounts {
  const { costFactor, costFactorByBuilding } = balance.construction;
  const factor = costFactorByBuilding[building] ?? costFactor;
  const cost: ResourceAmounts = {};
  for (const [resource, base] of positiveEntries(buildings[building].baseCost)) {
    cost[resource] = growRounded(base, factor, upgradeSteps(building, fromLevel));
  }
  return cost;
}

/**
 * Duração da obra a partir de `fromLevel`. `seasonFactor` é o fator da estação em que ela começa
 * (no inverno, × 1,5); sem ele, sai o prazo de tabela. É uma conta só, com um arredondamento
 * para baixo, e o teto de 8 h vem **depois** do fator: nenhuma obra exige mais que uma noite,
 * nem no inverno. O prazo é fixado quando a obra começa e não muda na virada (GDD §4.1).
 */
export function upgradeDurationMs(
  building: BuildingId,
  fromLevel: number,
  seasonFactor: Ratio = { num: 1, den: 1 },
): number {
  const { timeFactor, maxDurationMs } = balance.construction;
  const steps = upgradeSteps(building, fromLevel);
  const duration = Math.floor(
    (buildings[building].baseDurationMs * timeFactor.num ** steps * seasonFactor.num) /
      (timeFactor.den ** steps * seasonFactor.den),
  );
  return Math.min(maxDurationMs, duration);
}

/** Duração da obra a partir de `fromLevel` se ela começar no instante `atMs`. */
export function upgradeDurationAt(building: BuildingId, fromLevel: number, atMs: number): number {
  return upgradeDurationMs(building, fromLevel, seasonAt(atMs).effects.constructionDuration);
}

/** O que falta, em unidades, para pagar `quantity` vezes `cost`; `null` quando há o bastante. */
export function missingResources(
  state: GameState,
  cost: ResourceAmounts,
  quantity = 1,
): ResourceAmounts | null {
  const missing: ResourceAmounts = {};
  for (const [resource, amount] of positiveEntries(cost)) {
    const shortfall = amount * quantity * MILLI - state.settlement.resources[resource];
    if (shortfall > 0) {
      missing[resource] = Math.ceil(shortfall / MILLI);
    }
  }
  return Object.keys(missing).length > 0 ? missing : null;
}

export function payResources(draft: GameState, cost: ResourceAmounts, quantity = 1): void {
  for (const [resource, amount] of positiveEntries(cost)) {
    draft.settlement.resources[resource] -= amount * quantity * MILLI;
  }
}

export function constructionOf(state: GameState, building: BuildingId): Construction | null {
  return state.settlement.constructionQueues.find((slot) => slot?.building === building) ?? null;
}

/**
 * Quantas filas de obras o feudo tem abertas: a primeira existe desde o começo, e a segunda
 * abre quando o Salão chega ao nível de `secondQueueTownHallLevel` (GDD §6.3). Derivado do nível
 * do Salão, nunca guardado: a fila abre no instante exato em que a obra do Salão termina.
 */
export function queuesUnlocked(state: GameState): number {
  const { queues, secondQueueTownHallLevel } = balance.construction;
  return state.settlement.buildings.townHall >= secondQueueTownHallLevel ? queues : 1;
}

/** A primeira fila aberta e livre, na ordem; `-1` quando todas as abertas têm obra. */
export function freeQueue(state: GameState): number {
  const open = queuesUnlocked(state);
  for (let index = 0; index < open; index += 1) {
    if ((state.settlement.constructionQueues[index] ?? null) === null) {
      return index;
    }
  }
  return -1;
}

export type UpgradeQuote = {
  building: BuildingId;
  fromLevel: number;
  targetLevel: number;
  cost: ResourceAmounts;
  durationMs: number;
  /** Quanto falta de cada recurso, em unidades; vazio quando há o bastante. */
  missing: ResourceAmounts;
  /** Motivo pelo qual a obra não pode começar agora; `null` quando pode. */
  blocked: Rejection | null;
};

/**
 * O pré-requisito que falta a um edifício (`requires`, GDD §6.1: "Salão 2"): o primeiro, na
 * ordem do catálogo, cujo nível ainda não chegou ao pedido. `null` quando não falta nenhum.
 */
function unmetRequirement(
  state: GameState,
  building: BuildingId,
): { building: BuildingId; level: number } | null {
  const { requires } = buildings[building];
  for (const required of BUILDING_IDS) {
    const level = requires[required];
    if (level !== undefined && state.settlement.buildings[required] < level) {
      return { building: required, level };
    }
  }
  return null;
}

/**
 * A recusa de uma obra cujo custo não cabe no depósito: diz quanto ela pede, quanto o depósito
 * guarda e o que fazer. Quando o próprio depósito é a obra, ou ele já está no nível máximo, não
 * há o que ampliar, e a frase diz isso.
 */
function storageRejection(
  state: GameState,
  building: BuildingId,
  beyond: BeyondStorage,
): Rejection {
  const place = storagePlace(state, beyond.resource);
  const storeLevel = state.settlement.buildings[beyond.building];
  const canGrow = beyond.building !== building && storeLevel < buildings[beyond.building].maxLevel;
  const verb = storeLevel === 0 ? 'construa' : 'amplie';
  return reject('EXCEEDS_STORAGE', {
    amount: beyond.amount,
    resource: balance.resources[beyond.resource].label.toLowerCase(),
    label: place === null ? '' : `${place.article} ${place.label}`,
    capacity: beyond.capacity,
    ...(canGrow ? { remedy: `${verb} ${buildingWithArticle(beyond.building)} primeiro` } : {}),
  });
}

/**
 * O nível de outro edifício que falta para uma obra chegar a `targetLevel`: o pré-requisito do
 * catálogo ou, para tudo menos o Salão, a regra de nunca passar do nível dele mais um. `null`
 * quando não falta nenhum.
 */
export function gateRequirement(
  state: GameState,
  building: BuildingId,
  targetLevel: number,
): { building: BuildingId; level: number } | null {
  const { gateLevelsAboveTownHall } = balance.construction;
  const requirement = unmetRequirement(state, building);
  if (requirement !== null) {
    return requirement;
  }
  return building !== 'townHall' &&
    targetLevel > state.settlement.buildings.townHall + gateLevelsAboveTownHall
    ? { building: 'townHall', level: targetLevel - gateLevelsAboveTownHall }
    : null;
}

/**
 * A próxima melhoria de `building` ainda pode vir a começar: o edifício não chegou ao teto, e o
 * que a segura (o nível de outro edifício, o depósito pequeno demais para o custo) ainda se
 * resolve com outra obra. A fila ocupada e a falta de recurso não contam: passam sozinhas. Com
 * o edifício em obras, a resposta é sim: o feudo ainda está construindo.
 *
 * É o que separa "gaste madeira" de um conselho que nenhum botão cumpre: em Senhor, com o
 * Armazém no nível máximo, a obra do Salão para o nível 8 pede mais do que ele guarda, e com
 * ela ficam presas as dos edifícios que esperam o Salão.
 */
export function upgradeStillPossible(
  state: GameState,
  building: BuildingId,
  waitingOn: readonly BuildingId[] = [],
): boolean {
  // Uma obra que depende de si mesma (o depósito cujo custo não cabe nele) não se resolve.
  if (waitingOn.includes(building)) {
    return false;
  }
  if (constructionOf(state, building) !== null) {
    return true;
  }
  const fromLevel = state.settlement.buildings[building];
  if (fromLevel >= buildings[building].maxLevel) {
    return false;
  }
  const chain = [...waitingOn, building];
  // As duas travas têm de ceder: o edifício que falta subir e o depósito que falta ampliar.
  const requirement = gateRequirement(state, building, fromLevel + 1);
  if (requirement !== null && !upgradeStillPossible(state, requirement.building, chain)) {
    return false;
  }
  const beyond = costBeyondStorage(state, upgradeCost(building, fromLevel));
  return beyond === null || upgradeStillPossible(state, beyond.building, chain);
}

/** A recusa de uma obra sem fila livre: diz o que abre a segunda fila enquanto ela não abriu. */
function queueRejection(state: GameState): Rejection {
  return reject(
    queuesUnlocked(state) < balance.construction.queues ? 'QUEUE_LOCKED' : 'QUEUE_BUSY',
  );
}

/**
 * Orçamento da próxima melhoria de um edifício: custos, duração e o motivo pelo qual ela não
 * pode começar agora. Quando há mais de um motivo, sai o primeiro nesta ordem, que é a do que o
 * jogador resolve antes: o edifício já em obras, a fila, o teto, o nível de outro edifício, o
 * depósito e, por último, o recurso. As planejadas olham os mesmos motivos em outra ordem
 * (`planWait`, em `planned.ts`), com os mesmos testes.
 */
export function upgradeQuote(state: GameState, building: BuildingId): UpgradeQuote {
  const { settlement } = state;
  const def = buildings[building];
  const fromLevel = settlement.buildings[building];
  const targetLevel = fromLevel + 1;
  const cost = upgradeCost(building, fromLevel);
  const missing = missingResources(state, cost) ?? {};
  const label = () => sentenceCase(buildingWithArticle(building));

  let blocked: Rejection | null;
  if (constructionOf(state, building) !== null) {
    blocked = reject('ALREADY_UPGRADING', { label: label() });
  } else if (freeQueue(state) === -1) {
    blocked = queueRejection(state);
  } else if (fromLevel >= def.maxLevel) {
    blocked = reject('MAX_LEVEL', { label: label(), note: def.maxLevelNote });
  } else {
    const requirement = gateRequirement(state, building, targetLevel);
    // Falta recurso: ou ele nunca vai caber no depósito (e esperar não adianta), ou é só esperar.
    const beyond = requirement === null ? costBeyondStorage(state, cost) : null;
    if (requirement !== null) {
      blocked = reject('GATE_LOCKED', {
        label: buildingWithArticle(requirement.building),
        level: requirement.level,
      });
    } else if (beyond !== null) {
      blocked = storageRejection(state, building, beyond);
    } else {
      blocked =
        Object.keys(missing).length > 0 ? reject('INSUFFICIENT_RESOURCES', { missing }) : null;
    }
  }

  return {
    building,
    fromLevel,
    targetLevel,
    cost,
    durationMs: upgradeDurationAt(building, fromLevel, state.lastProcessedAt),
    missing,
    blocked,
  };
}

/**
 * Tira da lista a planejada de um edifício. Com `upToLevel`, só a que leva o edifício até esse
 * nível: é o que uma obra iniciada cumpre. A planejada do nível **seguinte** fica onde está e
 * passa a esperar o fim dessa obra, inclusive quando a obra é a que foi cancelada e alguém
 * iniciou de novo (GDD §6.3).
 */
function unplan(draft: GameState, building: BuildingId, upToLevel?: number): void {
  const { settlement } = draft;
  settlement.planned = settlement.planned.filter(
    (plan) =>
      plan.building !== building || (upToLevel !== undefined && plan.targetLevel > upToLevel),
  );
}

/**
 * Inicia uma melhoria: desconta o custo uma única vez e ocupa a primeira fila livre. `by` diz
 * quem a iniciou: o jogador, com uma ordem, ou o motor, que encontrou uma planejada automática
 * pronta para começar. A obra é a mesma; muda o evento (`constructionAutoStarted`) e a frase.
 */
export function startConstruction(
  draft: GameState,
  building: unknown,
  nowMs: number,
  events: GameEvent[],
  by: 'order' | 'autoStart' = 'order',
): Rejection | null {
  if (!isBuildingId(building)) {
    return reject('INVALID_BUILDING');
  }
  const quote = upgradeQuote(draft, building);
  if (quote.blocked !== null) {
    return quote.blocked;
  }
  const { settlement, stats } = draft;
  payResources(draft, quote.cost);
  settlement.constructionQueues[freeQueue(draft)] = {
    building,
    targetLevel: quote.targetLevel,
    startedAtMs: nowMs,
    finishesAtMs: nowMs + quote.durationMs,
  };
  unplan(draft, building, quote.targetLevel);
  const stat = `constructionsStarted:${building}`;
  stats[stat] = (stats[stat] ?? 0) + 1;
  const type = by === 'autoStart' ? 'constructionAutoStarted' : 'constructionStarted';
  emit(
    events,
    draft,
    nowMs,
    type,
    { building, level: quote.targetLevel, ...amountsData('spent', quote.cost) },
    { edificio: buildingWithArticle(building), nivel: quote.targetLevel },
    isFounding(quote.fromLevel) ? foundingTemplates[type] : undefined,
  );
  return null;
}

/**
 * Totais de um evento, em unidades, com uma chave por recurso: `spent_wood`, `gained_gold`. É
 * com eles que o Relatório de Retorno separa o que foi produzido do que foi gasto, recebido e
 * perdido, sem refazer conta nenhuma.
 *
 * `lost` é a parte de um ganho discreto (recompensa, devolução) que não coube no depósito: ela
 * também entra no desperdício do dia (`storageWasted`), e é esta chave que diz ao relatório que
 * aquele desperdício não foi produção.
 */
export function amountsData(
  prefix: 'spent' | 'gained' | 'lost',
  amounts: ResourceAmounts,
): Record<string, number> {
  return Object.fromEntries(
    positiveEntries(amounts).map(([resource, amount]) => [`${prefix}_${resource}`, amount]),
  );
}

/**
 * Conclui as obras que vencem até `atMs`. O efeito do nível novo vale a partir daqui. A obra
 * que ergue um edifício do zero termina com evento próprio, `buildingFounded`, no lugar de
 * `constructionFinished`.
 */
export function finishConstructions(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement } = draft;
  settlement.constructionQueues.forEach((slot, index) => {
    if (slot === null || slot.finishesAtMs > atMs) {
      return;
    }
    const founded = isFounding(settlement.buildings[slot.building]);
    settlement.buildings[slot.building] = slot.targetLevel;
    settlement.constructionQueues[index] = null;
    emit(
      events,
      draft,
      atMs,
      founded ? 'buildingFounded' : 'constructionFinished',
      { building: slot.building, level: slot.targetLevel },
      { edificio: buildingWithArticle(slot.building), nivel: slot.targetLevel },
    );
  });
}

/** O que volta, em milésimos, ao cancelar a obra que parte de `fromLevel`: 80% do que foi pago. */
export function cancelRefund(building: BuildingId, fromLevel: number): Record<ResourceId, number> {
  const paid = upgradeCost(building, fromLevel);
  const refundOf = (resource: ResourceId) =>
    scaleDown((paid[resource] ?? 0) * MILLI, balance.construction.cancelRefund);
  return {
    food: refundOf('food'),
    wood: refundOf('wood'),
    stone: refundOf('stone'),
    gold: refundOf('gold'),
  };
}

/**
 * Cancela a obra de um edifício e devolve 80% do que foi pago, arredondando para baixo. A
 * devolução é um ganho como outro qualquer: entra o que cabe no depósito, e o que não cabe é
 * desperdício contado (GDD §5.5).
 */
export function cancelConstruction(
  draft: GameState,
  building: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (!isBuildingId(building)) {
    return reject('INVALID_BUILDING');
  }
  const { settlement } = draft;
  const index = settlement.constructionQueues.findIndex((slot) => slot?.building === building);
  if (index === -1) {
    return reject('NOT_IN_CONSTRUCTION', { label: sentenceCase(buildingWithArticle(building)) });
  }
  const level = settlement.buildings[building];
  const refund = cancelRefund(building, level);
  const gained: ResourceAmounts = {};
  const lost: ResourceAmounts = {};
  for (const resource of RESOURCE_IDS) {
    const stored = storeResource(draft, resource, refund[resource]);
    if (stored > 0) {
      gained[resource] = stored / MILLI;
    }
    if (stored < refund[resource]) {
      lost[resource] = (refund[resource] - stored) / MILLI;
    }
  }
  settlement.constructionQueues[index] = null;
  emit(
    events,
    draft,
    nowMs,
    'constructionCancelled',
    { building, level, ...amountsData('gained', gained), ...amountsData('lost', lost) },
    { edificio: buildingWithArticle(building), nivel: level },
    isFounding(level) ? foundingTemplates.constructionCancelled : undefined,
  );
  return null;
}

/** Nível que a próxima obra de um edifício alcançaria, contando a que já está em andamento. */
function nextPlannableLevel(state: GameState, building: BuildingId): number {
  const underway = constructionOf(state, building);
  return (underway?.targetLevel ?? state.settlement.buildings[building]) + 1;
}

/**
 * Conta as vezes em que o jogador marcou uma planejada para começar sozinha (GDD §12.2, "Deixe
 * uma obra marcada para começar sozinha"). A marca conta mesmo quando a obra começa na mesma
 * ordem e já sai da lista: é a ferramenta que o objetivo ensina, não a espera.
 */
function notePlanMarkedAuto(draft: GameState): void {
  const { stats } = draft;
  stats.plansMarkedAuto = (stats.plansMarkedAuto ?? 0) + 1;
}

/**
 * Põe uma melhoria no fim da lista de planejadas. Planejar não gasta nada. Com `autoStart`, a
 * obra começa sozinha no primeiro instante em que puder (`planned.ts`); sem ele, espera a ordem
 * do jogador, como na v0.1.
 *
 * `askedLevel` é o nível que a tela mostrava a quem deu a ordem. Sem ele, a ordem vale para a
 * obra que for a da vez. Com ele, só vale se essa obra ainda é a daquele nível: duas abas com a
 * visão velha (ou a ordem repetida antes de a resposta chegar) pedem a mesma obra, e a segunda
 * não pode virar a planejada do nível seguinte, que como automática seria paga sem ninguém ter
 * pedido. A recusa diz o que aconteceu com a obra pedida: já começou, já chegou ao teto, ou já
 * é a de outro nível.
 */
export function planConstruction(
  draft: GameState,
  building: unknown,
  autoStart: unknown,
  askedLevel?: unknown,
): Rejection | null {
  if (!isBuildingId(building)) {
    return reject('INVALID_BUILDING');
  }
  const label = sentenceCase(buildingWithArticle(building));
  if (draft.settlement.planned.some((plan) => plan.building === building)) {
    return reject('ALREADY_PLANNED', { label });
  }
  const targetLevel = nextPlannableLevel(draft, building);
  if (askedLevel !== undefined && askedLevel !== targetLevel) {
    const underway = constructionOf(draft, building);
    if (underway !== null && typeof askedLevel === 'number' && askedLevel <= underway.targetLevel) {
      return reject('ALREADY_UPGRADING', { label });
    }
  }
  if (targetLevel > buildings[building].maxLevel) {
    return reject('MAX_LEVEL', { label, note: buildings[building].maxLevelNote });
  }
  if (askedLevel !== undefined && askedLevel !== targetLevel) {
    return reject('STALE_LEVEL', { label: ofBuilding(building), level: targetLevel });
  }
  draft.settlement.planned.push({ building, targetLevel, autoStart: autoStart === true });
  if (autoStart === true) {
    notePlanMarkedAuto(draft);
  }
  return null;
}

/**
 * Marca ou desmarca "iniciar quando houver recursos" em uma planejada, sem tirá-la do lugar.
 * Com `askedLevel`, só a planejada daquele nível: a marca dada com a tela atrasada não vai para
 * a planejada de outro nível que entrou no lugar.
 */
export function setAutoStart(
  draft: GameState,
  building: unknown,
  autoStart: unknown,
  askedLevel?: unknown,
): Rejection | null {
  if (!isBuildingId(building)) {
    return reject('INVALID_BUILDING');
  }
  const plan = draft.settlement.planned.find((entry) => entry.building === building);
  if (plan === undefined) {
    return reject('NOT_PLANNED', { label: sentenceCase(buildingWithArticle(building)) });
  }
  if (askedLevel !== undefined && askedLevel !== plan.targetLevel) {
    return reject('STALE_LEVEL', { label: ofBuilding(building), level: plan.targetLevel });
  }
  // Marcar de novo a que já era automática não é marcar outra vez.
  if (autoStart === true && !plan.autoStart) {
    notePlanMarkedAuto(draft);
  }
  plan.autoStart = autoStart === true;
  return null;
}

export function unplanConstruction(draft: GameState, building: unknown): Rejection | null {
  if (!isBuildingId(building)) {
    return reject('INVALID_BUILDING');
  }
  if (!draft.settlement.planned.some((plan) => plan.building === building)) {
    return reject('NOT_PLANNED', { label: sentenceCase(buildingWithArticle(building)) });
  }
  unplan(draft, building);
  return null;
}
