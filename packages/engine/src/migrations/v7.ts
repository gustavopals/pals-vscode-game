import { exactObject, integer, listOf, literal, natural, type Shape, text } from './shape';
import type { MigrationStep } from './step';
import { settlementV6Fields, stateV6Fields } from './v6';

/**
 * O `GameState` da versão 7: o da versão 6 com a moral (V2C-T4). Entram `settlement.morale`, um
 * número de 0 a 100, e `settlement.moraleEffects`, os efeitos temporários que cartas, incursões
 * e objetivos gravam: quem, com que nome, quanto (positivo ou negativo) e até quando.
 *
 * O passo que sai daqui é o `v7ToV8`, abaixo; a forma da versão 8 está em `v8.ts`.
 */
export const settlementV7Fields: Readonly<Record<string, Shape>> = {
  ...settlementV6Fields,
  morale: natural,
  moraleEffects: listOf(exactObject({ id: text, label: text, amount: integer, untilMs: natural })),
};

export const stateV7Fields: Readonly<Record<string, Shape>> = {
  ...stateV6Fields,
  schemaVersion: literal(7),
  settlement: exactObject(settlementV7Fields),
};

export const stateV7: Shape = exactObject(stateV7Fields);

/**
 * A cadência do Conselho com que uma partida antiga entra na mecânica, escrita aqui como os
 * outros números de uma migração: 4 dias de jogo de 2 horas (GDD §7.1). O teste confere que
 * hoje ela coincide com a do conteúdo.
 */
const DAY_MS_V8 = 7_200_000;
const DRAW_INTERVAL_MS_V8 = 4 * DAY_MS_V8;

/**
 * Versão 7 → 8: o Conselho do Feudo (V2D-T1; ADR 0013, decisão 4; ADR 0014, decisões 1 e 18).
 *
 * Entra `council`, vazio: nenhuma carta na mesa, nenhuma flag, nenhuma continuação. **A primeira
 * carta conta a partir da fronteira**: `nextDrawAtMs` é a primeira virada de dia de jogo a
 * partir de `fronteira + intervalo`. O sorteio é da virada do dia, então o prazo é levado até
 * ela; dali em diante a cadência anda de intervalo em intervalo, como em uma partida nova. A
 * ausência anterior à migração não gera carta nenhuma.
 *
 * Nada mais muda: nenhum estoque, nenhum prazo em curso, nenhum sorteio. O passo não emite
 * evento; a primeira linha do Conselho na Crônica é a da primeira carta.
 */
export const v7ToV8: MigrationStep = {
  from: 7,
  summary: 'Conselho vazio, com a primeira carta um intervalo depois da fronteira',
  shape: stateV7,
  migrate(state, { boundaryMs }) {
    const due = boundaryMs + DRAW_INTERVAL_MS_V8;
    return {
      ...state,
      schemaVersion: 8,
      council: {
        pending: [],
        flags: {},
        seenThisYear: [],
        nextDrawAtMs: Math.ceil(due / DAY_MS_V8) * DAY_MS_V8,
        scheduled: [],
        delayed: [],
        expired: [],
      },
    };
  },
};
