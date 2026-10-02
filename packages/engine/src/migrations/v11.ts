import { exactObject, listOf, literal, natural, nullable, oneOf, type Shape } from './shape';
import { settlementV10Fields, stateV10Fields } from './v10';

// Os identificadores ficam escritos aqui, como nas outras versões: a forma de uma versão não
// acompanha o conteúdo. O teste confere que hoje a lista coincide com a de `@lotg/content`.
const PRODUCTION_BUILDINGS = ['farm', 'lumberMill', 'quarry', 'goldMine'];

/**
 * O `GameState` da versão 11: o da versão 10 com os feridos das incursões (V2E-T3). Entra
 * `settlement.injured`: até quando cada ferido fica sem trabalhar e o edifício a que ele volta
 * (`null` para quem não tinha ofício).
 *
 * `horde.scheduledRaids` não muda de forma: a versão 9 já a trazia. O que muda é que agora há
 * quem a preencha (a incursão do roteiro e as sorteadas pela Ameaça), e `stats` ganha as
 * contagens `raids_suffered` e `raids_repelled`, que são chaves livres.
 *
 * Quem subir `schemaVersion` para 12 acrescenta aqui o passo `v11ToV12`, com esta forma como
 * entrada, e escreve a forma nova em `v12.ts`.
 */
export const settlementV11Fields: Readonly<Record<string, Shape>> = {
  ...settlementV10Fields,
  injured: listOf(
    exactObject({ untilMs: natural, building: nullable(oneOf(PRODUCTION_BUILDINGS)) }),
  ),
};

export const stateV11Fields: Readonly<Record<string, Shape>> = {
  ...stateV10Fields,
  schemaVersion: literal(11),
  settlement: exactObject(settlementV11Fields),
};

export const stateV11: Shape = exactObject(stateV11Fields);
