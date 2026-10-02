import { economico, economicoFor, economicoPolicies } from './economico';
import { preguicoso, preguicosoPolicies } from './preguicoso';
import type { Bot, Policy } from './types';

/** Os bots, pelo nome que a linha de comando aceita em `--strategy`. */
export const strategies = { economico, preguicoso } satisfies Record<string, Bot>;
export type StrategyName = keyof typeof strategies;

/** As políticas de cada bot, na ordem em que ele as aplica a cada sessão. */
export const strategyPolicies: Record<StrategyName, readonly Policy[]> = {
  economico: economicoPolicies,
  preguicoso: preguicosoPolicies,
};

const HOURS_PER_DAY = 24;

/**
 * O bot de uma estratégia para quem visita o feudo `sessionsPerDay` vezes por dia real. Um
 * jogador sabe quando volta, e o bot econômico prepara a ausência com esse prazo; o preguiçoso
 * decide o mínimo e não olha o relógio.
 */
export function botFor(strategy: StrategyName, sessionsPerDay: number): Bot {
  return strategy === 'economico'
    ? economicoFor(HOURS_PER_DAY / sessionsPerDay)
    : strategies[strategy];
}
