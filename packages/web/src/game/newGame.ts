import type { CatalogResponse } from '@lotg/protocol';

import { formatNumber } from '../ui/format';

/**
 * As opções de nova partida, como o servidor as manda em `GET /v1/catalog` (GDD §13.9): rótulos,
 * frases, custos e o que vem marcado. O app não escreve nenhuma delas, nem número de regra.
 */
export type NewGameOptions = CatalogResponse['newGame'];
export type DifficultyOption = NewGameOptions['difficulties'][number];
export type PaceOption = NewGameOptions['paces'][number];
export type ScenarioOption = NonNullable<NewGameOptions['scenarios']>[number];

/** Dificuldade, ritmo e cenário de um feudo que vai nascer. Ficam gravados na partida. */
export type NewGameChoice = {
  difficulty: DifficultyOption['id'];
  timeScale: number;
  scenario?: ScenarioOption['id'];
};

const RECOMMENDED = ' (recomendado)';

/** "Senhor (recomendado)". */
export function difficultyLine(option: DifficultyOption): string {
  return `${option.label}${option.recommended ? RECOMMENDED : ''}`;
}

/** "Rápido: um ano em 56 horas (recomendado)". */
export function paceLine(option: PaceOption): string {
  return `${option.label}: ${option.description}${option.recommended ? RECOMMENDED : ''}`;
}

/** "Serra do Ferro (200 de Legado)" ou "Terras do Feudo (recomendado)". */
export function scenarioLine(option: ScenarioOption): string {
  const cost = option.costLabel === null ? '' : ` (${option.costLabel})`;
  return `${option.label}${cost}${option.recommended ? RECOMMENDED : ''}`;
}

/** Um cenário com custo de Legado fica trancado enquanto a conta não atingir o mínimo. */
export function isScenarioLocked(option: ScenarioOption, legacy: number | null): boolean {
  return option.legacyCost > 0 && (legacy === null || legacy < option.legacyCost);
}

/** Motivo vindo do servidor quando o cenário está trancado; `null` quando desbloqueado. */
export function scenarioLockedText(option: ScenarioOption, legacy: number | null): string | null {
  if (!isScenarioLocked(option, legacy)) {
    return null;
  }
  const base = option.lockedReason ?? '';
  if (legacy !== null && legacy > 0) {
    return base === ''
      ? `Legado atual: ${formatNumber(legacy)}.`
      : `${base} Legado atual: ${formatNumber(legacy)}.`;
  }
  return base === '' ? null : base;
}

/**
 * A escolha que vale agora: a do jogador, enquanto estiver entre as opções (e desbloqueada); o
 * resto é o que o servidor traz marcado (`defaults`, que não é o mesmo que "recomendado": um
 * servidor pode rodar em outro ritmo padrão).
 */
export function resolveChoice(
  options: NewGameOptions,
  picked: Partial<NewGameChoice> = {},
  legacy: number | null = null,
): NewGameChoice {
  const difficulty = options.difficulties.some((entry) => entry.id === picked.difficulty)
    ? picked.difficulty
    : undefined;
  const timeScale = options.paces.some((entry) => entry.timeScale === picked.timeScale)
    ? picked.timeScale
    : undefined;
  const scenarios = options.scenarios;
  let scenario: ScenarioOption['id'] | undefined;
  if (scenarios !== undefined && scenarios.length > 0) {
    const unlocked = (id: ScenarioOption['id'] | undefined) =>
      id !== undefined &&
      scenarios.some((entry) => entry.id === id && !isScenarioLocked(entry, legacy));
    if (unlocked(picked.scenario)) {
      scenario = picked.scenario;
    } else if (unlocked(options.defaults.scenario)) {
      scenario = options.defaults.scenario;
    } else {
      scenario =
        scenarios.find((entry) => !isScenarioLocked(entry, legacy))?.id ??
        options.defaults.scenario;
    }
  }
  return {
    difficulty: difficulty ?? options.defaults.difficulty,
    timeScale: timeScale ?? options.defaults.timeScale,
    ...(scenario === undefined ? {} : { scenario }),
  };
}

/** "Senhor · Rápido: um ano em 56 horas · Serra do Ferro": a escolha em uma linha, com textos do servidor. */
export function choiceSummary(options: NewGameOptions, choice: NewGameChoice): string {
  const difficulty = options.difficulties.find((entry) => entry.id === choice.difficulty);
  const pace = options.paces.find((entry) => entry.timeScale === choice.timeScale);
  const scenario =
    choice.scenario === undefined
      ? undefined
      : options.scenarios?.find((entry) => entry.id === choice.scenario);
  return [
    difficulty?.label,
    pace ? `${pace.label}: ${pace.description}` : undefined,
    scenario?.label,
  ]
    .filter((part) => part !== undefined)
    .join(' · ');
}

/** A frase do que a dificuldade muda, para uma partida que já existe. */
export function difficultyDescription(
  options: NewGameOptions | null,
  difficulty: NewGameChoice['difficulty'],
): string | null {
  return options?.difficulties.find((entry) => entry.id === difficulty)?.description ?? null;
}
