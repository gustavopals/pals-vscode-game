import type {
  BuildingId,
  FirewoodView,
  ProductionBuildingId,
  ResourceId,
  ViewState,
} from '@lotg/engine';

import type { Policy } from './types';

/**
 * As políticas dos bots. Cada bot (`economico.ts`, `preguicoso.ts`) é uma lista delas, em ordem.
 * Uma mecânica nova entra aqui como uma política nova, com teste, e depois na lista dos bots que
 * a usam.
 *
 * Toda política tira tudo da visão, como o jogador: o que um trabalhador rende é
 * `workers[].perWorkerPerHour`, e o que o feudo come é o que a fazenda rende menos o saldo da
 * comida. Nenhuma lê `@lotg/content` nem o `GameState` (o teste "bot honesto" barra os dois):
 * um fator de fome, de estação, de moral ou de dificuldade só chega ao bot pela visão, e um
 * efeito que a visão esconde fica escondido dele também.
 */

/** Comida que o recrutamento não gasta: uma folga para a noite. */
const FOOD_RESERVE = 60;
/** Bocas a mais que a alocação por demanda alimenta, de folga. */
const SPARE_MOUTHS = 2;
/** Pesos usados quando nenhuma obra está esperando recurso. */
const IDLE_WEIGHTS: Record<Exclude<ResourceId, 'food'>, number> = { wood: 3, stone: 2, gold: 1 };
/**
 * Com quantas horas reais de antecedência o bot amplia um depósito que vai encher: o tempo de
 * uma noite fora, que é quando a produção iria para o chão sem ninguém ver.
 */
const STORAGE_HORIZON_HOURS = 8;
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

/**
 * Uma obra que o jogador ainda pode vir a iniciar só juntando recurso: não chegou ao teto, não
 * espera o Salão e o custo cabe no depósito. A que não cabe só destrava ampliando o depósito, e
 * juntar para ela seria mandar braços produzir o que vai para o chão.
 */
function reachable(upgrade: Upgrade): boolean {
  return (
    upgrade.blockedCode !== 'GATE_LOCKED' &&
    upgrade.blockedCode !== 'MAX_LEVEL' &&
    upgrade.blockedCode !== 'EXCEEDS_STORAGE'
  );
}

/** O que um trabalhador rende no edifício, por hora, como a visão mostra agora. */
function perWorker(view: ViewState, resource: ResourceId): number {
  return workplace(view, resource).perWorkerPerHour;
}

/**
 * O que cada habitante come por hora, ou `null` com o feudo vazio. A visão não traz esse
 * número; traz o que a fazenda rende e o saldo da comida, e a diferença entre os dois é o
 * consumo, já com fome, estação e o que mais vier.
 */
function eatenPerVillager(view: ViewState): number | null {
  const food = view.resources.find((row) => row.id === 'food');
  const { villagers } = view.population;
  if (food === undefined || villagers === 0) {
    return null;
  }
  return (workplace(view, 'food').grossPerHour - food.perHour) / villagers;
}

