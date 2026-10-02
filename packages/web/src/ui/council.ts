import type { GameEvent, ViewState } from '@lotg/protocol';

import {
  clockDeadline,
  expiresIn,
  FULL_SOON_SECONDS,
  formatApprox,
  formatDuration,
  formatNumber,
  joinList,
  remainingNow,
} from './format';

export { pendingDecisionsLabel } from './format';

/**
 * O Conselho do Feudo como texto (GDD §7 e §13.2). Tudo o que é regra vem pronto em `council` e
 * em `pendingDecisions` do `ViewState`: a carta, o custo e a consequência conhecida de cada
 * opção, a pista, o que a tranca, o prazo em tempo real e o que o conselho faz sozinho. Aqui só
 * há frases de ligação e escolhas de apresentação; o app não conhece a cadência das audiências,
 * o limite de cartas à espera nem o prazo de resposta.
 */

export type Council = ViewState['council'];
export type CouncilCard = Council['pending'][number];
export type CouncilOption = CouncilCard['options'][number];
export type PendingDecision = ViewState['pendingDecisions'][number];

/** O ícone do Conselho em todo lugar: aba, árvore, barra de status e avisos. */
export const COUNCIL_ICON = 'law';

/** Segundos que faltam para a carta expirar, descontado o tempo desde que a visão chegou. */
export function cardSecondsLeft(
  card: Pick<CouncilCard, 'expiresInSeconds'>,
  elapsedSeconds: number,
): number {
  return remainingNow(card.expiresInSeconds, elapsedSeconds);
}

/**
 * O prazo acabou no relógio desta página e o servidor ainda não contou o que o conselho fez: a
 * carta não aceita mais resposta, e a próxima leitura a tira da mesa.
 */
export function cardOverdue(
  card: Pick<CouncilCard, 'expiresInSeconds'>,
  elapsedSeconds: number,
): boolean {
  return cardSecondsLeft(card, elapsedSeconds) <= 0;
}

/**
 * O prazo de uma carta, em tempo real: "expira em 14 h", "expira em 25 min". É o mesmo texto na
 * aba, na árvore, na aba Hoje e na barra de status (`expiresIn`).
 */
export function cardDeadline(
  card: Pick<CouncilCard, 'expiresInSeconds'>,
  elapsedSeconds: number,
): string {
  return expiresIn(card.expiresInSeconds, elapsedSeconds);
}

/**
 * A carta expira antes de uma ausência comum acabar (`FULL_SOON_SECONDS`, o mesmo limiar de
 * "cheio em"): quem sair agora volta e encontra a decisão tomada pelo conselho. É escolha de
 * apresentação, em horas de relógio; o prazo é o do servidor. Vale o destaque de aviso, sempre
 * com ícone e texto.
 */
export function expiresSoon(
  card: Pick<CouncilCard, 'expiresInSeconds'>,
  elapsedSeconds: number,
): boolean {
  return cardSecondsLeft(card, elapsedSeconds) < FULL_SOON_SECONDS;
}

/** "1 carta pendente", "2 cartas pendentes". */
export function pendingCards(count: number): string {
  return `${count} ${count === 1 ? 'carta pendente' : 'cartas pendentes'}`;
}

/**
 * O que falta para pagar uma opção: "Faltam 12 de pedra e 5 de ouro."; `null` se o estoque
 * paga.
 */
export function optionMissing(option: Pick<CouncilOption, 'cost'>): string | null {
  const missing = option.cost.filter((entry) => entry.missing > 0);
  if (missing.length === 0) {
    return null;
  }
  const items = missing.map(
    (entry) => `${formatNumber(entry.missing)} de ${entry.label.toLowerCase()}`,
  );
  const verb = missing.length === 1 && missing[0]?.missing === 1 ? 'Falta' : 'Faltam';
  return `${verb} ${joinList(items)}.`;
}

