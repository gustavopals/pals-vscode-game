import {
  hordeBaseMix,
  hordeUnits,
  LINE_IDS,
  WING_IDS,
  warRaids,
  type HeroClassId,
  type HordeUnitId,
  type LineId,
  type Ratio,
  type SeasonId,
  type UnitId,
  type WarRaidSizeId,
  type WingId,
} from '@lotg/content';

import type { BattleCommanderInput, BattlePosts } from './battle';
import { postEntries } from './formations';
import type { Formation } from './types';
import type { HordeWeights } from './hordeMind';

/**
 * O exército de uma incursão e o de quem a enfrenta (V4E-T2.1 e a parte pura da T2.3; GDD §8.2;
 * ADR 0019, decisão 14). **Funções puras**: não leem o estado, não gravam nada e não sorteiam
 * por conta própria. O sorteio entra por `Roll`, que a V4E-T2.2 ligará ao fluxo `horde` quando a
 * incursão é marcada. Desde a V4E-T2.2 e a T2.3, a marcação e a incursão o chamam.
 */

/** Um sorteio injetado: um inteiro em `[0, maxExclusive)`. */
export type Roll = (maxExclusive: number) => number;

/** Um posto do atacante: o que a incursão tem naquela ala e linha. */
export type RaidPost = {
  readonly wing: WingId;
  readonly line: LineId;
  readonly unit: HordeUnitId;
  readonly count: number;
};

/**
 * O tamanho da incursão que a Ameaça traz em uma estação: forte a partir do limiar do forte, média
 * a partir do da média, leve abaixo. Os limiares são de `warRaids.thresholds`.
 */
export function raidSizeFor(threat: number, season: SeasonId): WarRaidSizeId {
  const band = warRaids.thresholds[season];
  if (threat >= band.strong) {
    return 'strong';
  }
  return threat >= band.medium ? 'medium' : 'light';
}

/** Os pesos da estação para uma linha: só os tipos que lutam naquela linha, na ordem do conteúdo. */
function candidatesFor(
  season: SeasonId,
  line: LineId,
  weights?: HordeWeights,
): Array<{ unit: HordeUnitId; weight: number }> {
  const mix = weights?.weights ?? hordeBaseMix[season];
  const candidates: Array<{ unit: HordeUnitId; weight: number }> = [];
  for (const unit of Object.keys(hordeUnits) as HordeUnitId[]) {
    const weight = mix[unit] ?? 0;
    if (weight > 0 && hordeUnits[unit].line === line) {
      candidates.push({ unit, weight });
    }
  }
  return candidates;
}

/**
 * A parte (em %) de cada posto depois de dobrar a retaguarda que a estação não tem: onde nenhum
 * tipo da estação luta na retaguarda (a primavera), a parte dela vai para a Frente da mesma ala.
 */
function effectiveShares(season: SeasonId): Array<{ wing: WingId; line: LineId; share: number }> {
  const backLacks = candidatesFor(season, 'back').length === 0;
  const result: Array<{ wing: WingId; line: LineId; share: number }> = [];
  for (const wing of WING_IDS) {
    for (const line of LINE_IDS) {
      const own = warRaids.postShares[wing][line];
      const folded = line === 'front' && backLacks ? warRaids.postShares[wing].back : 0;
      const share = line === 'back' && backLacks ? 0 : own + folded;
      if (share > 0) {
        result.push({ wing, line, share });
      }
    }
  }
  return result;
}

/** Quantos inimigos cabem na parte do orçamento de um posto: pelo menos um, se há parte. */
function countFor(unit: HordeUnitId, size: WarRaidSizeId, share: number): number {
  const budget = Math.floor((warRaids.sizeBudget[size] * share) / 100);
  return Math.max(1, Math.floor(budget / warRaids.unitCost[unit]));
}

/**
 * Monta a composição de uma incursão: para cada posto com parte do orçamento (alas da esquerda
 * para a direita, Frente antes da Retaguarda), **um** sorteio escolhe o tipo entre os que a
 * estação põe naquela linha, com os pesos de `hordeBaseMix`; a quantidade sai do orçamento do
 * tamanho, em inteiros. Um posto sem parte fica fora da lista.
 */
export function buildRaidComposition(
  size: WarRaidSizeId,
  season: SeasonId,
  roll: Roll,
  weights?: HordeWeights,
): RaidPost[] {
  const posts: RaidPost[] = [];
  for (const { wing, line, share } of effectiveShares(season)) {
    const candidates = candidatesFor(season, line, weights);
    const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let pick = roll(total);
    let chosen = candidates[candidates.length - 1]!.unit;
    for (const candidate of candidates) {
      if (pick < candidate.weight) {
        chosen = candidate.unit;
        break;
      }
      pick -= candidate.weight;
    }
    posts.push({ wing, line, unit: chosen, count: countFor(chosen, size, share) });
  }
  return posts;
}

/**
 * A composição-base de uma estação, **sem sorteio**: em cada posto, o tipo de maior peso (o
 * primeiro, no empate). É a de uma incursão que já estava marcada quando a composição passou a
 * existir (V4E-T2.2).
 */
