const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Número em pt-BR: "1.024", "7,5". */
export function formatNumber(value: number): string {
  return number.format(value);
}

/** Taxa por hora com sinal: "+15", "−5", "0". */
export function formatSigned(value: number): string {
  if (value === 0) {
    return '0';
  }
  return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value))}`;
}

/** Contagem regressiva por segundo: "04:59", "1:07:30". */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(total % 60)}`
    : `${pad(minutes)}:${pad(total % 60)}`;
}

export { formatApprox, formatAway, formatDuration } from '../ui/format';

/** Segundos que faltam agora, descontando o tempo desde que a visão chegou. */
export function remaining(secondsAtReceipt: number, elapsedSeconds: number): number {
  return Math.max(0, secondsAtReceipt - Math.floor(Math.max(0, elapsedSeconds)));
}
