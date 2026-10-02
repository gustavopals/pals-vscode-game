import { balance, type BuildingId, buildings, type Ratio } from '@lotg/content';

import { nextSeasonBoundary, seasonAfter, seasonAt, seasonWithArticle } from './clock';
import { buildingWithArticle, constructionOf, upgradeQuote } from './construction';
import { foodRunsOutIn, producerOf, woodRunsOutIn } from './economy';
import { decimal, joinList, thousands } from './format';
import {
  fillsIn,
  isStorageFull,
  storageCapacity,
  storagePlace,
  storeCapacityUnits,
  storedBy,
  storeOf,
} from './storage';
import type { GameState, ResourceId, ViewState } from './types';
import { MILLI, SECOND_MS } from './units';

const sameRatio = (a: Ratio, b: Ratio) => a.num * b.den === b.num * a.den;
const lower = (resource: ResourceId) => balance.resources[resource].label.toLowerCase();
/** "do Celeiro", "da Serraria", "das Habitações". */
const ofBuilding = (building: BuildingId) =>
  `d${buildings[building].article} ${buildings[building].label}`;

/** O que a visão diz do armazenamento de um recurso: os campos de limite de `resources[]`. */
type StorageRow = Pick<
  ViewState['resources'][number],
  | 'cap'
  | 'capBreakdown'
  | 'storageBuilding'
  | 'storageLabel'
  | 'full'
  | 'fullInSeconds'
  | 'fullNote'
  | 'wastingPerHour'
  | 'wastedToday'
>;

/**
 * De onde vem o limite, termo a termo: "500 iniciais", "Celeiro Nv2: 1.500" e, quando a
 * dificuldade mexe, "Celeiro Nv2: 1.500 × 0,8 (Rei de Ferro) = 1.200".
 */
function capBreakdown(state: GameState, resource: ResourceId): string | null {
  const store = storeOf(resource);
  const cap = storageCapacity(state, resource);
  if (store === null || cap === null) {
    return null;
  }
  const level = state.settlement.buildings[store.building];
  const units = storeCapacityUnits(store.def, level);
  const source =
    level > 0 && units > balance.storage.baseCapacity
      ? `${buildings[store.building].label} Nv${level}: ${thousands(units)}`
      : `${thousands(units)} iniciais`;
  const difficulty = balance.difficulties[state.settings.difficulty];
  const { num, den } = difficulty.storageCapacity;
  return num === den
    ? source
    : `${source} × ${decimal(num / den)} (${difficulty.label}) = ${thousands(cap / MILLI)}`;
}

/** Algo com hora marcada que muda o saldo de um recurso, e como dizer "antes disso". */
type RateChange = { atMs: number; before: string };

/**
 * O próximo instante marcado em que o saldo de `resource` (ou o limite dele) muda: a virada de
 * estação, o fim de uma obra que mexe na produção ou no depósito, a chegada de um aldeão, a
 * comida ou a lenha acabando. A previsão de "cheio em" só vale até ele: depois, a taxa é outra,
 * e a visão não adivinha (roadmap da v0.2, V2C-T2.4).
 */
function nextRateChange(
  state: GameState,
  resource: ResourceId,
  rates: Record<ResourceId, number>,
): RateChange | null {
  const now = state.lastProcessedAt;
  const { settlement } = state;
  const season = seasonAt(now);
  const next = seasonAfter(season);
  const burns = season.effects.firewoodPerVillagerPerHour;
  const changes: RateChange[] = [];

  const seasonMoves =
    !sameRatio(season.effects.production[resource], next.effects.production[resource]) ||
    (resource === 'wood' && !sameRatio(burns, next.effects.firewoodPerVillagerPerHour)) ||
    settlement.cold !== null;
  if (seasonMoves) {
    changes.push({
      atMs: nextSeasonBoundary(now),
      before: `da virada para ${seasonWithArticle(next)}`,
    });
  }
  for (const slot of settlement.constructionQueues) {
    if (
      slot !== null &&
      (slot.building === producerOf(resource) || storedBy(slot.building).includes(resource))
    ) {
      changes.push({
        atMs: slot.finishesAtMs,
        before: `do fim da obra ${ofBuilding(slot.building)}`,
      });
    }
  }
  const recruit = settlement.recruitmentQueue[0];
  const eats = resource === 'food' || (resource === 'wood' && burns.num > 0);
  if (recruit !== undefined && !settlement.famine && eats) {
    changes.push({ atMs: recruit.finishesAtMs, before: 'da chegada do próximo aldeão' });
  }
  const foodRunsOut = foodRunsOutIn(state, rates);
  if (foodRunsOut !== null) {
    changes.push({ atMs: now + foodRunsOut, before: 'de a comida acabar' });
  }
  const woodRunsOut = woodRunsOutIn(state, rates);
  if (woodRunsOut !== null) {
    changes.push({ atMs: now + woodRunsOut, before: 'de a lenha acabar' });
  }
  return changes.reduce<RateChange | null>(
    (first, change) => (first === null || change.atMs < first.atMs ? change : first),
    null,
  );
}

