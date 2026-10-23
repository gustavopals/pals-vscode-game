import {
  hordeUnits,
  units,
  type HordeUnitId,
  type Ratio,
  type UnitId,
  type WingId,
} from '@lotg/content';

import type { BattleAction, BattleHit, BattleNote, BattlePost, BattleResolution } from './battle';

/**
 * A conta de uma batalha escrita no formato de `docs/content-v0.4.md`, seção 2: é o texto dos
 * goldens `__golden__/battle-*.md`, e o teste confere que ele é, linha a linha, a conta feita à
 * mão no documento. Só os testes o usam; o relatório do jogo é `battleReport.ts`.
 */

const WING_LETTER: Record<WingId, string> = { left: 'E', center: 'C', right: 'D' };
const FACTOR_NAME = { counter: 'contra', aura: 'aura', flank: 'flanco', cover: 'cobertura' };

export const fmt = (value: Ratio): string =>
  value.den === 1 ? String(value.num) : `${String(value.num)}/${String(value.den)}`;

const postText = (post: BattlePost): string =>
  `${post.side}-${WING_LETTER[post.wing]}${post.line === 'front' ? 'F' : 'B'}`;

const labelOf = (unit: UnitId | HordeUnitId): string =>
  unit in units ? units[unit as UnitId].label : hordeUnits[unit as HordeUnitId].label;

const healthOf = (unit: UnitId | HordeUnitId): number =>
  unit in units ? units[unit as UnitId].health : hordeUnits[unit as HordeUnitId].health;

const defenseOf = (unit: UnitId | HordeUnitId): number =>
  unit in units ? units[unit as UnitId].defense : hordeUnits[unit as HordeUnitId].defense;

const sub = (a: Ratio, b: Ratio): Ratio => reduce(a.num * b.den - b.num * a.den, a.den * b.den);
const mul = (a: Ratio, b: Ratio): Ratio => reduce(a.num * b.num, a.den * b.den);
function reduce(num: number, den: number): Ratio {
  let [x, y] = [Math.abs(num), Math.abs(den)];
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return { num: num / x, den: den / x };
}

function hitText(hit: BattleHit, minDen: number): string {
  const tail = `baixas = piso((${String(hit.effective)} + ${String(hit.residualBefore)})/${String(healthOf(hit.targetUnit))}) = ${String(hit.casualties)}; restam ${String(hit.left)}, residual ${String(hit.residualAfter)}`;
  if (hit.absorbed === null) {
    return `dano fixo ${fmt(hit.raw)}, piso ${String(hit.effective)}; ${tail}`;
  }
  const aura = hit.defenseAura === null ? '' : `×${fmt(hit.defenseAura)} (aura)`;
  const raw = fmt(hit.raw);
  return (
    `absorvido = ${String(defenseOf(hit.targetUnit))}×${String(hit.targetCount)}×1/2${aura} = ${fmt(hit.absorbed)}; ` +
    `efetivo = máx(${raw} − ${fmt(hit.absorbed)}, ${raw}/${String(minDen)}) = máx(${fmt(sub(hit.raw, hit.absorbed))}, ${fmt(mul(hit.raw, { num: 1, den: minDen }))}), piso ${String(hit.effective)}; ` +
    tail
  );
}

function noteText(note: BattleNote, labels: { chief: (post: BattlePost) => string }): string {
  switch (note.kind) {
    case 'squadDestroyed':
      return `  - ${postText(note.post)} destruído: moral ${note.post.side} −10 → ${String(note.morale)}`;
    case 'wingFell':
      return `  - ala ${WING_LETTER[note.wing]} do lado ${note.side} caiu: moral −20 → ${String(note.morale)}`;
    case 'commanderFell':
      return `  - o comandante da ala ${WING_LETTER[note.wing]} (${note.heroId}) caiu: moral −15 → ${String(note.morale)}`;
    case 'chiefFell':
      return `  - o ${labels.chief(note.post)} caiu: a onda termina`;
  }
}

