import type {
  BuildingId,
  FirewoodView,
  ProductionBuildingId,
  ResourceId,
  ViewState,
} from '@lotg/engine';

import type { Act, Policy } from './types';

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
/**
 * A partir de quantos aldeões o bot deixa uma cama vazia nas Habitações. Com as casas cheias a
 * moral cai, e com ela a produção de todo mundo; em um feudo deste tamanho isso pesa mais do
 * que um aldeão a mais. Abaixo disso, cada par de braços rende mais do que a moral tira.
 */
const SPARE_BED_FROM = 20;
/** Bocas a mais que a alocação por demanda alimenta, de folga. */
const SPARE_MOUTHS = 2;
/** Pesos usados quando nenhuma obra está esperando recurso. */
const IDLE_WEIGHTS: Record<Exclude<ResourceId, 'food'>, number> = { wood: 3, stone: 2, gold: 1 };
/**
 * Com quantas horas reais de antecedência o bot amplia um depósito que vai encher: o tempo de
 * uma noite fora, que é quando a produção iria para o chão sem ninguém ver.
 */
const STORAGE_HORIZON_HOURS = 8;
/**
 * Por quantas horas reais o bot deixa o feudo arrumado antes de sair, quando ninguém diz outra
 * coisa: o tempo até a visita seguinte de quem joga duas vezes por dia. Um jogador sabe quando
 * volta; o bot recebe esse prazo de quem o monta (`alocarPorDemandaFor`), e com ele só deixa em
 * um ofício os braços cuja produção tem para onde ir até lá. O resto iria ao chão.
 */
export const DEFAULT_AWAY_HOURS = 12;
/** Folga para o arredondamento das taxas da visão (uma casa decimal) não pedir um braço a mais. */
const EPSILON = 1e-9;
/**
 * Fazendeiros além da conta que o bot deixa onde estão: tirar um para devolvê-lo na visita
 * seguinte custaria duas adaptações.
 */
const FARM_SLACK = 1;
/**
 * Trocar alguém de ofício só compensa se o destino ainda vai precisar dos braços por este
 * múltiplo do tempo de adaptação: quem chega rende metade enquanto se adapta, e uma falta que
 * se cobre antes disso não paga a troca.
 */
const SWITCH_PAYBACK = 2;

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

/** Os edifícios de depósito, como a visão os aponta em cada recurso com limite. */
function depotsOf(view: ViewState): Set<BuildingId | null> {
  return new Set(view.resources.map((row) => row.storageBuilding));
}

/**
 * Os depósitos que travam uma obra: o custo dela não cabe no limite de um recurso
 * (`EXCEEDS_STORAGE`), e é o edifício que a visão aponta para esse recurso que o amplia.
 */
function blockingDepots(view: ViewState): BuildingId[] {
  const blocking: BuildingId[] = [];
  for (const upgrade of view.constructions.available) {
    if (upgrade.blockedCode !== 'EXCEEDS_STORAGE') {
      continue;
    }
    for (const cost of upgrade.cost) {
      const row = view.resources.find((entry) => entry.id === cost.resource);
      if (row?.storageBuilding != null && row.cap !== null && cost.amount > row.cap) {
        blocking.push(row.storageBuilding);
      }
    }
  }
  return blocking;
}

/**
 * Os edifícios que não entram na corrida das obras: cada um tem a política que decide quando
 * ele vale a obra. São os depósitos (`ampliar o estoque`), a Torre de Vigia (`erguer a Torre`)
 * e a Paliçada (`erguer a Paliçada`), como a visão os aponta: o edifício que amplia cada
 * recurso, o edifício da Torre e o da defesa.
 */
function sideBuildings(view: ViewState): Set<BuildingId | null> {
  return new Set([
    ...depotsOf(view),
    view.threat.watchtower.building,
    view.threat.defense.building,
  ]);
}

/**
 * As obras da lista que são obra por fazer. O Celeiro, o Armazém, a Torre de Vigia e a Paliçada
 * não são um fim: só contam quando já estão entre as planejadas ou, os depósitos, quando travam
 * outra obra. Ampliar um depósito só para guardar o que não tem onde ser gasto não é progresso,
 * a Torre só é erguida com o que sobra, e a Paliçada, quando os vigias dizem que há risco.
 */
function wantedUpgrades(view: ViewState): Upgrade[] {
  const aside = sideBuildings(view);
  const blocking = blockingDepots(view);
  return view.constructions.available.filter(
    (upgrade) =>
      upgrade.planned || !aside.has(upgrade.building) || blocking.includes(upgrade.building),
  );
}

/** Soma, por material, o custo das obras de `upgrades`. */
function costsOf(upgrades: readonly Upgrade[]): Record<Material, number> {
  const total: Record<Material, number> = { wood: 0, stone: 0, gold: 0 };
  for (const upgrade of upgrades) {
    for (const cost of upgrade.cost) {
      if (cost.resource !== 'food') {
        total[cost.resource] += cost.amount;
      }
    }
  }
  return total;
}

/** Quanto de cada material as obras que só esperam recurso pedem, ao todo. */
function materialNeeds(view: ViewState): Record<Material, number> {
  return costsOf(wantedUpgrades(view).filter(reachable));
}

/**
 * Quanto de cada material falta para pagar as obras que só esperam recurso. É o que dá o peso
 * de cada ofício na partilha dos braços; o que impede a produção de ir ao chão é o limite de
 * cada um (`handsThatFit`).
 */
