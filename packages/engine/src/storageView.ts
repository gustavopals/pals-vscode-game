import {
  balance,
  BUILDING_IDS,
  type BuildingId,
  buildings,
  craftGuilds,
  type Ratio,
} from '@lotg/content';

import { nextSeasonBoundary, seasonAfter, seasonAt, seasonWithArticle } from './clock';
import {
  buildingWithArticle,
  constructionOf,
  upgradeQuote,
  upgradeStillPossible,
} from './construction';
import { type CraftForecast, type CraftOutlook, inMs } from './craftProjection';
import { producerOf } from './economy';
import { decimal, joinList, sentenceCase, thousands } from './format';
import { planCost } from './planned';
import { recruitmentBlock } from './population';
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
 * De onde vem o limite, termo a termo: "500 iniciais", "Celeiro Nv2: 1.600" e, quando a
 * dificuldade mexe, "Celeiro Nv2: 1.600 × 0,8 (Rei de Ferro) = 1.280".
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
 * O próximo instante marcado em que o saldo de `resource` (ou o limite dele, ou o próprio
 * estoque) muda: a virada de estação, o fim de uma obra que mexe na produção ou no depósito, a
 * chegada de um aldeão, a comida ou a lenha acabando, e a planejada automática que vai começar
 * sozinha e levar o recurso. O que o ofício muda sozinho (a experiência que sobe a cada virada
 * do dia, a adaptação que termina) não é um desses instantes: todas as contas daqui já o levam
 * (`craftForecast`). A previsão de "cheio em" só vale até ele: depois, a conta é outra,
 * e a visão não adivinha (roadmap da v0.2, V2C-T2.4).
 */
function nextRateChange(
  state: GameState,
  resource: ResourceId,
  outlook: CraftOutlook,
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
  // Os três prazos abaixo já contam com o que o ofício muda sozinho no caminho (`outlook`).
  if (outlook.foodRunsOutIn !== null) {
    changes.push({ atMs: now + outlook.foodRunsOutIn, before: 'de a comida acabar' });
  }
  if (outlook.woodRunsOutIn !== null) {
    changes.push({ atMs: now + outlook.woodRunsOutIn, before: 'de a lenha acabar' });
  }
  // A próxima obra que começa sozinha paga o custo com o que está juntando.
  const { autoStart } = outlook;
  if (autoStart !== null && (planCost(autoStart.plan)[resource] ?? 0) > 0) {
    changes.push({
      atMs: now + autoStart.inMs,
      before: `do início da obra ${ofBuilding(autoStart.plan.building)}`,
    });
  }
  return changes.reduce<RateChange | null>(
    (first, change) => (first === null || change.atMs < first.atMs ? change : first),
    null,
  );
}

/**
 * Em quantos ms de jogo o estoque de `resource` enche, contando o que o ofício muda sozinho no
 * caminho (`craftForecast`). `null` quando o estoque não está subindo, ou quando não enche até
 * `untilMs`: o próximo instante que muda a taxa por outro motivo.
 */
function fillsWithCraft(
  forecast: CraftForecast,
  resource: ResourceId,
  untilMs: number,
): number | null {
  return (
    forecast.find((state, rates) => inMs(fillsIn(state, resource, rates[resource])), untilMs)
      ?.inMs ?? null
  );
}

/** "a", "a ou b", "a, b ou c": as saídas de um aviso, lado a lado. */
function joinOr(options: readonly string[]): string {
  return options.length <= 1
    ? options.join('')
    : `${options.slice(0, -1).join(', ')} ou ${options[options.length - 1]}`;
}

/**
 * Como dar destino ao que sobra de `resource`, sem contar a obra do depósito: cada saída é uma
 * ordem que o jogador sabe dar, em minúscula e sem ponto. O que alguma obra custa (madeira,
 * pedra) se gasta em obras, enquanto houver obra por fazer que o leve: "gaste madeira". O que
 * nenhuma obra custa (a comida) só sai pelo recrutamento, e só quando uma ordem cabe agora (há
 * vaga, fila e o resto do custo). A saída que está sempre à mão é tirar gente do ofício que o
 * produz, e trocar o que iria ao chão por outro recurso: é a que sobra quando o feudo já não tem
 * obra que leve o material. Mandar "gastar comida", ou "gastar madeira" sem obra nenhuma por
 * fazer, seria pedir uma ação que nenhum botão tem.
 */
function spendOptions(state: GameState, resource: ResourceId): string[] {
  const name = lower(resource);
  const moveHands = `ponha parte d${craftGuilds[producerOf(resource)].artisans} em outro ofício`;
  const payers = BUILDING_IDS.filter(
    (building) => (buildings[building].baseCost[resource] ?? 0) > 0,
  );
  if (payers.length > 0) {
    return payers.some((building) => upgradeStillPossible(state, building))
      ? [`gaste ${name}`]
      : [moveHands];
  }
  const options: string[] = [];
  if ((balance.recruitment.cost[resource] ?? 0) > 0 && recruitmentBlock(state, 1) === null) {
    options.push('recrute aldeões');
  }
  options.push(moveHands);
  return options;
}

/**
 * O que dizer de um estoque cheio. Com saldo positivo: o que vai ao chão por hora e o que
 * fazer, ampliar o depósito (o botão está na lista de obras) ou dar destino ao que sobra
 * (`spendOptions`); se o depósito ainda espera o Salão, a frase diz isso em vez de mandar
 * construí-lo, e se ele não tem mais como crescer, só o destino do que sobra. Com o estoque acima do limite e sem saldo (partida que veio de antes dos
 * limites): por que nada entra. No limite exato e sem perda, não há o que dizer.
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
  const spend = spendOptions(state, resource);
  let remedy: string;
  if (constructionOf(state, store.building) !== null) {
    remedy = `A obra ${ofBuilding(store.building)} já vai abrir espaço.`;
  } else if (
    level >= buildings[store.building].maxLevel ||
    !upgradeStillPossible(state, store.building)
  ) {
    // O depósito não tem como crescer: chegou ao teto, ou a obra dele pede mais do que ele
    // mesmo guarda. Mandar ampliá-lo seria pedir o que a lista de obras recusa.
    remedy = `${sentenceCase(joinOr(spend))}.`;
  } else if (quote.blocked?.code === 'GATE_LOCKED') {
    // O depósito ainda não pode ser erguido: a frase diz o que o libera, e o que fazer até lá.
    remedy = `${quote.blocked.message} Até lá, ${joinOr(spend)}.`;
  } else {
    const verb = level === 0 ? 'Construa' : 'Amplie';
    remedy = `${joinOr([`${verb} ${buildingWithArticle(store.building)}`, ...spend])}.`;
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
  forecast: CraftForecast,
  outlook: CraftOutlook,
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
  const rising = fillsIn(state, resource, rate) !== null;
  const change = rising ? nextRateChange(state, resource, outlook) : null;
  const fills = rising ? fillsWithCraft(forecast, resource, change?.atMs ?? Infinity) : null;
  // Subindo, mas não enche antes de a taxa mudar por outro motivo: a visão não adivinha.
  const beyond = rising && fills === null && change !== null;
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
 * 1.000." ou "Capacidade de madeira e de pedra: 500 → 1.000 cada." `null` para os outros
 * edifícios.
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
