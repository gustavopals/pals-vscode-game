import { describe, expect, it } from 'vitest';

import {
  exactObject,
  integer,
  keyedRecordOf,
  listOf,
  literal,
  natural,
  nullable,
  oneOf,
  positive,
  positiveNumber,
  recordOf,
  text,
  uint32,
} from './shape';

describe('guardas de forma', () => {
  it.each([
    ['integer', integer, [0, -3, 9_007_199_254_740_991], [1.5, '1', null, Number.NaN, 2 ** 53]],
    ['natural', natural, [0, 7], [-1, 0.5, '0', undefined]],
    ['positive', positive, [1, 7], [0, -1, 0.5, '1', null]],
    ['positiveNumber', positiveNumber, [0.5, 1, 3], [0, -1, Number.POSITIVE_INFINITY, '3', null]],
    ['text', text, ['', 'Pedra Alta'], [0, null, [], {}]],
    ['literal(false)', literal(false), [false], [true, 0, null, 'false']],
    ['oneOf', oneOf(['farm', 'quarry']), ['farm', 'quarry'], ['mill', 0, null]],
    ['nullable(natural)', nullable(natural), [null, 4], [-4, undefined, 'x']],
    ['listOf(natural)', listOf(natural), [[], [1, 2]], [[1, -2], {}, null, 'lista']],
    ['recordOf(natural)', recordOf(natural), [{}, { a: 1 }], [{ a: -1 }, [], null, 3]],
    ['uint32', uint32, [0, 1, 4_294_967_295], [-1, 4_294_967_296, 0.5, '1', null, Number.NaN]],
    [
      'keyedRecordOf',
      keyedRecordOf((key) => key.startsWith('a'), 'uma chave com a', natural),
      [{}, { a: 1, ab: 2 }],
      [{ b: 1 }, { a: 1, '': 2 }, { a: -1 }, [], null, 3],
    ],
  ])('%s aceita o que deve e recusa o resto', (_, shape, good, bad) => {
    for (const value of good) {
      expect(shape(value, 'campo')).toBeNull();
    }
    for (const value of bad) {
      expect(shape(value, 'campo')).toMatch(/^campo/);
    }
  });

  const villager = exactObject({
    name: text,
    age: natural,
    home: nullable(exactObject({ level: natural })),
  });

  it('exactObject exige exatamente as chaves declaradas', () => {
    expect(villager({ name: 'Ana', age: 30, home: null }, '')).toBeNull();
    expect(villager({ name: 'Ana', age: 30, home: { level: 2 } }, '')).toBeNull();
    expect(villager({ name: 'Ana', age: 30 }, '')).toBe('home: campo ausente');
    expect(villager({ name: 'Ana', age: 30, home: null, horse: true }, 'aldeia.0')).toBe(
      'aldeia.0.horse: campo desconhecido',
    );
    expect(villager([], '')).toBe('estado: esperado objeto, veio lista');
    expect(villager(null, 'aldeia')).toBe('aldeia: esperado objeto, veio null');
  });

  it('o problema traz o caminho completo e o tipo encontrado, nunca o valor', () => {
    expect(villager({ name: 'Ana', age: 30, home: { level: 'térreo' } }, 'aldeia.3')).toBe(
      'aldeia.3.home.level: esperado inteiro a partir de zero, veio texto',
    );
    expect(listOf(villager)([{ name: 'Ana', age: 1.5, home: null }], 'aldeia')).toBe(
      'aldeia.0.age: esperado inteiro a partir de zero, veio número não inteiro',
    );
    expect(recordOf(listOf(integer))({ council: [1, true] }, 'rng')).toBe(
      'rng.council.1: esperado inteiro, veio booleano',
    );
    expect(text(undefined, 'seed')).toBe('seed: esperado texto, veio nada');
  });

  it('para no primeiro problema, na ordem das chaves declaradas', () => {
    expect(villager({ name: 1, age: -1, home: 3 }, '')).toBe('name: esperado texto, veio inteiro');
  });

  it('keyedRecordOf diz a chave recusada no caminho e a regra, e confere os valores das aceitas', () => {
    const shape = keyedRecordOf((key) => key !== 'x', 'qualquer chave menos x', natural);
    expect(shape({ a: 1, x: 2 }, 'ids')).toBe(
      'ids.x: chave fora do esperado (qualquer chave menos x)',
    );
    expect(shape({ a: -1 }, 'ids')).toBe('ids.a: esperado inteiro a partir de zero, veio inteiro');
    expect(shape([], 'ids')).toBe('ids: esperado objeto, veio lista');
  });
});
