import {
  balance,
  type BuildingId,
  buildings,
  RESOURCE_IDS,
  type ResourceAmounts,
  type StorageDef,
} from '@lotg/content';

import { emit } from './chronicle';
import { calendarAt, ofSeason } from './clock';
import { joinList, thousands } from './format';
import type { GameEvent, GameState, ResourceId } from './types';
import { HOUR_MS, MILLI, positiveEntries } from './units';

/**
 * Armazenamento (GDD §5.5; ADR 0013, decisões 4 e 17). **Toda entrada de recurso passa por
 * aqui**: a produção contínua (`applyContinuous`) e os ganhos discretos (recompensa de objetivo,
 * devolução de cancelamento). O que não cabe é desperdício contado, nunca um estoque acima do
 * limite. Saídas (custos, consumo, lenha) não passam: um estoque acima do limite, herdado de
 * antes dos limites, pode ser gasto e cai normalmente.
 */

type Store = { building: BuildingId; def: StorageDef };

const stores: Partial<Record<ResourceId, Store>> = {};
for (const [building, def] of Object.entries(balance.storage.buildings)) {
  for (const resource of def.resources) {
    stores[resource] = { building: building as BuildingId, def };
  }
}

/** O edifício que guarda um recurso e os números dele; `null` para o que não tem limite. */
export function storeOf(resource: ResourceId): Store | null {
  return stores[resource] ?? null;
}

/** Os recursos que um edifício guarda; vazio para quem não é depósito. */
export function storedBy(building: BuildingId): readonly ResourceId[] {
  return balance.storage.buildings[building]?.resources ?? [];
}

/**
 * Capacidade de um depósito em um nível, em unidades e antes do fator da dificuldade: o que o
 * edifício guarda, e nunca menos que a capacidade inicial. No nível 0 é a inicial.
 */
export function storeCapacityUnits(def: StorageDef, level: number): number {
  const built = level > 0 ? def.level1 + def.perLevel * (level - 1) : 0;
  return Math.max(balance.storage.baseCapacity, built);
}

/**
 * Limite do estoque de um recurso, em milésimos, arredondado para baixo; `null` para o que não
 * tem limite. Derivado do nível do depósito e da dificuldade, nunca guardado. `level` permite
 * perguntar "e com o depósito no nível tal?".
 */
export function storageCapacity(
  state: GameState,
  resource: ResourceId,
  level?: number,
): number | null {
  const store = storeOf(resource);
  if (store === null) {
    return null;
  }
  const { num, den } = balance.difficulties[state.settings.difficulty].storageCapacity;
  const units = storeCapacityUnits(store.def, level ?? state.settlement.buildings[store.building]);
  return Math.floor((units * MILLI * num) / den);
}

/** O estoque está no limite, ou acima dele (estoque herdado de antes dos limites). */
export function isStorageFull(state: GameState, resource: ResourceId): boolean {
  const cap = storageCapacity(state, resource);
  return cap !== null && state.settlement.resources[resource] >= cap;
}

/** Os recursos com o estoque no limite ou acima, na ordem canônica. */
export function fullStores(state: GameState): ResourceId[] {
  return RESOURCE_IDS.filter((id) => isStorageFull(state, id));
}

/**
 * Quanto de um ganho de `milli` entraria no estoque agora: tudo, para o que não tem limite; o
 * que cabe até o limite, para o resto; nada, com o estoque já no limite ou acima.
 */
export function storable(state: GameState, resource: ResourceId, milli: number): number {
  const cap = storageCapacity(state, resource);
  if (cap === null) {
    return milli;
  }
  return Math.min(milli, Math.max(0, cap - state.settlement.resources[resource]));
}

/**
 * Guarda `milli` de um recurso: entra o que cabe, e o que não cabe é desperdício, somado ao
 * total de sempre (`stats.wasted_<recurso>`) e ao que a Crônica ainda vai contar. Devolve o que
 * entrou. Como cortar no limite é associativo, guardar `a + b` de uma vez dá o mesmo estoque e
 * o mesmo desperdício que guardar `a` e depois `b`: é o que mantém a divisão de intervalo exata.
 */
export function storeResource(draft: GameState, resource: ResourceId, milli: number): number {
  if (milli <= 0) {
    return 0;
  }
  const stored = storable(draft, resource, milli);
  const lost = milli - stored;
  draft.settlement.resources[resource] += stored;
  if (lost > 0) {
    const stat = `wasted_${resource}`;
    draft.stats[stat] = (draft.stats[stat] ?? 0) + lost;
    draft.settlement.wasted[resource] += lost;
  }
  return stored;
}

/**
 * Credita um ganho discreto, em unidades (recompensa de objetivo), cortado no limite de cada
 * recurso. Devolve o que entrou de fato, em milésimos.
 */
export function grantResources(
  draft: GameState,
  amounts: ResourceAmounts,
): Record<ResourceId, number> {
  const stored: Record<ResourceId, number> = { food: 0, wood: 0, stone: 0, gold: 0 };
  for (const [resource, amount] of positiveEntries(amounts)) {
    stored[resource] = storeResource(draft, resource, amount * MILLI);
  }
  return stored;
}

/**
 * Milissegundos até o estoque de um recurso chegar ao limite, com o saldo `rate` (milésimos por
 * hora de jogo): o menor intervalo em que a parte inteira do que foi produzido cobre o que
 * falta. `null` sem limite, sem saldo positivo ou com o estoque já no limite. É sempre ao menos
 * 1: falta ao menos um milésimo, e o resto guardado é menor que isso.
 */
