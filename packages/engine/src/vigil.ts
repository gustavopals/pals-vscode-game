import { vigilRules } from '@lotg/content';

import { HOUR_MS } from './units';

/** Dados explícitos: o motor não consulta o relógio nem a base de fusos. */
export type VigilClock = {
  realOriginMs: number;
  timeScale: number;
  vigil: { hourLocal: number; utcOffsetMinutes: number };
};

const MINUTE_MS = 60_000;
const REAL_DAY_MS = 24 * HOUR_MS;
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

/**
 * Primeira Vigília a partir de +6 h, dentro da janela do evento (+24 h de jogo).
 * Se não couber, +12 h. O offset é fixo, sem horário de verão (GDD §4.3).
 * Arredondar para cima evita chegar antes do mínimo; o prazo é sempre inteiro.
 */
export function vigilAt(settings: VigilClock, startsAtMs: number): number {
  const minimum = startsAtMs + vigilRules.minimumDelayMs;
  const earliestReal = settings.realOriginMs + Math.ceil(minimum / settings.timeScale);
  const local = earliestReal + settings.vigil.utcOffsetMinutes * MINUTE_MS;
  const wait = modulo(settings.vigil.hourLocal * HOUR_MS - modulo(local, REAL_DAY_MS), REAL_DAY_MS);
  const candidate = Math.ceil((earliestReal + wait - settings.realOriginMs) * settings.timeScale);
  return candidate < startsAtMs + vigilRules.windowMs
    ? candidate
    : startsAtMs + vigilRules.fallbackDelayMs;
}