/**
 * Por que uma opção não pode ser escolhida agora, em uma frase: o requisito que a tranca (a frase
 * é a do servidor: "Requer o Celeiro.") ou o que falta para pagá-la. `null` quando ela pode.
 */
export function optionBlock(
  option: Pick<CouncilOption, 'cost' | 'locked' | 'lockedReason' | 'affordable'>,
): { kind: 'locked' | 'unaffordable'; text: string } | null {
  if (option.locked) {
    return { kind: 'locked', text: option.lockedReason ?? 'O feudo não cumpre o que ela exige.' };
  }
  if (!option.affordable) {
    return {
      kind: 'unaffordable',
      text: optionMissing(option) ?? 'O estoque não paga o custo.',
    };
  }
  return null;
}

/** A opção que o conselho aplica sozinho se o prazo acabar. */
export function isDefaultOption(card: Pick<CouncilCard, 'defaultOptionId'>, option: CouncilOption) {
  return option.id === card.defaultOptionId;
}

/**
 * Quando o conselho volta a se reunir, em uma frase. Com carta a caminho, "Próxima audiência em
 * 2 h 10 min."; quando a audiência não vai trazer carta, o porquê é o do servidor (`note`: a
 * mesa cheia, ou nenhum assunto para o feudo como ele está), seguido do prazo.
 */
export function nextAudience(council: Council, elapsedSeconds: number): string {
  const left = remainingNow(council.nextAudienceInSeconds, elapsedSeconds);
  const when = `Próxima audiência em ${formatDuration(left)}.`;
  return council.note === null ? when : `${council.note} ${when}`;
}

/**
 * O Conselho em poucas palavras, para a linha da árvore (GDD §13.2): "1 carta pendente (expira
 * em 14 h)", com o prazo da que vence primeiro; sem cartas, quando é a próxima audiência, ou que
 * ela não traz assunto.
 */
export function councilSummary(view: ViewState, elapsedSeconds: number): string {
  const { council, pendingDecisions } = view;
  // `pendingDecisions` vem do prazo mais curto ao mais longo: a primeira é a que vence antes.
  const soonest = pendingDecisions[0];
  if (soonest !== undefined) {
    return `${pendingCards(council.pending.length)} (${deadlineAlert(soonest, elapsedSeconds)})`;
  }
  const left = remainingNow(council.nextAudienceInSeconds, elapsedSeconds);
  return council.nextCardInSeconds === null
    ? 'sem assunto por agora'
    : `próxima audiência em ${formatApprox(left)}`;
}

/**
 * O prazo de uma carta para a árvore: como `cardDeadline`, com o sinal de alerta na frente
 * quando ela expira antes de uma ausência comum acabar ("⚠ expira em 3 h"), como os depósitos
 * a encher. O sinal acompanha o texto, nunca o substitui.
 */
export function deadlineAlert(
  card: Pick<CouncilCard, 'expiresInSeconds'>,
  elapsedSeconds: number,
): string {
  return `${expiresSoon(card, elapsedSeconds) ? '⚠ ' : ''}${cardDeadline(card, elapsedSeconds)}`;
}

/** O estoque em uma linha, para ler ao lado dos custos: "900 comida · 296 madeira · 85 pedra". */
export function stockLine(view: ViewState): string {
  return view.resources
    .map((row) => `${formatNumber(row.stock)} ${row.label.toLowerCase()}`)
    .join(' · ');
}

/**
 * O texto do aviso de carta nova (GDD §13.5) e o que o detalha: o prazo de resposta e o que o
 * conselho faz sozinho, nas frases do servidor.
 *
 * `when` é o instante em que a visão chegou e o fuso de quem joga: com eles o aviso diz também
 * até que hora do relógio a carta espera ("por 23 h, até amanhã às 08:20"). O aviso fica na tela
 * até ser dispensado, e "por 23 h" envelhece; a hora, não. É só a soma do prazo, que já vem em
 * tempo real, ao relógio do navegador.
 */
