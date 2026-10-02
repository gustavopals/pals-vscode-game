import { describe, expect, it } from 'vitest';

import {
  exactObject,
  integer,
  listOf,
  literal,
  natural,
  nullable,
  oneOf,
  positiveNumber,
  recordOf,
  text,
} from './shape';

describe('guardas de forma', () => {
  it.each([
    ['integer', integer, [0, -3, 9_007_199_254_740_991], [1.5, '1', null, Number.NaN, 2 ** 53]],
    ['natural', natural, [0, 7], [-1, 0.5, '0', undefined]],
    ['positiveNumber', positiveNumber, [0.5, 1, 3], [0, -1, Number.POSITIVE_INFINITY, '3', null]],
    ['text', text, ['', 'Pedra Alta'], [0, null, [], {}]],
    ['literal(false)', literal(false), [false], [true, 0, null, 'false']],
    ['oneOf', oneOf(['farm', 'quarry']), ['farm', 'quarry'], ['mill', 0, null]],
    ['nullable(natural)', nullable(natural), [null, 4], [-4, undefined, 'x']],
    ['listOf(natural)', listOf(natural), [[], [1, 2]], [[1, -2], {}, null, 'lista']],
    ['recordOf(natural)', recordOf(natural), [{}, { a: 1 }], [{ a: -1 }, [], null, 3]],
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
});
