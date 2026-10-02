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

/**
 * Duração por extenso para custos e prazos: "40 s", "1 min 20 s", "5 min", "1 h 08 min", "8 h".
 * Abaixo de dez minutos os segundos aparecem: nos ritmos acelerados os prazos deixam de ser
 * minutos redondos, e "1 min" para uma obra de 1 min 20 s desmentiria a contagem regressiva.
 * Acima disso arredonda para cima: um prazo nunca é anunciado menor do que é.
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(1, Math.ceil(seconds));
  if (total < 60) {
    return `${total} s`;
  }
  if (total < 600 && total % 60 !== 0) {
    return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`;
  }
  const minutes = Math.ceil(total / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  return rest === 0
    ? `${Math.floor(minutes / 60)} h`
    : `${Math.floor(minutes / 60)} h ${String(rest).padStart(2, '0')} min`;
}

/** Tempo aproximado, para o que não precisa de precisão: "37 h", "4 h", "25 min". */
export function formatApprox(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 48) {
    return `${Math.floor(hours / 24)} dias`;
  }
  return hours >= 1 ? `${Math.floor(hours)} h` : `${Math.max(1, Math.round(seconds / 60))} min`;
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

type ResourceRow = ViewState['resources'][number];

/**
 * Em quanto tempo um estoque acaba, ou `null` se ele não acaba. É o `depletesInSeconds` da
 * visão, com um cuidado na madeira do inverno: esse prazo é a conta do estoque pela taxa de
 * agora e não olha o calendário, e a lareira apaga quando a estação vira. Com lenha para o
 * resto do inverno, "acaba em 4 dias" a um dia da primavera seria alarme falso. Quem olha o
 * calendário é a conta da lenha (`winter.firewood.missing`), feita pelo motor: sem nada
 * faltando, a madeira não acaba.
 */
export function runsOutIn(view: ViewState, row: ResourceRow): number | null {
  if (row.id === 'wood' && view.winter !== null && view.winter.firewood.missing === 0) {
    return null;
  }
  return row.depletesInSeconds;
}

/**
 * Abaixo disto, "cheio em" ganha destaque. É uma escolha de apresentação, não uma regra: é o
 * tamanho de uma ausência comum (GDD §2.3: nada exige voltar antes de 8 h), e o prazo já vem do
 * servidor em horas de relógio. Quem fica fora por menos do que isso não perde nada.
 */
export const FULL_SOON_SECONDS = 8 * 3600;

/** O depósito enche antes de uma ausência comum acabar: vale o destaque e a ação ao lado. */
export function fillsSoon(row: ResourceRow): boolean {
  return row.fullInSeconds !== null && row.fullInSeconds < FULL_SOON_SECONDS;
}

/** O depósito está cheio e a produção está indo ao chão. */
export function isWasting(row: ResourceRow): boolean {
  return row.full && row.wastingPerHour > 0;
}

/**
 * O limite de um recurso em poucas palavras, para a árvore (GDD §13.2): "⚠ cheio, perde 72/h",
 * "⚠ cheio em 4 h", "cheio em 37 h". O sinal acompanha o texto, nunca o substitui.
 * `null` quando não há o que dizer (sem limite, ou sem previsão de encher).
 */
export function storageAlert(row: ResourceRow): string | null {
  if (isWasting(row)) {
    return `⚠ cheio, perde ${formatNumber(row.wastingPerHour)}/h`;
  }
  if (row.full) {
    return 'cheio';
  }
  if (row.fullInSeconds === null) {
    return null;
  }
  return `${fillsSoon(row) ? '⚠ ' : ''}cheio em ${formatApprox(row.fullInSeconds)}`;
}

/**
 * O que dizer, em uma frase, de um recurso cujo depósito pede atenção; `null` para os outros.
 * Cheio, a frase é a do servidor (quanto vai ao chão por hora e o que fazer), com o que já se
 * perdeu desde a última virada do dia ao lado, para a perda ter tamanho. A menos de uma ausência
 * comum de encher, o lugar, o limite e o prazo.
 */
