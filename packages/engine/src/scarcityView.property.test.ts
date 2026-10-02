import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { nextSeasonBoundary } from './clock';
import { applyCommand } from './commands';
import { command, gameAt, WINTER, YEAR } from './test-helpers';
import type { GameEvent, GameState } from './types';
import { deriveViewState } from './view';

// O fim previsto da fome e do frio (`famine.endsInSeconds`, `winter.cold.endsInSeconds`) contra
// o motor andando de verdade. A visão não sorteia nem conta com quem parte: os caminhos em que a
// população muda são descartados.

const SECOND = 1000;
const HOUR = 3_600_000;

/** O que muda as bocas ou os braços sem ordem do jogador: a previsão não conta com isso. */
const UNFORESEEN: ReadonlyArray<GameEvent['type']> = [
  'villagerArrived',
  'villagerLeft',
  'villagerDeserted',
];
const unforeseen = (events: GameEvent[]) => events.some((event) => UNFORESEEN.includes(event.type));

/**
 * Um feudo com fome aberta (e, no inverno, sem madeira: com frio também), que acaba de receber
 * ordens: tantos na Fazenda, tantos na Serraria. Quem chegou agora ao ofício ainda se adapta.
 */
const hungryFiefs = fc
  .record({
    // O inverno é onde a adaptação decide: lá um lavrador mal alimenta duas bocas.
    atMs: fc.oneof(
      { weight: 3, arbitrary: fc.integer({ min: WINTER, max: YEAR - 1 }) },
      { weight: 1, arbitrary: fc.integer({ min: 0, max: WINTER - 1 }) },
    ),
    // Com três aldeões o piso segura todos: ninguém parte, e a previsão vale até o fim.
    villagers: fc.oneof(
      { weight: 2, arbitrary: fc.constant(3) },
      { weight: 3, arbitrary: fc.integer({ min: 4, max: 12 }) },
    ),
    veterans: fc.integer({ min: 0, max: 2 }),
    farmers: fc.integer({ min: 0, max: 8 }),
    lumberjacks: fc.integer({ min: 0, max: 3 }),
    farmLevel: fc.integer({ min: 1, max: 3 }),
    morale: fc.integer({ min: 0, max: 100 }),
    famineHours: fc.integer({ min: 1, max: 60 }),
    difficulty: fc.constantFrom('peasant', 'peasant', 'lord', 'ironKing'),
    timeScale: fc.constantFrom(1, 3, 7, 0.5),
  })
  .map((fief): GameState => {
    const veterans = Math.min(fief.veterans, fief.villagers);
    const start = gameAt(fief.atMs, (draft) => {
      const { settlement } = draft;
      draft.settings.difficulty = fief.difficulty as GameState['settings']['difficulty'];
      draft.settings.timeScale = fief.timeScale;
      settlement.population.villagers = fief.villagers;
      settlement.buildings.farm = fief.farmLevel;
      settlement.buildings.housing = 4;
      // Alguns lavradores já conhecem o ofício: sozinhos não bastam, ou a fome não estaria aberta.
      settlement.workers = { farm: veterans, lumberMill: 0, quarry: 0, goldMine: 0 };
      settlement.resources = { food: 0, wood: 0, stone: 0, gold: 0 };
      settlement.famine = { sinceMs: fief.atMs - fief.famineHours * HOUR };
      settlement.morale = fief.morale;
    });
    // Um milissegundo adiante: a fome e o frio que o cenário pede (ou dispensa) se acomodam.
    let state = advanceTo(start, start.lastProcessedAt + 1).state;
    const free = fief.villagers - veterans;
    const farmers = Math.min(fief.farmers, free);
    const lumberjacks = Math.min(fief.lumberjacks, free - farmers);
    for (const order of [
      command('setWorkers', { building: 'farm', count: veterans + farmers }),
      command('setWorkers', { building: 'lumberMill', count: lumberjacks }),
    ]) {
      const result = applyCommand(state, order, state.lastProcessedAt);
      if (result.ok) {
        state = result.state;
      }
    }
    return state;
  });

/** Confere um prazo anunciado contra o motor: a escassez segue aberta até lá e acaba naquele segundo. */
function expectEndsAt(
  state: GameState,
  seconds: number,
  open: (found: GameState) => boolean,
): 'compared' | 'discarded' {
  const now = state.lastProcessedAt;
  const { timeScale } = state.settings;
  const at = now + seconds * SECOND * timeScale;
  const reached = advanceTo(state, at);
  if (unforeseen(reached.events)) {
    return 'discarded';
  }
  expect(open(reached.state)).toBe(false);
  const before = at - SECOND * timeScale;
  if (before > now) {
    expect(open(advanceTo(state, before).state)).toBe(true);
  }
  return 'compared';
}

describe('o fim previsto da fome e do frio e o motor', () => {
  it('com prazo, a fome e o frio acabam naquele segundo; sem prazo, não acabam sozinhos antes de a estação virar', () => {
    let ended = 0;
    let stayed = 0;
    fc.assert(
      fc.property(hungryFiefs, (state) => {
        const now = state.lastProcessedAt;
        const before = JSON.stringify(state);
        const view = deriveViewState(state, now);
        expect(JSON.stringify(state)).toBe(before);
        const cold = view.winter?.cold ?? null;

        for (const [seconds, open] of [
          [
            view.famine?.endsInSeconds ?? null,
            (found: GameState) => found.settlement.famine !== null,
          ],
          [cold?.endsInSeconds ?? null, (found: GameState) => found.settlement.cold !== null],
        ] as const) {
          if (seconds !== null && expectEndsAt(state, seconds, open) === 'compared') {
            ended += 1;
          }
        }
        // Sem prazo: até a estação virar, nada acaba sem que algo imprevisto aconteça.
        const whole = advanceTo(state, nextSeasonBoundary(now) - 1);
        if (unforeseen(whole.events)) {
          return;
        }
        if (view.famine !== null && view.famine.endsInSeconds === null) {
          stayed += 1;
          expect(whole.events.some((event) => event.type === 'famineEnded')).toBe(false);
        }
        if (cold !== null && cold.endsInSeconds === null) {
          stayed += 1;
          expect(whole.events.some((event) => event.type === 'coldEnded')).toBe(false);
        }
      }),
      { numRuns: 400 },
    );
    // A propriedade não pode passar por só descartar: os dois casos são comparados de fato.
    expect(ended).toBeGreaterThan(20);
    expect(stayed).toBeGreaterThan(80);
  });
});
