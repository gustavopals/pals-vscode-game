import { balance, caravanTemplates, caravanTexts } from '@lotg/content';

import { ambushLoss, ambushPercentNow, caravanNumber } from './caravans';
import { emit } from './chronicle';
import { decimal, thousands } from './format';
import { chance, dropStream, entityStream } from './random';
import { storeResource } from './storage';
import { watchtowerLevel } from './threat';
import type { Caravan, GameEvent, GameState } from './types';
import { MILLI } from './units';
import { chargeReturned } from './wages';

/**
 * As caravanas na linha do tempo (GDD §5.9; ADR 0017, decisão 9; ADR 0018, decisão 17): a
 * chegada. É o único ponto das caravanas que sorteia, e só `advanceTo` chega aqui: a ordem de
 * enviar (`caravanOrders.ts`) não sorteia.
 *
 * Cada caravana sorteia **só no próprio fluxo**, `caravan:<id>`: mandar uma segunda não muda a
 * sorte da primeira, e a ordem em que duas chegam não muda a de nenhuma.
 */

/**
 * A chegada de uma caravana, no instante dela.
 *
 * **Só se sorteia o que pode acontecer.** Com escolta não há emboscada: nenhum sorteio, e o
 * fluxo da caravana nem nasce. Sem escolta, **um** sorteio no fluxo `caravan:<id>`, com a chance
 * de `ambushPercent` e **a Torre de Vigia deste instante** (a que fica pronta agora já conta: as
 * obras terminam antes na ordem do instante; a que foi erguida com a carga na estrada também).
 * A carga de que a emboscada não levaria nada (uma unidade só: a metade, arredondada para
 * baixo, é zero) também não sorteia.
 *
 * Emboscada: perde a fração do conteúdo, arredondada para baixo; o resto é vendido. O ouro é
 * `unidades vendidas × preço fixado no envio`, sem outro arredondamento, e não depende do preço
 * de hoje. O herói da escolta volta ao feudo, pronto.
 *
 * **Apagar o fluxo é o último passo da caravana** (R1): depois dele nada mais sorteia nela, e
 * como o identificador nunca volta (`ids.ts`), o fluxo não renasce.
 */
function arrive(draft: GameState, caravan: Caravan, atMs: number, events: GameEvent[]): void {
  const stream = entityStream('caravan', caravan.id);
  const escort =
    caravan.escortHeroId === null
      ? null
      : (draft.guild.heroes.find((hero) => hero.id === caravan.escortHeroId) ?? null);
  const atRisk = caravan.escortHeroId === null ? ambushLoss(caravan.amount) : 0;
  const riskPercent = ambushPercentNow(draft);
  const ambushed = atRisk > 0 && chance(draft, stream, { num: riskPercent, den: 100 });
  const lost = ambushed ? atRisk : 0;
  const sold = caravan.amount - lost;
  const gold = sold * caravan.unitPrice;
  storeResource(draft, 'gold', gold);
  if (escort !== null && escort.status === 'escort') {
    escort.status = 'idle';
  }
  draft.market.caravans = draft.market.caravans.filter((entry) => entry.id !== caravan.id);
  const { stats } = draft;
  stats.caravansArrived = (stats.caravansArrived ?? 0) + 1;
  stats.caravanGold = (stats.caravanGold ?? 0) + gold;
  if (ambushed) {
    stats.caravansAmbushed = (stats.caravansAmbushed ?? 0) + 1;
  }
  const resourceLabel = balance.resources[caravan.resource].label.toLowerCase();
  const data = {
    caravanId: caravan.id,
    resource: caravan.resource,
    amount: caravan.amount,
    sold,
    unitPrice: caravan.unitPrice,
    gold,
    gained_gold: gold / MILLI,
  };
  const placeholders = {
    quantidade: thousands(sold),
    recurso: resourceLabel,
    destino: caravanTexts.destination,
    preco: decimal(gold / MILLI, 3),
  };
  if (ambushed) {
    emit(
      events,
      draft,
      atMs,
      'caravanAmbushed',
      {
        ...data,
        lost,
        [`lost_${caravan.resource}`]: lost,
        riskPercent,
        watchtowerLevel: watchtowerLevel(draft),
      },
      { ...placeholders, perda: `${thousands(lost)} de ${resourceLabel}` },
    );
  } else {
    emit(
      events,
      draft,
      atMs,
      'caravanArrived',
      {
        ...data,
        escorted: escort === null ? 0 : 1,
        ...(escort === null ? {} : { heroId: escort.id }),
      },
      { ...placeholders, ...(escort === null ? {} : { heroi: escort.name }) },
      escort === null ? undefined : caravanTemplates.escortedArrival,
    );
  }
  // Depois de entregar a carga: o herói que volta com o soldo em atraso e o prazo vencido é
  // cobrado na volta, e não em uma virada em casa que ele pode nunca encontrar (R2).
  if (escort !== null) {
    chargeReturned(draft, [escort.id], atMs, events);
  }
  // O último passo: o estado não guarda fluxo de caravana que já chegou.
  dropStream(draft, stream);
}

/**
 * As caravanas que chegam em um instante da linha do tempo, **na ordem do identificador**
 * (`caravan-9` antes de `caravan-10`). Como cada uma sorteia no próprio fluxo, a ordem não muda
 * o resultado de nenhuma; ela só fixa a ordem das linhas da Crônica e a do ouro no cofre.
 *
 * Roda depois das expedições e antes das planejadas, dos objetivos e da conta do ouro
 * (`processEventsAt`): o ouro que chega neste instante já paga a obra que esperava recurso e o
 * soldo, e o herói que volta da escolta já está no feudo para o que vier depois.
 */
export function settleCaravans(draft: GameState, atMs: number, events: GameEvent[]): void {
  const due = draft.market.caravans
    .filter((caravan) => caravan.arrivesAtMs <= atMs)
    .sort((a, b) => caravanNumber(a) - caravanNumber(b));
  for (const caravan of due) {
    arrive(draft, caravan, atMs, events);
  }
}
