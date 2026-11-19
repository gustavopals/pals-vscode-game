import {
  ARCHETYPE_COUNTERS,
  balance,
  HORDE_UNIT_IDS,
  hordeBaseMix,
  hordeUnits,
  omenTexts,
  previousYearMemoryFactor,
  type Ratio,
  type DifficultyId,
  type HordeUnitId,
  type OmenClarityId,
  type SeasonId,
  type UnitId,
  type WingId,
} from '@lotg/content';

/**
 * A Horda que aprende (GDD §10.6, §11.1; ADR 0020, decisões 15 e 18): contas puras, sem estado
 * nem sorteio próprio. `hordeTurn` e `hordePlan` ligam estas contas ao estado 34
 * (V4E-T3). O gerador é injetado: `draw(n)` devolve um inteiro em
 * `[0, n)`, como `nextInt` de `random.ts` sobre o fluxo `horde`.
 */
export type Draw = (maxExclusive: number) => number;

/** Um posto da formação vista, já reduzido ao que a Horda lembra: quem e quantos. */
export type SeenPost = { readonly unit: UnitId; readonly count: number };

/**
 * O que a Horda guarda da última formação vista: o total de soldados e quantos há de cada
 * unidade (a unidade do jogador é o arquétipo). Inteiros.
 */
export type HordeMemory = {
  readonly total: number;
  readonly byUnit: Partial<Record<UnitId, number>>;
};

/**
 * Resume uma formação vista por arquétipo. Postos de zero ou de contagem inválida não contam;
 * a formação sem ninguém dá `null` (a Horda não aprendeu nada).
 */
export function summarizeFormation(posts: readonly SeenPost[]): HordeMemory | null {
  const byUnit: Partial<Record<UnitId, number>> = {};
  let total = 0;
  for (const post of posts) {
    if (!Number.isSafeInteger(post.count) || post.count <= 0) {
      continue;
    }
    byUnit[post.unit] = (byUnit[post.unit] ?? 0) + post.count;
    total += post.count;
  }
  return total === 0 ? null : { total, byUnit };
}

/**
 * Os pesos da composição, em inteiros: `peso × scale` com `scale = den × total` (ou 1, sem
 * memória). Com memória anterior, a escala também incorpora seu total e o denominador
 * de seu peso. `peso(tipo) = base + astúcia × (contra(última) + contra(anterior)/2)`, onde `contra` é
 * `counterWeights[unidade que o arquétipo do tipo vence] × (parte da formação que é dela)`.
 * Só entram os tipos da composição-base da estação (a Horda não inventa inimigo de outra
 * estação). A ordem das chaves é a de `HORDE_UNIT_IDS`.
 */
export type HordeWeights = {
  readonly weights: Partial<Record<HordeUnitId, number>>;
  readonly scale: number;
};

export function compositionWeights(
  season: SeasonId,
  difficulty: DifficultyId,
  memory: HordeMemory | null,
  base = hordeBaseMix[season],
  previous: HordeMemory | null = null,
  cunning: Ratio = balance.difficulties[difficulty].cunning,
): HordeWeights {
  const total = memory?.total ?? 0;
  const priorTotal = previous?.total ?? 0;
  const prior = previousYearMemoryFactor;
  const scale =
    priorTotal > 0
      ? cunning.den * Math.max(1, total) * prior.den * priorTotal
      : total > 0
        ? cunning.den * total
        : 1;
  const weights: Partial<Record<HordeUnitId, number>> = {};
  for (const id of HORDE_UNIT_IDS) {
    const baseWeight = base[id];
    if (baseWeight === undefined) {
      continue;
    }
    let weight = baseWeight * scale;
    const countered =
      hordeUnits[id].archetype === 'none' ? null : ARCHETYPE_COUNTERS[hordeUnits[id].archetype];
    if (memory !== null && countered !== null) {
      weight +=
        cunning.num *
        balance.horde.counterWeights[countered] *
        (memory.byUnit[countered] ?? 0) *
        (priorTotal > 0 ? prior.den * priorTotal : 1);
    }
    if (previous !== null && countered !== null) {
      weight +=
        cunning.num *
        balance.horde.counterWeights[countered] *
        (previous.byUnit[countered] ?? 0) *
        Math.max(1, total) *
        prior.num;
    }
    weights[id] = weight;
  }
  return { weights, scale };
}