export function storageNotice(row: ResourceRow): string | null {
  if (row.full && row.fullNote !== null) {
    return row.wastedToday > 0
      ? `${row.fullNote} Hoje já se perderam ${formatNumber(row.wastedToday)}.`
      : row.fullNote;
  }
  if (fillsSoon(row) && row.fullInSeconds !== null && row.cap !== null) {
    const place = row.storageLabel ?? row.label;
    return `${place}: ${row.label.toLowerCase()} no limite de ${formatNumber(row.cap)} em ${formatApprox(row.fullInSeconds)}.`;
  }
  return null;
}

/**
 * De onde vem o limite, com o nome do lugar onde o recurso fica: "Despensa: 500 iniciais",
 * "Celeiro Nv2: 1.500". Os dois textos vêm do servidor; aqui só se evita dizer o nome duas vezes.
 */
export function capExplanation(row: ResourceRow): string | null {
  const { capBreakdown, storageLabel } = row;
  if (capBreakdown === null) {
    return null;
  }
  return storageLabel === null || capBreakdown.startsWith(storageLabel)
    ? capBreakdown
    : `${storageLabel}: ${capBreakdown}`;
}

type UpgradeRow = ViewState['constructions']['available'][number];

/** O edifício ainda não existe: a obra é erguê-lo, não melhorá-lo. */
export function isNewBuilding(upgrade: Pick<UpgradeRow, 'fromLevel'>): boolean {
  return upgrade.fromLevel === 0;
}

/** O nome de uma obra: "Fazenda Nv1 → Nv2" ou, para o que ainda não existe, "Construir: Celeiro". */
export function upgradeName(
  upgrade: Pick<UpgradeRow, 'label' | 'fromLevel' | 'targetLevel'>,
): string {
  return isNewBuilding(upgrade)
    ? `Construir: ${upgrade.label}`
    : `${upgrade.label} Nv${upgrade.fromLevel} → Nv${upgrade.targetLevel}`;
}

type Constructions = ViewState['constructions'];
type ActiveRow = NonNullable<Constructions['active']>;
type PlannedRow = Constructions['planned'][number];

/** As obras em curso, na ordem das filas abertas (GDD §6.3): nenhuma, uma ou duas. */
export function busyQueues(constructions: Constructions): ActiveRow[] {
  return constructions.queues.filter((queue) => queue !== null);
}

/** A obra em curso que termina primeiro; `null` com os pedreiros livres. */
export function soonestConstruction(constructions: Constructions): ActiveRow | null {
  return busyQueues(constructions).reduce<ActiveRow | null>(
    (soonest, queue) =>
      soonest === null || queue.secondsRemaining < soonest.secondsRemaining ? queue : soonest,
    null,
  );
}

/**
 * A primeira letra em maiúscula: as frases de espera do servidor vêm em minúscula e sem ponto,
 * prontas para o meio de uma linha.
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * O que uma obra planejada espera, como o servidor disse, com o prazo quando há um: "espera 15 de
 * ouro: em 1 h 51 min", "não cabe no Pátio: construa o Armazém". Sem espera, a obra já pode ser
 * iniciada. A frase e o prazo vêm prontos (GDD §6.3); aqui só se desconta o tempo desde a leitura.
 */
export function planWaiting(plan: Pick<PlannedRow, 'waiting'>, elapsedSeconds: number): string {
  const { waiting } = plan;
  if (waiting === null) {
    return 'pode começar agora';
  }
  return waiting.etaSeconds === null
    ? waiting.text
    : `${waiting.text}: em ${formatDuration(remainingNow(waiting.etaSeconds, elapsedSeconds))}`;
}

type RefundRow = ActiveRow['refund'][number];

