import type { ViewState } from '@lotg/protocol';

import { formatApprox, formatDuration, formatNumber, remainingNow } from './format';
import { sheetLine } from './guild';

/**
 * O Mercado, as caravanas e os Mestres como texto (GDD §5.4, §5.9, §13.1 a §13.6): o que a aba, a
 * árvore, os avisos e a paleta dizem dos preços, do volume que ainda cabe, da estrada e de quem
 * trabalha melhor com um Mestre. Nenhuma regra aqui: cada frase é montada com os números e as
 * frases que o servidor já mandou na visão. A única conta é a da ordem, que o contrato do
 * protocolo diz exata: `unidades × preço` em milésimos de ouro, sem outro arredondamento
 * (`market.prices[].buy` e `sell`, `caravanOffer.resources[].unitPrice`).
 */

export type Market = ViewState['market'];
export type PriceRow = Market['prices'][number];
export type Caravan = Market['caravans'][number];
export type CaravanOffer = Market['caravanOffer'];
export type CaravanResource = CaravanOffer['resources'][number];
export type Master = ViewState['masters'][number];
export type MasterOption = Master['options'][number];
export type Hero = ViewState['guild']['heroes'][number];
export type TradeDirection = 'buy' | 'sell';
export type MarketResource = PriceRow['resource'];

/** O ícone do Mercado: o mesmo na aba, na árvore, nos avisos e na barra de atividades. */
export const MARKET_ICON = 'tag';
export const CARAVAN_ICON = 'package';
export const MASTER_ICON = 'star-full';

/** A âncora do Mercado e a das caravanas na aba, e os argumentos de `lords.openPanel` deles. */
export const MARKET_ANCHOR = 'market-title';
export const MARKET_SECTION = 'market';
export const CARAVANS_ANCHOR = 'caravans-title';
export const CARAVANS_SECTION = 'caravans';

/** Os prefixos das linhas da árvore: o comando tira deles o recurso e o Mestre. */
export const PRICE_NODE = 'price:';
export const CARAVAN_NODE = 'caravan:';
export const MASTER_NODE = 'master:';

/** A tendência em palavra e ícone: a cor nunca diz sozinha para onde o preço foi. */
export const TRENDS: Record<PriceRow['trend'], { word: string; icon: string; mark: string }> = {
  up: { word: 'subindo', icon: 'arrow-up', mark: '▲' },
  down: { word: 'descendo', icon: 'arrow-down', mark: '▼' },
  flat: { word: 'estável', icon: 'remove', mark: '=' },
};

const gold = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

/**
 * Ouro a partir de milésimos, na forma da Crônica: "151,5", "1.904", "0,85". É só formatação do
 * número que o servidor já fixou; `buyText` e `sellText` seguem trazendo o preço da unidade.
 */
export function goldText(milli: number): string {
  return gold.format(milli / 1000);
}

/** "1,3 ▲": o preço de compra, como o servidor o escreve, e a marca de tendência. */
export function priceMark(row: Pick<PriceRow, 'buyText' | 'trend'>): string {
  return `${row.buyText} ${TRENDS[row.trend].mark}`;
}

/** O preço de um lado da tabela: o de compra ou o de venda. */
export const unitPrice = (row: PriceRow, direction: TradeDirection): number =>
  direction === 'buy' ? row.buy : row.sell;

/** O teto de um lado: o que a visão diz que seria aceito agora. */
export const maxFor = (row: PriceRow, direction: TradeDirection): number =>
  direction === 'buy' ? row.maxBuyable : row.maxSellable;

/** Por que um lado está fechado, na frase do servidor; `null` quando abre. */
export const blockedFor = (row: PriceRow, direction: TradeDirection): string | null =>
  direction === 'buy' ? row.buyBlockedReason : row.sellBlockedReason;

export const directionVerb = (direction: TradeDirection): string =>
  direction === 'buy' ? 'Comprar' : 'Vender';

/**
 * O total em ouro de uma ordem, em milésimos: `unidades × preço de hoje`, exato (o protocolo
 * garante que a ordem cobra e paga isso, sem outro arredondamento). `null` sem uma quantidade
 * inteira a partir de 1.
 */
export function tradeTotal(
  row: PriceRow,
  direction: TradeDirection,
  amount: number | null,
): number | null {
  return amount === null ? null : amount * unitPrice(row, direction);
}

/**
 * A quantidade digitada: um inteiro a partir de 1, sem outros sinais. `null` para o que não é.
 * É só a forma; quem confere o resto (o volume, o ouro, o depósito) é o servidor.
 */
