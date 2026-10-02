import { balance, DIFFICULTY_IDS, objectives } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { answerCard, type Catalog } from './council';
import { councilView } from './councilView';
import { cloneState, createInitialState } from './state';
import { advanceWithCards, command, DAY, HOUR, settings, testCards } from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';
import { deriveViewState } from './view';

/**
 * A divisão de intervalo com o Conselho no caminho (roadmap V2D-T1.9): sorteios de verdade no
 * fluxo `council`, cartas que expiram com a opção da dificuldade, efeitos escondidos que
 * acontecem dias depois, continuações que esperam lugar e respostas do jogador em instantes
 * quaisquer. Avançar de uma vez ou aos pedaços dá o mesmo estado, os mesmos eventos e o mesmo
 * gerador, sem tolerância.
 */

const { maxPending } = balance.council;

type Advance = (state: GameState, toMs: number) => { state: GameState; events: GameEvent[] };

/** Uma visita do jogador: quanto tempo depois da anterior, e que opção ele tenta na 1ª carta. */
const visit = fc.record({
  waitMs: fc.integer({ min: 1, max: 9 * DAY }),
  // Um corte no meio da espera, para comparar com o avanço direto.
  cut: fc.double({ min: 0, max: 1, noNaN: true }),
  option: fc.nat(3),
});

const plan = fc.record({
  seed: fc.string({ minLength: 1, maxLength: 8 }),
  difficulty: fc.constantFrom(...DIFFICULTY_IDS),
  timeScale: fc.constantFrom(0.5, 1, 3),
  granary: fc.boolean(),
  visits: fc.array(visit, { minLength: 1, maxLength: 12 }),
});

type Plan = typeof plan extends fc.Arbitrary<infer T> ? T : never;

/**
 * Um feudo em repouso que se sustenta: gente na Fazenda e os objetivos já cumpridos, para o
 * primeiro avanço não ter recompensa pendente a creditar.
 */
function settled(seed: string, difficulty: Plan['difficulty'], timeScale: number): GameState {
  const state = createInitialState(seed, { ...settings, difficulty, timeScale });
  state.settlement.workers = { farm: 3, lumberMill: 1, quarry: 0, goldMine: 1 };
  state.objectives = { active: [], completed: objectives.map((objective) => objective.id) };
  return state;
}

function start({ seed, difficulty, timeScale, granary }: Plan): GameState {
  const state = settled(seed, difficulty, timeScale);
  state.settlement.buildings.granary = granary ? 1 : 0;
  return state;
}

/** O que vale para o Conselho em qualquer estado em repouso. */
function expectCouncilAtRest(state: GameState, catalog: Catalog): void {
  const now = state.lastProcessedAt;
  const { council } = state;
  expect(council.pending.length).toBeLessThanOrEqual(maxPending);
  for (const pending of council.pending) {
    expect(pending.expiresAtMs).toBeGreaterThan(now);
    expect(pending.drawnAtMs).toBeLessThanOrEqual(now);
  }
  for (const delayed of council.delayed) {
    expect(delayed.atMs).toBeGreaterThan(now);
    // O efeito escondido é sempre de uma virada de dia.
    expect(delayed.atMs % DAY).toBe(0);
  }
  // Nenhuma continuação vencida fica de fora com lugar na mesa.
  const overdue = council.scheduled.filter(
    (entry) => entry.atMs <= now && catalog.some((card) => card.id === entry.cardId),
  );
  if (council.pending.length < maxPending) {
    expect(overdue).toEqual([]);
  }
  // As listas com hora marcada ficam em ordem.
  const times = (list: Array<{ atMs: number }>) => list.map((entry) => entry.atMs);
  expect(times(council.scheduled)).toEqual([...times(council.scheduled)].sort((a, b) => a - b));
  expect(times(council.delayed)).toEqual([...times(council.delayed)].sort((a, b) => a - b));
  // A próxima audiência é depois de agora, e em uma virada de dia.
  expect(council.nextDrawAtMs).toBeGreaterThan(now);
  expect(council.nextDrawAtMs % DAY).toBe(0);
  expect(nextEventAt(state)).toBeGreaterThan(now);
  for (const amount of Object.values(state.settlement.resources)) {
    expect(amount).toBeGreaterThanOrEqual(0);
  }
  // Uma ocorrência nunca se repete.
  const instances = council.pending.map((entry) => entry.instanceId);
  expect(new Set(instances).size).toBe(instances.length);
}