function actionText(action: BattleAction, chief: (post: BattlePost) => string): string[] {
  const notes = action.notes.map((note) => noteText(note, { chief }));
  if (action.kind !== 'attack') {
    const who =
      action.kind === 'tower'
        ? `Torre da ala ${WING_LETTER[action.wing]}`
        : `${action.kind === 'mage' ? 'Mago' : 'Clériga'} da ala ${WING_LETTER[action.wing]}`;
    if (action.healed !== null) {
      return [
        `- ${who} cura ${postText(action.healed.post)}: residual −${String(action.healed.residual)}, ${String(action.healed.soldiers)} de volta`,
      ];
    }
    return [
      ...action.hits.map(
        (hit) =>
          `- ${who} → ${postText(hit.target)} ${String(hit.targetCount)} ${labelOf(hit.targetUnit)}: ${hitText(hit, 5)}`,
      ),
      ...notes,
    ];
  }
  const factors = action.factors
    .map((factor) => `×${fmt(factor.value)} (${FACTOR_NAME[factor.kind]})`)
    .join('');
  let line =
    `- ${postText(action.actor)} ${String(action.count)} ${labelOf(action.unit)} → ` +
    `${postText(action.target)} ${String(action.targetCount)} ${labelOf(action.targetUnit)}: ` +
    `bruto = ${String(action.attack)}×${String(action.count)}${factors}×${String(action.luck)}/100 = ${fmt(action.raw)}`;
  if (action.wall !== null) {
    line += `; à muralha (${fmt(action.wall.share)}): piso(${fmt(mul(action.raw, action.wall.share))}) = ${String(action.wall.damage)}, muralha ${String(action.wall.before)} → ${String(action.wall.after)}`;
    if (action.hits.length > 0) {
      line += `; às tropas ${fmt(sub(action.raw, mul(action.raw, action.wall.share)))}`;
    }
  }
  if (action.hits.length === 1) {
    line += `; ${hitText(action.hits[0] as BattleHit, 5)}`;
  } else {
    for (const hit of action.hits) {
      line += `; em ${postText(hit.target)} ${fmt(hit.raw)}: ${hitText(hit, 5)}`;
    }
  }
  return [line, ...notes];
}

/** As rodadas, no formato do documento: de "**Rodada 1**" até a última linha da conta. */
export function renderRounds(resolution: BattleResolution): string {
  const chiefLabel = (post: BattlePost): string => {
    const squad = resolution.initial.find(
      (entry) =>
        entry.post.side === post.side &&
        entry.post.wing === post.wing &&
        entry.post.line === post.line,
    );
    return squad === undefined ? 'chefe' : labelOf(squad.unit);
  };
  const wallWings = (Object.keys(resolution.wallStart) as WingId[]).sort(
    (a, b) => ['left', 'center', 'right'].indexOf(a) - ['left', 'center', 'right'].indexOf(b),
  );
  const blocks: string[] = [];
  resolution.rounds.forEach((round, index) => {
    const last = index === resolution.rounds.length - 1;
    const lines = [`**Rodada ${String(round.round)}**`, ''];
    for (const action of round.actions) {
      lines.push(...actionText(action, chiefLabel));
    }
    if (round.routed !== null) {
      lines.push(
        '',
        `Fim da rodada ${String(round.round)}: moral ${round.routed} = ${String(round.morale[round.routed])} ≤ 30: debandada.`,
      );
    } else if (!last || resolution.ending === 'rounds') {
      const squads = round.squads
        .map(
          (squad) =>
            `${postText(squad.post)} ${String(squad.count)} (res ${String(squad.residual)})`,
        )
        .join(', ');
      const wall =
        wallWings.length === 0
          ? ''
          : `; muralha {${wallWings
              .map(
                (wing) =>
                  `${String(['left', 'center', 'right'].indexOf(wing))}: ${String(round.wall[wing])}`,
              )
              .join(', ')}}`;
      lines.push(
        '',
        `Fim da rodada ${String(round.round)}: moral D ${String(round.morale.D)}, A ${String(round.morale.A)}; ${squads}${wall}`,
      );
    }
    blocks.push(lines.join('\n'));
  });
  return blocks.join('\n\n');
}
