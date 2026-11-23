import { describe, expect, it } from 'vitest';

import { goldenView } from '../test-helpers';
import { hexKey } from '../ui/hexmap';
import { hexKeyNav } from './hexNav';

const keys = new Set(goldenView.map.hexes.map((hex) => hexKey(hex.q, hex.r)));

function parseKey(key: string): { q: number; r: number } {
  const [q, r] = key.split(',').map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

describe('navegação por setas na grade hexagonal (workbench/hexNav.ts)', () => {
  it('ArrowRight e ArrowLeft caminham na mesma linha e param nas bordas', () => {
    expect(hexKeyNav(keys, { q: 0, r: 0 }, 'ArrowRight')).toEqual({ focus: '1,0' });
    expect(hexKeyNav(keys, { q: 0, r: 0 }, 'ArrowLeft')).toEqual({ focus: '-1,0' });
    // Na borda leste e oeste, consome a tecla sem sair da grade.
    expect(hexKeyNav(keys, { q: 5, r: 0 }, 'ArrowRight')).toEqual({});
    expect(hexKeyNav(keys, { q: -5, r: 0 }, 'ArrowLeft')).toEqual({});
  });

  it('ArrowUp e ArrowDown sobem e descem sem derivar e são inversas no interior', () => {
    expect(hexKeyNav(keys, { q: 0, r: 0 }, 'ArrowUp')).toEqual({ focus: '0,-1' });
    expect(hexKeyNav(keys, { q: 0, r: -1 }, 'ArrowDown')).toEqual({ focus: '0,0' });
    expect(hexKeyNav(keys, { q: 0, r: 0 }, 'ArrowDown')).toEqual({ focus: '-1,1' });
    expect(hexKeyNav(keys, { q: -1, r: 1 }, 'ArrowUp')).toEqual({ focus: '0,0' });

    // Cinco passos para o norte levam à borda norte (r = -5), exatamente sobre (2, -5).
    let current = { q: 0, r: 0 };
    for (let step = 0; step < 5; step += 1) {
      const next = hexKeyNav(keys, current, 'ArrowUp');
      expect(next?.focus).toBeDefined();
      current = parseKey(next!.focus!);
    }
    expect(current).toEqual({ q: 2, r: -5 });
    // Além da borda norte, para sem quebrar.
    expect(hexKeyNav(keys, current, 'ArrowUp')).toEqual({});

    // Cinco passos para o sul devolvem exatamente à sede (0, 0).
    for (let step = 0; step < 5; step += 1) {
      const next = hexKeyNav(keys, current, 'ArrowDown');
      expect(next?.focus).toBeDefined();
      current = parseKey(next!.focus!);
    }
    expect(current).toEqual({ q: 0, r: 0 });
  });

  it('acompanha as bordas inclinadas ao subir ou descer pelos cantos', () => {
    // Em (-5, 0), (-5, -1) está fora do raio 5, mas (-4, -1) está dentro.
    expect(hexKeyNav(keys, { q: -5, r: 0 }, 'ArrowUp')).toEqual({ focus: '-4,-1' });
    // Em (5, 0), (4, 1) está dentro.
    expect(hexKeyNav(keys, { q: 5, r: 0 }, 'ArrowDown')).toEqual({ focus: '4,1' });
  });

  it('alcança todos os 91 hexágonos da grade só com as quatro setas a partir de (0, 0)', () => {
    const visited = new Set<string>(['0,0']);
    const queue = ['0,0'];
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
    while (queue.length > 0) {
      const current = parseKey(queue.shift()!);
      for (const arrow of arrows) {
        const next = hexKeyNav(keys, current, arrow)?.focus;
        if (next !== undefined && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    expect(visited.size).toBe(91);
  });

  it('Home volta à sede; Enter e espaço acionam o hexágono; outras teclas devolvem null', () => {
    expect(hexKeyNav(keys, { q: 2, r: -5 }, 'Home')).toEqual({ focus: '0,0' });
    expect(hexKeyNav(keys, { q: 1, r: 0 }, 'Enter')).toEqual({ activate: '1,0' });
    expect(hexKeyNav(keys, { q: 1, r: 0 }, ' ')).toEqual({ activate: '1,0' });
    for (const ignored of ['Tab', 'Escape', 'F1', 'a', 'PageDown']) {
      expect(hexKeyNav(keys, { q: 0, r: 0 }, ignored)).toBeNull();
    }
  });

  it('grade vazia ou foco ausente são tratados com segurança', () => {
    expect(hexKeyNav(new Set(), { q: 0, r: 0 }, 'ArrowRight')).toBeNull();
    expect(hexKeyNav(keys, null, 'ArrowRight')).toEqual({ focus: '0,0' });
    expect(hexKeyNav(keys, { q: 99, r: 99 }, 'Home')).toEqual({ focus: '0,0' });
    expect(hexKeyNav(keys, null, 'Enter')).toEqual({});
    expect(hexKeyNav(new Set(['2,3']), null, 'ArrowDown')).toEqual({ focus: '2,3' });
  });
});
