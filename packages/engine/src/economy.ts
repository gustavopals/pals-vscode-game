import {
  balance,
  buildings,
  PRODUCTION_BUILDING_IDS,
  type Ratio,
  RESOURCE_IDS,
  type SeasonDef,
} from '@lotg/content';

import { seasonAt } from './clock';
import { type Hands, handsOf, masteryRatio } from './craft';
import { storeResource } from './storage';
import type { GameState, ProductionBuildingId, ResourceId } from './types';
import { HOUR_MS, MILLI } from './units';

/** O recurso que um edifício produtivo entrega. */
export function producedBy(building: ProductionBuildingId): ResourceId {
  const resource = buildings[building].produces;
  if (resource === null) {
    throw new Error(`O edifício ${building} não produz nada.`);
  }
  return resource;
}

/** O edifício que entrega um recurso. */
export function producerOf(resource: ResourceId): ProductionBuildingId {
  const producer = PRODUCTION_BUILDING_IDS.find((id) => buildings[id].produces === resource);
  if (producer === undefined) {
    throw new Error(`Nenhum edifício produz ${resource}.`);
  }
  return producer;
}

/**
 * Um fator da produção de um edifício: a fração que entra na conta e o nome com que ele aparece
 * na explicação do número ("× 1,3 (outono)").
 */
export type ProductionFactor = {
  id: 'level' | 'mastery' | 'season' | 'morale' | 'famine' | 'cold';
  ratio: Ratio;
  label: string;
};

/**
 * O fator da moral na produção, em fração exata (GDD §5.3): `base + perPoint × moral`. Com 3/4
 * e 1/200, é `(150 + moral) / 200`: × 0,75 com a moral em zero, × 1 em 50 e × 1,25 em 100.
 */
export function moraleRatio(morale: number): Ratio {
  const { base, perPoint } = balance.morale.multiplier;
  return {
    num: base.num * perPoint.den + perPoint.num * morale * base.den,
    den: base.den * perPoint.den,
  };
}

/**
 * Os fatores que multiplicam a produção de um edifício agora, na ordem em que a explicação os
 * mostra: nível, mestria, estação, moral, fome e frio (GDD §5.3). É **a** lista:
 * `productionRate` multiplica todos e a visão escreve um termo para cada um.
 *
 * `season` permite perguntar "e se fosse a outra estação?": é como a visão faz a conta da lenha
 * do inverno que ainda não chegou.
 */
export function productionFactors(
  state: GameState,
  building: ProductionBuildingId,
  season: SeasonDef = seasonAt(state.lastProcessedAt),
): ProductionFactor[] {
  const { levelBonus } = balance.production;
  const { buildings: levels, famine, cold, craftExperience, morale } = state.settlement;
  const level = levels[building];
  const experience = craftExperience[building];
  const factors: ProductionFactor[] = [
    {
      id: 'level',
      ratio: { num: levelBonus.den + levelBonus.num * (level - 1), den: levelBonus.den },
      label: `Nv${level}`,
    },
    { id: 'mastery', ratio: masteryRatio(experience), label: `mestria ${experience}` },
    {
      id: 'season',
      ratio: season.effects.production[producedBy(building)],
      label: season.label.toLowerCase(),
    },
    { id: 'morale', ratio: moraleRatio(morale), label: `moral ${morale}` },
  ];
  if (famine) {
    factors.push({ id: 'famine', ratio: balance.famine.productionMultiplier, label: 'fome' });
  }
  if (cold) {
    factors.push({ id: 'cold', ratio: balance.winter.cold.productionMultiplier, label: 'frio' });
  }
  return factors;
}

