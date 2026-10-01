import { type ThemeId, THEMES } from '../services/preferences';

export const THEME_LABELS: Record<ThemeId, string> = {
  dark: 'Escuro',
  light: 'Claro',
  'high-contrast': 'Alto contraste',
};

/**
 * O tema em uso: a escolha do jogador ou, na primeira visita, o que o sistema prefere
 * (`prefers-contrast` e `prefers-color-scheme`).
 */
export function resolveTheme(
  chosen: ThemeId | null,
  system: { prefersLight: boolean; prefersMoreContrast: boolean },
): ThemeId {
  if (chosen !== null) {
    return chosen;
  }
  if (system.prefersMoreContrast) {
    return 'high-contrast';
  }
  return system.prefersLight ? 'light' : 'dark';
}

/** O tema seguinte, na ordem do comando "Trocar tema". */
export function nextTheme(current: ThemeId): ThemeId {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length] ?? 'dark';
}

type MatchMedia = (query: string) => { matches: boolean };

export function systemTheme(matchMedia: MatchMedia | undefined) {
  return {
    prefersLight: matchMedia?.('(prefers-color-scheme: light)').matches ?? false,
    prefersMoreContrast: matchMedia?.('(prefers-contrast: more)').matches ?? false,
  };
}

/** Aplica o tema: `themes.css` define as variáveis `--vscode-*` para cada `data-theme`. */
export function applyTheme(root: { dataset: Record<string, string | undefined> }, theme: ThemeId) {
  root.dataset.theme = theme;
}
