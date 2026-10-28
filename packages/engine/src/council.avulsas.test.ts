import { balance, councilCards, type DifficultyId, objectives } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { eligibleCards } from './council';
import { settleTavern } from './tavernTurn';
import { createInitialState } from './state';
import {
  accept,
  addHero,
  command,
  DAY,
  dealt,
  HOUR,
  quietCouncil,
  quietHorde,
  settings,
  SUMMER,
  WINTER,
} from './test-helpers';
import type { GameState } from './types';
import { deriveViewState } from './view';

function feud(difficulty: DifficultyId = 'lord', atMs = SUMMER): GameState {
  const state = createInitialState('avulsas-e2e', { ...settings, difficulty, timeScale: 1 });
  state.lastProcessedAt = atMs;
  state.clock.gameTimeMs = atMs;
  state.settlement.buildings = {
    ...state.settlement.buildings,
    townHall: 3,
    guild: 2,
    tavern: 1,
    granary: 3,
    warehouse: 3,
  };
  state.settlement.workers.farm = 3;
  state.settlement.resources = {
    food: 400_000,
    wood: 300_000,
    stone: 100_000,
    gold: 500_000,
    iron: 0,
  };
  state.objectives = { active: [], completed: objectives.map((entry) => entry.id) };
  settleTavern(state, atMs, []);
  quietCouncil(state);
  quietHorde(state);
  return state;
}

function choose(state: GameState, cardId: string, optionId: string) {
  const pending = state.council.pending.find((entry) => entry.cardId === cardId)!;
  return accept(state, command('answerCard', { instanceId: pending.instanceId, optionId }));
}

function expires(state: GameState, cardId: string) {
  return advanceTo(
    state,
    state.council.pending.find((entry) => entry.cardId === cardId)!.expiresAtMs,
  );
}

