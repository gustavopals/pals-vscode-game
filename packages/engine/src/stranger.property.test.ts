import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { currentShape } from './migrations';
import { createInitialState } from './state';
import { command, HOUR } from './test-helpers';
import { nextEventAt } from './timeline';
import type { DifficultyId, GameEvent, GameState } from './types';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;
const STRANGER = 'woundedStranger';

/**
 * Uma partida de verdade, do zero, em que a carta da estrangeira chega, é respondida (ou não) e
 * o herói entra na hora ou um dia de jogo depois. O senhor passa pelo feudo em horas reais
 * sorteadas e decide por um de quatro jeitos: nunca responde, responde a tudo com o que o
 * conselho faria, acolhe a estrangeira ou cuida dela e a deixa partir.
 */
const scenario = fc.record({
  seed: fc.constantFrom('pedra-alta', 'vau-do-corvo', 'estrangeira', 'soldo-3'),
  timeScale: fc.constantFrom(3, 1, 0.5),
  difficulty: fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
  policy: fc.constantFrom('absent', 'default', 'shelter', 'tend'),
  goldMiners: fc.nat(2),
  // As visitas, em horas reais desde a anterior: de poucos minutos a mais de um dia.
  visits: fc.array(fc.integer({ min: 5 * 60_000, max: 30 * HOUR }), { minLength: 3, maxLength: 9 }),
  // Onde o trecho entre duas visitas é cortado, em milésimos do trecho.
  cut: fc.integer({ min: 1, max: 999 }),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

/** Responde às cartas da mesa pela visão, como o app: só com o que o jogador vê. */
function decide(state: GameState, plan: Scenario, events: GameEvent[]): GameState {
  if (plan.policy === 'absent') {
    return state;
  }
  let current = state;
  const view = deriveViewState(state, state.lastProcessedAt, { timeScale: plan.timeScale });
  for (const card of view.council.pending) {
    const isStranger = card.title === 'Estrangeira ferida';
    const optionId = isStranger && plan.policy !== 'default' ? plan.policy : card.defaultOptionId;
    const result = applyCommand(
      current,
      command('answerCard', { instanceId: card.instanceId, optionId }),
      current.lastProcessedAt,
    );
    if (result.ok) {
      current = result.state;
      events.push(...result.events);
    }
  }
  return current;
}

/** Joga o plano inteiro; cada trecho entre visitas é avançado por `step`. */
function playThrough(
  plan: Scenario,
  step: (state: GameState, toMs: number) => { state: GameState; events: GameEvent[] },
): { state: GameState; events: GameEvent[] } {
  let state = createInitialState(plan.seed, {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: plan.difficulty,
    timeScale: plan.timeScale,
  });
  const events: GameEvent[] = [];
  const first = applyCommand(
    state,
    command('setWorkers', { building: 'goldMine', count: plan.goldMiners }),
    0,
  );
  if (first.ok) {
    state = first.state;
    events.push(...first.events);
  }
  for (const gap of plan.visits) {
    const result = step(state, state.lastProcessedAt + Math.round(gap * plan.timeScale));
    state = result.state;
    events.push(...result.events);
    state = decide(state, plan, events);
  }
  // Depois da última visita, o que ficou marcado acontece: a carta expira, o herói chega.
  const tail = step(state, state.lastProcessedAt + Math.round(3 * DAY_REAL * plan.timeScale));
  return { state: tail.state, events: [...events, ...tail.events] };
}

const whole = (state: GameState, toMs: number) => advanceTo(state, toMs);

describe('divisão de intervalo com a carta da estrangeira e o herói adiado no caminho', () => {
  it('cada trecho entre duas visitas dá o mesmo de uma vez ou em dois pedaços: estado, eventos, gerador e identidades', () => {
    let arrived = 0;
    let joined = 0;
    let later = 0;
    let answered = 0;
    let expired = 0;
    let crossed = 0;
    fc.assert(
      fc.property(scenario, (plan) => {
        const inTwo = (state: GameState, toMs: number) => {
          const span = toMs - state.lastProcessedAt;
          const middle = state.lastProcessedAt + Math.max(1, Math.floor((span * plan.cut) / 1000));
          const half = advanceTo(state, middle);
          const rest = advanceTo(half.state, toMs);
          // O corte caiu com o herói prometido ainda a caminho: é o caso que interessa.
          if (half.state.guild.arriving.length > 0 && rest.state.guild.arriving.length === 0) {
            crossed += 1;
          }
          // Em repouso, o próximo evento é sempre depois de agora, e o estado cabe na forma.
          expect(nextEventAt(half.state)).toBeGreaterThan(half.state.lastProcessedAt);
          expect(currentShape(JSON.parse(JSON.stringify(half.state)), '')).toBeNull();
          return { state: rest.state, events: [...half.events, ...rest.events] };
        };
        const direct = playThrough(plan, whole);
        const split = playThrough(plan, inTwo);
        expect(split.state).toStrictEqual(direct.state);
        expect(split.state.rng).toStrictEqual(direct.state.rng);
        expect(split.state.ids).toStrictEqual(direct.state.ids);
        expect(split.events).toStrictEqual(direct.events);

        // A carta chega no máximo uma vez, e dá no máximo um herói; resolvida, dá exatamente um.
        const drawn = direct.events.filter(
          (event) => event.type === 'cardDrawn' && event.data.cardId === STRANGER,
        );
        const resolved = direct.events.filter(
          (event) =>
            (event.type === 'cardAnswered' || event.type === 'cardExpired') &&
            event.data.cardId === STRANGER,
        );
        const heroes = direct.events.filter((event) => event.type === 'heroJoined');
        expect(drawn.length).toBeLessThanOrEqual(1);
        expect(resolved.length).toBeLessThanOrEqual(drawn.length);
        expect(heroes.length + direct.state.guild.arriving.length).toBe(resolved.length);
        expect(direct.state.ids.hero ?? 0).toBe(heroes.length);
        for (const hero of heroes) {
          const promise = resolved[0] as GameEvent;
          const days = Number(promise.data.heroAfterDays);
          expect(hero.data.namedHeroId).toBe(promise.data.hero);
          expect(hero.atMs).toBe(promise.atMs + days * 2 * HOUR);
        }
        expect(currentShape(JSON.parse(JSON.stringify(direct.state)), '')).toBeNull();

        arrived += drawn.length;
        joined += heroes.length;
        later += heroes.filter((event) => event.data.namedHeroId === 'rolf').length;
        answered += resolved.filter((event) => event.type === 'cardAnswered').length;
        expired += resolved.filter((event) => event.type === 'cardExpired').length;
      }),
      { numRuns: 120 },
    );
    // A propriedade passou mesmo pelo que diz provar.
    expect(arrived).toBeGreaterThan(60);
    expect(joined).toBeGreaterThan(40);
    expect(later).toBeGreaterThan(10);
    expect(answered).toBeGreaterThan(10);
    expect(expired).toBeGreaterThan(10);
    expect(crossed).toBeGreaterThan(3);
  });

  it('vale em muitos pedaços, com o estado passando pelo banco em cada corte', () => {
    fc.assert(
      fc.property(scenario, fc.integer({ min: 2, max: 7 }), (plan, pieces) => {
        const inPieces = (state: GameState, toMs: number) => {
          let current = state;
          const events: GameEvent[] = [];
          const span = toMs - state.lastProcessedAt;
          for (let piece = 1; piece <= pieces; piece += 1) {
            const target =
              piece === pieces ? toMs : state.lastProcessedAt + Math.floor((span * piece) / pieces);
            const result = advanceTo(current, target);
            current = JSON.parse(JSON.stringify(result.state)) as GameState;
            events.push(...result.events);
          }
          return { state: current, events };
        };
        const direct = playThrough(plan, whole);
        const split = playThrough(plan, inPieces);
        expect(split.state).toStrictEqual(direct.state);
        expect(split.events).toStrictEqual(direct.events);
      }),
      { numRuns: 50 },
    );
  });

  it('a visão e a linha do tempo não criam o herói nem gastam identificador', () => {
    fc.assert(
      fc.property(scenario, (plan) => {
        const { state } = playThrough({ ...plan, visits: plan.visits.slice(0, 4) }, whole);
        const frozen = JSON.stringify(state);
        deriveViewState(state, state.lastProcessedAt, { timeScale: plan.timeScale });
        nextEventAt(state);
        expect(JSON.stringify(state)).toBe(frozen);
      }),
      { numRuns: 30 },
    );
  });
});
