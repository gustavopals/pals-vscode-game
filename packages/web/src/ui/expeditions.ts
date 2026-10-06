import type { GameEvent, ViewState } from '@lotg/protocol';

import { expiresIn, formatApprox, formatDuration, formatNumber, remainingNow } from './format';
import { FULL_SOON_SECONDS, joinList } from './format';

/**
 * As expedições como texto (GDD §9.2 a §9.4, §13.2 a §13.6): o que a aba Guilda, a árvore, a
 * barra de status, os avisos, a aba Hoje e a paleta dizem dos destinos, das equipes fora do
 * feudo, da encruzilhada, do relatório e do arsenal. Nenhuma regra aqui: cada frase é montada
 * com os números, os prazos e as frases que o servidor já mandou em `guild` e em
 * `pendingDecisions`. O app não conhece a espera da encruzilhada, os limiares dos desfechos, o
 * que cada Postura faz nem o que um item soma: lê tudo isso da visão.
 */

export type Guild = ViewState['guild'];
export type Hero = Guild['heroes'][number];
export type Destination = Guild['available'][number];
export type Expedition = Guild['expeditions'][number];
export type Crossroads = NonNullable<Expedition['crossroads']>;
export type CrossroadsOption = Crossroads['options'][number];
export type Report = Guild['reports'][number];
export type ReportStep = Report['log'][number];
export type Item = Guild['inventory'][number];
export type Posture = Guild['postures'][number];
export type EquipmentSlot = Hero['equipment'][number];

/** O ícone das expedições e o da encruzilhada: os mesmos na aba, na árvore e nos avisos. */
export const EXPEDITION_ICON = 'milestone';
export const CROSSROADS_ICON = 'git-compare';
export const REPORT_ICON = 'book';
export const ITEM_ICON = 'package';

/** As âncoras da aba Guilda, para quem chega por um botão. */
export const EXPEDITIONS_ANCHOR = 'expeditions-title';
export const REPORTS_ANCHOR = 'reports-title';
export const ARSENAL_ANCHOR = 'arsenal-title';
/** Os argumentos de `lords.openPanel` que levam a essas seções. */
export const EXPEDITIONS_SECTION = 'expeditions';
export const REPORTS_SECTION = 'reports';
export const ARSENAL_SECTION = 'arsenal';

/** Os prefixos das linhas da árvore: o comando tira deles a expedição e o destino. */
export const EXPEDITION_NODE = 'expedition:';
export const DESTINATION_NODE = 'destination:';

/** Um id de elemento a partir de um identificador do servidor. */
export const domId = (prefix: string, id: string, suffix = ''): string =>
  `${prefix}-${id.replace(/[^A-Za-z0-9_-]/g, '-')}${suffix === '' ? '' : `-${suffix}`}`;

/** O `id` do relatório de uma expedição na aba Guilda: é para onde a linha da Crônica leva. */
export const reportAnchor = (expeditionId: string): string => domId('report', expeditionId);
/** O `id` da encruzilhada de uma expedição na aba Guilda. */
export const crossroadsAnchor = (expeditionId: string): string =>
  domId('crossroads', expeditionId, 'title');

/**
 * A frase da guilda (`guild.text`) fala das expedições: há equipe e a Guilda dos Aventureiros
 * está de pé. Antes disso ela fala da equipe (como o primeiro herói chega, o que abre a
 * Guilda), e fica no painel dos heróis: a aba não diz a mesma frase duas vezes.
 */
export function expeditionsOwnText(guild: Guild): boolean {
  return guild.built && guild.heroes.length > 0;
}

/** As expedições paradas em uma encruzilhada, na ordem da visão. */
export function waitingExpeditions(guild: Guild): Expedition[] {
  return guild.expeditions.filter((expedition) => expedition.crossroads !== null);
}

/** "1 expedição", "2 expedições". */
export function expeditionCount(count: number): string {
  return count === 1 ? '1 expedição' : `${count} expedições`;
}

/**
 * O que a linha "Guilda" da árvore diz das expedições (GDD §13.2: "Guilda · 3 heróis · 1
 * expedição na encruzilhada"): as que esperam a palavra do jogador e, depois, as que estão em
 * viagem. Lista vazia sem nenhuma fora do feudo.
 */
export function expeditionsTreeParts(guild: Guild): string[] {
  const waiting = waitingExpeditions(guild).length;
  const traveling = guild.expeditions.length - waiting;
  return [
    ...(waiting > 0 ? [`${expeditionCount(waiting)} na encruzilhada`] : []),
    ...(traveling > 0 ? [`${expeditionCount(traveling)} em viagem`] : []),
  ];
}

