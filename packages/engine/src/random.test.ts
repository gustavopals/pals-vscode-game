import { describe, expect, it } from 'vitest';

import { applyCommand } from './commands';
import { currentShape } from './migrations';
import {
  chance,
  hashText,
  nextInt,
  nextUint32,
  pickWeighted,
  RNG_STREAMS,
  RNG_VERSION,
  seedStream,
  type StreamWords,
  utf8Bytes,
} from './random';
import { cloneState } from './state';
import { command, gameWith, HOUR, newGame } from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameState } from './types';
import { deriveViewState } from './view';

const UINT32_RANGE = 2 ** 32;

const take = <T>(count: number, draw: () => T): T[] => Array.from({ length: count }, draw);

/** Os próximos valores crus de um fluxo, sem tocar no estado da partida. */
function rawValues(state: GameState, stream: (typeof RNG_STREAMS)[number], count: number) {
  const words = [...(state.rng[stream] ?? seedStream(state.seed, stream))] as StreamWords;
  return take(count, () => nextUint32(words));
}

describe(`algoritmo, versão ${RNG_VERSION}`, () => {
  it('xoshiro128**: bate com a implementação de referência a partir do estado [1, 2, 3, 4]', () => {
    // Saídas do xoshiro128starstar.c de Blackman e Vigna para esse estado; são os mesmos
    // valores do teste do gerador no pacote rand_xoshiro (Rust).
    const words: StreamWords = [1, 2, 3, 4];
    expect(take(10, () => nextUint32(words))).toEqual([
      11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849, 3729100597,
      4258142804,
    ]);
    expect(words).toEqual([939045227, 1864939416, 1451579149, 2199351389]);
  });

  it('as saídas e o estado ficam sempre em inteiros sem sinal de 32 bits', () => {
    const words = seedStream('pedra-alta', 'council');
    for (let index = 0; index < 5000; index += 1) {
      const value = nextUint32(words);
      for (const number of [value, ...words]) {
        expect(Number.isInteger(number) && number >= 0 && number < UINT32_RANGE).toBe(true);
      }
    }
  });

  it('FNV-1a de 32 bits: bate com os vetores publicados', () => {
    expect(hashText('')).toBe(0x811c9dc5);
    expect(hashText('a')).toBe(0xe40c292c);
    expect(hashText('foobar')).toBe(0xbf9cf968);
  });

  it('o hash lê o texto em UTF-8, de um a quatro bytes por símbolo', () => {
    expect(utf8Bytes('a')).toEqual([0x61]);
    expect(utf8Bytes('ç')).toEqual([0xc3, 0xa7]);
    expect(utf8Bytes('€')).toEqual([0xe2, 0x82, 0xac]);
    expect(utf8Bytes('😀')).toEqual([0xf0, 0x9f, 0x98, 0x80]);
    expect(utf8Bytes('São João')).toHaveLength(10);
    // Metade de um par substituto: codificada como veio, sem lançar.
    expect(utf8Bytes('\ud83d')).toEqual([0xed, 0xa0, 0xbd]);
  });

  it('a semente de um fluxo é o hash de `seed:nome` passado pelo SplitMix32', () => {
    expect(hashText('pedra-alta:council')).toBe(811871857);
    expect(seedStream('pedra-alta', 'council')).toEqual([
      1682820118, 4203958270, 2050757704, 2151606881,
    ]);
    expect(seedStream('pedra-alta', 'morale')).toEqual([
      1213412695, 728141499, 1485401539, 4270072228,
    ]);
    expect(seedStream('pedra-alta', 'horde')).toEqual([
      4287171725, 3739822120, 3393011647, 3412008400,
    ]);
  });

  it('vetores gravados: as primeiras saídas de cada fluxo da semente "pedra-alta"', () => {
    // Se um destes valores mudar, mudou o futuro de toda partida em andamento.
    const first = (stream: string) => {
      const words = seedStream('pedra-alta', stream);
      return take(6, () => nextUint32(words));
    };
    expect(first('council')).toEqual([
      4068988674, 3931345436, 3509811487, 100472977, 1758275050, 3532483218,
    ]);
    expect(first('morale')).toEqual([
      2206954316, 416490045, 1236426077, 1705857203, 2039034777, 3652580625,
    ]);
    expect(first('horde')).toEqual([
      2114422165, 2934033324, 3435048640, 689405396, 3906919482, 1955251143,
    ]);
  });

  it('vetores gravados: dado, chance e sorteio ponderado da semente "pedra-alta"', () => {
    const state = newGame('pedra-alta');
    expect(take(12, () => nextInt(state, 'council', 6) + 1)).toEqual([
      1, 3, 2, 2, 5, 1, 4, 1, 2, 5, 3, 3,
    ]);
    expect(take(12, () => chance(state, 'horde', { num: 1, den: 4 }))).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    const cards = [
      { weight: 3, id: 'a' },
      { weight: 0, id: 'b' },
      { weight: 1, id: 'c' },
    ];
    expect(take(12, () => pickWeighted(state, 'morale', cards)?.id).join('')).toBe('aaacaaacaaaa');
    expect(state.rng).toEqual({
      council: [2983445260, 1587206078, 3476825471, 3572094793],
      horde: [280398987, 4204546692, 3938821804, 2578730403],
      morale: [66990336, 2797442201, 774675091, 2365429762],
    });
  });

  it('a mesma semente dá a mesma sequência; outra semente, outra sequência', () => {
    const rolls = (seed: string) => {
      const state = newGame(seed);
      return take(50, () => nextInt(state, 'council', 1000));
    };
    expect(rolls('feudo-a')).toEqual(rolls('feudo-a'));
    expect(rolls('feudo-a')).not.toEqual(rolls('feudo-b'));
  });
});

