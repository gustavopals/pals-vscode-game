import { exactObject, literal, natural, nullable, type Shape } from './shape';
import type { MigrationStep, StoredState } from './step';
import { settlementV1Fields } from './v1';
import { stateV2Fields } from './v2';

/**
 * O `GameState` da versão 3: o da versão 2 com `settlement.cold`, o frio (V2C-T1).
 *
 * O passo que sai daqui é o `v3ToV4`, abaixo; a forma da versão 4 está em `v4.ts`.
 */
export const settlementV3Fields: Readonly<Record<string, Shape>> = {
  ...settlementV1Fields,
  cold: nullable(exactObject({ sinceMs: natural })),
};

export const stateV3Fields: Readonly<Record<string, Shape>> = {
  ...stateV2Fields,
  schemaVersion: literal(3),
  settlement: exactObject(settlementV3Fields),
};

export const stateV3: Shape = exactObject(stateV3Fields);

/**
 * Versão 3 → 4: armazenamento (V2C-T2; ADR 0013, decisões 4 e 17).
 *
 * - `settlement.buildings` ganha o Celeiro (`granary`) e o Armazém (`warehouse`), os dois no
 *   nível 0: ninguém os tinha construído. O limite de cada recurso passa a ser o inicial.
 * - `settlement.wasted` entra zerado: nada foi desperdiçado antes de haver limite.
 * - **O estoque fica como está**, mesmo acima do limite: nada é cortado. Dali em diante o que
 *   está acima do limite não recebe produção (que conta como desperdício) e pode ser gasto.
 *   Nenhuma linha de "encheu" sai na fronteira: o estoque herdado não encheu, já estava lá.
 * - O objetivo 4 de quem já o concluiu continua concluído, com o ouro que rendeu na v0.1.
 */
export const v3ToV4: MigrationStep = {
  from: 3,
  summary: 'armazenamento: Celeiro e Armazém no nível 0 e o contador de desperdício zerado',
  shape: stateV3,
  migrate(state) {
    const settlement = state.settlement as StoredState;
    return {
      ...state,
      schemaVersion: 4,
      settlement: {
        ...settlement,
        buildings: { ...(settlement.buildings as StoredState), granary: 0, warehouse: 0 },
        wasted: { food: 0, wood: 0, stone: 0, gold: 0 },
      },
    };
  },
};