export function baseRaidComposition(size: WarRaidSizeId, season: SeasonId): RaidPost[] {
  const posts: RaidPost[] = [];
  for (const { wing, line, share } of effectiveShares(season)) {
    const best = candidatesFor(season, line).reduce((a, b) => (b.weight > a.weight ? b : a));
    posts.push({ wing, line, unit: best.unit, count: countFor(best.unit, size, share) });
  }
  return posts;
}

/** A composição no formato que `resolveBattle` lê para a Horda. */
export function toHordePosts(composition: readonly RaidPost[]): BattlePosts<HordeUnitId> {
  const posts = Object.fromEntries(
    WING_IDS.map((wing) => [wing, Object.fromEntries(LINE_IDS.map((line) => [line, null]))]),
  ) as unknown as {
    [W in WingId]: { [L in LineId]: { unit: HordeUnitId; count: number } | null };
  };
  for (const post of composition) {
    posts[post.wing][post.line] = { unit: post.unit, count: post.count };
  }
  return posts;
}

/** O defensor de uma batalha: os postos do jogador e o comandante de cada ala. */
export type Defender = {
  readonly posts: BattlePosts<UnitId | 'militia'>;
  readonly commanders: Record<WingId, BattleCommanderInput | null>;
};

export const MILITIA_POST_PRIORITY: readonly { wing: WingId; line: 'front' }[] = [
  { wing: 'center', line: 'front' },
  { wing: 'left', line: 'front' },
  { wing: 'right', line: 'front' },
];

/**
 * O defensor a partir da Defesa ativa: cada posto leva o que o exército tem da unidade, na ordem
 * fixa dos postos (um plano pode pedir mais do que há: o que falta fica de fora, e o posto que
 * ficou sem ninguém fica vazio). **Sem formação ativa, não há ninguém**: a batalha roda só com a
 * muralha e as torres (ADR 0019, decisão 14), exceto se houver milícia convocada, que ocupa o
 * primeiro posto vazio na ordem de prioridade. `classOf` devolve a classe de um herói que pode
 * comandar e `null` para quem não pode (ferido, em cativeiro, que já não serve): a ala fica sem
 * comandante.
 */
export function buildDefender(
  formation: Formation | null,
  army: Readonly<Record<UnitId, number>>,
  classOf: (heroId: string) => HeroClassId | null,
  militiaCount: number = 0,
): Defender {
  const posts = Object.fromEntries(
    WING_IDS.map((wing) => [wing, Object.fromEntries(LINE_IDS.map((line) => [line, null]))]),
  ) as unknown as {
    [W in WingId]: { [L in LineId]: { unit: UnitId | 'militia'; count: number } | null };
  };
  const commanders = Object.fromEntries(WING_IDS.map((wing) => [wing, null])) as Record<
    WingId,
    BattleCommanderInput | null
  >;
  if (formation !== null) {
    const left: Record<string, number> = { ...army };
    for (const { wing, line, post } of postEntries(formation)) {
      if (post === null) {
        continue;
      }
      const count = Math.min(post.count, left[post.unit] ?? 0);
      if (count > 0) {
        posts[wing][line] = { unit: post.unit, count };
        left[post.unit] = (left[post.unit] ?? 0) - count;
      }
    }
    for (const wing of WING_IDS) {
      const heroId = formation.commanders[wing];
      const heroClass = heroId === null ? null : classOf(heroId);
      commanders[wing] = heroId !== null && heroClass !== null ? { heroId, heroClass } : null;
    }
  }
  if (militiaCount > 0) {
    for (const slot of MILITIA_POST_PRIORITY) {
      if (posts[slot.wing][slot.line] === null) {
        posts[slot.wing][slot.line] = { unit: 'militia', count: militiaCount };
        break;
      }
    }
  }
  return { posts, commanders };
}

/**
 * A regra da v0.2 na proporção do que passou (ADR 0019, decisão 14): `passed / total` é a parte
 * da força inimiga que a defesa não deteve. A perda de cada recurso é a parte do estoque do
 * tamanho (`lossRatio`) vezes essa proporção, em milésimos e para baixo; os feridos são
 * `ceil(feridos × proporção)`, e ao menos um se algo passou. Passar nada não custa nada.
 */
export function scaledLoss(
  size: WarRaidSizeId,
  passed: Ratio | { num: 0; den: number },
): { lossRatio: Ratio; injuries: number } {
  const rule = warRaids.losses[size];
  const { num, den } = passed;
  if (num <= 0) {
    return { lossRatio: { num: 0, den: 1 }, injuries: 0 };
  }
  const bounded = Math.min(num, den);
  if (bounded === den) {
    return { lossRatio: rule.lossRatio, injuries: rule.injuries };
  }
  return {
    lossRatio: { num: rule.lossRatio.num * bounded, den: rule.lossRatio.den * den },
    injuries: Math.max(1, Math.ceil((rule.injuries * bounded) / den)),
  };
}
