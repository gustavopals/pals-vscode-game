import { objectives } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { DAY_MS, YEAR_MS } from './clock';
import { accept, command, eventsOfType, famineSince, gameAt, HOUR, newGame } from './test-helpers';
import type { GameEvent, GameState } from './types';

function steps(start: GameState, count: number, stepMs: number) {
  let state = start;
  const events: GameEvent[] = [];
  for (let index = 1; index <= count; index += 1) {
    const result = advanceTo(state, start.lastProcessedAt + index * stepMs);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

describe('advanceTo', () => {
  it('avançar para o presente ou para o passado não faz nada', () => {
    const state = advanceTo(newGame(), 5 * HOUR).state;
    expect(advanceTo(state, 5 * HOUR)).toEqual({ state, events: [] });
    expect(advanceTo(state, HOUR)).toEqual({ state, events: [] });
    expect(advanceTo(state, HOUR).state).toBe(state);
  });

  it('não muta o estado de entrada', () => {
    const state = accept(newGame(), command('recruitVillagers', { quantity: 2 })).state;
    const before = JSON.stringify(state);
    advanceTo(state, 30 * 24 * HOUR);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('atualiza o relógio junto com lastProcessedAt', () => {
    const { state } = advanceTo(newGame(), 5 * HOUR + 17);
    expect(state.lastProcessedAt).toBe(5 * HOUR + 17);
    expect(state.clock).toEqual({ gameTimeMs: 5 * HOUR + 17, yearStartMs: 0, year: 1 });
  });

  it('emite a virada de dia no instante exato', () => {
    const before = advanceTo(newGame(), DAY_MS - 1);
    expect(eventsOfType(before.events, 'dayStarted')).toEqual([]);
    const { events } = advanceTo(before.state, DAY_MS);
    const [dayStarted] = eventsOfType(events, 'dayStarted');
    expect(dayStarted).toMatchObject({ atMs: DAY_MS, data: { dayOfYear: 2 } });
    expect(dayStarted?.text).toBe('Amanhece o 2º dia da Primavera em Pedra Alta.');
  });

  it('emite a virada de estação no instante exato, antes do amanhecer do dia', () => {
    const { events } = advanceTo(newGame(), 24 * DAY_MS);
    const atBoundary = events.filter((event) => event.atMs === 24 * DAY_MS);
    // Ninguém cuidou do feudo: depois do amanhecer vem a moral, e a fome de 12 h leva um aldeão.
    // A virada do 25º dia é também uma audiência do Conselho, e o sorteio vem depois da moral.
    expect(atBoundary.map((event) => event.type)).toEqual([
      'seasonChanged',
      'dayStarted',
      'villagerDeserted',
      'cardDrawn',
    ]);
    expect(atBoundary[0]).toMatchObject({ data: { season: 'summer' } });
    expect(atBoundary[0]?.text).toBe('Chega o Verão a Pedra Alta.');
    expect(eventsOfType(events, 'seasonChanged')).toHaveLength(1);
  });

  it('vira o ano depois de 84 dias e registra na Crônica', () => {
    const { state, events } = advanceTo(newGame(), YEAR_MS);
    expect(state.clock).toEqual({ gameTimeMs: YEAR_MS, yearStartMs: YEAR_MS, year: 2 });
    const atBoundary = events.filter((event) => event.atMs === YEAR_MS);
    // Depois do amanhecer vem o Conselho: a virada do ano é também uma audiência.
    expect(atBoundary.map((event) => event.type).slice(0, 3)).toEqual([
      'yearStarted',
      'seasonChanged',
      'dayStarted',
    ]);
    expect(atBoundary[0]?.text).toBe('Começa o ano 2 da Casa de Pedra Alta.');
    expect(eventsOfType(events, 'dayStarted')).toHaveLength(84);
    expect(eventsOfType(events, 'seasonChanged')).toHaveLength(4);
  });

  it('30 dias de uma vez produzem os mesmos eventos e o mesmo estado que 720 passos de 1 h', () => {
    const start = accept(newGame(), command('setWorkers', { building: 'farm', count: 1 })).state;
    const atOnce = advanceTo(start, 720 * HOUR);
    const stepped = steps(start, 720, HOUR);
    expect(stepped.events).toStrictEqual(atOnce.events);
    expect(stepped.state).toStrictEqual(atOnce.state);
    expect(eventsOfType(atOnce.events, 'dayStarted')).toHaveLength(360);
  });

  it('dois anos de uma vez dão o mesmo estado e os mesmos eventos que 730 passos desiguais', () => {
    // Um feudo que atravessa as oito estações com pouca madeira: no primeiro inverno a lenha
    // acaba e o frio vem; a primavera o encerra. O passo de 27 min 36 s e 989 ms quase nunca cai em
    // cima de uma virada, e o último passo completa os dois anos.
    let start = accept(newGame(), command('setWorkers', { building: 'farm', count: 3 })).state;
    start = accept(start, command('setWorkers', { building: 'quarry', count: 2 })).state;
    start = accept(start, command('startConstruction', { building: 'lumberMill' })).state;
    const end = 2 * YEAR_MS;
    const stepMs = 1_656_989;
    expect(729 * stepMs).toBeLessThan(end);
    expect(730 * stepMs).toBeGreaterThan(end);

    const atOnce = advanceTo(start, end);
    let state = start;
    const events: GameEvent[] = [];
    for (let index = 1; index <= 730; index += 1) {
      const result = advanceTo(state, Math.min(index * stepMs, end));
      state = result.state;
      events.push(...result.events);
    }
    expect(state).toStrictEqual(atOnce.state);
    expect(events).toStrictEqual(atOnce.events);

    expect(atOnce.state.clock.year).toBe(3);
    expect(eventsOfType(atOnce.events, 'dayStarted')).toHaveLength(168);
    expect(eventsOfType(atOnce.events, 'seasonChanged').map((event) => event.data.season)).toEqual([
      'summer',
      'autumn',
      'winter',
      'spring',
      'summer',
      'autumn',
      'winter',
      'spring',
    ]);
    // 20 de madeira depois da obra, 5 habitantes: seriam 8 horas de lareira no primeiro inverno.
    // Os lobos levam uma parte da madeira a cada incursão, e a lareira apaga antes disso; no
    // segundo inverno já não há madeira nenhuma, e o frio abre na virada.
    const winter = 72 * DAY_MS;
    const [firstCold, secondCold, ...moreCold] = eventsOfType(atOnce.events, 'coldStarted').map(
      (event) => event.atMs,
    );
    expect(firstCold).toBeGreaterThan(winter);
    expect(firstCold).toBeLessThan(winter + 8 * HOUR);
    expect(secondCold).toBe(YEAR_MS + winter);
    expect(moreCold).toEqual([]);
    // O caminho passa pelas incursões: a do roteiro e as que a Ameaça sorteia, com feridos que
    // largam o ofício e voltam.
    expect(eventsOfType(atOnce.events, 'raidSuffered').length).toBeGreaterThan(10);
    expect(eventsOfType(atOnce.events, 'villagerRecovered').length).toBeGreaterThan(10);
    expect(eventsOfType(atOnce.events, 'coldEnded').map((event) => event.atMs)).toEqual([
      YEAR_MS,
      2 * YEAR_MS,
    ]);
    expect(atOnce.state.settlement.cold).toBeNull();
    for (const amount of Object.values(atOnce.state.settlement.resources)) {
      expect(amount).toBeGreaterThanOrEqual(0);
    }
  });

  it('no mesmo instante a ordem é fixa: obra, aldeão, ano, estação, dia, ofício, Conselho, Ameaça, objetivo, fome e frio', () => {
    // Tudo marcado para a virada do ano: uma obra e um recruta que terminam nela, um ofício que
    // a virada do dia leva ao máximo, um mineiro que termina a adaptação, uma audiência do
    // Conselho, a Ameaça que cruza os 40 diante da Torre de Vigia, uma carta cujo prazo acaba,
    // um efeito escondido que acontece, um objetivo que a obra cumpre, a comida que acaba e o
    // frio que o degelo encerra.
    const start = gameAt(YEAR_MS - HOUR, (draft) => {
      draft.map.threat = 38;
      draft.settlement.buildings.watchtower = 1;
      draft.council.nextDrawAtMs = YEAR_MS;
      draft.council.pending = [
        {
          instanceId: 'masonsMeal-1',
          cardId: 'masonsMeal',
          drawnAtMs: YEAR_MS - 12 * DAY_MS,
          expiresAtMs: YEAR_MS,
          origin: null,
        },
      ];
      draft.council.delayed = [
        { atMs: YEAR_MS, instanceId: 'collapsedWell-2', cardId: 'collapsedWell', optionId: 'wait' },
      ];
      draft.stats.cardsDrawn = 2;
      const { settlement } = draft;
      settlement.resources = { food: 5_000, wood: 0, stone: 0, gold: 0 };
      settlement.workers.goldMine = 1;
      settlement.craftExperience.goldMine = 96;
      settlement.adaptation = [{ building: 'goldMine', count: 1, untilMs: YEAR_MS }];
      settlement.cold = { sinceMs: 72 * DAY_MS };
      settlement.constructionQueues = [
        {
          building: 'townHall',
          targetLevel: 2,
          startedAtMs: YEAR_MS - HOUR,
          finishesAtMs: YEAR_MS,
        },
        null,
      ];
      settlement.recruitmentQueue = [{ finishesAtMs: YEAR_MS }];
      // Só o do Salão está por cumprir: os outros já foram, e nenhum é revelado no caminho.
      draft.objectives = {
        active: ['townHallLevel2'],
        completed: objectives
          .map((objective) => objective.id)
          .filter((id) => id !== 'townHallLevel2'),
      };
    });
    const { state, events } = advanceTo(start, YEAR_MS);
    expect(events.map((event) => event.type)).toEqual([
      'constructionFinished',
      'recruitmentFinished',
      'yearStarted',
      'seasonChanged',
      'dayStarted',
      'craftMastered',
      // O Conselho: o sorteio é da virada do dia, e a Ameaça sobe logo depois dele; depois da
      // virada, a carta que expira e o efeito escondido que acontece. O sorteio viu a carta
      // antiga ainda na mesa.
      'cardDrawn',
      'threatRose',
      'cardExpired',
      'cardEffectApplied',
      'objectiveCompleted',
      'famineStarted',
      'coldEnded',
    ]);
    expect(events.every((event) => event.atMs === YEAR_MS)).toBe(true);
    expect(state.council.pending.map((entry) => entry.drawnAtMs)).toEqual([YEAR_MS]);
    expect(state.council.delayed).toEqual([]);
    expect(state.map.threat).toBe(40);
    // A experiência foi contada com o mineiro ainda em adaptação, e já no ano que começa; a
    // adaptação terminou no mesmo instante, sem linha na Crônica.
    expect(state.settlement.craftExperience.goldMine).toBe(100);
    expect(state.settlement.craftMasteredYear.goldMine).toBe(2);
    expect(state.settlement.adaptation).toEqual([]);
    expect(state.settlement.famine).toEqual(famineSince(YEAR_MS));
    expect(state.settlement.cold).toBeNull();
  });

  it('os eventos saem em ordem de instante', () => {
    let state = accept(newGame(), command('recruitVillagers', { quantity: 3 })).state;
    state = accept(state, command('startConstruction', { building: 'lumberMill' })).state;
    const { events } = advanceTo(state, 3 * 24 * HOUR);
    const instants = events.map((event) => event.atMs);
    expect(instants).toEqual([...instants].sort((a, b) => a - b));
  });
});
