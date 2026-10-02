import { balance, type BuildingId, buildings } from '@lotg/content';

import {
  buildingWithArticle,
  constructionOf,
  isFounding,
  ofBuilding,
  queuesUnlocked,
} from './construction';
import { type CraftForecast, inMs } from './craftProjection';
import { flowRate, producerOf } from './economy';
import { coversIn, type PlanWait, planWait } from './planned';
import { SECOND_QUEUE_OPENS } from './rejections';
import { describeLoss, storageCapacity, storagePlace } from './storage';
import type { GameState, PlannedConstruction, PlannedWaitingView, ResourceId } from './types';
import { MILLI, positiveEntries, SECOND_MS } from './units';

const lower = (resource: ResourceId) => balance.resources[resource].label.toLowerCase();
/** "melhore-o", "amplie-a": o pronome do edifício de que a frase acabou de falar. */
const it = (building: BuildingId) => `-${buildings[building].article}`;

type Waiting = { text: string; etaMs: number | null };

/** A obra anterior do mesmo edifício: a que está em curso ou, cancelada, a que falta iniciar. */
function waitUpgrading(
  state: GameState,
  plan: PlannedConstruction,
  wait: Extract<PlanWait, { reason: 'upgrading' }>,
): Waiting {
  const { building } = plan;
  if (wait.underway !== null) {
    return {
      text: `espera a obra ${ofBuilding(building)} terminar`,
      etaMs: wait.underway.finishesAtMs - state.lastProcessedAt,
    };
  }
  const goal = isFounding(wait.level - 1)
    ? `${buildingWithArticle(building)} ficar de pé`
    : `${buildingWithArticle(building)} chegar ao nível ${wait.level}`;
  return { text: `espera ${goal}: inicie essa obra primeiro`, etaMs: null };
}

/**
 * O nível de outro edifício: com a obra dele em curso, é só esperar; sem ela, falta a ordem. Uma
 * planejada além do teto do edifício (o conteúdo baixou o nível máximo) não tem o que esperar.
 */
function waitGate(
  state: GameState,
  plan: PlannedConstruction,
  wait: Extract<PlanWait, { reason: 'gate' }>,
): Waiting {
  if (wait.requirement === null) {
    return { text: `${buildingWithArticle(plan.building)} já está no nível máximo`, etaMs: null };
  }
  const { building, level } = wait.requirement;
  const goal = `espera ${buildingWithArticle(building)} chegar ao nível ${level}`;
  const underway = constructionOf(state, building);
  return underway !== null && underway.targetLevel >= level
    ? { text: goal, etaMs: underway.finishesAtMs - state.lastProcessedAt }
    : { text: `${goal}: melhore${it(building)}`, etaMs: null };
}

/** O custo não cabe no depósito: a frase diz onde não cabe e o que fazer. */
function waitCapacity(
  state: GameState,
  plan: PlannedConstruction,
  { beyond }: Extract<PlanWait, { reason: 'capacity' }>,
): Waiting {
  const place = storagePlace(state, beyond.resource);
  const where = place === null ? '' : ` n${place.article} ${place.label}`;
  const store = beyond.building;
  const level = state.settlement.buildings[store];
  const underway = constructionOf(state, store);
  if (underway !== null) {
    // A obra do depósito já está em curso: se o nível novo guarda o custo, é só esperar.
    const cap = storageCapacity(state, beyond.resource, underway.targetLevel) ?? 0;
    return {
      text: `não cabe${where}: a obra ${ofBuilding(store)} já vai abrir espaço`,
      etaMs: cap >= beyond.amount * MILLI ? underway.finishesAtMs - state.lastProcessedAt : null,
    };
  }
  if (store === plan.building || level >= buildings[store].maxLevel) {
    return { text: `não cabe${where}: não há como juntar tanto`, etaMs: null };
  }
  return {
    text:
      level === 0
        ? `não cabe${where}: construa ${buildingWithArticle(store)}`
        : `não cabe${where}: amplie${it(store)}`,
    etaMs: null,
  };
}

/**
 * Falta recurso: quanto, e em quanto tempo a produção o junta. Quando ela não junta (ninguém
 * no ofício, ou a lareira leva a madeira antes), a frase diz o que está parado e o que fazer.
 */
