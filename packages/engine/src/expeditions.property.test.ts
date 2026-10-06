import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { currentShape } from './migrations';
import { createInitialState } from './state';
import { command, HOUR, settings } from './test-helpers';
import { nextEventAt } from './timeline';
import type { Command, DifficultyId, GameEvent, GameState, PostureId } from './types';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;

/**
 * Um feudo de verdade (objetivos, Conselho, lobos, moral, a carta da estrangeira e a Taverna no
 * caminho, com os sorteios deles), com o Salão no nível 3, a Guilda de pé e três heróis. O
 * senhor passa pela Guilda em instantes quaisquer: envia quem está livre e responde (ou não) às
 * encruzilhadas. Os nós, os prazos, os sorteios e o nascimento e a morte de cada fluxo
 * `expedition:<id>` caem em instantes que nenhum teste escolheu (README do motor, R5).
 */
const scenario = fc.record({
  seed: fc.constantFrom('pedra-alta', 'vau-do-corvo', 'guilda-9'),
  timeScale: fc.constantFrom(3, 1, 0.5),
  difficulty: fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
  guildLevel: fc.constantFrom(1, 2, 4),
  workers: fc.tuple(fc.nat(3), fc.nat(2), fc.nat(1), fc.nat(3)),
  // Em milésimos, para o resto do acumulador nascer "quebrado". Às vezes o ouro acaba no caminho.
  gold: fc.integer({ min: 0, max: 400_000 }),
  wood: fc.integer({ min: 100_000, max: 499_000 }),
  warmUpMs: fc.nat(2 * DAY_REAL),
  visits: fc.array(
    fc.record({
      // Em tempo real: no ritmo 3 são até 3 h de jogo por visita.
      afterRealMs: fc.integer({ min: 1, max: HOUR }),
      model: fc.constantFrom('patrol', 'oldForest'),
      posture: fc.constantFrom<PostureId>('cautious', 'balanced', 'bold'),
      teamSize: fc.constantFrom(1, 2),
      answer: fc.constantFrom('none', 'first', 'last', 'posture'),
      dismiss: fc.boolean(),
    }),
    { minLength: 6, maxLength: 12 },
  ),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;
type Visit = Scenario['visits'][number];

function prepare(plan: Scenario): GameState {
  const state = createInitialState(plan.seed, {
    ...settings,
    timeScale: plan.timeScale,
    difficulty: plan.difficulty,
  });
  const [farm, lumberMill, quarry, goldMine] = plan.workers;
  Object.assign(state.settlement.buildings, { townHall: 3, guild: plan.guildLevel });
  state.settlement.population.villagers = 10;
  Object.assign(state.settlement.workers, { farm, lumberMill, quarry, goldMine });
  state.settlement.resources.gold = plan.gold;
  state.settlement.resources.wood = plan.wood;
  const names = ['Edda', 'Rolf', 'Brann'];
  const classes = ['warrior', 'archer', 'mage'] as const;
  const traits = [['brave'], ['prudent'], ['loyal']] as const;
  state.ids.hero = 3;
  state.guild.heroes = names.map((name, index) => ({
    id: `hero-${index + 1}`,
    name,
    gender: 'm',
    classId: classes[index] ?? 'warrior',
    level: 1 + index,
    xp: 0,
    traits: [...(traits[index] ?? [])],
    status: 'idle',
    joinedAtMs: 0,
    discontent: false,
  }));
  return advanceTo(state, Math.round(plan.warmUpMs * plan.timeScale)).state;
}

/** As ordens de uma visita à Guilda, lidas da visão: aceitas ou recusadas, o estado segue. */
function visit(state: GameState, plan: Visit): { state: GameState; events: GameEvent[] } {
  const now = state.lastProcessedAt;
  const view = deriveViewState(state, now);
  const orders: Command[] = [];
  for (const expedition of view.guild.expeditions) {
    const { crossroads } = expedition;
    if (crossroads === null || plan.answer === 'none') {
      continue;
    }
    const option =
      plan.answer === 'posture'
        ? crossroads.postureOptionId
        : plan.answer === 'first'
          ? crossroads.options[0]?.id
          : crossroads.options.at(-1)?.id;
    orders.push(
      command('chooseExpeditionPath', { expeditionId: expedition.id, optionId: option ?? '' }),
    );
  }
  const free = view.guild.heroes.filter((hero) => hero.atHome).map((hero) => hero.id);
  orders.push(
    command('sendExpedition', {
      modelId: plan.model,
      heroIds: free.slice(0, plan.teamSize),
      posture: plan.posture,
    }),
  );
  if (plan.dismiss && free.length > 2) {
    orders.push(command('dismissHero', { heroId: free.at(-1) ?? '' }));
  }
  let current = state;
  const events: GameEvent[] = [];
  for (const order of orders) {
    const result = applyCommand(current, order, now);
    if (result.ok) {
      current = result.state;
      events.push(...result.events);
    }
  }
  return { state: current, events };
}

const stored = (state: GameState) => JSON.parse(JSON.stringify(state)) as GameState;

/** O que tem de valer em qualquer instante de qualquer partida com expedições. */
function expectInvariants(state: GameState): void {
  expect(currentShape(stored(state), '')).toBeNull();
  const live = state.guild.expeditions.map((entry) => `expedition:${entry.id}`);
  const streams = Object.keys(state.rng).filter((key) => key.startsWith('expedition:'));
  // Só sorteia quem está em curso: o fluxo de quem voltou foi apagado e não renasceu (R1).
  for (const stream of streams) {
    expect(live).toContain(stream);
  }
  expect(state.guild.reports.length).toBeLessThanOrEqual(3);
  for (const expedition of state.guild.expeditions) {
    const at = expedition.crossroads?.decidesAtMs ?? expedition.nodeEndsAtMs ?? 0;
    expect(at).toBeGreaterThan(state.lastProcessedAt);
  }
  const next = nextEventAt(state);
  expect(next === null || next >= state.lastProcessedAt).toBe(true);
}

describe('a divisão de intervalo com expedições no caminho', () => {
  it('avançar de uma vez ou em dois pedaços dá o mesmo estado, os mesmos eventos, o mesmo gerador e os mesmos contadores, com ordens entre os avanços', () => {
    let returned = 0;
    let decided = 0;
    let chosen = 0;
    fc.assert(
      fc.property(
        scenario,
        fc.array(fc.nat(1000), { minLength: 12, maxLength: 12 }),
        (plan, cuts) => {
          let state = prepare(plan);
          for (const [index, step] of plan.visits.entries()) {
            const ordered = visit(state, step);
            chosen += ordered.events.filter((e) => e.type === 'expeditionPathChosen').length;
            state = stored(ordered.state);
            expectInvariants(state);
            // Ora um passo curto, ora um que atravessa o prazo de 6 h reais da encruzilhada.
            const realMs = index % 3 === 2 ? 7 * HOUR + step.afterRealMs : step.afterRealMs;
            const target = state.lastProcessedAt + Math.round(realMs * plan.timeScale);
            const span = target - state.lastProcessedAt;
            const middle = state.lastProcessedAt + Math.floor((span * (cuts[index] ?? 500)) / 1000);
            const direct = advanceTo(state, target);
            const half = advanceTo(state, middle);
            const split = advanceTo(stored(half.state), target);
            expect(split.state).toStrictEqual(direct.state);
            expect(split.state.rng).toStrictEqual(direct.state.rng);
            expect(split.state.ids).toStrictEqual(direct.state.ids);
            expect([...half.events, ...split.events]).toStrictEqual(direct.events);
            expectInvariants(half.state);
            expectInvariants(direct.state);
            returned += direct.events.filter((e) => e.type === 'expeditionReturned').length;
            decided += direct.events.filter((e) => e.type === 'expeditionPostureDecided').length;
            state = direct.state;
          }
        },
      ),
      { numRuns: 60 },
    );
    // O cenário passou mesmo pelas expedições: voltas (com o fluxo apagado), prazos e escolhas.
    expect(returned).toBeGreaterThan(100);
    expect(decided).toBeGreaterThan(20);
    expect(chosen).toBeGreaterThan(20);
  });

  it('cortes de um milissegundo em volta de cada instante de uma expedição não mudam nada', () => {
    fc.assert(
      fc.property(scenario, (plan) => {
        let state = prepare(plan);
        const [first] = plan.visits;
        if (first === undefined) {
          return;
        }
        state = visit(state, { ...first, answer: 'none' }).state;
        const horizon = state.lastProcessedAt + Math.round(8 * HOUR * plan.timeScale);
        const direct = advanceTo(state, horizon);
        const instants = direct.events
          .filter((event) => event.type.startsWith('expedition'))
          .map((event) => event.atMs);
        let stepped = state;
        const events: GameEvent[] = [];
        for (const at of [...new Set(instants)].sort((a, b) => a - b)) {
          for (const cut of [at - 1, at, at + 1]) {
            if (cut > stepped.lastProcessedAt && cut <= horizon) {
              const piece = advanceTo(stored(stepped), cut);
              stepped = piece.state;
              events.push(...piece.events);
            }
          }
        }
        const last = advanceTo(stored(stepped), horizon);
        expect(last.state).toStrictEqual(direct.state);
        expect([...events, ...last.events]).toStrictEqual(direct.events);
      }),
      { numRuns: 60 },
    );
  });

  it('"pode enviar" e "pode escolher" na tela são a ordem ser aceita, e a visão não muda o estado', () => {
    let offers = 0;
    let options = 0;
    fc.assert(
      fc.property(scenario, (plan) => {
        let state = prepare(plan);
        for (const step of plan.visits.slice(0, 5)) {
          state = visit(state, step).state;
          state = advanceTo(
            state,
            state.lastProcessedAt + Math.round(step.afterRealMs * plan.timeScale),
          ).state;
          const now = state.lastProcessedAt;
          const frozen = JSON.stringify(state);
          const view = deriveViewState(state, now);
          nextEventAt(state);
          expect(JSON.stringify(state)).toBe(frozen);
          expect(view.guild.expeditions.map((entry) => entry.id)).toEqual(
            state.guild.expeditions.map((entry) => entry.id),
          );
          const free = view.guild.heroes.filter((hero) => hero.atHome).map((hero) => hero.id);
          for (const offer of view.guild.available) {
            const team = free.slice(0, offer.teamMin);
            const result = applyCommand(
              state,
              command('sendExpedition', {
                modelId: offer.modelId,
                heroIds: team,
                posture: 'balanced',
              }),
              now,
            );
            offers += 1;
            if (offer.locked) {
              expect(result.ok).toBe(false);
              expect(!result.ok && result.message).toBe(offer.lockedReason);
            } else {
              // Com o destino aberto, só a equipe pode faltar.
              expect(result.ok).toBe(team.length >= offer.teamMin);
            }
          }
          for (const expedition of view.guild.expeditions) {
            for (const option of expedition.crossroads?.options ?? []) {
              const result = applyCommand(
                state,
                command('chooseExpeditionPath', {
                  expeditionId: expedition.id,
                  optionId: option.id,
                }),
                now,
              );
              options += 1;
              expect(result.ok).toBe(!option.locked);
            }
          }
        }
      }),
      { numRuns: 40 },
    );
    expect(offers).toBeGreaterThan(200);
    expect(options).toBeGreaterThan(50);
  });
});
