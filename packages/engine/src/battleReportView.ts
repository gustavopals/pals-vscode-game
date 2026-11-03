import {
  battleOutcomeLabels,
  battleReportTexts,
  heroClasses,
  hordeUnits,
  lineLabels,
  militiaUnit,
  units,
  wingLabels,
  type HordeUnitId,
  type UnitId,
} from '@lotg/content';

import type { BattleReport, BattleReportPost } from './battleReport';
import { fillText, sentenceCase } from './format';
import type { ArmyReportView, GameState } from './types';

/**
 * Os relatórios de batalha na visão (V4D-T4.3): `state.army.reports` com tudo em frase, do mais
 * novo ao mais antigo. O app só mostra; nenhum número de regra é recomposto lá. Os fatores já
 * saem em palavra, as rodadas com o resumo de cada golpe, as baixas por posto, a muralha e a
 * experiência dos comandantes.
 */

const unitLabel = (unit: UnitId | HordeUnitId | 'militia', count: number): string => {
  if (unit === 'militia') {
    return count === 1 ? militiaUnit.label.toLowerCase() : militiaUnit.pluralLabel;
  }
  const def = unit in units ? units[unit as UnitId] : hordeUnits[unit as HordeUnitId];
  return count === 1 ? def.label.toLowerCase() : def.pluralLabel;
};

const postText = (post: BattleReportPost): string => {
  const side = battleReportTexts.sides[post.owner];
  return `${side}, ${wingLabels[post.wing].toLowerCase()}, ${lineLabels[post.line].toLowerCase()}`;
};

function reportView(state: GameState, report: BattleReport): ArmyReportView {
  const texts = battleReportTexts;
  const wallText = (wall: Partial<Record<keyof typeof wingLabels, number>>): string =>
    (Object.keys(wingLabels) as Array<keyof typeof wingLabels>)
      .filter((wing) => wall[wing] !== undefined)
      .map((wing) => `${wingLabels[wing]} ${String(wall[wing])}`)
      .join(', ');
  return {
    id: report.id,
    mode: report.mode,
    modeLabel: texts.modes[report.mode],
    outcome: report.outcome,
    outcomeLabel: sentenceCase(battleOutcomeLabels[report.outcome]),
    ending: report.ending,
    endingText: texts.endings[report.ending],
    roundsCount: report.rounds,
    factors: report.decisive.map((entry) => ({
      factor: entry.factor,
      owner: entry.owner,
      wing: entry.wing,
      wingLabel: entry.wing === null ? null : wingLabels[entry.wing],
      round: entry.round,
      amount: entry.amount,
      percent: entry.percent,
      text: fillText(texts.factors[entry.factor][entry.owner], {
        valor: entry.amount,
        percentual: entry.percent ?? 0,
      }),
    })),
    noFactorText: texts.noFactor,
    rounds: report.log.map((round) => ({
      round: round.round,
      attacks: round.attacks.map((attack) =>
        fillText(texts.attack, {
          ator: postText(attack.actor),
          quantos: attack.count,
          unidade: unitLabel(attack.unit, attack.count),
          alvo: postText(attack.target),
          dano: attack.damage,
          baixas: attack.casualties,
        }),
      ),
      casualtiesPlayer: round.casualties.player,
      casualtiesHorde: round.casualties.horde,
      moraleText: fillText(texts.roundMorale, {
        feudo: round.morale.player,
        horda: round.morale.horde,
      }),
      wallText:
        Object.keys(round.wall).length === 0
          ? null
          : fillText(texts.roundWall, {
              muralha: wallText(round.wall),
            }),
    })),
    casualties: report.casualties.map((entry) => ({
      owner: entry.owner,
      wing: entry.wing,
      line: entry.line,
      start: entry.start,
      lost: entry.lost,
      text: fillText(texts.casualty, {
        posto: postText({ owner: entry.owner, wing: entry.wing, line: entry.line }),
        unidade: unitLabel(entry.unit, entry.start),
        perdeu: entry.lost,
        comecou: entry.start,
      }),
    })),
    wall: report.wall.map((entry) => ({
      wing: entry.wing,
      start: entry.start,
      end: entry.end,
      text: fillText(texts.wall, {
        ala: wingLabels[entry.wing],
        comecou: entry.start,
        terminou: entry.end,
      }),
    })),
    commanders: report.commanders.map((entry) => {
      const hero = state.guild.heroes.find((candidate) => candidate.id === entry.heroId);
      const name = hero?.name ?? texts.unknownHero;
      const classLabel = heroClasses[entry.heroClass].label;
      const fateText = texts.fates[entry.fate ?? 'none'];
      return {
        heroId: entry.heroId,
        name,
        classLabel,
        wing: entry.wing,
        fate: entry.fate,
        fateText,
        xp: entry.xp,
        text: fillText(texts.commander, {
          nome: name,
          classe: classLabel.toLowerCase(),
          ala: wingLabels[entry.wing].toLowerCase(),
          destino: fateText,
          xp: entry.xp,
        }),
      };
    }),
    // A formação do relatório pode já não ser a Defesa ativa. Só oferece a que realmente lutou.
    adjustFormationId:
      report.formationId !== null &&
      state.army.formations.some((formation) => formation.id === report.formationId)
        ? report.formationId
        : null,
  };
}

export function armyReportsView(state: GameState): ArmyReportView[] {
  return state.army.reports.map((report) => reportView(state, report)).reverse();
}