function waitResources(
  state: GameState,
  wait: Extract<PlanWait, { reason: 'resources' }>,
  rates: Record<ResourceId, number>,
  forecast: CraftForecast,
): Waiting {
  const needs = `espera ${describeLoss(wait.missing)}`;
  // O prazo conta com o que o ofício muda sozinho no caminho; quando essa conta não chega a
  // um instante (a comida acabaria antes), fica o das taxas de agora.
  const covers =
    forecast.find((draft, current) => inMs(coversIn(draft, wait.cost, current)))?.inMs ??
    coversIn(state, wait.cost, rates);
  if (covers !== null) {
    return { text: needs, etaMs: covers };
  }
  const stalled = positiveEntries(wait.missing).find(
    ([resource]) => flowRate(state, resource, rates) <= 0,
  );
  if (stalled !== undefined) {
    const [resource] = stalled;
    const producer = buildingWithArticle(producerOf(resource));
    return {
      text: `${needs}, mas o estoque de ${lower(resource)} não está subindo: mande aldeões para ${producer}`,
      etaMs: null,
    };
  }
  const falling = positiveEntries(wait.cost).find(
    ([resource]) => flowRate(state, resource, rates) < 0,
  );
  return {
    text:
      falling === undefined
        ? needs
        : `${needs}, mas o estoque de ${lower(falling[0])} cai antes disso`,
    etaMs: null,
  };
}

/** Tudo pronto, menos os pedreiros: a espera acaba quando a primeira obra em curso terminar. */
function waitQueue(state: GameState): Waiting {
  const open = queuesUnlocked(state);
  const finishes = state.settlement.constructionQueues.flatMap((slot, index) =>
    slot !== null && index < open ? [slot.finishesAtMs] : [],
  );
  return {
    text: 'espera os pedreiros terminarem outra obra',
    etaMs: finishes.length === 0 ? null : Math.min(...finishes) - state.lastProcessedAt,
  };
}

/** A espera de uma planejada, com o prazo ainda em ms de jogo; `null` se ela já pode começar. */
function waitingOf(
  state: GameState,
  plan: PlannedConstruction,
  rates: Record<ResourceId, number>,
  forecast: CraftForecast,
): (Waiting & { reason: PlanWait['reason'] }) | null {
  const wait = planWait(state, plan);
  if (wait === null) {
    return null;
  }
  switch (wait.reason) {
    case 'upgrading':
      return { reason: wait.reason, ...waitUpgrading(state, plan, wait) };
    case 'gate':
      return { reason: wait.reason, ...waitGate(state, plan, wait) };
    case 'capacity':
      return { reason: wait.reason, ...waitCapacity(state, plan, wait) };
    case 'resources':
      return { reason: wait.reason, ...waitResources(state, wait, rates, forecast) };
    case 'queue':
      return { reason: wait.reason, ...waitQueue(state) };
  }
}

/**
 * O que uma planejada espera, como a interface mostra: o motivo, a frase e o prazo em segundos
 * reais. `null` quando ela já pode ser iniciada. O prazo é o da espera **deste** motivo, com as
 * taxas de agora e o que o ofício muda sozinho (a adaptação que termina, a experiência que sobe
 * a cada virada do dia): é exato enquanto nada mais mudar as taxas, e a visão seguinte o corrige.
 */
export function plannedWaiting(
  state: GameState,
  plan: PlannedConstruction,
  rates: Record<ResourceId, number>,
  timeScale: number,
  forecast: CraftForecast,
): PlannedWaitingView | null {
  const waiting = waitingOf(state, plan, rates, forecast);
  if (waiting === null) {
    return null;
  }
  return {
    reason: waiting.reason,
    text: waiting.text,
    etaSeconds:
      waiting.etaMs === null ? null : Math.max(0, Math.ceil(waiting.etaMs / timeScale / SECOND_MS)),
  };
}

/**
 * Em quantos ms de jogo a espera de uma planejada acaba, pelo mesmo prazo que a interface
 * mostra: é quando uma automática deve começar sozinha. `null` quando esperar não resolve (falta
 * uma ordem do jogador, ou o recurso não está chegando); 0 quando ela já pode começar.
 */
export function planStartsIn(
  state: GameState,
  plan: PlannedConstruction,
  rates: Record<ResourceId, number>,
  forecast: CraftForecast,
): number | null {
  const waiting = waitingOf(state, plan, rates, forecast);
  return waiting === null ? 0 : waiting.etaMs;
}

/**
 * O que abre a próxima fila de obras, para a interface mostrar ao lado das filas que existem;
 * `null` quando todas já estão abertas.
 */
export function queuesNote(state: GameState): string | null {
  return queuesUnlocked(state) < balance.construction.queues ? SECOND_QUEUE_OPENS : null;
}
