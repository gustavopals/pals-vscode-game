import {
  exactObject,
  keyedRecordOf,
  listOfLength,
  literal,
  natural,
  type Shape,
  uint32,
} from './shape';
import { stateV12Fields } from './v12';

// Os nomes ficam escritos aqui, como os identificadores das outras versões: a forma de uma
// versão não acompanha `random.ts`, que cresce. O teste confere que hoje as listas coincidem.
// A versão que trouxer um fluxo novo (a Taverna, o Mercado) escreve a lista dela a partir
// destas (`[...RNG_FIXED_STREAMS_V13, 'tavern']`) e monta a guarda com `rngShape`.
export const RNG_FIXED_STREAMS_V13: readonly string[] = ['council', 'morale', 'horde'];
export const RNG_STREAM_FAMILIES_V13: readonly string[] = ['expedition', 'caravan'];

/** Um tipo de entidade: letras, começando por minúscula (a mesma regra de `nextId`). */
const KIND = /^[a-z][A-Za-z]*$/;
/** Um identificador de entidade: `<tipo>-<n>`, com `n` a partir de 1 e sem zeros à esquerda. */
const ENTITY_ID = /^[a-z][A-Za-z]*-[1-9][0-9]*$/;

/** As quatro palavras de um fluxo: inteiros sem sinal de 32 bits, nunca todos zero. */
const streamWords: Shape = (value, path) => {
  const found = listOfLength(4, uint32)(value, path);
  if (found !== null) {
    return found;
  }
  // O xoshiro não sai do estado todo zero: é um fluxo que só devolveria zeros.
  return (value as number[]).some((word) => word !== 0)
    ? null
    : `${path === '' ? 'estado' : path}: esperado um fluxo de sorteio com alguma palavra diferente de zero`;
};

/**
 * A guarda de `rng`: cada chave é um fluxo fixo de `fixed` ou `<família de families>:<tipo>-<n>`,
 * e cada valor são as quatro palavras do fluxo. As versões seguintes a reusam com listas maiores.
 */
export function rngShape(fixed: readonly string[], families: readonly string[]): Shape {
  const accepts = (key: string) => {
    if (fixed.includes(key)) {
      return true;
    }
    const colon = key.indexOf(':');
    return (
      colon > 0 && families.includes(key.slice(0, colon)) && ENTITY_ID.test(key.slice(colon + 1))
    );
  };
  return keyedRecordOf(
    accepts,
    `um de ${fixed.join(', ')}, ou ${families.map((family) => `${family}:<tipo>-<n>`).join(', ')}`,
    streamWords,
  );
}

/** A guarda de `ids`: um contador (inteiro a partir de zero) por tipo de entidade. */
export const idsShape: Shape = keyedRecordOf(
  (key) => KIND.test(key),
  'um tipo de entidade, só letras, começando por minúscula',
  natural,
);

/**
 * O `GameState` da versão 13: o da versão 12 com as identidades e o sorteio por entidade
 * (V3B-T1; ADR 0017, decisão 9).
 *
 * - Entra `ids`: quantos identificadores de cada tipo de entidade já foram dados. Vazio até a
 *   primeira entidade.
 * - `rng` não muda de forma, mas a guarda passa a conferir o que as versões anteriores deixavam
 *   passar: o nome de cada fluxo (um fixo, ou o de uma entidade de uma família conhecida) e as
 *   quatro palavras de 32 bits dele.
 *
 * Quem subir `schemaVersion` para 14 acrescenta aqui o passo `v13ToV14`, com esta forma como
 * entrada, e escreve a forma nova em `v14.ts`.
 */
export const stateV13Fields: Readonly<Record<string, Shape>> = {
  ...stateV12Fields,
  schemaVersion: literal(13),
  rng: rngShape(RNG_FIXED_STREAMS_V13, RNG_STREAM_FAMILIES_V13),
  ids: idsShape,
};

export const stateV13: Shape = exactObject(stateV13Fields);