describe('divisão de intervalo com o Conselho no caminho', () => {
  it('com as cartas de teste: sorteio, expiração, efeito escondido, continuação e respostas', () => {
    const seen = { drawn: 0, expired: 0, applied: 0, continued: 0, answered: 0 };
    const advance: Advance = (state, toMs) => advanceWithCards(state, toMs, testCards);
    fc.assert(
      fc.property(plan, (scenario) => {
        let direct = start(scenario);
        let split = direct;
        const directEvents: GameEvent[] = [];
        const splitEvents: GameEvent[] = [];
        for (const { waitMs, cut, option } of scenario.visits) {
          const to = direct.lastProcessedAt + waitMs;
          const whole = advance(direct, to);
          direct = whole.state;
          directEvents.push(...whole.events);

          const middle = split.lastProcessedAt + Math.floor(waitMs * cut);
          const first = advance(split, middle);
          const second = advance(first.state, to);
          split = second.state;
          splitEvents.push(...first.events, ...second.events);

          expect(split).toStrictEqual(direct);
          expectCouncilAtRest(direct, testCards);
          // A visão não inventa carta nem mostra o que é segredo.
          const shown = councilView(direct, scenario.timeScale, testCards);
          expect(shown.council.pending.map((entry) => entry.instanceId)).toEqual(
            direct.council.pending.map((entry) => entry.instanceId),
          );
          expect(JSON.stringify(shown)).not.toContain('cordas');

          // O jogador responde à primeira carta da mesa, com a opção que o plano sorteou; a
          // recusa (opção que não existe, trancada ou cara demais) não muda nada.
          const pending = direct.council.pending[0];
          if (pending !== undefined) {
            const card = testCards.find((entry) => entry.id === pending.cardId);
            const optionId = card?.options[option]?.id ?? 'nenhuma';
            const draft = cloneState(direct);
            const events: GameEvent[] = [];
            const rejection = answerCard(
              draft,
              pending.instanceId,
              optionId,
              to,
              events,
              testCards,
            );
            if (rejection === null) {
              direct = draft;
              split = cloneState(draft);
              directEvents.push(...events);
              splitEvents.push(...events);
              seen.answered += 1;
              expectCouncilAtRest(direct, testCards);
            }
          }
        }
        expect(splitEvents).toStrictEqual(directEvents);
        expect(split.rng).toStrictEqual(direct.rng);
        const count = (type: GameEvent['type']) =>
          directEvents.filter((event) => event.type === type).length;
        seen.drawn += count('cardDrawn');
        seen.expired += count('cardExpired');
        seen.applied += count('cardEffectApplied');
        seen.continued += directEvents.filter(
          (event) => event.type === 'cardDrawn' && event.data.source === 'continuation',
        ).length;
      }),
      { numRuns: 300 },
    );
    // A propriedade passou mesmo pelo que diz provar.
    expect(seen.drawn).toBeGreaterThan(300);
    expect(seen.expired).toBeGreaterThan(50);
    expect(seen.applied).toBeGreaterThan(20);
    expect(seen.continued).toBeGreaterThan(20);
    expect(seen.answered).toBeGreaterThan(100);
  });

  it('com as cartas do jogo, pela porta do jogo: advanceTo e applyCommand', () => {
    const seen = { drawn: 0, expired: 0, answered: 0, refused: 0 };
    fc.assert(
      fc.property(plan, (scenario) => {
        let direct = start(scenario);
        let split = direct;
        const directEvents: GameEvent[] = [];
        const splitEvents: GameEvent[] = [];
        for (const { waitMs, cut, option } of scenario.visits) {
          const to = direct.lastProcessedAt + waitMs;
          const whole = advanceTo(direct, to);
          direct = whole.state;
          directEvents.push(...whole.events);
          const first = advanceTo(split, split.lastProcessedAt + Math.floor(waitMs * cut));
          const second = advanceTo(first.state, to);
          split = second.state;
          splitEvents.push(...first.events, ...second.events);
          expect(split).toStrictEqual(direct);

          // O jogador vê a carta na visão e responde por ela, como o app.
          const view = deriveViewState(direct, to);
          expect(view.pendingDecisions).toHaveLength(direct.council.pending.length);
          const shown = view.council.pending[0];
          if (shown !== undefined) {
            const optionId = shown.options[option % shown.options.length]?.id ?? '';
            const order = command('answerCard', { instanceId: shown.instanceId, optionId });
            const result = applyCommand(direct, order, to);
            if (result.ok) {
              direct = result.state;
              split = cloneState(result.state);
              directEvents.push(...result.events);
              splitEvents.push(...result.events);
              seen.answered += 1;
            } else {
              // A visão já dizia: a opção estava trancada ou o estoque não pagava.
              const chosen = shown.options.find((entry) => entry.id === optionId);
              expect(chosen?.locked === true || chosen?.affordable === false).toBe(true);
              seen.refused += 1;
            }
          }
        }
        expect(splitEvents).toStrictEqual(directEvents);
        seen.drawn += directEvents.filter((event) => event.type === 'cardDrawn').length;
        seen.expired += directEvents.filter((event) => event.type === 'cardExpired').length;
      }),
      { numRuns: 150 },
    );
    expect(seen.drawn).toBeGreaterThan(150);
    expect(seen.answered).toBeGreaterThan(50);
    expect(seen.expired + seen.refused).toBeGreaterThan(0);
  });

  it('uma ausência longa: de uma vez ou hora a hora, as mesmas cartas nos mesmos instantes', () => {
    for (const timeScale of [0.5, 1, 3]) {
      const begin = settled('ausencia', 'lord', timeScale);
      const end = 60 * DAY;
      const atOnce = advanceWithCards(begin, end, testCards);
      let stepped = begin;
      const events: GameEvent[] = [];
      for (let at = HOUR; at <= end; at += HOUR) {
        const step = advanceWithCards(stepped, at, testCards);
        stepped = step.state;
        events.push(...step.events);
      }
      expect(stepped).toStrictEqual(atOnce.state);
      expect(events).toStrictEqual(atOnce.events);
      expect(atOnce.events.some((event) => event.type === 'cardExpired')).toBe(true);
    }
  });
});
