import type { ResourceAmounts, UnitId } from './ids';

const MINUTE_MS = 60_000;

/** Em que fileira da formação a unidade luta (GDD §10.2). */
export type UnitLine = 'front' | 'back';

/**
 * Uma unidade do jogador (GDD §10.2; ADR 0019, decisão 7). Os atributos são inteiros. O custo
 * é o que o Quartel cobra ao começar o treino: recursos em unidades inteiras e, à parte,
 * `weapons`, as armas inteiras que o Ferreiro forjou (`settlement.weapons`). **Nenhuma unidade
 * custa ferro direto**: o ferro entra pela arma.
 */
export type UnitDef = {
  readonly label: string;
  /** O nome no plural, para as frases ("3 lanceiros"). */
  readonly pluralLabel: string;
  readonly attack: number;
  readonly defense: number;
  readonly health: number;
  readonly initiative: number;
  readonly line: UnitLine;
  readonly cost: ResourceAmounts;
  /** As armas inteiras que um soldado leva. */
  readonly weapons: number;
  /** O tempo de jogo do treino de um soldado no nível 1 do Quartel. */
  readonly trainMs: number;
  /**
   * A unidade a que esta tem vantagem (×1,5 de dano), pelo ciclo do GDD §10.2; `null` para o
   * Escudeiro, que não tem vantagem nem fraqueza.
   */
  readonly counters: UnitId | null;
};

export const units: Record<UnitId, UnitDef> = {
  spearman: {
    label: 'Lanceiro',
    pluralLabel: 'lanceiros',
    attack: 6,
    defense: 4,
    health: 20,
    initiative: 3,
    line: 'front',
    cost: { food: 30, gold: 10, wood: 5 },
    weapons: 0,
    trainMs: 10 * MINUTE_MS,
    counters: 'knight',
  },
  swordsman: {
    label: 'Espadachim',
    pluralLabel: 'espadachins',
    attack: 8,
    defense: 5,
    health: 24,
    initiative: 3,
    line: 'front',
    cost: { food: 40, gold: 20 },
    weapons: 1,
    trainMs: 12 * MINUTE_MS,
    counters: 'spearman',
  },
  archer: {
    label: 'Arqueiro',
    pluralLabel: 'arqueiros',
    attack: 7,
    defense: 2,
    health: 16,
    initiative: 4,
    line: 'back',
    cost: { food: 30, gold: 15, wood: 8 },
    weapons: 0,
    trainMs: 10 * MINUTE_MS,
    counters: 'swordsman',
  },
  knight: {
    label: 'Cavaleiro',
    pluralLabel: 'cavaleiros',
    attack: 10,
    defense: 6,
    health: 30,
    initiative: 5,
    line: 'front',
    cost: { food: 60, gold: 60 },
    weapons: 1,
    trainMs: 15 * MINUTE_MS,
    counters: 'archer',
  },
  shieldbearer: {
    label: 'Escudeiro',
    pluralLabel: 'escudeiros',
    attack: 3,
    defense: 9,
    health: 30,
    initiative: 2,
    line: 'front',
    cost: { food: 40, gold: 15, wood: 10, stone: 5 },
    weapons: 0,
    trainMs: 12 * MINUTE_MS,
    counters: null,
  },
};

/**
 * O ciclo de contra-ataques, na ordem em que o GDD §10.2 o escreve: o Espadachim vence o
 * Lanceiro, que vence o Cavaleiro, que vence o Arqueiro, que vence o Espadachim.
 */
export const COUNTER_CYCLE: readonly UnitId[] = ['swordsman', 'spearman', 'knight', 'archer'];

/** Frases do Quartel que não são da Crônica. Rascunho que o autor não leu. */
export const unitTexts = {
  /** O Escudeiro: nem vantagem nem fraqueza. */
  neutral: 'Sem vantagem nem fraqueza; protege a retaguarda.',
  /** "Vence o Cavaleiro." */
  counters: 'Vence {unidade}.',
} as const;
