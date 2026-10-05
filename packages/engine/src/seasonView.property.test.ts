import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { DAY_MS, nextSeasonBoundary, seasonAfter, seasonAt } from './clock';
import { applyCommand } from './commands';
import { command, gameAt, YEAR } from './test-helpers';
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

/** Quem chega ou parte: a previsão conta com os habitantes de agora. */
const PEOPLE: ReadonlyArray<GameEvent['type']> = [
  'villagerArrived',
  'villagerLeft',
  'villagerDeserted',
];
const unforeseenPeople = (events: GameEvent[]) =>
  events.some((event) => PEOPLE.includes(event.type));

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

// "Acaba em" da madeira, no inverno, com uma obra automática à espera de ouro: o motor a inicia
// sozinho e ela leva madeira da lareira. O prazo anunciado conta com isso.

const winterFiefs = fc
  .record({
    intoWinter: fc.integer({ min: 0, max: 8 * DAY_MS - 1 }),
    villagers: fc.integer({ min: 6, max: 24 }),
    lumberjacks: fc.integer({ min: 0, max: 1 }),
    miners: fc.integer({ min: 0, max: 4 }),
    // Um em cada quatro feudos entra com o pátio quase vazio: é onde a ordem dos
    // acontecimentos decide, e a Serraria que só alcança a lareira depois da virada não basta.
    wood: fc.oneof(
      { weight: 3, arbitrary: fc.integer({ min: 0, max: 200_999 }) },
      { weight: 1, arbitrary: fc.integer({ min: 0, max: 2_999 }) },
    ),
    gold: fc.integer({ min: 0, max: 39_999 }),
    morale: fc.integer({ min: 0, max: 100 }),
    timeScale: fc.constantFrom(1, 3, 7, 0.5),
  })
  .map(winterFief);

function winterFief(fief: {
  intoWinter: number;
  villagers: number;
  lumberjacks: number;
  miners: number;
  wood: number;
  gold: number;
  morale: number;
  timeScale: number;
}): GameState {
  const winter = YEAR - 12 * DAY_MS;
  const start = gameAt(winter + fief.intoWinter, (draft) => {
    const { settlement } = draft;
    settlement.population.villagers = fief.villagers;
    settlement.buildings.housing = 5;
    settlement.buildings.granary = 3;
    settlement.workers = {
      farm: fief.villagers - fief.lumberjacks - fief.miners,
      lumberMill: fief.lumberjacks,
      quarry: 0,
      goldMine: fief.miners,
    };
    settlement.resources = { food: 1_500_000, wood: fief.wood, stone: 0, gold: fief.gold };
    settlement.morale = fief.morale;
    settlement.planned = [{ building: 'farm', targetLevel: 2, autoStart: true }];
    draft.settings.timeScale = fief.timeScale;
  });
  // Um milissegundo adiante: o frio que o cenário pede já está aberto.
  return advanceTo(start, start.lastProcessedAt + 1).state;
}

/**
 * O caso de C-8: primeiro instante do inverno, 10 habitantes, um lenhador, o pátio quase vazio
 * e a moral em zero. A virada do dia sobe a moral e a Serraria passa a cobrir a lareira, mas a
 * lenha acaba antes: a conta que somava o inverno inteiro dizia "dão conta".
 */
const LATE_LUMBER_MILL = {
  intoWinter: 0,
  villagers: 10,
  lumberjacks: 1,
  miners: 0,
  wood: 300,
  gold: 0,
  morale: 0,
  timeScale: 1,
};

