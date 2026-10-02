import {
  boolean,
  exactObject,
  listOf,
  listOfLength,
  literal,
  natural,
  nullable,
  oneOf,
  type Shape,
} from './shape';
import type { MigrationStep, StoredState } from './step';
import { settlementV9Fields, stateV9Fields } from './v9';

// Os identificadores ficam escritos aqui, como nas outras versões: a forma de uma versão não
// acompanha o conteúdo. O teste confere que hoje a lista coincide com a de `@lotg/content`.
const BUILDINGS = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
  'granary',
  'warehouse',
  'watchtower',
  'palisade',
];
/** Quantas filas de obras o estado guarda, abertas ou não. */
const QUEUES = 2;

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

/**
 * O `GameState` da versão 10: o da versão 9 com a Paliçada (V2E-T2) em `settlement.buildings`,
 * nas obras em curso e nas planejadas. Nenhum campo novo: o que a Paliçada segura é derivado do
 * nível dela, e a cadeia de cartas "A Promessa da Paliçada" usa o que o Conselho já guardava
 * (os ids de carta e de flag são texto livre).
 *
 * O passo que sai daqui é o `v10ToV11`, abaixo; a forma da versão 11 está em `v11.ts`.
 */
export const settlementV10Fields: Readonly<Record<string, Shape>> = {
  ...settlementV9Fields,
  buildings: each(BUILDINGS, natural),
  constructionQueues: listOfLength(
    QUEUES,
    nullable(
      exactObject({
        building: oneOf(BUILDINGS),
        targetLevel: natural,
        startedAtMs: natural,
        finishesAtMs: natural,
      }),
    ),
  ),
  planned: listOf(
    exactObject({ building: oneOf(BUILDINGS), targetLevel: natural, autoStart: boolean }),
  ),
};

export const stateV10Fields: Readonly<Record<string, Shape>> = {
  ...stateV9Fields,
  schemaVersion: literal(10),
  settlement: exactObject(settlementV10Fields),
};

export const stateV10: Shape = exactObject(stateV10Fields);

/**
 * A incursão do roteiro com que uma partida antiga entra na mecânica, escrita aqui como os
 * outros números de uma migração: lobos, leve, no início do 16º dia de jogo do ano 1 (30 h de
 * jogo, com o dia de 2 horas; GDD §8.2). O teste confere que hoje ela coincide com a do conteúdo.
 */
const WOLVES_YEAR_1_V11 = {
  id: 'wolvesYear1',
  atMs: 15 * 7_200_000,
  kind: 'scripted',
  enemy: 'wolves',
  size: 'light',
  announcedAtMs: null,
} as const;

/**
 * Versão 10 → 11: a incursão de lobos (V2E-T3; ADR 0013, decisão 4; ADR 0014, decisões 10 e 20).
 *
 * - `settlement.injured` entra vazio: ninguém estava ferido.
 * - `horde.scheduledRaids` ganha a incursão do roteiro do ano 1 **só se a partida ainda não
 *   passou do instante dela**: a fronteira deste passo é anterior ao início do 16º dia de jogo.
 *   Quem já passou não a recebe, nem os uivos que a anunciam (o dia deles também já passou). A
 *   lista continua em ordem de chegada.
 *
 * As incursões por Ameaça contam da fronteira como a própria Ameaça: são sorteadas nas viradas
 * de dia depois dela, com o número que a partida tiver. O passo não emite evento, não fere
 * ninguém e não toca o gerador. Se a Torre da partida já vê a incursão do roteiro (a fronteira
 * caiu dentro da antecedência), quem dá o alarme é o primeiro `advanceTo`, na fronteira.
 */
export const v10ToV11: MigrationStep = {
  from: 10,
  summary: 'feridos vazios e a incursão de lobos do ano 1, para quem ainda não passou dela',
  shape: stateV10,
  migrate(state, { boundaryMs }) {
    const settlement = state.settlement as StoredState;
    const horde = state.horde as StoredState;
    const marked = horde.scheduledRaids as Array<{ id: string; atMs: number }>;
    const scheduledRaids =
      boundaryMs < WOLVES_YEAR_1_V11.atMs && !marked.some(({ id }) => id === WOLVES_YEAR_1_V11.id)
        ? [...marked, { ...WOLVES_YEAR_1_V11 }].sort((a, b) => a.atMs - b.atMs)
        : marked;
    return {
      ...state,
      schemaVersion: 11,
      settlement: { ...settlement, injured: [] },
      horde: { ...horde, scheduledRaids },
    };
  },
};
