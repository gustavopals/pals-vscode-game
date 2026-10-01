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

/** Duração por extenso: "5 min", "1 h 08 min", "8 h". */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  const hours = Math.floor(minutes / 60);
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')} min`;
}

/** Tempo aproximado, para o que não precisa de precisão: "37 h", "4 h", "25 min". */
export function formatApprox(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 48) {
    return `${Math.floor(hours / 24)} dias`;
  }
  return hours >= 1 ? `${Math.floor(hours)} h` : `${Math.max(1, Math.round(seconds / 60))} min`;
}

/** Quanto tempo o jogador ficou fora: "5 horas", "2 dias e 3 horas". */
export function formatAway(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  const plural = (value: number, one: string, many: string) =>
    `${value} ${value === 1 ? one : many}`;
  if (days === 0) {
    return plural(Math.max(1, hours), 'hora', 'horas');
  }
  const rest = hours % 24;
  return rest === 0
    ? plural(days, 'dia', 'dias')
    : `${plural(days, 'dia', 'dias')} e ${plural(rest, 'hora', 'horas')}`;
}

/** Segundos que faltam agora, descontando o tempo desde que a visão chegou. */
export function remaining(secondsAtReceipt: number, elapsedSeconds: number): number {
  return Math.max(0, secondsAtReceipt - Math.floor(Math.max(0, elapsedSeconds)));
}
