import { balance, DIFFICULTY_IDS, type DifficultyId } from '@lotg/content';
import type { CatalogResponse } from '@lotg/protocol';

import type { Config } from './config';
import { CONTENT_HASH } from './version';

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
 * Corpo de `GET /catalog` (GDD §14.5; ADR 0013, decisão 2a): as opções de nova partida, com os
 * textos do conteúdo. Os fatores de regra de cada dificuldade ficam de fora: quem os aplica é o
 * motor, e o app só mostra a frase.
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
      defaults: { difficulty: defaultDifficulty(), timeScale: suggestedTimeScale(config) },
    },
  };
}