describe('nextInt', () => {
  it('cria o fluxo na primeira chamada, a partir da semente da partida', () => {
    const state = newGame('pedra-alta');
    expect(state.rng).toEqual({});
    const expected = seedStream('pedra-alta', 'council');
    const value = nextUint32(expected) % 100;

    expect(nextInt(state, 'council', 100)).toBe(value);
    expect(Object.keys(state.rng)).toEqual(['council']);
    expect(state.rng.council).toEqual(expected);
  });

  it('devolve sempre um inteiro em [0, max)', () => {
    const state = newGame();
    for (const max of [1, 2, 3, 7, 100, 1000, 65_537, 2 ** 31, 2 ** 32 - 1, 2 ** 32]) {
      for (let index = 0; index < 200; index += 1) {
        const value = nextInt(state, 'morale', max);
        expect(Number.isInteger(value) && value >= 0 && value < max).toBe(true);
      }
    }
  });

  it('com max 2^32 devolve o valor cru do gerador', () => {
    const state = newGame('cru');
    const raw = rawValues(state, 'horde', 5);
    expect(take(5, () => nextInt(state, 'horde', 2 ** 32))).toEqual(raw);
  });

  it('descarta os valores que dariam viés e sorteia de novo (rejeição)', () => {
    // Com max = 2^31 + 1 só cabe um múltiplo em 2^32: quase metade dos valores crus é recusada.
    const max = 2 ** 31 + 1;
    const state = newGame('rejeição');
    const raw = rawValues(state, 'council', 12);
    expect(raw.filter((value) => value >= max).length).toBeGreaterThan(3);

    const accepted = raw.filter((value) => value < max).slice(0, 4);
    expect(take(4, () => nextInt(state, 'council', max))).toEqual(accepted);
    // O fluxo andou por todos os valores crus até o quarto aceito, recusados incluídos.
    const consumed = raw.indexOf(accepted[3] as number) + 1;
    const words = seedStream('rejeição', 'council');
    take(consumed, () => nextUint32(words));
    expect(state.rng.council).toEqual(words);
  });

  it('cada face de um dado sai com a mesma frequência', () => {
    const state = newGame('dados');
    const counts = [0, 0, 0, 0, 0, 0];
    for (let index = 0; index < 60_000; index += 1) {
      const face = nextInt(state, 'council', 6);
      counts[face] = (counts[face] ?? 0) + 1;
    }
    for (const count of counts) {
      expect(Math.abs(count - 10_000)).toBeLessThan(300);
    }
  });

  it('gasta o fluxo mesmo quando só há um resultado possível', () => {
    const state = newGame();
    const [first, second] = rawValues(state, 'council', 2);
    expect(nextInt(state, 'council', 1)).toBe(0);
    expect(nextInt(state, 'council', 2 ** 32)).toBe(second);
    expect(first).not.toBe(second);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32 + 1])(
    'recusa o limite %s sem tocar no estado',
    (max) => {
      const state = newGame();
      expect(() => nextInt(state, 'council', max)).toThrow('Limite de sorteio inválido');
      expect(state.rng).toEqual({});
    },
  );
});

