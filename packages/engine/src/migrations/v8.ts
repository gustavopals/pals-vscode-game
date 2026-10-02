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
import { stateV7Fields } from './v7';

/**
 * O `GameState` da versão 8: o da versão 7 com o Conselho do Feudo (V2D-T1). Entra `council`:
 * as cartas na mesa, as flags, as cartas vistas no ano, o próximo sorteio, as continuações
 * agendadas, os efeitos escondidos à espera e as ocorrências que expiraram no ano.
 *
 * Os ids de carta, de opção e de flag são texto livre: o catálogo é conteúdo e cresce sem a
 * forma do estado mudar. Uma carta que o catálogo já não tem sai da mesa sem efeito.
 *
 * Quem subir `schemaVersion` para 9 acrescenta aqui o passo `v8ToV9`, com esta forma como
 * entrada, e escreve a forma nova em `v9.ts`.
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
