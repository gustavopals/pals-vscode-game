import { exactObject, literal, natural, nullable, type Shape } from './shape';
import type { MigrationStep } from './step';
import { settlementV11Fields, stateV11Fields } from './v11';

/**
 * O `GameState` da versão 12: o da versão 11 com a deserção por fome em tempo real e a fome que
 * reabre (V2G-T2; ADR 0016, itens 2 e 3).
 *
 * - `settlement.famine` ganha `carriedMs` (o quanto a fome já tinha durado antes de reabrir;
 *   zero em uma fome nova) e `deserted` (quantos aldeões o prazo da deserção já cobrou nela).
 * - Entra `settlement.lastFamine`: a última fome que acabou (quando, quanto durou e quantos
 *   tinha cobrado), para a que reabrir dentro da janela continuar de onde ela parou.
 *
 * O aviso da Torre de Vigia em tempo real (V2G-T3) não mudou a forma: a antecedência é
 * derivada do nível da Torre e do ritmo, e `announcedAtMs` já dizia o que foi anunciado.
 *
 * O passo que sai daqui é o `v12ToV13`, abaixo; a forma da versão 13 está em `v13.ts`.
 */
export const settlementV12Fields: Readonly<Record<string, Shape>> = {
  ...settlementV11Fields,
  famine: nullable(exactObject({ sinceMs: natural, carriedMs: natural, deserted: natural })),
  lastFamine: nullable(exactObject({ endedAtMs: natural, lastedMs: natural, deserted: natural })),
};

export const stateV12Fields: Readonly<Record<string, Shape>> = {
  ...stateV11Fields,
  schemaVersion: literal(12),
  settlement: exactObject(settlementV12Fields),
};

export const stateV12: Shape = exactObject(stateV12Fields);

/**
 * Versão 12 → 13: os contadores de identidade (V3B-T1; ADR 0017, decisão 9).
 *
 * Entra `ids`, vazio: nenhuma entidade com identificador existia, e o contador de cada tipo
 * nasce na primeira entidade dele. Mais nada muda: nenhuma regra em curso, nenhum prazo, nenhum
 * evento, e o gerador fica como está. A partida não muda de comportamento na fronteira.
 *
 * A forma da versão 13 passa a conferir os nomes dos fluxos em `rng` e as quatro palavras de
 * cada um, o que a versão 12 não fazia. Os três fluxos que a v0.2 escreveu passam; um estado da
 * versão 12 com outro nome em `rng`, ou com um fluxo corrompido, é recusado no fim da migração,
 * sem gravar nada por cima.
 */
export const v12ToV13: MigrationStep = {
  from: 12,
  summary: 'entram os contadores de identidade, vazios',
  shape: stateV12,
  migrate(state) {
    return { ...state, schemaVersion: 13, ids: {} };
  },
};
