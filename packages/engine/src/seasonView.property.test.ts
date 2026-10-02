import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { DAY_MS, nextSeasonBoundary, seasonAfter, seasonAt } from './clock';
import { gameAt, YEAR } from './test-helpers';
import type { GameEvent, GameState } from './types';
import { deriveViewState } from './view';

// A previsão da comida da próxima estação (`calendar.nextSeason.food`) contra o motor andando
// de verdade. A visão não sorteia nem conta com quem chega ou parte: a comparação só vale nos
// caminhos em que a população e o frio não mudam, e os outros são descartados.

const SECOND = 1000;

/** O que muda as bocas ou a produção sem ser a Fazenda: a previsão não conta com isso. */
const UNFORESEEN: ReadonlyArray<GameEvent['type']> = [
  'villagerArrived',
  'villagerLeft',
  'villagerDeserted',
  'coldStarted',
  'coldEnded',
];
const unforeseen = (events: GameEvent[]) => events.some((event) => UNFORESEEN.includes(event.type));

const fiefs = fc
  .record({
    atMs: fc.integer({ min: 0, max: 2 * YEAR - 1 }),
    villagers: fc.integer({ min: 3, max: 40 }),
    farmShare: fc.integer({ min: 0, max: 100 }),
    farmLevel: fc.integer({ min: 1, max: 4 }),
    housing: fc.integer({ min: 1, max: 8 }),
    granary: fc.integer({ min: 0, max: 3 }),
    food: fc.integer({ min: 0, max: 600_999 }),
    wood: fc.integer({ min: 0, max: 500_000 }),
    morale: fc.integer({ min: 0, max: 100 }),
    experience: fc.integer({ min: 0, max: 100 }),
    timeScale: fc.constantFrom(1, 3, 7, 0.5),
  })
  .map((fief): GameState => {
    const farm = Math.floor((fief.villagers * fief.farmShare) / 100);
    const start = gameAt(fief.atMs, (draft) => {
      const { settlement } = draft;
      settlement.population.villagers = fief.villagers;
      settlement.buildings.farm = fief.farmLevel;
      settlement.buildings.housing = fief.housing;
      settlement.buildings.granary = fief.granary;
      settlement.workers = {
        farm,
        lumberMill: fief.villagers - farm,
        quarry: 0,
        goldMine: 0,
      };
      settlement.resources = { food: fief.food, wood: fief.wood, stone: 0, gold: 0 };
      settlement.morale = fief.morale;
      settlement.craftExperience.farm = fief.experience;
      draft.settings.timeScale = fief.timeScale;
    });
    // Um milissegundo adiante: a fome e o frio que o cenário pede já estão abertos.
    return advanceTo(start, start.lastProcessedAt + 1).state;
  });

describe('a previsão da comida da próxima estação e o motor', () => {
  it('com prazo, a fome começa naquele segundo; sem prazo, não começa até a estação que vem acabar', () => {
    let compared = 0;
    fc.assert(
      fc.property(fiefs, (state) => {
        const now = state.lastProcessedAt;
        const { timeScale } = state.settings;
        const before = JSON.stringify(state);
        const view = deriveViewState(state, now);
        // Pedir a visão não mexe no estado: a previsão anda sobre cópias.
        expect(JSON.stringify(state)).toBe(before);

        const { food, secondsUntil } = view.calendar.nextSeason;
        if (food === null) {
          // Sem previsão: há fome, ou o prazo de agora cai antes da virada (ou a lenha acaba).
          return;
        }
        expect(view.famine).toBeNull();
        if (food.depletesInSeconds !== null) {
          expect(food.perHour).toBeLessThan(0);
          // O prazo conta de agora e nunca cai antes da virada.
          expect(food.depletesInSeconds).toBeGreaterThanOrEqual(secondsUntil - 1);
          const at = now + food.depletesInSeconds * SECOND * timeScale;
          const until = advanceTo(state, at - 1);
          if (unforeseen(until.events)) {
            return;
          }
          compared += 1;
          expect(until.state.settlement.famine).toBeNull();
          expect(advanceTo(state, at + SECOND * timeScale).state.settlement.famine).not.toBeNull();
          return;
        }
        if (food.text.includes('lenha')) {
          // A lenha acaba antes da comida: com o frio a conta é outra, e a visão não adivinha.
          return;
        }
        const turn = nextSeasonBoundary(now);
        const seasonEnd = turn + seasonAfter(seasonAt(now)).days * DAY_MS;
        const whole = advanceTo(state, seasonEnd - 1);
        if (unforeseen(whole.events)) {
          return;
        }
        compared += 1;
        expect(whole.events.some((event) => event.type === 'famineStarted')).toBe(false);
      }),
      { numRuns: 400 },
    );
    // A propriedade não pode passar por só descartar: a maior parte dos feudos é comparada.
    expect(compared).toBeGreaterThan(200);
  });
});
