import type { HordeUnitId, LineId, UnitId, WingId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import {
  EVEN_LUCK,
  resolveBattle,
  type BattleAction,
  type BattleCommanderInput,
  type BattleInput,
  type BattlePosts,
  type BattleResolution,
} from './battle';
import { renderRounds } from './battle.render';

// A conta à mão (V4D-T1.1): o motor tem de reproduzir cada linha do documento.
const doc = Object.values(
  import.meta.glob<string>('../../../docs/content-v0.4.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0] as string;

type PostSpec<U extends string> = Partial<Record<WingId, Partial<Record<LineId, [U, number]>>>>;

export function posts<U extends string>(spec: PostSpec<U>): BattlePosts<U> {
  const empty = (wing: WingId) => ({
    front:
      spec[wing]?.front === undefined
        ? null
        : { unit: spec[wing].front[0], count: spec[wing].front[1] },
    back:
      spec[wing]?.back === undefined
        ? null
        : { unit: spec[wing].back[0], count: spec[wing].back[1] },
  });
  return { left: empty('left'), center: empty('center'), right: empty('right') };
}

export function battle(
  player: PostSpec<UnitId>,
  horde: PostSpec<HordeUnitId>,
  extra: Partial<Omit<BattleInput, 'player' | 'horde'>> & {
    commanders?: Partial<Record<WingId, BattleCommanderInput>>;
  } = {},
): BattleInput {
  return {
    mode: extra.mode ?? 'defense',
    player: {
      posts: posts(player),
      commanders: {
        left: extra.commanders?.left ?? null,
        center: extra.commanders?.center ?? null,
        right: extra.commanders?.right ?? null,
      },
    },
    horde: { posts: posts(horde) },
    wall: extra.wall ?? {},
    watchtowerLevel: extra.watchtowerLevel ?? 0,
    heroCapture: extra.heroCapture ?? 'capture',
  };
}

/** Os sete cenários de `docs/content-v0.4.md`, seção 2, na ordem do documento. */
export const SCENARIOS: ReadonlyArray<{ section: string; golden: string; input: BattleInput }> = [
  {
    section: '2.1 Paliçada contra lobos',
    golden: 'battle-palicada-lobos',
    input: battle(
      {
        left: { front: ['spearman', 10] },
        center: { front: ['shieldbearer', 5] },
        right: { front: ['spearman', 10] },
      },
      { left: { front: ['wolf', 8] }, right: { front: ['wolf', 8] } },
      { wall: { left: 60, center: 60, right: 60 } },
    ),
  },
  {
    section: '2.2 Flanco',
    golden: 'battle-flanco',
    input: battle(
      {
        left: { front: ['swordsman', 2] },
        center: { front: ['spearman', 8] },
        right: { front: ['spearman', 8] },
      },
      {
        left: { front: ['raider', 8] },
        center: { front: ['raider', 6] },
        right: { front: ['raider', 6] },
      },
    ),
  },
  {
    section: '2.3 Contra-ataque',
    golden: 'battle-contra-ataque',
    input: battle(
      { center: { front: ['spearman', 12] } },
      { center: { front: ['blackKnight', 6] } },
    ),
  },
  {
    section: '2.4 Ogro e muralha',
    golden: 'battle-ogro-muralha',
    input: battle(
      { center: { front: ['spearman', 6] } },
      { center: { front: ['ogre', 1] } },
      { wall: { center: 100 } },
    ),
  },
  {
    section: '2.5 Debandada',
    golden: 'battle-debandada',
    input: battle(
      {
        left: { front: ['spearman', 4], back: ['archer', 3] },
        center: { front: ['spearman', 10] },
        right: { front: ['spearman', 4], back: ['archer', 3] },
      },
      {
        left: { front: ['blackKnight', 8] },
        center: { front: ['blackKnight', 4] },
        right: { front: ['blackKnight', 8] },
      },
    ),
  },
  {
    section: '2.6 Doze rodadas, "Resistiu"',
    golden: 'battle-doze-rodadas',
    input: battle(
      { center: { front: ['shieldbearer', 16] } },
      { center: { front: ['blackKnight', 10] } },
    ),
  },
  {
    section: '2.7 Senhor da Guerra',
    golden: 'battle-senhor-da-guerra',
    input: battle(
      {
        left: { front: ['knight', 10] },
        center: { front: ['knight', 10] },
        right: { front: ['knight', 10] },
      },
      {
        left: { front: ['raider', 10] },
        center: { front: ['warlord', 1] },
        right: { front: ['raider', 10] },
      },
    ),
  },
];

/** A conta de uma seção do documento: de "**Rodada 1**" até antes de "**Resultado.**". */
function handCount(section: string): string {
  const start = doc.indexOf(`### ${section}\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const from = doc.indexOf('**Rodada 1**', start);
  const to = doc.indexOf('**Resultado.**', from);
  return doc.slice(from, to).trim();
}

const EXPECTED: Record<string, { outcome: string; ending: string; rounds: number }> = {
  'battle-palicada-lobos': { outcome: 'victory', ending: 'annihilation', rounds: 2 },
  'battle-flanco': { outcome: 'victory', ending: 'annihilation', rounds: 6 },
  'battle-contra-ataque': { outcome: 'victory', ending: 'annihilation', rounds: 3 },
  'battle-ogro-muralha': { outcome: 'victory', ending: 'annihilation', rounds: 2 },
  'battle-debandada': { outcome: 'defeat', ending: 'rout', rounds: 3 },
  'battle-doze-rodadas': { outcome: 'held', ending: 'rounds', rounds: 12 },
  'battle-senhor-da-guerra': { outcome: 'victory', ending: 'chiefFell', rounds: 3 },
};

describe('os sete cenários escritos à mão (docs/content-v0.4.md, seção 2)', () => {
  it.each(SCENARIOS)('$section: o motor reproduz a conta do documento', ({ section, input }) => {
    const resolution = resolveBattle(input, EVEN_LUCK);
    expect(renderRounds(resolution)).toBe(handCount(section));
  });

  it.each(SCENARIOS)('$section: desfecho e golden', async ({ section, golden, input }) => {
    const resolution = resolveBattle(input, EVEN_LUCK);
    const expected = EXPECTED[golden];
    expect({
      outcome: resolution.outcome,
      ending: resolution.ending,
      rounds: resolution.rounds.length,
    }).toEqual(expected);
    const text = [
      `# Batalha: ${section}`,
      '',
      'Sorte fixada em 100 (docs/content-v0.4.md, seção 2.0). Gravado com UPDATE_GOLDEN=1; o teste confere também, linha a linha, que a conta é a do documento.',
      '',
      renderRounds(resolution),
      '',
      `**Desfecho.** ${resolution.outcome} (${resolution.ending}), vence ${resolution.winner}, em ${String(resolution.rounds.length)} rodadas.`,
      '',
    ].join('\n');
    await expect(text).toMatchFileSnapshot(`./__golden__/${golden}.md`);
  });
});