describe('as quatro avulsas aprovadas, de ponta a ponta', () => {
  it('golden da visão das quatro cartas na mesa, com nomes interpolados e pistas', async () => {
    const cards = ['passingRecruiter', 'gamblingDebt', 'squareDuel', 'wanderingHealer'] as const;
    const views = Object.fromEntries(
      cards.map((id) => {
        const start = feud();
        const first = addHero(start, { name: 'Ada' });
        addHero(start, { name: 'Bia' });
        if (id === 'wanderingHealer') {
          first.status = 'injured';
          first.injury = { severity: 'severe', untilMs: SUMMER + 12 * HOUR };
        }
        const state = dealt(start, id).state;
        return [id, deriveViewState(state, state.lastProcessedAt).council.pending[0]];
      }),
    );
    await expect(`${JSON.stringify({ cards: views }, null, 1)}\n`).toMatchFileSnapshot(
      './__golden__/council-avulsas-view.json',
    );
  });

  it('passingRecruiter: exige Taverna, paga 100 de ouro por um candidato extra na próxima rotação e expira sem efeito', () => {
    const withoutTavern = feud();
    withoutTavern.settlement.buildings.tavern = 0;
    expect(
      eligibleCards(withoutTavern, SUMMER, councilCards).map((entry) => entry.id),
    ).not.toContain('passingRecruiter');
    expect(eligibleCards(feud(), SUMMER, councilCards).map((entry) => entry.id)).toContain(
      'passingRecruiter',
    );

    const paid = choose(dealt(feud(), 'passingRecruiter').state, 'passingRecruiter', 'pay');
    expect(paid.state.settlement.resources.gold).toBe(400_000);
    expect(paid.state.guild.tavern.extraOffer).toBe(true);
    const nextRotation = paid.state.guild.tavern.nextRotationAtMs!;
    const rotated = advanceTo(paid.state, nextRotation).state;
    expect(rotated.guild.tavern.extraOffer).toBe(false);
    expect(rotated.guild.tavernOffers).toHaveLength(balance.tavern.offersByLevel[0]! + 1);
    expect(deriveViewState(rotated, nextRotation).guild.tavern?.maxHiresPerRotation).toBe(
      balance.tavern.maxHiresPerRotation,
    );

    const expired = expires(dealt(feud(), 'passingRecruiter').state, 'passingRecruiter');
    expect(expired.state.settlement.resources.gold).toBe(500_000);
    expect(expired.state.guild.tavern.extraOffer).toBe(false);
    expect(expired.events.find((entry) => entry.type === 'cardExpired')?.text).toContain(
      'sem palavra do senhor, o conselho de',
    );
  });

  it('gamblingDebt: cobre por 90 de ouro ou deixa o risco de 1/2 para a virada seguinte', () => {
    const base = feud();
    expect(eligibleCards(base, SUMMER, councilCards).map((entry) => entry.id)).not.toContain(
      'gamblingDebt',
    );
    addHero(base, { name: 'Ada' });
    expect(eligibleCards(base, SUMMER, councilCards).map((entry) => entry.id)).toContain(
      'gamblingDebt',
    );

    const covered = choose(dealt(base, 'gamblingDebt').state, 'gamblingDebt', 'cover');
    expect(covered.state.settlement.resources.gold).toBe(410_000);
    expect(covered.events[0]?.data).toMatchObject({
      spent_gold: 90,
      morale: 5,
      moraleDays: 2,
      heroId: 'hero-1',
      heroName: 'Ada',
    });
    expect(covered.events[0]?.text).toContain('Ada');

    const outcomes = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const start = feud();
      start.seed = `debt-${seed}`;
      addHero(start, { name: 'Ada' });
      const left = choose(dealt(start, 'gamblingDebt').state, 'gamblingDebt', 'leave');
      expect(left.state.council.delayed).toHaveLength(1);
      const dawn = advanceTo(left.state, SUMMER + DAY);
      const effect = dawn.events.find((entry) => entry.type === 'cardEffectApplied')!;
      if (dawn.state.guild.heroes[0]?.status === 'injured') {
        outcomes.add('hit');
        expect(dawn.state.guild.heroes[0]?.injury?.severity).toBe('light');
        expect(effect.data).toMatchObject({
          injuredHeroId: 'hero-1',
          injuredHeroName: 'Ada',
          morale: -5,
          moraleDays: 3,
        });
        expect(effect.text).toContain('Ada voltou da conversa com o cobrador de olho roxo');
      } else {
        outcomes.add('miss');
        expect(effect.data).toMatchObject({ morale: 5, moraleDays: 2 });
        expect(effect.text).toContain('Ada acertou as contas com o cobrador');
      }
    }
    expect([...outcomes].sort()).toEqual(['hit', 'miss']);
  });

  it('squareDuel: exige dois heróis livres fora do inverno e exercita permitir, treinar, proibir e expirar', () => {
    const start = feud();
    addHero(start, { name: 'Ada' });
    expect(eligibleCards(start, SUMMER, councilCards).map((entry) => entry.id)).not.toContain(
      'squareDuel',
    );
    addHero(start, { name: 'Bia' });
    expect(eligibleCards(start, SUMMER, councilCards).map((entry) => entry.id)).toContain(
      'squareDuel',
    );
    expect(eligibleCards(start, WINTER, councilCards).map((entry) => entry.id)).not.toContain(
      'squareDuel',
    );

    const trained = choose(dealt(start, 'squareDuel').state, 'squareDuel', 'train');
    expect(trained.state.settlement.resources.gold).toBe(470_000);
    expect(trained.events[0]?.data).toMatchObject({ spent_gold: 30, morale: 5, moraleDays: 2 });
    expect(trained.state.council.delayed).toEqual([]);

    const expired = expires(dealt(start, 'squareDuel').state, 'squareDuel');
    expect(expired.events.find((entry) => entry.type === 'cardExpired')?.data).toMatchObject({
      optionId: 'forbid',
      morale: -5,
      moraleDays: 2,
    });

    const outcomes = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const duelState = feud();
      duelState.seed = `square-${seed}`;
      addHero(duelState, { name: 'Ada' });
      addHero(duelState, { name: 'Bia' });
      const allowed = choose(dealt(duelState, 'squareDuel').state, 'squareDuel', 'allow');
      expect(allowed.events[0]?.data).toMatchObject({ morale: 10, moraleDays: 2 });
      const dawn = advanceTo(allowed.state, SUMMER + DAY);
      const effect = dawn.events.find((entry) => entry.type === 'cardEffectApplied')!;
      const hurt = dawn.state.guild.heroes.find((hero) => hero.status === 'injured');
      if (hurt !== undefined) {
        outcomes.add('hit');
        expect(effect.text).toContain(`${hurt.name} saiu do duelo na praça com um corte no braço`);
      } else {
        outcomes.add('miss');
        expect(effect.text).toContain('acabou em abraço e vinho');
      }
    }
    expect([...outcomes].sort()).toEqual(['hit', 'miss']);
  });

  it('wanderingHealer: cura por inteiro, encurta pela metade, narra atraso se já sarou e preserva o vencimento', () => {
    const start = feud();
    const hero = addHero(start, { name: 'Ada' });
    expect(eligibleCards(start, SUMMER, councilCards).map((entry) => entry.id)).not.toContain(
      'wanderingHealer',
    );
    hero.status = 'injured';
    hero.injury = { severity: 'severe', untilMs: SUMMER + 12 * HOUR };
    expect(eligibleCards(start, SUMMER, councilCards).map((entry) => entry.id)).toContain(
      'wanderingHealer',
    );

    const full = choose(dealt(start, 'wanderingHealer').state, 'wanderingHealer', 'pay');
    expect(full.state.settlement.resources.gold).toBe(440_000);
    expect(full.state.guild.heroes[0]?.status).toBe('idle');
    expect(full.state.guild.heroes[0]?.injury).toBeNull();
    expect(full.events.map((entry) => entry.type)).toEqual(['cardAnswered', 'heroRecovered']);

    const half = choose(dealt(start, 'wanderingHealer').state, 'wanderingHealer', 'herbs');
    expect(half.state.settlement.resources.food).toBe(370_000);
    expect(half.state.guild.heroes[0]?.injury).toEqual({
      severity: 'severe',
      untilMs: SUMMER + 6 * HOUR,
    });

    const lateDeal = dealt(start, 'wanderingHealer').state;
    lateDeal.guild.heroes[0]!.status = 'idle';
    lateDeal.guild.heroes[0]!.injury = null;
    const late = choose(lateDeal, 'wanderingHealer', 'pay');
    expect(late.state.settlement.resources.gold).toBe(440_000);
    expect(late.events.map((entry) => entry.type)).toEqual(['cardAnswered']);
    expect(late.events[0]?.text).toBe(
      'No 1º dia do Verão, o curandeiro errante chegou tarde a Pedra Alta: Ada já não estava entre os feridos da casa.',
    );

    const expired = expires(dealt(start, 'wanderingHealer').state, 'wanderingHealer');
    expect(expired.events.find((entry) => entry.type === 'cardExpired')?.text).toContain(
      'sem palavra do senhor, o conselho de Pedra Alta dispensou o curandeiro errante. Ada continuou de cama',
    );
  });
});