function materialDeficits(view: ViewState): Record<Material, number> {
  const needed = materialNeeds(view);
  return {
    wood: Math.max(0, needed.wood - stockOf(view, 'wood')),
    stone: Math.max(0, needed.stone - stockOf(view, 'stone')),
    gold: Math.max(0, needed.gold - stockOf(view, 'gold')),
  };
}

/** Os motivos de bloqueio que esperar não resolve: teto, nível de outro edifício, depósito. */
const DEAD_ENDS: ReadonlySet<string> = new Set(['MAX_LEVEL', 'GATE_LOCKED', 'EXCEEDS_STORAGE']);

function deadEnd(upgrade: Upgrade): boolean {
  return upgrade.blockedCode !== null && DEAD_ENDS.has(upgrade.blockedCode);
}

/**
 * O feudo não tem mais o que construir: nenhuma obra em curso e, na lista, só o que esperar não
 * resolve (o edifício chegou ao teto, está preso ao Salão que não sobe, ou o custo não cabe em
 * depósito nenhum). Um edifício preso ao Salão não conta enquanto o Salão puder subir, nem um
 * custo que não cabe enquanto o depósito puder ser ampliado: aí a obra do Salão ou do depósito
 * ainda está na lista, esperando recurso ou fila.
 *
 * Um depósito que ninguém planejou e que não trava obra nenhuma também não conta
 * (`wantedUpgrades`): ampliar o Celeiro ou o Armazém só para guardar o que não tem onde ser
 * gasto não é obra por fazer. O depósito que trava outra obra conta, até chegar ao teto. Sem
 * lista de obras não há o que concluir, e a resposta é não.
 */
export function nothingLeftToBuild(view: ViewState): boolean {
  const { queues, available } = view.constructions;
  return (
    available.length > 0 &&
    queues.every((slot) => slot === null) &&
    wantedUpgrades(view).every(deadEnd)
  );
}

/**
 * O Salão ainda pode subir: está em obras, ou a obra dele não é das que esperar não resolve. É
 * ele que segura as obras que a lista mostra presas a outro edifício.
 */
function townHallCanRise(view: ViewState): boolean {
  const { queues, available } = view.constructions;
  const upgrade = available.find((entry) => entry.building === 'townHall');
  return (
    queues.some((slot) => slot?.building === 'townHall') ||
    (upgrade !== undefined && !deadEnd(upgrade))
  );
}

/**
 * Quanto de cada material as obras da lista podem tirar do estoque até a próxima visita: as que
 * só esperam recurso e as que esperam o Salão, enquanto ele puder subir (as planejadas
 * automáticas começam sozinhas assim que ele chega). Cada obra conta uma vez: o nível seguinte
 * só entra na lista na visita seguinte.
 */
function spendableBy(view: ViewState): Record<Material, number> {
  const gateOpens = townHallCanRise(view);
  return costsOf(
    wantedUpgrades(view).filter(
      (upgrade) => reachable(upgrade) || (upgrade.blockedCode === 'GATE_LOCKED' && gateOpens),
    ),
  );
}

/**
 * Quantos braços cabem em um ofício sem a produção ir ao chão durante a ausência. O que eles
 * rendem em `awayHours` tem para onde ir: o espaço que resta no depósito, o que as obras da
 * lista ainda podem levar (`spendable`) e o que sai sozinho no mesmo prazo (a comida que o
 * feudo come, a madeira da lareira: o que o edifício rende menos o saldo do recurso).
 * `Infinity` para o que não tem limite. Tudo lido da visão, em horas reais.
 */
function handsThatFit(
  view: ViewState,
  resource: ResourceId,
  awayHours: number,
  spendable = 0,
): number {
  const row = view.resources.find((entry) => entry.id === resource);
  const place = workplace(view, resource);
  if (row === undefined || row.cap === null || place.perWorkerPerHour <= 0) {
    return Infinity;
  }
  const leaving = Math.max(0, place.grossPerHour - row.perHour);
  const room = Math.max(0, row.cap - row.stock);
  return Math.floor(((room + spendable) / awayHours + leaving) / place.perWorkerPerHour + EPSILON);
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
 * Recruta quantos aldeões couberem na ordem, guardando uma reserva de comida. Com gente
 * bastante, deixa uma cama vazia nas Habitações: com as casas cheias a moral cai (a visão
 * mostra o termo), e a queda custa a todos os ofícios mais do que o último par de braços rende.
 */
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
    const { villagers, vacancies } = view.population;
    const beds = villagers >= SPARE_BED_FROM ? vacancies - 1 : vacancies;
    const quantity = Math.min(view.recruitment.maxQuantity, byFood, byGold, beds);
    return quantity >= 1 ? act('recruitVillagers', { quantity }) : view;
  },
};

type CardOption = ViewState['council']['pending'][number]['options'][number];

/**
 * Quanto do estoque uma opção de carta pode levar: o bot só paga a opção cujo custo cabe três
 * vezes em cada recurso que ela pede. É a folga de quem gasta com o povo o que sobra, e nunca
 * o que as obras, a mesa e a lareira esperam.
 */
const CARD_SPEND_SHARE = 3;

/** O preço de uma opção de carta: a soma do que ela custa. */
function optionPrice(option: CardOption): number {
  return option.cost.reduce((sum, cost) => sum + cost.amount, 0);
}

/**
 * O que a próxima obra do feudo pede de um recurso: a mais barata entre as que só esperam
 * recurso ou fila, que é a que o bot inicia primeiro (`obra mais barata`). Zero sem nenhuma.
 */
