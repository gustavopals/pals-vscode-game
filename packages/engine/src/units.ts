import { type Ratio, RESOURCE_IDS, type ResourceAmounts, type ResourceId } from '@lotg/content';

/** Estoques são guardados em milésimos de unidade, sempre inteiros. */
export const MILLI = 1000;
export const HOUR_MS = 3_600_000;
export const SECOND_MS = 1000;

export function toMilli(units: number): number {
  return Math.round(units * MILLI);
}

/** Converte um custo em unidades para milésimos, com zero nos recursos ausentes. */
export function amountsToMilli(amounts: ResourceAmounts): Record<ResourceId, number> {
  return {
    food: toMilli(amounts.food ?? 0),
    wood: toMilli(amounts.wood ?? 0),
    stone: toMilli(amounts.stone ?? 0),
    gold: toMilli(amounts.gold ?? 0),
  };
}

export function scaleDown(value: number, ratio: Ratio): number {
  return Math.floor((value * ratio.num) / ratio.den);
}

export function secondsUntil(fromMs: number, toMs: number): number {
  return Math.max(0, Math.ceil((toMs - fromMs) / SECOND_MS));
}

/** Recursos com quantidade positiva, na ordem canônica. */
export function positiveEntries(amounts: ResourceAmounts): Array<[ResourceId, number]> {
  return RESOURCE_IDS.flatMap((id): Array<[ResourceId, number]> => {
    const amount = amounts[id] ?? 0;
    return amount > 0 ? [[id, amount]] : [];
  });
}