type Attack = Extract<BattleAction, { kind: 'attack' }>;
const attacks = (resolution: BattleResolution, round: number): Attack[] =>
  (resolution.rounds[round - 1]?.actions ?? []).filter(
    (action): action is Attack => action.kind === 'attack',
  );

describe('as regras fora dos sete cenários', () => {
  it('o arqueiro da Horda mira a Retaguarda por cima da Frente, e o Escudeiro toma metade (D-3)', () => {
    const resolution = resolveBattle(
      battle(
        { center: { front: ['shieldbearer', 10], back: ['archer', 5] } },
        { center: { back: ['banditArcher', 4] } },
      ),
      EVEN_LUCK,
    );
    const shot = attacks(resolution, 1).find((action) => action.actor.side === 'A') as Attack;
    // Os Arqueiros do jogador agem antes (empate de iniciativa: o defensor) e matam 2 de 4.
    expect(shot.count).toBe(2);
    expect(shot.target).toEqual({ side: 'D', wing: 'center', line: 'back' });
    expect(shot.raw).toEqual({ num: 12, den: 1 });
    expect(shot.hits.map((hit) => [hit.target.line, hit.raw, hit.effective])).toEqual([
      ['front', { num: 6, den: 1 }, 1],
      ['back', { num: 6, den: 1 }, 1],
    ]);
    expect(shot.hits[1]?.overFront).toBe(true);
  });

  it('os arqueiros da Horda passam por cima da muralha a ×7/10; os do jogador, atrás dela, ×6/5', () => {
    const resolution = resolveBattle(
      battle(
        { center: { front: ['spearman', 5], back: ['archer', 5] } },
        { center: { back: ['banditArcher', 4] } },
        { wall: { center: 50 } },
      ),
      EVEN_LUCK,
    );
    const mine = attacks(resolution, 1).find(
      (action) => action.actor.side === 'D' && action.unit === 'archer',
    );
    const theirs = attacks(resolution, 1).find((action) => action.actor.side === 'A');
    expect(mine?.factors).toEqual([{ kind: 'cover', value: { num: 6, den: 5 } }]);
    expect(theirs?.factors).toEqual([{ kind: 'cover', value: { num: 7, den: 10 } }]);
    expect(theirs?.wall).toBeNull();
    expect(resolution.rounds[0]?.wall).toEqual({ center: 50 });
  });

  it('a torre (Torre Nv4: 24) atira em cada ala no fim da rodada, sem defesa nem sorte', () => {
    const at = (watchtowerLevel: number) =>
      resolveBattle(
        battle(
          { center: { front: ['shieldbearer', 10] } },
          { left: { front: ['raider', 10] } },
          { watchtowerLevel },
        ),
        EVEN_LUCK,
      );
    const tower = at(4).rounds[0]?.actions.find((action) => action.kind === 'tower');
    expect(tower).toMatchObject({ wing: 'left' });
    expect(tower?.hits[0]).toMatchObject({
      effective: 24,
      residualBefore: 0,
      casualties: 1,
      residualAfter: 6,
    });
    expect(at(2).rounds[0]?.actions.some((action) => action.kind === 'tower')).toBe(false);
  });

  it('o Mago bate em área a cada 3 rodadas, em dobro contra os mortos-vivos', () => {
    const resolution = resolveBattle(
      battle(
        { center: { front: ['shieldbearer', 10] } },
        { center: { front: ['skeleton', 8] } },
        { commanders: { center: { heroId: 'hero-1', heroClass: 'mage' } } },
      ),
      EVEN_LUCK,
    );
    const mageRounds = resolution.rounds
      .filter((round) => round.actions.some((action) => action.kind === 'mage'))
      .map((round) => round.round);
    expect(mageRounds[0]).toBe(3);
    expect(mageRounds.every((round) => round % 3 === 0)).toBe(true);
    const blast = resolution.rounds[2]?.actions.find((action) => action.kind === 'mage');
    expect(blast?.hits[0]?.raw).toEqual({ num: 40, den: 1 });
  });

  it('a Clériga dá +20 de moral e cura a Frente da ala a cada 2 rodadas', () => {
    const resolution = resolveBattle(
      battle(
        { center: { front: ['spearman', 10] } },
        { center: { front: ['raider', 10] } },
        { commanders: { center: { heroId: 'hero-1', heroClass: 'cleric' } } },
      ),
      EVEN_LUCK,
    );
    expect(resolution.startMorale.D).toBe(120);
    expect(resolution.rounds[0]?.actions.some((action) => action.kind === 'cleric')).toBe(false);
    const heal = resolution.rounds[1]?.actions.find((action) => action.kind === 'cleric') as
      Exclude<BattleAction, { kind: 'attack' }> | undefined;
    const healed = heal?.healed as { soldiers: number; residual: number };
    // 10% da vida da Frente no começo: 10 lanceiros × 20 / 10 = 20.
    expect(healed.residual + healed.soldiers * 20).toBeLessThanOrEqual(20);
    expect(healed.residual + healed.soldiers * 20).toBeGreaterThan(0);
  });

  it('o Guerreiro dá +15% de defesa à ala, e o Arqueiro +15% ao dano à distância da ala', () => {
    const resolution = resolveBattle(
      battle(
        { left: { front: ['spearman', 5], back: ['archer', 5] } },
        { left: { front: ['raider', 6] } },
        { commanders: { left: { heroId: 'hero-1', heroClass: 'archer' } } },
      ),
      EVEN_LUCK,
    );
    const archers = attacks(resolution, 1).find((action) => action.unit === 'archer');
    expect(archers?.factors).toContainEqual({ kind: 'aura', value: { num: 23, den: 20 } });
    const guarded = resolveBattle(
      battle(
        { left: { front: ['spearman', 5] } },
        { left: { front: ['raider', 6] } },
        { commanders: { left: { heroId: 'hero-1', heroClass: 'warrior' } } },
      ),
      EVEN_LUCK,
    );
    const blow = attacks(guarded, 1).find((action) => action.actor.side === 'A');
    expect(blow?.hits[0]?.defenseAura).toEqual({ num: 23, den: 20 });
    // absorvido = 4 × 5 × 1/2 × 23/20 = 23/2
    expect(blow?.hits[0]?.absorbed).toEqual({ num: 23, den: 2 });
  });

  it('o Xamã dá +20% de ataque à própria ala, e só a ela', () => {
    const resolution = resolveBattle(
      battle(
        { left: { front: ['spearman', 10] }, right: { front: ['spearman', 10] } },
        {
          left: { front: ['raider', 5], back: ['shaman', 2] },
          right: { front: ['raider', 5] },
        },
      ),
      EVEN_LUCK,
    );
    const raiders = attacks(resolution, 1).filter((action) => action.unit === 'raider');
    expect(raiders.find((action) => action.actor.wing === 'left')?.factors).toContainEqual({
      kind: 'aura',
      value: { num: 6, den: 5 },
    });
    expect(
      raiders
        .find((action) => action.actor.wing === 'right')
        ?.factors.some((f) => f.kind === 'aura'),
    ).toBe(false);
  });

  it('o comandante só cai quando um golpe chega à ala sem Frente: −15 de moral; morre só em Rei de Ferro', () => {
    const input = battle(
      { center: { front: ['spearman', 1], back: ['archer', 5] } },
      { center: { front: ['blackKnight', 10] } },
      { commanders: { center: { heroId: 'hero-1', heroClass: 'warrior' } } },
    );
    const resolution = resolveBattle(input, EVEN_LUCK);
    const notes = resolution.rounds.flatMap((round) =>
      round.actions.flatMap((action) => action.notes),
    );
    expect(notes).toContainEqual(
      expect.objectContaining({ kind: 'commanderFell', wing: 'center', heroId: 'hero-1' }),
    );
    expect(resolution.commanders[0]).toMatchObject({ fell: true, fellInRound: 2, fate: 'wounded' });
    expect(resolveBattle({ ...input, heroCapture: 'death' }, EVEN_LUCK).commanders[0]?.fate).toBe(
      'died',
    );
    expect(resolveBattle({ ...input, heroCapture: 'injury' }, EVEN_LUCK).commanders[0]?.fate).toBe(
      'wounded',
    );
  });

  it('o Lobo do Centro ataca uma ala lateral, sem flanco (D-4)', () => {
    const resolution = resolveBattle(
      battle(
        { left: { front: ['spearman', 5] }, center: { front: ['spearman', 5] } },
        { center: { front: ['wolf', 3] } },
      ),
      EVEN_LUCK,
    );
    const wolf = attacks(resolution, 1).find((action) => action.unit === 'wolf');
    expect(wolf?.target.wing).toBe('left');
    expect(wolf?.flank).toBe(false);
  });

  it('em ataque, as 12 rodadas fazem o atacante recuar, e a muralha e as torres não contam', () => {
    const resolution = resolveBattle(
      battle(
        { center: { front: ['shieldbearer', 16] } },
        { center: { front: ['blackKnight', 10] } },
        { mode: 'attack', wall: { center: 100 }, watchtowerLevel: 5 },
      ),
      EVEN_LUCK,
    );
    expect(resolution.playerSide).toBe('A');
    expect(resolution.outcome).toBe('withdrew');
    expect(resolution.wallStart).toEqual({});
    expect(
      resolution.rounds
        .flatMap((round) => round.actions)
        .every((action) => action.kind === 'attack'),
    ).toBe(true);
  });

  it('recusa sorte fora do intervalo e posto fora da forma', () => {
    const input = SCENARIOS[2]?.input as BattleInput;
    expect(() => resolveBattle(input, () => 89)).toThrow(/Sorte/);
    expect(() => resolveBattle(input, () => 111)).toThrow(/Sorte/);
    expect(() =>
      resolveBattle(battle({ center: { front: ['archer', 3] } }, {}), EVEN_LUCK),
    ).toThrow(/linha/);
    expect(() =>
      resolveBattle(battle({ center: { front: ['spearman', 0] } }, {}), EVEN_LUCK),
    ).toThrow(/quantidade/);
  });
});