describe('chance', () => {
  it('é a comparação de um inteiro sorteado em [0, den) com num', () => {
    const state = newGame('chances');
    const mirror = cloneState(state);
    for (let index = 0; index < 500; index += 1) {
      const ratio = { num: index % 11, den: 10 };
      expect(chance(state, 'morale', ratio)).toBe(nextInt(mirror, 'morale', 10) < ratio.num);
    }
    expect(state.rng).toEqual(mirror.rng);
  });

  it('zero nunca acontece, o inteiro sempre, e os dois gastam o fluxo', () => {
    const state = newGame();
    const fresh = seedStream(state.seed, 'horde');
    expect(take(200, () => chance(state, 'horde', { num: 0, den: 100 }))).not.toContain(true);
    expect(take(200, () => chance(state, 'horde', { num: 100, den: 100 }))).not.toContain(false);
    expect(take(200, () => chance(state, 'horde', { num: 150, den: 100 }))).not.toContain(false);
    expect(state.rng.horde).not.toEqual(fresh);
  });

  it('uma chance de 1 em 4 acontece perto de um quarto das vezes', () => {
    const state = newGame('dados');
    const hits = take(40_000, () => chance(state, 'horde', { num: 1, den: 4 })).filter(Boolean);
    expect(Math.abs(hits.length - 10_000)).toBeLessThan(300);
  });

  it.each([
    { num: -1, den: 4 },
    { num: 1, den: 0 },
    { num: 0.5, den: 2 },
    { num: 1, den: 2.5 },
    { num: Number.NaN, den: 2 },
  ])('recusa a chance $num/$den sem tocar no estado', (ratio) => {
    const state = newGame();
    expect(() => chance(state, 'horde', ratio)).toThrow('Chance inválida');
    expect(state.rng).toEqual({});
  });
});

