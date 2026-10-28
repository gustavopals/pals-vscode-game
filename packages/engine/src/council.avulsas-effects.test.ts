import { balance, type CouncilCard, type CouncilEffect } from '@lotg/content';
import { CouncilCardSchema } from '@lotg/content/schemas';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { answerCard, meetsRequirements } from './council';
import { drawCard } from './councilTurn';
import { councilView } from './councilView';
import { settleTavern } from './tavernTurn';
import { currentShape, migrateState } from './migrations';
import { cloneState } from './state';
import { addHero, DAY, dealt, quietGame, WINTER } from './test-helpers';
import type { GameEvent, GameState } from './types';

function sample(effects: readonly CouncilEffect[], requires?: CouncilCard['requires']): CouncilCard {
  return {
    id: 'meetingTest', title: 'O encontro', text: '{heroi} e {heroi2} chegaram. O conselho espera.',
    weight: 1, requires,
    autoResolve: { peasant: 'choose', lord: 'choose', ironKing: 'choose' },
    options: [
      { id: 'choose', label: 'Escolher', effects, hint: 'O encontro espera.', chronicle: 'No {dia}º dia {daEstacao}, {feudo} ouviu {heroi} e {heroi2}.' },
      { id: 'wait', label: 'Esperar', effects: [], hint: 'O conselho espera.', chronicle: 'No {dia}º dia {daEstacao}, {feudo} esperou.' },
    ],
  };
}
function site(seed = 'avulsas'): GameState {
  const state = quietGame(seed);
  state.settlement.buildings.tavern = 1;
  state.settlement.resources.gold = 500_000;
  state.settlement.resources.food = 500_000;
  state.settlement.workers.farm = 3;
  settleTavern(state, 0, []);
  return state;
}
function choose(state: GameState, card: CouncilCard) {
  const start = dealt(state, card.id, [card]);
  const events: GameEvent[] = [];
  expect(answerCard(start.state, start.instanceId, 'choose', start.state.lastProcessedAt, events, [card])).toBeNull();
  return { state: start.state, events };
}
const risk: CouncilEffect = {
  type: 'rollEffect', chance: { num: 1, den: 2 },
  onHit: { effects: [{ type: 'injureHero', kind: 'light' }, { type: 'morale', amount: -5, durationDays: 3 }], chronicle: 'No {dia}º dia {daEstacao}, {heroiFerido} voltou ferido a {feudo}.' },
  onMiss: { effects: [{ type: 'morale', amount: 5, durationDays: 2 }], chronicle: 'No {dia}º dia {daEstacao}, {heroi} voltou bem a {feudo}.' },
};
// A resolução lê o catálogo fornecido, como a linha do tempo real lê o catálogo do conteúdo.
import { applyDelayedEffects } from './councilTurn';

