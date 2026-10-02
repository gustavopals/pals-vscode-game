import { balance, buildings, PRODUCTION_BUILDING_IDS, RESOURCE_IDS } from '@lotg/content';

import type { GameState, ProductionBuildingId, ResourceId } from './types';
import { HOUR_MS, MILLI, scaleDown } from './units';

/**
 * Produção bruta de um edifício, em milésimos por hora, sempre inteira:
 * trabalhadores × taxa base × 1000 × (10 + 2 × (nível − 1)) / 10, vezes 3/4 durante a fome.
 */
export function productionRate(
  state: GameState,
  building: ProductionBuildingId,
  workers = state.settlement.workers[building],
): number {
  const { levelBonus, perWorkerPerHour } = balance.production;
  const { buildings: levels, famine } = state.settlement;
  const bonus = levelBonus.den + levelBonus.num * (levels[building] - 1);
  const rate = Math.floor((workers * perWorkerPerHour[building] * MILLI * bonus) / levelBonus.den);
  return famine ? scaleDown(rate, balance.famine.productionMultiplier) : rate;
}

/** Comida consumida pelos habitantes, em milésimos por hora. */
export function consumptionRate(state: GameState): number {
  const { foodPerVillagerPerHour } = balance.consumption;
  return state.settlement.population.villagers * foodPerVillagerPerHour * MILLI;
}

/** Saldo líquido de cada recurso, em milésimos por hora. */
export function netRates(state: GameState): Record<ResourceId, number> {
  const rates: Record<ResourceId, number> = { food: 0, wood: 0, stone: 0, gold: 0 };
  for (const building of PRODUCTION_BUILDING_IDS) {
    const resource = buildings[building].produces;
    if (resource !== null) {
      rates[resource] += productionRate(state, building);
    }
  }
  rates.food -= consumptionRate(state);
  return rates;
}

/**
 * Limite de estoque de um recurso. Ainda não há limite: o Celeiro e o Armazém chegam com a
 * mecânica de armazenamento e entram por aqui.
 */
export function storageCap(): number | null {
  return null;
}

/**
 * Aplica um trecho de produção e consumo contínuos, com taxas constantes.
 *
 * Cada recurso acumula `taxa × duração` (milésimos × ms) e só a parte inteira de
 * `acumulador / 3.600.000` vai para o estoque; o resto fica guardado. Como nada é arredondado
 * e descartado, o par (estoque, acumulador) depois de avançar `a + b` é idêntico ao de avançar
 * `a` e depois `b`: dentro de um trecho a taxa tem um sinal só, então truncar em direção a zero
 * dá o mesmo quociente e o mesmo resto nos dois caminhos.
 */
export function applyContinuous(draft: GameState, durationMs: number): void {
  if (durationMs <= 0) {
    return;
  }
  const { resources, accumulators, famine } = draft.settlement;
  const rates = netRates(draft);
  for (const id of RESOURCE_IDS) {
    // Na fome a comida fica em zero: só se consome o que existe (GDD §5.6).
    if (id === 'food' && famine && rates.food <= 0) {
      continue;
    }
    const total = accumulators[id] + rates[id] * durationMs;
    const delta = Math.trunc(total / HOUR_MS);
    accumulators[id] = total - delta * HOUR_MS;
    resources[id] += delta;
  }
}

/** Comida disponível na mesma escala do acumulador (milésimos × ms por hora). */
export function foodBalance(state: GameState): number {
  const { resources, accumulators } = state.settlement;
  return resources.food * HOUR_MS + accumulators.food;
}

/**
 * Milissegundos até a comida acabar: o maior intervalo em que o saldo ainda é não negativo.
 * `null` quando a comida não está caindo ou a fome já começou.
 */
export function foodRunsOutIn(state: GameState): number | null {
  if (state.settlement.famine) {
    return null;
  }
  const rate = netRates(state).food;
  if (rate >= 0) {
    return null;
  }
  return Math.max(0, Math.floor(foodBalance(state) / -rate));
}
