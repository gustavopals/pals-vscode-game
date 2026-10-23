import { WING_IDS, type HordeUnitId, type UnitId, type WingId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import type { BattleInput, BattlePosts } from './battle';
import { buildBattleReport } from './battleReport';
import { fightBattle } from './battleTurn';
import { cloneState } from './state';
import { newGame } from './test-helpers';
import { previewBattle, previewRun, type EnemyGuessPosts, type PreviewInput } from './warCouncil';

// O motor compila sem as bibliotecas do ambiente (`types: []`); o Vitest roda em Node.
declare const performance: { now(): number };

const noCommanders = { left: null, center: null, right: null };

const knownEnemy = (spec: Partial<Record<WingId, [HordeUnitId, number]>>): EnemyGuessPosts => {
  const post = (wing: WingId) => {
    const entry = spec[wing];
    return entry === undefined ? null : { kind: 'known' as const, unit: entry[0], count: entry[1] };
  };
  return {
    left: { front: post('left'), back: null },
    center: { front: post('center'), back: null },
    right: { front: post('right'), back: null },
  };
};

/** Seis postos cheios: Lanceiros ou Escudeiros na Frente, Arqueiros atrás. */
const fullPlayer = (count: number): PreviewInput['player'] => {
  const fronts = { left: 'spearman', center: 'shieldbearer', right: 'spearman' } as const;
  const wing = (w: WingId) => ({
    front: { unit: fronts[w] as UnitId, count },
    back: { unit: 'archer' as UnitId, count },
  });
  return {
    posts: { left: wing('left'), center: wing('center'), right: wing('right') },
    commanders: noCommanders,
  };
};

const base = (enemy: EnemyGuessPosts, player = fullPlayer(10)): PreviewInput => ({
  seed: 'pedra-alta-golden',
  formationId: 'formation-1',
  season: 'autumn',
  mode: 'defense',
  player,
  enemy,
  wall: { left: 600, center: 600, right: 600 },
  watchtowerLevel: 2,
  heroCapture: 'capture',
});

/** A mesma entrada como batalha real (só vale com o inimigo todo conhecido). */
const toBattle = (input: PreviewInput): BattleInput => {
  const posts = {} as Record<WingId, BattlePosts<HordeUnitId>[WingId]>;
  for (const wing of WING_IDS) {
    const slot = (guess: EnemyGuessPosts[WingId]['front']) => {
      if (guess === null) {
        return null;
      }
      if (guess.kind !== 'known') {
        throw new Error('Inimigo desconhecido numa batalha real.');
      }
      return { unit: guess.unit, count: guess.count };
    };
    posts[wing] = { front: slot(input.enemy[wing].front), back: slot(input.enemy[wing].back) };
  }
  return {
    mode: input.mode,
    player: input.player,
    horde: { posts },
    wall: input.wall,
    watchtowerLevel: input.watchtowerLevel,
    heroCapture: input.heroCapture,
  };
};

const unknownAll: EnemyGuessPosts = {
  left: { front: { kind: 'unknown', count: 10 }, back: { kind: 'unknown', count: 6 } },
  center: { front: { kind: 'unknown', count: 12 }, back: null },
  right: { front: { kind: 'unknown', count: 10 }, back: null },
};

describe('a prévia do Conselho de Guerra (V4D-T2)', () => {
  it('critério 2: inimigo conhecido e a semente da batalha real dão o relatório da batalha real', () => {
    const input = base(
      knownEnemy({ left: ['wolf', 8], center: ['raider', 18], right: ['blackKnight', 6] }),
    );
    const state = cloneState(newGame('pedra-alta'));
    const real = fightBattle(state, toBattle(input));
    const realReport = buildBattleReport('battle-1', 0, real.resolution);
    const preview = previewRun(
      { ...input, seed: state.seed, streamNameOf: () => `battle:${real.id}`, runs: 1 },
      0,
    );
    expect(preview.report).toEqual({ ...realReport, id: 'preview' });
    expect(JSON.stringify(preview.resolution)).toBe(JSON.stringify(real.resolution));
  });

  it('a Gloriosa é vencer sem que a Frente de nenhuma ala caia, com ou sem muralha (V4D-T5)', () => {
    const input = base(knownEnemy({ left: ['wolf', 12], center: ['raider', 20] }));
    const result = previewBattle(input);
    let expected = 0;
    for (let run = 0; run < 200; run += 1) {
      const { resolution, report } = previewRun(input, run);
      const won = resolution.outcome === 'victory' || resolution.outcome === 'held';
      const broken = report.casualties.some(
        (entry) => entry.owner === 'player' && entry.line === 'front' && entry.lost >= entry.start,
      );
      if (won && !broken) {
        expected += 1;
      }
    }
    expect(result.glorious).toBe(expected);
    // Sem muralha na entrada, a lista da muralha é vazia: ela não faz de toda vitória uma Gloriosa.
    expect(result.glorious).toBeLessThan(result.wins + 1);
  });

  it('o agregado confere com as simulações, em inteiros, e se repete', () => {
    const input = base(knownEnemy({ left: ['wolf', 12], center: ['raider', 20] }));
    const result = previewBattle(input);
    expect(result.runs).toBe(200);
    expect(result.wins + result.losses).toBe(200);
    expect(result.glorious).toBeLessThanOrEqual(result.wins);
    expect(JSON.stringify(previewBattle(input))).toBe(JSON.stringify(result));
    let wins = 0;
    for (let run = 0; run < 200; run += 1) {
      const outcome = previewRun(input, run).resolution.outcome;
      if (outcome === 'victory' || outcome === 'held') {
        wins += 1;
      }
    }
    expect(wins).toBe(result.wins);
  });

  it('golden: o agregado de uma composição conhecida', async () => {
    const input = base(
      knownEnemy({ left: ['wolf', 24], center: ['raider', 40], right: ['blackKnight', 14] }),
      fullPlayer(7),
    );
    await expect(`${JSON.stringify(previewBattle(input), null, 2)}\n`).toMatchFileSnapshot(
      './__golden__/war-council-conhecido.json',
    );
  });

  it('o desconhecido é preenchido com a composição-base da estação, sem sair da linha', () => {
    const input: PreviewInput = { ...base(unknownAll), season: 'spring' };
    const result = previewBattle(input);
    expect(result.enemy.every((post) => !post.known)).toBe(true);
    for (const post of result.enemy.filter((entry) => entry.line === 'front')) {
      expect(['wolf', 'raider']).toContain(post.unit);
    }
    // A Retaguarda da Primavera não tem peso: cai nas unidades comuns da linha.
    expect(['banditArcher', 'shaman']).toContain(result.enemy.find((p) => p.line === 'back')?.unit);
    // A amostra varia entre as simulações: sem isso a prévia não mediria a incerteza.
    const seen = new Set(
      Array.from({ length: 40 }, (_, run) => [...previewRun(input, run).sampled.keys()].join()),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it('as sementes dependem da semente da partida, da formação e do que se sabe', () => {
    const enemy = knownEnemy({ left: ['wolf', 12], center: ['raider', 20] });
    const first = JSON.stringify(previewBattle(base(enemy)));
    const results = [
      JSON.stringify(previewBattle({ ...base(enemy), formationId: 'formation-2' })),
      JSON.stringify(previewBattle({ ...base(enemy), seed: 'outra-semente' })),
      JSON.stringify(
        previewBattle(base(knownEnemy({ left: ['wolf', 13], center: ['raider', 20] }))),
      ),
    ];
    expect(results.some((result) => result !== first)).toBe(true);
  });

  it('o risco principal e as perdas esperadas vêm do relatório', () => {
    const weak = previewBattle(
      base(knownEnemy({ left: ['wolf', 30], center: ['wolf', 30] }), fullPlayer(3)),
    );
    expect(weak.losses).toBeGreaterThan(0);
    expect(weak.risk).not.toBeNull();
    expect(Number.isInteger(weak.risk?.amount)).toBe(true);
    expect(weak.expectedLosses).toHaveLength(6);
    for (const post of weak.expectedLosses) {
      expect(Number.isInteger(post.expected)).toBe(true);
      expect(post.expected).toBeLessThanOrEqual(post.start);
    }
  });

  it('não toca o estado: a função nem o recebe, e o gerador do estado sai como entrou', () => {
    const state = cloneState(newGame('pedra-alta'));
    const before = JSON.stringify(state);
    previewBattle({ ...base(unknownAll), seed: state.seed });
    expect(JSON.stringify(state)).toBe(before);
    expect(state.rng).toEqual(JSON.parse(before).rng);
  });

  it('custo: 200 simulações de uma formação cheia contra a onda mais pesada', () => {
    const heavy: EnemyGuessPosts = {
      left: { front: { kind: 'unknown', count: 30 }, back: { kind: 'unknown', count: 20 } },
      center: { front: { kind: 'unknown', count: 30 }, back: { kind: 'unknown', count: 20 } },
      right: { front: { kind: 'unknown', count: 30 }, back: { kind: 'unknown', count: 20 } },
    };
    const input = base(heavy, fullPlayer(30));
    previewBattle(input); // aquece o compilador
    const start = performance.now();
    const result = previewBattle(input);
    const elapsed = performance.now() - start;
    expect(result.runs).toBe(200);
    // O alvo é 50 ms; o teste dá folga de dez vezes para máquina ocupada.
    expect(elapsed, `200 simulações levaram ${elapsed.toFixed(1)} ms`).toBeLessThan(500);
  });
});
