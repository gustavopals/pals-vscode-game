import {
  balance,
  hordeBaseMix,
  hordeUnits,
  HORDE_UNIT_IDS,
  LINE_IDS,
  WING_IDS,
  type HeroCaptureRuleId,
  type HordeUnitId,
  type LineId,
  type Ratio,
  type SeasonId,
  type UnitId,
  type WingId,
} from '@lotg/content';

import {
  resolveBattle,
  type BattleCommanderInput,
  type BattleInput,
  type BattlePosts,
} from './battle';
import { BATTLE_FACTOR_IDS, buildBattleReport, type BattleFactorId } from './battleReport';
import { hashText } from './hash';
import { nextUint32, seedStream, type StreamWords } from './random';

/**
 * A prévia do Conselho de Guerra (GDD §10.5 e §13.4; ADR 0019, decisão 10; V4D-T2.1). Roda
 * `balance.battle.previewRuns` batalhas com o **mesmo** `resolveBattle` da batalha real, cada
 * uma com um gerador **próprio da prévia**, semeado por `seedStream` (o hash da semente da
 * partida, da formação e do que se sabe do inimigo, mais o número da rodada), e agrega o
 * resultado em inteiros.
 *
 * **Esta função não recebe o estado e nunca toca `state.rng`**: o gerador nasce aqui, vive uma
 * simulação e morre com ela. É a única exceção à regra de que só `advanceTo` sorteia, e é por
 * isso que ela não importa `nextInt`, `entityStream`, `dropStream` nem `nextId` (o
 * `purity.test.ts` confere o texto deste arquivo).
 *
 * O inimigo é uma **amostra**: cada posto é conhecido (`known`: unidade e quantidade), ou
 * desconhecido (`unknown`: só a quantidade estimada), e cada simulação sorteia a unidade do
 * posto desconhecido na composição-base da estação (Apêndice A), entre as que combinam com a
 * linha do posto. Sem nada desconhecido, o inimigo é igual nas 200 simulações e só a sorte de
 * cada ataque muda; com a mesma semente da batalha real (`streamNameOf`), a prévia é a batalha.
 */

/** O que se sabe de um posto do inimigo. */
export type EnemyGuess =
  | { readonly kind: 'known'; readonly unit: HordeUnitId; readonly count: number }
  | { readonly kind: 'approximate'; readonly unit: HordeUnitId; readonly count: number }
  | { readonly kind: 'unknown'; readonly count: number };

export type EnemyGuessPosts = Record<WingId, Record<LineId, EnemyGuess | null>>;

export type PreviewInput = {
  /** A semente da partida (`state.seed`). */
  readonly seed: string;
  readonly formationId: string;
  /** A estação da incursão provável: decide a composição-base do que não se sabe. */
  readonly season: SeasonId;
  readonly armyMoraleBonus?: number;
  readonly wolfAttackFactor?: Ratio;
  readonly mode: 'defense' | 'attack';
  readonly player: {
    readonly posts: BattlePosts<UnitId>;
    readonly commanders: Record<WingId, BattleCommanderInput | null>;
  };
  readonly enemy: EnemyGuessPosts;
  /** Distribuição inferida só de relatos e tipos públicos; nunca da memória da Horda. */
  readonly mix?: Partial<Record<HordeUnitId, number>>;
  readonly wall: Partial<Record<WingId, number>>;
  readonly watchtowerLevel: number;
  readonly heroCapture: HeroCaptureRuleId;
  /** Quantas simulações (padrão: `balance.battle.previewRuns`). */
  readonly runs?: number;
  /**
   * O nome do fluxo de cada simulação (padrão: derivado de formação e amostra). Existe para o
   * teste do critério 2 dar à prévia o fluxo da batalha real (`battle:battle-1`).
   */
  readonly streamNameOf?: (run: number) => string;
};

export type PreviewRisk = {
  readonly factor: BattleFactorId;
  readonly wing: WingId | null;
  /** O dano somado, nas simulações consideradas. */
  readonly amount: number;
};

export type PreviewPostLoss = {
  readonly wing: WingId;
  readonly line: LineId;
  readonly unit: UnitId;
  readonly start: number;
  /** A perda esperada: a média das simulações, arredondada ao inteiro mais próximo. */
  readonly expected: number;
};

export type PreviewEnemyPost = {
  readonly wing: WingId;
  readonly line: LineId;
  readonly known: boolean;
  /** A unidade conhecida, ou a mais sorteada no posto desconhecido (empate: a primeira da lista). */
  readonly unit: HordeUnitId;
  readonly count: number;
};

