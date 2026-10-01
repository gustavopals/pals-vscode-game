import { balance } from '@lotg/content';
import type { ProductionBuildingId, ResourceId, ViewState } from '@lotg/engine';

import type { Act, Bot } from './types';

/** Comida que o bot não gasta com recrutamento: uma folga para a noite. */
const FOOD_RESERVE = 60;
/** Saldo mínimo de comida por hora que a alocação procura garantir. */
const FOOD_MARGIN_PER_HOUR = 2;
/** Pesos usados quando nenhuma obra está esperando recurso. */
const IDLE_WEIGHTS: Record<Exclude<ResourceId, 'food'>, number> = { wood: 3, stone: 2, gold: 1 };

type Material = Exclude<ResourceId, 'food'>;
const MATERIALS: Material[] = ['wood', 'stone', 'gold'];

function stockOf(view: ViewState, resource: ResourceId): number {
  return view.resources.find((row) => row.id === resource)?.stock ?? 0;
}

function workplace(view: ViewState, resource: ResourceId): ViewState['workers'][number] {
  const row = view.workers.find((entry) => entry.resource === resource);
  if (row === undefined) {
    throw new Error(`Nenhum edifício produz ${resource}.`);
  }
  return row;
}

/** Produção de um trabalhador no edifício, por hora, no nível atual. */
function perWorker(view: ViewState, resource: ResourceId): number {
  const { building, level } = workplace(view, resource);
  const { levelBonus, perWorkerPerHour } = balance.production;
  return (
    (perWorkerPerHour[building] * (levelBonus.den + levelBonus.num * (level - 1))) / levelBonus.den
  );
}

/** Quanto de cada material falta para pagar todas as obras que só esperam recurso. */
function materialDeficits(view: ViewState): Record<Material, number> {
  const needed: Record<Material, number> = { wood: 0, stone: 0, gold: 0 };
  for (const upgrade of view.constructions.available) {
    if (upgrade.blockedCode === 'GATE_LOCKED' || upgrade.blockedCode === 'MAX_LEVEL') {
      continue;
    }
    for (const cost of upgrade.cost) {
      if (cost.resource !== 'food') {
        needed[cost.resource] += cost.amount;
      }
    }
  }
  return {
    wood: Math.max(0, needed.wood - stockOf(view, 'wood')),
    stone: Math.max(0, needed.stone - stockOf(view, 'stone')),
    gold: Math.max(0, needed.gold - stockOf(view, 'gold')),
  };
}

/** Reparte `hands` trabalhadores em proporção aos pesos, pelo método dos maiores restos. */
function share(hands: number, weights: Record<Material, number>): Record<Material, number> {
  const total = MATERIALS.reduce((sum, id) => sum + weights[id], 0);
  const exact = MATERIALS.map((id) => ({ id, value: (hands * weights[id]) / total }));
  const result: Record<Material, number> = { wood: 0, stone: 0, gold: 0 };
  let assigned = 0;
  for (const entry of exact) {
    result[entry.id] = Math.floor(entry.value);
    assigned += result[entry.id];
  }
  const byRemainder = [...exact].sort(
    (a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)),
  );
  for (let index = 0; assigned < hands; index += 1, assigned += 1) {
    const entry = byRemainder[index % byRemainder.length];
    if (entry !== undefined) {
      result[entry.id] += 1;
    }
  }
  return result;
}

/**
 * Realoca todos os aldeões: primeiro os fazendeiros que mantêm a comida no positivo, contando
 * quem ainda está chegando; o resto vai para os materiais, em proporção ao tempo que cada um
 * levaria para cobrir o que as obras pedem.
 */
async function allocate(view: ViewState, act: Act): Promise<ViewState> {
  const { villagers, inTraining } = view.population;
  const mouths = (villagers + inTraining) * balance.consumption.foodPerVillagerPerHour;
  const farmers = Math.min(
    villagers,
    Math.ceil((mouths + FOOD_MARGIN_PER_HOUR) / perWorker(view, 'food')),
  );

  const deficits = materialDeficits(view);
  const hoursToCover: Record<Material, number> = {
    wood: deficits.wood / perWorker(view, 'wood'),
    stone: deficits.stone / perWorker(view, 'stone'),
    gold: deficits.gold / perWorker(view, 'gold'),
  };
  const waiting = MATERIALS.some((id) => hoursToCover[id] > 0);
  const hands = share(villagers - farmers, waiting ? hoursToCover : IDLE_WEIGHTS);

  const target: Record<ProductionBuildingId, number> = {
    farm: farmers,
    lumberMill: hands.wood,
    quarry: hands.stone,
    goldMine: hands.gold,
  };
  // Primeiro libera quem sobra, depois preenche: assim nenhuma ordem esbarra na falta de livres.
  const rows = [...view.workers].sort(
    (a, b) => target[a.building] - a.assigned - (target[b.building] - b.assigned),
  );
  let current = view;
  for (const row of rows) {
    if (target[row.building] !== row.assigned) {
      current = await act('setWorkers', { building: row.building, count: target[row.building] });
    }
  }
  return current;
}

async function recruit(view: ViewState, act: Act): Promise<ViewState> {
  const perVillager = (resource: ResourceId) =>
    view.recruitment.cost.find((cost) => cost.resource === resource)?.amount ?? 0;
  const byFood =
    perVillager('food') === 0
      ? Infinity
      : Math.floor((stockOf(view, 'food') - FOOD_RESERVE) / perVillager('food'));
  const byGold =
    perVillager('gold') === 0 ? Infinity : Math.floor(stockOf(view, 'gold') / perVillager('gold'));
  const quantity = Math.min(view.recruitment.maxQuantity, byFood, byGold);
  if (view.recruitment.blockedReason !== null && quantity < 1) {
    return view;
  }
  return quantity >= 1 ? act('recruitVillagers', { quantity }) : view;
}

/** Inicia a melhoria mais barata entre as que podem começar agora. */
async function build(view: ViewState, act: Act): Promise<ViewState> {
  const price = (upgrade: ViewState['constructions']['available'][number]) =>
    upgrade.cost.reduce((sum, cost) => sum + cost.amount, 0);
  const [cheapest] = view.constructions.available
    .filter((upgrade) => upgrade.blockedCode === null)
    .sort((a, b) => price(a) - price(b));
  return cheapest === undefined ? view : act('startConstruction', { building: cheapest.building });
}

/**
 * Bot econômico: a cada sessão recruta quando há vaga e comida de sobra, inicia a melhoria mais
 * barata disponível e realoca os aldeões para o que as próximas obras pedem.
 */
export const economico: Bot = async (view, act) => {
  let current = await recruit(view, act);
  current = await build(current, act);
  await allocate(current, act);
};