function gcd(a: number, b: number): number {
  let [x, y] = [a, b];
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

/**
 * Quantos trabalhadores adaptados valem os braços de um edifício, em fração: quem está em
 * adaptação entra com `adaptationMultiplier` (GDD §5.4). Dois adaptados e dois em adaptação,
 * com 1/2, valem 6/2 = 3.
 */
export function effectiveWorkers(hands: Hands): Ratio {
  const { num, den } = balance.craft.adaptationMultiplier;
  return { num: hands.adapted * den + hands.adapting * num, den };
}

/**
 * Produção bruta de um edifício, em milésimos por hora de jogo. É uma conta só, em frações, com
 * **um** arredondamento para baixo no fim (ADR 0013, decisão 13a):
 * trabalhadores (os em adaptação valem a fração) × taxa base × 1000 × nível × mestria × estação
 * × moral × fome × frio. A ordem dos fatores não muda o resultado. A fração é simplificada a cada
 * fator, só para os números da conta ficarem pequenos: o quociente é o mesmo.
 *
 * `hands` permite perguntar "e com outros braços?": um trabalhador adaptado, um recém-chegado.
 */
export function productionRate(
  state: GameState,
  building: ProductionBuildingId,
  hands: Hands = handsOf(state, building),
  season: SeasonDef = seasonAt(state.lastProcessedAt),
): number {
  const workers = effectiveWorkers(hands);
  let num = workers.num * balance.production.perWorkerPerHour[building] * MILLI;
  let den = workers.den;
  for (const factor of productionFactors(state, building, season)) {
    num *= factor.ratio.num;
    den *= factor.ratio.den;
    const common = gcd(num, den);
    num /= common;
    den /= common;
  }
  return Math.floor(num / den);
}

/** Comida consumida pelos habitantes, em milésimos por hora. */
export function consumptionRate(state: GameState): number {
  const { foodPerVillagerPerHour } = balance.consumption;
  return state.settlement.population.villagers * foodPerVillagerPerHour * MILLI;
}

/**
 * Lenha: madeira queimada pelos habitantes, em milésimos por hora de jogo. Zero nas estações
 * que não queimam lenha (GDD §4.1).
 */
export function firewoodRate(
  state: GameState,
  season: SeasonDef = seasonAt(state.lastProcessedAt),
): number {
  const { num, den } = season.effects.firewoodPerVillagerPerHour;
  return Math.floor((state.settlement.population.villagers * MILLI * num) / den);
}

/** Saldo líquido de cada recurso, em milésimos por hora. */
export function netRates(state: GameState): Record<ResourceId, number> {
  const rates: Record<ResourceId, number> = { food: 0, wood: 0, stone: 0, gold: 0 };
  const season = seasonAt(state.lastProcessedAt);
  for (const building of PRODUCTION_BUILDING_IDS) {
    rates[producedBy(building)] += productionRate(state, building, undefined, season);
  }
  rates.food -= consumptionRate(state);
  rates.wood -= firewoodRate(state, season);
  return rates;
}

/**
 * A taxa com que o estoque de um recurso anda de fato em um trecho, em milésimos por hora: o
 * saldo líquido, ou zero quando a escassez o segura. Na fome a comida fica em zero, porque só se
 * consome o que existe (GDD §5.6); no frio, a madeira (GDD §4.1). É a taxa de `applyContinuous`
 * e a de toda previsão que precisa bater com ele no milissegundo.
 */
export function flowRate(
  state: GameState,
  resource: ResourceId,
  rates: Record<ResourceId, number>,
): number {
  const { famine, cold } = state.settlement;
  if (resource === 'food' && famine && rates.food <= 0) {
    return 0;
  }
  if (resource === 'wood' && cold && rates.wood <= 0) {
    return 0;
  }
  return rates[resource];
}

/**
 * Aplica um trecho de produção e consumo contínuos, com taxas constantes.
 *
 * Cada recurso acumula `taxa × duração` (milésimos × ms) e só a parte inteira de
 * `acumulador / 3.600.000` vai para o estoque; o resto fica guardado. Como nada é arredondado
 * e descartado, o par (estoque, acumulador) depois de avançar `a + b` é idêntico ao de avançar
 * `a` e depois `b`: dentro de um trecho a taxa tem um sinal só, então truncar em direção a zero
 * dá o mesmo quociente e o mesmo resto nos dois caminhos. Vale também quando o resto guardado
 * tem o sinal contrário ao da taxa (a madeira, que sobe no outono e desce no inverno): o resto
 * é sempre menor que um milésimo, então o primeiro quociente depois da troca de sinal é zero.
 *
 * O que sobe passa pelo armazenamento (`storeResource`): entra o que cabe até o limite e o
 * resto é desperdício contado. A conta do resto é a mesma com ou sem limite, e cortar no limite
 * é associativo, então a divisão de intervalo continua exata no estoque e no desperdício. O que
 * desce, desce direto: um estoque acima do limite pode ser consumido.
 */
export function applyContinuous(draft: GameState, durationMs: number): void {
  if (durationMs <= 0) {
    return;
  }
  const { resources, accumulators } = draft.settlement;
  const rates = netRates(draft);
  for (const id of RESOURCE_IDS) {
    const rate = flowRate(draft, id, rates);
    if (rate === 0) {
      continue;
    }
    const total = accumulators[id] + rate * durationMs;
    const delta = Math.trunc(total / HOUR_MS);
    accumulators[id] = total - delta * HOUR_MS;
    if (delta > 0) {
      storeResource(draft, id, delta);
    } else {
      resources[id] += delta;
    }
  }
}

/** Estoque de um recurso na mesma escala do acumulador (milésimos × ms por hora). */
export function stockBalance(state: GameState, resource: ResourceId): number {
  const { resources, accumulators } = state.settlement;
  return resources[resource] * HOUR_MS + accumulators[resource];
}

/** O maior intervalo, em ms, em que o estoque ainda cobre uma taxa negativa. */
function coversFor(state: GameState, resource: ResourceId, rate: number): number {
  return Math.max(0, Math.floor(stockBalance(state, resource) / -rate));
}

/**
 * Milissegundos até a comida acabar: o maior intervalo em que o saldo ainda é não negativo.
 * `null` quando a comida não está caindo ou a fome já começou.
 */
export function foodRunsOutIn(state: GameState, rates = netRates(state)): number | null {
  if (state.settlement.famine || rates.food >= 0) {
    return null;
  }
  return coversFor(state, 'food', rates.food);
}

/**
 * Milissegundos até a madeira acabar na lareira. `null` quando a madeira não está caindo (fora
 * do inverno ela nunca cai sozinha) ou o frio já começou.
 */
export function woodRunsOutIn(state: GameState, rates = netRates(state)): number | null {
  if (state.settlement.cold || rates.wood >= 0) {
    return null;
  }
  return coversFor(state, 'wood', rates.wood);
}

/**
 * Há madeira para a lareira: o saldo é positivo, ou o estoque é positivo e cobre ao menos um
 * instante de lenha. É a condição que encerra o frio; como é o contrário exato da que o abre
 * (`woodRunsOutIn(...) === 0`), o frio nunca termina e recomeça no mesmo instante.
 */
export function woodCoversFirewood(state: GameState, rates = netRates(state)): boolean {
  if (rates.wood > 0) {
    return true;
  }
  if (state.settlement.resources.wood <= 0) {
    return false;
  }
  return rates.wood === 0 || coversFor(state, 'wood', rates.wood) >= 1;
}
