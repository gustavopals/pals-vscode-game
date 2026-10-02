import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  accept,
  autumnScenario,
  command,
  craftScenario,
  DAY,
  gameWith,
  HOUR,
  impoverishedScenario,
  MINUTE,
  newGame,
  objectivesScenario,
  proudScenario,
  queuesScenario,
  winterColdScenario,
} from './test-helpers';
import type { GameState } from './types';
import { deriveViewState } from './view';

const view = (state: GameState) => deriveViewState(state, state.lastProcessedAt);
const farmers = accept(newGame(), command('setWorkers', { building: 'farm', count: 2 })).state;

describe('deriveViewState', () => {
  it('estado inicial: 5 aldeões livres, 10 vagas e nada em andamento', () => {
    const initial = view(newGame());
    expect(initial.settlement).toEqual({
      name: 'Pedra Alta',
      townHallLevel: 1,
      difficulty: 'lord',
      difficultyLabel: 'Senhor',
      paceLabel: 'Normal: um ano em 7 dias',
    });
    expect(initial.calendar).toEqual({
      year: 1,
      season: 'spring',
      seasonLabel: 'Primavera',
      dayOfSeason: 1,
      dayOfYear: 1,
      secondsToNextDay: 7200,
      secondsToNextSeason: 24 * 7200,
      seasonEffects: 'Primavera: comida × 1,2; recrutamento com prazo × 0,8.',
      nextSeason: {
        id: 'summer',
        label: 'Verão',
        secondsUntil: 24 * 7200,
        changes: [
          'A produção de comida passa de × 1,2 para × 1.',
          'A produção de madeira e pedra passa de × 1 para × 1,15.',
          'O recrutamento volta ao prazo de sempre.',
        ],
        firewood: null,
        // Ninguém na Fazenda: os 180 de comida acabam em 36 h, antes do verão. O prazo é o de
        // agora (`depletesInSeconds`), e a previsão da estação que vem sai de cena.
        food: null,
      },
      // O inverno está a três estações: 5 habitantes queimam 60, e os 120 de madeira bastam.
      nextFirewoodSeason: {
        id: 'winter',
        label: 'Inverno',
        secondsUntil: 72 * 7200,
        firewood: {
          perHour: 2.5,
          winterTotal: 60,
          winterProduction: 0,
          stock: 120,
          gathered: 0,
          reserved: 0,
          missing: 0,
          text: 'O Inverno vai queimar 60 de madeira com 5 habitantes. O estoque e a Serraria dão conta.',
        },
      },
    });
    expect(initial.population).toMatchObject({
      villagers: 5,
      capacity: 10,
      free: 5,
      inTraining: 0,
    });
    expect(initial.population.breakdown).toBe(
      'Salão do Senhor Nv1 × 5 + Habitações Nv1 × 5 = 10 vagas',
    );
    expect(initial.resources.map((row) => [row.id, row.stock, row.cap, row.perHour])).toEqual([
      ['food', 180, 500, -5],
      ['wood', 120, 500, 0],
      ['stone', 65, 500, 0],
      ['gold', 250, null, 0],
    ]);
    expect(initial.resources[0]?.depletesInSeconds).toBe(36 * 3600);
    expect(initial.constructions.active).toBeNull();
    expect(initial.famine).toBeNull();
    expect(initial.winter).toBeNull();
    expect(initial.pendingDecisions).toEqual([]);
  });

  it('com 2 lavradores recém-chegados e 5 habitantes, a comida rende +7/h na primavera', () => {
    const food = view(farmers).resources[0];
    expect(food).toMatchObject({ id: 'food', perHour: 7, depletesInSeconds: null });
    expect(food?.breakdown).toBe(
      'Fazenda: 2 trabalhadores (2 em adaptação por 2 h, valendo metade: contam como 1) × 10 × 1 (Nv1) × 1,2 (primavera) = 12/h; consumo 5 × 1 = 5/h',
    );
  });

  it('adaptados, um dia de jogo depois, rendem +20,5/h: os 24 de sempre, 4 de experiência e a moral em 60', () => {
    const food = deriveViewState(farmers, DAY).resources[0];
    expect(food).toMatchObject({ id: 'food', perHour: 20.5, depletesInSeconds: null });
    expect(food?.breakdown).toBe(
      'Fazenda: 2 trabalhadores × 10 × 1 (Nv1) × 1,012 (mestria 4) × 1,2 (primavera) × 1,05 (moral 60) = 25,5/h; consumo 5 × 1 = 5/h',
    );
  });

  it('a explicação segue o formato do GDD §13.3', () => {
    const state = gameWith((draft) => {
      draft.settlement.population.villagers = 18;
      draft.settlement.workers.farm = 4;
      draft.settlement.buildings.farm = 2;
    });
    const derived = view(state);
    expect(derived.resources[0]?.breakdown).toBe(
      'Fazenda: 4 trabalhadores × 10 × 1,2 (Nv2) × 1,2 (primavera) = 57,6/h; consumo 18 × 1 = 18/h',
    );
    expect(derived.workers[0]).toMatchObject({
      building: 'farm',
      level: 2,
      assigned: 4,
      grossPerHour: 57.6,
      perWorkerPerHour: 14.4,
      breakdown: '4 trabalhadores × 10 × 1,2 (Nv2) × 1,2 (primavera) = 57,6/h',
    });
    // Um fator neutro (a madeira na primavera) não aparece na explicação.
    expect(derived.workers[1]?.breakdown).toBe('0 trabalhadores × 8 × 1 (Nv1) = 0/h');
  });

  it('lista as melhorias disponíveis com custos, duração e motivo de bloqueio', () => {
    const { available } = view(farmers).constructions;
    expect(available.map((entry) => entry.building)).toEqual([
      'townHall',
      'farm',
      'lumberMill',
      'quarry',
      'goldMine',
      'housing',
      'granary',
      'warehouse',
    ]);
    const byBuilding = Object.fromEntries(available.map((entry) => [entry.building, entry]));
    expect(byBuilding.lumberMill).toMatchObject({
      label: 'Serraria',
      fromLevel: 1,
      targetLevel: 2,
      durationSeconds: 300,
      durationNote: null,
      affordable: true,
      blockedCode: null,
      blockedReason: null,
      cost: [
        { resource: 'wood', label: 'Madeira', amount: 100, missing: 0 },
        { resource: 'stone', label: 'Pedra', amount: 50, missing: 0 },
      ],
    });
    expect(byBuilding.townHall).toMatchObject({
      affordable: false,
      blockedCode: 'INSUFFICIENT_RESOURCES',
      blockedReason: 'Faltam 30 madeira e 35 pedra.',
    });
    expect(byBuilding.townHall?.cost).toEqual([
      { resource: 'wood', label: 'Madeira', amount: 150, missing: 30 },
      { resource: 'stone', label: 'Pedra', amount: 100, missing: 35 },
      { resource: 'gold', label: 'Ouro', amount: 100, missing: 0 },
    ]);
    expect(available.filter((entry) => entry.affordable).map((entry) => entry.building)).toEqual([
      'farm',
      'lumberMill',
      'quarry',
      'housing',
    ]);
  });

  it('mostra a obra ativa com contagem regressiva e progresso, e a tira das disponíveis', () => {
    const started = accept(newGame(), command('startConstruction', { building: 'farm' })).state;
    const derived = deriveViewState(started, 2 * MINUTE);
    expect(derived.constructions.active).toEqual({
      building: 'farm',
      label: 'Fazenda',
      targetLevel: 2,
      secondsRemaining: 180,
      totalSeconds: 300,
      progressPercent: 40,
      // 80% de 80 madeira e 40 ouro.
      refund: [
        { resource: 'wood', label: 'Madeira', amount: 64, lost: 0 },
        { resource: 'gold', label: 'Ouro', amount: 32, lost: 0 },
      ],
    });
    expect(derived.constructions.available.map((entry) => entry.building)).not.toContain('farm');
    expect(derived.constructions.available[0]).toMatchObject({
      blockedCode: 'QUEUE_LOCKED',
      blockedReason:
        'Os pedreiros já estão ocupados com outra obra. A segunda fila abre com o Salão do Senhor Nv4.',
    });
  });

  it('mostra as obras planejadas com o custo do nível planejado', () => {
    const started = accept(newGame(), command('startConstruction', { building: 'farm' })).state;
    const planned = accept(started, command('planConstruction', { building: 'farm' })).state;
    expect(view(planned).constructions.planned).toMatchObject([
      {
        building: 'farm',
        fromLevel: 2,
        targetLevel: 3,
        durationSeconds: 450,
        planned: true,
        affordable: false,
        cost: [
          { resource: 'wood', amount: 128, missing: 88 },
          { resource: 'gold', amount: 64, missing: 0 },
        ],
      },
    ]);
    const other = accept(newGame(), command('planConstruction', { building: 'housing' })).state;
    expect(
      view(other).constructions.available.find((entry) => entry.building === 'housing'),
    ).toMatchObject({ planned: true });
    expect(view(other).constructions.planned[0]).toMatchObject({ affordable: true });
  });

  it('informa o recrutamento: custo, vagas e fila', () => {
    expect(view(newGame()).recruitment).toEqual({
      cost: [
        { resource: 'food', label: 'Comida', amount: 50, missing: 0 },
        { resource: 'gold', label: 'Ouro', amount: 10, missing: 0 },
      ],
      // Na primavera, 20 min × 0,8.
      secondsPerVillager: 960,
      durationNote: 'Na Primavera, o prazo de um recrutamento ordenado agora é × 0,8.',
      maxQuantity: 5,
      blockedReason: null,
      // 180 de comida para 5 bocas: qualquer recruta gasta a reserva de 24 h; e cinco enchem
      // as casas.
      moraleNote:
        'Chamar aldeões agora gasta a comida guardada, que vale 10 de moral. Com as casas cheias a moral perde 10: para evitar, chame até 4.',
    });
    const queued = accept(newGame(), command('recruitVillagers', { quantity: 3 })).state;
    const derived = deriveViewState(queued, 5 * MINUTE);
    expect(derived.population).toMatchObject({ inTraining: 3, secondsToNextRecruit: 660 });
    expect(derived.recruitment).toMatchObject({
      maxQuantity: 2,
      blockedReason: 'Faltam 21 comida.',
    });
  });

  it('na fome, mostra o aviso, a penalidade na explicação e a fila congelada', () => {
    const queued = accept(
      gameWith((draft) => {
        draft.settlement.resources.food = 51_000;
        draft.settlement.workers.lumberMill = 1;
      }),
      command('recruitVillagers', { quantity: 1 }),
    ).state;
    const derived = deriveViewState(queued, HOUR);
    expect(derived.famine).toMatchObject({ sinceMs: 12 * MINUTE, secondsElapsed: 48 * 60 });
    expect(derived.population.secondsToNextRecruit).toBeNull();
    expect(derived.recruitment.blockedReason).toMatch(/fome/);
    expect(derived.workers[1]?.breakdown).toBe('1 trabalhador × 8 × 1 (Nv1) × 0,75 (fome) = 6/h');
    expect(derived.resources[0]).toMatchObject({ stock: 0, perHour: -5, depletesInSeconds: null });
  });

  it('lista os objetivos revelados com progresso', () => {
    const queued = accept(farmers, command('recruitVillagers', { quantity: 2 })).state;
    expect(deriveViewState(queued, HOUR).objectives).toEqual([
      {
        id: 'allocateFarmers',
        title: 'Aloque 2 aldeões na Fazenda',
        hint: 'Comida é o que mantém todo o resto.',
        reward: '+20 ouro',
        status: 'completed',
        progress: { current: 2, target: 2 },
      },
      expect.objectContaining({ id: 'upgradeHousing', status: 'active' }),
      expect.objectContaining({ id: 'recruitVillagers', progress: { current: 2, target: 3 } }),
      expect.objectContaining({ id: 'townHallLevel2', progress: { current: 1, target: 2 } }),
    ]);
  });

  it('avança sozinho até o instante pedido, sem mutar a entrada, e não volta no tempo', () => {
    const before = JSON.stringify(farmers);
    const derived = deriveViewState(farmers, 2 * HOUR);
    // Dois lavradores em adaptação: 12 − 5 = +7 por hora.
    expect(derived.resources[0]?.stock).toBe(194);
    expect(derived.calendar).toMatchObject({ dayOfSeason: 2, secondsToNextDay: 7200 });
    expect(JSON.stringify(farmers)).toBe(before);
    expect(derived).toEqual(view(advanceTo(farmers, 2 * HOUR).state));
    expect(() => deriveViewState(advanceTo(farmers, HOUR).state, 0)).toThrow(/não volta no tempo/);
  });
});

