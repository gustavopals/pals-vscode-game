import { type ChroniclePlaceholder, chronicleTemplates } from '@lotg/content';

import { calendarAt, ofSeason, seasonWithArticle } from './clock';
import type { GameEvent, GameEventType, GameState } from './types';

type PhraseParams = Partial<Record<ChroniclePlaceholder, string | number>>;

/**
 * Frase da Crônica de um evento, a partir do modelo em `@lotg/content` e do calendário.
 * `template` troca o modelo do tipo por outro do conteúdo (a obra que ergue um edifício do zero).
 */
export function narrate(
  type: GameEventType,
  state: GameState,
  atMs: number,
  params: PhraseParams = {},
  template: string = chronicleTemplates[type],
): string {
  const date = calendarAt(atMs);
  const values: PhraseParams = {
    dia: date.dayOfSeason,
    estacao: date.season.label,
    aEstacao: seasonWithArticle(date.season),
    daEstacao: ofSeason(date.season),
    ano: date.year,
    feudo: state.settlement.name,
    ...params,
  };
  return template.replace(/\{([^}]*)\}/g, (marker, name: string) => {
    const value = values[name as ChroniclePlaceholder];
    return value === undefined ? marker : String(value);
  });
}

/**
 * Acrescenta um evento à saída. O motor emite a frase dentro do evento e não a guarda no estado:
 * Crônica e eventos vivem fora do `GameState` (GDD §14.11).
 */
export function emit(
  events: GameEvent[],
  state: GameState,
  atMs: number,
  type: GameEventType,
  data: Record<string, string | number> = {},
  params: PhraseParams = {},
  template?: string,
): void {
  events.push({ type, atMs, text: narrate(type, state, atMs, params, template), data });
}
