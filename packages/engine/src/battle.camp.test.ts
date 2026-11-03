import { describe, expect, it } from 'vitest';

import { resolveBattle, type BattleInput } from './battle';
import { buildBattleReport } from './battleReport';

const input = (): BattleInput => ({
  mode: 'attack',
  player: {
    posts: {
      left: { front: null, back: null },
      center: { front: { unit: 'swordsman', count: 10 }, back: { unit: 'archer', count: 5 } },
      right: { front: null, back: null },
    },
    commanders: { left: null, center: null, right: null },
  },
  horde: {
    posts: {
      left: { front: null, back: null },
      center: { front: { unit: 'raider', count: 10 }, back: { unit: 'banditArcher', count: 5 } },
      right: { front: null, back: null },
    },
  },
  wall: { center: 60 },
  watchtowerLevel: 5,
  heroCapture: 'capture',
});

describe('a paliçada do Acampamento na batalha ofensiva', () => {
  it('segura os golpes do jogador, protege os arqueiros inimigos e não traz a Torre do feudo', () => {
    const start = input();
    const untouched = JSON.stringify(start);
    const result = resolveBattle(start, () => 100);
    const attacks = result.rounds.flatMap((round) => round.actions);
    const wallHits = attacks.filter((action) => action.kind === 'attack' && action.wall !== null);
    expect(wallHits.length).toBeGreaterThan(0);
    expect(wallHits.every((action) => action.kind === 'attack' && action.actor.side === 'A')).toBe(
      true,
    );
    expect(attacks.some((action) => action.kind === 'tower')).toBe(false);
    expect(result.wallStart).toEqual({ center: 60 });
    expect(JSON.stringify(start)).toBe(untouched);
    const report = buildBattleReport('battle-1', 1, result);
    expect(report.mode).toBe('attack');
    const credit = report.decisive.find((factor) => factor.factor === 'wallAbsorbed');
    expect(credit?.owner).toBe('horde');
    expect(credit?.amount).toBeGreaterThan(0);
  });

  it('a mesma luta sem paliçada não absorve golpes nem concede cobertura', () => {
    const result = resolveBattle({ ...input(), wall: {} }, () => 100);
    expect(result.wallStart).toEqual({});
    expect(
      result.rounds
        .flatMap((round) => round.actions)
        .filter((action) => action.kind === 'attack')
        .every(
          (action) =>
            action.wall === null && action.factors.every((factor) => factor.kind !== 'cover'),
        ),
    ).toBe(true);
  });
});
