import {
  balance,
  LINE_IDS,
  WING_IDS,
  type HordeUnitId,
  type UnitId,
  type WingId,
} from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { resolveBattle, type BattleInput, type BattlePosts, type LuckSource } from './battle';
import { buildBattleReport } from './battleReport';
import { fightBattle } from './battleTurn';
import { battleReportV33 } from './migrations/v33';
import { cloneState } from './state';
import { newGame } from './test-helpers';

// V4D-T1.7: as propriedades da batalha, para qualquer entrada válida.

const PLAYER_FRONT: UnitId[] = ['spearman', 'swordsman', 'knight', 'shieldbearer'];
const PLAYER_BACK: UnitId[] = ['archer'];
const HORDE_FRONT: HordeUnitId[] = ['wolf', 'raider', 'blackKnight', 'ogre', 'skeleton', 'warlord'];
const HORDE_BACK: HordeUnitId[] = ['banditArcher', 'shaman'];

function postsArb<U extends string>(front: U[], back: U[]): fc.Arbitrary<BattlePosts<U>> {
  const post = (units: U[]) =>
    fc.option(
      fc.record({ unit: fc.constantFrom(...units), count: fc.integer({ min: 1, max: 30 }) }),
      { nil: null, freq: 2 },
    );
  const wing = fc.record({ front: post(front), back: post(back) });
  return fc.record({ left: wing, center: wing, right: wing });
}

const commanderArb = fc.option(fc.constantFrom('warrior', 'archer', 'mage', 'cleric' as const), {
  nil: null,
});

const inputArb: fc.Arbitrary<BattleInput> = fc
  .record({
    mode: fc.constantFrom('defense' as const, 'attack' as const),
    player: postsArb(PLAYER_FRONT, PLAYER_BACK),
    horde: postsArb(HORDE_FRONT, HORDE_BACK),
    classes: fc.tuple(commanderArb, commanderArb, commanderArb),
    wall: fc.tuple(
      fc.option(fc.integer({ min: 0, max: 300 }), { nil: undefined }),
      fc.option(fc.integer({ min: 0, max: 300 }), { nil: undefined }),
      fc.option(fc.integer({ min: 0, max: 300 }), { nil: undefined }),
    ),
    watchtowerLevel: fc.integer({ min: 0, max: 5 }),
    heroCapture: fc.constantFrom('injury' as const, 'capture' as const, 'death' as const),
  })
  .map(({ mode, player, horde, classes, wall, watchtowerLevel, heroCapture }) => {
    const commanders = Object.fromEntries(
      WING_IDS.map((wing, index) => {
        const heroClass = classes[index];
        return [
          wing,
          heroClass === null || heroClass === undefined
            ? null
            : { heroId: `hero-${String(index + 1)}`, heroClass },
        ];
      }),
    ) as BattleInput['player']['commanders'];
    const walls: Partial<Record<WingId, number>> = {};
    WING_IDS.forEach((wing, index) => {
      const hp = wall[index];
      if (hp !== undefined) {
        walls[wing] = hp;
      }
    });
    return {
      mode,
      player: { posts: player, commanders },
      horde: { posts: horde },
      wall: walls,
      watchtowerLevel,
      heroCapture,
    };
  });

/** Uma sorte que repete a lista dada, em ordem: a mesma lista, a mesma batalha. */
function cycling(values: number[]): LuckSource {
  let index = 0;
  return () => {
    const value = values[index % values.length] as number;
    index += 1;
    return value;
  };
}

const lucksArb = fc.array(
  fc.integer({ min: balance.battle.luck.min, max: balance.battle.luck.max }),
  {
    minLength: 1,
    maxLength: 40,
  },
);

const startCount = (input: BattleInput) =>
  WING_IDS.flatMap((wing) =>
    LINE_IDS.flatMap((line) => [input.player.posts[wing][line], input.horde.posts[wing][line]]),
  ).reduce((sum, post) => sum + (post?.count ?? 0), 0);

describe('propriedades da batalha (V4D-T1.7)', () => {
  it('termina em até 12 rodadas, as baixas nunca passam dos efetivos, e o relatório cabe no estado', () => {
    fc.assert(
      fc.property(inputArb, lucksArb, (input, lucks) => {
        const resolution = resolveBattle(input, cycling(lucks));
        expect(resolution.rounds.length).toBeLessThanOrEqual(balance.battle.maxRounds);
        for (const round of resolution.rounds) {
          for (const squad of round.squads) {
            const start = resolution.initial.find(
              (entry) =>
                entry.post.side === squad.post.side &&
                entry.post.wing === squad.post.wing &&
                entry.post.line === squad.post.line,
            );
            expect(squad.count).toBeGreaterThan(0);
            expect(squad.count).toBeLessThanOrEqual(start?.count ?? 0);
            expect(squad.residual).toBeGreaterThanOrEqual(0);
            expect(Number.isSafeInteger(squad.residual)).toBe(true);
          }
          for (const action of round.actions) {
            for (const hit of action.hits) {
              expect(hit.casualties).toBeLessThanOrEqual(hit.targetCount);
              expect(hit.effective).toBeGreaterThanOrEqual(0);
            }
          }
        }
        const report = buildBattleReport('battle-1', 0, resolution);
        for (const entry of report.casualties) {
          expect(entry.lost).toBeGreaterThanOrEqual(0);
          expect(entry.lost).toBeLessThanOrEqual(entry.start);
        }
        expect(report.decisive.length).toBeLessThanOrEqual(3);
        expect(battleReportV33(JSON.parse(JSON.stringify(report)), 'report')).toBeNull();
        expect(report.casualties.reduce((sum, entry) => sum + entry.start, 0)).toBe(
          startCount(input),
        );
      }),
      { numRuns: 300 },
    );
  });

  it('o relatório é função da entrada e da sorte: a mesma entrada e a mesma lista dão a mesma batalha, sem mexer na entrada', () => {
    fc.assert(
      fc.property(inputArb, lucksArb, (input, lucks) => {
        const copy = JSON.stringify(input);
        const one = resolveBattle(input, cycling(lucks));
        const two = resolveBattle(JSON.parse(copy) as BattleInput, cycling(lucks));
        expect(JSON.stringify(input)).toBe(copy);
        expect(JSON.stringify(two)).toBe(JSON.stringify(one));
      }),
      { numRuns: 150 },
    );
  });

  it('no jogo, a batalha é função da entrada e do fluxo: instantânea, não depende de quando nem de quantas vezes o tempo foi cortado', () => {
    fc.assert(
      fc.property(
        inputArb,
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.nat(),
        (input, seed, later) => {
          const early = cloneState(newGame(seed));
          const late = cloneState(newGame(seed));
          late.lastProcessedAt += later;
          const a = fightBattle(early, input);
          const b = fightBattle(late, input);
          expect(JSON.stringify(b)).toBe(JSON.stringify(a));
          expect(Object.keys(early.rng).some((name) => name.startsWith('battle:'))).toBe(false);
          expect(early.ids.battle).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
