import { economico, economicoPolicies } from './economico';
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
