import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { nextSeasonBoundary } from './clock';
import { applyCommand } from './commands';
import { command, gameAt, starve, WINTER, YEAR } from './test-helpers';
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

type Fief = {
  atMs: number;
  villagers: number;
  veterans: number;
  farmers: number;
  lumberjacks: number;
  farmLevel: number;
  morale: number;
  famineHours: number;
  difficulty: GameState['settings']['difficulty'];
  timeScale: number;
};

/**
 * Um feudo com fome aberta (e, no inverno, sem madeira: com frio também), que acaba de receber
 * ordens: tantos na Fazenda, tantos na Serraria. Quem chegou agora ao ofício ainda se adapta.
 */
function hungryFief(fief: Fief): GameState {
  const veterans = Math.min(fief.veterans, fief.villagers);
  const start = gameAt(fief.atMs, (draft) => {
    const { settlement } = draft;
    draft.settings.difficulty = fief.difficulty;
    draft.settings.timeScale = fief.timeScale;
    settlement.population.villagers = fief.villagers;
    settlement.buildings.farm = fief.farmLevel;
    settlement.buildings.housing = 4;
    // Alguns lavradores já conhecem o ofício: sozinhos não bastam, ou a fome não estaria aberta.
    settlement.workers = { farm: veterans, lumberMill: 0, quarry: 0, goldMine: 0 };
    settlement.resources = { food: 0, wood: 0, stone: 0, gold: 0 };
    starve(draft, fief.atMs - fief.famineHours * HOUR);
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
}

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
    difficulty: fc.constantFrom<Fief['difficulty']>('peasant', 'peasant', 'lord', 'ironKing'),
    timeScale: fc.constantFrom(1, 3, 7, 0.5),
  })
  .map(hungryFief);

/**
 * Contraexemplos que a propriedade já achou, com o feudo que os produz. Nos dois, a virada do dia
 * derruba a moral, e a escassez que não estava aberta começa milissegundos antes de a adaptação
 * terminar: a previsão que parava no começo dela não via a outra acabar logo depois.
 */
const COLD_BEFORE_FAMINE_ENDS: Fief = {
  // A CI (seed 390398332): a lenha acaba 7 ms antes de os lavradores renderem inteiro.
  atMs: 524_604_580,
  villagers: 8,
  veterans: 1,
  farmers: 2,
  lumberjacks: 2,
  farmLevel: 2,
  morale: 59,
  famineHours: 22,
  difficulty: 'peasant',
  timeScale: 1,
};
const FAMINE_BEFORE_COLD_ENDS: Fief = {
  // O caminho oposto: com frio aberto, a comida acaba 2 ms antes de o lenhador render inteiro.
  atMs: 566_758_209,
  villagers: 6,
  veterans: 2,
  farmers: 0,
  lumberjacks: 1,
  farmLevel: 1,
  morale: 51,
  famineHours: 1,
  difficulty: 'peasant',
  timeScale: 1,
};

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

/** Os tipos de evento do motor entre agora e `untilMs`, na ordem, sem as viradas de dia. */
function eventTypes(state: GameState, untilMs: number): GameEvent['type'][] {
  return advanceTo(state, untilMs)
    .events.map((event) => event.type)
    .filter((type) => type !== 'dayStarted' && type !== 'moraleBandChanged');
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
      {
        numRuns: 400,
        examples: [[hungryFief(COLD_BEFORE_FAMINE_ENDS)], [hungryFief(FAMINE_BEFORE_COLD_ENDS)]],
      },
    );
    // A propriedade não pode passar por só descartar: os dois casos são comparados de fato.
    expect(ended).toBeGreaterThan(20);
    expect(stayed).toBeGreaterThan(80);
  });

  it('o frio que começa no caminho não esconde o fim da fome: ela acaba quando os lavradores rendem inteiro', () => {
    const state = hungryFief(COLD_BEFORE_FAMINE_ENDS);
    const now = state.lastProcessedAt;
    const adapted = state.settlement.adaptation.find((cohort) => cohort.building === 'farm');
    expect(adapted?.untilMs).toBe(now + 2 * HOUR);
    // Hoje há lenha chegando; a virada do dia derruba a moral e a lareira passa a pedir mais
    // do que a Serraria entrega. A lenha acaba, e a adaptação termina logo depois.
    expect(state.settlement.cold).toBeNull();
    expect(eventTypes(state, now + 2 * HOUR)).toEqual(['coldStarted', 'famineEnded', 'coldEnded']);

    const view = deriveViewState(state, now);
    expect(view.famine).toMatchObject({
      endsInSeconds: 7200,
      text: 'Fome: a produção cai para 75% e ninguém se junta ao feudo até a comida voltar. Os lavradores ainda se adaptam: em 2 h rendem inteiro, a comida volta a sobrar e a fome acaba. Não é preciso mexer neles.',
    });
    expect(view.morale.advice).not.toContain('Ponha mais gente');
    expect(expectEndsAt(state, 7200, (found) => found.settlement.famine !== null)).toBe('compared');
  });

  it('a fome que começa no caminho não esconde o fim do frio: ele passa quando o lenhador rende inteiro', () => {
    const state = hungryFief(FAMINE_BEFORE_COLD_ENDS);
    const now = state.lastProcessedAt;
    expect(state.settlement.famine).toBeNull();
    expect(state.settlement.cold).not.toBeNull();
    expect(eventTypes(state, now + 2 * HOUR)).toEqual(['famineStarted', 'coldEnded']);

    const view = deriveViewState(state, now);
    expect(view.winter?.cold).toMatchObject({ endsInSeconds: 7200 });
    expect(view.winter?.cold?.text).toContain(
      'Os lenhadores ainda se adaptam: em 2 h rendem inteiro e o frio passa. Não é preciso mexer neles.',
    );
    expect(expectEndsAt(state, 7200, (found) => found.settlement.cold !== null)).toBe('compared');
  });
});
