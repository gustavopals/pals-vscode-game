import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { applyCommand } from './commands';
import { nextId } from './ids';
import { currentShape } from './migrations';
import { dropStream, entityStream, nextInt, RNG_STREAM_FAMILIES } from './random';
import { cloneState } from './state';
import { command, gameWith, HOUR, newGame } from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameState } from './types';
import { deriveViewState } from './view';

const throughBank = (state: GameState) => JSON.parse(JSON.stringify(state)) as GameState;

describe('nextId', () => {
  it('uma partida nova não tem contador nenhum', () => {
    expect(newGame().ids).toEqual({});
  });

  it('devolve `<tipo>-<n>`, a partir de 1, com um contador por tipo', () => {
    const state = newGame();
    expect(nextId(state, 'hero')).toBe('hero-1');
    expect(nextId(state, 'hero')).toBe('hero-2');
    expect(nextId(state, 'expedition')).toBe('expedition-1');
    expect(nextId(state, 'hero')).toBe('hero-3');
    expect(nextId(state, 'masterBuilder')).toBe('masterBuilder-1');
    expect(state.ids).toEqual({ hero: 3, expedition: 1, masterBuilder: 1 });
  });

  it('só mexe no contador do próprio tipo, e não gasta sorteio nenhum', () => {
    const state = newGame();
    nextId(state, 'caravan');
    nextInt(state, 'council', 6);
    const before = cloneState(state);
    nextId(state, 'hero');
    expect({ ...state, ids: {} }).toStrictEqual({ ...before, ids: {} });
    expect(state.ids).toEqual({ caravan: 1, hero: 1 });
    expect(state.rng).toStrictEqual(before.rng);
  });

  it('não depende da semente, do relógio nem do ritmo: só de quantos já foram dados', () => {
    const one = newGame('uma-semente');
    const other = gameWith((draft) => {
      draft.seed = 'outra-semente';
      draft.lastProcessedAt = 77 * HOUR;
      draft.settings.timeScale = 0.5;
    });
    for (let index = 0; index < 5; index += 1) {
      expect(nextId(other, 'item')).toBe(nextId(one, 'item'));
    }
  });

  it('o estado com contadores continua na forma da versão gravada', () => {
    const state = newGame();
    for (const kind of ['hero', 'expedition', 'item', 'caravan', 'master']) {
      nextId(state, kind);
      nextId(state, kind);
    }
    expect(currentShape(throughBank(state), '')).toBeNull();
  });

  it('salvar e recarregar no meio continua a contagem', () => {
    let state = newGame();
    const got: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      got.push(nextId(state, 'hero'));
      state = throughBank(state);
    }
    expect(got).toEqual(['hero-1', 'hero-2', 'hero-3', 'hero-4', 'hero-5', 'hero-6']);
  });

  it('o identificador de uma entidade que terminou não volta, com o fluxo dela apagado ou não', () => {
    const state = newGame();
    const first = nextId(state, 'expedition');
    nextInt(state, entityStream('expedition', first), 6);
    dropStream(state, entityStream('expedition', first));
    expect(state.rng).toEqual({});
    expect(nextId(state, 'expedition')).toBe('expedition-2');
    expect(state.ids).toEqual({ expedition: 2 });
  });

  it.each(['', 'Hero', 'hero-1', 'hero 1', 'hero:1', 'hero_1', '1hero', 'herói', '__proto__'])(
    'um tipo fora da forma lança erro e não cria contador: "%s"',
    (kind) => {
      const state = newGame();
      expect(() => nextId(state, kind)).toThrow(`Tipo de entidade inválido: ${kind}.`);
      expect(Object.keys(state.ids)).toEqual([]);
    },
  );

  it('um tipo com nome de propriedade herdada conta do zero como qualquer outro', () => {
    const state = newGame();
    expect(nextId(state, 'constructor')).toBe('constructor-1');
    expect(nextId(state, 'toString')).toBe('toString-1');
    expect(nextId(state, 'constructor')).toBe('constructor-2');
  });

  it.each([
    ['negativo', -1],
    ['quebrado', 1.5],
    ['fora dos inteiros seguros', 2 ** 53],
    ['em texto', '3'],
    ['nulo', null],
  ])('recusa um contador gravado %s em vez de recomeçar do um', (_, stored) => {
    const state = gameWith((draft) => {
      (draft.ids as Record<string, unknown>).hero = stored;
    });
    expect(() => nextId(state, 'hero')).toThrow('Contador de identidades corrompido: hero.');
    expect(state.ids.hero).toBe(stored);
  });
});

