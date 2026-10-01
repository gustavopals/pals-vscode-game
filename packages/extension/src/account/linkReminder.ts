import type { ViewState } from '@lotg/protocol';

import type { AccountState } from './accountService';

/** Dias de jogo em um dia real, no ritmo Normal: o terceiro dia real começa no 25º dia de jogo. */
const THIRD_REAL_DAY_STARTS_AT_GAME_DAY = 25;

/**
 * O lembrete discreto do dia 3 (GDD §13.9): "Proteja seu reino". Aparece uma única vez, só para
 * quem ainda não tem como recuperar a conta, e pode ser dispensado para sempre.
 */
export function shouldRemindToLink(
  view: ViewState | null,
  account: AccountState,
  alreadyHandled: boolean,
): boolean {
  if (alreadyHandled || view === null || account.kind !== 'anonymous' || account.hasRecoveryCode) {
    return false;
  }
  const { year, dayOfYear } = view.calendar;
  return year > 1 || dayOfYear >= THIRD_REAL_DAY_STARTS_AT_GAME_DAY;
}
