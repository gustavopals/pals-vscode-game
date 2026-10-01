import type { AccountState } from './accountService';

/** O lembrete aparece no terceiro dia real: 48 horas depois da primeira vez neste navegador. */
export const REMIND_AFTER_MS = 48 * 60 * 60 * 1000;

/** O que o navegador guarda do lembrete, por conta. */
export type LinkReminderRecord = {
  /** Primeira vez em que esta conta abriu um feudo neste navegador, em ms. */
  since: number;
  /** O lembrete já apareceu: não aparece de novo. */
  shown: boolean;
};

/**
 * O lembrete discreto do dia 3 (GDD §13.9): "Proteja seu reino". Aparece uma única vez, só para
 * quem ainda não tem como recuperar a conta. Conta dias reais, e não dias de jogo: o ritmo da
 * partida não muda quando o jogador precisa ser avisado.
 */
export function shouldRemindToLink(
  record: LinkReminderRecord | null,
  account: AccountState,
  now: number,
): boolean {
  if (record === null || record.shown) {
    return false;
  }
  if (account.kind !== 'anonymous' || account.hasRecoveryCode) {
    return false;
  }
  return now - record.since >= REMIND_AFTER_MS;
}

/** Lê o registro guardado, tolerando o formato antigo (`true` = já mostrado) e lixo. */
export function readReminderRecord(stored: unknown): LinkReminderRecord | null {
  if (stored === true) {
    return { since: 0, shown: true };
  }
  const record = stored as Partial<LinkReminderRecord> | null | undefined;
  return typeof record?.since === 'number' && typeof record.shown === 'boolean'
    ? { since: record.since, shown: record.shown }
    : null;
}
