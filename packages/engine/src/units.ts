import { type Ratio, RESOURCE_IDS, type ResourceAmounts, type ResourceId } from '@lotg/content';

/** Estoques são guardados em milésimos de unidade, sempre inteiros. */
export const MILLI = 1000;
export const HOUR_MS = 3_600_000;
export const SECOND_MS = 1000;

/**
 * O ritmo é o único número não inteiro que o estado guarda (`settings.timeScale`). Ele não entra
 * em nenhuma conta contínua: só converte prazos de tempo real em tempo de jogo no instante em
 * que o prazo nasce, e tempo de jogo em tempo real na visão.
 */
export function assertTimeScale(timeScale: unknown): asserts timeScale is number {
  if (typeof timeScale !== 'number' || !Number.isFinite(timeScale) || !(timeScale > 0)) {
    throw new Error(`Ritmo inválido: ${String(timeScale)}.`);
  }
}

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

/**
 * Um prazo de **tempo real** do conteúdo (`…RealMs`) em ms de jogo, no ritmo `timeScale`: é como
 * o prazo de resposta de uma carta, a carência e o passo da deserção por fome e a janela da
 * fome que reabre entram no motor (ADR 0016). Em um ritmo que não dê um número inteiro de
 * milissegundos, arredonda: o estado só guarda inteiros, e nenhum prazo vira zero.
 */
export function realToGameMs(realMs: number, timeScale: number): number {
  return Math.max(1, Math.round(realMs * timeScale));
}

/**
 * Segundos reais (arredondados para cima) de uma duração em ms de jogo, no ritmo `timeScale`:
 * é como todo prazo chega à visão.
 */
export function realSecondsCeil(gameMs: number, timeScale: number): number {
  return Math.max(0, Math.ceil(gameMs / timeScale / SECOND_MS));
}

export function secondsUntil(fromMs: number, toMs: number): number {
  return Math.max(0, Math.ceil((toMs - fromMs) / SECOND_MS));
}

/** Recursos com quantidade positiva, na ordem canônica. */
export function positiveEntries(amounts: ResourceAmounts): Array<[ResourceId, number]> {
  const entries: Array<[ResourceId, number]> = [];
  for (const id of RESOURCE_IDS) {
    const amount = amounts[id] ?? 0;
    if (amount > 0) {
      entries.push([id, amount]);
    }
  }
  return entries;
}