export function cardNotice(
  card: CouncilCard,
  when?: { now: number; timeZone?: string },
): { text: string; details: string[] } {
  const until =
    when === undefined
      ? null
      : clockDeadline(when.now, when.now + card.expiresInSeconds * 1000, when.timeZone);
  return {
    text: `Nova carta do Conselho: ${card.title}`,
    details: [
      `Espera a sua resposta por ${formatApprox(card.expiresInSeconds)}${until === null ? '' : `, até ${until}`}.`,
      card.expiryNote,
    ],
  };
}

/**
 * Os acontecimentos do Conselho na Crônica: a carta que chega, a resposta, a expiração e o
 * efeito tardio.
 */
const COUNCIL_EVENTS: ReadonlyArray<GameEvent['type']> = [
  'cardDrawn',
  'cardAnswered',
  'cardExpired',
  'cardEffectApplied',
];

/** Uma linha da Crônica que fala das cartas. */
export function isCouncilEvent(event: GameEvent): boolean {
  return COUNCIL_EVENTS.includes(event.type);
}

/** Quantas linhas do conselho a aba mostra. */
export const COUNCIL_RECORD_LINES = 6;

/**
 * O que o conselho registrou, como o controlador o guarda: as linhas da Crônica sobre as cartas,
 * da mais antiga para a mais nova, e como foi a leitura que as procurou. A procura vai além da
 * Crônica recente: uma carta espera 24 h na mesa, e nesse tempo a Crônica escreve bem mais que
 * as 20 linhas dela (obras, recrutas, feridos, marcas da Ameaça).
 */
export type CouncilLog = {
  /** `idle`: ainda não lida (a página abriu sem ligação); `error`: a leitura falhou. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  lines: GameEvent[];
  /**
   * A leitura chegou ao começo da Crônica. Sem linha nenhuma, só assim é verdade que o conselho
   * ainda não registrou nada.
   */
  complete: boolean;
};

export const EMPTY_COUNCIL_LOG: CouncilLog = { status: 'idle', lines: [], complete: false };

/**
 * O que o conselho registrou, da linha mais nova para a mais antiga: as frases da Crônica que
 * falam das cartas (a que chegou, o que o senhor decidiu, o que o conselho fez sozinho e o que
 * veio depois de uma escolha). É onde a resposta dada há um instante aparece contada.
 */
export function councilRecord(
  chronicle: readonly GameEvent[],
  max = COUNCIL_RECORD_LINES,
): GameEvent[] {
  return chronicle.filter(isCouncilEvent).slice(-max).reverse();
}

/**
 * A frase da seção "O que o conselho registrou" quando ela não tem linha a mostrar. Vazio, fora
 * do trecho lido e leitura que falhou são coisas diferentes, e cada uma tem a sua frase: "Nada
 * ainda" só quando a leitura chegou ao começo da Crônica. `chronicle` diz se a seção oferece a
 * Crônica inteira, onde está o que a leitura não alcançou.
 */
export function councilRecordEmpty(
  log: CouncilLog,
  online: boolean,
): { text: string; chronicle: boolean } {
  if (log.status === 'ready') {
    return log.complete
      ? {
          text: 'Nada ainda. As cartas que chegam, o que você decide e o que vem depois de cada escolha ficam registrados aqui e na Crônica.',
          chronicle: false,
        }
      : {
          text: 'As linhas mais recentes da Crônica não falam do conselho. O que ele registrou antes está na Crônica inteira.',
          chronicle: true,
        };
  }
  if (log.status === 'error') {
    return {
      text: 'Não deu para ler agora o que o conselho registrou. Está tudo na Crônica inteira.',
      chronicle: true,
    };
  }
  if (!online) {
    return {
      text: 'Sem ligação com o reino: o que o conselho registrou vem da Crônica, que é lida com a ligação.',
      chronicle: false,
    };
  }
  return { text: 'Lendo o que o conselho registrou…', chronicle: false };
}
