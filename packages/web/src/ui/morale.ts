import type { ReturnReport, ViewState } from '@lotg/protocol';

import { formatDuration, formatNumber, remainingNow } from './format';

/**
 * A moral como texto (GDD §5.7). O número, a faixa, a conta termo a termo, o fator na produção,
 * o que a próxima virada do dia vai fazer e o conselho vêm prontos em `morale` do `ViewState`;
 * aqui só se escolhem o ícone e as palavras de ligação. O app não conhece os limites das faixas,
 * o peso de termo nenhum nem as chances de alguém chegar ou partir.
 */

type Morale = ViewState['morale'];
export type MoraleBand = Morale['band'];

/**
 * Um ícone por faixa, sempre ao lado do nome dela: a faixa nunca é dita só pelo ícone nem só
 * pela cor. Do pior para o melhor: o polegar para baixo, os resmungos, o sorriso e a estrela.
 */
const BAND_ICONS: Record<MoraleBand, string> = {
  desperate: 'thumbsdown',
  restless: 'comment-discussion',
  content: 'smiley',
  proud: 'star-full',
};

export function moraleIcon(band: MoraleBand): string {
  return BAND_ICONS[band];
}

/** O ícone da faixa que um evento traz em `data.band`; nada, se o dado não for uma faixa. */
export function bandIcon(band: unknown): string | undefined {
  return typeof band === 'string' && Object.hasOwn(BAND_ICONS, band)
    ? BAND_ICONS[band as MoraleBand]
    : undefined;
}

/** "Moral 60 (Contente)". */
export function moraleTitle(morale: { value: number; bandLabel: string }): string {
  return `Moral ${formatNumber(morale.value)} (${morale.bandLabel})`;
}

/**
 * O que a moral faz com a produção, nas palavras do servidor: "produção × 1,05", "não mexe na
 * produção". É o resto da frase `text`, que começa pelo número e pela faixa. Se a frase mudar de
 * forma, devolve `null`, e quem a mostra fica só com o número e a faixa.
 */
export function moraleEffect(morale: Pick<Morale, 'value' | 'bandLabel' | 'text'>): string | null {
  const lead = `${moraleTitle(morale)}: `;
  return morale.text.startsWith(lead) ? morale.text.slice(lead.length).replace(/\.$/, '') : null;
}

export type MoraleTrend = 'rising' | 'falling' | 'steady';

/** Para onde a próxima virada do dia leva a moral, se nenhuma ordem chegar antes. */
export function moraleTrend(morale: { value: number; next: { value: number } }): MoraleTrend {
  if (morale.next.value === morale.value) {
    return 'steady';
  }
  return morale.next.value > morale.value ? 'rising' : 'falling';
}

/**
 * A próxima virada em poucas palavras: "cai para 40 (Inquieto)", "sobe para 60". A faixa só
 * entra quando muda. `null` quando a moral fica onde está.
 */
export function moraleNextSummary(morale: Pick<Morale, 'value' | 'band' | 'next'>): string | null {
  const trend = moraleTrend(morale);
  if (trend === 'steady') {
    return null;
  }
  const band = morale.next.band === morale.band ? '' : ` (${morale.next.bandLabel})`;
  return `${trend === 'rising' ? 'sobe' : 'cai'} para ${formatNumber(morale.next.value)}${band}`;
}

/** A moral está tirando produção agora: o fator que veio na visão é menor que um. */
export function moraleHurts(morale: Pick<Morale, 'multiplierPercent'>): boolean {
  return morale.multiplierPercent < 100;
}

/** Algo pesa na conta da próxima virada: o conselho do servidor fala de uma perda, não de um bônus. */
export function moraleBurdened(morale: Pick<Morale, 'terms'>): boolean {
  return morale.terms.some((term) => term.amount < 0);
}

/** Um termo da conta: "50" para o primeiro (a base), "+10" e "−20" para os outros. */
export function termAmount(amount: number, index: number): string {
  if (index === 0) {
    return formatNumber(amount).replace('-', '−');
  }
  return `${amount < 0 ? '−' : '+'}${formatNumber(Math.abs(amount))}`;
}

/** A frase da comida guardada, quando o conselho ainda não a disse: sem repetir a mesma linha. */
export function reserveNote(morale: Pick<Morale, 'advice' | 'foodReserve'>): string | null {
  const { text } = morale.foodReserve;
  return morale.advice !== null && morale.advice.includes(text) ? null : text;
}