/** "a", "a e b", "a, b e c". */
export function joinList(items: readonly string[]): string {
  return items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Como uma lista curta é escrita: "a, b, c" (árvore e diálogos) ou "a, b e c" (frases do painel). */
type ListStyle = 'commas' | 'sentence';

/**
 * O que o cancelamento de uma obra devolve, em duas partes: o que entra no estoque e o que não
 * cabe no depósito e se perderia. Cada parte é `null` quando não há nada a dizer. Os números são
 * os do servidor (GDD §5.5): o app não conhece a regra da devolução nem a dos limites.
 */
export function refundParts(
  refund: readonly RefundRow[],
  style: ListStyle = 'commas',
): { back: string | null; lost: string | null } {
  const list = (entries: ReadonlyArray<{ amount: number; label: string }>) => {
    const items = entries.map(
      (entry) => `${formatNumber(entry.amount)} ${entry.label.toLowerCase()}`,
    );
    if (items.length === 0) {
      return null;
    }
    return style === 'commas' ? items.join(', ') : joinList(items);
  };
  return {
    back: list(refund.filter((entry) => entry.amount > 0)),
    lost: list(
      refund
        .filter((entry) => entry.lost > 0)
        .map((entry) => ({ amount: entry.lost, label: entry.label })),
    ),
  };
}

/**
 * A devolução por extenso: "Cancelar devolve 30 madeira, 16 pedra. Não cabem no depósito e se
 * perderiam: 34 madeira." A abertura muda com o lugar ("Cancelar devolve", "Voltam", "Devolve").
 */
export function refundSentence(
  refund: readonly RefundRow[],
  lead: string,
  style: ListStyle = 'commas',
): string {
  const { back, lost } = refundParts(refund, style);
  const first = back === null ? 'Nada volta ao estoque.' : `${lead} ${back}.`;
  return lost === null ? first : `${first} Não cabem no depósito e se perderiam: ${lost}.`;
}

/** Em quanto tempo a lareira fica sem lenha; `null` fora do inverno, no frio ou com lenha que basta. */
export function firewoodRunsOutIn(view: ViewState): number | null {
  const wood = view.resources.find((row) => row.id === 'wood');
  return view.winter === null || wood === undefined ? null : runsOutIn(view, wood);
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

export type StatusBarOutput = {
  text: string;
  tooltip: string;
  /** A aba a que o clique leva; sem ela, vale a aba em que o app abriria. */
  target?: 'today' | 'fief';
  /** Fome ou frio: a linha ganha o destaque de aviso. */
  alarm?: boolean;
};

/** O assunto que toma a barra de status, e como ele aparece no título da aba do navegador. */
type StatusTopic = {
  /** A linha da barra, ainda sem o contador de novidades. */
  bar: StatusBarOutput;
  /** O mesmo assunto sem ícones, para o título da aba; `null` quando só há o nome do feudo. */
  title: string | null;
};

/**
 * O depósito que mais pede atenção: o que já está cheio e perde mais por hora; sem nenhum
 * perdendo, o que enche primeiro, se for antes de uma ausência comum (`FULL_SOON_SECONDS`).
 */
function mostPressingStorage(view: ViewState): ResourceRow | null {
  const wasting = view.resources.filter(isWasting);
  if (wasting.length > 0) {
    return wasting.reduce((worst, row) =>
      row.wastingPerHour > worst.wastingPerHour ? row : worst,
    );
  }
  return view.resources
    .filter(fillsSoon)
    .reduce<ResourceRow | null>(
      (soonest, row) =>
        soonest === null || (row.fullInSeconds ?? 0) < (soonest.fullInSeconds ?? 0) ? row : soonest,
      null,
    );
}

/**
 * O assunto de maior prioridade do feudo (GDD §13.5): decisões pendentes > fome e frio >
 * depósito cheio ou a menos de 8 h de encher > obra em andamento > produção de comida. A fome e
 * o frio têm cada um o seu ícone e o seu texto; juntos, dividem a linha e a explicação traz os
 * dois. Com duas obras em curso, aparece a que termina primeiro, e a outra entra como "+1 obra".
 */
function statusTopic(view: ViewState, elapsedSeconds: number): StatusTopic {
  const name = view.settlement.name;
  const decisions = view.pendingDecisions.length;
  if (decisions > 0) {
    const pending = `${decisions} ${decisions === 1 ? 'decisão pendente' : 'decisões pendentes'}`;
    return {
      bar: {
        text: `$(law) ${pending}`,
        tooltip: `${name}: ${pending}. Elas esperam na aba Hoje.`,
        target: 'today',
      },
      title: `${pending} · ${name}`,
    };
  }
  const cold = view.winter?.cold ?? null;
  if (view.famine !== null && cold !== null) {
    return {
      bar: {
        text: `$(warning) Fome e frio em ${name}`,
        tooltip: `${view.famine.text} ${cold.text}`,
        alarm: true,
      },
      title: `Fome e frio em ${name}`,
    };
  }
  if (view.famine !== null) {
    return {
      bar: { text: `$(warning) Fome em ${name}`, tooltip: view.famine.text, alarm: true },
      title: `Fome em ${name}`,
    };
  }
  if (cold !== null) {
    return {
      bar: { text: `$(flame) Frio em ${name}`, tooltip: cold.text, alarm: true },
      title: `Frio em ${name}`,
    };
  }
  const storage = mostPressingStorage(view);
  if (storage !== null) {
    const state = isWasting(storage)
      ? `cheio, perde ${formatNumber(storage.wastingPerHour)}/h`
      : `cheio em ${formatApprox(storage.fullInSeconds ?? 0)}`;
    // A explicação fala de todos os depósitos em alerta, não só do que tomou a linha.
    const notices = view.resources.map(storageNotice).filter((line) => line !== null);
    return {
      bar: {
        text: `$(archive) ${storage.label}: ${state}`,
        tooltip: notices.length > 0 ? notices.join(' ') : `${name}: ${storage.label} ${state}`,
        target: 'fief',
      },
      title: `${storage.label}: ${state} · ${name}`,
    };
  }
  // Com duas filas, a linha fala da obra que termina primeiro e conta as outras.
  const active = soonestConstruction(view.constructions);
  if (active !== null) {
    const others = busyQueues(view.constructions).length - 1;
    const remaining = formatRemaining(remainingNow(active.secondsRemaining, elapsedSeconds));
    const work = `${active.label} Nv${active.targetLevel} · ${remaining}`;
    return {
      bar: {
        text: `$(tools) ${work}${others > 0 ? ` · +${others} ${others === 1 ? 'obra' : 'obras'}` : ''}`,
        tooltip:
          others > 0 ? `${name}: ${others + 1} obras em andamento` : `${name}: obra em andamento`,
      },
      title: `${work} · ${name}`,
    };
  }
  const food = view.resources.find((row) => row.id === 'food');
  const rate =
    food === undefined ? '' : ` · ${formatRate(food.perHour).replace('/h', '')} comida/h`;
  return {
    bar: { text: `$(home) ${name}${rate}`, tooltip: food?.breakdown ?? name },
    title: null,
  };
}

/**
 * A linha da barra de status: uma linha, uma prioridade (GDD §13.5). Sem ligação passa na frente
 * de tudo; depois vale o assunto de `statusTopic`, com o contador de novidades ao lado. No modo
 * discreto, só um contador.
 */
export function statusBar(input: StatusBarInput): StatusBarOutput {
  const { view, connection } = input;
  if (!input.signedIn || connection.kind === 'unauthenticated') {
    return { text: '$(home) Lords of the Guild', tooltip: 'Jogar agora' };
  }
  if (input.discreetMode) {
    // Só um contador: quem olha por cima do ombro não vê um jogo. É o da obra que termina
    // primeiro ou, sem obra, o da próxima virada do dia.
    const active = view === null ? null : soonestConstruction(view.constructions);
    const seconds = remainingNow(
      active?.secondsRemaining ?? view?.calendar.secondsToNextDay ?? 0,
      input.elapsedSeconds,
    );
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
  const { bar } = statusTopic(view, input.elapsedSeconds);
  const bell = input.pending > 0 ? ` · $(bell) ${input.pending}` : '';
  return { ...bar, text: `${bar.text}${bell}` };
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
 * O título da aba do navegador: é o que se vê com a aba em segundo plano. Na frente, quantas
 * novidades esperam; depois, o mesmo assunto que toma a barra de status (decisões pendentes,
 * fome e frio, depósito a encher, obra) e o nome do feudo. Sem ligação o estado guardado pode
 * estar velho: fica só o nome. No modo discreto, só um contador.
 */
export function documentTitle(input: StatusBarInput): string {
  if (!input.signedIn || input.view === null) {
    return APP_TITLE;
  }
  if (input.discreetMode) {
    return stripIcons(statusBar(input).text);
  }
  const news = input.pending > 0 ? `(${input.pending}) ` : '';
  const name = input.view.settlement.name;
  const topic =
    input.connection.kind === 'online' ? statusTopic(input.view, input.elapsedSeconds).title : null;
  return `${news}${topic ?? name} · ${APP_TITLE}`;
}
