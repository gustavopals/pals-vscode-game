import {
  balance,
  DIFFICULTY_IDS,
  mapScenarios,
  mapTexts,
  SCENARIO_IDS,
  type DifficultyId,
  type ScenarioId,
} from '@lotg/content';
import { type CatalogResponse, CreateGameRequestSchema } from '@lotg/protocol';

import type { Config } from './config';
import { CONTENT_HASH } from './version';

const formatLegacy = (points: number) => new Intl.NumberFormat('pt-BR').format(points);

function recommended<T extends { readonly recommended: boolean }>(items: readonly T[]): T {
  const found = items.find((item) => item.recommended);
  if (found === undefined) {
    // O schema do conteúdo exige exatamente um recomendado; chegar aqui é defeito de conteúdo.
    throw new Error('O conteúdo não marca nenhuma opção como recomendada.');
  }
  return found;
}

/** A dificuldade de quem não escolhe: a que o conteúdo marca como recomendada (Senhor). */
export function defaultDifficulty(): DifficultyId {
  return recommended(DIFFICULTY_IDS.map((id) => ({ id, ...balance.difficulties[id] }))).id;
}

/** O cenário de quem não escolhe: o que o conteúdo marca como recomendado (`standard`). */
export function defaultScenario(): ScenarioId {
  return recommended(SCENARIO_IDS.map((id) => ({ id, ...mapScenarios[id] }))).id;
}

/**
 * O ritmo que as boas-vindas trazem marcado: o padrão do servidor (`GAME_TIME_SCALE`) quando ele
 * é um dos oferecidos; senão, o recomendado do conteúdo. A configuração aceita qualquer ritmo de
 * 0,5 a 10, e um ritmo fora da lista não pode aparecer como opção.
 */
function suggestedTimeScale(config: Pick<Config, 'gameTimeScale'>): number {
  const offered = balance.paces.some((pace) => pace.timeScale === config.gameTimeScale);
  return offered ? config.gameTimeScale : recommended(balance.paces).timeScale;
}

/**
 * Corpo de `GET /catalog` (GDD §14.5; ADR 0013, decisão 2a; ADR 0022, D-18): as opções de nova
 * partida, com os textos e custos do conteúdo. Os fatores de regra e os pesos de terreno ficam
 * de fora: quem os aplica é o motor, e o app só mostra o que o catálogo entrega.
 */
export function catalogInfo(config: Pick<Config, 'gameTimeScale'>): CatalogResponse {
  return {
    contentHash: CONTENT_HASH,
    newGame: {
      difficulties: DIFFICULTY_IDS.map((id) => {
        const { label, description, recommended: isRecommended } = balance.difficulties[id];
        return { id, label, description, recommended: isRecommended };
      }),
      paces: balance.paces.map(
        ({ timeScale, label, description, hint, recommended: isRecommended }) => ({
          timeScale,
          label,
          description,
          hint,
          recommended: isRecommended,
        }),
      ),
      scenarios: SCENARIO_IDS.map((id) => {
        const { label, description, legacyCost, recommended: isRecommended } = mapScenarios[id];
        const cost = formatLegacy(legacyCost);
        return {
          id,
          label,
          description,
          legacyCost,
          costLabel: legacyCost > 0 ? mapTexts.scenarioCostLabel.replace('{custo}', cost) : null,
          lockedReason: legacyCost > 0 ? mapTexts.scenarioLocked.replace('{custo}', cost) : null,
          recommended: isRecommended,
        };
      }),
      defaults: {
        difficulty: defaultDifficulty(),
        timeScale: suggestedTimeScale(config),
        scenario: defaultScenario(),
      },
    },
  };
}

/**
 * O corpo de `POST /games` como o servidor o aceita. A forma é a do protocolo; o ritmo, quando
 * vem, tem de ser um dos que o conteúdo oferece (GDD §4.2; ADR 0013, decisão 2). A conferência
 * fica aqui, e não no protocolo, porque o app importa os schemas de lá: ler `balance` naquele
 * módulo levaria os números do jogo para o navegador. A recusa sai como a de forma:
 * `400 VALIDATION`, com `timeScale` em `details.issues`.
 */
export const OfferedGameRequestSchema = CreateGameRequestSchema.refine(
  (body) =>
    body.timeScale === undefined || balance.paces.some((pace) => pace.timeScale === body.timeScale),
  { path: ['timeScale'], message: 'ritmo fora dos oferecidos' },
);
