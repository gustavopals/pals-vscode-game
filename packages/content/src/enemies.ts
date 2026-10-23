import type { HordeUnitId, Ratio, UnitId } from './ids';
import type { UnitLine } from './units';

/**
 * O arquétipo de um inimigo (GDD §10.3): decide o contra-ataque ×3/2 pelo ciclo do §10.2. O
 * Xamã é `support` e o Ogro e o Senhor da Guerra são `none`: fora do ciclo, não têm vantagem
 * nem fraqueza de arquétipo (o Ogro tem a regra própria de Lanceiros, em `takesBonusFrom`).
 */
export type Archetype = UnitId | 'support' | 'none';

export const ARCHETYPES = [
  'spearman',
  'swordsman',
  'archer',
  'knight',
  'shieldbearer',
  'support',
  'none',
] as const satisfies readonly Archetype[];

/**
 * O contra-ataque de cada arquétipo (GDD §10.2 e Apêndice A): a unidade a que ele tem
 * vantagem (×3/2); `null` onde não há. Os quatro do ciclo repetem `units.ts`, e um teste confere.
 */
export const ARCHETYPE_COUNTERS: Record<Archetype, UnitId | null> = {
  swordsman: 'spearman',
  spearman: 'knight',
  knight: 'archer',
  archer: 'swordsman',
  shieldbearer: null,
  support: null,
  none: null,
};

/** Quem, entre os comandantes, o Esqueleto sofre em dobro (GDD §10.3). */
export type DoubleDamageSource = 'mage' | 'cleric';

/**
 * Um inimigo da Horda (GDD §10.3; ADR 0019, decisão 11). Atributos inteiros. As regras
 * especiais são **dado**: o motor da batalha (V4D-T1.3) lê estes campos e não conhece o nome
 * do inimigo.
 */
export type HordeUnitDef = {
  readonly label: string;
  readonly pluralLabel: string;
  readonly archetype: Archetype;
  readonly attack: number;
  readonly defense: number;
  readonly health: number;
  readonly initiative: number;
  readonly line: UnitLine;
  /** O Lobo: sempre ataca uma ala lateral. */
  readonly alwaysLateral?: true;
  /** O Ogro: metade do dano ignora a muralha. */
  readonly ignoresWallHalf?: true;
  /** O Esqueleto e o Senhor da Guerra: sem moral (não perdem nem debandam). */
  readonly noMorale?: true;
  /** O Xamã: acréscimo de ataque (fração, por exemplo 6/5) para a própria ala. */
  readonly auraWing?: Ratio;
  /** O Senhor da Guerra: acréscimo de ataque para toda a Horda, ele inclusive. */
  readonly auraArmy?: Ratio;
  /** O Senhor da Guerra: derrotá-lo encerra a onda. */
  readonly endsWaveOnDeath?: true;
  /** O Esqueleto: sofre o dobro de dano destes comandantes. */
  readonly takesDoubleFrom?: readonly DoubleDamageSource[];
  /** O Ogro: sofre o fator (fração) do dano de cada uma destas unidades. */
  readonly takesBonusFrom?: Partial<Record<UnitId, Ratio>>;
  /** O Lobo: causa o fator (fração) de dano contra cada uma destas unidades. */
  readonly bonusAgainst?: Partial<Record<UnitId, Ratio>>;
};

/** Os oito inimigos do GDD §10.3, na ordem da tabela. */
export const hordeUnits: Record<HordeUnitId, HordeUnitDef> = {
  wolf: {
    label: 'Lobo',
    pluralLabel: 'lobos',
    archetype: 'knight',
    attack: 7,
    defense: 2,
    health: 14,
    initiative: 6,
    line: 'front',
    alwaysLateral: true,
    bonusAgainst: { archer: { num: 3, den: 2 } },
  },
  raider: {
    label: 'Saqueador',
    pluralLabel: 'saqueadores',
    archetype: 'swordsman',
    attack: 6,
    defense: 3,
    health: 18,
    initiative: 3,
    line: 'front',
  },
  banditArcher: {
    label: 'Bandoleiro Arqueiro',
    pluralLabel: 'bandoleiros arqueiros',
    archetype: 'archer',
    attack: 6,
    defense: 2,
    health: 14,
    initiative: 4,
    line: 'back',
  },
  blackKnight: {
    label: 'Cavaleiro Negro',
    pluralLabel: 'cavaleiros negros',
    archetype: 'knight',
    attack: 10,
    defense: 6,
    health: 30,
    initiative: 5,
    line: 'front',
  },
  ogre: {
    label: 'Ogro',
    pluralLabel: 'ogros',
    archetype: 'none',
    attack: 14,
    defense: 6,
    health: 80,
    initiative: 1,
    line: 'front',
    ignoresWallHalf: true,
    takesBonusFrom: { spearman: { num: 3, den: 2 } },
  },
  skeleton: {
    label: 'Esqueleto',
    pluralLabel: 'esqueletos',
    archetype: 'spearman',
    attack: 5,
    defense: 4,
    health: 16,
    initiative: 2,
    line: 'front',
    noMorale: true,
    takesDoubleFrom: ['mage', 'cleric'],
  },
  shaman: {
    label: 'Xamã',
    pluralLabel: 'xamãs',
    archetype: 'support',
    attack: 4,
    defense: 2,
    health: 14,
    initiative: 3,
    line: 'back',
    auraWing: { num: 6, den: 5 },
  },
  warlord: {
    label: 'Senhor da Guerra',
    pluralLabel: 'senhores da guerra',
    archetype: 'none',
    attack: 18,
    defense: 8,
    health: 200,
    initiative: 4,
    line: 'front',
    noMorale: true,
    auraArmy: { num: 5, den: 4 },
    endsWaveOnDeath: true,
  },
};
