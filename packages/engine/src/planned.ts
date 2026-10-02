import { buildings, objectives, type ResourceAmounts } from '@lotg/content';

import {
  constructionOf,
  freeQueue,
  gateRequirement,
  missingResources,
  startConstruction,
  upgradeCost,
} from './construction';
import { flowRate } from './economy';
import { evaluateObjectives } from './objectives';
import { type BeyondStorage, costBeyondStorage } from './storage';
import type {
  BuildingId,
  Construction,
  GameEvent,
  GameState,
  PlannedConstruction,
  ResourceId,
} from './types';
import { HOUR_MS, MILLI, positiveEntries } from './units';

/**
 * Obras planejadas e o início automático (GDD §6.3; ADR 0013, decisão 18).
 *
 * Uma planejada marcada "iniciar quando houver recursos" começa sozinha no **primeiro instante**
 * em que pode começar. Esse instante não depende de quando alguém olhou: ou é um instante em
 * que algo discreto mudou (um comando, uma obra que terminou, uma recompensa), e a lista é
 * conferida ali; ou é o instante em que a produção contínua completou o custo, que entra na
 * linha do tempo como qualquer outro evento (`autoStartsIn`). As automáticas são tentadas na
 * ordem da lista, e uma que não pode começar não segura as seguintes.
 */

/** O que uma planejada espera para começar. `null`, em `planWait`, é "pode começar agora". */
export type PlanWait =
  /**
   * O edifício tem outra obra antes desta: a que está em curso (`underway`) ou, se ela foi
   * cancelada, a que leva o edifício ao nível `level`, que ninguém iniciou.
   */
  | { reason: 'upgrading'; underway: Construction | null; level: number }
  /** Falta o nível de outro edifício (`requirement`), ou o edifício já chegou ao teto (`null`). */
  | { reason: 'gate'; requirement: { building: BuildingId; level: number } | null }
  /** O custo não cabe no depósito: esperar não resolve. */
  | { reason: 'capacity'; beyond: BeyondStorage }
  /** Falta recurso que cabe no depósito: a produção ainda junta. */
  | { reason: 'resources'; cost: ResourceAmounts; missing: ResourceAmounts }
  /** Tudo pronto, menos os pedreiros: não há fila livre. */
  | { reason: 'queue' };

/** O custo de uma planejada, em unidades: o da obra que leva o edifício ao nível dela. */
export function planCost(plan: PlannedConstruction): ResourceAmounts {
  return upgradeCost(plan.building, plan.targetLevel - 1);
}

/**
 * Por que uma planejada não pode começar agora, ou `null` se pode. Quando há mais de um motivo,
 * sai o que mais demora a se resolver sozinho: a obra anterior do mesmo edifício, o nível de
 * outro edifício, o depósito pequeno, o recurso que falta e, por último, a fila ocupada. São os
 * mesmos testes de `upgradeQuote`, em outra ordem: a recusa de uma ordem diz o primeiro motivo
 * que o jogador resolve agora, e a espera de uma planejada diz o que ela de fato aguarda. `null`
 * aqui é exatamente "`startConstruction` aceitaria agora".
 *
 * Não monta frase nenhuma: roda a cada trecho da linha do tempo, para cada automática.
 */
export function planWait(state: GameState, plan: PlannedConstruction): PlanWait | null {
  const { building, targetLevel } = plan;
  const level = state.settlement.buildings[building];
  const underway = constructionOf(state, building);
  if (underway !== null || targetLevel > level + 1) {
    return { reason: 'upgrading', underway, level: targetLevel - 1 };
  }
  // Daqui em diante a obra que começaria é a próxima do edifício, como em `upgradeQuote`.
  if (level >= buildings[building].maxLevel) {
    return { reason: 'gate', requirement: null };
  }
  const requirement = gateRequirement(state, building, level + 1);
  if (requirement !== null) {
    return { reason: 'gate', requirement };
  }
  const cost = upgradeCost(building, level);
  const beyond = costBeyondStorage(state, cost);
  if (beyond !== null) {
    return { reason: 'capacity', beyond };
  }
  const missing = missingResources(state, cost);
  if (missing !== null) {
    return { reason: 'resources', cost, missing };
  }
  return freeQueue(state) === -1 ? { reason: 'queue' } : null;
}

/**
 * Milissegundos de jogo até o estoque cobrir `cost` inteiro, com as taxas do trecho: o menor
 * intervalo em que **todos** os recursos do custo bastam ao mesmo tempo. É a conta de
 * `applyContinuous` de trás para frente, em inteiros, com o resto guardado de cada recurso:
 *
 * - o que falta só chega se o saldo for positivo, e chega no menor `t` em que a parte inteira do
 *   que foi produzido cobre a falta (a mesma conta de "cheio em");
 * - o que já basta e está caindo (a madeira na lareira) só continua bastando até certo `t`.
 *
 * `null` quando o custo não se completa com estas taxas. Quando há falta, o resultado é sempre
 * ao menos 1: falta ao menos um milésimo, e o resto guardado é menor que isso.
 */
