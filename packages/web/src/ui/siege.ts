import type { ViewState } from '@lotg/protocol';

import { activeFormation, formatApprox, formatNumber, remainingNow } from './format';

export type Siege = NonNullable<ViewState['siege']>;
export type Wave = Siege['waves'][number]['number'];
export type WaveDecision = Extract<ViewState['pendingDecisions'][number], { kind: 'siegeWave' }>;
export const SIEGE_SECTION = 'siege';
export const SIEGE_ANCHOR = 'siege-title';

export const waveDecision = (view: ViewState): WaveDecision | undefined =>
  view.pendingDecisions.find((decision): decision is WaveDecision => decision.kind === 'siegeWave');

/** O prazo já vem em segundos reais, inclusive fora do ritmo Normal. */
export function waveDeadline(decision: WaveDecision, elapsed = 0): string {
  const left = remainingNow(decision.expiresInSeconds, elapsed);
  return left <= 0
    ? 'A onda seguinte está chegando'
    : `A onda seguinte chega em ${formatApprox(left)}`;
}

export function planFormation(view: ViewState, id: string | null): string {
  if (id !== null) {
    return (
      view.army.formations.find((formation) => formation.id === id)?.name ?? 'Formação indisponível'
    );
  }
  const active = activeFormation(view.army);
  return active === null
    ? 'Defesa ativa · nenhuma formação ativa'
    : `Defesa ativa · ${active.name}`;
}

export function siegeSummary(view: ViewState, elapsed = 0): string | null {
  const siege = view.siege;
  if (siege === null) return null;
  if (siege.result !== null) return siege.resultText;
  const decision = waveDecision(view);
  if (decision !== undefined) return waveDeadline(decision, elapsed);
  if (siege.current > 0) return `Cerco · ${siege.current} ondas enfrentadas`;
  return `Cerco em ${formatApprox(remainingNow(siege.scheduledInSeconds, elapsed))}`;
}

type RepairOffer = ViewState['threat']['defense']['wall']['repairOffer'];

/** Os dois reparos usam o orçamento público da muralha; emergência não espera a obra. */
export const emergencyTerms = (offer: RepairOffer): string =>
  `Reparar toda a muralha agora: ${formatNumber(offer.stone)} de pedra e ${formatNumber(offer.gold)} de ouro.`;

/** A conferência também pertence à decisão: nunca atravessa uma onda. */
export const emergencySignature = (decision: WaveDecision, offer: RepairOffer): string =>
  `${decision.id}:${offer.stone}:${offer.gold}`;

/** Só instantes futuros: o zero do cerco iniciado persiste e não acelera o ciclo. */
export function siegeDeadlines(view: ViewState): number[] {
  return [
    view.siege?.current === 0 && view.siege.result === null ? view.siege.scheduledInSeconds : null,
    view.siege?.result === null ? view.siege.nextWaveInSeconds : null,
    ...view.pendingDecisions
      .filter((entry) => entry.kind === 'siegeWave')
      .map((entry) => entry.expiresInSeconds),
  ].filter((seconds): seconds is number => typeof seconds === 'number' && seconds > 0);
}
