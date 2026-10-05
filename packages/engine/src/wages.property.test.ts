import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { goldCoversWages, goldRunsOutIn } from './economy';
import { isLoyal, wageRate } from './heroes';
import { currentShape } from './migrations';
import { addHero, command, HOUR } from './test-helpers';
import { nextEventAt } from './timeline';
import { cloneState, createInitialState } from './state';
import type { Command, DifficultyId, GameEvent, GameState } from './types';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;

/**
 * Um feudo de verdade (objetivos, Conselho, lobos, moral e fome no caminho, com os sorteios
 * deles), com heróis postos em um instante qualquer e pouco ouro: o soldo abre e fecha o atraso
 * com o que a Mina, os prêmios dos objetivos e as cartas trazem, e as viradas cobram os prazos.
 */
const scenario = fc.record({
  seed: fc.constantFrom('pedra-alta', 'vau-do-corvo', 'soldo-3'),
  timeScale: fc.constantFrom(3, 1, 0.5),
  difficulty: fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
  workers: fc.tuple(fc.nat(3), fc.nat(2), fc.nat(1), fc.nat(3)),
  heroes: fc.array(fc.record({ loyal: fc.boolean(), earlierMs: fc.nat(3 * HOUR) }), {
    maxLength: 5,
  }),
  // Em milésimos, para o resto do acumulador nascer "quebrado".
  gold: fc.nat(40_000),
  warmUpMs: fc.nat(2 * DAY_REAL),
  // Em tempo real: no ritmo 3 são até 12 dias de jogo por ms sorteado.
  firstRealMs: fc.integer({ min: 1, max: 3 * DAY_REAL }),
  secondRealMs: fc.integer({ min: 1, max: 3 * DAY_REAL }),
  dismiss: fc.nat(5),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

function prepare(plan: Scenario): GameState {
  const fresh = createInitialState(plan.seed, {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: plan.difficulty,
    timeScale: plan.timeScale,
  });
  let state = advanceTo(fresh, Math.round(plan.warmUpMs * plan.timeScale)).state;
  const [farm, lumberMill, quarry, goldMine] = plan.workers;
  const orders: Command[] = [
    command('setWorkers', { building: 'farm', count: farm }),
    command('setWorkers', { building: 'lumberMill', count: lumberMill }),
    command('setWorkers', { building: 'quarry', count: quarry }),
    command('setWorkers', { building: 'goldMine', count: goldMine }),
  ];
  for (const order of orders) {
    const result = applyCommand(state, order, state.lastProcessedAt);
    if (result.ok) {
      state = result.state;
    }
  }
  // Os heróis chegam agora, como uma carta os traria; o ouro é o que sobrou no cofre.
  const draft = cloneState(state);
  for (const hero of plan.heroes) {
    addHero(draft, {
      traits: hero.loyal ? ['loyal'] : [],
      joinedAtMs: Math.max(0, draft.lastProcessedAt - hero.earlierMs),
    });
  }
  draft.settlement.resources.gold = plan.gold;
  return draft;
}

/** O que vale em todo estado em repouso, com heróis ou sem. */
function expectWageInvariants(state: GameState): void {
  const { guild, settlement } = state;
  expect(settlement.resources.gold).toBeGreaterThanOrEqual(0);
  // O estado inteiro continua na forma da versão: é o que o servidor confere ao gravar.
  expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();
  if (guild.wageArrears !== null) {
    // Atraso aberto é soldo a pagar e cofre que não cobre nem um instante dele.
    expect(wageRate(state)).toBeGreaterThan(0);
    expect(goldCoversWages(state)).toBe(false);
    expect(settlement.resources.gold).toBe(0);
    expect(guild.lastWageArrears).toBeNull();
  } else {
    // Sem atraso, o ouro cobre ao menos um instante: nada ficou por abrir.
    expect(goldRunsOutIn(state)).not.toBe(0);
    expect(guild.heroes.filter((hero) => hero.discontent)).toEqual([]);
  }
  expect(guild.heroes.filter((hero) => hero.discontent && isLoyal(hero))).toEqual([]);
  // Em repouso o próximo evento é sempre depois de agora.
  expect(nextEventAt(state)).toBeGreaterThan(state.lastProcessedAt);
}

/** Nenhum instante fecha e reabre o atraso: no máximo uma das duas linhas por instante. */
function expectNoOscillation(events: GameEvent[]): void {
  const seen = new Set<number>();
  for (const event of events) {
    if (event.type !== 'wageArrearsStarted' && event.type !== 'wageArrearsEnded') {
      continue;
    }
    expect(seen.has(event.atMs), `atraso que oscila em ${event.atMs}`).toBe(false);
    seen.add(event.atMs);
  }
}

describe('divisão de intervalo com heróis, soldo e atraso no caminho', () => {
  it('advanceTo(t3) é idêntico a advanceTo(t2) seguido de advanceTo(t3): estado, eventos e gerador', () => {
    let opened = 0;
    let closed = 0;
    let left = 0;
    let sour = 0;
    fc.assert(
      fc.property(scenario, (plan) => {
        const start = prepare(plan);
        const frozen = JSON.stringify(start);
        const t2 = start.lastProcessedAt + Math.round(plan.firstRealMs * plan.timeScale);
        const t3 = t2 + Math.round(plan.secondRealMs * plan.timeScale);

        const direct = advanceTo(start, t3);
        const half = advanceTo(start, t2);
        const split = advanceTo(half.state, t3);

        expect(split.state).toStrictEqual(direct.state);
        expect(split.state.rng).toStrictEqual(direct.state.rng);
        expect(split.state.ids).toStrictEqual(direct.state.ids);
        expect([...half.events, ...split.events]).toStrictEqual(direct.events);

        expectWageInvariants(half.state);
        expectWageInvariants(direct.state);
        expectNoOscillation(direct.events);
        // Ninguém entra no feudo por conta própria, e o contador só conhece quem foi posto.
        expect(direct.state.ids.hero ?? 0).toBe(plan.heroes.length);
        expect(direct.state.guild.heroes.length).toBeLessThanOrEqual(plan.heroes.length);
        expect(JSON.stringify(start)).toBe(frozen);

        opened += direct.events.filter((event) => event.type === 'wageArrearsStarted').length;
        closed += direct.events.filter((event) => event.type === 'wageArrearsEnded').length;
        left += direct.events.filter((event) => event.type === 'heroLeft').length;
        sour += direct.events.filter((event) => event.type === 'heroDiscontent').length;
      }),
      { numRuns: 150 },
    );
    // A propriedade passou mesmo pelo que diz provar.
    expect(opened).toBeGreaterThan(20);
    expect(closed).toBeGreaterThan(10);
    expect(sour).toBeGreaterThan(10);
    expect(left).toBeGreaterThan(10);
  });

  it('vale em dez pedaços, com o estado passando pelo banco em cada corte', () => {
    fc.assert(
      fc.property(
        scenario,
        fc.array(fc.integer({ min: 1, max: DAY_REAL }), { minLength: 9, maxLength: 9 }),
        (plan, cuts) => {
          const start = prepare(plan);
          let state = start;
          const events: GameEvent[] = [];
          for (const cut of cuts) {
            const step = advanceTo(state, state.lastProcessedAt + Math.round(cut * plan.timeScale));
            state = JSON.parse(JSON.stringify(step.state)) as GameState;
            events.push(...step.events);
            expectWageInvariants(state);
          }
          const direct = advanceTo(start, state.lastProcessedAt);
          expect(state).toStrictEqual(direct.state);
          expect(events).toStrictEqual(direct.events);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('vale com ordens no meio: gastar ouro em um instante qualquer', () => {
    fc.assert(
      fc.property(scenario, (plan) => {
        const start = prepare(plan);
        const t1 = start.lastProcessedAt + Math.round(plan.firstRealMs * plan.timeScale);
        let state = advanceTo(start, t1).state;
        const orders: Command[] = [command('recruitVillagers', { quantity: 1 })];
        for (const order of orders) {
          const result = applyCommand(state, order, t1);
          if (result.ok) {
            expectNoOscillation(result.events);
            state = result.state;
            expectWageInvariants(state);
          }
        }
        const t3 = t1 + Math.round(plan.secondRealMs * plan.timeScale);
        const t2 = t1 + Math.floor((t3 - t1) / 3);
        const direct = advanceTo(state, t3);
        const split = advanceTo(advanceTo(state, t2).state, t3);
        expect(split.state).toStrictEqual(direct.state);
        expectWageInvariants(direct.state);
      }),
      { numRuns: 80 },
    );
  });

  it('a visão de qualquer desses feudos não muda o estado, e o prazo do ouro nunca passa do instante em que o atraso abre', () => {
    fc.assert(
      fc.property(scenario, (plan) => {
        const start = advanceTo(prepare(plan), prepare(plan).lastProcessedAt + 1).state;
        const frozen = JSON.stringify(start);
        const view = deriveViewState(start, start.lastProcessedAt);
        expect(JSON.stringify(start)).toBe(frozen);
        const seconds = view.resources.find((row) => row.id === 'gold')?.depletesInSeconds ?? null;
        if (start.guild.heroes.length === 0 || start.guild.wageArrears !== null) {
          expect(seconds).toBeNull();
        }
      }),
      { numRuns: 60 },
    );
  });
});
