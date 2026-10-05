import { exactObject, listOf, literal, natural, nullable, oneOf, type Shape } from './shape';
import type { MigrationStep, StoredState } from './step';
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
 * O passo que sai daqui é o `v11ToV12`, abaixo; a forma da versão 12 está em `v12.ts`.
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

/**
 * Os números com que uma partida antiga entra na deserção em tempo real, escritos aqui como os
 * outros números de uma migração (GDD §5.6; ADR 0016, item 2): o dia de jogo de 2 horas, a
 * carência de 12 h reais, o passo de 2 h reais e as dificuldades em que a fome faz partir. O
 * teste confere que hoje eles coincidem com os do conteúdo.
 */
const DAY_MS_V12 = 7_200_000;
const DESERTION_AFTER_REAL_MS_V12 = 12 * 3_600_000;
const DESERTION_EVERY_REAL_MS_V12 = 2 * 3_600_000;
const DESERTING_DIFFICULTIES_V12 = ['lord', 'ironKing'];

/** Um prazo de tempo real em ms de jogo, no ritmo da partida: a conta de `realToGameMs`. */
const toGameMsV12 = (realMs: number, timeScale: number) =>
  Math.max(1, Math.round(realMs * timeScale));

/**
 * Quantos aldeões a regra nova já teria cobrado de uma fome aberta em `sinceMs` até a fronteira.
 * Quem cobra é a virada do dia: vale a última virada que a partida já atravessou (a da própria
 * fronteira, se ela cai em uma). Nenhum enquanto a fome dura menos que a carência; a partir
 * dela, o primeiro e mais um a cada passo.
 */
function chargedUntilV12(
  sinceMs: number,
  boundaryMs: number,
  settings: { difficulty: string; timeScale: number },
): number {
  if (!DESERTING_DIFFICULTIES_V12.includes(settings.difficulty)) {
    return 0;
  }
  const lastTurnMs = Math.floor(boundaryMs / DAY_MS_V12) * DAY_MS_V12;
  const lastedMs = lastTurnMs - sinceMs;
  const graceMs = toGameMsV12(DESERTION_AFTER_REAL_MS_V12, settings.timeScale);
  const stepMs = toGameMsV12(DESERTION_EVERY_REAL_MS_V12, settings.timeScale);
  return lastedMs < graceMs ? 0 : Math.floor((lastedMs - graceMs) / stepMs) + 1;
}

/**
 * Versão 11 → 12: a deserção por fome em tempo real e a fome que reabre (V2G-T2; ADR 0016,
 * itens 2 e 3).
 *
 * - `settlement.famine`, quando há fome, ganha `carriedMs: 0` (ela não é a continuação de
 *   nenhuma: `sinceMs` continua sendo o começo dela) e `deserted`: **quantos aldeões a regra
 *   nova já teria cobrado até a fronteira**, contados na última virada de dia que a partida
 *   atravessou. Assim ninguém sai em bloco na primeira virada: no ritmo em que a deserção ficou
 *   mais rápida, o que a regra antiga não cobrou fica perdoado; no ritmo em que ficou mais
 *   lenta, quem já desertou a mais não volta, e o próximo só sai quando o prazo novo o dever.
 *   No ritmo 1 a conta dá exatamente os que a regra antiga cobrou, e nada muda.
 * - `settlement.lastFamine` entra `null`: a versão 11 não guardava quando a última fome
 *   acabou, e uma fome que abrir depois da fronteira começa do zero.
 *
 * Sem fome, a partida não muda de comportamento. O passo não cria prazo, não emite evento, não
 * tira ninguém do feudo e não toca o gerador: a primeira virada de dia depois da fronteira é
 * que cobra o que a fome dever dali em diante.
 */
export const v11ToV12: MigrationStep = {
  from: 11,
  summary: 'a fome guarda o que já durou antes e os desertores já cobrados; última fome vazia',
  shape: stateV11,
  migrate(state, { boundaryMs }) {
    const settlement = state.settlement as StoredState;
    const settings = state.settings as { difficulty: string; timeScale: number };
    const famine = settlement.famine as { sinceMs: number } | null;
    return {
      ...state,
      schemaVersion: 12,
      settlement: {
        ...settlement,
        famine:
          famine === null
            ? null
            : {
                sinceMs: famine.sinceMs,
                carriedMs: 0,
                deserted: chargedUntilV12(famine.sinceMs, boundaryMs, settings),
              },
        lastFamine: null,
      },
    };
  },
};