export type PreviewResult = {
  readonly runs: number;
  /** Vitória (inclui a Gloriosa): `victory` ou `held`. */
  readonly wins: number;
  /** Vitória sem brecha: nenhuma muralha chegou a zero (GDD §10.5). Contida em `wins`. */
  readonly glorious: number;
  readonly losses: number;
  /** O fator do inimigo que mais dano fez (nas derrotas, se houve; senão, em todas). */
  readonly risk: PreviewRisk | null;
  readonly expectedLosses: readonly PreviewPostLoss[];
  readonly enemy: readonly PreviewEnemyPost[];
};

/** O texto que identifica o que se sabe do inimigo: entra no hash das sementes. */
function sampleKeyOf(enemy: EnemyGuessPosts, season: SeasonId): string {
  const parts: string[] = [season];
  for (const wing of WING_IDS) {
    for (const line of LINE_IDS) {
      const guess = enemy[wing][line];
      parts.push(
        guess === null
          ? '-'
          : guess.kind !== 'unknown'
            ? `${guess.kind === 'approximate' ? '~' : ''}${guess.unit}x${String(guess.count)}`
            : `?x${String(guess.count)}`,
      );
    }
  }
  return parts.join(',');
}

/** Um inteiro em `[0, max)`, com rejeição, no gerador da simulação (a mesma conta de `nextInt`). */
function drawInt(words: StreamWords, max: number): number {
  const range = 0x1_0000_0000;
  const limit = range - (range % max);
  let value = nextUint32(words);
  while (value >= limit) {
    value = nextUint32(words);
  }
  return value % max;
}

/** O que entra na amostra de um posto desconhecido: os pesos da estação nas unidades da linha. */
function candidatesFor(season: SeasonId, line: LineId, mix = hordeBaseMix[season]) {
  const weighted = HORDE_UNIT_IDS.flatMap((unit) => {
    const weight = mix[unit] ?? 0;
    return weight > 0 && hordeUnits[unit].line === line ? [{ unit, weight }] : [];
  });
  if (weighted.length > 0) {
    return weighted;
  }
  // A estação não traz ninguém nesta linha (a Retaguarda da Primavera): pesos iguais entre as
  // unidades comuns da linha (o Senhor da Guerra e o Esqueleto são das ondas, não da base).
  return HORDE_UNIT_IDS.filter(
    (unit) => hordeUnits[unit].line === line && unit !== 'warlord' && unit !== 'skeleton',
  ).map((unit) => ({ unit, weight: 1 }));
}

type Candidates = ReturnType<typeof candidatesFor>;

function sampleUnit(words: StreamWords, candidates: Candidates): HordeUnitId {
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = drawInt(words, total);
  for (const candidate of candidates) {
    if (roll < candidate.weight) {
      return candidate.unit;
    }
    roll -= candidate.weight;
  }
  throw new Error('Amostra do inimigo sem candidatos.');
}

/** Uma simulação: o inimigo sorteado, depois a sorte de cada ataque, no mesmo gerador. */
function runOnce(input: PreviewInput, words: StreamWords, sampled: Map<string, HordeUnitId>) {
  const { min, max } = balance.battle.luck;
  const horde = {} as Record<WingId, Record<LineId, { unit: HordeUnitId; count: number } | null>>;
  for (const wing of WING_IDS) {
    horde[wing] = { front: null, back: null };
    for (const line of LINE_IDS) {
      const guess = input.enemy[wing][line];
      if (guess === null) {
        continue;
      }
      let unit: HordeUnitId;
      if (guess.kind !== 'unknown') {
        unit = guess.unit;
      } else {
        unit = sampleUnit(words, candidatesFor(input.season, line, input.mix));
        const key = `${wing}/${line}/${unit}`;
        sampled.set(key, unit);
      }
      horde[wing][line] = { unit, count: guess.count };
    }
  }
  const battleInput: BattleInput = {
    ...(input.armyMoraleBonus === undefined ? {} : { armyMoraleBonus: input.armyMoraleBonus }),
    ...(input.wolfAttackFactor === undefined ? {} : { wolfAttackFactor: input.wolfAttackFactor }),
    mode: input.mode,
    player: input.player,
    horde: { posts: horde },
    wall: input.wall,
    watchtowerLevel: input.watchtowerLevel,
    heroCapture: input.heroCapture,
  };
  const resolution = resolveBattle(battleInput, () => min + drawInt(words, max - min + 1));
  return { resolution, report: buildBattleReport('preview', 0, resolution) };
}

function streamNameFor(input: PreviewInput, run: number): string {
  if (input.streamNameOf !== undefined) {
    return input.streamNameOf(run);
  }
  const sampleKey = sampleKeyOf(input.enemy, input.season);
  const mixKey =
    input.mix === undefined
      ? ''
      : HORDE_UNIT_IDS.map((unit) => `${unit}:${input.mix?.[unit] ?? 0}`).join(',');
  return `preview:${input.formationId}:${String(hashText(sampleKey + mixKey))}:${String(run)}`;
}

