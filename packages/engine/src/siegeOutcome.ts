import { settleRelicSlots } from './relicOrders';
import { balance, BUILDING_IDS, RESOURCE_IDS, siegeTexts } from '@lotg/content';

import { emit } from './chronicle';
import { DAY_MS } from './clock';
import { addMoraleEffect } from './morale';
import { releaseExcessWorkers } from './population';
import type { GameEvent, GameState } from './types';
import { MILLI } from './units';

/** Consequências da Queda, sem sorteio e sem atingir Mestres ou heróis. */
export function applySiegeFall(draft: GameState, atMs: number): Record<string, number | string> {
  const { settlement } = draft;
  const { fall } = balance.siege;
  const data: Record<string, number | string> = {};
  for (const resource of RESOURCE_IDS) {
    const lost = Math.floor(
      (settlement.resources[resource] * fall.resourcesLost.num) / fall.resourcesLost.den,
    );
    settlement.resources[resource] -= lost;
    data[`lost_${resource}`] = lost / MILLI;
  }
  const populationLost = Math.min(
    Math.floor(
      (settlement.population.villagers * fall.populationLost.num) / fall.populationLost.den,
    ),
    Math.max(0, settlement.population.villagers - balance.morale.populationFloor),
  );
  settlement.population.villagers -= populationLost;
  draft.siege!.deaths += populationLost;
  data.villagersLost = populationLost;
  const damaged = BUILDING_IDS.filter((id) => settlement.buildings[id] > 0)
    .sort(
      (a, b) =>
        settlement.buildings[b] - settlement.buildings[a] ||
        BUILDING_IDS.indexOf(a) - BUILDING_IDS.indexOf(b),
    )
    .slice(0, fall.buildingsDamaged);
  for (const [index, building] of damaged.entries()) {
    const before = settlement.buildings[building];
    settlement.buildings[building] = Math.max(1, before - fall.levelsLost);
    data[`building${index + 1}`] = building;
    data[`levelsLost${index + 1}`] = before - settlement.buildings[building];
  }
  // Não deixa a obra anterior reerguer de graça o nível que a Queda acabou de tirar (G-8).
  settlement.constructionQueues = settlement.constructionQueues.map((slot) =>
    slot !== null && damaged.includes(slot.building) ? null : slot,
  );
  const repairDelay = Math.max(0, (settlement.wallRepair?.untilMs ?? atMs) - atMs);
  settlement.wallRepair = null;
  for (const slot of settlement.constructionQueues)
    if (slot !== null) slot.finishesAtMs = Math.max(atMs, slot.finishesAtMs - repairDelay);
  settlement.wall.hp = { left: 0, center: 0, right: 0 };
  releaseExcessWorkers(draft);
  return data;
}

/** Fecha o cerco uma vez; o resultado anual é dado de estatística, sem lista de Feitos. */
export function finishSiege(draft: GameState, atMs: number, events: GameEvent[]): void {
  const siege = draft.siege!;
  const result = siege.result!;
  const data: Record<string, string | number> = {
    year: siege.year,
    waves: siege.current,
    deaths: siege.deaths,
  };
  if (result === 'fall') {
    Object.assign(data, applySiegeFall(draft, atMs));
    settleRelicSlots(draft, atMs, events);
  }
  data.deaths = siege.deaths;
  delete draft.map.tiles.hordeFortress;
  if (result === 'glorious') {
    addMoraleEffect(draft, {
      id: 'siegeFeast',
      label: siegeTexts.aftermath.feast,
      amount: balance.siege.feast.morale,
      untilMs: atMs + balance.siege.feast.days * DAY_MS,
    });
  } else if (siege.deaths > 0) {
    addMoraleEffect(draft, {
      id: 'siegeMourning',
      label: siegeTexts.aftermath.mourning,
      amount: balance.siege.mourning.morale,
      untilMs: atMs + balance.siege.mourning.days * DAY_MS,
    });
  }
  const stat =
    result === 'fall' ? 'siegesFallen' : result === 'glorious' ? 'siegesGlorious' : 'siegesWon';
  draft.stats[stat] = (draft.stats[stat] ?? 0) + 1;
  if (result === 'glorious') draft.stats.siegesWon = (draft.stats.siegesWon ?? 0) + 1;
  // Codificação de resultado para estatística (não é a pontuação da Crônica do Ano).
  draft.stats[`siegeResult:${siege.year}`] = result === 'fall' ? 0 : result === 'victory' ? 1 : 2;
  emit(
    events,
    draft,
    atMs,
    result === 'fall' ? 'siegeFell' : result === 'glorious' ? 'siegeGlorious' : 'siegeWon',
    data,
  );
}