/** Segundos que faltam para a Postura decidir, descontado o tempo desde que a visão chegou. */
export function crossroadsSecondsLeft(
  crossroads: Pick<Crossroads, 'decidesInSeconds'>,
  elapsedSeconds: number,
): number {
  return remainingNow(crossroads.decidesInSeconds, elapsedSeconds);
}

/**
 * O prazo acabou no relógio desta página e o servidor ainda não contou o que a Postura fez: a
 * encruzilhada não aceita mais resposta, e a próxima leitura a tira da tela.
 */
export function crossroadsOverdue(
  crossroads: Pick<Crossroads, 'decidesInSeconds'>,
  elapsedSeconds: number,
): boolean {
  return crossroadsSecondsLeft(crossroads, elapsedSeconds) <= 0;
}

/** "expira em 5 h": o prazo real da encruzilhada, no mesmo texto das cartas do Conselho. */
export function crossroadsDeadline(
  crossroads: Pick<Crossroads, 'decidesInSeconds'>,
  elapsedSeconds: number,
): string {
  return expiresIn(crossroads.decidesInSeconds, elapsedSeconds);
}

/** O prazo acaba antes de uma ausência comum: ganha o sinal de aviso, com ícone e palavra. */
export function crossroadsSoon(
  crossroads: Pick<Crossroads, 'decidesInSeconds'>,
  elapsedSeconds: number,
): boolean {
  return crossroadsSecondsLeft(crossroads, elapsedSeconds) < FULL_SOON_SECONDS;
}

/** A opção que a Postura toma sozinha se o prazo acabar. */
export function isPostureOption(crossroads: Crossroads, option: CrossroadsOption): boolean {
  return option.id === crossroads.postureOptionId;
}

/** "Edda e Rolf": a equipe, pelo nome. */
export function teamLine(names: readonly string[]): string {
  return joinList([...names]);
}

/**
 * Onde a equipe está e quanto falta, em poucas palavras, para a linha da árvore e a lista da
 * paleta: na encruzilhada, o prazo; a caminho, o nó de agora e em quanto tempo ele termina.
 */
export function expeditionProgress(expedition: Expedition, elapsedSeconds: number): string {
  if (expedition.crossroads !== null) {
    return `na encruzilhada · ${crossroadsDeadline(expedition.crossroads, elapsedSeconds)}`;
  }
  if (expedition.nodeEndsInSeconds === null) {
    return expedition.nodeTitle;
  }
  const left = remainingNow(expedition.nodeEndsInSeconds, elapsedSeconds);
  return `${expedition.nodeTitle} · ${left <= 0 ? 'chegando' : formatDuration(left)}`;
}

/** "O trecho de agora termina em 12 min."; `null` na encruzilhada. */
export function stretchEnds(expedition: Expedition, elapsedSeconds: number): string | null {
  if (expedition.nodeEndsInSeconds === null) {
    return null;
  }
  const left = remainingNow(expedition.nodeEndsInSeconds, elapsedSeconds);
  return left <= 0
    ? 'O trecho de agora está terminando.'
    : `O trecho de agora termina em ${formatDuration(left)}.`;
}

