import { balance, objectives } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { migrateState } from './migrations';
import {
  describeReward,
  hasUnsettledObjectives,
  objectiveMoraleEffectId,
  objectiveProgress,
} from './objectives';
import { seasonsSurvived, seasonWatch } from './seasonWatch';
import { cloneState } from './state';
import {
  accept,
  allObjectivesScenario,
  command,
  DAY,
  dealt,
  eventsOfType,
  FED_MORALE,
  gameAt,
  gameWith,
  HOUR,
  laterObjectivesScenario,
  MINUTE,
  newGame,
  objectivesScenario,
  play,
  quiet,
  SUMMER,
  WINTER,
  YEAR,
} from './test-helpers';
import type { GameEvent, GameState, ObjectiveView } from './types';
import { deriveViewState } from './view';

const ids = objectives.map((objective) => objective.id);

/** Os `count` primeiros objetivos concluídos e os três seguintes ativos, como o jogo os deixa. */
const reached = (count: number) => (draft: GameState) => {
  draft.objectives = { completed: ids.slice(0, count), active: ids.slice(count, count + 3) };
};

/** O que cada objetivo concluído deu, como a Crônica conta: o que vem depois de "Recompensa:". */
const rewards = (events: GameEvent[]) =>
  eventsOfType(events, 'objectiveCompleted').map((event) => event.text.split('Recompensa: ')[1]);

const completedIn = (events: GameEvent[]) =>
  eventsOfType(events, 'objectiveCompleted').map((event) => event.data.objective);

function viewOf(state: GameState, id: string, timeScale?: number): ObjectiveView {
  const view = deriveViewState(
    state,
    state.lastProcessedAt,
    timeScale === undefined ? {} : { timeScale },
  );
  const found = view.objectives.find((objective) => objective.id === id);
  if (found === undefined) {
    throw new Error(`A visão não mostra o objetivo ${id}.`);
  }
  return found;
}

