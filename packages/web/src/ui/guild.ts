import type { ViewState } from '@lotg/protocol';

import { expeditionsTreeParts } from './expeditions';
import { formatApprox, formatCost, formatDuration, formatNumber, remainingNow } from './format';

/**
 * A Guilda e a Taverna como texto (GDD §9.1, §13.1 a §13.3): o que a aba, a árvore, a barra de
 * status, os avisos e a paleta dizem dos heróis, do soldo e dos candidatos. Nenhuma regra aqui:
 * cada frase é montada com os números, os prazos e as frases que o servidor já mandou na visão.
 */

export type Guild = ViewState['guild'];
export type Hero = Guild['heroes'][number];
export type ArrivingHero = Guild['arriving'][number];
export type WageArrears = NonNullable<Guild['wage']['arrears']>;
export type Tavern = ViewState['tavern'];
export type TavernOffer = Tavern['offers'][number];

/** O ícone da Guilda: o mesmo na aba, na árvore, nos avisos e na barra de status. */
export const GUILD_ICON = 'compass';
export const HERO_ICON = 'person';
export const TAVERN_ICON = 'coffee';

/** A âncora da Taverna na aba Guilda, para quem chega por um botão "Ver a Taverna". */
export const TAVERN_ANCHOR = 'tavern-title';
/** O argumento de `lords.openPanel` que leva à Taverna. */
export const TAVERN_SECTION = 'tavern';

/** Os prefixos das linhas da árvore: o comando tira deles o herói e o candidato. */
export const HERO_NODE = 'hero:';
export const OFFER_NODE = 'offer:';
/** A linha de um herói prometido que ainda não chegou, seguida do nome dele. */
export const ARRIVING_NODE = 'arriving:';

/** "1 herói", "3 heróis", "nenhum herói". */
export function heroCount(count: number): string {
  return count === 0 ? 'nenhum herói' : count === 1 ? '1 herói' : `${count} heróis`;
}

/** "1 candidato", "2 candidatos". */
export function candidateCount(count: number): string {
  return count === 1 ? '1 candidato' : `${count} candidatos`;
}

/** "6/h": o soldo de um herói, em ouro por hora real, sem sinal. */
export function wageOf(perHour: number): string {
  return `${formatNumber(perHour)}/h`;
}

/** "Guerreira Nv1 · Leal": a ficha em uma linha, sem o nome. */
export function sheetLine(sheet: {
  classLabel: string;
  level: number;
  traits: ReadonlyArray<{ label: string }>;
}): string {
  return [`${sheet.classLabel} Nv${sheet.level}`, ...sheet.traits.map((trait) => trait.label)].join(
    ' · ',
  );
}

/** Os traços com a explicação de cada um, uma frase por traço: "Leal: nunca fica descontente…". */
export function traitLines(traits: ReadonlyArray<{ label: string; text: string }>): string[] {
  return traits.map((trait) => `${trait.label}: ${trait.text}`);
}

/**
 * "XP 40/100" enquanto há nível a subir; no nível máximo, só o que foi juntado. O total para o
 * nível seguinte vem da visão.
 */
export function xpLine(hero: Pick<Hero, 'xp' | 'xpToNext'>): string {
  return hero.xpToNext === null
    ? `XP ${formatNumber(hero.xp)} (nível máximo)`
    : `XP ${formatNumber(hero.xp)}/${formatNumber(hero.xpToNext)}`;
}

/**
 * Por quanto tempo o ouro ainda paga a equipe (IDEIA-10: o soldo em horas). `null` sem herói e
 * com o atraso aberto, que tem as frases dele. Sem prazo na visão, o ouro não acaba.
 */
export function wageCoverage(guild: Guild, elapsedSeconds: number): string | null {
  const { wage } = guild;
  if (guild.heroes.length === 0 || wage.arrears !== null) {
    return null;
  }
  if (wage.coveredForSeconds === null) {
    return 'O ouro paga a equipe sem prazo: no passo de agora, ele não acaba.';
  }
  const left = remainingNow(wage.coveredForSeconds, elapsedSeconds);
  return `O ouro paga a equipe por mais ${formatApprox(left)}.`;
}

/**
 * Quando o ouro deixa de pagar a equipe: em quantos segundos (como a visão chegou) e se o prazo
 * já conta o soldo de quem ainda vai chegar (`wage.afterArrivals`). `null` quando o ouro não
 * acaba, sem equipe nem prometido, e com o atraso aberto, que tem os prazos dele.
 */
export type WageOutlook = { seconds: number; arrivals: boolean };

