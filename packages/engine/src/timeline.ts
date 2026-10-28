import { nextCampaignEventAt } from './campaign';
import { nextCaravanArrivalAt } from './caravans';
import { nextDayBoundary } from './clock';
import { nextCouncilEventAt } from './council';
import { nextAdaptationEndAt } from './craft';
import { nextWallRepairAt } from './wallRepair';
import { nextExpeditionEventAt } from './expeditions';
import { foodRunsOutIn, goldRunsOutIn, netRates, woodRunsOutIn } from './economy';
import { nextHeroArrivalAt, nextHeroRecoveryAt } from './heroes';
import { autoStartsIn } from './planned';
import { nextRaidEventAt, nextRecoveryAt, nextRehearsalMarkAt } from './raids';
import { nextForgeEndAt } from './smithy';
import { nextTrainingEndAt } from './army';
import { storageFillsIn } from './storage';
import { nextTavernRotationAt } from './tavern';
import { nextMarketEffectAt } from './market';
import type { GameState } from './types';

/**
 * Instante, em ms de jogo, em que a produção contínua completa o custo de uma planejada
 * automática que só espera recurso: nele a obra começa sozinha (GDD §6.3). `null` quando nenhuma
 * chega lá com as taxas de agora. Vale até o próximo evento que muda as taxas; `nextEventAt` o
 * refaz a cada trecho.
 */
export function nextAutoStartAt(state: GameState, rates = netRates(state)): number | null {
  const starts = autoStartsIn(state, rates);
  return starts === null ? null : state.lastProcessedAt + starts;
}

/**
 * Instante, em ms de jogo, do próximo evento discreto: fim de obra, fim de um lote da forja, chegada de aldeão,
 * virada de dia (que cobre estação, ano, a contagem da experiência do ofício, o sorteio do
 * Conselho, a subida da Ameaça e o sorteio da incursão), uma carta que expira, um efeito
 * escondido de carta, uma continuação que chega, um herói prometido que chega, o fim da adaptação de quem trocou de ofício (uma leva de aldeões ou um Mestre),
 * uma incursão que chega, o aviso da Torre de Vigia, a troca dos candidatos da Taverna, o fim de um nó de expedição, o
 * prazo de uma encruzilhada, a chegada de uma caravana, um ferido que sara, um herói ferido que sara, o momento em que a
 * comida acaba, aquele em que a madeira acaba na lareira, aquele em que o ouro acaba com soldo
 * a pagar, aquele em que um estoque chega ao limite ou aquele em que uma planejada automática
 * junta o custo. As consequências do soldo em atraso são cobradas na virada do dia. Nunca devolve um instante
 * anterior a `lastProcessedAt`.
 */
export function nextEventAt(state: GameState): number | null {
  const now = state.lastProcessedAt;
  const { constructionQueues, recruitmentQueue, famine } = state.settlement;
  const candidates = [nextDayBoundary(now)];
  const marketEnds = nextMarketEffectAt(state);
  if (marketEnds !== null) candidates.push(marketEnds);
  const rehearsalMark = nextRehearsalMarkAt(state);
  if (rehearsalMark !== null) candidates.push(rehearsalMark);

  for (const slot of constructionQueues) {
    if (slot !== null) {
      candidates.push(slot.finishesAtMs);
    }
  }
  // O reparo da muralha termina em instante próprio, resolvido junto das obras.
  const repairEnds = nextWallRepairAt(state);
  if (repairEnds !== null) {
    candidates.push(repairEnds);
  }
  // O lote da forja termina em instante próprio, resolvido junto das obras.
  const forgeEnds = nextForgeEndAt(state);
  if (forgeEnds !== null) {
    candidates.push(forgeEnds);
  }
  // O lote em treino no Quartel termina em instante próprio, resolvido junto dos recrutas.
  const trainingEnds = nextTrainingEndAt(state);
  if (trainingEnds !== null) {
    candidates.push(trainingEnds);
  }
  // Durante a fome a fila de recrutamento fica congelada.
  const nextRecruit = recruitmentQueue[0];
  if (nextRecruit !== undefined && !famine) {
    candidates.push(nextRecruit.finishesAtMs);
  }
  // Quem trocou de ofício passa a render inteiro: a taxa do edifício muda nesse instante. Vale
  // para as levas de aldeões e para o Mestre, que nele passa também a dar o bônus.
  const adaptationEnds = nextAdaptationEndAt(state);
  if (adaptationEnds !== null) {
    candidates.push(adaptationEnds);
  }
  // O Conselho: uma carta que expira, um efeito escondido que acontece, uma continuação que
  // chega. O sorteio é da virada do dia, que já está na lista.
  const council = nextCouncilEventAt(state);
  if (council !== null) {
    candidates.push(council);
  }
  // O herói que uma carta prometeu para depois: o soldo dele começa a contar nesse instante.
  const heroArrival = nextHeroArrivalAt(state);
  if (heroArrival !== null) {
    candidates.push(heroArrival);
  }
  // As incursões: a que chega e o aviso da Torre para a que ninguém anunciou ainda.
  const raid = nextRaidEventAt(state);
  if (raid !== null) {
    candidates.push(raid);
  }
  // A Taverna troca os candidatos em instante próprio, ancorado na inauguração: quase nunca é
  // uma virada de dia. O fim do festival é da virada do dia, que já está na lista.
  const rotation = nextTavernRotationAt(state);
  if (rotation !== null) {
    candidates.push(rotation);
  }
  // As expedições: o fim do nó em que uma equipe está e o prazo de uma encruzilhada. É nesses
  // instantes, e só neles, que uma expedição sorteia.
  const expedition = nextExpeditionEventAt(state);
  if (expedition !== null) {
    candidates.push(expedition);
  }
  // As caravanas: a chegada. É nesse instante, e só nele, que uma caravana sem escolta sorteia.
  const campaign = nextCampaignEventAt(state);
  if (campaign !== null) candidates.push(campaign);
  const caravan = nextCaravanArrivalAt(state);
  if (caravan !== null) {
    candidates.push(caravan);
  }
  // O ferido que sara volta ao ofício: a taxa do edifício dele muda nesse instante.
  const recovery = nextRecoveryAt(state);
  if (recovery !== null) {
    candidates.push(recovery);
  }
  // O herói ferido que sara volta a poder partir exatamente nesse instante.
  const heroRecovery = nextHeroRecoveryAt(state);
  if (heroRecovery !== null) {
    candidates.push(heroRecovery);
  }
  const rates = netRates(state);
  const foodRunsOut = foodRunsOutIn(state, rates);
  if (foodRunsOut !== null) {
    candidates.push(now + foodRunsOut);
  }
  // No inverno a lenha come a madeira: o instante em que ela acaba abre o frio.
  const woodRunsOut = woodRunsOutIn(state, rates);
  if (woodRunsOut !== null) {
    candidates.push(now + woodRunsOut);
  }
  // O soldo dos heróis come o ouro: o instante em que ele acaba abre o atraso.
  const goldRunsOut = goldRunsOutIn(state, rates);
  if (goldRunsOut !== null) {
    candidates.push(now + goldRunsOut);
  }
  // O instante em que um estoque enche: dali em diante a produção dele é desperdício.
  const fills = storageFillsIn(state, rates);
  if (fills !== null) {
    candidates.push(now + fills);
  }
  // O instante em que a produção completa o custo de uma planejada automática.
  const autoStart = nextAutoStartAt(state, rates);
  if (autoStart !== null) {
    candidates.push(autoStart);
  }
  return Math.max(now, Math.min(...candidates));
}