/**
 * Sorteia a composição de `count` inimigos, um a um, pelos pesos, na ordem de `HORDE_UNIT_IDS`.
 * Mesma memória, mesma estação, mesma dificuldade e mesmo gerador dão a mesma composição.
 * Sem peso nenhum, devolve vazio sem gastar o gerador.
 */
export function drawComposition(
  weights: HordeWeights,
  count: number,
  draw: Draw,
): Partial<Record<HordeUnitId, number>> {
  const entries = HORDE_UNIT_IDS.flatMap((id) => {
    const weight = weights.weights[id];
    return weight !== undefined && weight > 0 ? [{ id, weight }] : [];
  });
  const sum = entries.reduce((acc, entry) => acc + entry.weight, 0);
  const composition: Partial<Record<HordeUnitId, number>> = {};
  if (sum === 0) {
    return composition;
  }
  for (let i = 0; i < count; i += 1) {
    let roll = draw(sum);
    for (const entry of entries) {
      if (roll < entry.weight) {
        composition[entry.id] = (composition[entry.id] ?? 0) + 1;
        break;
      }
      roll -= entry.weight;
    }
  }
  return composition;
}

/** A chance, em por cento, de um presságio na virada, pelo nível da Torre (com o teto). */
export function omenChancePercent(towerLevel: number): number {
  const { chancePercent, perTowerLevelAbove1, maxChancePercent } = balance.omens;
  const raw = chancePercent + perTowerLevelAbove1 * Math.max(0, towerLevel - 1);
  return Math.min(raw, maxChancePercent);
}

/** A clareza do presságio pelo nível da Torre; níveis acima da lista usam o último. */
export function omenClarity(towerLevel: number): OmenClarityId {
  const levels = balance.omens.clarityByLevel;
  const index = Math.min(Math.max(towerLevel, 1), levels.length) - 1;
  return levels[index] ?? 'vague';
}

/** Uma onda gerada, como o presságio a lê. */
export type OmenWave = {
  readonly number: 1 | 2 | 3;
  /** A ala por onde a maior parte da onda entra (a do inimigo que domina). */
  readonly mainWing: WingId;
  readonly composition: Partial<Record<HordeUnitId, number>>;
};

function countedLabel(id: HordeUnitId, count: number): string {
  const def = hordeUnits[id];
  const name = count === 1 ? def.label : def.pluralLabel;
  return `${String(count)} ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

function dominantEnemy(composition: Partial<Record<HordeUnitId, number>>): HordeUnitId | null {
  let best: HordeUnitId | null = null;
  let bestCount = 0;
  for (const id of HORDE_UNIT_IDS) {
    const count = composition[id] ?? 0;
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1] ?? ''}`;
}

/**
 * A frase de um presságio sobre uma onda, na clareza dada. Só diz o que é verdade da onda:
 * vaga, o inimigo que domina; parcial, esse inimigo em número arredondado, a ala e a noite;
 * exata, a composição inteira. Onda vazia dá `null`.
 */
export function omenText(wave: OmenWave, clarity: OmenClarityId): string | null {
  const dominant = dominantEnemy(wave.composition);
  if (dominant === null) {
    return null;
  }
  const ordinal = omenTexts.waves[wave.number];
  if (clarity === 'vague') {
    return omenTexts.vague[dominant];
  }
  if (clarity === 'partial') {
    const step = balance.omens.roundTo;
    const exact = wave.composition[dominant] ?? 0;
    const rounded = Math.max(step, Math.round(exact / step) * step);
    const plural = hordeUnits[dominant].pluralLabel;
    return omenTexts.partial
      .replace('{contagem}', String(rounded))
      .replace('{inimigo}', plural)
      .replace('{ala}', omenTexts.wings[wave.mainWing])
      .replace('{onda}', ordinal);
  }
  const parts = HORDE_UNIT_IDS.flatMap((id) => {
    const count = wave.composition[id] ?? 0;
    return count > 0 ? [countedLabel(id, count)] : [];
  });
  return omenTexts.exact.replace('{onda}', ordinal).replace('{composicao}', joinList(parts));
}
