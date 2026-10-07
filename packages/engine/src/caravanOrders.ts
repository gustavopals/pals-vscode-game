import { balance, caravanTemplates, caravanTexts } from '@lotg/content';

import { caravanBlock, caravanUnitPrice, cargoBlock, escortBlock } from './caravans';
import { emit } from './chronicle';
import { thousands } from './format';
import { nextId } from './ids';
import { reject } from './rejections';
import type { Caravan, GameEvent, GameState, MarketResourceId, Rejection } from './types';
import { MILLI } from './units';

/**
 * A ordem das caravanas (GDD §5.9; ADR 0018, decisão 17). É o único ponto que dá identificador
 * a uma caravana, e **não sorteia**: a emboscada é da chegada, um instante da linha do tempo
 * (`caravanTurn.ts`). O fluxo `caravan:<id>` nem nasce aqui.
 */

const { caravan: rules } = balance.market;

/**
 * A ordem de enviar uma caravana (`sendCaravan`). As recusas, na ordem:
 *
 * 1. o Mercado abaixo do nível das caravanas (`MARKET_LEVEL_REQUIRED`);
 * 2. todos os lugares na estrada ocupados (`CARAVAN_LIMIT`);
 * 3. a cotação que ficou para trás (`PRICE_CHANGED`): o dia de jogo virou entre a tela e a ordem,
 *    e o preço fixado seria outro (pendência E-15; o mesmo critério de `trade`);
 * 4. o que não é uma carga (`INVALID_AMOUNT`) e o que o estoque não tem
 *    (`INSUFFICIENT_RESOURCES`);
 * 5. a escolta que já não serve ao feudo (`HERO_NOT_FOUND`) ou não pode partir
 *    (`HERO_UNAVAILABLE`, com o nome e o motivo).
 *
 * Aceita, **a carga sai do estoque agora** e o preço por unidade fica **fixado**: o de venda
 * deste instante vezes a fração do conteúdo. O Mercado pode andar o quanto quiser com a carga na
 * estrada; a caravana vende pelo preço que levou. A carga **não conta no volume do dia**. O
 * herói da escolta fica fora do feudo até a chegada.
 *
 * O evento leva a carga (`spent_<recurso>`, como toda ordem que cobra), o preço fixado e a
 * chegada; nada nele diz como a viagem termina, porque ainda não se sabe.
 */
export function sendCaravan(
  draft: GameState,
  resource: unknown,
  amount: unknown,
  escortHeroId: unknown,
  quoteDay: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const blocked =
    caravanBlock(draft) ??
    (quoteDay === draft.market.quoteDay ? null : reject('PRICE_CHANGED')) ??
    cargoBlock(draft, resource, amount) ??
    (escortHeroId === null || escortHeroId === undefined ? null : escortBlock(draft, escortHeroId));
  if (blocked !== null) {
    return blocked;
  }
  // As recusas já conferiram a forma: daqui em diante são um recurso do Mercado e um inteiro.
  const cargo = resource as MarketResourceId;
  const units = amount as number;
  const escort =
    escortHeroId === null || escortHeroId === undefined
      ? null
      : (draft.guild.heroes.find((hero) => hero.id === escortHeroId) ?? null);
  const caravan: Caravan = {
    id: nextId(draft, 'caravan'),
    resource: cargo,
    amount: units,
    unitPrice: caravanUnitPrice(draft, cargo),
    arrivesAtMs: nowMs + rules.tripMs,
    escortHeroId: escort?.id ?? null,
  };
  draft.settlement.resources[cargo] -= units * MILLI;
  if (escort !== null) {
    escort.status = 'escort';
  }
  draft.market.caravans.push(caravan);
  draft.stats.caravansSent = (draft.stats.caravansSent ?? 0) + 1;
  emit(
    events,
    draft,
    nowMs,
    'caravanSent',
    {
      caravanId: caravan.id,
      resource: cargo,
      amount: units,
      unitPrice: caravan.unitPrice,
      arrivesAtMs: caravan.arrivesAtMs,
      escorted: escort === null ? 0 : 1,
      ...(escort === null ? {} : { heroId: escort.id }),
      [`spent_${cargo}`]: units,
    },
    {
      quantidade: thousands(units),
      recurso: balance.resources[cargo].label.toLowerCase(),
      destino: caravanTexts.destination,
      ...(escort === null ? {} : { heroi: escort.name }),
    },
    escort === null ? undefined : caravanTemplates.escorted,
  );
  return null;
}