/**
 * A explicação da moral, frase a frase: o que ela faz agora, para onde vai na próxima virada, a
 * conta dessa virada com o prazo, e o que fazer. Tudo do servidor; o prazo desconta o tempo
 * desde a leitura.
 */
export function moraleLines(morale: Morale, elapsedSeconds: number): string[] {
  const due = formatDuration(remainingNow(morale.nextUpdateInSeconds, elapsedSeconds));
  return [
    morale.text,
    morale.nextText,
    `A conta dessa virada, daqui a ${due}: ${morale.breakdown}.`,
    ...(morale.advice === null ? [] : [morale.advice]),
  ];
}

/** A explicação do número do cabeçalho, em uma linha só. */
export function moraleExplanation(morale: Morale, elapsedSeconds: number): string {
  return moraleLines(morale, elapsedSeconds).join(' ');
}

/**
 * O que a linha "Moral" da árvore diz: "60 (Contente)", "60 (Contente) · ⚠ cai para 40
 * (Inquieto)". A barra lateral é estreita: "na virada do dia" fica para a explicação da linha.
 */
export function moraleTreeLine(morale: Pick<Morale, 'value' | 'band' | 'bandLabel' | 'next'>) {
  const next = moraleNextSummary(morale);
  const now = `${formatNumber(morale.value)} (${morale.bandLabel})`;
  if (next === null) {
    return now;
  }
  // O sinal acompanha o texto, como nos alertas dos depósitos; a subida não pede alerta.
  return `${now} · ${moraleTrend(morale) === 'falling' ? '⚠ ' : ''}${next}`;
}

type ReportMorale = NonNullable<ReturnReport['morale']>;

/**
 * A moral no Relatório de Retorno: "Moral 28 (Inquieto): caiu de 60 (Contente).", "Moral 60
 * (Contente), como na sua última visita." Sem a moral de antes (a visão guardada era de outra
 * versão), só a de agora.
 */
export function moraleSince(morale: ReportMorale): string {
  const now = moraleTitle(morale);
  const { before } = morale;
  if (before === undefined) {
    return `${now}.`;
  }
  if (before.value === morale.value) {
    return `${now}, como na sua última visita.`;
  }
  const verb = morale.value > before.value ? 'subiu' : 'caiu';
  return `${now}: ${verb} de ${formatNumber(before.value)} (${before.bandLabel}).`;
}

/** "1 colono", "2 colonos". */
const counted = (count: number, one: string, many: string) =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/**
 * Quem chegou e quem se foi na ausência, pelas contagens dos eventos: uma frase por motivo, cada
 * uma com o seu porquê, ou `null` quando ninguém se moveu por ele. O Relatório de Retorno põe as
 * chegadas em "O feudo prosperou" e as perdas em "O que exigiu um preço": seis deserções são uma
 * linha, não seis.
 */
export function peopleMoved(counts: ReturnReport['counts']): {
  /** Os recrutados que chegaram: quem o Salão mandou chamar. */
  recruits: string | null;
  /** Os colonos que vieram sozinhos, atraídos pela moral alta. */
  settlers: string | null;
  /** Quem partiu com a moral baixa. */
  left: string | null;
  /** Quem desertou na fome longa. */
  deserted: string | null;
} {
  const recruits = counts.villagersArrived;
  const settlers = counts.settlersArrived ?? 0;
  const left = counts.villagersLeft ?? 0;
  const deserted = counts.villagersDeserted ?? 0;
  return {
    recruits:
      recruits > 0
        ? `${recruits === 1 ? 'Chegou' : 'Chegaram'} ${counted(recruits, 'recruta', 'recrutas')} que o Salão mandou chamar.`
        : null,
    settlers:
      settlers > 0
        ? `${settlers === 1 ? 'Chegou' : 'Chegaram'} ${counted(settlers, 'colono', 'colonos')} sem ninguém chamar: a moral alta atrai gente.`
        : null,
    left:
      left > 0
        ? `${left === 1 ? 'Partiu' : 'Partiram'} ${counted(left, 'aldeão', 'aldeões')}: a moral estava baixa.`
        : null,
    deserted:
      deserted > 0
        ? `${deserted === 1 ? 'Desertou' : 'Desertaram'} ${counted(deserted, 'aldeão', 'aldeões')}: a fome durou demais.`
        : null,
  };
}