describe('o prazo da lenha com uma obra automática à espera e o motor', () => {
  it('com prazo dentro do inverno, o frio começa naquele segundo, com ou sem a obra no caminho', () => {
    let compared = 0;
    let withStart = 0;
    fc.assert(
      fc.property(winterFiefs, (state) => {
        const now = state.lastProcessedAt;
        const { timeScale } = state.settings;
        const view = deriveViewState(state, now);
        const wood = view.resources.find((row) => row.id === 'wood');
        const seconds = wood?.depletesInSeconds ?? null;
        if (seconds === null || view.winter === null || view.winter.cold !== null) {
          return;
        }
        const at = now + seconds * SECOND * timeScale;
        // Além da primavera a lareira já apagou: o prazo só vale dentro da estação.
        if (at + SECOND * timeScale >= nextSeasonBoundary(now)) {
          return;
        }
        const until = advanceTo(state, at - 1);
        const others: ReadonlyArray<GameEvent['type']> = [
          'villagerArrived',
          'villagerLeft',
          'villagerDeserted',
          'famineStarted',
        ];
        if (until.events.some((event) => others.includes(event.type))) {
          return;
        }
        compared += 1;
        if (until.events.some((event) => event.type === 'constructionAutoStarted')) {
          withStart += 1;
        }
        expect(until.state.settlement.cold).toBeNull();
        expect(advanceTo(state, at + SECOND * timeScale).state.settlement.cold).not.toBeNull();
      }),
      { numRuns: 400 },
    );
    expect(compared).toBeGreaterThan(100);
    // A obra começou no caminho em boa parte dos casos: é ela que a propriedade quer pegar.
    expect(withStart).toBeGreaterThan(20);
  });

  it('quando a conta diz que a lenha dá, a obra que começa sozinha não traz o frio', () => {
    let compared = 0;
    let withStart = 0;
    fc.assert(
      // A moral é qualquer uma: a próxima virada do dia a recalcula, e a conta olha a ordem dos
      // acontecimentos. A Serraria que só alcança a lareira depois da virada não fecha a conta
      // de um pátio vazio (docs/pendencias-v0.2.md, C-8).
      fc.property(winterFiefs, (state) => {
        const now = state.lastProcessedAt;
        const { winter } = deriveViewState(state, now);
        if (winter === null || winter.cold !== null || winter.firewood.missing > 0) {
          return;
        }
        const whole = advanceTo(state, nextSeasonBoundary(now) - 1);
        // A conta é feita com os habitantes de agora: quem chega ou parte muda a lareira.
        const others: ReadonlyArray<GameEvent['type']> = [
          'villagerArrived',
          'villagerLeft',
          'villagerDeserted',
          'famineStarted',
        ];
        if (whole.events.some((event) => others.includes(event.type))) {
          return;
        }
        compared += 1;
        if (whole.events.some((event) => event.type === 'constructionAutoStarted')) {
          withStart += 1;
        }
        expect(whole.events.some((event) => event.type === 'coldStarted')).toBe(false);
      }),
      { numRuns: 400, examples: [[winterFief(LATE_LUMBER_MILL)]] },
    );
    expect(compared).toBeGreaterThan(100);
    expect(withStart).toBeGreaterThan(30);
  });
});

// "Acaba em" da comida e da madeira quando as duas acabam no mesmo inverno: a que acaba primeiro
// abre o frio (ou a fome), a penalidade corta a produção, e a outra acaba mais cedo por isso. O
// prazo anunciado de cada uma conta com a outra (docs/pendencias-v0.2.md, C-8).

type LeanFief = {
  intoWinter: number;
  villagers: number;
  veterans: number;
  farmers: number;
  lumberjacks: number;
  food: number;
  wood: number;
  morale: number;
  experience: number;
  difficulty: GameState['settings']['difficulty'];
  timeScale: number;
};

/**
 * Um feudo de inverno com pouca comida e pouca madeira, que acaba de receber ordens: alguns
 * lavradores já conhecem o ofício, os outros e os lenhadores chegaram agora e ainda se adaptam.
 */
function leanFief(fief: LeanFief): GameState {
  const veterans = Math.min(fief.veterans, fief.villagers);
  const start = gameAt(YEAR - 12 * DAY_MS + fief.intoWinter, (draft) => {
    const { settlement } = draft;
    draft.settings.difficulty = fief.difficulty;
    draft.settings.timeScale = fief.timeScale;
    settlement.population.villagers = fief.villagers;
    settlement.buildings.housing = 5;
    settlement.workers = { farm: veterans, lumberMill: 0, quarry: 0, goldMine: 0 };
    settlement.resources = { food: fief.food, wood: fief.wood, stone: 0, gold: 0 };
    settlement.morale = fief.morale;
    settlement.craftExperience.farm = fief.experience;
    settlement.craftExperience.lumberMill = fief.experience;
  });
  // Um milissegundo adiante: a fome e o frio que o cenário pede já estão abertos.
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
}

/**
 * O caso de C-8: 10 habitantes, ninguém na Fazenda, 50 de comida e 10 de madeira. A lenha acaba
 * em 2 h e a comida, em 5 h: a projeção que parava no frio deixava a comida sem prazo.
 */