export function coversIn(
  state: GameState,
  cost: ResourceAmounts,
  rates: Record<ResourceId, number>,
): number | null {
  const { resources, accumulators } = state.settlement;
  let wait = 0;
  let holds = Number.POSITIVE_INFINITY;
  for (const [resource, amount] of positiveEntries(cost)) {
    const shortfall = amount * MILLI - resources[resource];
    const rate = flowRate(state, resource, rates);
    if (shortfall > 0) {
      if (rate <= 0) {
        return null;
      }
      wait = Math.max(wait, Math.ceil((shortfall * HOUR_MS - accumulators[resource]) / rate));
    } else if (rate < 0) {
      // Sobra `-shortfall`: o estoque só fica abaixo do custo quando perde um milésimo além dela.
      const below = Math.ceil(((1 - shortfall) * HOUR_MS + accumulators[resource]) / -rate);
      holds = Math.min(holds, below - 1);
    }
  }
  return wait <= holds ? wait : null;
}

/**
 * A primeira planejada automática que **só** espera recurso a poder começar, e em quantos
 * milissegundos: é o próximo início automático que a produção sozinha traz. No empate, a que
 * vem antes na lista. `null` quando nenhuma chega lá com as taxas de agora. A previsão vale até
 * o próximo evento, e a linha do tempo a refaz a cada trecho.
 */
export function nextAutoStart(
  state: GameState,
  rates: Record<ResourceId, number>,
): { plan: PlannedConstruction; inMs: number } | null {
  if (freeQueue(state) === -1) {
    return null;
  }
  let soonest: { plan: PlannedConstruction; inMs: number } | null = null;
  for (const plan of state.settlement.planned) {
    if (!plan.autoStart) {
      continue;
    }
    const wait = planWait(state, plan);
    if (wait?.reason !== 'resources') {
      continue;
    }
    const inMs = coversIn(state, wait.cost, rates);
    if (inMs !== null && (soonest === null || inMs < soonest.inMs)) {
      soonest = { plan, inMs };
    }
  }
  return soonest;
}

/** Milissegundos até o próximo início automático: um candidato de `nextEventAt`. */
export function autoStartsIn(state: GameState, rates: Record<ResourceId, number>): number | null {
  return nextAutoStart(state, rates)?.inMs ?? null;
}

/**
 * Uma passada pela lista: inicia, na ordem, cada planejada automática que pode começar agora.
 * Cada uma é conferida com o estado que a anterior deixou (o estoque já pago, a fila já
 * ocupada), e a que não pode é pulada. Devolve se iniciou alguma.
 */
function startPlanned(draft: GameState, atMs: number, events: GameEvent[]): boolean {
  let started = false;
  // Iniciar tira a obra da lista: a passada anda sobre uma cópia.
  for (const plan of [...draft.settlement.planned]) {
    if (!plan.autoStart || planWait(draft, plan) !== null) {
      continue;
    }
    const rejection = startConstruction(draft, plan.building, atMs, events, 'autoStart');
    if (rejection !== null) {
      throw new Error(
        `A planejada ${plan.building} podia começar e foi recusada: ${rejection.code}.`,
      );
    }
    started = true;
  }
  return started;
}

/**
 * Acomoda as planejadas e os objetivos no instante `atMs`, depois de qualquer mudança discreta:
 * todo comando e todo instante com eventos passam por aqui.
 *
 * Primeiro as planejadas automáticas, depois os objetivos, e de novo enquanto algo acontecer:
 * uma obra iniciada pode cumprir um objetivo, e a recompensa dele pode pagar outra obra. Cada
 * volta inicia ao menos uma planejada ou conclui ao menos um objetivo, e as duas listas são
 * finitas: o limite é a soma dos tamanhos, e chegar a ele é defeito de código. O estado que sai
 * daqui está em repouso: nenhuma automática pode começar agora, e por isso o próximo instante de
 * início (`autoStartsIn`) é sempre depois de agora.
 */
export function settlePlanned(draft: GameState, atMs: number, events: GameEvent[]): void {
  const limit = draft.settlement.planned.length + objectives.length;
  for (let round = 0; ; round += 1) {
    if (round > limit) {
      throw new Error(`As obras planejadas não se acomodaram no instante ${atMs}.`);
    }
    const started = startPlanned(draft, atMs, events);
    const completed = evaluateObjectives(draft, atMs, events);
    if (!started && !completed) {
      return;
    }
  }
}

/** Há ao menos uma planejada automática que pode começar agora: o estado não está em repouso. */
export function hasStartablePlan(state: GameState): boolean {
  return state.settlement.planned.some((plan) => plan.autoStart && planWait(state, plan) === null);
}