// O retrato da v0.1 com os quatro objetivos concluídos: o motor da v0.1 pagou +50 ouro pelo
// quarto (ADR 0002). Em produção as partidas da v0.1 correm no ritmo 3.
const savedV1 = Object.values(
  import.meta.glob<string>('./__fixtures__/state-v1-objectives.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0] as string;
const migratedGame = () => migrateState(JSON.parse(savedV1), { timeScale: 3 });

describe('objetivos', () => {
  it('começa com três ativos e os outros escondidos', () => {
    expect(newGame().objectives).toEqual({
      active: ['allocateFarmers', 'upgradeHousing', 'recruitVillagers'],
      completed: [],
    });
    expect(hasUnsettledObjectives(newGame())).toBe(false);
  });

  it('concluir um revela o próximo e credita a recompensa', () => {
    const { state, events } = accept(
      newGame(),
      command('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(state.objectives).toEqual({
      active: ['upgradeHousing', 'recruitVillagers', 'townHallLevel2'],
      completed: ['allocateFarmers'],
    });
    expect(state.settlement.resources.gold).toBe(250_000 + 20_000);
    expect(events).toMatchObject([
      { type: 'objectiveCompleted', atMs: 0, data: { objective: 'allocateFarmers' } },
    ]);
    expect(events[0]?.text).toBe(
      'No 1º dia da Primavera, cumpriu-se um objetivo: Aloque 2 aldeões na Fazenda. Recompensa: +20 ouro.',
    );
  });

  it('um fazendeiro só não cumpre o primeiro objetivo', () => {
    const { state, events } = accept(
      newGame(),
      command('setWorkers', { building: 'farm', count: 1 }),
    );
    expect(state.objectives.completed).toEqual([]);
    expect(events).toEqual([]);
  });

  it('o objetivo de recrutamento conta os aldeões que chegaram, não os encomendados', () => {
    const ordered = accept(newGame(), command('recruitVillagers', { quantity: 3 }));
    expect(ordered.state.objectives.completed).toEqual([]);
    const arrived = play(ordered.state, [{ at: HOUR }]);
    expect(arrived.state.objectives.completed).toEqual(['recruitVillagers']);
    // Na primavera cada aldeão leva 16 minutos: o terceiro chega aos 48.
    expect(eventsOfType(arrived.events, 'objectiveCompleted')[0]).toMatchObject({
      atMs: 48 * MINUTE,
    });
    // 180 − 150 do recrutamento, menos o consumo de 5, 6 e 7 habitantes por 16 min e de 8 por
    // 12 min, mais os 40 da recompensa.
    expect(arrived.state.settlement.resources.food).toBe(30_000 - 6_400 + 40_000);
  });

  it('um objetivo só é avaliado depois de revelado', () => {
    // Salão já no nível 2, mas o quarto objetivo ainda está escondido.
    const ahead = gameWith((draft) => {
      draft.settlement.buildings.townHall = 2;
    });
    const renamed = accept(ahead, command('renameSettlement', { name: 'Vau Alto' }));
    expect(renamed.state.objectives.completed).toEqual([]);
    // Ao concluir o primeiro, o quarto é revelado e cumprido no mesmo instante, e abre lugar
    // para o quinto.
    const { state, events } = accept(
      renamed.state,
      command('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(state.objectives.completed).toEqual(['allocateFarmers', 'townHallLevel2']);
    expect(eventsOfType(events, 'objectiveCompleted')).toHaveLength(2);
    expect(state.objectives.active).toEqual([
      'upgradeHousing',
      'recruitVillagers',
      'buildWatchtower',
    ]);
  });

  it('nunca há mais de três ativos, e são sempre os próximos da sequência', () => {
    expect(balance.objectives.maxActive).toBe(3);
    for (let done = 0; done <= ids.length; done += 1) {
      // Uma partida que parou com `done` concluídos e nenhum ativo: a próxima ordem os revela.
      const start = gameWith((draft) => {
        draft.objectives = { completed: ids.slice(0, done), active: [] };
      });
      expect(hasUnsettledObjectives(start)).toBe(done < ids.length);
      const { state, events } = accept(start, command('renameSettlement', { name: 'Vau Alto' }));
      expect(state.objectives.active, `${done} concluídos`).toEqual(ids.slice(done, done + 3));
      expect(state.objectives.completed).toEqual(ids.slice(0, done));
      expect(eventsOfType(events, 'objectiveCompleted')).toEqual([]);
      expect(hasUnsettledObjectives(state)).toBe(false);
    }
  });

  it('o cenário roteirizado conclui os quatro primeiros, com +20 ouro, +30 madeira, +40 comida e o desbloqueio', () => {
    const { state, events } = objectivesScenario();
    expect(state.objectives).toEqual({
      active: ['buildWatchtower', 'answerFirstCard', 'buildGranaryOrWarehouse'],
      completed: ['allocateFarmers', 'upgradeHousing', 'recruitVillagers', 'townHallLevel2'],
    });
    expect(completedIn(events)).toEqual(state.objectives.completed);
    expect(rewards(events)).toEqual([
      '+20 ouro.',
      '+30 madeira.',
      '+40 comida.',
      'desbloqueia o Celeiro, o Armazém e a Torre de Vigia.',
    ]);
    expect(state.settlement.buildings.townHall).toBe(2);
  });

  it('informa o progresso de cada condição', () => {
    const state = accept(newGame(), command('recruitVillagers', { quantity: 2 })).state;
    const later = play(state, [{ at: HOUR }]).state;
    const progress = objectives.map((objective) => objectiveProgress(later, objective.condition));
    expect(progress).toEqual([
      { current: 0, target: 2 },
      { current: 0, target: 1 },
      { current: 2, target: 3 },
      { current: 1, target: 2 },
      { current: 0, target: 1 },
      { current: 0, target: 1 },
      { current: 0, target: 1 },
      { current: 0, target: 1 },
      { current: 0, target: 1 },
      { current: 0, target: 1 },
    ]);
  });

  it('descreve recompensas com mais de um recurso, a moral e a que não é recurso', () => {
    const [first] = objectives;
    if (first === undefined) {
      throw new Error('O conteúdo não tem objetivos.');
    }
    const reward = (changed: Partial<typeof first>, timeScale?: number) =>
      describeReward({ ...first, ...changed }, timeScale);
    expect(reward({ reward: { gold: 20 } })).toBe('+20 ouro');
    expect(reward({ reward: { gold: 20, wood: 30 } })).toBe('+30 madeira e +20 ouro');
    expect(reward({ reward: {}, rewardText: 'desbloqueia o Celeiro' })).toBe(
      'desbloqueia o Celeiro',
    );
    expect(reward({ reward: { gold: 20 }, rewardText: 'desbloqueia o Celeiro' })).toBe(
      '+20 ouro e desbloqueia o Celeiro',
    );
    const morale = { amount: 10, durationDays: 1, label: 'Inverno sem frio' };
    // A Crônica é a mesma em qualquer ritmo: só dias de jogo.
    expect(reward({ reward: {}, morale })).toBe('+10 de moral por 1 dia de jogo');
    expect(reward({ reward: { gold: 20 }, morale: { ...morale, durationDays: 3 } })).toBe(
      '+20 ouro e +10 de moral por 3 dias de jogo',
    );
    // A visão diz quanto isso dura no relógio de quem joga: um dia de jogo são 2 h no ritmo 1.
    expect(reward({ reward: {}, morale }, 1)).toBe('+10 de moral por 1 dia de jogo (2 h)');
    expect(reward({ reward: {}, morale }, 3)).toBe('+10 de moral por 1 dia de jogo (40 min)');
    expect(reward({ reward: {}, morale }, 0.5)).toBe('+10 de moral por 1 dia de jogo (4 h)');
  });
});

describe('objetivos da v0.2: a sequência inteira', () => {
  const expectedRewards = [
    '+20 ouro.',
    '+30 madeira.',
    '+40 comida.',
    'desbloqueia o Celeiro, o Armazém e a Torre de Vigia.',
    '+40 pedra.',
    '+10 de moral por 1 dia de jogo.',
    '+60 madeira.',
    '+30 ouro.',
    '+100 madeira.',
    '+15 de moral por 1 dia de jogo.',
  ];

  it('o cenário roteirizado conclui os dez, na ordem, em uma partida nova', () => {
    const { state, events } = allObjectivesScenario();
    expect(state.lastProcessedAt).toBe(YEAR);
    expect(state.objectives).toEqual({ active: [], completed: ids });
    expect(completedIn(events)).toEqual(ids);
    expect(rewards(events)).toEqual(expectedRewards);
    const completed = eventsOfType(events, 'objectiveCompleted');
    expect(completed.map((event) => event.atMs)).toEqual([
      0,
      0,
      48 * MINUTE,
      6 * HOUR + 10 * MINUTE,
      // A Torre leva 12 minutos; a carta é respondida às 17 h; o Celeiro, 10 minutos.
      14 * HOUR + 12 * MINUTE,
      17 * HOUR,
      21 * HOUR + 10 * MINUTE,
      // A marca de "começar sozinha" cumpre o objetivo na própria ordem.
      21 * HOUR + 10 * MINUTE,
      // A Paliçada, erguida na virada para o verão, leva 20 minutos.
      SUMMER + 20 * MINUTE,
      // O inverno só conta quando termina: na virada para a primavera do ano 2.
      YEAR,
    ]);
    expect(completed[completed.length - 1]?.text).toBe(
      'No 1º dia da Primavera, cumpriu-se um objetivo: Atravesse o inverno sem passar frio. Recompensa: +15 de moral por 1 dia de jogo.',
    );
    // O Salão marcado para subir sozinho começou quando houve com quê, sem ordem nenhuma.
    expect(
      eventsOfType(events, 'constructionAutoStarted').map((event) => event.data.building),
    ).toEqual(['townHall']);
    expect(state.settlement.buildings).toMatchObject({
      townHall: 3,
      watchtower: 1,
      granary: 1,
      palisade: 1,
    });
    expect(hasUnsettledObjectives(state)).toBe(false);
    // Ninguém passou frio nem fome no caminho.
    expect(eventsOfType(events, 'coldStarted')).toEqual([]);
    expect(eventsOfType(events, 'famineStarted')).toEqual([]);
  });

  it('partida migrada da v0.1: o quarto objetivo não paga de novo nem segura os seguintes', () => {
    const start = migratedGame();
    expect(start.settings.timeScale).toBe(3);
    expect(start.objectives).toEqual({ active: [], completed: ids.slice(0, 4) });
    // O Salão já está no nível 2, e a recompensa da v0.1 (+50 ouro) ficou com quem a recebeu.
    expect(start.settlement.buildings.townHall).toBe(2);
    expect(start.settlement.resources.gold).toBe(190_000);
    expect(hasUnsettledObjectives(start)).toBe(true);

    // Na fronteira os três seguintes são revelados, sem evento e sem prêmio nenhum.
    const boundary = advanceTo(start, start.lastProcessedAt + 1);
    expect(boundary.events).toEqual([]);
    expect(boundary.state.objectives).toEqual({
      active: ['buildWatchtower', 'answerFirstCard', 'buildGranaryOrWarehouse'],
      completed: ids.slice(0, 4),
    });
    expect(boundary.state.settlement.resources.gold).toBe(190_000);
    // O Salão no nível 2 já libera as obras: a Torre só espera recurso.
    expect(viewOf(boundary.state, 'buildWatchtower').missing).toMatch(/^Faltam .*\.$/);

    // O mesmo roteiro da partida nova conclui os seis da v0.2, na ordem.
    const { state, events } = laterObjectivesScenario(start);
    expect(completedIn(events)).toEqual(ids.slice(4));
    expect(rewards(events)).toEqual(expectedRewards.slice(4));
    expect(state.objectives).toEqual({ active: [], completed: ids });
    expect(state.lastProcessedAt).toBe(YEAR);
  });

  it('partida migrada: a fronteira não depende de quando alguém olhou', () => {
    const start = migratedGame();
    const direct = advanceTo(start, 20 * HOUR);
    const first = advanceTo(start, start.lastProcessedAt + 1);
    const second = advanceTo(first.state, 20 * HOUR);
    expect(second.state).toStrictEqual(direct.state);
    expect([...first.events, ...second.events]).toStrictEqual(direct.events);
  });

  it('o que o feudo já tinha feito conta na fronteira, com recompensa e linha na Crônica', () => {
    // Uma partida que parou nos quatro primeiros e, sem objetivo nenhum pedir, já ergueu a
    // Torre e o Armazém, respondeu a duas cartas e deixou o Salão marcado para subir sozinho.
    const start = quiet(
      gameAt(5 * DAY + 20 * MINUTE, (draft) => {
        draft.objectives = { active: [], completed: ids.slice(0, 4) };
        const { settlement } = draft;
        settlement.buildings = {
          ...settlement.buildings,
          townHall: 2,
          watchtower: 1,
          warehouse: 1,
        };
        settlement.resources = { food: 200_000, wood: 100_000, stone: 100_000, gold: 100_000 };
        settlement.planned = [{ building: 'townHall', targetLevel: 3, autoStart: true }];
        draft.stats.cardsAnswered = 2;
      }),
    );
    const at = start.lastProcessedAt;
    const { state, events } = advanceTo(start, at + 1);
    expect(events.map((event) => [event.type, event.atMs, event.data.objective])).toEqual([
      ['objectiveCompleted', at, 'buildWatchtower'],
      ['objectiveCompleted', at, 'answerFirstCard'],
      ['objectiveCompleted', at, 'buildGranaryOrWarehouse'],
      ['objectiveCompleted', at, 'planAutoStart'],
    ]);
    expect(events[0]?.text).toBe(
      'No 6º dia da Primavera, cumpriu-se um objetivo: Construa a Torre de Vigia. Recompensa: +40 pedra.',
    );
    expect(state.objectives).toEqual({
      active: ['buildPalisade', 'surviveWinterWithoutCold'],
      completed: ids.slice(0, 8),
    });
    expect(state.settlement.resources).toMatchObject({
      wood: 160_000,
      stone: 140_000,
      gold: 130_000,
    });
    expect(state.settlement.moraleEffects).toEqual([
      {
        id: 'objective:answerFirstCard',
        label: 'O Senhor ouviu o Conselho',
        amount: 10,
        untilMs: at + DAY,
      },
    ]);
    // Quem olhou um milissegundo depois e quem só voltou no dia seguinte veem a mesma história.
    const direct = advanceTo(start, at + DAY);
    const second = advanceTo(state, at + DAY);
    expect(second.state).toStrictEqual(direct.state);
    expect([...events, ...second.events]).toStrictEqual(direct.events);
  });
});

describe('objetivo: responda à primeira carta do Conselho', () => {
  const table = () => dealt(quiet(gameWith(reached(5))), 'thawBridgePlea');

  it('a carta que expira não conta: quem decidiu foi o conselho', () => {
    const { state: start } = table();
    expect(viewOf(start, 'answerFirstCard')).toMatchObject({
      progress: { current: 0, target: 1 },
      // Há carta na mesa: só falta a ordem.
      missing: null,
      target: { kind: 'council' },
    });
    const expiresAt = start.council.pending[0]?.expiresAtMs ?? 0;
    const { state, events } = advanceTo(start, expiresAt);
    expect(eventsOfType(events, 'cardExpired')).toHaveLength(1);
    expect(state.stats.cardsExpired).toBe(1);
    expect(state.stats.cardsAnswered).toBeUndefined();
    expect(state.objectives.active).toContain('answerFirstCard');
    expect(eventsOfType(events, 'objectiveCompleted')).toEqual([]);
    expect(viewOf(state, 'answerFirstCard')).toMatchObject({
      progress: { current: 0, target: 1 },
      missing: 'Nenhuma carta espera resposta: vale a próxima que o Conselho trouxer.',
    });
  });

  it('a resposta do jogador cumpre, e a moral sobe por um dia de jogo, a partir da próxima virada', () => {
    const { state: start, instanceId } = table();
    const { state, events } = accept(
      start,
      command('answerCard', { instanceId, optionId: 'postpone' }),
    );
    expect(events.map((event) => event.type)).toEqual(['cardAnswered', 'objectiveCompleted']);
    expect(events[1]).toMatchObject({
      data: { objective: 'answerFirstCard', morale: 10, moraleDays: 1 },
      text: 'No 1º dia da Primavera, cumpriu-se um objetivo: Responda à primeira carta do Conselho. Recompensa: +10 de moral por 1 dia de jogo.',
    });
    expect(state.objectives.completed).toContain('answerFirstCard');
    expect(state.settlement.moraleEffects).toEqual([
      {
        id: objectiveMoraleEffectId('answerFirstCard'),
        label: 'O Senhor ouviu o Conselho',
        amount: 10,
        untilMs: DAY,
      },
    ]);
    // A moral não muda na hora (GDD §5.7): o prêmio entra na conta da próxima virada do dia.
    expect(state.settlement.morale).toBe(start.settlement.morale);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.morale.effects).toEqual([
      { label: 'O Senhor ouviu o Conselho', amount: 10, endsInSeconds: 4 * 3600 },
    ]);
    expect(view.morale.next.value).toBe(FED_MORALE + 10);
    expect(advanceTo(state, DAY).state.settlement.morale).toBe(FED_MORALE + 10);
    // Um dia de jogo depois o efeito saiu da conta e da lista.
    const after = advanceTo(state, 2 * DAY).state;
    expect(after.settlement.morale).toBe(FED_MORALE);
    expect(after.settlement.moraleEffects).toEqual([]);
  });

  it('no ritmo Rápido o prêmio dura o mesmo dia de jogo, e a visão diz 40 minutos', () => {
    const fast = (state: GameState): GameState => ({
      ...state,
      settings: { ...state.settings, timeScale: 3 },
    });
    const { state: start, instanceId } = table();
    expect(viewOf(fast(start), 'answerFirstCard').reward).toBe(
      '+10 de moral por 1 dia de jogo (40 min)',
    );
    expect(viewOf(start, 'answerFirstCard').reward).toBe('+10 de moral por 1 dia de jogo (2 h)');
    const { state } = accept(
      fast(start),
      command('answerCard', { instanceId, optionId: 'postpone' }),
    );
    // O estado é o mesmo em qualquer ritmo: o prazo está em tempo de jogo.
    expect(state.settlement.moraleEffects[0]?.untilMs).toBe(DAY);
    // Da resposta até a virada em que o efeito sai da conta: dois dias de jogo, 80 min reais.
    expect(deriveViewState(state, state.lastProcessedAt).morale.effects).toEqual([
      { label: 'O Senhor ouviu o Conselho', amount: 10, endsInSeconds: 80 * 60 },
    ]);
  });

  it('a carta respondida antes de o objetivo aparecer conta quando ele é revelado', () => {
    const { state: start, instanceId } = dealt(quiet(gameWith(reached(2))), 'thawBridgePlea');
    const answered = accept(start, command('answerCard', { instanceId, optionId: 'postpone' }));
    expect(answered.state.stats.cardsAnswered).toBe(1);
    expect(completedIn(answered.events)).toEqual([]);
    // Com o Salão e a Torre prontos, a sequência chega ao objetivo da carta e o conclui.
    const ahead = cloneState(answered.state);
    reached(5)(ahead);
    const { state, events } = accept(ahead, command('renameSettlement', { name: 'Vau Alto' }));
    expect(completedIn(events)).toEqual(['answerFirstCard']);
    expect(state.objectives.active).toEqual([
      'buildGranaryOrWarehouse',
      'planAutoStart',
      'buildPalisade',
    ]);
  });
});

describe('objetivo: construa o Celeiro ou o Armazém', () => {
  const start = () =>
    quiet(
      gameWith((draft) => {
        reached(6)(draft);
        draft.settlement.buildings.townHall = 2;
        draft.settlement.resources = { food: 100_000, wood: 300_000, stone: 200_000, gold: 0 };
      }),
    );

  it('qualquer um dos dois serve: o Armazém cumpre tanto quanto o Celeiro', () => {
    for (const building of ['granary', 'warehouse'] as const) {
      const before = start();
      // Os dois podem começar: não falta nada, e o alvo é o primeiro da lista.
      expect(viewOf(before, 'buildGranaryOrWarehouse')).toMatchObject({
        progress: { current: 0, target: 1 },
        missing: null,
        target: { kind: 'building', building: 'granary' },
      });
      const ordered = accept(before, command('startConstruction', { building }));
      expect(completedIn(ordered.events)).toEqual([]);
      // Em obras, o objetivo aponta para o que o jogador escolheu e diz que é só esperar.
      expect(viewOf(ordered.state, 'buildGranaryOrWarehouse')).toMatchObject({
        missing: `A obra do ${building === 'granary' ? 'Celeiro' : 'Armazém'} já começou: o objetivo se cumpre quando ela terminar.`,
        target: { kind: 'building', building },
      });
      const { state, events } = advanceTo(ordered.state, 10 * MINUTE);
      expect(events.map((event) => event.type)).toEqual(['buildingFounded', 'objectiveCompleted']);
      expect(events[1]?.data).toEqual({ objective: 'buildGranaryOrWarehouse', gained_wood: 60 });
      expect(state.objectives.completed).toContain('buildGranaryOrWarehouse');
      expect(viewOf(state, 'buildGranaryOrWarehouse')).toMatchObject({
        status: 'completed',
        progress: { current: 1, target: 1 },
        missing: null,
      });
    }
  });

  it('sem o Salão no nível 2, o objetivo diz o que falta', () => {
    const early = gameWith(reached(6));
    expect(viewOf(early, 'buildGranaryOrWarehouse').missing).toBe(
      'Melhore antes o Salão do Senhor para o nível 2.',
    );
  });
});

describe('objetivo: deixe uma obra marcada para começar sozinha', () => {
  const start = () => quiet(gameWith(reached(7)));

  it('planejar sem a marca não cumpre; marcar depois, sim', () => {
    const planned = accept(start(), command('planConstruction', { building: 'townHall' }));
    expect(completedIn(planned.events)).toEqual([]);
    expect(viewOf(planned.state, 'planAutoStart')).toMatchObject({
      progress: { current: 0, target: 1 },
      missing: null,
      target: { kind: 'planned' },
    });
    const marked = accept(
      planned.state,
      command('setAutoStart', { building: 'townHall', autoStart: true }),
    );
    expect(marked.events.map((event) => event.type)).toEqual(['objectiveCompleted']);
    expect(marked.events[0]?.data).toEqual({ objective: 'planAutoStart', gained_gold: 30 });
    expect(marked.state.stats.plansMarkedAuto).toBe(1);
    // A obra continua na lista, esperando recurso: o objetivo era a marca, não a obra.
    expect(marked.state.settlement.planned).toEqual([
      { building: 'townHall', targetLevel: 2, autoStart: true },
    ]);
  });

  it('a marca conta mesmo quando a obra começa na mesma ordem e sai da lista', () => {
    const { state, events } = accept(
      start(),
      command('planConstruction', { building: 'housing', autoStart: true }),
    );
    expect(events.map((event) => event.type)).toEqual([
      'constructionAutoStarted',
      'objectiveCompleted',
    ]);
    expect(state.settlement.planned).toEqual([]);
    expect(state.objectives.completed).toContain('planAutoStart');
  });

  it('marcar de novo a que já era automática não conta outra vez; desmarcar e marcar, sim', () => {
    let state = accept(
      start(),
      command('planConstruction', { building: 'townHall', autoStart: true }),
    ).state;
    expect(state.stats.plansMarkedAuto).toBe(1);
    const again = command('setAutoStart', { building: 'townHall', autoStart: true });
    state = accept(state, again).state;
    expect(state.stats.plansMarkedAuto).toBe(1);
    state = accept(
      state,
      command('setAutoStart', { building: 'townHall', autoStart: false }),
    ).state;
    expect(state.stats.plansMarkedAuto).toBe(1);
    state = accept(state, again).state;
    expect(state.stats.plansMarkedAuto).toBe(2);
  });

  it('a marca dada antes de o objetivo aparecer conta quando ele é revelado', () => {
    const early = accept(
      quiet(gameWith(reached(4))),
      command('planConstruction', { building: 'townHall', autoStart: true }),
    );
    expect(completedIn(early.events)).toEqual([]);
    // O jogador desmarca; a marca dada fica na conta, e não só enquanto está na lista.
    const unmarked = accept(
      early.state,
      command('setAutoStart', { building: 'townHall', autoStart: false }),
    ).state;
    const ahead = cloneState(unmarked);
    reached(7)(ahead);
    const { events } = accept(ahead, command('renameSettlement', { name: 'Vau Alto' }));
    expect(completedIn(events)).toEqual(['planAutoStart']);
  });
});

describe('objetivo: construa a Paliçada', () => {
  it('pede o Salão no nível 3, e a recompensa que não cabe no Pátio vai ao chão, contada', () => {
    const early = quiet(gameWith(reached(8)));
    expect(viewOf(early, 'buildPalisade')).toMatchObject({
      missing: 'Melhore antes o Salão do Senhor para o nível 3.',
      target: { kind: 'building', building: 'palisade' },
    });
    // O Pátio guarda 500 de madeira: com 450, só entram 50 dos 100 da recompensa.
    const building = quiet(
      gameWith((draft) => {
        reached(8)(draft);
        const { settlement } = draft;
        settlement.buildings.townHall = 3;
        settlement.resources = { food: 100_000, wood: 450_000, stone: 0, gold: 0 };
        settlement.constructionQueues = [
          { building: 'palisade', targetLevel: 1, startedAtMs: 0, finishesAtMs: 20 * MINUTE },
          null,
        ];
      }),
    );
    const { state, events } = advanceTo(building, 20 * MINUTE);
    const [completed] = eventsOfType(events, 'objectiveCompleted');
    expect(completed?.data).toEqual({ objective: 'buildPalisade', gained_wood: 50, lost_wood: 50 });
    expect(completed?.text).toBe(
      'No 1º dia da Primavera, cumpriu-se um objetivo: Construa a Paliçada. Recompensa: +100 madeira. Faltou lugar no depósito, e foi ao chão: 50 de madeira.',
    );
    expect(state.settlement.resources.wood).toBe(500_000);
    expect(state.stats.wasted_wood).toBe(50_000);
  });
});

describe('objetivo: atravesse o inverno sem passar frio', () => {
  /** Véspera do inverno, com o objetivo do inverno ativo: cinco habitantes e ninguém na Serraria. */
  const eve = (wood: number, atMs = WINTER - DAY) =>
    gameAt(atMs, (draft) => {
      reached(9)(draft);
      // Comida para o inverno inteiro, sem ninguém na Fazenda: nada enche, nada vai ao chão.
      draft.settlement.resources = { food: 400_000, wood: wood * 1000, stone: 0, gold: 0 };
    });
  const winterDone = (state: GameState) =>
    state.objectives.completed.includes('surviveWinterWithoutCold');

  it('com lenha para o inverno inteiro, cumpre na virada para a primavera', () => {
    // Cinco habitantes queimam 2,5 de madeira por hora: 60 nos doze dias do inverno.
    const start = eve(100);
    expect(seasonWatch(start)).toBe('unwatched');
    expect(viewOf(start, 'surviveWinterWithoutCold')).toMatchObject({
      progress: { current: 0, target: 1 },
      missing: 'Falta o Inverno chegar e passar sem frio.',
      target: { kind: 'season', season: 'winter' },
    });

    const middle = advanceTo(start, WINTER + 5 * DAY + 17 * MINUTE).state;
    expect(seasonWatch(middle)).toBe('clean');
    expect(viewOf(middle, 'surviveWinterWithoutCold').missing).toBe(
      'Ninguém passou frio até aqui: falta o Inverno terminar assim.',
    );

    // Um milissegundo antes da primavera o inverno ainda não terminou.
    const almost = advanceTo(middle, YEAR - 1);
    expect(winterDone(almost.state)).toBe(false);
    const { state, events } = advanceTo(almost.state, YEAR);
    expect(events.map((event) => event.type)).toEqual([
      'yearStarted',
      'seasonChanged',
      'dayStarted',
      'objectiveCompleted',
    ]);
    expect(events[3]).toMatchObject({
      atMs: YEAR,
      data: { objective: 'surviveWinterWithoutCold', morale: 15, moraleDays: 1 },
    });
    expect(seasonsSurvived(state, 'winter')).toBe(1);
    expect(state.settlement.resources.wood).toBe(40_000);
    expect(state.settlement.moraleEffects).toEqual([
      {
        id: 'objective:surviveWinterWithoutCold',
        label: 'Inverno sem frio',
        amount: 15,
        untilMs: YEAR + DAY,
      },
    ]);
    // A moral da virada da primavera já estava calculada: o prêmio vale no dia seguinte.
    expect(advanceTo(state, YEAR + DAY).state.settlement.morale).toBe(state.settlement.morale + 15);
    expect(viewOf(state, 'surviveWinterWithoutCold')).toMatchObject({
      status: 'completed',
      progress: { current: 1, target: 1 },
      missing: null,
    });
  });

  it('com frio no meio do inverno não cumpre, nem que a lenha volte: vale o próximo', () => {
    // 30 de madeira duram doze horas: o frio abre no 7º dia do inverno.
    const start = eve(30);
    const cold = advanceTo(start, WINTER + 7 * DAY);
    expect(eventsOfType(cold.events, 'coldStarted').map((event) => event.atMs)).toEqual([
      WINTER + 12 * HOUR,
    ]);
    expect(seasonWatch(cold.state)).toBe('cold');
    expect(viewOf(cold.state, 'surviveWinterWithoutCold').missing).toBe(
      'O feudo já passou frio neste Inverno: vale o próximo, inteiro.',
    );
    // O senhor volta e põe todo mundo na Serraria: o frio passa, mas este inverno já não conta.
    const warmed = play(cold.state, [
      command('setWorkers', { building: 'lumberMill', count: 5 }),
      { at: YEAR },
    ]);
    expect(eventsOfType(warmed.events, 'coldEnded')).toHaveLength(1);
    expect(winterDone(warmed.state)).toBe(false);
    expect(seasonsSurvived(warmed.state, 'winter')).toBe(0);
    expect(eventsOfType(warmed.events, 'objectiveCompleted')).toEqual([]);
    expect(viewOf(warmed.state, 'surviveWinterWithoutCold').missing).toBe(
      'Falta o Inverno chegar e passar sem frio.',
    );

    // No ano seguinte, com a Fazenda e a Serraria ocupadas, o inverno passa sem frio.
    const second = play(warmed.state, [
      command('setWorkers', { building: 'lumberMill', count: 2 }),
      command('setWorkers', { building: 'farm', count: 3 }),
      { at: 2 * YEAR },
    ]);
    expect(eventsOfType(second.events, 'coldStarted')).toEqual([]);
    expect(
      eventsOfType(second.events, 'objectiveCompleted').map((event) => [
        event.atMs,
        event.data.objective,
      ]),
    ).toEqual([[2 * YEAR, 'surviveWinterWithoutCold']]);
    expect(seasonsSurvived(second.state, 'winter')).toBe(1);
  });

  it('o frio que abre no primeiro instante do inverno é desse inverno', () => {
    const { state, events } = advanceTo(eve(0), WINTER);
    expect(eventsOfType(events, 'coldStarted').map((event) => event.atMs)).toEqual([WINTER]);
    expect(seasonWatch(state)).toBe('cold');
    expect(state.stats.coldSpellsThisSeason).toBe(1);
    expect(winterDone(advanceTo(state, YEAR).state)).toBe(false);
  });

  it('o inverno que já corria quando a regra chegou não conta pela metade', () => {
    // Uma partida gravada no 3º dia do inverno por um motor que não contava as estações.
    const start = eve(100, WINTER + 2 * DAY + 13 * MINUTE);
    expect(start.stats.coldSpellsThisSeason).toBeUndefined();
    expect(viewOf(start, 'surviveWinterWithoutCold').missing).toBe(
      'O Inverno já corria quando este objetivo chegou: vale o próximo, inteiro.',
    );
    const { state, events } = advanceTo(start, YEAR);
    expect(eventsOfType(events, 'coldStarted')).toEqual([]);
    expect(winterDone(state)).toBe(false);
    expect(seasonsSurvived(state, 'winter')).toBe(0);
    // Da primavera em diante as estações são acompanhadas do primeiro instante.
    expect(seasonWatch(state)).toBe('clean');
    expect(seasonsSurvived(advanceTo(state, YEAR + 24 * DAY).state, 'spring')).toBe(1);
  });

  it('o objetivo revelado depois de um inverno já atravessado conta esse inverno', () => {
    const start = eve(100);
    const hidden = cloneState(start);
    reached(4)(hidden);
    const spring = advanceTo(hidden, YEAR).state;
    expect(seasonsSurvived(spring, 'winter')).toBe(1);
    expect(winterDone(spring)).toBe(false);
    const ahead = cloneState(spring);
    reached(9)(ahead);
    const { events } = accept(ahead, command('renameSettlement', { name: 'Vau Alto' }));
    expect(completedIn(events)).toEqual(['surviveWinterWithoutCold']);
  });

  it('a divisão de intervalo continua exata, com e sem frio, do outono à primavera', () => {
    for (const wood of [100, 30, 0]) {
      const start = eve(wood);
      const span = YEAR + 2 * DAY - start.lastProcessedAt;
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: span }),
          fc.integer({ min: 1, max: span }),
          (a, b) => {
            const middle = start.lastProcessedAt + Math.min(a, b);
            const end = start.lastProcessedAt + Math.max(a, b);
            const direct = advanceTo(start, end);
            const first = advanceTo(start, middle);
            const second = advanceTo(first.state, end);
            expect(second.state).toStrictEqual(direct.state);
            expect([...first.events, ...second.events]).toStrictEqual(direct.events);
          },
        ),
        { numRuns: 60 },
      );
    }
  });
});

