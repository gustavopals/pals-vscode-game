import { balance, buildings, WING_IDS, type Ratio, type WingId } from '@lotg/content';

/**
 * As contas puras da muralha de pedra (GDD §6.1 a §6.3; ADR 0020, "Números da Fase E"):
 * a vida de cada ala por nível da Paliçada e o custo e o prazo do reparo. Funções puras, sem
 * ler o estado; nada as chama ainda (o estado da muralha e a ordem `repairWall` são da
 * V4E-T1.2 e T1.3). As unidades são as do conteúdo (unidades inteiras de recurso, e não
 * milésimos); quem cobra converte.
 */

/** A vida de **cada ala** no nível pedido da Paliçada; o nível 0 (sem Paliçada) não tem muralha. */
export function wallHpPerWing(level: number): number {
  if (level <= 0) {
    return 0;
  }
  const table = balance.wall.hpByLevel;
  return table[Math.min(level, table.length) - 1] ?? 0;
}

/** A vida cheia das três alas no nível pedido. */
export function wallFullHp(level: number): Record<WingId, number> {
  const hp = wallHpPerWing(level);
  return { left: hp, center: hp, right: hp };
}

/** A vida total das três alas no nível pedido. */
export function wallTotalHp(level: number): number {
  return wallHpPerWing(level) * WING_IDS.length;
}

/** A pedra que a obra do nível pedido da Paliçada custa (a base do reparo). */
export function palisadeStoneAtLevel(level: number): number {
  const def = buildings.palisade;
  if (level <= 0) {
    return 0;
  }
  const base = def.baseCost.stone ?? 0;
  if (level === 1) {
    return base;
  }
  if (level === 2) {
    // Obra 1 -> 2: o custo base vezes 1,6, arredondado.
    const { num, den } = balance.construction.costFactor;
    return Math.floor((2 * base * num + den) / (2 * den));
  }
  const future = def.futureLevels ?? [];
  const entry = future[Math.min(level - 2, future.length) - 1];
  return entry?.cost.stone ?? 0;
}

function ceilDiv(value: number, by: number): number {
  return Math.floor((value + by - 1) / by);
}

function applyRatio(value: number, ratio: Ratio): number {
  return ceilDiv(value * ratio.num, ratio.den);
}

/** O reparo de `missingHp` pontos de vida (somados das alas) no nível pedido. */
export type WallRepairQuote = {
  /** Pedra e ouro, em unidades inteiras; o ouro é a parte `goldRatio` da pedra do reparo. */
  readonly stone: number;
  readonly gold: number;
  /** O prazo da obra, em tempo de jogo. */
  readonly durationMs: number;
};

/**
 * O custo e o prazo de reparar `missingHp` pontos de vida (somados das alas) de uma muralha do
 * nível `level`. O reparo de **toda** a muralha (as três alas a zero) custa `stoneRatio` da
 * pedra da obra do nível; o custo é proporcional ao que falta, arredondado para cima. O prazo
 * é de `quarterMs` por 25% da vida de **uma ala**, também proporcional e arredondado para
 * cima (as alas são reparadas em sequência). Sem nada faltando, custa e leva zero.
 */
export function wallRepairQuote(level: number, missingHp: number): WallRepairQuote {
  const total = wallTotalHp(level);
  if (level <= 0 || total <= 0 || missingHp <= 0) {
    return { stone: 0, gold: 0, durationMs: 0 };
  }
  const missing = Math.min(missingHp, total);
  const { repair } = balance.wall;
  const fullStone = applyRatio(palisadeStoneAtLevel(level), repair.stoneRatio);
  const stone = ceilDiv(fullStone * missing, total);
  const gold = applyRatio(stone, repair.goldRatio);
  const durationMs = ceilDiv(missing * 4 * repair.quarterMs, wallHpPerWing(level));
  return { stone, gold, durationMs };
}
