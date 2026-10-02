import { exactObject, listOf, literal, natural, oneOf, positive, type Shape } from './shape';
import type { MigrationStep, StoredState } from './step';
import { settlementV5Fields, stateV5Fields } from './v5';

// Os identificadores ficam escritos aqui, como nas outras versões: a forma de uma versão não
// acompanha o conteúdo. O teste confere que hoje a lista coincide com a de `@lotg/content`.
const PRODUCTION_BUILDINGS = ['farm', 'lumberMill', 'quarry', 'goldMine'];

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

/**
 * O `GameState` da versão 6: o da versão 5 com a troca de ofício e a experiência do ofício
 * (V2C-T3). Entram `settlement.craftExperience` e `settlement.craftMasteredYear`, um número por
 * edifício produtivo, e `settlement.adaptation`, as coortes de quem ainda se adapta.
 *
 * O passo que sai daqui é o `v6ToV7`, abaixo; a forma da versão 7 está em `v7.ts`.
 */
export const settlementV6Fields: Readonly<Record<string, Shape>> = {
  ...settlementV5Fields,
  craftExperience: each(PRODUCTION_BUILDINGS, natural),
  craftMasteredYear: each(PRODUCTION_BUILDINGS, natural),
  // Uma coorte vazia não existe: ela sai da lista quando o último trabalhador dela sai.
  adaptation: listOf(
    exactObject({ building: oneOf(PRODUCTION_BUILDINGS), count: positive, untilMs: natural }),
  ),
};

export const stateV6Fields: Readonly<Record<string, Shape>> = {
  ...stateV5Fields,
  schemaVersion: literal(6),
  settlement: exactObject(settlementV6Fields),
};

export const stateV6: Shape = exactObject(stateV6Fields);

/** A moral com que uma partida antiga entra na mecânica: a base do GDD §5.7. */
const MORALE_BASE_V7 = 50;

/**
 * Versão 6 → 7: a moral (V2C-T4; ADR 0013, decisões 4 e 19).
 *
 * - `settlement.morale` entra em 50, a base: **a produção de ninguém muda na fronteira** (com
 *   50 o fator é × 1). A moral é recalculada na primeira virada de dia depois dela, com a
 *   comida, as casas, a fome e o frio que a partida tiver naquele instante.
 * - `settlement.moraleEffects` entra vazia: nenhum efeito temporário existia antes.
 *
 * Nada mais muda: nenhum prazo, nenhum estoque, nenhum aldeão. Uma partida encontrada com fome
 * antiga conta a fome desde quando ela começou (`famine.sinceMs` já estava no estado): se já
 * dura mais do que o prazo da deserção, o primeiro aldeão deserta na primeira virada de dia
 * depois da fronteira, e não antes. O passo não cria prazo nenhum.
 */
export const v6ToV7: MigrationStep = {
  from: 6,
  summary: 'moral em 50, sem efeitos temporários',
  shape: stateV6,
  migrate(state) {
    const settlement = state.settlement as StoredState;
    return {
      ...state,
      schemaVersion: 7,
      settlement: { ...settlement, morale: MORALE_BASE_V7, moraleEffects: [] },
    };
  },
};
