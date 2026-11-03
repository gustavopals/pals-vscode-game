import { LINE_IDS, SEASON_IDS, WING_IDS, warRaids, type UnitId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { EVEN_LUCK, resolveBattle } from './battle';
import {
  baseRaidComposition,
  buildDefender,
  buildRaidComposition,
  raidSizeFor,
  scaledLoss,
  toHordePosts,
} from './raidArmy';
import type { Formation } from './types';

/** Um gerador de teste: uma sequência fixa, repetida. */
function sequence(values: number[]) {
  let index = 0;
  return (max: number) => {
    const value = values[index % values.length]! % max;
    index += 1;
    return value;
  };
}

const none = (): Record<UnitId, number> => ({
  spearman: 0,
  swordsman: 0,
  archer: 0,
  knight: 0,
  shieldbearer: 0,
});

describe('o tamanho pela Ameaça e pela estação', () => {
  it('leve abaixo de 70 e média a partir de 70, como na v0.2', () => {
    for (const season of SEASON_IDS) {
      expect(raidSizeFor(41, season)).toBe('light');
      expect(raidSizeFor(69, season)).toBe('light');
      expect(raidSizeFor(70, season)).toBe('medium');
    }
  });

  it('o forte depende da estação', () => {
    expect(raidSizeFor(100, 'spring')).toBe('medium');
    expect(raidSizeFor(94, 'summer')).toBe('medium');
    expect(raidSizeFor(95, 'summer')).toBe('strong');
    expect(raidSizeFor(85, 'autumn')).toBe('strong');
    expect(raidSizeFor(80, 'winter')).toBe('strong');
  });
});

describe('a composição de uma incursão', () => {
  const total = (size: 'light' | 'medium' | 'strong', season: 'spring') =>
    buildRaidComposition(size, season, () => 0).reduce(
      (sum, post) => sum + post.count * warRaids.unitCost[post.unit],
      0,
    );

  it('o mesmo gerador dá a mesma composição, e ela não muda o gerador que não pediu', () => {
    const a = buildRaidComposition('medium', 'autumn', sequence([3, 17, 41, 8, 90]));
    const b = buildRaidComposition('medium', 'autumn', sequence([3, 17, 41, 8, 90]));
    expect(a).toEqual(b);
  });

  it('um sorteio por posto com parte do orçamento, na ordem das alas e linhas', () => {
    const asked: number[] = [];
    const posts = buildRaidComposition('light', 'autumn', (max) => {
      asked.push(max);
      return 0;
    });
    expect(posts.map((post) => `${post.wing}/${post.line}`)).toEqual([
      'left/front',
      'center/front',
      'center/back',
      'right/front',
      'right/back',
    ]);
    // Frente: raider 35 + blackKnight 25 + ogre 15 = 75; retaguarda: banditArcher 15 + shaman 10 = 25.
    expect(asked).toEqual([75, 75, 25, 75, 25]);
  });

  it('cada tipo luta na linha dele (arqueiros e xamãs atrás, o resto à frente)', () => {
    for (const season of SEASON_IDS) {
      for (let seed = 0; seed < 40; seed += 1) {
        const posts = buildRaidComposition('strong', season, sequence([seed * 7, seed * 13 + 1]));
        for (const post of posts) {
          const back = post.unit === 'banditArcher' || post.unit === 'shaman';
          expect(post.line).toBe(back ? 'back' : 'front');
          expect(post.count).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('a primavera não tem retaguarda: a parte dela vai para a Frente da mesma ala', () => {
    const posts = buildRaidComposition('light', 'spring', () => 0);
    expect(posts.every((post) => post.line === 'front')).toBe(true);
    expect(posts.map((post) => post.wing)).toEqual(['left', 'center', 'right']);
    // 24 pontos: esquerda 25%, centro 45%, direita 30% (lobos, custo 1).
    expect(posts.map((post) => post.count)).toEqual([6, 10, 7]);
  });

  it('o forte vale mais que o médio, e o médio mais que o leve (em pontos de tropa)', () => {
    expect(total('light', 'spring')).toBeLessThan(total('medium', 'spring'));
    expect(total('medium', 'spring')).toBeLessThan(total('strong', 'spring'));
  });

  it('um tipo caro entra em menos unidades (o Ogro custa 4)', () => {
    // Sorteio no fim da faixa da Frente do outono: o Ogro (últimos 15 pesos de 75).
    const posts = buildRaidComposition('strong', 'autumn', () => 74);
    const ogres = posts.filter((post) => post.unit === 'ogre');
    expect(ogres.length).toBeGreaterThan(0);
    for (const post of ogres) {
      expect(post.count).toBeLessThan(10);
    }
  });

  it('a composição-base é fixa, sem sorteio, e usa o tipo de maior peso', () => {
    const base = baseRaidComposition('medium', 'summer');
    expect(base).toEqual(baseRaidComposition('medium', 'summer'));
    expect(base.filter((post) => post.line === 'front').every((p) => p.unit === 'raider')).toBe(
      true,
    );
    expect(
      base.filter((post) => post.line === 'back').every((p) => p.unit === 'banditArcher'),
    ).toBe(true);
  });

  it('a batalha aceita a composição de toda estação e tamanho', () => {
    const player = {
      posts: buildDefender(null, none(), () => null).posts,
      commanders: buildDefender(null, none(), () => null).commanders,
    };
    for (const season of SEASON_IDS) {
      for (const size of ['light', 'medium', 'strong'] as const) {
        const horde = { posts: toHordePosts(buildRaidComposition(size, season, () => 0)) };
        const resolution = resolveBattle(
          {
            mode: 'defense',
            player,
            horde,
            wall: { left: 60, center: 60, right: 60 },
            watchtowerLevel: 0,
            heroCapture: 'injury',
          },
          EVEN_LUCK,
        );
        expect(['victory', 'held', 'defeat', 'withdrew']).toContain(resolution.outcome);
      }
    }
  });
});

describe('o defensor', () => {
  const formation: Formation = {
    id: 'formation-1',
    name: 'Muralha viva',
    posts: {
      left: { front: { unit: 'spearman', count: 10 }, back: null },
      center: {
        front: { unit: 'shieldbearer', count: 8 },
        back: { unit: 'archer', count: 6 },
      },
      right: { front: { unit: 'spearman', count: 10 }, back: null },
    },
    commanders: { left: 'hero-1', center: 'hero-2', right: null },
  };

  it('sem formação ativa não há ninguém: só a muralha e as torres lutam', () => {
    const defender = buildDefender(null, { ...none(), spearman: 50 }, () => 'warrior');
    for (const wing of WING_IDS) {
      expect(defender.commanders[wing]).toBeNull();
      for (const line of LINE_IDS) {
        expect(defender.posts[wing][line]).toBeNull();
      }
    }
  });

  it('postos vazios ficam vazios e o que há de soldados enche os postos na ordem', () => {
    const army = { ...none(), spearman: 14, shieldbearer: 8, archer: 0 };
    const defender = buildDefender(formation, army, () => null);
    expect(defender.posts.left.front).toEqual({ unit: 'spearman', count: 10 });
    expect(defender.posts.left.back).toBeNull();
    expect(defender.posts.center.front).toEqual({ unit: 'shieldbearer', count: 8 });
    // Sem arqueiros, o posto da retaguarda fica vazio.
    expect(defender.posts.center.back).toBeNull();
    // Só sobraram 4 lanceiros para a ala da direita.
    expect(defender.posts.right.front).toEqual({ unit: 'spearman', count: 4 });
  });

  it('o plano maior que o exército é preenchido pelo que existe', () => {
    const defender = buildDefender(formation, { ...none(), spearman: 3 }, () => null);
    expect(defender.posts.left.front).toEqual({ unit: 'spearman', count: 3 });
    expect(defender.posts.right.front).toBeNull();
  });

  it('o comandante entra só se puder comandar', () => {
    const classes: Record<string, 'warrior' | 'mage'> = { 'hero-1': 'warrior' };
    const defender = buildDefender(formation, none(), (id) => classes[id] ?? null);
    expect(defender.commanders.left).toEqual({ heroId: 'hero-1', heroClass: 'warrior' });
    expect(defender.commanders.center).toBeNull();
    expect(defender.commanders.right).toBeNull();
  });

  it('não muda a formação nem o exército recebidos', () => {
    const before = JSON.stringify(formation);
    const army = { ...none(), spearman: 20 };
    const armyBefore = JSON.stringify(army);
    buildDefender(formation, army, () => null);
    expect(JSON.stringify(formation)).toBe(before);
    expect(JSON.stringify(army)).toBe(armyBefore);
  });

  it('a milícia só ocupa postos da linha de frente e nunca é posicionada na retaguarda', () => {
    const fullFront: Formation = {
      id: 'full-front',
      name: 'Linha de Frente Completa',
      posts: {
        left: { front: { unit: 'spearman', count: 10 }, back: null },
        center: { front: { unit: 'spearman', count: 10 }, back: null },
        right: { front: { unit: 'spearman', count: 10 }, back: null },
      },
      commanders: { left: null, center: null, right: null },
    };
    const army = { ...none(), spearman: 30 };
    const defender = buildDefender(fullFront, army, () => null, 15);
    expect(defender.posts.center.back).toBeNull();
    expect(defender.posts.left.back).toBeNull();
    expect(defender.posts.right.back).toBeNull();
  });
});

describe('o que custa perder, na proporção do que passou', () => {
  it('passou tudo: a regra da v0.2 inteira', () => {
    expect(scaledLoss('light', { num: 1, den: 1 })).toEqual({
      lossRatio: { num: 1, den: 10 },
      injuries: 1,
    });
    expect(scaledLoss('medium', { num: 5, den: 5 })).toEqual({
      lossRatio: { num: 3, den: 20 },
      injuries: 2,
    });
  });

  it('passou a metade: metade da perda e dos feridos, para cima', () => {
    expect(scaledLoss('medium', { num: 1, den: 2 })).toEqual({
      lossRatio: { num: 3, den: 40 },
      injuries: 1,
    });
    expect(scaledLoss('strong', { num: 1, den: 2 }).injuries).toBe(2);
  });

  it('passou um pouco: ao menos um ferido; não passou nada: nada', () => {
    expect(scaledLoss('strong', { num: 1, den: 100 }).injuries).toBe(1);
    expect(scaledLoss('strong', { num: 0, den: 7 })).toEqual({
      lossRatio: { num: 0, den: 1 },
      injuries: 0,
    });
  });

  it('nunca passa de tudo', () => {
    expect(scaledLoss('light', { num: 9, den: 3 })).toEqual(
      scaledLoss('light', { num: 1, den: 1 }),
    );
  });
});
