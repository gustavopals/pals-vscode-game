import { balance, HERO_CLASS_IDS, heroClasses } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import {
  heroFactors,
  heroLimit,
  heroPower,
  isAtHome,
  isLoyal,
  paidHeroes,
  wageRate,
} from './heroes';
import { addHero, gameWith, newGame } from './test-helpers';
import type { Hero } from './types';

const hero = (changed: Partial<Hero> = {}): Hero => ({
  id: 'hero-1',
  name: 'Edda',
  classId: 'warrior',
  level: 1,
  xp: 0,
  traits: [],
  status: 'idle',
  joinedAtMs: 0,
  discontent: false,
  ...changed,
});

describe('poder de um herói (ADR 0017, decisão 7)', () => {
  it('no nível 1 é ataque + defesa + vida ÷ 10, em milésimos: os números da tabela do ADR', () => {
    expect(HERO_CLASS_IDS.map((classId) => heroPower(hero({ classId })))).toEqual([
      42_000, 36_000, 35_000, 32_000,
    ]);
  });

  it('o nível soma 8% por nível acima do primeiro, sem compor', () => {
    // Guerreiro: 42 × 1,08 = 45,36; no nível 10, 42 × 1,72 = 72,24.
    expect(heroPower(hero({ level: 2 }))).toBe(45_360);
    expect(heroPower(hero({ level: 3 }))).toBe(48_720);
    expect(heroPower(hero({ level: 10 }))).toBe(72_240);
    // A dupla da carta no nível 2, como a calibragem do ADR a conta: 84,24.
    expect(heroPower(hero({ level: 2 })) + heroPower(hero({ classId: 'archer', level: 2 }))).toBe(
      84_240,
    );
    expect(heroFactors(hero({ level: 4 }))).toEqual([
      { id: 'level', ratio: { num: 124, den: 100 }, label: 'Nv4' },
    ]);
  });

  it('o Descontente vale 4/5, com um arredondamento só, para baixo, no fim', () => {
    expect(heroPower(hero({ discontent: true }))).toBe(33_600);
    // Mago no nível 2: 35 × 1,08 × 0,8 = 30,24 exatos.
    expect(heroPower(hero({ classId: 'mage', level: 2, discontent: true }))).toBe(30_240);
    // Clérigo no nível 4: 32.000 × 124/100 × 4/5 = 31.744 exatos.
    expect(heroPower(hero({ classId: 'cleric', level: 4, discontent: true }))).toBe(31_744);
    expect(heroFactors(hero({ discontent: true })).map((factor) => factor.id)).toEqual([
      'level',
      'discontent',
    ]);
  });

  it('é a conta em frações do conteúdo: nenhuma classe, em nenhum nível, perde um milésimo pelo caminho', () => {
    const { levelBonus, arrears, power, maxLevel } = balance.heroes;
    for (const classId of HERO_CLASS_IDS) {
      const { attributes } = heroClasses[classId];
      for (let level = 1; level <= maxLevel; level += 1) {
        for (const discontent of [false, true]) {
          // Em inteiros grandes, sem divisão no meio: Σ atributo × peso × 1000 × nível × fator.
          let num = 0n;
          let den = 1n;
          for (const [attribute, weight] of Object.entries(power)) {
            const base = BigInt(attributes[attribute as keyof typeof attributes]);
            num = num * BigInt(weight.den) + base * 1000n * BigInt(weight.num) * den;
            den *= BigInt(weight.den);
          }
          num *= BigInt(levelBonus.den + levelBonus.num * (level - 1));
          den *= BigInt(levelBonus.den);
          if (discontent) {
            num *= BigInt(arrears.discontentFactor.num);
            den *= BigInt(arrears.discontentFactor.den);
          }
          expect(heroPower(hero({ classId, level, discontent })), `${classId} Nv${level}`).toBe(
            Number(num / den),
          );
        }
      }
    }
  });
});

describe('quem é Leal, quem está no feudo, quem recebe e quantos cabem', () => {
  it('só o traço Leal segura o herói sem soldo', () => {
    expect(isLoyal(hero({ traits: ['loyal'] }))).toBe(true);
    expect(isLoyal(hero({ traits: ['veteran', 'loyal'] }))).toBe(true);
    expect(isLoyal(hero({ traits: ['brave', 'devout'] }))).toBe(false);
    expect(isLoyal(hero())).toBe(false);
  });

  it('nesta fase todo herói está no feudo e todo herói recebe: 2 de ouro por hora de jogo cada um', () => {
    expect(isAtHome(hero())).toBe(true);
    expect(wageRate(newGame())).toBe(0);
    const state = gameWith((draft) => {
      addHero(draft);
      addHero(draft, { traits: ['loyal'] });
      addHero(draft, { classId: 'mage' });
    });
    expect(paidHeroes(state)).toBe(3);
    expect(wageRate(state)).toBe(6_000);
  });

  it('sem Taverna o feudo contrata um herói', () => {
    expect(heroLimit()).toBe(1);
    expect(heroLimit()).toBe(balance.heroes.limitBase);
  });
});
