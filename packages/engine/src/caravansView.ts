import { balance, buildings, caravanTexts } from '@lotg/content';

import {
  ambushPercentNow,
  caravanBlock,
  caravanSlots,
  caravansText,
  caravanUnitPrice,
  eligibleEscorts,
  maxSendable,
  slotsAtLevel,
} from './caravans';
import { decimal, fillText, priceText, thousands } from './format';
import { marketLevel, quote, stockAboveReserve } from './market';
import { reserveView } from './surplusView';
import { watchtowerLevel } from './threat';
import type {
  Caravan,
  CaravanOfferView,
  CaravanResourceView,
  CaravanView,
  GameState,
  MarketResourceId,
} from './types';
import { MILLI, realSecondsCeil } from './units';

/**
 * As caravanas na visão (GDD §5.9; ADR 0018, decisão 17). Só lê o estado: não sorteia, não dá
 * identificador e não anda o tempo.
 *
 * **O desfecho de uma caravana nunca sai antes da chegada**, e não é só por esconder um campo:
 * antes da chegada ele não existe. A emboscada é sorteada no instante da chegada, no fluxo
 * `caravan:<id>`, que nem nasceu; o estado de uma caravana que vai ser emboscada e o de uma que
 * não vai são iguais campo a campo. O que a visão mostra é o risco, que é o mesmo para as duas.
 */

const { caravan: rules } = balance.market;

const tower = buildings.watchtower.label;
const ratioText = decimal(rules.priceRatio.num / rules.priceRatio.den);
const lossPercent = decimal((rules.ambush.lossRatio.num * 100) / rules.ambush.lossRatio.den);
const resourceLabel = (resource: MarketResourceId): string =>
  balance.resources[resource].label.toLowerCase();

/** "mantém 1 caravana na estrada para Porto do Rio"; `null` no nível que não mantém nenhuma. */
export function caravanGivesText(level: number): string | null {
  const slots = slotsAtLevel(level);
  return slots === 0
    ? null
    : fillText(caravanTexts.gives, {
        caravanas: caravansText(slots),
        destino: caravanTexts.destination,
      });
}

/**
 * O risco de agora, termo a termo: "10% na estrada, −5 pela Torre de Vigia Nv1; com escolta,
 * nenhum." Sem Torre, diz o que cada nível dela tiraria; quando a conta bate no piso, diz o
 * piso. É a mesma conta de `ambushPercent`, escrita.
 */
function riskBreakdown(state: GameState): string {
  const { basePercent, perWatchtowerLevel, floorPercent } = rules.ambush;
  const level = watchtowerLevel(state);
  const terms = [fillText(caravanTexts.riskBase, { base: basePercent })];
  terms.push(
    level === 0
      ? fillText(caravanTexts.riskNoTower, { torre: tower, corte: perWatchtowerLevel })
      : fillText(caravanTexts.riskTower, {
          torre: tower,
          nivel: level,
          corte: perWatchtowerLevel * level,
        }),
  );
  if (basePercent - perWatchtowerLevel * level < floorPercent) {
    terms.push(fillText(caravanTexts.riskFloor, { piso: floorPercent }));
  }
  return `${terms.join(', ')}; ${caravanTexts.riskEscort}.`;
}

function caravanView(state: GameState, caravan: Caravan, timeScale: number): CaravanView {
  const cargoText = fillText(caravanTexts.cargo, {
    quantidade: thousands(caravan.amount),
    recurso: resourceLabel(caravan.resource),
  });
  const escortName =
    caravan.escortHeroId === null
      ? null
      : (state.guild.heroes.find((hero) => hero.id === caravan.escortHeroId)?.name ?? null);
  const unitPriceText = priceText(caravan.unitPrice);
  return {
    id: caravan.id,
    resource: caravan.resource,
    amount: caravan.amount,
    cargoText,
    unitPrice: caravan.unitPrice,
    unitPriceText,
    goldText: decimal((caravan.amount * caravan.unitPrice) / MILLI, 3),
    destination: caravanTexts.destination,
    arrivesInSeconds: realSecondsCeil(caravan.arrivesAtMs - state.lastProcessedAt, timeScale),
    escortName,
    text: `${fillText(caravanTexts.onTheRoad, {
      destino: caravanTexts.destination,
      carga: cargoText,
      preco: unitPriceText,
    })} ${
      escortName === null
        ? caravanTexts.unescorted
        : fillText(caravanTexts.escortedBy, { heroi: escortName })
    }`,
  };
}

function resourceView(state: GameState, resource: MarketResourceId): CaravanResourceView {
  const unitPrice = caravanUnitPrice(state, resource);
  return {
    resource,
    label: balance.resources[resource].label,
    unitPrice,
    unitPriceText: priceText(unitPrice),
    breakdown: `${priceText(unitPrice)} = ${priceText(quote(state, resource).sell)} (venda de hoje) × ${ratioText}.`,
    maxSendable: maxSendable(state, resource),
    surplusSendable: Math.min(maxSendable(state, resource), stockAboveReserve(state, resource)),
    ...reserveView(state, resource),
  };
}

/** As caravanas na estrada, em ordem de envio. */
export function caravansView(state: GameState, timeScale: number): CaravanView[] {
  return state.market.caravans.map((caravan) => caravanView(state, caravan, timeScale));
}

/** O que uma caravana enviada agora levaria, pagaria e arriscaria. */
export function caravanOfferView(state: GameState, timeScale: number): CaravanOfferView {
  const blocked = caravanBlock(state);
  const riskPercent = ambushPercentNow(state);
  const open = marketLevel(state) >= rules.requiresLevel;
  return {
    available: blocked === null,
    blockedReason: blocked?.message ?? null,
    destination: caravanTexts.destination,
    maxUnits: rules.maxUnits,
    priceRatioText: fillText(caravanTexts.priceRatio, { fator: ratioText }),
    tripSeconds: realSecondsCeil(rules.tripMs, timeScale),
    riskPercent,
    riskText: fillText(caravanTexts.risk, { risco: riskPercent, torre: tower }),
    riskBreakdown: riskBreakdown(state),
    lossText: fillText(caravanTexts.loss, { parte: lossPercent }),
    slots: caravanSlots(state),
    slotsInUse: state.market.caravans.length,
    // Sem o Mercado no nível das caravanas não há o que oferecer (descoberta gradual).
    resources: open
      ? balance.market.resources.map((resource) => resourceView(state, resource))
      : [],
    eligibleEscortIds: open ? eligibleEscorts(state).map((hero) => hero.id) : [],
  };
}