const COLD_BEFORE_FAMINE: LeanFief = {
  intoWinter: 0,
  villagers: 10,
  veterans: 0,
  farmers: 0,
  lumberjacks: 0,
  food: 50_000,
  wood: 10_000,
  morale: 60,
  experience: 0,
  difficulty: 'lord',
  timeScale: 1,
};
/** O caminho oposto: a comida acaba primeiro, e a fome corta a Serraria que cobria a lareira. */
const FAMINE_BEFORE_COLD: LeanFief = {
  intoWinter: 0,
  villagers: 10,
  veterans: 0,
  farmers: 0,
  lumberjacks: 1,
  food: 10_000,
  wood: 9_000,
  morale: 60,
  experience: 0,
  difficulty: 'lord',
  timeScale: 1,
};

const leanFiefs = fc
  .record({
    intoWinter: fc.integer({ min: 0, max: 8 * DAY_MS - 1 }),
    villagers: fc.integer({ min: 3, max: 16 }),
    veterans: fc.integer({ min: 0, max: 6 }),
    farmers: fc.integer({ min: 0, max: 6 }),
    lumberjacks: fc.integer({ min: 0, max: 2 }),
    // Pouco de cada um: em boa parte dos feudos os dois acabam antes da primavera.
    food: fc.integer({ min: 0, max: 40_999 }),
    wood: fc.integer({ min: 0, max: 20_999 }),
    morale: fc.integer({ min: 0, max: 100 }),
    experience: fc.constantFrom(0, 0, 37, 100),
    difficulty: fc.constantFrom<LeanFief['difficulty']>('peasant', 'lord', 'ironKing'),
    timeScale: fc.constantFrom(1, 3, 7, 0.5),
  })
  .map(leanFief);

describe('o prazo da comida e o da lenha quando as duas acabam no mesmo inverno e o motor', () => {
  it('com prazo dentro do inverno, a fome e o frio começam naquele segundo, mesmo depois de a outra escassez abrir; sem prazo, não começam', () => {
    let started = 0;
    let afterTheOther = 0;
    let stayed = 0;
    fc.assert(
      fc.property(leanFiefs, (state) => {
        const now = state.lastProcessedAt;
        const { timeScale } = state.settings;
        const before = JSON.stringify(state);
        const view = deriveViewState(state, now);
        expect(JSON.stringify(state)).toBe(before);
        const seasonEnd = nextSeasonBoundary(now);
        // O inverno até alguém chegar ou partir: daí em diante as bocas são outras, e a
        // previsão, que conta com os habitantes de agora, já não responde por ele.
        const { events } = advanceTo(state, seasonEnd - 1);
        const firstMove = events.findIndex((event) => PEOPLE.includes(event.type));
        const foreseen = firstMove === -1 ? events : events.slice(0, firstMove);

        for (const [id, begins, other, open] of [
          ['food', 'famineStarted', 'coldStarted', (found: GameState) => found.settlement.famine],
          ['wood', 'coldStarted', 'famineStarted', (found: GameState) => found.settlement.cold],
        ] as const) {
          if (open(state) !== null) {
            continue;
          }
          const seconds = view.resources.find((row) => row.id === id)?.depletesInSeconds ?? null;
          if (seconds === null) {
            // Sem prazo: até a estação virar, não começa sem que algo imprevisto aconteça.
            stayed += 1;
            expect(foreseen.some((event) => event.type === begins)).toBe(false);
            continue;
          }
          const at = now + seconds * SECOND * timeScale;
          // Além da primavera a conta é outra: o prazo só vale dentro da estação.
          if (at + SECOND * timeScale >= seasonEnd) {
            continue;
          }
          const reached = advanceTo(state, at + SECOND * timeScale);
          if (unforeseenPeople(reached.events)) {
            continue;
          }
          started += 1;
          if (reached.events.some((event) => event.type === other)) {
            afterTheOther += 1;
          }
          expect(open(reached.state)).not.toBeNull();
          if (at - 1 >= now) {
            expect(open(advanceTo(state, at - 1).state)).toBeNull();
          }
        }
      }),
      { numRuns: 400, examples: [[leanFief(COLD_BEFORE_FAMINE)], [leanFief(FAMINE_BEFORE_COLD)]] },
    );
    // A propriedade não pode passar por só descartar, nem só com a escassez que abre primeiro.
    expect(started).toBeGreaterThan(150);
    expect(afterTheOther).toBeGreaterThan(15);
    expect(stayed).toBeGreaterThan(200);
  });
});
