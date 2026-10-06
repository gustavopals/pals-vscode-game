import { economico, economicoFor, economicoPolicies } from './economico';
import { explorador, exploradorFor, exploradorPolicies } from './explorador';
import { ousado, ousadoFor, ousadoPolicies } from './ousado';
import { preguicoso, preguicosoPolicies } from './preguicoso';
import type { Bot, Policy } from './types';

/** Os bots, pelo nome que a linha de comando aceita em `--strategy`. */
export const strategies = {
  economico,
  preguicoso,
  explorador,
  ousado,
} satisfies Record<string, Bot>;
export type StrategyName = keyof typeof strategies;

/** As políticas de cada bot, na ordem em que ele as aplica a cada sessão. */
export const strategyPolicies: Record<StrategyName, readonly Policy[]> = {
  economico: economicoPolicies,
  preguicoso: preguicosoPolicies,
  explorador: exploradorPolicies,
  ousado: ousadoPolicies,
};

const HOURS_PER_DAY = 24;

/** Os bots que preparam a ausência: recebem o prazo até a visita seguinte. */
const awayAware: Partial<Record<StrategyName, (awayHours: number) => Bot>> = {
  economico: economicoFor,
  explorador: exploradorFor,
  ousado: ousadoFor,
};

/**
 * O bot de uma estratégia para quem visita o feudo `sessionsPerDay` vezes por dia real. Um
 * jogador sabe quando volta, e os bots econômico e explorador preparam a ausência com esse
 * prazo; o preguiçoso decide o mínimo e não olha o relógio.
 */
export function botFor(strategy: StrategyName, sessionsPerDay: number): Bot {
  return awayAware[strategy]?.(HOURS_PER_DAY / sessionsPerDay) ?? strategies[strategy];
}