export function fillsIn(state: GameState, resource: ResourceId, rate: number): number | null {
  const cap = storageCapacity(state, resource);
  const { resources, accumulators } = state.settlement;
  if (cap === null || rate <= 0 || resources[resource] >= cap) {
    return null;
  }
  return Math.ceil(((cap - resources[resource]) * HOUR_MS - accumulators[resource]) / rate);
}

/** Milissegundos até o primeiro estoque encher: um candidato de `nextEventAt`. */
export function storageFillsIn(state: GameState, rates: Record<ResourceId, number>): number | null {
  let soonest: number | null = null;
  for (const id of RESOURCE_IDS) {
    const fills = fillsIn(state, id, rates[id]);
    if (fills !== null && (soonest === null || fills < soonest)) {
      soonest = fills;
    }
  }
  return soonest;
}

/** Onde um recurso fica hoje: o depósito, ou o lugar de antes de ele existir. */
export function storagePlace(
  state: GameState,
  resource: ResourceId,
): { label: string; article: 'o' | 'a' | 'os' | 'as' } | null {
  const store = storeOf(resource);
  if (store === null) {
    return null;
  }
  return state.settlement.buildings[store.building] > 0
    ? buildings[store.building]
    : store.def.unbuilt;
}

/**
 * Registra os estoques que encheram neste instante: `storageFilled`, uma vez por episódio.
 *
 * `alreadyFull` são os recursos que já estavam no limite no instante anterior em repouso **e**
 * continuaram nele depois do trecho de produção: para esses o episódio é o mesmo e não há linha
 * nova. Não é preciso guardar nada no estado: em repouso, "cheio" é o próprio estoque. O que
 * importa é conferir de novo depois do trecho contínuo, porque um estoque que caiu abaixo do
 * limite no meio do trecho (a comida, com o saldo negativo) e voltou a ele por um ganho neste
 * instante começou outro episódio, tenha o intervalo sido cortado no meio ou não.
 *
 * Roda no fim do instante, depois das obras: um depósito ampliado no mesmo instante em que o
 * estoque chegaria ao limite antigo não enche.
 */
export function announceFilled(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  alreadyFull: readonly ResourceId[],
): void {
  for (const resource of fullStores(draft)) {
    if (alreadyFull.includes(resource)) {
      continue;
    }
    const store = storeOf(resource);
    const place = storagePlace(draft, resource);
    if (store === null || place === null) {
      continue;
    }
    emit(
      events,
      draft,
      atMs,
      'storageFilled',
      {
        resource,
        building: store.building,
        level: draft.settlement.buildings[store.building],
        cap: Math.floor((storageCapacity(draft, resource) ?? 0) / MILLI),
      },
      {
        deposito: `${place.article} ${place.label}`,
        recurso: balance.resources[resource].label.toLowerCase(),
      },
    );
  }
}

/**
 * O fecho do dia: se o dia que acabou teve ao menos uma unidade inteira de desperdício em algum
 * recurso, **um** evento `storageWasted` com as unidades por recurso (`wasted_<recurso>`). O
 * que foi relatado sai do contador; a fração de unidade fica para o dia seguinte, e por isso a
 * soma dos eventos mais o contador é sempre o total de `stats.wasted_<recurso>`.
 */
export function reportWaste(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { wasted } = draft.settlement;
  const lost: ResourceAmounts = {};
  const data: Record<string, number> = {};
  for (const id of RESOURCE_IDS) {
    const units = Math.floor(wasted[id] / MILLI);
    if (units > 0) {
      lost[id] = units;
      data[`wasted_${id}`] = units;
      wasted[id] -= units * MILLI;
    }
  }
  if (Object.keys(lost).length === 0) {
    return;
  }
  // A conta é do dia que acabou: a frase leva a data dele, não a do dia que amanhece.
  const closed = calendarAt(atMs - 1);
  emit(events, draft, atMs, 'storageWasted', data, {
    dia: closed.dayOfSeason,
    daEstacao: ofSeason(closed.season),
    perda: describeLoss(lost),
  });
}

/** "120 de comida e 40 de madeira". */
export function describeLoss(amounts: ResourceAmounts): string {
  return joinList(
    positiveEntries(amounts).map(
      ([id, amount]) => `${thousands(amount)} de ${balance.resources[id].label.toLowerCase()}`,
    ),
  );
}

/** Um custo que falta e que nunca vai caber no depósito, por mais que se espere. */
export type BeyondStorage = {
  resource: ResourceId;
  /** Quanto a obra pede, em unidades. */
  amount: number;
  /** Quanto o depósito guarda hoje, em unidades. */
  capacity: number;
  /** O edifício que ampliaria o limite. */
  building: BuildingId;
};

/**
 * O primeiro recurso de um custo que o estoque não tem e que não cabe no limite de hoje:
 * esperar não resolve, é preciso ampliar o depósito. Um estoque herdado que já cobre o custo
 * não conta: quem tem, pode gastar.
 */
export function costBeyondStorage(state: GameState, cost: ResourceAmounts): BeyondStorage | null {
  for (const [resource, amount] of positiveEntries(cost)) {
    const cap = storageCapacity(state, resource);
    const store = storeOf(resource);
    if (cap === null || store === null) {
      continue;
    }
    if (amount * MILLI > cap && state.settlement.resources[resource] < amount * MILLI) {
      return { resource, amount, capacity: Math.floor(cap / MILLI), building: store.building };
    }
  }
  return null;
}
