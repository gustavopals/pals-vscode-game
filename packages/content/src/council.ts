import type { BuildingId, DifficultyId, ResourceAmounts, ResourceId, SeasonId } from './ids';

/**
 * O Conselho do Feudo (GDD §7; ADR 0014, decisões 1, 9, 18 e 20): os tipos de uma carta. As
 * cartas ficam em `cards/`, uma cadeia por arquivo; os números da cadência e do prazo, em
 * `balance.council`; o schema, em `schemas.ts` (`CouncilCardSchema` e `CouncilCatalogSchema`).
 */

/** O que uma carta pode fazer na v0.2. Herói, unidade, mapa, Mercado e combate ficam de fora. */
export const COUNCIL_EFFECT_TYPES = [
  'resources',
  'morale',
  'setFlag',
  'clearFlag',
  'scheduleCard',
] as const;
export type CouncilEffectType = (typeof COUNCIL_EFFECT_TYPES)[number];

export type CouncilEffect =
  /**
   * Recursos, em unidades. Positivo é ganho: entra o que cabe no depósito, e o que não cabe é
   * desperdício contado (GDD §5.5). Negativo é perda: sai o que houver, e o estoque nunca fica
   * abaixo de zero.
   */
  | { readonly type: 'resources'; readonly amounts: Partial<Record<ResourceId, number>> }
  /** Moral, por `durationDays` dias de jogo: conta em exatamente esse número de viradas do dia. */
  | { readonly type: 'morale'; readonly amount: number; readonly durationDays: number }
  /** Um marcador narrativo. Nunca é texto de interface nem sai na visão. */
  | { readonly type: 'setFlag'; readonly flag: string }
  | { readonly type: 'clearFlag'; readonly flag: string }
  /** A continuação: outra carta chega `afterDays` dias de jogo depois, furando o sorteio. */
  | { readonly type: 'scheduleCard'; readonly cardId: string; readonly afterDays: number };

/** Quando uma carta pode ser sorteada. Sem um campo, ele não restringe. */
export type CouncilCardRequires = {
  readonly seasons?: readonly SeasonId[];
  /** O dia de jogo do feudo, a contar da fundação (o primeiro é 1), a partir do qual ela pode sair. */
  readonly minDay?: number;
  /** Nível mínimo de cada edifício: `{ granary: 1 }` é "com o Celeiro erguido". */
  readonly buildings?: Partial<Record<BuildingId, number>>;
  /** Todas gravadas. */
  readonly flags?: readonly string[];
  /** Nenhuma gravada. */
  readonly notFlags?: readonly string[];
  /** A moral do feudo, do mínimo ao máximo, os dois inclusive. */
  readonly moralRange?: readonly [number, number];
};

/** O que uma opção exige além do custo. Sem o requisito, ela aparece trancada, com o motivo. */
export type CouncilOptionRequires = {
  /** O edifício tem de existir (nível 1 ou mais). */
  readonly building?: BuildingId;
  /** Recursos que o feudo tem de ter em estoque, sem gastá-los. */
  readonly resources?: ResourceAmounts;
};

/**
 * O que o jogador não vê ao escolher: acontece `afterDays` viradas do dia depois da escolha, e
 * só então vira evento e linha da Crônica. A opção sempre traz uma pista (`hint`).
 */
export type CouncilHiddenOutcome = {
  readonly afterDays: number;
  readonly effects: readonly CouncilEffect[];
  /** A frase da Crônica do instante em que o efeito acontece. */
  readonly chronicle: string;
};

export type CouncilOption = {
  readonly id: string;
  /** Verbo no infinitivo, sem números: "Ceder a madeira". O custo vai em `cost`. */
  readonly label: string;
  readonly requires?: CouncilOptionRequires;
  /** Pago na hora da escolha, em unidades. */
  readonly cost?: ResourceAmounts;
  /** As consequências conhecidas: a visão as mostra ao lado do custo, antes da escolha. */
  readonly effects: readonly CouncilEffect[];
  /** A pista: o que pode vir depois, sem dizer o quê. Uma frase curta. */
  readonly hint: string;
  readonly hidden?: CouncilHiddenOutcome;
  /** A frase da Crônica quando o senhor escolhe esta opção. */
  readonly chronicle: string;
  /**
   * A frase da Crônica quando a carta expira e o conselho aplica esta opção sozinho. Sem ela
   * vale o modelo geral de `cardExpired`, que diz a carta e o que foi feito.
   */
  readonly expiredChronicle?: string;
};

/**
 * O mesmo modelo de carta lido de outro jeito conforme a história: a primeira variante cuja
 * flag está gravada troca o texto da carta e, se tiver, a frase da chegada. É como uma
 * continuação lembra a escolha que a trouxe ("Sua escolha voltou"). Não conta como carta nova.
 */
export type CouncilCardVariant = {
  readonly flag: string;
  readonly text: string;
  readonly arrival?: string;
};

export type CouncilCard = {
  readonly id: string;
  readonly title: string;
  /** A situação, em 2 a 4 frases, no tom da Crônica. */
  readonly text: string;
  /** Peso no sorteio. Zero é carta que só chega como continuação de outra. */
  readonly weight: number;
  /** Pode sair mais de uma vez no mesmo ano. */
  readonly recurring?: boolean;
  readonly requires?: CouncilCardRequires;
  /**
   * Carta roteirizada: chega no primeiro sorteio a partir desse dia de jogo, uma vez por
   * partida, na frente das sorteadas. Nenhuma carta da v0.2 usa (ADR 0014, decisão 8).
   */
  readonly scripted?: { readonly atGameDay: number };
  /**
   * A opção que o conselho aplica quando a carta expira, por dificuldade (GDD §12.1). É marcada
   * por quem escreve a carta; as três existem e não têm custo nem requisito.
   */
  readonly autoResolve: Record<DifficultyId, string>;
  /** Duas ou três. */
  readonly options: readonly CouncilOption[];
  readonly variants?: readonly CouncilCardVariant[];
  /** A frase da Crônica quando a carta chega. Sem ela vale o modelo geral de `cardDrawn`. */
  readonly arrival?: string;
};
