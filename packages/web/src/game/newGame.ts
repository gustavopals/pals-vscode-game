import type { CatalogResponse } from '@lotg/protocol';

/**
 * As opções de nova partida, como o servidor as manda em `GET /v1/catalog` (GDD §13.9): rótulos,
 * frases e o que vem marcado. O app não escreve nenhuma delas, nem número de regra.
 */
export type NewGameOptions = CatalogResponse['newGame'];
export type DifficultyOption = NewGameOptions['difficulties'][number];
export type PaceOption = NewGameOptions['paces'][number];

/** Dificuldade e ritmo de um feudo que vai nascer. Ficam gravados na partida. */
export type NewGameChoice = { difficulty: DifficultyOption['id']; timeScale: number };

const RECOMMENDED = ' (recomendado)';

/** "Senhor (recomendado)". */
export function difficultyLine(option: DifficultyOption): string {
  return `${option.label}${option.recommended ? RECOMMENDED : ''}`;
}

/** "Rápido: um ano em 56 horas (recomendado)". */
export function paceLine(option: PaceOption): string {
  return `${option.label}: ${option.description}${option.recommended ? RECOMMENDED : ''}`;
}

/**
 * A escolha que vale agora: a do jogador, enquanto estiver entre as opções; o resto é o que o
 * servidor traz marcado (`defaults`, que não é o mesmo que "recomendado": um servidor pode
 * rodar em outro ritmo padrão).
 */
export function resolveChoice(
  options: NewGameOptions,
  picked: Partial<NewGameChoice> = {},
): NewGameChoice {
  const difficulty = options.difficulties.some((entry) => entry.id === picked.difficulty)
    ? picked.difficulty
    : undefined;
  const timeScale = options.paces.some((entry) => entry.timeScale === picked.timeScale)
    ? picked.timeScale
    : undefined;
  return {
    difficulty: difficulty ?? options.defaults.difficulty,
    timeScale: timeScale ?? options.defaults.timeScale,
  };
}

/** "Senhor · Rápido: um ano em 56 horas": a escolha em uma linha, com os textos do servidor. */
export function choiceSummary(options: NewGameOptions, choice: NewGameChoice): string {
  const difficulty = options.difficulties.find((entry) => entry.id === choice.difficulty);
  const pace = options.paces.find((entry) => entry.timeScale === choice.timeScale);
  return [difficulty?.label, pace ? `${pace.label}: ${pace.description}` : undefined]
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