/**
 * O que dizer de um estoque cheio. Com saldo positivo: o que vai ao chão por hora e o que
 * fazer, ampliar o depósito (o botão está na lista de obras) ou gastar; se o depósito ainda
 * espera o Salão, a frase diz isso em vez de mandar construí-lo. Com o estoque acima do
 * limite e sem saldo (partida que veio de antes dos limites): por que nada entra. No limite
 * exato e sem perda, não há o que dizer.
 */
function fullNote(
  state: GameState,
  resource: ResourceId,
  wastingPerHour: number,
  cap: number,
): string | null {
  const store = storeOf(resource);
  const place = storagePlace(state, resource);
  if (store === null || place === null) {
    return null;
  }
  const name = lower(resource);
  const title = `${place.label} ${place.article.startsWith('a') ? 'cheia' : 'cheio'}`;
  if (wastingPerHour <= 0) {
    return state.settlement.resources[resource] > cap
      ? `${title}: há mais ${name} do que cabe, e nada entra até o estoque baixar de ${thousands(cap / MILLI)}.`
      : null;
  }
  const level = state.settlement.buildings[store.building];
  const quote = upgradeQuote(state, store.building);
  let remedy: string;
  if (constructionOf(state, store.building) !== null) {
    remedy = `A obra ${ofBuilding(store.building)} já vai abrir espaço.`;
  } else if (level >= buildings[store.building].maxLevel) {
    remedy = `Gaste ${name}.`;
  } else if (quote.blocked?.code === 'GATE_LOCKED') {
    // O depósito ainda não pode ser erguido: a frase diz o que o libera, e o que fazer até lá.
    remedy = `${quote.blocked.message} Até lá, gaste ${name}.`;
  } else {
    const verb = level === 0 ? 'Construa' : 'Amplie';
    remedy = `${verb} ${buildingWithArticle(store.building)} ou gaste ${name}.`;
  }
  return `${title}: ${decimal(wastingPerHour)}/h de ${name} indo ao chão. ${remedy}`;
}

/**
 * Os campos de armazenamento de um recurso na visão, em tempo real: limite, de onde ele vem,
 * se está cheio, em quanto tempo enche e o que se perde.
 */
export function storageRow(
  state: GameState,
  resource: ResourceId,
  rates: Record<ResourceId, number>,
  timeScale: number,
): StorageRow {
  const cap = storageCapacity(state, resource);
  const store = storeOf(resource);
  if (cap === null || store === null) {
    return {
      cap: null,
      capBreakdown: null,
      storageBuilding: null,
      storageLabel: null,
      full: false,
      fullInSeconds: null,
      fullNote: null,
      wastingPerHour: 0,
      wastedToday: 0,
    };
  }
  const full = isStorageFull(state, resource);
  const rate = rates[resource];
  // Mesmo arredondamento de `perHour`: uma casa decimal, por hora real.
  const wastingPerHour = full && rate > 0 ? Math.round((rate * timeScale) / 100) / 10 : 0;
  const fills = fillsIn(state, resource, rate);
  const change = fills === null ? null : nextRateChange(state, resource, rates);
  const beyond = fills !== null && change !== null && state.lastProcessedAt + fills > change.atMs;
  let note: string | null = null;
  if (full) {
    note = fullNote(state, resource, wastingPerHour, cap);
  } else if (beyond && change !== null) {
    note = `Não enche antes ${change.before}.`;
  }
  return {
    cap: Math.floor(cap / MILLI),
    capBreakdown: capBreakdown(state, resource),
    storageBuilding: store.building,
    storageLabel: storagePlace(state, resource)?.label ?? null,
    full,
    fullInSeconds:
      fills === null || beyond ? null : Math.max(0, Math.ceil(fills / timeScale / SECOND_MS)),
    fullNote: note,
    wastingPerHour,
    wastedToday: Math.floor(state.settlement.wasted[resource] / MILLI),
  };
}

/**
 * O que a obra de um depósito muda, para ficar ao lado do custo: "Capacidade de comida: 500 →
 * 900." ou "Capacidade de madeira e de pedra: 500 → 900 cada." `null` para os outros edifícios.
 */
export function storageEffect(
  state: GameState,
  building: BuildingId,
  targetLevel: number,
): string | null {
  const resources = storedBy(building);
  const [first] = resources;
  if (first === undefined) {
    return null;
  }
  const units = (level: number) => thousands((storageCapacity(state, first, level) ?? 0) / MILLI);
  const names = joinList(resources.map((resource) => `de ${lower(resource)}`));
  const each = resources.length > 1 ? ' cada' : '';
  return `Capacidade ${names}: ${units(targetLevel - 1)} → ${units(targetLevel)}${each}.`;
}
