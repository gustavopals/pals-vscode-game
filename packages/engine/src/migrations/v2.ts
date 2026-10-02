import { DIFFICULTY_IDS } from '@lotg/content';

import {
  exactObject,
  literal,
  natural,
  nullable,
  oneOf,
  positiveNumber,
  type Shape,
  text,
} from './shape';
import type { MigrationStep, StoredState } from './step';
import { stateV1Fields } from './v1';

// A lista de dificuldades fica escrita aqui pelo mesmo motivo dos edifícios da versão 1: a forma
// de uma versão não acompanha o conteúdo. O teste confere que hoje as duas listas coincidem.
const DIFFICULTIES = ['peasant', 'lord', 'ironKing'] satisfies (typeof DIFFICULTY_IDS)[number][];

/**
 * O `GameState` da versão 2: o da versão 1 sem `settings.capsEnabled`, com dificuldade e ritmo
 * em `settings` e com a fronteira da atualização.
 *
 * O passo que sai daqui é o `v2ToV3`, abaixo; a forma da versão 3 está em `v3.ts`.
 */
export const stateV2Fields: Readonly<Record<string, Shape>> = {
  ...stateV1Fields,
  schemaVersion: literal(2),
  settings: exactObject({
    settlementName: text,
    timezone: text,
    vigilHourLocal: natural,
    difficulty: oneOf(DIFFICULTIES),
    timeScale: positiveNumber,
  }),
  migratedAtMs: nullable(natural),
};

export const stateV2: Shape = exactObject(stateV2Fields);

/**
 * Versão 2 → 3: estações com efeito (V2C-T1; ADR 0013, decisões 4 e 13).
 *
 * - `settlement.cold` entra como `null`: ninguém passava frio antes de a lenha existir. Uma
 *   partida que a migração encontra no inverno e sem madeira abre o frio no primeiro avanço,
 *   no instante da fronteira e com a linha na Crônica (`advanceTo` acomoda fome e frio antes de
 *   o tempo andar): a regra nova vale dali em diante, nunca para trás.
 * - Nenhum prazo muda: obras e recrutamentos em curso mantêm o `finishesAtMs` com que
 *   começaram. Os fatores de duração só valem para o que for iniciado depois.
 * - O estoque, os restos de produção e tudo o mais ficam como estão. As taxas passam a levar o
 *   fator da estação a partir da fronteira.
 */
export const v2ToV3: MigrationStep = {
  from: 2,
  summary: 'estações com efeito: o frio entra no estado, fechado',
  shape: stateV2,
  migrate(state) {
    return {
      ...state,
      schemaVersion: 3,
      settlement: { ...(state.settlement as StoredState), cold: null },
    };
  },
};