describe('um identificador nunca se repete', () => {
  // Uma vida qualquer de entidades: nascer, sortear, terminar (com o fluxo apagado) e passar
  // pelo banco, em qualquer ordem, com tipos misturados. Só os tipos que são família de fluxo
  // sorteiam (o tipo da entidade é a família); os outros só gastam o contador.
  const kinds = ['hero', 'expedition', 'item', 'caravan'] as const;
  const step = fc.oneof(
    fc.record({ op: fc.constant('create' as const), kind: fc.constantFrom(...kinds) }),
    fc.record({ op: fc.constant('draw' as const), pick: fc.nat(1000) }),
    fc.record({ op: fc.constant('end' as const), pick: fc.nat(1000) }),
    fc.record({ op: fc.constant('save' as const) }),
  );

  it('nem depois de salvar e recarregar, nem depois de a entidade terminar e o fluxo dela ser apagado', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.array(step, { minLength: 1, maxLength: 120 }),
        (seed, steps) => {
          let state = newGame(seed);
          const given: string[] = [];
          const opened: string[] = [];
          let alive: Array<{ id: string; stream: ReturnType<typeof entityStream> }> = [];
          for (const current of steps) {
            if (current.op === 'create') {
              const id = nextId(state, current.kind);
              given.push(id);
              const family = RNG_STREAM_FAMILIES.find((name) => name === current.kind);
              if (family !== undefined) {
                const stream = entityStream(family, id);
                opened.push(stream);
                alive.push({ id, stream });
              }
            } else if (current.op === 'save') {
              state = throughBank(state);
            } else if (alive.length > 0) {
              const entity = alive[current.pick % alive.length];
              if (entity === undefined) {
                continue;
              }
              if (current.op === 'draw') {
                nextInt(state, entity.stream, 1000);
              } else {
                dropStream(state, entity.stream);
                alive = alive.filter((other) => other !== entity);
              }
            }
          }
          // Nenhum identificador e nenhum nome de fluxo saiu duas vezes.
          expect(new Set(given).size).toBe(given.length);
          expect(new Set(opened).size).toBe(opened.length);
          // O contador de cada tipo é quantos foram dados, vivos ou não.
          for (const kind of kinds) {
            const count = given.filter((id) => id.startsWith(`${kind}-`)).length;
            expect(state.ids[kind] ?? 0).toBe(count);
          }
          // No estado só ficam os fluxos de quem ainda vive (e sorteou): o tamanho tem teto.
          const living = new Set(alive.map((entity) => entity.stream as string));
          for (const stream of Object.keys(state.rng)) {
            expect(living.has(stream)).toBe(true);
          }
          expect(currentShape(throughBank(state), '')).toBeNull();
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('quem não cria identidades', () => {
  const used = () => {
    const state = newGame();
    nextId(state, 'hero');
    return state;
  };

  it('deriveViewState não cria, não muda o estado e não mostra os contadores', () => {
    const state = used();
    const frozen = JSON.stringify(state);
    const view = deriveViewState(state, state.lastProcessedAt);
    deriveViewState(state, state.lastProcessedAt);
    expect(JSON.stringify(state)).toBe(frozen);
    expect(Object.keys(view)).not.toContain('ids');
    expect(JSON.stringify(view)).not.toContain('"ids"');
  });

  it('nextEventAt não cria', () => {
    const state = used();
    const frozen = JSON.stringify(state);
    nextEventAt(state);
    expect(JSON.stringify(state)).toBe(frozen);
  });

  it('nenhuma ordem de hoje cria entidade: aceita ou recusada, os contadores ficam como estão', () => {
    const state = used();
    const accepted = applyCommand(state, command('setWorkers', { building: 'farm', count: 2 }), 0);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.state.ids).toEqual(state.ids);
    }
    const refused = applyCommand(state, command('recruitVillagers', { quantity: 99 }), 0);
    expect(refused.ok).toBe(false);
    expect(state.ids).toEqual({ hero: 1 });
  });
});
