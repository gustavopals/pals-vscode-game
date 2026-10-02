import { DIFFICULTY_IDS } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { CURRENT_SCHEMA_VERSION, migrateState } from './migrations';
import { createInitialState } from './state';
import {
  command,
  councilScenario,
  craftScenario,
  DAY,
  HOUR,
  MINUTE,
  newGame,
  objectivesScenario,
  play,
  proudScenario,
  runWeekScenario,
  settings,
} from './test-helpers';
import type { GameState } from './types';

const YEAR = 84 * DAY;

// O retrato da versão 1 que o bot do simulador deixou, como texto: o cenário `migrated-3x`
// parte dele.
const weekBot3x = Object.values(
  import.meta.glob<string>('./__fixtures__/state-v1-week-bot-3x.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0] as string;

/**
 * Retratos do estado **na versão atual**, um por cenário, gravados em
 * `__fixtures__/state-v<versão>-<cenário>.json`.
 *
 * Enquanto a versão não sobe, estes arquivos são goldens: uma mudança de regra aparece neles e
 * só é regravada com `UPDATE_GOLDEN=1`. No commit que sobe `schemaVersion`, este teste passa a
 * escrever os arquivos da versão nova e os da versão anterior ficam **congelados** para sempre,
 * como entrada do passo de migração novo (`migrations.test.ts`). Assim toda versão do estado
 * que já existiu tem retratos feitos pelo motor da época, sem ninguém ter de lembrar de gerá-los.
 */
const scenarios: Record<string, () => GameState> = {
  // Feudo recém-criado: ninguém deu ordem nenhuma.
  fresh: () => newGame('fixture-fresh'),

  // Obra em curso, duas planejadas e dois aldeões a caminho, no meio de um trecho de produção.
  construction: () =>
    play(newGame('fixture-construction'), [
      command('setWorkers', { building: 'farm', count: 2 }),
      command('setWorkers', { building: 'lumberMill', count: 2 }),
      command('setWorkers', { building: 'quarry', count: 1 }),
      command('startConstruction', { building: 'housing' }),
      command('planConstruction', { building: 'farm' }),
      command('planConstruction', { building: 'lumberMill' }),
      command('recruitVillagers', { quantity: 2 }),
      { at: 2 * MINUTE + 7_321 },
    ]).state,

  // Fome: ninguém na Fazenda, a última comida gasta em um recruta, a fila congelada.
  famine: () =>
    play(newGame('fixture-famine'), [
      command('setWorkers', { building: 'lumberMill', count: 3 }),
      command('setWorkers', { building: 'quarry', count: 2 }),
      command('startConstruction', { building: 'housing' }),
      { at: 25 * HOUR + 54 * MINUTE },
      command('recruitVillagers', { quantity: 1 }),
      { at: 41 * HOUR + 13 * MINUTE },
    ]).state,

  // Frio: a madeira inteira gasta em uma obra na primavera, ninguém na Serraria, e o inverno
  // chega. O frio abre na virada; um aldeão foi chamado no meio dele.
  cold: () =>
    play(newGame('fixture-cold'), [
      command('setWorkers', { building: 'farm', count: 5 }),
      command('startConstruction', { building: 'quarry' }),
      { at: 72 * DAY + 5 * HOUR + 13 * MINUTE },
      command('recruitVillagers', { quantity: 1 }),
      { at: 72 * DAY + 5 * HOUR + 19 * MINUTE + 4_321 },
    ]).state,

  // Armazenamento: o Celeiro erguido e cheio, o Armazém em obra e desperdício ainda não
  // relatado, no meio de um dia. Em Rei de Ferro, para o fator da dificuldade entrar no limite.
  storage: () =>
    play(createInitialState('fixture-storage', { ...settings, difficulty: 'ironKing' }), [
      command('setWorkers', { building: 'farm', count: 2 }),
      command('setWorkers', { building: 'lumberMill', count: 2 }),
      command('setWorkers', { building: 'quarry', count: 1 }),
      { at: 20 * HOUR },
      command('startConstruction', { building: 'townHall' }),
      { at: 24 * HOUR },
      command('startConstruction', { building: 'granary' }),
      { at: 71 * HOUR },
      command('startConstruction', { building: 'warehouse' }),
      { at: 71 * HOUR + 3 * MINUTE + 1_234 },
    ]).state,

  // Filas e planejadas: o Salão no nível 4 com as duas filas ocupadas, e três planejadas na
  // lista: uma automática que espera a obra anterior do mesmo edifício, uma manual e uma
  // automática que espera recurso. No ritmo Rápido, no meio de um trecho de produção.
  queues: () =>
    play(
      (() => {
        const start = createInitialState('fixture-queues', { ...settings, timeScale: 3 });
        start.settlement.buildings.townHall = 4;
        start.settlement.buildings.warehouse = 2;
        start.settlement.resources = { food: 400_000, wood: 420_000, stone: 300_000, gold: 90_000 };
        return start;
      })(),
      [
        command('setWorkers', { building: 'farm', count: 2 }),
        command('setWorkers', { building: 'lumberMill', count: 2 }),
        command('setWorkers', { building: 'goldMine', count: 1 }),
        command('startConstruction', { building: 'lumberMill' }),
        command('startConstruction', { building: 'goldMine' }),
        command('planConstruction', { building: 'lumberMill', autoStart: true }),
        command('planConstruction', { building: 'housing' }),
        command('planConstruction', { building: 'townHall', autoStart: true }),
        { at: 3 * MINUTE + 4_567 },
      ],
    ).state,

  // Ofícios: um edifício com gente em adaptação e experiência pela metade, outro dominado (com
  // o ano em que foi), outro com gente de menos e uma leva mais nova, e outro vazio, perdendo
  // a experiência. No meio de um dia de jogo e de um trecho de produção.
  crafts: () => {
    const state = craftScenario();
    return advanceTo(state, state.lastProcessedAt + 7 * MINUTE + 2_345).state;
  },

  // Moral: o feudo orgulhoso, com um efeito temporário ainda na lista, a moral longe da base
  // e o fluxo de sorteios `morale` já usado. No meio de um dia de jogo.
  morale: () => proudScenario(),

  // O Conselho no fim de uma cadeia que ninguém acompanhou, no ritmo Rápido: uma carta na mesa,
  // o desfecho agendado como continuação, uma carta expirada no ano, três flags e o fluxo de
  // sorteios `council` já usado. No meio de um dia de jogo.
  council: () => councilScenario(47 * DAY + 30 * MINUTE + 1_234),

  // O Conselho logo depois de uma escolha que esconde um efeito: a mesa vazia e o efeito à
  // espera da virada de dia dele.
  'council-hidden': () => councilScenario(5 * DAY + 13 * MINUTE + 4_321),

  // A Ameaça: a Torre de Vigia erguida a tempo de os vigias contarem a Ameaça passando dos 40,
  // a obra do nível 2 em curso, o covil ativo e nenhuma incursão marcada. No meio de um dia de
  // jogo, com cartas do Conselho na mesa.
  threat: () =>
    play(
      (() => {
        const start = createInitialState('fixture-threat', settings);
        start.settlement.buildings.townHall = 2;
        start.settlement.resources = {
          food: 400_000,
          wood: 400_000,
          stone: 400_000,
          gold: 200_000,
        };
        return start;
      })(),
      [
        command('setWorkers', { building: 'farm', count: 3 }),
        command('setWorkers', { building: 'quarry', count: 2 }),
        command('startConstruction', { building: 'watchtower' }),
        { at: 9 * DAY + 20 * MINUTE },
        command('startConstruction', { building: 'watchtower' }),
        { at: 9 * DAY + 23 * MINUTE + 2_345 },
      ],
    ).state,

  // Os quatro primeiros objetivos concluídos.
  objectives: () => objectivesScenario().state,

  // O cenário roteirizado de 7 dias reais: ano 2, feudo renomeado, estoque de uma semana.
  'week-scripted': () => runWeekScenario().state,

  // Uma partida da v0.1 que a migração já alcançou, no ritmo da produção: o feudo do bot (ano 4,
  // estoque alto), migrado e jogado por mais cinco dias de jogo. A fronteira ficou para trás;
  // há obra em curso, uma planejada e um recruta a caminho.
  'migrated-3x': () => {
    const migrated = migrateState(JSON.parse(weekBot3x), { timeScale: 3 });
    return play(migrated, [
      // As Habitações estavam cheias e presas ao Salão: primeiro a obra que abre o caminho.
      command('startConstruction', { building: 'townHall' }),
      { at: migrated.lastProcessedAt + 5 * DAY + 4 * MINUTE },
      command('setWorkers', { building: 'lumberMill', count: 9 }),
      command('setWorkers', { building: 'farm', count: 8 }),
      command('recruitVillagers', { quantity: 2 }),
      command('startConstruction', { building: 'housing' }),
      command('planConstruction', { building: 'farm' }),
      { at: migrated.lastProcessedAt + 5 * DAY + 37 * MINUTE },
      command('startConstruction', { building: 'lumberMill' }),
      { at: migrated.lastProcessedAt + 5 * DAY + 37 * MINUTE + 11_003 },
    ]).state;
  },

  // Rei de Ferro no ritmo Tranquilo, o único que não é inteiro: primeiras ordens, no meio de um
  // trecho de produção.
  'iron-king-half': () =>
    play(
      createInitialState('fixture-iron-king-half', {
        ...settings,
        difficulty: 'ironKing',
        timeScale: 0.5,
      }),
      [
        command('setWorkers', { building: 'farm', count: 3 }),
        command('setWorkers', { building: 'quarry', count: 2 }),
        command('startConstruction', { building: 'housing' }),
        command('planConstruction', { building: 'lumberMill' }),
        command('recruitVillagers', { quantity: 1 }),
        { at: MINUTE + 59_003 },
      ],
    ).state,

  // Camponês no ritmo Rápido, nascido nesta versão (sem fronteira) e já no ano 3: é a partida
  // criada entre duas publicações, que a migração seguinte encontra longe do começo.
  'peasant-3x': () =>
    play(
      createInitialState('fixture-peasant-3x', {
        ...settings,
        difficulty: 'peasant',
        timeScale: 3,
      }),
      [
        command('setWorkers', { building: 'farm', count: 3 }),
        command('setWorkers', { building: 'lumberMill', count: 2 }),
        command('startConstruction', { building: 'housing' }),
        { at: 2 * YEAR + 5 * DAY + 13 * MINUTE + 777 },
        command('planConstruction', { building: 'farm' }),
      ],
    ).state,
};

describe(`retratos do estado na versão ${CURRENT_SCHEMA_VERSION}`, () => {
  it.each(Object.keys(scenarios))('%s', async (name) => {
    const state = (scenarios[name] as () => GameState)();
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    await expect(`${JSON.stringify(state, null, 1)}\n`).toMatchFileSnapshot(
      `./__fixtures__/state-v${CURRENT_SCHEMA_VERSION}-${name}.json`,
    );
  });

  it('os cenários passam pelos estados que uma migração precisa encontrar', () => {
    const built = Object.fromEntries(
      Object.entries(scenarios).map(([name, build]) => [name, build()]),
    ) as Record<keyof typeof scenarios, GameState>;
    const of = (name: string) => built[name] as GameState;
    const all0 = () => Object.values(built);

    expect(of('fresh').lastProcessedAt).toBe(0);
    expect(of('construction').settlement.constructionQueues.some((slot) => slot !== null)).toBe(
      true,
    );
    expect(of('construction').settlement.planned.length).toBeGreaterThanOrEqual(2);
    expect(of('construction').settlement.recruitmentQueue.length).toBeGreaterThan(0);
    expect(
      Object.values(of('construction').settlement.accumulators).some((rest) => rest !== 0),
    ).toBe(true);
    expect(of('famine').settlement.famine).not.toBeNull();
    expect(of('famine').settlement.recruitmentQueue.length).toBeGreaterThan(0);
    // O frio aberto no inverno, sem fome, com a madeira em zero e um aldeão a caminho.
    expect(of('cold').settlement.cold).toEqual({ sinceMs: 72 * DAY });
    expect(of('cold').settlement.famine).toBeNull();
    expect(of('cold').settlement.resources.wood).toBe(0);
    expect(of('cold').settlement.recruitmentQueue.length).toBe(1);
    // O armazenamento: um depósito construído, outro em obra, um estoque no limite (720 de
    // comida, em Rei de Ferro) e desperdício no total e no contador que a Crônica ainda não
    // relatou.
    expect(of('storage').settlement.buildings.granary).toBe(1);
    expect(of('storage').settlement.constructionQueues[0]?.building).toBe('warehouse');
    expect(of('storage').settlement.resources.food).toBe(720_000);
    expect(of('storage').stats.wasted_food).toBeGreaterThan(0);
    expect(of('storage').stats.wasted_wood).toBeGreaterThan(0);
    expect(of('storage').settlement.wasted.food).toBeGreaterThan(0);
    expect(of('storage').settlement.wasted.food).toBeLessThan(of('storage').stats.wasted_food ?? 0);
    // As filas e as planejadas: as duas filas com obra, e na lista uma automática de um
    // edifício que está em obras, uma manual e uma automática de outro edifício.
    const queues = of('queues').settlement;
    expect(queues.constructionQueues.map((slot) => slot?.building ?? null)).toEqual([
      'lumberMill',
      'goldMine',
    ]);
    expect(queues.planned).toEqual([
      { building: 'lumberMill', targetLevel: 3, autoStart: true },
      { building: 'housing', targetLevel: 2, autoStart: false },
      { building: 'townHall', targetLevel: 5, autoStart: true },
    ]);
    for (const state of Object.values(built)) {
      expect(state.settlement.constructionQueues).toHaveLength(2);
    }
    // Os ofícios: duas coortes em edifícios diferentes, em ordem de término, experiência em
    // quatro valores diferentes (um deles o máximo, outro com gente de menos) e o ano de uma
    // mestria gravado.
    const crafts = of('crafts').settlement;
    expect(crafts.adaptation.map((cohort) => [cohort.building, cohort.count])).toEqual([
      ['farm', 2],
      ['quarry', 1],
    ]);
    expect(crafts.adaptation.every((cohort) => cohort.untilMs > of('crafts').lastProcessedAt)).toBe(
      true,
    );
    expect(crafts.craftExperience).toEqual({ farm: 40, lumberMill: 100, quarry: 20, goldMine: 16 });
    expect(crafts.craftMasteredYear).toEqual({ farm: 0, lumberMill: 1, quarry: 0, goldMine: 0 });
    expect(crafts.workers.goldMine).toBe(0);
    expect(crafts.workers.quarry).toBeLessThan(crafts.buildings.quarry);
    // E, nos outros cenários, a experiência que os dias de jogo foram deixando.
    expect(of('week-scripted').settlement.craftExperience.farm).toBeGreaterThan(0);
    // A moral: um efeito temporário na lista, a moral acima da base e o fluxo `morale` com os
    // quatro inteiros dele; e, no cenário da fome, a moral no chão e gente a menos.
    const proud = of('morale');
    expect(proud.settlement.moraleEffects).toEqual([
      { id: 'teste:festa', label: 'festa da colheita', amount: 30, untilMs: (24 + 9) * DAY },
    ]);
    expect(proud.settlement.morale).toBe(80);
    expect(proud.rng.morale).toHaveLength(4);
    expect(of('famine').settlement.morale).toBeLessThan(25);
    expect(of('famine').settlement.population.villagers).toBeLessThan(5);
    expect(new Set(all0().map((state) => state.settlement.morale)).size).toBeGreaterThan(2);
    // O Conselho: cada lista do estado dele com alguma coisa dentro, em um cenário ou em outro.
    const council = of('council').council;
    expect(council.pending.map((entry) => entry.cardId)).toEqual(['masonsMeal']);
    expect(council.pending[0]?.expiresAtMs).toBeGreaterThan(of('council').lastProcessedAt);
    expect(council.scheduled).toEqual([
      {
        cardId: 'commonGranaryOutcome',
        atMs: 48 * DAY + 7 * MINUTE,
        previousCardId: 'commonGranaryShare',
        previousOptionId: 'reserve',
        previousInstanceId: 'commonGranaryShare-3',
      },
    ]);
    expect(council.expired).toEqual(['commonGranaryShare-3']);
    expect(Object.keys(council.flags)).toEqual([
      'commonGranary.open',
      'commonGranary.supported',
      'commonGranary.reserved',
    ]);
    expect(council.seenThisYear).toHaveLength(4);
    expect(council.nextDrawAtMs).toBe(48 * DAY);
    expect(of('council').rng.council).toHaveLength(4);
    expect(of('council').stats).toMatchObject({ cardsDrawn: 4, cardsAnswered: 2, cardsExpired: 1 });
    const hidden = of('council-hidden').council;
    expect(hidden.pending).toEqual([]);
    expect(hidden.delayed).toEqual([
      { atMs: 6 * DAY, instanceId: 'collapsedWell-1', cardId: 'collapsedWell', optionId: 'wait' },
    ]);
    // A Ameaça: longe do zero, com a Torre erguida e a obra do nível seguinte em curso; e, no
    // cenário de 7 dias, no máximo, com a Torre no teto desta versão.
    const threat = of('threat');
    expect(threat.map).toEqual({
      tiles: { wolfDen: { type: 'wolfDen', threatActive: true } },
      threat: 45,
    });
    expect(threat.settlement.buildings.watchtower).toBe(1);
    expect(threat.settlement.constructionQueues[0]).toMatchObject({
      building: 'watchtower',
      targetLevel: 2,
    });
    expect(threat.horde).toEqual({ scheduledRaids: [] });
    expect(of('week-scripted').map.threat).toBe(100);
    expect(of('week-scripted').settlement.buildings.watchtower).toBe(2);
    expect(new Set(all0().map((state) => state.map.threat)).size).toBeGreaterThan(3);
    // E o cenário de 7 dias passou pelo Conselho de ponta a ponta.
    expect(of('week-scripted').stats.cardsDrawn).toBeGreaterThan(2);
    expect(of('objectives').objectives.completed.length).toBeGreaterThanOrEqual(4);
    expect(of('week-scripted').clock.year).toBeGreaterThan(1);

    // O que a fundação da v0.2 deixou no estado e que os próximos passos vão ler: a fronteira,
    // o ritmo (que converte prazos de tempo real) e a dificuldade (que tem fatores próprios).
    const all = Object.values(built);
    // Partida migrada há tempos: a fronteira gravada ficou bem atrás de onde a partida está.
    expect(
      all.some(
        (state) => state.migratedAtMs !== null && state.migratedAtMs + DAY < state.lastProcessedAt,
      ),
    ).toBe(true);
    // Partida que nasceu nesta versão e já vai longe: sem fronteira, e no ano 3 ou depois.
    expect(all.some((state) => state.migratedAtMs === null && state.clock.year >= 3)).toBe(true);
    // O ritmo da produção (3) e o único que não é inteiro (0,5), além do 1 dos outros cenários.
    expect(new Set(all.map((state) => state.settings.timeScale))).toEqual(new Set([1, 3, 0.5]));
    expect(new Set(all.map((state) => state.settings.difficulty))).toEqual(new Set(DIFFICULTY_IDS));
  });
});