describe('pickWeighted', () => {
  const cards = [
    { weight: 3, id: 'comum' },
    { weight: 0, id: 'fora' },
    { weight: 1, id: 'rara' },
  ];

  it('devolve o próprio item da lista, na proporção dos pesos', () => {
    const state = newGame('dados');
    const counts: Record<string, number> = {};
    for (let index = 0; index < 40_000; index += 1) {
      const picked = pickWeighted(state, 'council', cards);
      expect(cards).toContain(picked);
      const id = picked?.id ?? 'nada';
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(['comum', 'rara']);
    expect(Math.abs((counts.comum ?? 0) - 30_000)).toBeLessThan(500);
    expect(Math.abs((counts.rara ?? 0) - 10_000)).toBeLessThan(500);
  });

  it('é um sorteio só: o inteiro em [0, soma dos pesos) cai na faixa do item', () => {
    const state = newGame('faixas');
    const mirror = cloneState(state);
    for (let index = 0; index < 200; index += 1) {
      const roll = nextInt(mirror, 'council', 4);
      expect(pickWeighted(state, 'council', cards)?.id).toBe(roll < 3 ? 'comum' : 'rara');
    }
    expect(state.rng).toEqual(mirror.rng);
  });

  it('lista vazia ou só com pesos zero devolve null e não gasta nem cria o fluxo', () => {
    const state = newGame();
    expect(pickWeighted(state, 'council', [])).toBeNull();
    expect(pickWeighted(state, 'council', [{ weight: 0 }, { weight: 0 }])).toBeNull();
    expect(state.rng).toEqual({});

    nextInt(state, 'council', 10);
    const before = cloneState(state).rng;
    expect(pickWeighted(state, 'council', [])).toBeNull();
    expect(pickWeighted(state, 'council', [{ weight: 0 }])).toBeNull();
    expect(state.rng).toEqual(before);
  });

  it('com um único item possível ele sai sempre, e o fluxo anda', () => {
    const state = newGame();
    const only = [
      { weight: 0, id: 'fora' },
      { weight: 7, id: 'única' },
    ];
    const [, second] = rawValues(state, 'council', 2);
    expect(pickWeighted(state, 'council', only)?.id).toBe('única');
    expect(nextInt(state, 'council', 2 ** 32)).toBe(second);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'recusa o peso %s sem tocar no estado',
    (weight) => {
      const state = newGame();
      expect(() => pickWeighted(state, 'council', [{ weight: 2 }, { weight }])).toThrow(
        'Peso de sorteio inválido',
      );
      expect(state.rng).toEqual({});
    },
  );
});

describe('fluxos nomeados', () => {
  it('os fluxos da v0.2 são o Conselho, a moral e a Horda', () => {
    expect(RNG_STREAMS).toEqual(['council', 'morale', 'horde']);
  });

  it('sortear em um fluxo não desloca os outros', () => {
    const alone = newGame('independência');
    const councilAlone = take(40, () => nextInt(alone, 'council', 1000));

    const mixed = newGame('independência');
    const councilMixed: number[] = [];
    for (let index = 0; index < 40; index += 1) {
      take(index % 5, () => chance(mixed, 'morale', { num: 1, den: 2 }));
      councilMixed.push(nextInt(mixed, 'council', 1000));
      take(index % 3, () => nextInt(mixed, 'horde', 6));
    }
    expect(councilMixed).toEqual(councilAlone);
    expect(mixed.rng.council).toEqual(alone.rng.council);
    expect(Object.keys(alone.rng)).toEqual(['council']);
  });

  it('cada fluxo tem a sua sequência', () => {
    const state = newGame('independência');
    const sequences = RNG_STREAMS.map((stream) =>
      take(20, () => nextInt(state, stream, 1000)).join(','),
    );
    expect(new Set(sequences).size).toBe(RNG_STREAMS.length);
  });

  it('salvar e recarregar no meio continua a mesma sequência', () => {
    const straight = newGame('salvo');
    const expected = take(10, () => nextInt(straight, 'council', 1000));

    let saved = newGame('salvo');
    const got: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      got.push(nextInt(saved, 'council', 1000));
      saved = JSON.parse(JSON.stringify(saved)) as GameState;
    }
    expect(got).toEqual(expected);
    expect(saved).toStrictEqual(straight);
  });

  it('o estado com fluxos em uso continua na forma da versão gravada', () => {
    const state = newGame();
    for (const stream of RNG_STREAMS) {
      take(30, () => nextInt(state, stream, 6));
    }
    expect(currentShape(state, '')).toBeNull();
    for (const words of Object.values(state.rng)) {
      expect(words).toHaveLength(4);
    }
  });

  it('só mexe no estado do próprio fluxo', () => {
    const state = newGame();
    nextInt(state, 'morale', 6);
    const before = cloneState(state);
    nextInt(state, 'council', 6);
    chance(state, 'council', { num: 1, den: 2 });
    pickWeighted(state, 'council', [{ weight: 1 }, { weight: 2 }]);
    expect({ ...state, rng: {} }).toStrictEqual({ ...before, rng: {} });
    expect(state.rng.morale).toEqual(before.rng.morale);
    expect(state.rng.council).not.toEqual(before.rng.council);
  });

  it.each([
    ['com três números', [1, 2, 3]],
    ['com cinco números', [1, 2, 3, 4, 5]],
    ['todo em zero', [0, 0, 0, 0]],
    ['com número negativo', [1, -2, 3, 4]],
    ['com número fora dos 32 bits', [1, 2, 2 ** 32, 4]],
    ['com número quebrado', [1, 2.5, 3, 4]],
  ])('recusa um fluxo gravado %s em vez de recomeçar da semente', (_, words) => {
    const state = gameWith((draft) => {
      draft.rng.council = words;
    });
    expect(() => nextInt(state, 'council', 6)).toThrow('Fluxo de sorteio corrompido: council.');
    expect(state.rng.council).toEqual(words);
  });
});

describe('quem não sorteia', () => {
  /** Um feudo com os três fluxos já em uso, com números fáceis de achar em um JSON. */
  const withStreams = () => {
    const state = newGame('pedra-alta');
    for (const stream of RNG_STREAMS) {
      nextInt(state, stream, 6);
    }
    return state;
  };

  it('deriveViewState não sorteia, não muda o estado e não mostra o gerador', () => {
    const state = withStreams();
    const frozen = JSON.stringify(state);

    for (const at of [state.lastProcessedAt, 5 * HOUR, 30 * 24 * HOUR]) {
      const view = JSON.stringify(deriveViewState(state, at));
      expect(view).not.toContain('"rng"');
      for (const words of Object.values(state.rng)) {
        for (const word of words) {
          expect(view).not.toContain(String(word));
        }
      }
    }
    expect(JSON.stringify(state)).toBe(frozen);
  });

  it('nextEventAt não sorteia', () => {
    const state = withStreams();
    const frozen = JSON.stringify(state);
    nextEventAt(state);
    expect(JSON.stringify(state)).toBe(frozen);
  });

  it('uma ordem aceita não sorteia e uma recusada não muda nada', () => {
    let state = withStreams();
    const orders = [
      command('setWorkers', { building: 'farm', count: 2 }),
      command('startConstruction', { building: 'housing' }),
      command('startConstruction', { building: 'farm' }),
      command('recruitVillagers', { quantity: 3 }),
      command('planConstruction', { building: 'quarry' }),
      command('recruitVillagers', { quantity: 999 }),
      command('cancelConstruction', { building: 'housing' }),
      command('unplanConstruction', { building: 'quarry' }),
      command('renameSettlement', { name: 'Pedra Baixa' }),
      command('renameSettlement', { name: '' }),
    ];
    const outcomes: boolean[] = [];
    for (const order of orders) {
      const frozen = JSON.stringify(state);
      const result = applyCommand(state, order, state.lastProcessedAt);
      expect(JSON.stringify(state)).toBe(frozen);
      outcomes.push(result.ok);
      if (result.ok) {
        expect(result.state.rng).toStrictEqual(state.rng);
        state = result.state;
      }
    }
    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });
});