/** Uma simulação da prévia, com o relatório da batalha: a que `previewBattle` repete 200 vezes. */
export function previewRun(input: PreviewInput, run: number) {
  const words = seedStream(input.seed, streamNameFor(input, run));
  const sampled = new Map<string, HordeUnitId>();
  return { ...runOnce(input, words, sampled), sampled };
}

export function previewBattle(input: PreviewInput): PreviewResult {
  const runs = input.runs ?? balance.battle.previewRuns;
  const hasEnemy = WING_IDS.some((wing) =>
    LINE_IDS.some((line) => input.enemy[wing][line] !== null),
  );
  if (!hasEnemy) {
    return {
      runs,
      wins: 0,
      glorious: 0,
      losses: runs,
      risk: null,
      expectedLosses: [],
      enemy: [],
    };
  }

  let wins = 0;
  let glorious = 0;
  const lostByPost = new Map<string, number>();
  const unitTally = new Map<string, Map<HordeUnitId, number>>();
  const riskAll = new Map<string, PreviewRisk>();
  const riskLost = new Map<string, PreviewRisk>();
  let losses = 0;
  const postOrder: Array<{ wing: WingId; line: LineId; unit: UnitId; start: number }> = [];

  for (let run = 0; run < runs; run += 1) {
    const { resolution, report, sampled } = previewRun(input, run);
    const won = resolution.outcome === 'victory' || resolution.outcome === 'held';
    if (won) {
      wins += 1;
      // Gloriosa: vencer sem que a Frente de nenhuma ala caia (nenhuma ala rompida), com ou sem
      // muralha (resposta do autor, 2026-10-23; igual à decisão 19 do Cerco).
      const broken = report.casualties.some(
        (entry) => entry.owner === 'player' && entry.line === 'front' && entry.lost >= entry.start,
      );
      if (!broken) {
        glorious += 1;
      }
    } else {
      losses += 1;
    }
    for (const entry of report.casualties) {
      if (entry.owner !== 'player') {
        continue;
      }
      const key = `${entry.wing}/${entry.line}`;
      lostByPost.set(key, (lostByPost.get(key) ?? 0) + entry.lost);
      if (run === 0) {
        postOrder.push({
          wing: entry.wing,
          line: entry.line,
          unit: entry.unit as UnitId,
          start: entry.start,
        });
      }
    }
    for (const key of sampled.keys()) {
      const [wing, line, unit] = key.split('/') as [WingId, LineId, HordeUnitId];
      const cell = `${wing}/${line}`;
      const tally = unitTally.get(cell) ?? new Map<HordeUnitId, number>();
      tally.set(unit, (tally.get(unit) ?? 0) + 1);
      unitTally.set(cell, tally);
    }
    for (const factor of report.decisive) {
      if (factor.owner !== 'horde') {
        continue;
      }
      const key = `${factor.factor}/${factor.wing ?? '-'}`;
      for (const bucket of won ? [riskAll] : [riskAll, riskLost]) {
        const current = bucket.get(key);
        bucket.set(key, {
          factor: factor.factor,
          wing: factor.wing,
          amount: (current?.amount ?? 0) + factor.amount,
        });
      }
    }
  }

  const risks = [...(losses > 0 ? riskLost : riskAll).values()];
  const wingRank = (wing: WingId | null): number => (wing === null ? -1 : WING_IDS.indexOf(wing));
  risks.sort(
    (a, b) =>
      b.amount - a.amount ||
      BATTLE_FACTOR_IDS.indexOf(a.factor) - BATTLE_FACTOR_IDS.indexOf(b.factor) ||
      wingRank(a.wing) - wingRank(b.wing),
  );

  const enemy: PreviewEnemyPost[] = [];
  for (const wing of WING_IDS) {
    for (const line of LINE_IDS) {
      const guess = input.enemy[wing][line];
      if (guess === null) {
        continue;
      }
      if (guess.kind !== 'unknown') {
        enemy.push({
          wing,
          line,
          known: guess.kind === 'known',
          unit: guess.unit,
          count: guess.count,
        });
        continue;
      }
      let best: HordeUnitId = candidatesFor(input.season, line, input.mix)[0]?.unit ?? 'raider';
      let bestCount = -1;
      for (const [unit, count] of unitTally.get(`${wing}/${line}`) ?? []) {
        if (count > bestCount) {
          best = unit;
          bestCount = count;
        }
      }
      enemy.push({ wing, line, known: false, unit: best, count: guess.count });
    }
  }

  return {
    runs,
    wins,
    glorious,
    losses,
    risk: risks[0] ?? null,
    expectedLosses: postOrder.map((post) => ({
      ...post,
      expected: Math.floor(
        (2 * (lostByPost.get(`${post.wing}/${post.line}`) ?? 0) + runs) / (2 * runs),
      ),
    })),
    enemy,
  };
}
