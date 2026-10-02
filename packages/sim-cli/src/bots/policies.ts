import { balance } from '@lotg/content';
import type { ProductionBuildingId, ResourceId, ViewState } from '@lotg/engine';

import type { Policy } from './types';

/**
 * As políticas dos bots. Cada bot (`economico.ts`, `preguicoso.ts`) é uma lista delas, em ordem.
 * Uma mecânica nova entra aqui como uma política nova, com teste, e depois na lista dos bots que
 * a usam.
 *
 * `alocarPorDemanda` vem da v0.1 e ainda lê dois números de `@lotg/content`: a taxa por
 * trabalhador e o consumo por aldeão. Não lê o `GameState`. As outras políticas tiram tudo da
 * visão, e é assim que as novas devem ser: um fator de estação, de moral ou de dificuldade só
 * aparece na visão.
 */

/** Comida que o recrutamento não gasta: uma folga para a noite. */
const FOOD_RESERVE = 60;
/** Saldo mínimo de comida por hora que a alocação por demanda procura garantir. */
const FOOD_MARGIN_PER_HOUR = 2;
/** Pesos usados quando nenhuma obra está esperando recurso. */
const IDLE_WEIGHTS: Record<Exclude<ResourceId, 'food'>, number> = { wood: 3, stone: 2, gold: 1 };
/** Folga para o arredondamento das taxas da visão (uma casa decimal) não pedir um braço a mais. */
const EPSILON = 1e-9;

type Material = Exclude<ResourceId, 'food'>;
const MATERIALS: Material[] = ['wood', 'stone', 'gold'];

type Workplace = ViewState['workers'][number];
type Upgrade = ViewState['constructions']['available'][number];

function stockOf(view: ViewState, resource: ResourceId): number {
  return view.resources.find((row) => row.id === resource)?.stock ?? 0;
}

function workplace(view: ViewState, resource: ResourceId): Workplace {
  const row = view.workers.find((entry) => entry.resource === resource);
  if (row === undefined) {
    throw new Error(`Nenhum edifício produz ${resource}.`);
  }
  return row;
}

/** Uma obra que o jogador ainda pode vir a iniciar: não chegou ao teto nem espera o Salão. */
function reachable(upgrade: Upgrade): boolean {
  return upgrade.blockedCode !== 'GATE_LOCKED' && upgrade.blockedCode !== 'MAX_LEVEL';
}

/** Produção de um trabalhador no edifício, por hora de jogo, no nível atual. */
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
    if (!reachable(upgrade)) {
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

/** Recruta quantos aldeões couberem na ordem, guardando uma reserva de comida. */
export const recrutar: Policy = {
  name: 'recrutar',
  run: async (view, act) => {
    const perVillager = (resource: ResourceId) =>
      view.recruitment.cost.find((cost) => cost.resource === resource)?.amount ?? 0;
    const byFood =
      perVillager('food') === 0
        ? Infinity
        : Math.floor((stockOf(view, 'food') - FOOD_RESERVE) / perVillager('food'));
    const byGold =
      perVillager('gold') === 0
        ? Infinity
        : Math.floor(stockOf(view, 'gold') / perVillager('gold'));
    const quantity = Math.min(view.recruitment.maxQuantity, byFood, byGold);
    if (view.recruitment.blockedReason !== null && quantity < 1) {
      return view;
    }
    return quantity >= 1 ? act('recruitVillagers', { quantity }) : view;
  },
};

/** Inicia a melhoria mais barata entre as que podem começar agora. */
export const obraMaisBarata: Policy = {
  name: 'obra mais barata',
  run: async (view, act) => {
    const price = (upgrade: Upgrade) => upgrade.cost.reduce((sum, cost) => sum + cost.amount, 0);
    const [cheapest] = view.constructions.available
      .filter((upgrade) => upgrade.blockedCode === null)
      .sort((a, b) => price(a) - price(b));
    return cheapest === undefined
      ? view
      : act('startConstruction', { building: cheapest.building });
  },
};

/**
 * Realoca todos os aldeões: primeiro os fazendeiros que mantêm a comida no positivo, contando
 * quem ainda está chegando; o resto vai para os materiais, em proporção ao tempo que cada um
 * levaria para cobrir o que as obras pedem.
 */
export const alocarPorDemanda: Policy = {
  name: 'alocar por demanda',
  run: async (view, act) => {
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
        current = await act('setWorkers', {
          building: row.building,
          count: target[row.building],
        });
      }
    }
    return current;
  },
};

/**
 * Põe na fazenda os braços que faltam para a comida não cair, contando quem ainda está
 * chegando. Nunca tira ninguém da fazenda. Sem livres o bastante, busca em quem tem mais gente.
 *
 * A visão não diz quanto um aldeão come; diz o que a fazenda rende e o saldo da comida. A
 * diferença entre os dois é o consumo, já com fome, estação e o que mais vier.
 */
export const comidaPrimeiro: Policy = {
  name: 'comida primeiro',
  run: async (view, act) => {
    const farm = workplace(view, 'food');
    const food = view.resources.find((row) => row.id === 'food');
    const { villagers, inTraining, free } = view.population;
    if (food === undefined || villagers === 0 || farm.perWorkerPerHour <= 0) {
      return view;
    }
    const eatenPerHour = farm.grossPerHour - food.perHour;
    const mouthsPerHour = (eatenPerHour / villagers) * (villagers + inTraining);
    const farmers = Math.min(villagers, Math.ceil(mouthsPerHour / farm.perWorkerPerHour - EPSILON));
    if (farmers <= farm.assigned) {
      return view;
    }
    let shortfall = farmers - farm.assigned - free;
    const donors = view.workers
      .filter((row) => row.building !== farm.building)
      .sort((a, b) => b.assigned - a.assigned);
    for (const donor of donors) {
      const taken = Math.min(donor.assigned, shortfall);
      if (taken > 0) {
        await act('setWorkers', { building: donor.building, count: donor.assigned - taken });
        shortfall -= taken;
      }
    }
    return act('setWorkers', { building: farm.building, count: farmers });
  },
};

/**
 * Manda todos os aldeões sem ofício, juntos, para um só lugar: o material que mais demoraria a
 * cobrir o que falta às obras; se nada falta, o ofício com menos gente. Uma ordem só, sem
 * mexer em quem já trabalha. A fazenda fica com `comidaPrimeiro`.
 */
export const ocuparLivres: Policy = {
  name: 'ocupar os livres',
  run: async (view, act) => {
    const { free } = view.population;
    const crafts = view.workers.filter((row) => row.resource !== 'food');
    if (free === 0 || crafts.length === 0) {
      return view;
    }
    const missing = (resource: ResourceId) =>
      view.constructions.available
        .filter(reachable)
        .flatMap((upgrade) => upgrade.cost)
        .filter((cost) => cost.resource === resource)
        .reduce((sum, cost) => sum + cost.missing, 0);
    const hoursToCover = (row: Workplace) =>
      row.perWorkerPerHour > 0 ? missing(row.resource) / row.perWorkerPerHour : 0;
    const mostNeeded = crafts.reduce((best, row) =>
      hoursToCover(row) > hoursToCover(best) ? row : best,
    );
    const emptiest = crafts.reduce((best, row) => (row.assigned < best.assigned ? row : best));
    const chosen = hoursToCover(mostNeeded) > 0 ? mostNeeded : emptiest;
    return act('setWorkers', { building: chosen.building, count: chosen.assigned + free });
  },
};
