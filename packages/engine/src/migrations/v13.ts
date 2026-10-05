import {
  exactObject,
  keyedRecordOf,
  listOfLength,
  literal,
  natural,
  type Shape,
  uint32,
} from './shape';
import type { MigrationStep } from './step';
import { stateV12Fields } from './v12';

// Os nomes ficam escritos aqui, como os identificadores das outras versões: a forma de uma
// versão não acompanha `random.ts`, que cresce. O teste confere que hoje as listas coincidem.
// A versão que trouxer um fluxo novo (a Taverna, o Mercado) escreve a lista dela a partir
// destas (`[...RNG_FIXED_STREAMS_V13, 'tavern']`) e monta a guarda com `rngShape`.
export const RNG_FIXED_STREAMS_V13: readonly string[] = ['council', 'morale', 'horde'];
export const RNG_STREAM_FAMILIES_V13: readonly string[] = ['expedition', 'caravan'];

/** Um tipo de entidade: letras, começando por minúscula (a mesma regra de `nextId`). */
const KIND = /^[a-z][A-Za-z]*$/;
/** O número de um identificador: a partir de 1, sem zeros à esquerda. */
const ENTITY_NUMBER = /^[1-9][0-9]*$/;

/**
 * As partes da chave de um fluxo de entidade, ou `null` se a chave não é uma:
 * `<família>:<família>-<n>`, com o tipo da entidade igual à família e `n` inteiro seguro.
 */
function entityKey(
  key: string,
  families: readonly string[],
): { family: string; number: number } | null {
  const colon = key.indexOf(':');
  const family = key.slice(0, Math.max(colon, 0));
  if (colon <= 0 || !families.includes(family) || !key.startsWith(`${family}-`, colon + 1)) {
    return null;
  }
  const digits = key.slice(colon + family.length + 2);
  const number = Number(digits);
  return ENTITY_NUMBER.test(digits) && Number.isSafeInteger(number) ? { family, number } : null;
}

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
 * A guarda de `rng`: cada chave é um fluxo fixo de `fixed` ou `<família>:<família>-<n>`, com a
 * família em `families`, e cada valor são as quatro palavras do fluxo. As versões seguintes a
 * reusam com listas maiores. Se `n` cabe no contador de `ids` é conferência de dois campos:
 * fica em `rngWithinIds`.
 */
export function rngShape(fixed: readonly string[], families: readonly string[]): Shape {
  return keyedRecordOf(
    (key) => fixed.includes(key) || entityKey(key, families) !== null,
    `um de ${fixed.join(', ')}, ou ${families.map((family) => `${family}:${family}-<n>`).join(', ')}`,
    streamWords,
  );
}

/**
 * A conferência cruzada de `rng` com `ids`, que uma guarda de campo não alcança: todo fluxo de
 * entidade é de um identificador que `nextId` já deu, isto é, `1 ≤ n ≤ ids[família]`. Um fluxo
 * além do contador gastaria de antemão a sorte de uma entidade futura. Roda **depois** da forma
 * dos campos, sobre o estado inteiro; as versões seguintes a reusam com as famílias delas.
 */
export function rngWithinIds(families: readonly string[]): Shape {
  return (value, path) => {
    const { rng, ids } = value as { rng: Record<string, unknown>; ids: Record<string, number> };
    for (const key of Object.keys(rng)) {
      const entity = entityKey(key, families);
      if (entity === null) {
        continue;
      }
      const issued = Object.hasOwn(ids, entity.family) ? (ids[entity.family] as number) : 0;
      if (entity.number > issued) {
        const where = path === '' ? `rng.${key}` : `${path}.rng.${key}`;
        return `${where}: fluxo de uma entidade além do contador de ids.${entity.family}`;
      }
    }
    return null;
  };
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
 * - A forma do estado inteiro confere `rng` contra `ids` (`rngWithinIds`): nenhum fluxo de
 *   entidade além do contador da família.
 *
 * O passo que sai daqui é o `v13ToV14`, abaixo; a forma da versão 14 está em `v14.ts`.
 */
export const stateV13Fields: Readonly<Record<string, Shape>> = {
  ...stateV12Fields,
  schemaVersion: literal(13),
  rng: rngShape(RNG_FIXED_STREAMS_V13, RNG_STREAM_FAMILIES_V13),
  ids: idsShape,
};

const stateV13Form: Shape = exactObject(stateV13Fields);
const stateV13Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV13: Shape = (value, path) =>
  stateV13Form(value, path) ?? stateV13Streams(value, path);

/**
 * Versão 13 → 14: os heróis no feudo e o soldo em atraso (V3C-T1; ADR 0017, decisões 3 e 5).
 *
 * Entra `guild`, vazio: nenhum herói, nenhum atraso aberto e nenhum registro de atraso fechado.
 * Nenhuma partida tinha herói, então ninguém passa a dever soldo na fronteira: o ouro continua
 * sem consumo nenhum, e o saldo de ninguém muda. O passo não cria prazo, não emite evento, não
 * dá identificador a ninguém e não toca o gerador; a partida não muda de comportamento.
 */
export const v13ToV14: MigrationStep = {
  from: 13,
  summary: 'entra a guilda, vazia: nenhum herói e nenhum soldo em atraso',
  shape: stateV13,
  migrate(state) {
    return {
      ...state,
      schemaVersion: 14,
      guild: { heroes: [], wageArrears: null, lastWageArrears: null },
    };
  },
};