describe('ofícios na visão (GDD §5.4)', () => {
  const rowOf = (state: GameState, building: string, timeScale?: number) => {
    const derived = deriveViewState(
      state,
      state.lastProcessedAt,
      timeScale === undefined ? {} : { timeScale },
    );
    const found = derived.workers.find((row) => row.building === building);
    if (found === undefined) {
      throw new Error(`A visão não tem ${building}.`);
    }
    return found;
  };

  it('as regras chegam em frases prontas, antes de qualquer troca', () => {
    expect(view(newGame()).workersRules).toEqual({
      adaptationSeconds: 7200,
      adaptationText: 'Quem troca de ofício produz metade por 2 h.',
      removalText: 'Ao tirar trabalhadores, saem primeiro os que ainda estão em adaptação.',
      experienceText:
        'A experiência do ofício vai de 0 a 100: a cada virada do dia, sobe 4 no edifício com ao menos 1 trabalhador por nível e cai 8 no edifício vazio. No máximo, a produção rende 30% a mais.',
      experienceMax: 100,
      masteryMaxBonusPercent: 30,
    });
  });

  it('o prazo da adaptação sai no ritmo da partida: 40 min no Rápido, 4 h no Tranquilo', () => {
    const rules = (timeScale: number) => deriveViewState(newGame(), 0, { timeScale }).workersRules;
    expect(rules(3)).toMatchObject({
      adaptationSeconds: 2400,
      adaptationText: 'Quem troca de ofício produz metade por 40 min.',
    });
    expect(rules(0.5)).toMatchObject({
      adaptationSeconds: 14_400,
      adaptationText: 'Quem troca de ofício produz metade por 4 h.',
    });
    // A regra da experiência não fala em tempo real: conta viradas de dia.
    expect(rules(3).experienceText).toBe(rules(1).experienceText);
  });

  it('um feudo novo: ninguém trabalha, nenhuma experiência, e a frase diz como começar', () => {
    expect(rowOf(newGame(), 'lumberMill')).toMatchObject({
      assigned: 0,
      grossPerHour: 0,
      perWorkerPerHour: 8,
      perNewWorkerPerHour: 4,
      experience: 0,
      masteryBonusPercent: 0,
      occupiedFrom: 1,
      experienceTrend: 'steady',
      experienceNote:
        'Ninguém trabalha na Serraria. Com ao menos 1 trabalhador, a experiência sobe 4 a cada virada do dia.',
      adapting: 0,
      adaptationEndsInSeconds: null,
      adaptingCohorts: [],
    });
  });

  it('a Fazenda em adaptação: quantos, até quando, por quantos contam e o que rendem', () => {
    expect(rowOf(craftScenario(), 'farm')).toEqual({
      building: 'farm',
      label: 'Fazenda',
      level: 3,
      resource: 'food',
      assigned: 4,
      // 3 × 10 × 1,4 × 1,12 × 1,3.
      grossPerHour: 61.152,
      perWorkerPerHour: 20.384,
      perNewWorkerPerHour: 10.192,
      breakdown:
        '4 trabalhadores (2 em adaptação por 38 min, valendo metade: contam como 3) × 10 × 1,4 (Nv3) × 1,12 (mestria 40) × 1,3 (outono) = 61,15/h',
      experience: 40,
      masteryBonusPercent: 12,
      occupiedFrom: 3,
      experienceTrend: 'rising',
      experienceNote:
        'A experiência sobe 4 a cada virada do dia enquanto houver ao menos 3 trabalhadores.',
      adapting: 2,
      adaptationEndsInSeconds: 38 * 60,
      adaptingCohorts: [{ count: 2, endsInSeconds: 38 * 60 }],
    });
  });

  it('a Serraria dominada: 30% a mais, e o que a faria perder a mão', () => {
    expect(rowOf(craftScenario(), 'lumberMill')).toMatchObject({
      assigned: 4,
      grossPerHour: 41.6,
      breakdown: '4 trabalhadores × 8 × 1 (Nv1) × 1,3 (mestria 100) = 41,6/h',
      experience: 100,
      masteryBonusPercent: 30,
      experienceTrend: 'steady',
      experienceNote:
        'Ofício dominado: 30% a mais de produção. Só se perde se ninguém trabalhar na Serraria.',
      adapting: 0,
      adaptationEndsInSeconds: null,
    });
  });

  it('a Pedreira com gente de menos: a experiência não sobe, e a frase diz quantos faltam', () => {
    expect(rowOf(craftScenario(), 'quarry')).toMatchObject({
      level: 3,
      assigned: 2,
      // 1,5 × 5 × 1,4 × 1,06.
      grossPerHour: 11.13,
      breakdown:
        '2 trabalhadores (1 em adaptação por 1 h 38 min, valendo metade: contam como 1,5) × 5 × 1,4 (Nv3) × 1,06 (mestria 20) = 11,13/h',
      experience: 20,
      masteryBonusPercent: 6,
      occupiedFrom: 3,
      experienceTrend: 'steady',
      experienceNote:
        'A experiência não sobe: a Pedreira no nível 3 pede ao menos 3 trabalhadores (falta 1).',
      adapting: 1,
      adaptationEndsInSeconds: 98 * 60,
    });
  });

  it('a Mina vazia: o ofício se perde, e a frase diz quanto', () => {
    expect(rowOf(craftScenario(), 'goldMine')).toMatchObject({
      assigned: 0,
      grossPerHour: 0,
      // O que um mineiro renderia: 4 × 1,048 × 1,1; chegando agora, a metade.
      perWorkerPerHour: 4.611,
      perNewWorkerPerHour: 2.305,
      breakdown: '0 trabalhadores × 4 × 1 (Nv1) × 1,048 (mestria 16) × 1,1 (outono) = 0/h',
      experience: 16,
      masteryBonusPercent: 4.8,
      experienceTrend: 'falling',
      experienceNote:
        'Sem ninguém na Mina de Ouro, o ofício se perde: 8 de experiência a menos a cada virada do dia.',
    });
  });

  it('duas levas no mesmo edifício: a visão lista as duas e a frase dá o prazo da última', () => {
    const later = accept(
      craftScenario(),
      command('setWorkers', { building: 'farm', count: 6 }),
    ).state;
    expect(rowOf(later, 'farm')).toMatchObject({
      assigned: 6,
      adapting: 4,
      adaptationEndsInSeconds: 7200,
      adaptingCohorts: [
        { count: 2, endsInSeconds: 38 * 60 },
        { count: 2, endsInSeconds: 7200 },
      ],
      breakdown:
        '6 trabalhadores (4 em adaptação por até 2 h, valendo metade: contam como 4) × 10 × 1,4 (Nv3) × 1,12 (mestria 40) × 1,3 (outono) = 81,54/h',
    });
    // No ritmo 3 os mesmos prazos, em tempo real: 12 min 40 s e 40 min.
    expect(rowOf(later, 'farm', 3)).toMatchObject({
      adaptationEndsInSeconds: 2400,
      adaptingCohorts: [
        { count: 2, endsInSeconds: 760 },
        { count: 2, endsInSeconds: 2400 },
      ],
    });
    expect(rowOf(later, 'farm', 3).breakdown).toContain('(4 em adaptação por até 40 min,');
  });

  it('"acaba em" conta com quem ainda se adapta: o alarme não toca à toa', () => {
    // Dez bocas e um lavrador recém-chegado na Fazenda Nv2: 7,2 por hora agora, contra 10 de
    // consumo; adaptado, 14,4. Com 180 de comida, o saldo vira antes de a despensa esvaziar.
    const hired = accept(
      gameWith((draft) => {
        draft.settlement.population.villagers = 10;
        draft.settlement.buildings.farm = 2;
      }),
      command('setWorkers', { building: 'farm', count: 1 }),
    ).state;
    const food = view(hired).resources[0];
    expect(food).toMatchObject({ perHour: -2.8, depletesInSeconds: null });
    // Com tão pouca comida que ela acaba antes de a adaptação terminar, o alarme toca, e na hora
    // certa: 2 de comida a 2,8 por hora.
    const poor = accept(
      gameWith((draft) => {
        draft.settlement.population.villagers = 10;
        draft.settlement.buildings.farm = 2;
        draft.settlement.resources.food = 2_000;
      }),
      command('setWorkers', { building: 'farm', count: 1 }),
    ).state;
    const depletes = view(poor).resources[0]?.depletesInSeconds;
    expect(depletes).toBe(Math.floor((2_000 * 3600) / 2_800));
    const famine = advanceTo(poor, ((depletes ?? 0) + 1) * 1000).events.find(
      (event) => event.type === 'famineStarted',
    );
    expect(Math.floor((famine?.atMs ?? 0) / 1000)).toBe(depletes);
  });

  it('um só trabalhador, em adaptação: a frase fica no singular', () => {
    const one = accept(newGame(), command('setWorkers', { building: 'quarry', count: 1 })).state;
    expect(rowOf(one, 'quarry').breakdown).toBe(
      '1 trabalhador (1 em adaptação por 2 h, valendo metade: conta como 0,5) × 5 × 1 (Nv1) = 2,5/h',
    );
  });

  it('a contagem regressiva da adaptação anda com o relógio e some no fim', () => {
    const state = craftScenario();
    const at = (minutes: number) =>
      deriveViewState(state, state.lastProcessedAt + minutes * MINUTE).workers[0];
    expect(at(37)).toMatchObject({ adapting: 2, adaptationEndsInSeconds: 60 });
    // No fim da adaptação veio também a virada do dia: 4 de experiência a mais, e a moral,
    // com a comida guardada, em 60.
    expect(at(38)).toMatchObject({
      adapting: 0,
      adaptationEndsInSeconds: null,
      adaptingCohorts: [],
      experience: 44,
      breakdown:
        '4 trabalhadores × 10 × 1,4 (Nv3) × 1,132 (mestria 44) × 1,3 (outono) × 1,05 (moral 60) = 86,53/h',
    });
  });
});

describe('golden do ViewState', () => {
  it('estado inicial, primeira alocação e fim do cenário dos objetivos', async () => {
    const golden = {
      initial: view(newGame('pedra-alta')),
      afterFirstAllocation: view(farmers),
      afterObjectivesScenario: view(objectivesScenario().state),
      // As estações: o outono de quem ainda não guardou lenha e o inverno de quem ficou sem ela.
      autumnBeforeWinter: view(autumnScenario()),
      winterCold: view(winterColdScenario()),
      // As duas filas ocupadas e uma planejada para cada espera: obra anterior, fila, recurso,
      // depósito e Salão.
      queuesAndPlans: view(queuesScenario()),
      // Um ofício em cada situação: em adaptação, dominado, com gente de menos e vazio.
      crafts: view(craftScenario()),
      // A moral nos dois extremos: o feudo empobrecido (fome, frio, moral zero, no piso de 3
      // aldeões) e o feudo orgulhoso, com um efeito temporário e a chance do colono.
      impoverished: view(impoverishedScenario()),
      proud: view(proudScenario()),
    };
    await expect(`${JSON.stringify(golden, null, 2)}\n`).toMatchFileSnapshot(
      './__golden__/view-seed-pedra-alta.json',
    );
  });
});
