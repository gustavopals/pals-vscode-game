import type { ViewState } from '@lotg/protocol';

import type { Connection } from '../game/connection';

/** Número em pt-BR, com vírgula decimal e sem zeros à toa. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
}

/** Taxa com sinal: "+15/h", "−5/h", "0/h". */
export function formatRate(perHour: number): string {
  if (perHour === 0) {
    return '0/h';
  }
  return `${perHour > 0 ? '+' : '−'}${formatNumber(Math.abs(perHour))}/h`;
}

/**
 * Tempo restante como aparece na árvore e na barra de status: "00:42" (horas e minutos),
 * ou "2d 05h" a partir de um dia. Arredonda os minutos para cima: uma obra nunca mostra
 * 00:00 antes de terminar.
 */
export function formatRemaining(seconds: number): string {
  const minutes = Math.max(0, Math.ceil(seconds / 60));
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  if (days > 0) {
    return `${days}d ${pad(hours)}h`;
  }
  return `${pad(hours)}:${pad(minutes % 60)}`;
}

/** Duração por extenso para custos e prazos: "5 min", "1 h 08 min", "8 h". */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  return rest === 0
    ? `${Math.floor(minutes / 60)} h`
    : `${Math.floor(minutes / 60)} h ${String(rest).padStart(2, '0')} min`;
}

/** "80 madeira, 40 ouro". */
export function formatCost(cost: ReadonlyArray<{ amount: number; label: string }>): string {
  return cost
    .map((entry) => `${formatNumber(entry.amount)} ${entry.label.toLowerCase()}`)
    .join(', ');
}

/** Corta um texto longo com reticências. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Segundos que faltam para um prazo, descontando o tempo desde que a visão chegou. */
export function remainingNow(secondsAtReceipt: number, elapsedSeconds: number): number {
  return Math.max(0, secondsAtReceipt - Math.max(0, Math.floor(elapsedSeconds)));
}

export type StatusBarInput = {
  view: ViewState | null;
  connection: Connection;
  discreetMode: boolean;
  signedIn: boolean;
  /** Segundos desde que `view` chegou do servidor, para a contagem regressiva local. */
  elapsedSeconds: number;
  /** Notificações que ficaram só como badge. */
  pending: number;
};

export type StatusBarOutput = { text: string; tooltip: string };

/**
 * A linha da barra de status: uma linha, uma prioridade (GDD §13.5).
 * Sem ligação > fome > obra em andamento > produção de comida.
 */
export function statusBar(input: StatusBarInput): StatusBarOutput {
  const { view, connection } = input;
  if (!input.signedIn || connection.kind === 'unauthenticated') {
    return { text: '$(home) Lords of the Guild', tooltip: 'Jogar agora' };
  }
  const active = view?.constructions.active ?? null;
  const remaining =
    active === null ? null : remainingNow(active.secondsRemaining, input.elapsedSeconds);

  if (input.discreetMode) {
    // Só um contador: quem olha por cima do ombro não vê um jogo.
    const seconds =
      remaining ?? remainingNow(view?.calendar.secondsToNextDay ?? 0, input.elapsedSeconds);
    return {
      text: `$(circle-filled) ${formatRemaining(seconds)}`,
      tooltip: 'Lords of the Guild · modo discreto',
    };
  }
  if (connection.kind === 'offline') {
    return {
      text: '$(debug-disconnect) Sem ligação com o reino',
      tooltip: 'O mundo continua andando. Seus comandos voltam quando a ligação voltar.',
    };
  }
  if (view === null) {
    return { text: '$(home) Lords of the Guild', tooltip: 'Abrir o feudo' };
  }
  const name = view.settlement.name;
  const bell = input.pending > 0 ? ` · $(bell) ${input.pending}` : '';
  if (view.famine !== null) {
    return {
      text: `$(warning) Fome em ${name}${bell}`,
      tooltip: view.famine.text,
    };
  }
  if (active !== null && remaining !== null) {
    return {
      text: `$(tools) ${active.label} Nv${active.targetLevel} · ${formatRemaining(remaining)}${bell}`,
      tooltip: `${name}: obra em andamento`,
    };
  }
  const food = view.resources.find((row) => row.id === 'food');
  const rate =
    food === undefined ? '' : ` · ${formatRate(food.perHour).replace('/h', '')} comida/h`;
  return { text: `$(home) ${name}${rate}${bell}`, tooltip: food?.breakdown ?? name };
}

export type TextPart = { icon: string } | { text: string };

/** Separa um texto com ícones no formato `$(nome)` em pedaços, para desenhar os codicons. */
export function splitIcons(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let rest = text;
  for (;;) {
    const match = /\$\(([a-z0-9-]+)\)/.exec(rest);
    if (match === null) {
      break;
    }
    const before = rest.slice(0, match.index).trim();
    if (before !== '') {
      parts.push({ text: before });
    }
    parts.push({ icon: match[1] ?? '' });
    rest = rest.slice(match.index + match[0].length);
  }
  if (rest.trim() !== '') {
    parts.push({ text: rest.trim() });
  }
  return parts;
}

/** O texto de uma linha com ícones, sem eles. */
export function stripIcons(text: string): string {
  return splitIcons(text)
    .map((part) => ('text' in part ? part.text : ''))
    .filter((part) => part !== '')
    .join(' ');
}

const APP_TITLE = 'Lords of the Guild';

/**
 * O título da aba do navegador: o nome do feudo e, na frente, quantas novidades esperam. É o
 * que se vê com a aba em segundo plano. No modo discreto, só um contador.
 */
export function documentTitle(input: StatusBarInput): string {
  if (!input.signedIn || input.view === null) {
    return APP_TITLE;
  }
  if (input.discreetMode) {
    return stripIcons(statusBar(input).text);
  }
  const news = input.pending > 0 ? `(${input.pending}) ` : '';
  return `${news}${input.view.settlement.name} · ${APP_TITLE}`;
}
