import type { GameEvent, ViewState } from '@lotg/protocol';

import { formatDuration, formatNumber, remainingNow } from './format';

export type VowsView = ViewState['vows'];
export type VowView = VowsView['offer'][number];
export type VowId = VowView['id'];

export const VOWS_SECTION = 'vows';
export const VOWS_ANCHOR = 'vows-title';
export const VOW_ICON = 'flag';

/** Os Votos da visão, com listas vazias e prazo zerado para visões antigas em cache. */
export function vowsOf(view: { vows?: ViewState['vows'] } | null | undefined): VowsView {
  return view?.vows ?? { offer: [], taken: [], closesInSeconds: 0 };
}

/** Há oferta de Votos aberta na visão entregue pelo servidor. */
export function hasVowOffer(view: { vows?: ViewState['vows'] } | null | undefined): boolean {
  const vows = vowsOf(view);
  return vows.closesInSeconds > 0 && vows.offer.length > 0;
}

/** Quantos segundos reais restam até a janela de Votos fechar, descontando o relógio local. */
export function vowsSecondsLeft(
  view: { vows?: ViewState['vows'] } | null | undefined,
  elapsedSeconds = 0,
): number {
  return remainingNow(vowsOf(view).closesInSeconds, elapsedSeconds);
}

/** A janela de Votos está aberta neste instante. */
export function vowsWindowOpen(
  view: { vows?: ViewState['vows'] } | null | undefined,
  elapsedSeconds = 0,
): boolean {
  return hasVowOffer(view) && vowsSecondsLeft(view, elapsedSeconds) > 0;
}

/**
 * Os Votos do rescaldo do Cerco e da virada de ano (ou já firmados no ano corrente): é quando a
 * janela e a escolha entram na aba Hoje e em "Você ainda pode decidir".
 */
export function isYearTurnVows(view: ViewState): boolean {
  return (
    (view.siege !== null && view.siege.result !== null) ||
    view.calendar.year > 1 ||
    vowsOf(view).taken.length > 0
  );
}

/** O bônus de Legado de um Voto, com o percentual entregue pela visão. */
export function vowBonusText(vow: Pick<VowView, 'legacyBonusPercent'>): string {
  return `+${formatNumber(vow.legacyBonusPercent)}% de Legado`;
}

/** O prazo da janela de Votos: "fecha em …" enquanto corre, ou "prazo encerrado" ao zerar. */
export function vowsDeadlineText(
  view: { vows?: ViewState['vows'] } | null | undefined,
  elapsedSeconds = 0,
): string {
  const left = vowsSecondsLeft(view, elapsedSeconds);
  return left <= 0 ? 'prazo encerrado' : `fecha em ${formatDuration(left)}`;
}

/** A assinatura da oferta e do que foi marcado para a conferência em duas etapas. */
export function vowsReviewSignature(
  offer: readonly VowView[],
  selectedIds: readonly VowId[],
): string {
  const offered = offer
    .map((vow) => `${vow.id}:${vow.legacyBonusPercent}:${vow.description}`)
    .join(',');
  const chosen = offer
    .filter((vow) => selectedIds.includes(vow.id))
    .map((vow) => vow.id)
    .join(',');
  return `${offered}|${chosen}`;
}

/**
 * O texto da segunda etapa da conferência: lembra que a escolha é irreversível no ano e lista os
 * Votos marcados (ou diz que nenhum foi marcado, pois governar sem Votos também é uma escolha).
 */
export function vowsConfirmationText(selected: readonly VowView[]): string {
  const chosen =
    selected.length === 0
      ? 'nenhum Voto marcado (governar o ano sem Votos)'
      : selected.map((vow) => `${vow.label} (${vowBonusText(vow)})`).join(', ');
  return `Conferir escolha: ${chosen}. Esta escolha é irreversível no ano e fecha a janela de Votos imediatamente.`;
}

export interface YearEndedVowsSummary {
  vowsText: string;
  legacy: number;
  score: number | null;
}

/**
 * Extrai os Votos e os pontos de Legado de um ano encerrado quando o evento `yearEnded` os traz
 * (`data.vows` e `data.legacy`). Os rótulos vêm do evento `vowsTaken` daquele ano ou da visão
 * recebida pelo controlador; nenhum nome de Voto fica escrito no app.
 */
export function yearEndedVowsSummary(
  year: number,
  events: readonly GameEvent[] = [],
  vows?: ViewState['vows'],
  knownLabels?: ReadonlyMap<string, string>,
): YearEndedVowsSummary | null {
  const ended = [...events]
    .reverse()
    .find(
      (event) =>
        event.type === 'yearEnded' &&
        (event.data.year === undefined || Number(event.data.year) === year),
    );
  if (ended === undefined) {
    return null;
  }
  const rawVows = typeof ended.data.vows === 'string' ? ended.data.vows.trim() : '';
  const legacy = typeof ended.data.legacy === 'number' ? ended.data.legacy : null;
  if (rawVows === '' && legacy === null) {
    return null;
  }
  const score = typeof ended.data.score === 'number' ? ended.data.score : null;
  const takenEvent = [...events]
    .reverse()
    .find((event) => event.type === 'vowsTaken' && Number(event.data.year) === year);
  const takenColon = takenEvent?.text.lastIndexOf(': ') ?? -1;
  const fromTakenEvent =
    takenEvent !== undefined && takenColon !== -1
      ? takenEvent.text
          .slice(takenColon + 2)
          .replace(/\.$/, '')
          .trim()
      : '';
  const known = new Map<string, string>(knownLabels);
  for (const entry of [...(vows?.taken ?? []), ...(vows?.offer ?? [])]) {
    known.set(entry.id, entry.label);
  }
  const ids = rawVows
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');
  const vowsText =
    fromTakenEvent !== '' ? fromTakenEvent : ids.map((id) => known.get(id) ?? id).join(', ');
  return {
    vowsText,
    legacy: legacy ?? 0,
    score,
  };
}