/** O que a explicação da linha de uma expedição diz: a equipe, a Postura e onde ela está. */
export function expeditionLines(expedition: Expedition, elapsedSeconds: number): string[] {
  const { crossroads } = expedition;
  return [
    `${teamLine(expedition.teamNames)} · Postura ${expedition.postureLabel}`,
    expedition.statusText,
    ...(crossroads === null
      ? [stretchEnds(expedition, elapsedSeconds)].filter((line) => line !== null)
      : [
          crossroads.text,
          `${capitalizeFirst(crossroadsDeadline(crossroads, elapsedSeconds))}. ${crossroads.postureText}`,
        ]),
  ];
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "dura 15 min": a duração anunciada de um destino, em tempo real, como a visão a mandou. */
export function durationLine(destination: Pick<Destination, 'durationSeconds'>): string {
  return `dura ${formatApprox(destination.durationSeconds)}`;
}

/** "Risco baixo a médio · dura 1 h": o destino em uma linha, para a árvore e a paleta. */
export function destinationTerms(destination: Destination): string {
  return `risco ${destination.riskText.toLowerCase()} · ${durationLine(destination)}`;
}

/**
 * Os heróis que este destino aceita agora, na ordem da ficha: os que a visão lista em
 * `eligibleHeroIds`. Quem serve (a prontidão, o nível, o que mais a jornada pedir) é conta do
 * servidor; a tela só deixa marcar quem ele trouxe.
 */
export function eligibleHeroes(guild: Guild, destination: Destination): Hero[] {
  return guild.heroes.filter((hero) => destination.eligibleHeroIds.includes(hero.id));
}

/**
 * Alguma equipe do feudo pode partir para este destino agora: é o que a visão diz (`canSend`).
 * O app não conta heróis para descobrir isso: a jornada pode pedir o que a contagem não vê.
 */
export function canSend(destination: Pick<Destination, 'canSend'>): boolean {
  return destination.canSend;
}

/** Os destinos que podem partir agora. */
export function sendable(guild: Guild): Destination[] {
  return guild.available.filter(canSend);
}

/**
 * Por que nenhuma equipe pode partir para este destino agora, na frase do servidor: o lugar na
 * Guilda, o destino fora de alcance, a gente que falta, a classe que falta. `null` quando pode.
 */
export function blockedReason(
  destination: Pick<Destination, 'canSend' | 'sendBlockedReason' | 'lockedReason'>,
): string | null {
  return destination.canSend ? null : (destination.sendBlockedReason ?? destination.lockedReason);
}

/**
 * A equipe que a tela de envio já traz marcada: a que a visão sugere (`suggestedTeam`), a menor
 * que serve. Enviar fica a dois cliques (abrir e confirmar); trocar é desmarcar e marcar.
 */
export function defaultTeam(destination: Pick<Destination, 'suggestedTeam'>): string[] {
  return [...destination.suggestedTeam];
}

/**
 * A Postura que já vem marcada: a do meio da lista da visão (nem a mais segura, nem a mais
 * arriscada). `undefined` se a visão não trouxer nenhuma.
 */
export function defaultPosture(postures: readonly Posture[]): Posture['id'] | undefined {
  return postures[Math.floor(Math.max(0, postures.length - 1) / 2)]?.id;
}

/** O que o botão "Enviar" manda ao comando `lords.sendExpedition`: o destino, a equipe e a Postura. */
export function sendArg(
  destination: Pick<Destination, 'modelId'>,
  heroIds: readonly string[],
  posture: Posture['id'] | undefined,
): { modelId: string; heroIds: string[]; posture: Posture['id'] | undefined } {
  return { modelId: destination.modelId, heroIds: [...heroIds], posture };
}

/**
 * Quantos heróis a equipe de um destino leva, em palavras, para o rótulo da escolha: "1 herói",
 * "2 heróis", "de 2 a 3 heróis". Os números são os da visão.
 */
export function teamSize(destination: Pick<Destination, 'teamMin' | 'teamMax'>): string {
  const { teamMin, teamMax } = destination;
  if (teamMin === teamMax) {
    return teamMin === 1 ? '1 herói' : `${teamMin} heróis`;
  }
  return `de ${teamMin} a ${teamMax} heróis`;
}

/** A equipe marcada tem o tamanho que o destino pede. */
export function teamFits(
  destination: Pick<Destination, 'teamMin' | 'teamMax'>,
  count: number,
): boolean {
  return count >= destination.teamMin && count <= destination.teamMax;
}

/**
 * A régua da equipe contra o primeiro trecho (ADR 0018, decisão 13), com os números que a visão
 * traz: o poder da equipe marcada (a soma do poder de cada herói contra a prova mais dura do
 * trecho, `heroFit`) ao lado dos dois poderes que o servidor diz (`fit`). `level` é só a
 * comparação desses números: com folga, no limite ou arriscado. `null` quando o trecho não tem
 * prova, ou sem ninguém marcado.
 */
export type TeamFit = {
  power: number;
  level: 'comfort' | 'tight' | 'risk';
  /** "Com folga", "No limite", "Arriscado": a palavra que acompanha o ícone. */
  label: string;
  icon: string;
  /** "A equipe marcada vale 51 contra o primeiro trecho.": para onde a palavra já está ao lado. */
  worth: string;
  /** "A equipe marcada vale 51 contra o primeiro trecho: no limite.": a frase sozinha. */
  text: string;
};

export function teamFit(destination: Destination, heroIds: readonly string[]): TeamFit | null {
  const { fit, heroFit } = destination;
  if (fit === null || heroIds.length === 0) {
    return null;
  }
  const power = heroIds.reduce(
    (sum, heroId) => sum + (heroFit.find((entry) => entry.heroId === heroId)?.power ?? 0),
    0,
  );
  const level = power >= fit.comfortPower ? 'comfort' : power >= fit.riskPower ? 'tight' : 'risk';
  const label = { comfort: 'Com folga', tight: 'No limite', risk: 'Arriscado' }[level];
  const icon = { comfort: 'pass', tight: 'circle-large-outline', risk: 'warning' }[level];
  const worth = `A equipe marcada vale ${formatNumber(power)} contra o primeiro trecho`;
  return {
    power,
    level,
    label,
    icon,
    worth: `${worth}.`,
    text: `${worth}: ${label.toLowerCase()}.`,
  };
}

/** O poder de um herói contra o primeiro trecho de um destino; `null` quando a visão não o traz. */
export function heroFitPower(destination: Destination, heroId: string): number | null {
  return destination.heroFit.find((entry) => entry.heroId === heroId)?.power ?? null;
}

/**
 * O ícone do desfecho de um passo (nada é dito só pela cor: a palavra vem sempre ao lado, na
 * frase do servidor). O que não é desfecho de prova (o trecho sem incidentes, o caminho
 * escolhido) tem ícone neutro.
 */
export function outcomeIcon(outcome: ReportStep['outcome']): string {
  switch (outcome) {
    case 'full':
      return 'star-full';
    case 'success':
      return 'pass';
    case 'setback':
      return 'warning';
    case 'disaster':
      return 'error';
    case 'chosen':
      return CROSSROADS_ICON;
    default:
      return 'arrow-right';
  }
}

/** O desfecho pede atenção: o Revés e o Desastre levam o tom de aviso, além do ícone e da palavra. */
export function outcomeIsBad(outcome: ReportStep['outcome']): boolean {
  return outcome === 'setback' || outcome === 'disaster';
}

/** "Patrulha dos Arredores · Rolf · Postura Cautelosa": o cabeçalho de um relatório. */
export function reportHeading(report: Pick<Report, 'label' | 'teamNames' | 'postureLabel'>) {
  return `${report.label} · ${teamLine(report.teamNames)} · Postura ${report.postureLabel}`;
}

/**
 * O relatório em poucas palavras, para a linha recolhida: o que trouxe ou, sem ninguém de volta,
 * que a equipe se perdeu. As frases são as do servidor.
 */
export function reportSummary(report: Report): string {
  return report.lootText;
}

/** "Arma: Lança de caça (+5% de poder)" ou "Arma: vazio": um espaço do herói em uma linha. */
export function slotLine(slot: EquipmentSlot): string {
  return slot.item === null
    ? `${slot.slotLabel}: vazio`
    : `${slot.slotLabel}: ${slot.item.label} (${slot.item.bonusText})`;
}

/** "Lança de caça · Arma · Comum": um item em uma linha, sem o que soma. */
export function itemLine(item: Item): string {
  return `${item.label} · ${item.slotLabel} · ${item.rarityLabel}`;
}

/** Os itens do arsenal que cabem em um espaço. */
export function itemsFor(guild: Guild, slot: EquipmentSlot['slot']): Item[] {
  return guild.inventory.filter((item) => item.slot === slot);
}

/** Os heróis que podem receber ou devolver um item: quem está no feudo. */
export function armableHeroes(guild: Guild): Hero[] {
  return guild.heroes.filter((hero) => hero.atHome);
}

/** O que um herói leva hoje no espaço de um item; `null` com o espaço vazio. */
export function wornIn(hero: Hero, slot: EquipmentSlot['slot']): Item | null {
  return hero.equipment.find((entry) => entry.slot === slot)?.item ?? null;
}

/** O destino de Resgate que a Guilda oferece agora (há alguém em cativeiro); `null` sem ele. */
export function rescueDestination(guild: Guild): Destination | null {
  return guild.available.find((destination) => destination.rescue) ?? null;
}

/**
 * As expedições que têm relatório guardado: é com elas que a aba Crônica casa a marca de cada
 * linha de expedição do documento. O relatório fica na visão por um número limitado de
 * jornadas, e depois disso a linha continua legível sozinha, sem ligação.
 */
export function keptReports(guild: Guild | null | undefined): ReadonlySet<string> {
  return new Set((guild?.reports ?? []).map((report) => report.expeditionId));
}

/** O relatório de que um evento fala, se ainda está guardado; `null` no resto. */
export function reportOf(guild: Guild | null | undefined, event: GameEvent): string | null {
  const expeditionId = event.data.expeditionId;
  return typeof expeditionId === 'string' &&
    (guild?.reports ?? []).some((report) => report.expeditionId === expeditionId)
    ? expeditionId
    : null;
}

/**
 * Os prazos das expedições que pedem uma leitura antecipada do servidor: o fim do nó de agora
 * de cada equipe, o prazo de cada encruzilhada e a recuperação de cada herói ferido. Só os
 * prazos à frente: zero é um estado que dura até a leitura seguinte, não um instante.
 */
export function expeditionDeadlines(guild: Guild): number[] {
  return [
    ...guild.expeditions.map((expedition) => expedition.nodeEndsInSeconds),
    ...guild.expeditions.map((expedition) => expedition.crossroads?.decidesInSeconds),
    ...guild.heroes.map((hero) => hero.injury?.recoversInSeconds),
  ].filter((seconds): seconds is number => typeof seconds === 'number' && seconds > 0);
}