describe('objetivos na visão: o que falta e onde se cumpre', () => {
  it('partida nova: os três primeiros, cada um com a ação, o porquê, a recompensa e o que falta', () => {
    const view = deriveViewState(newGame(), 0).objectives;
    expect(view).toEqual([
      {
        id: 'allocateFarmers',
        title: 'Aloque 2 aldeões na Fazenda',
        hint: 'Comida é o que mantém todo o resto.',
        reward: '+20 ouro',
        status: 'active',
        progress: { current: 0, target: 2 },
        missing: 'Faltam 2 aldeões na Fazenda.',
        target: { kind: 'workers', building: 'farm' },
      },
      {
        id: 'upgradeHousing',
        title: 'Inicie a melhoria das Habitações',
        hint: 'Sem teto, ninguém vem morar no feudo.',
        reward: '+30 madeira',
        status: 'active',
        progress: { current: 0, target: 1 },
        // A obra cabe no estoque inicial: só falta mandar.
        missing: null,
        target: { kind: 'building', building: 'housing' },
      },
      {
        id: 'recruitVillagers',
        title: 'Recrute 3 aldeões',
        hint: 'Mais braços, mais colheita, mais madeira.',
        reward: '+40 comida',
        status: 'active',
        progress: { current: 0, target: 3 },
        missing: 'Falta recrutar 3 aldeões.',
        target: { kind: 'recruitment' },
      },
    ]);
  });

  it('o que falta acompanha o estado: um aldeão a menos, gente a caminho, casa cheia', () => {
    const one = accept(newGame(), command('setWorkers', { building: 'farm', count: 1 })).state;
    expect(viewOf(one, 'allocateFarmers').missing).toBe('Falta 1 aldeão na Fazenda.');
    // Todos em outro ofício: o objetivo diz que não há quem mandar, e o que fazer.
    const busy = accept(one, command('setWorkers', { building: 'quarry', count: 4 })).state;
    expect(viewOf(busy, 'allocateFarmers').missing).toBe(
      'Falta 1 aldeão na Fazenda. Não há aldeão livre que baste: tire de outro ofício ou recrute.',
    );

    const two = accept(newGame(), command('recruitVillagers', { quantity: 2 })).state;
    expect(viewOf(two, 'recruitVillagers').missing).toBe('Falta recrutar 1 aldeão.');
    // Sem comida para chamar o terceiro, o objetivo diz o mesmo que a recusa da ordem diria.
    const hungry = cloneState(two);
    hungry.settlement.resources.food = 20_000;
    expect(viewOf(hungry, 'recruitVillagers').missing).toBe(
      'Falta recrutar 1 aldeão. Faltam 30 comida.',
    );
    const three = accept(newGame(), command('recruitVillagers', { quantity: 3 })).state;
    expect(viewOf(three, 'recruitVillagers').missing).toBe(
      'Os 3 aldeões que faltam já estão a caminho.',
    );
    const arriving = advanceTo(three, 40 * MINUTE).state;
    expect(viewOf(arriving, 'recruitVillagers')).toMatchObject({
      progress: { current: 2, target: 3 },
      missing: 'O aldeão que falta já está a caminho.',
    });
  });

  it('depois dos quatro primeiros: a Torre e o depósito dizem o recurso que falta; a carta, que ainda não chegou', () => {
    const { state } = objectivesScenario();
    const view = deriveViewState(state, state.lastProcessedAt).objectives;
    expect(view.map((objective) => [objective.id, objective.status])).toEqual([
      ['allocateFarmers', 'completed'],
      ['upgradeHousing', 'completed'],
      ['recruitVillagers', 'completed'],
      ['townHallLevel2', 'completed'],
      ['buildWatchtower', 'active'],
      ['answerFirstCard', 'active'],
      ['buildGranaryOrWarehouse', 'active'],
    ]);
    expect(view.slice(4)).toEqual([
      {
        id: 'buildWatchtower',
        title: 'Construa a Torre de Vigia',
        hint: 'Ver o inimigo é metade da batalha.',
        reward: '+40 pedra',
        status: 'active',
        progress: { current: 0, target: 1 },
        missing: 'Faltam 99 madeira e 112 pedra.',
        target: { kind: 'building', building: 'watchtower' },
      },
      {
        id: 'answerFirstCard',
        title: 'Responda à primeira carta do Conselho',
        hint: 'Quem se cala deixa o conselho decidir em seu lugar.',
        reward: '+10 de moral por 1 dia de jogo (2 h)',
        status: 'active',
        progress: { current: 0, target: 1 },
        missing: 'Nenhuma carta espera resposta: vale a próxima que o Conselho trouxer.',
        target: { kind: 'council' },
      },
      {
        id: 'buildGranaryOrWarehouse',
        title: 'Construa o Celeiro ou o Armazém',
        hint: 'Amplie o estoque antes que a produção vá para o chão.',
        reward: '+60 madeira',
        status: 'active',
        progress: { current: 0, target: 1 },
        missing: 'Faltam 139 madeira e 72 pedra.',
        target: { kind: 'building', building: 'granary' },
      },
    ]);
    // Os concluídos não pedem nada.
    expect(view.slice(0, 4).every((objective) => objective.missing === null)).toBe(true);
  });

  it('a Torre em obras só espera; com os pedreiros ocupados, o objetivo diz por quê', () => {
    const rich = quiet(
      gameWith((draft) => {
        reached(4)(draft);
        draft.settlement.buildings.townHall = 2;
        draft.settlement.resources = {
          food: 100_000,
          wood: 400_000,
          stone: 400_000,
          gold: 200_000,
        };
      }),
    );
    expect(viewOf(rich, 'buildWatchtower').missing).toBeNull();
    const busy = accept(rich, command('startConstruction', { building: 'farm' })).state;
    expect(viewOf(busy, 'buildWatchtower').missing).toBe(
      'Os pedreiros já estão ocupados com outra obra. A segunda fila abre com o Salão do Senhor Nv4.',
    );
    const underway = accept(rich, command('startConstruction', { building: 'watchtower' })).state;
    expect(viewOf(underway, 'buildWatchtower').missing).toBe(
      'A obra da Torre de Vigia já começou: o objetivo se cumpre quando ela terminar.',
    );
  });

  it('a visão nunca mostra mais de três ativos, nem objetivo ainda escondido', () => {
    const { state } = allObjectivesScenario();
    const all = deriveViewState(state, state.lastProcessedAt).objectives;
    expect(all.map((objective) => objective.id)).toEqual(ids);
    expect(all.every((objective) => objective.status === 'completed')).toBe(true);
    for (let done = 0; done <= ids.length; done += 1) {
      const view = deriveViewState(gameWith(reached(done)), 0).objectives;
      expect(view.filter((objective) => objective.status === 'active').length).toBe(
        Math.min(3, ids.length - done),
      );
      expect(view.map((objective) => objective.id)).toEqual(ids.slice(0, done + 3));
    }
  });
});