describe('efeitos das avulsas aprovadas (§§7.3–7.5 e 8.1)', () => {
  it('o recrutador só muda a próxima lista, no fluxo tavern e sem mudar o limite', () => {
    const state = site();
    const card = sample([{ type: 'tavernExtraOffer' }]);
    const next = state.guild.tavern.nextRotationAtMs!;
    const result = choose(state, card).state;
    expect(result.rng).toEqual(state.rng);
    expect(result.guild.tavernOffers).toEqual(state.guild.tavernOffers);
    expect(result.guild.tavern.extraOffer).toBe(true);
    const loaded = migrateState(JSON.parse(JSON.stringify(result)), { timeScale: 1 });
    const before = advanceTo(loaded, next - 1);
    expect(before.state.guild.tavern.extraOffer).toBe(true);
    const rotated = advanceTo(loaded, next).state;
    expect(rotated.guild.tavern.extraOffer).toBe(false);
    expect(rotated.guild.tavernOffers).toHaveLength(state.guild.tavernOffers.length + 1);
    expect(rotated.rng.council).toEqual(result.rng.council);
    expect(rotated.rng.tavern).not.toEqual(state.rng.tavern);
    expect(new Set(rotated.guild.tavernOffers.map((offer) => offer.name)).size).toBe(rotated.guild.tavernOffers.length);
    expect(advanceTo(rotated, next + balance.tavern.rotationMs).state.guild.tavernOffers).toHaveLength(state.guild.tavernOffers.length);
    const split = advanceTo(before.state, next);
    const whole = advanceTo(loaded, next);
    expect(split.state).toEqual(whole.state);
    expect([...before.events, ...split.events]).toEqual(whole.events);
  });

  it.each(['expedition', 'injured', 'captured', 'escort'] as const)('heroPresent exclui %s', (status) => {
    const state = site();
    const hero = addHero(state);
    hero.status = status;
    const card = sample([], { heroPresent: 1 });
    expect(meetsRequirements(state, card, 0)).toBe(false);
    expect(meetsRequirements(state, sample([], { injuredHero: true }), 0)).toBe(false);
    hero.status = 'idle';
    expect(meetsRequirements(state, card, 0)).toBe(true);
    expect(meetsRequirements(state, sample([], { heroPresent: 2 }), 0)).toBe(false);
  });

  it('a audiência escolhe dois sem reposição e congela os nomes, sem sortear na visão ou resposta', () => {
    const state = site();
    addHero(state, { name: 'Ada' }); addHero(state, { name: 'Bia' }); addHero(state, { name: 'Cora' });
    const card = sample([], { heroPresent: 2 });
    state.council.nextDrawAtMs = 0;
    drawCard(state, 0, [], [card]);
    const pending = state.council.pending[0]!;
    expect(pending.heroes).toHaveLength(2);
    expect(new Set(pending.heroes!.map((hero) => hero.id)).size).toBe(2);
    const rng = structuredClone(state.rng);
    const names = pending.heroes!.map((hero) => hero.name);
    state.guild.heroes.forEach((hero) => { hero.name = 'Nome alterado'; });
    expect(councilView(state, 1, [card]).council.pending[0]?.text).toBe(`${names[0]} e ${names[1]} chegaram. O conselho espera.`);
    const events: GameEvent[] = [];
    expect(answerCard(state, pending.instanceId, 'choose', 0, events, [card])).toBeNull();
    expect(events[0]?.text).toContain(`${names[0]} e ${names[1]}`);
    expect(state.rng).toEqual(rng);
  });

  it('o risco sorteia só na virada, fere por duas horas e alcança os dois participantes', () => {
    const injured = new Set<string>(); const outcomes = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const state = site(`duel-${seed}`);
      addHero(state, { name: 'Ada' }); addHero(state, { name: 'Bia' });
      const card = sample([risk], { heroPresent: 2 });
      const pending = dealt(state, card.id, [card]);
      const rng = structuredClone(pending.state.rng);
      const events: GameEvent[] = [];
      expect(answerCard(pending.state, pending.instanceId, 'choose', 0, events, [card])).toBeNull();
      expect(pending.state.rng).toEqual(rng);
      expect(pending.state.council.delayed[0]?.atMs).toBe(DAY);
      const loaded = migrateState(JSON.parse(JSON.stringify(pending.state)), { timeScale: 1 });
      const before = cloneState(loaded); before.council.delayed = [];
      const dawn = advanceTo(before, DAY).state;
      const resolved: GameEvent[] = [];
      applyDelayedEffects(dawn, DAY, resolved, [card]); // sem fila, sem sorteio
      expect(resolved).toEqual([]);
      dawn.council.delayed = loaded.council.delayed;
      applyDelayedEffects(dawn, DAY, resolved, [card]);
      const hurt = dawn.guild.heroes.find((hero) => hero.injury !== null);
      outcomes.add(hurt === undefined ? 'good' : 'bad');
      if (hurt !== undefined) {
        injured.add(hurt.id);
        expect(hurt.status).toBe('injured');
        expect(hurt.injury).toEqual({ severity: 'light', untilMs: DAY + balance.injuries.durationMs.light });
        expect(resolved[0]?.text).toContain(hurt.name);
        expect(advanceTo(dawn, hurt.injury!.untilMs).state.guild.heroes.find((hero) => hero.id === hurt.id)?.status).toBe('idle');
      }
      expect(resolved[0]?.text).not.toMatch(/\{heroi/);
    }
    expect([...outcomes].sort()).toEqual(['bad', 'good']);
    expect([...injured].sort()).toEqual(['hero-1', 'hero-2']);
  });

  it.each(['injured', 'expedition', 'captured', 'escort', 'departed'] as const)('sem alvo livre (%s), aplica o ramo bom sem sortear nem ferir outro', (status) => {
    const state = site(); const hero = addHero(state);
    const card = sample([risk], { heroPresent: 1 });
    const chosen = choose(state, card).state;
    if (status === 'departed') chosen.guild.heroes = [];
    else chosen.guild.heroes[0]!.status = status;
    const rng = structuredClone(chosen.rng);
    const events: GameEvent[] = [];
    applyDelayedEffects(chosen, DAY, events, [card]);
    expect(events[0]?.text).toContain(`${hero.name} voltou bem`);
    expect(events[0]?.data.morale).toBe(5);
    expect(chosen.rng).toEqual(rng);
  });

  it.each(['full', 'half'] as const)('cura %s respeita o tempo restante e a porta de recuperação', (mode) => {
    const state = site(); const hero = addHero(state);
    hero.status = 'injured'; hero.injury = { severity: 'severe', untilMs: 10_001 };
    const card = sample([{ type: 'healHero', mode }], { injuredHero: true });
    const result = choose(state, card);
    const healed = result.state.guild.heroes[0]!;
    if (mode === 'full') {
      expect(healed.status).toBe('idle'); expect(healed.injury).toBeNull();
      expect(result.events.map((event) => event.type)).toEqual(['cardAnswered', 'heroRecovered']);
    } else {
      expect(healed.injury).toEqual({ severity: 'severe', untilMs: 5_001 });
      expect(advanceTo(result.state, 5_000).state.guild.heroes[0]?.status).toBe('injured');
      expect(advanceTo(result.state, 5_001).state.guild.heroes[0]?.status).toBe('idle');
    }
  });

  it('o curandeiro atrasado não cura outro herói e a Crônica diz que chegou tarde', () => {
    const state = site(); const hero = addHero(state, { name: 'Ada' });
    hero.status = 'injured'; hero.injury = { severity: 'light', untilMs: DAY };
    const card = sample([{ type: 'healHero', mode: 'full' }], { injuredHero: true });
    const pending = dealt(state, card.id, [card]);
    pending.state.guild.heroes = [];
    const other = addHero(pending.state, { name: 'Bia' });
    other.status = 'injured'; other.injury = { severity: 'severe', untilMs: 2 * DAY };
    const events: GameEvent[] = [];
    expect(answerCard(pending.state, pending.instanceId, 'choose', 0, events, [card])).toBeNull();
    expect(events[0]?.text).toContain('chegou tarde'); expect(events[0]?.text).toContain('Ada');
    expect(other.injury.untilMs).toBe(2 * DAY);
    const waitPending = dealt(state, card.id, [card]);
    waitPending.state.guild.heroes = [];
    const waitEvents: GameEvent[] = [];
    expect(answerCard(waitPending.state, waitPending.instanceId, 'wait', 0, waitEvents, [card])).toBeNull();
    expect(waitEvents[0]?.text).toContain('esperou');
  });

  it('o teto de quatro ofertas permanece recarregável após a rotação extra', () => {
    const state = site(); state.settlement.buildings.tavern = 5;
    state.guild.tavern.extraOffer = true;
    const rotated = advanceTo(state, state.guild.tavern.nextRotationAtMs!).state;
    expect(rotated.guild.tavernOffers).toHaveLength(4);
    expect(currentShape(rotated, '')).toBeNull();
  });

  it('os schemas aceitam os novos efeitos, o ramo sem dano e os limites do requisito', () => {
    const card = sample([{ ...risk, onMiss: { effects: [], chronicle: risk.type === 'rollEffect' ? risk.onMiss.chronicle : '' } }], { heroPresent: 2 });
    expect(CouncilCardSchema.safeParse(card).success).toBe(true);
    expect(CouncilCardSchema.safeParse({ ...card, requires: { heroPresent: 3 } }).success).toBe(false);
    expect(meetsRequirements(site(), sample([], { seasons: ['spring', 'summer', 'autumn'], heroPresent: 2 }), WINTER)).toBe(false);
  });
});