export function wageOutlook(guild: Guild): WageOutlook | null {
  const { wage } = guild;
  if (wage.arrears !== null) {
    return null;
  }
  const now = guild.heroes.length === 0 ? null : wage.coveredForSeconds;
  const ahead = wage.afterArrivals?.coveredForSeconds ?? null;
  if (ahead !== null && (now === null || ahead < now)) {
    return { seconds: ahead, arrivals: true };
  }
  return now === null ? null : { seconds: now, arrivals: false };
}

/**
 * O prazo de `wageOutlook` quando cai dentro de `horizonSeconds`: é o que pede preparo antes de
 * sair. O horizonte é de quem pergunta ("Antes de partir" usa o dele); aqui não há número.
 */
export function wageRisk(
  guild: Guild,
  horizonSeconds: number,
  elapsedSeconds = 0,
): WageOutlook | null {
  const outlook = wageOutlook(guild);
  if (outlook === null) {
    return null;
  }
  const seconds = remainingNow(outlook.seconds, elapsedSeconds);
  return seconds < horizonSeconds ? { ...outlook, seconds } : null;
}

/** "O ouro paga a equipe por mais 5 h: depois disso o soldo atrasa.", para quem vai sair. */
export function wageRiskLine(risk: WageOutlook): string {
  return (
    `${risk.arrivals ? 'Com quem está a caminho, o' : 'O'} ouro paga a equipe por mais ` +
    `${formatApprox(risk.seconds)}: depois disso o soldo atrasa.`
  );
}

/**
 * O soldo depois que os prometidos chegarem (`wage.afterArrivals`): quanto a equipe passa a
 * custar e por quanto tempo o ouro a paga. `null` sem ninguém a caminho e com o atraso aberto.
 */
export function arrivalsCoverage(guild: Guild, elapsedSeconds: number): string | null {
  const { afterArrivals, arrears } = guild.wage;
  if (afterArrivals === null || arrears !== null) {
    return null;
  }
  const start = `Com quem está a caminho, o soldo passa a ${wageOf(afterArrivals.perHour)} de ouro`;
  if (afterArrivals.coveredForSeconds === null) {
    return `${start}, e o ouro continua pagando sem prazo.`;
  }
  const left = remainingNow(afterArrivals.coveredForSeconds, elapsedSeconds);
  return `${start}: o ouro paga a equipe por mais ${formatApprox(left)}.`;
}

/**
 * O atraso que fechou e ainda cobra uma partida (`wage.lingering`): a frase do servidor, que diz
 * quem parte, e em quanto tempo vem a virada. `null` no caso comum.
 */
export function lingeringLine(guild: Guild, elapsedSeconds: number): string | null {
  const { lingering } = guild.wage;
  return lingering === null
    ? null
    : `${lingering.text} A virada vem em ${formatApprox(remainingNow(lingering.departureInSeconds, elapsedSeconds))}.`;
}

/**
 * O atraso em prazos, com os números da visão: há quanto tempo dura, em quanto tempo os heróis
 * ficam descontentes e em quanto tempo parte o próximo. Um prazo que a visão não traz (ninguém
 * mais a ficar descontente, ninguém a partir) não ganha frase.
 */
export function arrearsDeadlines(arrears: WageArrears, elapsedSeconds: number): string[] {
  const left = (seconds: number) => formatApprox(remainingNow(seconds, elapsedSeconds));
  return [
    ...(arrears.discontentInSeconds === null
      ? []
      : [`Descontentes em ${left(arrears.discontentInSeconds)}`]),
    ...(arrears.nextDepartureInSeconds === null
      ? []
      : [`Um herói parte em ${left(arrears.nextDepartureInSeconds)}`]),
  ];
}

/** "Soldo em atraso há 3 h". */
export function arrearsSince(arrears: WageArrears, elapsedSeconds: number): string {
  return `Soldo em atraso há ${formatApprox(arrears.secondsElapsed + Math.max(0, Math.floor(elapsedSeconds)))}`;
}

/** "chega em 1 h 27 min", ou "à porta" para quem já devia ter chegado. */
export function arrivalLine(arriving: ArrivingHero, elapsedSeconds: number): string {
  const left = remainingNow(arriving.arrivesInSeconds, elapsedSeconds);
  return left <= 0 ? 'à porta' : `chega em ${formatDuration(left)}`;
}

/**
 * O alerta do soldo em poucas palavras, para a linha da árvore: o atraso aberto; a partida que
 * o atraso fechado ainda cobra, com o prazo; ou o ouro que acaba dentro de `horizonSeconds`
 * (contando quem está a caminho). `null` quando não há o que alertar.
 */
