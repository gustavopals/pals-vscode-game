import {
  exactObject,
  listOf,
  literal,
  natural,
  nullable,
  recordOf,
  type Shape,
  text,
} from './shape';
import type { MigrationStep, StoredState } from './step';
import { stateV7Fields } from './v7';

/**
 * O `GameState` da versão 8: o da versão 7 com o Conselho do Feudo (V2D-T1). Entra `council`:
 * as cartas na mesa, as flags, as cartas vistas no ano, o próximo sorteio, as continuações
 * agendadas, os efeitos escondidos à espera e as ocorrências que expiraram no ano.
 *
 * Os ids de carta, de opção e de flag são texto livre: o catálogo é conteúdo e cresce sem a
 * forma do estado mudar. Uma carta que o catálogo já não tem sai da mesa sem efeito.
 *
 * O passo que sai daqui é o `v8ToV9`, abaixo; a forma da versão 9 está em `v9.ts`.
 */
export const councilV8Fields: Readonly<Record<string, Shape>> = {
  pending: listOf(
    exactObject({
      instanceId: text,
      cardId: text,
      drawnAtMs: natural,
      expiresAtMs: natural,
      // A escolha que trouxe a carta, quando ela é uma continuação.
      origin: nullable(exactObject({ cardId: text, optionId: text, instanceId: text })),
    }),
  ),
  // Uma flag gravada vale `true`; a apagada sai do objeto.
  flags: recordOf(literal(true)),
  seenThisYear: listOf(text),
  nextDrawAtMs: natural,
  scheduled: listOf(
    exactObject({
      cardId: text,
      atMs: natural,
      previousCardId: text,
      previousOptionId: text,
      previousInstanceId: text,
    }),
  ),
  delayed: listOf(exactObject({ atMs: natural, instanceId: text, cardId: text, optionId: text })),
  expired: listOf(text),
};

export const stateV8Fields: Readonly<Record<string, Shape>> = {
  ...stateV7Fields,
  schemaVersion: literal(8),
  council: exactObject(councilV8Fields),
};

export const stateV8: Shape = exactObject(stateV8Fields);

/**
 * Versão 8 → 9: a Torre de Vigia, os tiles de ameaça e a Ameaça (V2E-T1; ADR 0013, decisão 4;
 * ADR 0014, decisão 11).
 *
 * - `settlement.buildings` ganha a Torre de Vigia (`watchtower`) no nível 0: ninguém a tinha.
 * - Entra `map`: o Covil de Lobos, ativo, e a **Ameaça em 0**. Ela conta a partir da fronteira:
 *   sobe na primeira virada de dia de jogo depois dela, como em uma partida nova, e a ausência
 *   anterior à migração não soma nada.
 * - Entra `horde`, sem nenhuma incursão marcada.
 *
 * Nada mais muda: nenhum estoque, nenhum prazo, nenhum sorteio. O passo não emite evento e não
 * cria prazo nenhum; por isso não usa a fronteira.
 */
export const v8ToV9: MigrationStep = {
  from: 8,
  summary: 'Torre de Vigia no nível 0, o Covil de Lobos ativo e a Ameaça em zero',
  shape: stateV8,
  migrate(state) {
    const settlement = state.settlement as StoredState;
    return {
      ...state,
      schemaVersion: 9,
      settlement: {
        ...settlement,
        buildings: { ...(settlement.buildings as StoredState), watchtower: 0 },
      },
      map: { tiles: { wolfDen: { type: 'wolfDen', threatActive: true } }, threat: 0 },
      horde: { scheduledRaids: [] },
    };
  },
};