export function parseAmount(input: string): number | null {
  const text = input.trim();
  if (!/^[0-9]+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/** "Comprar 100 de madeira por 123 de ouro": a linha que o jogador confirma. */
export function tradeLine(
  row: Pick<PriceRow, 'label'>,
  direction: TradeDirection,
  amount: number,
  totalMilli: number,
): string {
  const what = `${formatNumber(amount)} de ${row.label.toLowerCase()}`;
  return direction === 'buy'
    ? `Comprar ${what} por ${goldText(totalMilli)} de ouro`
    : `Vender ${what} por ${goldText(totalMilli)} de ouro`;
}

/** "Cabem mais 140 hoje." / "Hoje não cabe mais nada.": o volume que resta, na visão. */
export function remainingLine(row: PriceRow): string {
  return row.remainingToday > 0
    ? `Cabem mais ${formatNumber(row.remainingToday)} hoje.`
    : 'Hoje não cabe mais nada.';
}

/** "em 25 min": daqui a quanto o preço e o volume mudam (a virada do dia). */
export function changeLine(market: Market, elapsedSeconds: number): string | null {
  if (market.nextChangeInSeconds === null) {
    return null;
  }
  const left = remainingNow(market.nextChangeInSeconds, elapsedSeconds);
  return `em ${formatApprox(left)}`;
}

/** A linha da tabela para quem lê sem ver: o preço dos dois lados, a tendência e o que cabe. */
export function priceLabel(row: PriceRow): string {
  return [
    `${row.label}: compra a ${row.buyText}, venda a ${row.sellText}`,
    `${TRENDS[row.trend].word}`,
    remainingLine(row).replace(/\.$/, ''),
  ].join('; ');
}

/** O recurso de uma linha da tabela; `undefined` se o Mercado já não negocia aquele. */
export const priceOf = (market: Market, resource: string): PriceRow | undefined =>
  market.prices.find((row) => row.resource === resource);

/** O Mercado está de pé (a visão traz preços). */
export const hasMarket = (market: Market): boolean => market.level > 0 && market.prices.length > 0;

/**
 * "Mercado · comida 1,3 ▲ · madeira 1,1 ▼", o que a linha da árvore diz depois do nome: o preço
 * de compra e a tendência de cada recurso, em palavra curta e marca. Sem Mercado, a frase da
 * visão cabe na explicação, e a linha diz que ele não existe.
 */
export function marketTreeLine(market: Market): string {
  if (!hasMarket(market)) {
    return 'não erguido';
  }
  return market.prices.map((row) => `${row.label.toLowerCase()} ${priceMark(row)}`).join(' · ');
}

/**
 * A dica da linha do Mercado na árvore: a frase do servidor, o que cabe por recurso e quando o
 * preço muda.
 */
export function marketLines(market: Market, elapsedSeconds: number): string[] {
  if (!hasMarket(market)) {
    return [market.text];
  }
  const change = changeLine(market, elapsedSeconds);
  return [
    market.text,
    ...market.prices.map(
      (row) =>
        `${row.label}: compra ${row.buyText}, venda ${row.sellText} (${TRENDS[row.trend].word}). ${remainingLine(row)}`,
    ),
    ...(change === null ? [] : [`O preço muda ${change}.`]),
  ];
}

/** "Caravana a Porto do Rio · 240 madeira · chega em 52 min": a linha da estrada, da visão. */
export function caravanTreeLine(caravan: Caravan, elapsedSeconds: number): string {
  const left = remainingNow(caravan.arrivesInSeconds, elapsedSeconds);
  return `${caravan.cargoText} · chega em ${formatApprox(left)}`;
}

/** "chega em 52 min", com a contagem do relógio da página; zero é "chegando". */
export function arrivalIn(caravan: Pick<Caravan, 'arrivesInSeconds'>, elapsed: number): string {
  const left = remainingNow(caravan.arrivesInSeconds, elapsed);
  return left <= 0 ? 'chegando' : `chega em ${formatDuration(left)}`;
}

/** A oferta de uma caravana para um recurso; `undefined` sem ela. */
export const caravanResource = (
  offer: CaravanOffer,
  resource: string,
): CaravanResource | undefined => offer.resources.find((row) => row.resource === resource);

/**
 * Os heróis que a visão diz que podem escoltar, na ordem da lista da Guilda: quem decide é o
 * motor (`eligibleEscortIds`).
 */
export function escortHeroes(view: ViewState): Hero[] {
  const ids = new Set(view.market.caravanOffer.eligibleEscortIds);
  return view.guild.heroes.filter((hero) => ids.has(hero.id));
}

/**
 * A escolta que o jogador marcou e que a visão já não lista (partiu, feriu-se, foi mandada a
 * outro lugar): a frase que diz isso, para a tela nunca trocar a escolta por "sem escolta" em
 * silêncio. `null` com a escolta ainda disponível, ou sem nenhuma marcada.
 */
export function lostEscortLine(view: ViewState, chosenId: string | null): string | null {
  if (chosenId === null || escortHeroes(view).some((hero) => hero.id === chosenId)) {
    return null;
  }
  const name = view.guild.heroes.find((hero) => hero.id === chosenId)?.name ?? 'O herói marcado';
  return `${name} deixou de estar disponível para escoltar: a caravana sairia sem escolta.`;
}

/** "Edda · Guerreira Nv1": a escolta na lista e na confirmação. */
export const escortLine = (hero: Hero): string => `${hero.name} · ${sheetLine(hero)}`;

/**
 * O total que uma caravana rende se chegar inteira, em milésimos: `carga × preço fixado`. É a
 * mesma conta que `market.caravans[].goldText` traz depois do envio.
 */
export const caravanGold = (resource: CaravanResource, amount: number): number =>
  amount * resource.unitPrice;

/** Os Mestres livres (sem edifício) e à porta, para a linha dos trabalhadores. */
export const freeMasters = (view: ViewState): Master[] =>
  view.masters.filter((master) => master.building === null);

/**
 * O que um edifício passa a render com o Mestre, antes de confirmar: o ganho durante a
 * adaptação e o ganho depois dela, em unidades por hora real, como a visão os diz. Com o edifício
 * já tomado ou fora de alcance, o motivo do servidor.
 */
export function masterOptionLine(option: MasterOption): string {
  if (option.blockedReason !== null) {
    return option.blockedReason;
  }
  if (option.current) {
    return 'É onde ele trabalha.';
  }
  if (option.gainWhileAdaptingPerHour === option.gainPerHour) {
    // A primeira alocação é imediata: a visão diz o mesmo ganho nos dois, e não há adaptação.
    return `${option.label} Nv${option.level}: +${formatNumber(option.gainPerHour)}/h, na hora, sem adaptação.`;
  }
  return (
    `${option.label} Nv${option.level}: +${formatNumber(option.gainPerHour)}/h depois da adaptação, ` +
    `+${formatNumber(option.gainWhileAdaptingPerHour)}/h durante ela.`
  );
}

/** O Mestre de um edifício, da linha dos trabalhadores. */
export const masterOf = (view: ViewState, building: string): Master | undefined =>
  view.masters.find((master) => master.building === building);

/**
 * Os prazos do Mercado que pedem uma leitura nova no instante em que vencem: a mudança do preço
 * e do volume, a chegada de cada caravana e o fim da adaptação de cada Mestre. Só os prazos à
 * frente.
 */
export function marketDeadlines(view: ViewState): number[] {
  const { market } = view;
  return [
    market.nextChangeInSeconds,
    ...market.caravans.map((caravan) => caravan.arrivesInSeconds),
    ...view.masters.map((master) => master.adaptationEndsInSeconds),
  ].filter((seconds): seconds is number => typeof seconds === 'number' && seconds > 0);
}

/**
 * O atalho "Vender" ao lado de "cheio em 3 h" (IDEIA-11): o que se pode vender de um recurso
 * agora. `null` sem Mercado, ou com o volume de hoje esgotado, ou sem estoque.
 */
export function sellShortcut(
  view: ViewState,
  resource: string,
): { row: PriceRow; amount: number } | null {
  const row = priceOf(view.market, resource);
  // O que sobra é o excedente da visão (`surplusSellable`): o que o feudo guarda não se oferece.
  if (row === undefined || !hasMarket(view.market) || row.surplusSellable <= 0) {
    return null;
  }
  return { row, amount: row.surplusSellable };
}

/**
 * "Restam 662 de 1.062 de comida no feudo.": o que fica depois de uma venda, com o estoque da
 * visão. `null` na compra, sem o recurso na visão ou com mais do que o estoque (a ordem será
 * recusada pelo servidor).
 */
export function stockLeftLine(
  view: ViewState,
  row: Pick<PriceRow, 'resource' | 'label'>,
  direction: TradeDirection,
  amount: number,
): string | null {
  const stock = view.resources.find((entry) => entry.id === row.resource)?.stock;
  if (direction !== 'sell' || stock === undefined || amount > stock) {
    return null;
  }
  return `Restam ${formatNumber(stock - amount)} de ${formatNumber(stock)} de ${row.label.toLowerCase()} no feudo.`;
}

/**
 * A conferência aberta ainda vale? Ela é do recurso, do sentido e do clique em "Comprar" ou
 * "Vender" da tabela em que foi aberta (`pick`, que sobe a cada clique): escolher de novo o mesmo
 * recurso zera a quantidade, e a ordem velha não pode sobreviver a isso.
 */
export function reviewStillOpen(
  review: { resource: string; direction: TradeDirection; pick: number } | null,
  now: { resource: string; direction: TradeDirection; pick: number },
): boolean {
  return (
    review !== null &&
    review.resource === now.resource &&
    review.direction === now.direction &&
    review.pick === now.pick
  );
}
