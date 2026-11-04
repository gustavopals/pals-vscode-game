import {
  hordeUnits,
  lineLabels,
  units,
  warCouncilTexts,
  wingLabels,
  wingLocatives,
} from '@lotg/content';

import { campaignWarning } from './campaign';
import { formationSignature } from './warCouncilOrders';
import { fillText } from './format';
import type { ArmyPreview, ArmyPreviewView, Formation, GameState } from './types';

/**
 * A prévia do Conselho de Guerra na visão (GDD §10.5 e §13.4; V4D-T2.4). Só lê o estado:
 * percentuais inteiros, a frase do risco montada a partir do fator (as frases estão no conteúdo)
 * e o inimigo com `?` onde a informação não existe.
 */

/** Um percentual inteiro, arredondado ao mais próximo, sem ponto flutuante. */
function percent(part: number, whole: number): number {
  return Math.floor((200 * part + whole) / (2 * whole));
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Risco principal: Na ala esquerda, a Frente cai…", ou a frase de quando nada se destacou. */
export function riskText(preview: ArmyPreview, hasTroops: boolean): string {
  if (preview.siegeWave !== undefined && preview.enemy.length === 0) {
    return warCouncilTexts.unknownWave;
  }
  if (!hasTroops) {
    return warCouncilTexts.noTroops;
  }
  const { risk } = preview;
  if (risk === null) {
    return warCouncilTexts.noRisk;
  }
  // Sem ala não há `{ala}` para preencher: cada fator tem a sua forma sem ela, para a frase não
  // começar por uma vírgula. A aura de uma ala só é a do Xamã.
  const sentence =
    risk.wing === null
      ? warCouncilTexts.riskNoWing[risk.factor]
      : fillText(
          risk.factor === 'aura' ? warCouncilTexts.riskAuraWing : warCouncilTexts.risk[risk.factor],
          { ala: wingLocatives[risk.wing] },
        );
  return `${warCouncilTexts.riskPrefix}${sentence}`;
}

/** A prévia da formação mudou depois: a impressão digital de hoje não é a da prévia. */
export function previewIsStale(state: GameState, formation: Formation): boolean {
  const { preview } = state.army;
  return (
    preview !== null &&
    preview.formationId === formation.id &&
    preview.signature !== formationSignature(state, formation, preview.siegeWave)
  );
}

export function armyPreviewView(state: GameState): ArmyPreviewView | null {
  const { preview } = state.army;
  if (preview === null) {
    return null;
  }
  const winsPercent = percent(preview.wins, preview.runs);
  return {
    warning: campaignWarning(state),
    formationId: preview.formationId,
    siegeWave: preview.siegeWave ?? null,
    runs: preview.runs,
    winsPercent,
    gloriousPercent: percent(preview.glorious, preview.runs),
    lossesPercent: 100 - winsPercent,
    riskText: riskText(preview, preview.expectedLosses.length > 0),
    expectedLosses: preview.expectedLosses.map((post) => ({
      wing: post.wing,
      line: post.line,
      unit: post.unit,
      unitLabel: units[post.unit].label,
      start: post.start,
      expected: post.expected,
      text: `${wingLabels[post.wing]}, ${lineLabels[post.line].toLowerCase()}: ${post.expected} de ${post.start} ${units[post.unit].pluralLabel}`,
    })),
    knownEnemy: preview.enemy.map((post) => {
      const label = capitalized(hordeUnits[post.unit].pluralLabel);
      return {
        wing: post.wing,
        wingLabel: wingLabels[post.wing],
        line: post.line,
        lineLabel: lineLabels[post.line],
        known: post.known,
        unitLabel: label,
        count: post.count,
        text: post.known ? `${label} ${post.count}` : `${label} ~${post.count} ?`,
      };
    }),
  };
}