export function wageAlert(guild: Guild, horizonSeconds: number, elapsedSeconds = 0): string | null {
  const { arrears, lingering } = guild.wage;
  if (arrears !== null) {
    return 'soldo em atraso';
  }
  if (lingering !== null) {
    return `um herói parte em ${formatApprox(remainingNow(lingering.departureInSeconds, elapsedSeconds))}`;
  }
  const risk = wageRisk(guild, horizonSeconds, elapsedSeconds);
  return risk === null ? null : `ouro para ${formatApprox(risk.seconds)} de soldo`;
}

/**
 * O que a linha "Guilda" da árvore diz (GDD §13.2: "Guilda · 3 heróis"): a equipe, quem está a
 * caminho e o alerta do soldo por extenso (`wageAlert`). `horizonSeconds` é o horizonte de
 * "Antes de partir", dado por quem monta a árvore: o prazo do ouro só entra na linha dentro dele.
 */
export function guildTreeLine(guild: Guild, horizonSeconds: number, elapsedSeconds = 0): string {
  const alert = wageAlert(guild, horizonSeconds, elapsedSeconds);
  return [
    heroCount(guild.heroes.length),
    ...(guild.arriving.length > 0 ? [`${guild.arriving.length} a caminho`] : []),
    // As expedições: primeiro as que esperam a palavra do jogador na encruzilhada.
    ...expeditionsTreeParts(guild),
    ...(alert === null ? [] : [`⚠ ${alert}`]),
  ].join(' · ');
}

/** A explicação da linha "Guilda": a frase do servidor, o soldo e a cobertura ou o atraso. */
export function guildLines(guild: Guild, elapsedSeconds: number): string[] {
  const { wage } = guild;
  const coverage = wageCoverage(guild, elapsedSeconds);
  const ahead = arrivalsCoverage(guild, elapsedSeconds);
  const lingering = lingeringLine(guild, elapsedSeconds);
  return [
    guild.text,
    ...(guild.heroes.length === 0 ? [] : [`Soldo da equipe: ${wageOf(wage.perHour)} de ouro.`]),
    ...(coverage === null ? [] : [coverage]),
    ...(ahead === null ? [] : [ahead]),
    ...(lingering === null ? [] : [lingering]),
    ...(wage.arrears === null
      ? []
      : [
          wage.arrears.text,
          ...arrearsDeadlines(wage.arrears, elapsedSeconds).map((line) => `${line}.`),
        ]),
  ];
}

/** "troca em 5 h 20 min": quando a lista de candidatos muda; `null` sem Taverna. */
export function rotationLine(tavern: Tavern, elapsedSeconds: number): string | null {
  return tavern.nextRotationInSeconds === null
    ? null
    : `troca em ${formatDuration(remainingNow(tavern.nextRotationInSeconds, elapsedSeconds))}`;
}

/** O que a linha "Taverna" da árvore diz: os candidatos e a troca da lista. */
export function tavernTreeLine(tavern: Tavern, elapsedSeconds: number): string {
  const rotation = rotationLine(tavern, elapsedSeconds);
  return [
    tavern.offers.length === 0 ? 'nenhum candidato' : candidateCount(tavern.offers.length),
    ...(rotation === null ? [] : [rotation]),
  ].join(' · ');
}

/** "80 de ouro · soldo de 6/h": o que um candidato custa agora e depois. */
export function offerTerms(offer: TavernOffer): string {
  return `${offer.priceText} · soldo de ${wageOf(offer.wagePerHour)}`;
}

/**
 * "176 de ouro": o preço de agora, sem a conta do desconto, para a linha estreita da árvore. É
 * o começo da frase do servidor (`priceText`), até os dois-pontos.
 */
export function offerPrice(offer: TavernOffer): string {
  return offer.priceText.split(':')[0] ?? offer.priceText;
}

/** O custo do festival, como o servidor o mandou: "100 comida, 50 ouro". */
export function festivalCost(tavern: Tavern): string {
  return formatCost(tavern.festival.cost);
}

/** "Festival em curso: a moral o conta por mais 25 min."; `null` sem festival. */
export function festivalRunning(tavern: Tavern, elapsedSeconds: number): string | null {
  const { activeForSeconds } = tavern.festival;
  return activeForSeconds === null
    ? null
    : `Festival em curso: a moral o conta por mais ${formatDuration(remainingNow(activeForSeconds, elapsedSeconds))}.`;
}