/** Horas que os braços de um edifício levariam, um a um, para render `amount`. */
function hoursPerWorker(view: ViewState, resource: ResourceId, amount: number): number {
  const rate = perWorker(view, resource);
  return rate > 0 ? amount / rate : 0;
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

/**
 * A conta da lenha que a visão traz: no inverno, o que falta queimar até a primavera; no
 * outono, a previsão do inverno inteiro. `null` quando nenhuma das duas existe.
 */
function firewoodOf(view: ViewState): FirewoodView | null {
  return view.winter?.firewood ?? view.calendar.nextSeason.firewood;
}

/**
 * Madeira que o estoque precisa ter para a lareira não apagar: o que ela vai queimar menos o
 * que a Serraria entrega no mesmo prazo, os dois números como a visão os mostra.
 */
function firewoodReserve(view: ViewState): number {
  const firewood = firewoodOf(view);
  return firewood === null ? 0 : Math.max(0, firewood.winterTotal - firewood.winterProduction);
}

/** A obra não gasta a madeira da lareira: o estoque continua cobrindo a reserva de lenha. */
function keepsFirewood(view: ViewState, upgrade: Upgrade): boolean {
  const spare = stockOf(view, 'wood') - firewoodReserve(view);
  return upgrade.cost.every((cost) => cost.resource !== 'wood' || cost.amount <= spare);
}

/**
 * Inicia a melhoria mais barata entre as que podem começar agora. Com o inverno à vista, não
 * começa obra que gaste a madeira da lareira: a que deixaria o estoque abaixo da reserva de
 * lenha fica para depois. Os depósitos (Celeiro e Armazém) ficam de fora: eles não são um fim,
 * e quem decide quando valem a obra é `ampliar o estoque`.
 */
export const obraMaisBarata: Policy = {
  name: 'obra mais barata',
  run: async (view, act) => {
    const price = (upgrade: Upgrade) => upgrade.cost.reduce((sum, cost) => sum + cost.amount, 0);
    const depots = new Set(view.resources.map((row) => row.storageBuilding));
    const [cheapest] = view.constructions.available
      .filter((upgrade) => !depots.has(upgrade.building))
      .filter((upgrade) => upgrade.blockedCode === null && keepsFirewood(view, upgrade))
      .sort((a, b) => price(a) - price(b));
    return cheapest === undefined
      ? view
      : act('startConstruction', { building: cheapest.building });
  },
};

/** Faixas de urgência de um depósito: cada uma acima de qualquer valor da seguinte. */
const URGENT = { blocksUpgrade: 3e9, wasting: 2e9, fillingSoon: 1e9 } as const;

/**
 * Os depósitos que valem uma obra agora, do mais urgente ao menos: o que trava uma obra cujo
 * custo não cabe no limite (é o que segura o progresso), o que já está cheio e perdendo
 * produção (o que perde mais primeiro) e o que enche em menos de 8 horas reais (o que enche
 * antes primeiro). Tudo lido da visão: o limite, o "cheio em" e o edifício que amplia cada
 * recurso.
 */
function storageWanted(view: ViewState): BuildingId[] {
  const wanted: Array<{ building: BuildingId; urgency: number }> = [];
  for (const upgrade of view.constructions.available) {
    if (upgrade.blockedCode !== 'EXCEEDS_STORAGE') {
      continue;
    }
    for (const cost of upgrade.cost) {
      const row = view.resources.find((entry) => entry.id === cost.resource);
      if (row?.storageBuilding != null && row.cap !== null && cost.amount > row.cap) {
        wanted.push({ building: row.storageBuilding, urgency: URGENT.blocksUpgrade });
      }
    }
  }
  for (const row of view.resources) {
    if (row.storageBuilding === null) {
      continue;
    }
    if (row.full && row.wastingPerHour > 0) {
      wanted.push({ building: row.storageBuilding, urgency: URGENT.wasting + row.wastingPerHour });
    } else if (row.fullInSeconds !== null && row.fullInSeconds < STORAGE_HORIZON_HOURS * 3600) {
      wanted.push({
        building: row.storageBuilding,
        urgency: URGENT.fillingSoon - row.fullInSeconds,
      });
    }
  }
  const ordered = wanted.sort((a, b) => b.urgency - a.urgency).map((entry) => entry.building);
  return [...new Set(ordered)];
}

/**
 * Amplia o estoque: constrói ou melhora o depósito (Celeiro ou Armazém) do recurso que está
 * cheio, que enche em menos de 8 horas reais ou cujo limite trava uma obra. Uma obra por
 * sessão, a mais urgente das que podem começar agora; se nenhuma pode (falta recurso, o Salão
 * ainda não libera, a fila está ocupada), não dá ordem, e a alocação das outras políticas junta
 * o que falta. Como `obra mais barata`, não gasta a madeira da lareira.
 *
 * Nos bots ela vem **depois** de `obra mais barata`: com uma fila só, o depósito fica com a
 * sessão em que nenhuma outra obra pôde começar. É quando ele rende: destrava a obra que não
 * cabia e guarda o que a espera produz.
 */
export const ampliarEstoque: Policy = {
  name: 'ampliar o estoque',
  run: async (view, act) => {
    for (const building of storageWanted(view)) {
      const upgrade = view.constructions.available.find((entry) => entry.building === building);
      if (upgrade !== undefined && upgrade.blockedCode === null && keepsFirewood(view, upgrade)) {
        return act('startConstruction', { building });
      }
    }
    return view;
  },
};

/**
 * Realoca todos os aldeões: primeiro os fazendeiros que alimentam o feudo, contando quem ainda
 * está chegando e duas bocas de folga; o resto vai para os materiais, em proporção ao tempo que
 * cada um levaria para cobrir o que as obras pedem.
 *
 * A folga é em bocas, e não em comida por hora, para a decisão ser a mesma em qualquer ritmo:
 * a visão traz as taxas por hora real, e o bot não sabe (nem precisa saber) qual é o ritmo.
 */
export const alocarPorDemanda: Policy = {
  name: 'alocar por demanda',
  run: async (view, act) => {
    const { villagers, inTraining } = view.population;
    const eaten = eatenPerVillager(view);
    if (eaten === null) {
      return view;
    }
    const farmYield = perWorker(view, 'food');
    const demand = (villagers + inTraining + SPARE_MOUTHS) * eaten;
    const farmers =
      farmYield > 0 ? Math.min(villagers, Math.ceil(demand / farmYield - EPSILON)) : 0;

    const deficits = materialDeficits(view);
    const hoursToCover: Record<Material, number> = {
      wood: hoursPerWorker(view, 'wood', deficits.wood),
      stone: hoursPerWorker(view, 'stone', deficits.stone),
      gold: hoursPerWorker(view, 'gold', deficits.gold),
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
 */
export const comidaPrimeiro: Policy = {
  name: 'comida primeiro',
  run: async (view, act) => {
    const farm = workplace(view, 'food');
    const { villagers, inTraining, free } = view.population;
    const eaten = eatenPerVillager(view);
    if (eaten === null || farm.perWorkerPerHour <= 0) {
      return view;
    }
    const mouthsPerHour = eaten * (villagers + inTraining);
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

/**
 * Lenha: quando a conta da visão diz que falta madeira para o inverno, manda para a Serraria os
 * braços que cobrem a falta até a estação virar. Usa primeiro quem está sem ofício e depois
 * busca nos outros materiais, a começar por quem tem mais gente; nunca tira ninguém da fazenda.
 * Sem falta, não dá ordem: no resto do ano a alocação é das outras políticas.
 *
 * Os braços saem de "o que falta ÷ (o que um lenhador rende por hora × as horas até a virada)",
 * tudo lido da visão. É de propósito uma conta folgada: no outono ela ignora o que o lenhador
 * novo ainda vai render durante o inverno.
 */
export const guardarLenha: Policy = {
  name: 'guardar lenha',
  run: async (view, act) => {
    const firewood = firewoodOf(view);
    if (firewood === null || firewood.missing <= 0) {
      return view;
    }
    const lumberMill = workplace(view, 'wood');
    const hoursLeft = view.calendar.secondsToNextSeason / 3600;
    const perLumberjack = lumberMill.perWorkerPerHour * hoursLeft;
    const donors = view.workers
      .filter((row) => row.resource !== 'food' && row.building !== lumberMill.building)
      .sort((a, b) => b.assigned - a.assigned);
    const available = view.population.free + donors.reduce((sum, row) => sum + row.assigned, 0);
    const wanted =
      perLumberjack > 0 ? Math.ceil(firewood.missing / perLumberjack - EPSILON) : available;
    const extra = Math.min(wanted, available);
    if (extra <= 0) {
      return view;
    }
    let shortfall = extra - view.population.free;
    for (const donor of donors) {
      const taken = Math.min(donor.assigned, shortfall);
      if (taken > 0) {
        await act('setWorkers', { building: donor.building, count: donor.assigned - taken });
        shortfall -= taken;
      }
    }
    return act('setWorkers', {
      building: lumberMill.building,
      count: lumberMill.assigned + extra,
    });
  },
};