function nextUpgradeNeeds(view: ViewState, resource: ResourceId): number {
  const [next] = view.constructions.available
    .filter((upgrade) => reachable(upgrade) && upgrade.blockedCode !== 'ALREADY_UPGRADING')
    .sort((a, b) => price(a) - price(b));
  return next?.cost.find((cost) => cost.resource === resource)?.amount ?? 0;
}

/**
 * A opção cabe com folga: cada recurso do custo está entrando (o saldo por hora é positivo: o
 * que se gasta volta), o estoque é ao menos o triplo do custo, e o que sobra depois de pagar
 * ainda cobre o que já tem dono: a próxima obra, a reserva de comida do recrutamento e a
 * madeira que a lareira vai queimar (a conta da lenha da visão). Com fome, a comida não vai
 * para carta nenhuma.
 */
function affordsWithSlack(view: ViewState, option: CardOption): boolean {
  return option.cost.every(({ resource, amount }) => {
    const row = view.resources.find((entry) => entry.id === resource);
    const stock = row?.stock ?? 0;
    const left = stock - amount;
    if (row === undefined || row.perHour <= 0) {
      return false;
    }
    if (stock < CARD_SPEND_SHARE * amount || left < nextUpgradeNeeds(view, resource)) {
      return false;
    }
    if (resource === 'food') {
      return left >= FOOD_RESERVE && view.famine === null;
    }
    return resource !== 'wood' || left >= firewoodReserve(view);
  });
}

type PendingCardView = ViewState['council']['pending'][number];

/**
 * Responde, uma a uma, às cartas que estão na mesa, com a opção que `choose` apontar; se a
 * resposta abre lugar para outra carta (uma continuação que esperava), responde a ela também.
 * Cada carta é tentada uma vez por sessão: uma recusa não vira laço.
 */
async function answerPending(
  view: ViewState,
  act: Act,
  choose: (view: ViewState, card: PendingCardView) => CardOption | undefined,
): Promise<ViewState> {
  let current = view;
  const tried = new Set<string>();
  for (;;) {
    const card = current.council.pending.find((entry) => !tried.has(entry.instanceId));
    if (card === undefined) {
      return current;
    }
    tried.add(card.instanceId);
    const chosen = choose(current, card);
    if (chosen !== undefined) {
      current = await act('answerCard', { instanceId: card.instanceId, optionId: chosen.id });
    }
  }
}

/** As opções que o feudo alcança e pode pagar agora (`locked` e `affordable`, como a tela mostra). */
function withinReach(card: PendingCardView): CardOption[] {
  return card.options.filter((option) => !option.locked && option.affordable);
}

/**
 * A primeira opção sem custo da carta: a que não gasta nem arrisca. No conteúdo as opções sem
 * custo vêm depois das pagas, e a mais dura vem por último.
 */
function firstFree(card: PendingCardView): CardOption | undefined {
  return withinReach(card).find((option) => option.cost.length === 0);
}

/**
 * Responde a toda carta do Conselho que está na mesa, como quem investe no povo o que sobra:
 *
 * - entre as opções pagas que o feudo alcança (`locked` e `affordable`, como a tela mostra) e
 *   que cabem com folga (`affordsWithSlack`: o recurso está entrando, o estoque é o triplo do
 *   custo, e pagar não tira o material da próxima obra, a comida dos recrutas nem a lenha do
 *   inverno), a **mais cara**; no empate, a primeira da carta;
 * - sem nenhuma, a primeira opção sem custo da carta, que é a que não arrisca nada.
 *
 * O bot nunca deixa uma carta expirar e percorre as cadeias quando tem folga. Ele não lê a
 * pista nem a frase da consequência: decide pelo custo e pelo estoque, e por isso não distingue
 * uma festa de um conserto. Uma política que pese a consequência conhecida precisaria dela em
 * números na visão, que hoje a traz só em texto (`effectsText`).
 */
export const responderCartas: Policy = {
  name: 'responder a carta',
  run: (view, act) =>
    answerPending(view, act, (current, card) => {
      const [investment] = withinReach(card)
        .filter((option) => option.cost.length > 0 && affordsWithSlack(current, option))
        .sort((a, b) => optionPrice(b) - optionPrice(a));
      return investment ?? firstFree(card);
    }),
};

/**
 * Responde a toda carta do Conselho com a primeira opção sem custo: a de quem decide o mínimo.
 * Nunca paga nada e nunca deixa uma carta expirar; por isso também nunca abre uma cadeia que
 * começa por uma opção paga.
 */
