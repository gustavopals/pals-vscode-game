import { balance, ITEM_SLOT_IDS, type ItemSlotId } from '@lotg/content';

import { emit } from './chronicle';
import { isAtHome, isCaptive, itemDefOf } from './heroes';
import { reject } from './rejections';
import { storeResource } from './storage';
import type { GameEvent, GameState, Hero, Item, Rejection } from './types';
import { MILLI } from './units';

/**
 * O equipamento (GDD §9.1; ADR 0018, decisão 15): o arsenal do feudo, os três espaços de cada
 * herói e as duas ordens. **Sem desgaste, sem reparo e sem venda**: um item só vira ouro quando
 * não cabe no arsenal. Nada aqui sorteia, e nada aqui dá identificador: o item nasce quando uma
 * expedição o acha (`outcomes.ts`), em um instante da linha do tempo.
 */

const { equipment: rules } = balance;

export function isItemSlot(value: unknown): value is ItemSlotId {
  return (ITEM_SLOT_IDS as readonly unknown[]).includes(value);
}

/** Cabe mais um item no arsenal. */
export function inventoryHasRoom(state: GameState): boolean {
  return state.guild.inventory.length < rules.inventoryCap;
}

/**
 * Guarda um item no arsenal. Com o arsenal cheio, o item **vira ouro pelo valor do conteúdo**,
 * com linha na Crônica (o ouro não tem teto de depósito); um item que o conteúdo já não tem não
 * vale nada e some sem linha. Diz se o item ficou no arsenal.
 */
export function stowItem(draft: GameState, item: Item, atMs: number, events: GameEvent[]): boolean {
  if (inventoryHasRoom(draft)) {
    draft.guild.inventory.push(item);
    return true;
  }
  const def = itemDefOf(item);
  if (def === null) {
    return false;
  }
  storeResource(draft, 'gold', def.value * MILLI);
  draft.stats.itemsSold = (draft.stats.itemsSold ?? 0) + 1;
  emit(
    events,
    draft,
    atMs,
    'itemSold',
    { itemId: item.id, defId: item.defId, gained_gold: def.value },
    { item: def.label, preco: def.value },
  );
  return false;
}

/**
 * O que um herói levava volta ao arsenal, na ordem dos espaços: é o que acontece quando ele
 * deixa de servir ao feudo (morre, parte sem soldo, é dispensado). O que não cabe vira ouro,
 * como todo item que chega com o arsenal cheio. O herói fica sem nada.
 */
export function releaseEquipment(
  draft: GameState,
  hero: Hero,
  atMs: number,
  events: GameEvent[],
): void {
  for (const slot of ITEM_SLOT_IDS) {
    const item = hero.equipment[slot];
    if (item !== null) {
      hero.equipment[slot] = null;
      stowItem(draft, item, atMs, events);
    }
  }
}

/** Por que o herói não pode mexer no equipamento agora, ou `null` quando pode. */
function equipBlock(hero: Hero): Rejection | null {
  if (isAtHome(hero)) {
    return null;
  }
  return reject('HERO_BUSY', {
    label: hero.name,
    remedy: isCaptive(hero)
      ? 'o arsenal espera um resgate'
      : 'o arsenal espera a volta da expedição',
  });
}

/**
 * A ordem de equipar (`equipItem`). As recusas, na ordem: o herói já não serve ao feudo
 * (`HERO_NOT_FOUND`); está fora dele, em expedição ou em cativeiro (`HERO_BUSY`); o item não
 * está no arsenal, ou o conteúdo já não o tem (`ITEM_NOT_FOUND`).
 *
 * O espaço é o do item, pelo conteúdo: a ordem não o escolhe. **Equipar por cima troca**: o que
 * o herói levava naquele espaço volta ao arsenal, no lugar que o item novo deixou. Quem se
 * recupera de um ferimento pode ser equipado.
 */
export function equipItem(
  draft: GameState,
  heroId: unknown,
  itemId: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const { guild } = draft;
  const hero = guild.heroes.find((entry) => entry.id === heroId);
  if (hero === undefined) {
    return reject('HERO_NOT_FOUND');
  }
  const blocked = equipBlock(hero);
  if (blocked !== null) {
    return blocked;
  }
  const index = guild.inventory.findIndex((entry) => entry.id === itemId);
  const item = guild.inventory[index];
  const def = item === undefined ? null : itemDefOf(item);
  if (item === undefined || def === null) {
    return reject('ITEM_NOT_FOUND');
  }
  const previous = hero.equipment[def.slot];
  hero.equipment[def.slot] = item;
  if (previous === null) {
    guild.inventory.splice(index, 1);
  } else {
    guild.inventory.splice(index, 1, previous);
  }
  emit(
    events,
    draft,
    nowMs,
    'itemEquipped',
    { heroId: hero.id, itemId: item.id, defId: item.defId, slot: def.slot },
    { heroi: hero.name, item: def.label },
  );
  return null;
}

/**
 * A ordem de desequipar (`unequipItem`). As recusas, na ordem: o herói já não serve ao feudo
 * (`HERO_NOT_FOUND`); está fora dele (`HERO_BUSY`); o espaço não existe ou está vazio
 * (`WRONG_SLOT`); o arsenal está cheio (`INVENTORY_FULL`: desequipar nunca vende um item).
 */
export function unequipItem(
  draft: GameState,
  heroId: unknown,
  slot: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const { guild } = draft;
  const hero = guild.heroes.find((entry) => entry.id === heroId);
  if (hero === undefined) {
    return reject('HERO_NOT_FOUND');
  }
  const blocked = equipBlock(hero);
  if (blocked !== null) {
    return blocked;
  }
  const item = isItemSlot(slot) ? hero.equipment[slot] : null;
  if (!isItemSlot(slot) || item === null) {
    return reject('WRONG_SLOT', { label: hero.name });
  }
  if (!inventoryHasRoom(draft)) {
    return reject('INVENTORY_FULL', { count: rules.inventoryCap });
  }
  hero.equipment[slot] = null;
  guild.inventory.push(item);
  emit(
    events,
    draft,
    nowMs,
    'itemUnequipped',
    { heroId: hero.id, itemId: item.id, defId: item.defId, slot },
    { heroi: hero.name, item: itemDefOf(item)?.label ?? '' },
  );
  return null;
}