export const responderCartasSemGastar: Policy = {
  name: 'responder a carta sem gastar',
  run: (view, act) => answerPending(view, act, (_current, card) => firstFree(card)),
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

/** O preço de uma obra para quem escolhe a mais barata: a soma do que ela custa. */
function price(upgrade: Upgrade): number {
  return upgrade.cost.reduce((sum, cost) => sum + cost.amount, 0);
}

/**
 * Inicia a melhoria mais barata entre as que podem começar agora. Com o inverno à vista, não
 * começa obra que gaste a madeira da lareira: a que deixaria o estoque abaixo da reserva de
 * lenha fica para depois. Os depósitos (Celeiro e Armazém), a Torre de Vigia e a Paliçada ficam
 * de fora: eles não são um fim, e quem decide quando valem a obra é `ampliar o estoque`,
 * `erguer a Torre` e `erguer a Paliçada`.
 */
export const obraMaisBarata: Policy = {
  name: 'obra mais barata',
  run: async (view, act) => {
    const aside = sideBuildings(view);
    const [cheapest] = view.constructions.available
      .filter((upgrade) => !aside.has(upgrade.building))
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
  const wanted: Array<{ building: BuildingId; urgency: number }> = blockingDepots(view).map(
    (building) => ({ building, urgency: URGENT.blocksUpgrade }),
  );
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
 * Quanto do estoque a Torre de Vigia pode levar: o bot só a ergue (ou melhora) quando o custo
 * cabe duas vezes em cada recurso que ela pede. É a folga de quem compra informação com o que
 * sobra: a Torre não rende nada, e metade do estoque continua com as obras que rendem.
 */
const WATCHTOWER_SPEND_SHARE = 2;

/**
 * Ergue a Torre de Vigia e a melhora, uma obra por sessão, quando ela pode começar e há folga:
 * o Salão já a libera (a lista de obras diz), a fila está livre, o custo cabe duas vezes no
 * estoque e a madeira da lareira fica onde está. O edifício é o que a visão aponta
 * (`threat.watchtower.building`), e o teto é o da lista: no último nível a Torre sai dela.
 *
 * O bot não usa o que a Torre mostra. Ele a ergue porque é o que um jogador faria ao ler "sem
 * uma Torre de Vigia, ninguém sabe o que ronda o feudo", e para o simulador medir quanto ela
 * custa ao resto do feudo.
 *
 * Nos bots ela vem **antes** de `obra mais barata`. Depois dela, com uma fila só, a Torre só
 * começaria na visita em que nenhuma outra obra pudesse começar e, mesmo assim, o estoque
 * pagasse o dobro do custo dela: quase nunca. Na frente, quem a segura é a folga: sem o dobro do
 * custo em estoque a política não dá ordem, e a fila fica com a obra que rende.
 */
export const erguerTorre: Policy = {
  name: 'erguer a Torre',
  run: async (view, act) => {
    const { building } = view.threat.watchtower;
    const upgrade = view.constructions.available.find((entry) => entry.building === building);
    if (upgrade === undefined || upgrade.blockedCode !== null || !keepsFirewood(view, upgrade)) {
      return view;
    }
    const slack = upgrade.cost.every(
      (cost) => stockOf(view, cost.resource) >= WATCHTOWER_SPEND_SHARE * cost.amount,
    );
    return slack ? act('startConstruction', { building }) : view;
  },
};

/**
 * Ergue a Paliçada e a melhora quando a Ameaça **conhecida** diz que há risco: os vigias da
 * Torre veem uma incursão a caminho, ou a visão diz que a próxima virada do dia pode marcar uma
 * (`threat.raidChancePercent` acima de zero: a Ameaça passou do limiar). Sem a Torre o bot não
 * sabe de nada, como o jogador, e não a ergue: o número fica no servidor.
 *
 * Não pede folga, ao contrário da Torre: a Paliçada é a obra "de seguro", e cada incursão que
 * passa leva parte da comida e da madeira e fere gente. Se a obra não pode começar agora por
 * falta de recurso ou de fila, o bot a deixa planejada como automática, e ela começa sozinha
 * quando puder; presa ao Salão ou no teto, não há o que planejar. A madeira da lareira fica
 * onde está, como nas outras obras.
 *
 * Nos bots ela vem **antes** de todas as obras: com uma fila só, a defesa passa na frente.
 */
export const erguerPalicada: Policy = {
  name: 'erguer a Paliçada',
  run: async (view, act) => {
    const { threat } = view;
    if (!threat.known || (threat.incoming === null && threat.raidChancePercent <= 0)) {
      return view;
    }
    const { building } = threat.defense;
    const upgrade = view.constructions.available.find((entry) => entry.building === building);
    if (upgrade === undefined || deadEnd(upgrade)) {
      return view;
    }
    if (upgrade.blockedCode === null) {
      return keepsFirewood(view, upgrade) ? act('startConstruction', { building }) : view;
    }
    // Falta recurso ou fila: fica na lista das automáticas, e a alocação junta o que falta. Como
    // em `planejar automáticas`, uma obra que começa sozinha não pergunta pela lenha: enquanto a
    // lareira depende do estoque, a que gasta madeira não é marcada.
    const woodIsSafe = firewoodReserve(view) === 0 || !costsWood(upgrade);
    return woodIsSafe && !upgrade.planned
      ? act('planConstruction', { building, autoStart: true, targetLevel: upgrade.targetLevel })
      : view;
  },
};

/** A obra gasta madeira: é a que pode deixar a lareira sem lenha. */
function costsWood(upgrade: Upgrade): boolean {
  return upgrade.cost.some((cost) => cost.resource === 'wood' && cost.amount > 0);
}

/**
 * Planeja como automáticas ("iniciar quando houver recursos") as obras que não puderam começar
 * nesta visita: assim elas começam sozinhas quando a fila ficar livre e o estoque chegar ao
 * custo, em vez de esperar a visita seguinte. É o caminho de sempre do bot, adiantado: primeiro
 * o depósito que `ampliar o estoque` queria e não pôde iniciar, depois as outras obras, da mais
 * barata à mais cara, que é a ordem em que o motor as tenta. Os depósitos que ninguém pediu,
 * a Torre de Vigia e a Paliçada ficam de fora, como em `obra mais barata` (uma automática
 * começaria sem olhar a folga), e a obra que já chegou ao teto também.
 *
 * Uma obra que começa sozinha não pergunta pela lenha. Por isso, enquanto a conta da visão diz
 * que a lareira depende do estoque (a Serraria não repõe o que o inverno queima), o bot não
 * deixa automática nenhuma obra que gaste madeira: desmarca as que estão na lista e não planeja
 * outras. Quando a conta fecha, marca de novo.
 */
export const planejarAutomaticas: Policy = {
  name: 'planejar automáticas',
  run: async (view, act) => {
    let current = view;
    const woodIsSafe = firewoodReserve(view) === 0;
    for (const plan of view.constructions.planned) {
      const wanted = woodIsSafe || !costsWood(plan);
      if (plan.autoStart !== wanted) {
        current = await act('setAutoStart', {
          building: plan.building,
          autoStart: wanted,
          targetLevel: plan.targetLevel,
        });
      }
    }
    const aside = sideBuildings(current);
    const wantedDepots = storageWanted(current);
    const rank = (upgrade: Upgrade) => {
      const urgency = wantedDepots.indexOf(upgrade.building);
      return urgency === -1 ? wantedDepots.length : urgency;
    };
    const waiting = current.constructions.available
      .filter((upgrade) => !upgrade.planned && upgrade.blockedCode !== 'MAX_LEVEL')
      .filter((upgrade) => !aside.has(upgrade.building) || wantedDepots.includes(upgrade.building))
      .filter((upgrade) => woodIsSafe || !costsWood(upgrade))
      .sort((a, b) => rank(a) - rank(b) || price(a) - price(b));
    for (const upgrade of waiting) {
      // Como o app, a ordem diz o nível que a visão mostrou.
      current = await act('planConstruction', {
        building: upgrade.building,
        autoStart: true,
        targetLevel: upgrade.targetLevel,
      });
    }
    return current;
  },
};

type Objective = ViewState['objectives'][number];

/**
 * O passo de um objetivo ativo que o bot dá agora, lendo só o que o objetivo diz de si na visão
 * (`target`, `progress`): o bot não conhece objetivo nenhum pelo id.
 *
 * - **Um ofício** (`workers`): manda para lá os aldeões livres que faltam, se houver.
 * - **Um edifício** (`building`): inicia a obra se ela pode começar agora e não gasta a madeira
 *   da lareira; senão, deixa a obra planejada como automática, e ela começa sozinha quando o
 *   recurso, a fila ou o nível do Salão que falta chegarem. É o que faz a Torre de Vigia
 *   começar no instante em que o Salão a libera, e não na visita seguinte. No teto, não há o
 *   que planejar.
 * - **A lista de planejadas** (`planned`): se nenhuma obra da lista começa sozinha, planeja como
 *   automática a mais barata das que ainda não estão lá.
 * - **O recrutamento, o Conselho e a estação**: são de `recrutar`, `responder às cartas` e
 *   `guardar lenha`, que já fazem o que o objetivo pede.
 */
async function pursue(view: ViewState, objective: Objective, act: Act): Promise<ViewState> {
  const { target, progress } = objective;
  const woodIsSafe = firewoodReserve(view) === 0;
  if (target.kind === 'workers') {
    const row = view.workers.find((entry) => entry.building === target.building);
    const short = progress.target - progress.current;
    return row !== undefined && short > 0 && view.population.free >= short
      ? act('setWorkers', { building: target.building, count: row.assigned + short })
      : view;
  }
  if (target.kind === 'building') {
    const { building } = target;
    const upgrade = view.constructions.available.find((entry) => entry.building === building);
    if (upgrade === undefined || upgrade.blockedCode === 'MAX_LEVEL') {
      return view;
    }
    if (upgrade.blockedCode === null) {
      return keepsFirewood(view, upgrade) ? act('startConstruction', { building }) : view;
    }
    // Uma obra que começa sozinha não pergunta pela lenha: a que gasta madeira só é marcada
    // quando a lareira não depende do estoque, como em `planejar automáticas`.
    return !upgrade.planned && (woodIsSafe || !costsWood(upgrade))
      ? act('planConstruction', { building, autoStart: true, targetLevel: upgrade.targetLevel })
      : view;
  }
  if (target.kind === 'planned') {
    if (view.constructions.planned.some((plan) => plan.autoStart)) {
      return view;
    }
    const [cheapest] = view.constructions.available
      .filter((upgrade) => !upgrade.planned && !deadEnd(upgrade))
      .filter((upgrade) => woodIsSafe || !costsWood(upgrade))
      .sort((a, b) => price(a) - price(b));
    return cheapest === undefined
      ? view
      : act('planConstruction', {
          building: cheapest.building,
          autoStart: true,
          targetLevel: cheapest.targetLevel,
        });
  }
  return view;
}

/**
 * Segue os Objetivos do Senhor (GDD §12.2), como o jogador que lê a lista no painel: para cada
 * objetivo ativo, na ordem em que a visão os mostra, dá o passo que ele pede (`pursue`). É o que
 * faz o bot erguer a Torre de Vigia, um depósito e a Paliçada quando o objetivo os aponta, e
 * não só quando sobra estoque ou a Ameaça aperta.
 *
 * Cada passo é conferido com a visão que o anterior deixou: a obra de um objetivo ocupa a fila,
 * e a do seguinte fica planejada. Nos bots ela vem depois de `erguer a Paliçada` (a defesa
 * diante de um risco conhecido passa na frente) e antes das outras obras.
 */
export const seguirObjetivos: Policy = {
  name: 'seguir os objetivos',
  run: async (view, act) => {
    let current = view;
    for (const { id } of view.objectives) {
      const objective = current.objectives.find(
        (entry) => entry.id === id && entry.status === 'active',
      );
      if (objective !== undefined) {
        current = await pursue(current, objective, act);
      }
    }
    return current;
  },
};

/** O material que maximiza `score`; no empate, o primeiro na ordem de `MATERIALS`. */
function pick(score: (material: Material) => number): Material {
  return MATERIALS.reduce((best, material) => (score(material) > score(best) ? material : best));
}

/**
 * A comida chega à volta do jogador: não há fome, e nem o prazo de agora nem a previsão da
 * estação que vem dizem que ela acaba antes de `awayHours`. Sem a previsão (a visão a cala
 * quando a comida ou a lenha acabam antes da virada), a comida preocupa.
 */
function foodLastsTheAbsence(view: ViewState, awayHours: number): boolean {
  const food = view.resources.find((row) => row.id === 'food');
  const forecast = view.calendar.nextSeason.food;
  const far = (seconds: number | null) => seconds === null || seconds > awayHours * 3600;
  return (
    view.famine === null &&
    food !== undefined &&
    far(food.depletesInSeconds) &&
    forecast !== null &&
    far(forecast.depletesInSeconds)
  );
}

/**
 * Quantos lavradores deixar na fazenda para a colheita não ir ao chão durante a ausência, até o
 * máximo de `standard` (a conta de sempre: as bocas, a folga e a sobra para os recrutas).
 *
 * A conta olha a ausência em dois trechos, porque a estação pode virar no meio dela: até a
 * virada, com o que um lavrador rende agora; depois dela, com o que a previsão da visão diz que
 * ele vai render (`calendar.nextSeason.food`, que vale para a gente que está na fazenda agora).
 * Fica o maior número de lavradores com que a despensa não transborda em nenhum dos dois
 * trechos, e nunca menos do que os que deixam, no ponto mais baixo, comida para outra ausência
 * inteira: sobrar um pouco é melhor do que faltar.
 */
function farmersForAbsence(
  view: ViewState,
  eatenPerHour: number,
  standard: number,
  awayHours: number,
): number {
  const food = view.resources.find((row) => row.id === 'food');
  const farm = workplace(view, 'food');
  const yieldNow = farm.perWorkerPerHour;
  if (food === undefined || food.cap === null || yieldNow <= 0) {
    return standard;
  }
  const { cap, stock } = food;
  const { nextSeason } = view.calendar;
  const untilTurn = Math.min(awayHours, nextSeason.secondsUntil / 3600);
  const afterTurn = awayHours - untilTurn;
  const yieldNext =
    nextSeason.food !== null && farm.assigned > 0
      ? Math.max(0, (nextSeason.food.perHour + eatenPerHour) / farm.assigned)
      : yieldNow;
  const path = (farmers: number) => {
    const atTurn = stock + (farmers * yieldNow - eatenPerHour) * untilTurn;
    const atReturn = Math.min(cap, atTurn) + (farmers * yieldNext - eatenPerHour) * afterTurn;
    return { atTurn, atReturn };
  };
  const overflows = (farmers: number) => {
    const { atTurn, atReturn } = path(farmers);
    return atTurn > cap + EPSILON || atReturn > cap + EPSILON;
  };
  const safe = (farmers: number) => {
    const { atTurn, atReturn } = path(farmers);
    return Math.min(atTurn, atReturn) >= eatenPerHour * awayHours;
  };
  let farmers = standard;
  while (farmers > 0 && overflows(farmers) && safe(farmers - 1)) {
    farmers -= 1;
  }
  return farmers;
}

/**
 * Com quantos braços um ofício fica mesmo sem ter para quem produzir. Enquanto a experiência
 * sobe, o que o edifício pede para contar como ocupado (`occupiedFrom`); com ela no máximo, um
 * só, que é o que basta para não perdê-la (o edifício vazio a perde). Quando o feudo não tem mais
 * o que construir, nenhum: a experiência já não compra nada.
 */
function handsToKeep(view: ViewState, material: Material): number {
  if (nothingLeftToBuild(view)) {
    return 0;
  }
  const { experience, occupiedFrom } = workplace(view, material);
  return experience < view.workersRules.experienceMax ? occupiedFrom : Math.min(1, occupiedFrom);
}

/**
 * Quantos braços cada material deveria ter, com `hands` para repartir, e o máximo que cada um
 * comporta (`limits`).
 *
 * Primeiro o que cada edifício pede para o ofício não perder o que aprendeu (`handsToKeep`). O
 * resto vai em proporção ao tempo que cada um levaria para cobrir o que as obras pedem. Se não
 * há gente nem para isso, vale só a proporção.
 *
 * Um material com limite de estoque só recebe os braços cuja produção tem para onde ir durante
 * a ausência (`handsThatFit`): o espaço do depósito e o que as obras da lista ainda levam. O que
 * não cabe em lugar nenhum vai para o ouro, que não tem limite.
 */
function wantedHands(
  view: ViewState,
  hands: number,
  awayHours: number,
): { wanted: Record<Material, number>; limits: Record<Material, number> } {
  const spendable = spendableBy(view);
  const deficits = materialDeficits(view);
  const hoursToCover: Record<Material, number> = {
    wood: hoursPerWorker(view, 'wood', deficits.wood),
    stone: hoursPerWorker(view, 'stone', deficits.stone),
    gold: hoursPerWorker(view, 'gold', deficits.gold),
  };
  const weights = MATERIALS.some((id) => hoursToCover[id] > 0) ? hoursToCover : IDLE_WEIGHTS;
  const floors: Record<Material, number> = {
    wood: handsToKeep(view, 'wood'),
    stone: handsToKeep(view, 'stone'),
    gold: handsToKeep(view, 'gold'),
  };
  const limit = (material: Material) =>
    Math.max(floors[material], handsThatFit(view, material, awayHours, spendable[material]));
  const limits: Record<Material, number> = {
    wood: limit('wood'),
    stone: limit('stone'),
    gold: limit('gold'),
  };
  const occupied = MATERIALS.reduce((sum, id) => sum + floors[id], 0);
  if (occupied > hands) {
    return { wanted: share(hands, weights), limits };
  }
  const wanted = { ...floors };
  let rest = hands - occupied;
  let open = MATERIALS.filter((id) => wanted[id] < limits[id]);
  while (rest > 0 && open.some((id) => weights[id] > 0)) {
    const part = share(rest, {
      wood: open.includes('wood') ? weights.wood : 0,
      stone: open.includes('stone') ? weights.stone : 0,
      gold: open.includes('gold') ? weights.gold : 0,
    });
    // Quem recebeu mais do que comporta fica no limite, e a sobra é repartida de novo.
    const full = open.filter((id) => wanted[id] + part[id] > limits[id]);
    if (full.length === 0) {
      for (const id of open) {
        wanted[id] += part[id];
      }
      rest = 0;
      break;
    }
    for (const id of full) {
      rest -= limits[id] - wanted[id];
      wanted[id] = limits[id];
    }
    open = open.filter((id) => !full.includes(id));
  }
  // O que não coube em nenhum ofício que alguém pedisse vai para o que não tem limite.
  const sink = MATERIALS.find((id) => limits[id] === Infinity);
  if (rest > 0 && sink !== undefined) {
    wanted[sink] += rest;
    rest = 0;
  }
  // Sem ofício sem limite (não acontece no jogo de hoje), a sobra segue os pesos de sempre.
  if (rest > 0) {
    const extra = share(rest, weights);
    for (const id of MATERIALS) {
      wanted[id] += extra[id];
    }
  }
  return { wanted, limits };
}

/**
 * A troca de ofício para `material` compensa: falta dele para as obras e, com os braços que
 * ele tem hoje, a falta ainda levaria mais que `SWITCH_PAYBACK` adaptações para ser coberta (ou
 * não seria coberta nunca, sem ninguém lá). Tudo lido da visão: a falta, o que o edifício
 * rende agora e o prazo da adaptação (`workersRules.adaptationSeconds`).
 */
function worthSwitchingTo(view: ViewState, material: Material): boolean {
  const deficit = materialDeficits(view)[material];
  if (deficit <= 0) {
    return false;
  }
  const { grossPerHour } = workplace(view, material);
  if (grossPerHour <= 0) {
    return true;
  }
  return (deficit / grossPerHour) * 3600 > SWITCH_PAYBACK * view.workersRules.adaptationSeconds;
}

/**
 * Reparte os aldeões: os fazendeiros que alimentam o feudo, contando quem ainda está chegando e
 * duas bocas de folga, e o resto nos materiais, pelo que as obras pedem.
 *
 * Trocar de ofício custa (quem chega rende metade por um dia de jogo, e um edifício que fica
 * vazio perde a experiência), então o bot não refaz a alocação inteira a cada visita:
 *
 * - quem está sem ofício vai para onde mais falta gente;
 * - a fazenda é atendida sempre que a comida pede, ganha um lavrador a mais enquanto há vaga
 *   nas Habitações (a sobra de comida é o que paga os recrutas) e só devolve braços quando
 *   sobra mais de um;
 * - entre os materiais, alguém só troca de ofício quando o ganho compensa (`worthSwitchingTo`),
 *   e nunca deixando para trás um edifício abaixo do que ele pede para contar como ocupado.
 *
 * **Ninguém fica produzindo para o chão.** O bot arruma o feudo para as horas que vai passar
 * fora (`awayHours`): em um recurso com limite de estoque só ficam os braços cuja produção tem
 * para onde ir até a volta (`handsThatFit`, `farmersForAbsence`). Quem sobra sai na hora, sem
 * esperar a troca compensar, e vai para o material que falta ou, se nada falta, para o ouro,
 * que não tem limite. É o que o painel manda quando um depósito enche e não há como ampliá-lo.
 *
 * A folga é em bocas, e não em comida por hora, para a decisão ser a mesma em qualquer ritmo:
 * a visão traz as taxas por hora real, e o bot não sabe (nem precisa saber) qual é o ritmo.
 */
export function alocarPorDemandaFor(awayHours: number): Policy {
  return { name: 'alocar por demanda', run: (view, act) => allocate(view, act, awayHours) };
}

/** A política para quem volta em `DEFAULT_AWAY_HOURS`: duas visitas por dia. */
export const alocarPorDemanda: Policy = alocarPorDemandaFor(DEFAULT_AWAY_HOURS);

/**
 * Os braços do feudo: os habitantes que podem trabalhar. Quem os lobos feriram come como os
 * outros, mas não entra em ofício nenhum até sarar (e volta sozinho ao que tinha).
 */
function ableHands(view: ViewState): number {
  return view.population.villagers - view.population.injured;
}

async function allocate(view: ViewState, act: Act, awayHours: number): Promise<ViewState> {
  const { villagers, inTraining } = view.population;
  const able = ableHands(view);
  const eaten = eatenPerVillager(view);
  if (eaten === null) {
    return view;
  }
  const farm = workplace(view, 'food');
  const farmYield = farm.perWorkerPerHour;
  const demand = (villagers + inTraining + SPARE_MOUTHS) * eaten;
  const feeding = farmYield > 0 ? Math.ceil(demand / farmYield - EPSILON) : 0;
  // Com vaga nas Habitações, um lavrador a mais: é a sobra de comida que paga os recrutas.
  // Sem ela o feudo come o que planta e para de crescer. Com a despensa cheia e a comida
  // indo ao chão, a sobra já existe: o lavrador a mais só aumentaria o desperdício.
  const food = view.resources.find((row) => row.id === 'food');
  const wasting = food !== undefined && food.full && food.wastingPerHour > 0;
  const growing = view.population.vacancies > 0 && farmYield > 0 && !wasting ? 1 : 0;
  const standard = Math.min(able, feeding + growing);
  // Só os lavradores cuja colheita tem para onde ir durante a ausência: as bocas e o espaço que
  // resta na despensa (o que os recrutas desta visita gastaram volta a caber). É o que o painel
  // manda ("ponha parte dos lavradores em outro ofício"). Com fome, a conta é a de sempre.
  const fitting =
    view.famine === null
      ? farmersForAbsence(view, (villagers + inTraining) * eaten, standard, awayHours)
      : standard;
  // Um fazendeiro a mais do que a conta pede fica onde está, se a colheita dele ainda cabe.
  const slack = fitting < standard ? 0 : FARM_SLACK;
  const farmers =
    farm.assigned >= fitting && farm.assigned <= fitting + slack ? farm.assigned : fitting;

  const hands = able - farmers;
  const { wanted, limits } = wantedHands(view, hands, awayHours);
  const current = (material: Material) => workplace(view, material).assigned;
  const alloc: Record<Material, number> = {
    wood: current('wood'),
    stone: current('stone'),
    gold: current('gold'),
  };
  const total = () => MATERIALS.reduce((sum, id) => sum + alloc[id], 0);
  const surplus = (material: Material) => alloc[material] - wanted[material];
  // A fazenda pediu braços: saem de quem mais passa do que deveria ter.
  while (total() > hands) {
    alloc[pick(surplus)] -= 1;
  }
  // Quem está sem ofício vai para onde mais falta gente.
  while (total() < hands) {
    alloc[pick((material) => -surplus(material))] += 1;
  }
  // Quem produz para o chão sai sem esperar a troca compensar: o que passa do que o depósito
  // comporta vai para onde mais falta gente. A adaptação custa meio rendimento por um dia de
  // jogo; o depósito cheio custa o rendimento inteiro.
  for (const material of MATERIALS) {
    while (alloc[material] > limits[material]) {
      alloc[material] -= 1;
      alloc[pick((other) => (other === material ? -Infinity : -surplus(other)))] += 1;
    }
  }
  // Troca de ofício entre os materiais: só quando compensa, e sem desocupar quem cede. Um
  // edifício ocupado continua ocupado; um que já não estava fica com ao menos um trabalhador.
  const keeps = (material: Material) => {
    const { occupiedFrom } = workplace(view, material);
    return current(material) >= occupiedFrom ? occupiedFrom : 1;
  };
  for (;;) {
    const receivers = MATERIALS.filter(
      (id) => surplus(id) < 0 && alloc[id] < limits[id] && worthSwitchingTo(view, id),
    );
    const donors = MATERIALS.filter((id) => surplus(id) > 0 && alloc[id] > keeps(id));
    const [receiver] = receivers.sort((a, b) => surplus(a) - surplus(b));
    const [donor] = donors.sort((a, b) => surplus(b) - surplus(a));
    if (receiver === undefined || donor === undefined) {
      break;
    }
    alloc[donor] -= 1;
    alloc[receiver] += 1;
  }

  const target: Record<ProductionBuildingId, number> = {
    farm: farmers,
    lumberMill: alloc.wood,
    quarry: alloc.stone,
    goldMine: alloc.gold,
  };
  // Primeiro libera quem sobra, depois preenche: assim nenhuma ordem esbarra na falta de livres.
  const rows = [...view.workers].sort(
    (a, b) => target[a.building] - a.assigned - (target[b.building] - b.assigned),
  );
  let latest = view;
  for (const row of rows) {
    if (target[row.building] !== row.assigned) {
      latest = await act('setWorkers', { building: row.building, count: target[row.building] });
    }
  }
  // Quem deixou menos lavradores do que a conta de sempre confere o painel depois da ordem,
  // como o jogador: se ele diz que a comida não chega à volta (a estação que vem rende menos do
  // que a conta previu), devolve braços à fazenda, um a um, até fechar.
  while (target.farm < standard && !foodLastsTheAbsence(latest, awayHours)) {
    const donor = pick((material) => alloc[material]);
    if (alloc[donor] === 0) {
      break;
    }
    alloc[donor] -= 1;
    target.farm += 1;
    await act('setWorkers', { building: workplace(view, donor).building, count: alloc[donor] });
    latest = await act('setWorkers', { building: farm.building, count: target.farm });
  }
  return latest;
}

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
    const farmers = Math.min(
      ableHands(view),
      Math.ceil(mouthsPerHour / farm.perWorkerPerHour - EPSILON),
    );
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
