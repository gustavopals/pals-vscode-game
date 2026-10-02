import {
  balance,
  BUILDING_IDS,
  DIFFICULTY_IDS,
  PRODUCTION_BUILDING_IDS,
  RESOURCE_IDS,
} from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import {
  CURRENT_SCHEMA_VERSION,
  currentShape,
  type MigrationChain,
  migrateState,
  migrateWith,
  migrationSteps,
  StateMigrationError,
} from './migrations';
import { natural, type Shape } from './migrations/shape';
import { v1ToV2 } from './migrations/v1';
import { stateV2, v2ToV3 } from './migrations/v2';
import { stateV3, v3ToV4 } from './migrations/v3';
import { stateV4, v4ToV5 } from './migrations/v4';
import { stateV5 } from './migrations/v5';
import { command, gameAt, HOUR, MINUTE, newGame, runWeekScenario } from './test-helpers';
import { nextEventAt } from './timeline';
import type { BuildingId, GameState } from './types';
import { REJECTION_CODES } from './types';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;

/** Um estado gravado que o teste pode estragar à vontade. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = Record<string, any>;

// O texto de cada retrato, lido pelo Vitest: cada teste interpreta a sua própria cópia.
const files = import.meta.glob<string>('./__fixtures__/state-v*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

type Fixture = { name: string; version: number; timeScale: number; text: string };

const fixtures: Fixture[] = Object.entries(files)
  .map(([path, text]) => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const version = Number(/^state-v(\d+)-/.exec(name)?.[1]);
    // O ritmo da versão 1 não estava no estado: vinha da linha da partida, e o bot jogou no 3.
    // Da versão 2 em diante ele está gravado, e quem carrega informa o mesmo número.
    const stored = (JSON.parse(text) as { settings: { timeScale?: number } }).settings.timeScale;
    return { name, version, timeScale: stored ?? (name.includes('-3x') ? 3 : 1), text };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const read = (fixture: Fixture) => JSON.parse(fixture.text) as Record<string, unknown>;
const migrated = (fixture: Fixture) =>
  migrateState(read(fixture), { timeScale: fixture.timeScale });
const named = (name: string) => {
  const found = fixtures.find((fixture) => fixture.name === name);
  if (found === undefined) {
    throw new Error(`Falta o retrato ${name}.`);
  }
  return found;
};

/** FNV-1a de 32 bits do texto do arquivo: o bastante para notar um retrato antigo editado. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Retratos de versões anteriores, com a impressão digital do arquivo. Eles foram gravados pelo
 * motor da época e **nunca mais mudam**: se um destes testes falhar, o defeito está na migração,
 * não no retrato. Quando `schemaVersion` subir, acrescente aqui os retratos da versão que acabou
 * de ficar para trás (o teste abaixo diz quais faltam e qual é a impressão de cada um).
 */
const FROZEN: Record<string, string> = {
  'state-v1-construction.json': '78563339',
  'state-v1-famine.json': '564cd9b6',
  'state-v1-fresh.json': 'abde2cf3',
  'state-v1-objectives.json': 'f0ee3653',
  'state-v1-week-bot-3x.json': '03aad6d4',
  'state-v1-week-scripted.json': 'bd507c88',
  'state-v2-construction.json': 'a7e60886',
  'state-v2-famine.json': '580fb023',
  'state-v2-fresh.json': '635c91de',
  'state-v2-iron-king-half.json': '84be606d',
  'state-v2-migrated-3x.json': 'c9380b87',
  'state-v2-objectives.json': '9518b31a',
  'state-v2-peasant-3x.json': 'a50a387f',
  'state-v2-week-scripted.json': '213bb8f1',
  'state-v3-cold.json': 'c2397ba1',
  'state-v3-construction.json': '375a9be6',
  'state-v3-famine.json': '005f938d',
  'state-v3-fresh.json': '95f85d30',
  'state-v3-iron-king-half.json': '47fd3521',
  'state-v3-migrated-3x.json': 'c9b2677f',
  'state-v3-objectives.json': '74abbb8f',
  'state-v3-peasant-3x.json': '448f9116',
  'state-v3-week-scripted.json': 'd1b11263',
  'state-v4-cold.json': 'd2f0aeaa',
  'state-v4-construction.json': '30a24d04',
  'state-v4-famine.json': 'b5c4e8f5',
  'state-v4-fresh.json': '40ca4e90',
  'state-v4-iron-king-half.json': '89f84fdf',
  'state-v4-migrated-3x.json': '6b80c224',
  'state-v4-objectives.json': '35daec40',
  'state-v4-peasant-3x.json': 'a2f70389',
  'state-v4-storage.json': '797741c0',
  'state-v4-week-scripted.json': '7911107c',
  'state-v5-cold.json': 'f5bf0408',
  'state-v5-construction.json': '2fa2de12',
  'state-v5-famine.json': '61f37e61',
  'state-v5-fresh.json': '6c84d674',
  'state-v5-iron-king-half.json': 'd906632d',
  'state-v5-migrated-3x.json': '3948acce',
  'state-v5-objectives.json': 'e0a56ad8',
  'state-v5-peasant-3x.json': '35d952f7',
  'state-v5-queues.json': '3d4361bc',
  'state-v5-storage.json': '745791ce',
  'state-v5-week-scripted.json': '57b9a3e9',
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Caminhos das chaves de estrutura fixa de um estado, tendo uma partida nova como referência:
 * só desce onde a partida nova também tem um objeto. Listas, campos que nascem `null` e os
 * objetos de chaves livres (`rng`, `stats`) contam como um campo só.
 */
function fixedKeys(value: unknown, reference: unknown = value, path = ''): string[] {
  if (!isObject(value) || !isObject(reference) || path === 'rng' || path === 'stats') {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const here = path === '' ? key : `${path}.${key}`;
    return [here, ...fixedKeys(child, reference[key], here)];
  });
}

const buildingIds: BuildingId[] = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
  'granary',
  'warehouse',
];

describe('a lista de passos', () => {
  it('tem um passo por versão, em ordem, até a versão atual', () => {
    expect(migrationSteps.map((step) => step.from)).toEqual(
      Array.from({ length: CURRENT_SCHEMA_VERSION - 1 }, (_, index) => index + 1),
    );
    for (const step of migrationSteps) {
      expect(step.summary.trim()).not.toBe('');
    }
  });

  it('uma partida nova nasce na versão atual e sem fronteira de atualização', () => {
    const state = newGame();
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.migratedAtMs).toBeNull();
    expect(migrateState(state, { timeScale: 1 })).toBe(state);
  });

  it('há retratos de todas as versões que já existiram', () => {
    const versions = new Set(fixtures.map((fixture) => fixture.version));
    for (let version = 1; version <= CURRENT_SCHEMA_VERSION; version += 1) {
      expect(versions, `retratos da versão ${version}`).toContain(version);
    }
  });

  it('os retratos de versões anteriores estão congelados', () => {
    const old = Object.fromEntries(
      fixtures
        .filter((fixture) => fixture.version < CURRENT_SCHEMA_VERSION)
        .map((fixture) => [fixture.name, fingerprint(fixture.text)]),
    );
    expect(old).toEqual(FROZEN);
  });
});

describe('a forma da versão atual', () => {
  it('aceita uma partida nova, em qualquer ritmo e dificuldade', () => {
    expect(currentShape(newGame(), '')).toBeNull();
    const other = { ...newGame(), settings: { ...newGame().settings, timeScale: 0.5 } };
    expect(
      currentShape({ ...other, settings: { ...other.settings, difficulty: 'ironKing' } }, ''),
    ).toBeNull();
  });

  it('aceita todos os estados do cenário de 7 dias, depois de passarem pelo banco', () => {
    const { days } = runWeekScenario();
    expect(days.length).toBe(7);
    for (const { state } of days) {
      expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();
    }
  });

  const damages: Array<[string, (state: Draft) => unknown]> = [
    ['um campo que o motor não escreve', (state) => (state.settlement.morale = 50)],
    ['a chave de limite da versão 1', (state) => (state.settings.capsEnabled = false)],
    ['uma dificuldade desconhecida', (state) => (state.settings.difficulty = 'normal')],
    ['um ritmo zero', (state) => (state.settings.timeScale = 0)],
    ['o ritmo ausente', (state) => delete state.settings.timeScale],
    ['a fronteira ausente', (state) => delete state.migratedAtMs],
    ['o frio ausente', (state) => delete state.settlement.cold],
    ['um frio sem data', (state) => (state.settlement.cold = {})],
    ['o Celeiro ausente', (state) => delete state.settlement.buildings.granary],
    ['um edifício que o motor não conhece', (state) => (state.settlement.buildings.tower = 1)],
    ['o desperdício ausente', (state) => delete state.settlement.wasted],
    ['um desperdício negativo', (state) => (state.settlement.wasted.food = -1)],
    ['o desperdício de um recurso a menos', (state) => delete state.settlement.wasted.gold],
    ['uma fila de obras só', (state) => state.settlement.constructionQueues.pop()],
    ['uma fila de obras a mais', (state) => state.settlement.constructionQueues.push(null)],
    [
      'uma planejada sem dizer se é automática',
      (state) => (state.settlement.planned = [{ building: 'farm', targetLevel: 2 }]),
    ],
    [
      'uma planejada com a marca que não é sim nem não',
      (state) => (state.settlement.planned = [{ building: 'farm', targetLevel: 2, autoStart: 1 }]),
    ],
    ['o número da versão 3', (state) => (state.schemaVersion = 3)],
    ['o número da versão 2', (state) => (state.schemaVersion = 2)],
    ['o número da versão anterior', (state) => (state.schemaVersion = 1)],
    ['um resto de produção ausente', (state) => delete state.settlement.accumulators.wood],
    ['um estoque negativo', (state) => (state.settlement.resources.stone = -1)],
    // É no que um `NaN` vira depois de passar pelo banco: JSON não tem `NaN`.
    ['um estoque nulo', (state) => (state.settlement.resources.wood = null)],
  ];

  it.each(damages)('recusa %s', (_, damage) => {
    const state = JSON.parse(JSON.stringify(newGame())) as Draft;
    damage(state);
    expect(currentShape(state, '')).not.toBeNull();
  });

  // O estado que declara a versão atual é conferido como o de qualquer outra: o número da
  // versão não é salvo-conduto (GDD §15.4).
  it.each(damages)('`migrateState` recusa %s, sem tocar na entrada', (_, damage) => {
    const state = JSON.parse(JSON.stringify(newGame())) as Draft;
    damage(state);
    const copy = JSON.parse(JSON.stringify(state)) as unknown;
    let caught: unknown;
    try {
      migrateState(state, { timeScale: 1 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StateMigrationError);
    expect((caught as StateMigrationError).reason).toBe('invalid');
    expect(state).toEqual(copy);
  });

  it('o que o motor calcularia a partir de um estado sem um campo nunca chega a existir', () => {
    // Sem a recusa, este estado avançava, a madeira virava `NaN` e o banco gravava `null`.
    const stored = JSON.parse(JSON.stringify(newGame())) as Draft;
    stored.settlement.workers.lumberMill = 3;
    delete stored.settlement.accumulators.wood;
    expect(() => migrateState(stored, { timeScale: 1 })).toThrow(
      new RegExp(
        `versão ${CURRENT_SCHEMA_VERSION}, mas não tem a forma dela \\(settlement\\.accumulators\\.wood: campo ausente\\)`,
      ),
    );
  });

  it('a mensagem de um estado atual fora da forma não cita o que o jogador escreveu', () => {
    const stored = JSON.parse(JSON.stringify(newGame())) as Draft;
    stored.settlement.name = 'Nome Que Não Vai Para o Log';
    stored.settings.vigilHourLocal = 'vinte';
    expect(() => migrateState(stored, { timeScale: 1 })).toThrow(
      /settings\.vigilHourLocal: esperado inteiro a partir de zero, veio texto/,
    );
    expect(() => migrateState(stored, { timeScale: 1 })).not.toThrow(/Nome Que/);
  });

  it('conhece as mesmas dificuldades que o conteúdo', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      const state = { ...newGame(), settings: { ...newGame().settings, difficulty } };
      expect(currentShape(state, '')).toBeNull();
    }
  });

  it('conhece os mesmos edifícios e recursos que o conteúdo', () => {
    const state = newGame();
    expect(Object.keys(state.settlement.buildings)).toEqual([...BUILDING_IDS]);
    expect(Object.keys(state.settlement.wasted)).toEqual([...RESOURCE_IDS]);
    // As filas do estado são as do conteúdo, abertas ou não.
    expect(state.settlement.constructionQueues).toHaveLength(balance.construction.queues);
    // Uma obra em cada fila e uma planejada de cada edifício do conteúdo cabem na forma.
    for (const building of BUILDING_IDS) {
      const busy = JSON.parse(JSON.stringify(state)) as Draft;
      const work = { building, targetLevel: 1, startedAtMs: 0, finishesAtMs: 1 };
      busy.settlement.constructionQueues = [work, work];
      busy.settlement.planned = [
        { building, targetLevel: 2, autoStart: true },
        { building, targetLevel: 3, autoStart: false },
      ];
      expect(currentShape(busy, ''), building).toBeNull();
    }
  });

  it('conhece os mesmos edifícios produtivos que o conteúdo, e recusa uma coorte vazia', () => {
    const state = newGame();
    expect(Object.keys(state.settlement.craftExperience)).toEqual([...PRODUCTION_BUILDING_IDS]);
    expect(Object.keys(state.settlement.craftMasteredYear)).toEqual([...PRODUCTION_BUILDING_IDS]);
    for (const building of PRODUCTION_BUILDING_IDS) {
      const adapting = JSON.parse(JSON.stringify(state)) as Draft;
      adapting.settlement.adaptation = [{ building, count: 2, untilMs: 7_200_000 }];
      expect(currentShape(adapting, ''), building).toBeNull();
    }
    const broken = (adaptation: unknown) => {
      const draft = JSON.parse(JSON.stringify(state)) as Draft;
      draft.settlement.adaptation = adaptation;
      return currentShape(draft, '');
    };
    expect(broken([{ building: 'farm', count: 0, untilMs: 1 }])).toMatch(
      /^settlement\.adaptation\.0\.count/,
    );
    expect(broken([{ building: 'housing', count: 1, untilMs: 1 }])).toMatch(
      /^settlement\.adaptation\.0\.building/,
    );
    expect(broken([{ building: 'farm', count: 1 }])).toMatch(/untilMs: campo ausente$/);
    expect(broken(null)).toMatch(/^settlement\.adaptation/);
  });
});

describe.each(fixtures)('$name', (fixture) => {
  it('declara a versão do nome do arquivo', () => {
    expect(read(fixture).schemaVersion).toBe(fixture.version);
  });

  it('migra para a versão atual sem alterar a entrada', () => {
    const input = read(fixture);
    const state = migrateState(input, { timeScale: fixture.timeScale });
    expect(input).toEqual(read(fixture));
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // Exatamente os campos de uma partida nova: nada sobra da versão antiga, nada falta.
    expect(fixedKeys(state, newGame()).sort()).toEqual(fixedKeys(newGame()).sort());
  });

  it('migrar duas vezes é migrar uma, e a mesma entrada dá sempre o mesmo estado', () => {
    const once = migrated(fixture);
    expect(migrateState(once, { timeScale: fixture.timeScale })).toBe(once);
    // O estado migrado, depois de passar pelo banco (JSON), continua sendo ele mesmo.
    const stored = JSON.parse(JSON.stringify(once)) as unknown;
    expect(migrateState(stored, { timeScale: 7 })).toEqual(once);
    expect(migrated(fixture)).toEqual(once);
  });

  it('a fronteira fica no instante em que a migração encontrou a partida', () => {
    const before = read(fixture) as unknown as GameState;
    const after = migrated(fixture);
    // Um retrato da versão atual não é migrado: a fronteira dele é a que estava gravada.
    expect(after.migratedAtMs).toBe(
      fixture.version < CURRENT_SCHEMA_VERSION ? before.lastProcessedAt : before.migratedAtMs,
    );
    // Nada do que a migração marcou está vencido: o próximo evento é depois da fronteira.
    expect(nextEventAt(after)).toBeGreaterThan(after.lastProcessedAt);
  });

  it('preserva tudo o que o jogador tem', () => {
    const before = read(fixture) as unknown as GameState;
    const after = migrated(fixture);
    expect(after.seed).toBe(before.seed);
    expect(after.clock).toEqual(before.clock);
    expect(after.lastProcessedAt).toBe(before.lastProcessedAt);
    expect(after.settlement.name).toBe(before.settlement.name);
    expect(after.settlement.resources).toMatchObject(before.settlement.resources);
    expect(after.settlement.accumulators).toMatchObject(before.settlement.accumulators);
    expect(after.settlement.population.villagers).toBe(before.settlement.population.villagers);
    expect(after.settlement.workers).toMatchObject(before.settlement.workers);
    expect(after.settlement.buildings).toMatchObject(before.settlement.buildings);
    expect(after.settlement.recruitmentQueue).toEqual(before.settlement.recruitmentQueue);
    expect(after.settlement.famine).toEqual(before.settlement.famine);
    expect(after.objectives).toEqual(before.objectives);
    expect(after.stats).toMatchObject(before.stats);
    expect(after.settings.settlementName).toBe(before.settings.settlementName);
    expect(after.settings.timezone).toBe(before.settings.timezone);
    expect(after.settings.vigilHourLocal).toBe(before.settings.vigilHourLocal);
  });

  it('avança 30 dias reais e aceita ordens', () => {
    let state = migrated(fixture);
    const { timeScale } = state.settings;
    const start = state.lastProcessedAt;

    const renamed = applyCommand(
      state,
      command('renameSettlement', { name: 'Vau do Corvo' }),
      start,
    );
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      state = renamed.state;
    }
    const idle = applyCommand(state, command('setWorkers', { building: 'farm', count: 0 }), start);
    expect(idle.ok).toBe(true);
    // Qualquer obra é aceita ou recusada com um motivo conhecido: nenhuma lança.
    for (const building of buildingIds) {
      const result = applyCommand(state, command('startConstruction', { building }), start);
      if (!result.ok) {
        expect(REJECTION_CODES).toContain(result.code);
        expect(result.message.trim()).not.toBe('');
      }
    }

    const end = start + Math.round(30 * DAY_REAL * timeScale);
    const advanced = advanceTo(state, end);
    expect(advanced.state.lastProcessedAt).toBe(end);
    expect(advanced.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(advanced.state.migratedAtMs).toBe(state.migratedAtMs);
    expect(currentShape(JSON.parse(JSON.stringify(advanced.state)), '')).toBeNull();
    expect(advanced.events.filter((event) => event.type === 'dayStarted').length).toBe(
      Math.floor(end / (2 * HOUR)) - Math.floor(start / (2 * HOUR)),
    );
    for (const amount of Object.values(advanced.state.settlement.resources)) {
      expect(Number.isSafeInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThanOrEqual(0);
    }

    const view = deriveViewState(advanced.state, end);
    expect(view.settlement.name).toBe('Vau do Corvo');
    // Depois de um mês, o senhor volta e manda todo mundo para a Fazenda.
    let later = advanced.state;
    for (const building of ['lumberMill', 'quarry', 'goldMine', 'farm'] as const) {
      const count = building === 'farm' ? later.settlement.population.villagers : 0;
      const result = applyCommand(later, command('setWorkers', { building, count }), end);
      expect(result.ok).toBe(true);
      if (result.ok) {
        later = result.state;
      }
    }
    expect(later.settlement.workers.farm).toBe(later.settlement.population.villagers);
  });

  it('a divisão de intervalo continua exata sobre o estado migrado', () => {
    const start = migrated(fixture);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 * DAY_REAL }),
        fc.integer({ min: 1, max: 20 * DAY_REAL }),
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
      { numRuns: 40 },
    );
  });
});

describe('versão 1 → 2', () => {
  const construction = named('state-v1-construction.json');
  // Só o primeiro passo: o que a fundação mudou, sem o que as versões seguintes acrescentaram.
  const foundation: MigrationChain = { steps: [v1ToV2], shape: stateV2 };

  it.each(fixtures.filter((fixture) => fixture.version === 1))(
    '$name: muda só o que a fundação exige',
    (fixture) => {
      const before = read(fixture) as unknown as GameState & {
        settings: { capsEnabled: boolean };
      };
      const after = migrateWith(
        read(fixture),
        { timeScale: fixture.timeScale },
        foundation,
      ) as unknown as GameState;
      expect(after.schemaVersion).toBe(2);
      expect(after.settings).toStrictEqual({
        settlementName: before.settings.settlementName,
        timezone: before.settings.timezone,
        vigilHourLocal: before.settings.vigilHourLocal,
        difficulty: 'lord',
        timeScale: fixture.timeScale,
      });
      expect(after.migratedAtMs).toBe(before.lastProcessedAt);
      // O resto é o estado antigo, campo por campo.
      const untouched = (state: object) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !['schemaVersion', 'settings', 'migratedAtMs'].includes(key),
          ),
        );
      expect(untouched(after)).toStrictEqual(untouched(before));
      expect(Object.keys(untouched(after)).length).toBe(Object.keys(before).length - 2);
    },
  );

  it('o ritmo vem da linha da partida e passa a valer na visão sem ninguém informar', () => {
    const slow = migrateState(read(construction), { timeScale: 1 });
    const fast = migrateState(read(construction), { timeScale: 3 });
    const half = migrateState(read(construction), { timeScale: 0.5 });
    expect(fast.settings.timeScale).toBe(3);
    expect(half.settings.timeScale).toBe(0.5);

    // A obra do retrato acaba aos 240.000 ms de jogo; o estado está em 127.321 ms.
    const remaining = (state: GameState) =>
      deriveViewState(state, state.lastProcessedAt).constructions.active?.secondsRemaining;
    expect(remaining(slow)).toBe(113);
    expect(remaining(fast)).toBe(38);
    expect(remaining(half)).toBe(226);
    // E quem pede outro ritmo explicitamente continua sendo atendido.
    expect(
      deriveViewState(fast, fast.lastProcessedAt, { timeScale: 1 }).constructions.active
        ?.secondsRemaining,
    ).toBe(113);
  });

  it('a fronteira é o instante até onde as regras antigas valeram, não o da leitura', () => {
    const state = migrateState(read(construction), { timeScale: 3 });
    expect(state.migratedAtMs).toBe(127_321);
    const later = advanceTo(state, 5 * HOUR).state;
    expect(later.migratedAtMs).toBe(127_321);
  });

  it.each([
    ['um ritmo zero', 0],
    ['um ritmo negativo', -1],
    ['um ritmo infinito', Number.POSITIVE_INFINITY],
    ['um ritmo que não é número', Number.NaN],
  ])('recusa %s', (_, timeScale) => {
    expect(() => migrateState(read(construction), { timeScale })).toThrow(/Ritmo inválido/);
  });
});

describe('versão 2 → 3', () => {
  const version2 = fixtures.filter((fixture) => fixture.version === 2);
  const WINTER_DAY_4 = (72 + 3) * 2 * HOUR;
  // Só até a versão 3: o que as estações mudaram, sem o que as versões seguintes acrescentaram.
  const seasons: MigrationChain = { steps: [v1ToV2, v2ToV3], shape: stateV3 };

  /**
   * Um estado como a versão 2 o gravava, parado no 4º dia do inverno, em cima de uma virada de
   * dia: todos na Fazenda, comida de sobra, objetivos cumpridos e `wood` de madeira.
   */
  function version2InWinter(wood: number): Draft {
    const old = JSON.parse(JSON.stringify(gameAt(WINTER_DAY_4))) as Draft;
    old.schemaVersion = 2;
    delete old.settlement.cold;
    delete old.settlement.wasted;
    delete old.settlement.craftExperience;
    delete old.settlement.craftMasteredYear;
    delete old.settlement.adaptation;
    delete old.settlement.buildings.granary;
    delete old.settlement.buildings.warehouse;
    old.settlement.workers.farm = 5;
    old.settlement.resources.food = 500_000;
    old.settlement.resources.wood = wood;
    return old;
  }

  it.each(version2)('$name: só acrescenta o frio, fechado', (fixture) => {
    const before = read(fixture) as unknown as GameState;
    const after = migrateWith(
      read(fixture),
      { timeScale: fixture.timeScale },
      seasons,
    ) as unknown as GameState;
    expect(after.schemaVersion).toBe(3);
    expect(after.settlement.cold).toBeNull();
    // O resto é o estado antigo, campo por campo: estoque, restos de produção, prazos de obra
    // e de recrutamento, fome. A fronteira passa a ser a deste passo.
    expect(after.settlement).toStrictEqual({ ...before.settlement, cold: null });
    expect({ ...after, schemaVersion: 2, settlement: before.settlement }).toStrictEqual({
      ...before,
      migratedAtMs: before.lastProcessedAt,
    });
  });

  it('nenhum prazo muda: a obra e o recruta em curso chegam na hora marcada', () => {
    // O retrato tem uma obra que acaba aos 240.000 ms e dois aldeões a caminho, ordenados na
    // primavera com o prazo de tabela (20 min), antes de a estação mexer em prazos.
    const fixture = named('state-v2-construction.json');
    const before = read(fixture) as unknown as GameState;
    const after = migrated(fixture);
    expect(after.settlement.constructionQueues[0]).toEqual(before.settlement.constructionQueues[0]);
    expect(after.settlement.recruitmentQueue).toEqual([
      { finishesAtMs: 1_200_000 },
      { finishesAtMs: 2_400_000 },
    ]);
    const { events } = advanceTo(after, HOUR);
    expect(
      events.filter((event) => event.type === 'recruitmentFinished').map((event) => event.atMs),
    ).toEqual([1_200_000, 2_400_000]);
    expect(
      events.filter((event) => event.type === 'constructionFinished').map((event) => event.atMs),
    ).toEqual([240_000]);
  });

  it('as taxas passam a levar a estação a partir da fronteira, sem recalcular o que passou', () => {
    const fixture = named('state-v2-construction.json');
    const before = read(fixture) as unknown as GameState;
    const after = migrated(fixture);
    // O estoque na fronteira é o que as regras antigas deixaram.
    expect(after.settlement.resources).toEqual(before.settlement.resources);
    expect(after.settlement.accumulators).toEqual(before.settlement.accumulators);
    // Dali em diante, primavera: os 2 fazendeiros rendem 24 por hora, e não 20.
    const view = deriveViewState(after, after.lastProcessedAt);
    expect(view.workers.find((row) => row.building === 'farm')?.grossPerHour).toBe(24);
  });

  it('partida encontrada no inverno e sem madeira: o frio abre na fronteira, com a linha na Crônica', () => {
    // Uma partida da versão 2 parada no 4º dia do inverno, em cima de uma virada de dia, sem
    // madeira e sem lenhadores. Nas regras antigas ninguém passava frio.
    const old = version2InWinter(0);

    const state = migrateState(old, { timeScale: 3 });
    expect(state.settlement.cold).toBeNull();
    expect(state.migratedAtMs).toBe(WINTER_DAY_4);

    // O primeiro avanço acomoda o estado no instante da fronteira: o frio começa ali, e a
    // virada de dia daquele instante, que as regras antigas já tinham registrado, não se repete.
    const { state: after, events } = advanceTo(state, WINTER_DAY_4 + 1);
    expect(events.map((event) => [event.type, event.atMs])).toEqual([
      ['coldStarted', WINTER_DAY_4],
    ]);
    expect(after.settlement.cold).toEqual({ sinceMs: WINTER_DAY_4 });
    // E a divisão de intervalo continua exata a partir dali.
    const direct = advanceTo(state, WINTER_DAY_4 + 30 * HOUR);
    const first = advanceTo(state, WINTER_DAY_4 + 7 * HOUR + 13);
    const second = advanceTo(first.state, WINTER_DAY_4 + 30 * HOUR);
    expect(second.state).toStrictEqual(direct.state);
    expect([...first.events, ...second.events]).toStrictEqual(direct.events);
  });

  it('partida encontrada no inverno com madeira: nada acontece na fronteira', () => {
    const old = version2InWinter(100_000);
    const state = migrateState(old, { timeScale: 1 });
    expect(advanceTo(state, WINTER_DAY_4 + 1).events).toEqual([]);
  });
});

describe('versão 3 → 4', () => {
  const version3 = fixtures.filter((fixture) => fixture.version === 3);
  const milli = (state: GameState, resource: 'food' | 'wood' | 'stone') =>
    state.settlement.resources[resource];
  // Só até a versão 4: o que o armazenamento mudou, sem o que as versões seguintes acrescentaram.
  const storage: MigrationChain = { steps: [v1ToV2, v2ToV3, v3ToV4], shape: stateV4 };

  it.each(version3)(
    '$name: só acrescenta o Celeiro e o Armazém no nível 0 e o desperdício zerado',
    (fixture) => {
      const before = read(fixture) as unknown as GameState;
      const after = migrateWith(
        read(fixture),
        { timeScale: fixture.timeScale },
        storage,
      ) as unknown as GameState;
      expect(after.schemaVersion).toBe(4);
      expect(after.settlement.buildings).toStrictEqual({
        ...before.settlement.buildings,
        granary: 0,
        warehouse: 0,
      });
      expect(after.settlement.wasted).toStrictEqual({ food: 0, wood: 0, stone: 0, gold: 0 });
      // O resto é o estado antigo, campo por campo: estoque (mesmo acima do limite), restos de
      // produção, obras, planejadas, fome, frio, objetivos e contadores.
      expect(after.settlement).toStrictEqual({
        ...before.settlement,
        buildings: after.settlement.buildings,
        wasted: after.settlement.wasted,
      });
      expect({ ...after, schemaVersion: 3, settlement: before.settlement }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
      expect(Object.keys(after.stats).filter((key) => key.startsWith('wasted_'))).toEqual([]);
    },
  );

  it.each(version3)(
    '$name: nada acontece na fronteira, nem "encheu" de estoque herdado',
    (fixture) => {
      const state = migrated(fixture);
      const { events } = advanceTo(state, state.lastProcessedAt + 1);
      expect(events.filter((event) => event.type.startsWith('storage'))).toEqual([]);
    },
  );

  it('estoque acima do limite fica, não recebe produção e pode ser gasto (ADR 0013, decisão 4)', () => {
    // O feudo que veio da v0.1 pelo ritmo 3: dezenas de milhares de madeira e de pedra.
    const fixture = named('state-v3-migrated-3x.json');
    const before = read(fixture) as unknown as GameState;
    const state = migrated(fixture);
    expect(state.settlement.resources).toEqual(before.settlement.resources);
    expect(milli(state, 'wood')).toBeGreaterThan(10_000_000);
    expect(milli(state, 'stone')).toBeGreaterThan(5_000_000);

    const view = deriveViewState(state, state.lastProcessedAt);
    const wood = view.resources.find((row) => row.id === 'wood');
    expect(wood).toMatchObject({ cap: 500, full: true, fullInSeconds: null });
    expect(wood?.stock).toBe(Math.floor(milli(state, 'wood') / 1000));
    expect(wood?.fullNote).toMatch(/^Pátio cheio: .*Construa o Armazém ou gaste madeira\.$/);

    // Um dia de jogo depois: o estoque não cresceu, e o que a Serraria fez foi ao chão.
    const day = 2 * HOUR;
    const later = advanceTo(state, state.lastProcessedAt + day);
    expect(milli(later.state, 'wood')).toBeLessThanOrEqual(milli(state, 'wood'));
    expect(milli(later.state, 'stone')).toBeLessThanOrEqual(milli(state, 'stone'));
    expect(later.state.stats.wasted_wood).toBeGreaterThan(0);
    expect(later.events.filter((event) => event.type === 'storageFilled')).toEqual([]);
    expect(later.events.filter((event) => event.type === 'storageWasted').length).toBe(1);

    // E o que já estava lá paga o Armazém, que nenhum limite de 500 deixaria juntar depois.
    const free = advanceTo(state, state.settlement.constructionQueues[0]?.finishesAtMs ?? 0).state;
    const built = applyCommand(
      free,
      command('startConstruction', { building: 'warehouse' }),
      free.lastProcessedAt,
    );
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(milli(built.state, 'wood')).toBe(milli(free, 'wood') - 160_000);
    }
  });

  it('quem já concluiu o objetivo 4 não ganha nem perde nada, e pode construir', () => {
    const fixture = named('state-v3-objectives.json');
    const before = read(fixture) as unknown as GameState;
    const state = migrated(fixture);
    expect(state.objectives).toEqual(before.objectives);
    expect(state.objectives.completed).toContain('townHallLevel2');
    // O ouro é o que a v0.1 deixou, com os +50 da recompensa antiga.
    expect(state.settlement.resources.gold).toBe(before.settlement.resources.gold);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.objectives.find((entry) => entry.id === 'townHallLevel2')).toMatchObject({
      status: 'completed',
      reward: 'desbloqueia o Celeiro e o Armazém',
    });
    const storage = view.constructions.available.filter((entry) => entry.fromLevel === 0);
    expect(storage.map((entry) => entry.building)).toEqual(['granary', 'warehouse']);
    for (const entry of storage) {
      expect(entry.blockedCode).not.toBe('GATE_LOCKED');
    }
    // Nenhuma linha de objetivo se repete depois da migração.
    const { events } = advanceTo(state, state.lastProcessedAt + 30 * DAY_REAL);
    expect(events.filter((event) => event.type === 'objectiveCompleted')).toEqual([]);
  });

  it('quem ainda não concluiu o objetivo 4 conclui pela regra nova: sem ouro, com o desbloqueio', () => {
    const state = migrated(named('state-v3-fresh.json'));
    expect(state.objectives.completed).toEqual([]);
    const ahead = { ...state, settlement: { ...state.settlement } };
    ahead.settlement.buildings = { ...state.settlement.buildings, townHall: 2 };
    const result = applyCommand(
      ahead,
      command('setWorkers', { building: 'farm', count: 2 }),
      ahead.lastProcessedAt,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.objectives.completed).toEqual(['allocateFarmers', 'townHallLevel2']);
      // Só os +20 do primeiro objetivo.
      expect(result.state.settlement.resources.gold).toBe(state.settlement.resources.gold + 20_000);
    }
  });

  it('partida no frio ou na fome continua no frio ou na fome, com o estoque que tinha', () => {
    for (const name of ['state-v3-cold.json', 'state-v3-famine.json']) {
      const before = read(named(name)) as unknown as GameState;
      const after = migrated(named(name));
      expect(after.settlement.cold, name).toEqual(before.settlement.cold);
      expect(after.settlement.famine, name).toEqual(before.settlement.famine);
      expect(after.settlement.recruitmentQueue, name).toEqual(before.settlement.recruitmentQueue);
    }
  });
});

describe('versão 4 → 5', () => {
  const version4 = fixtures.filter((fixture) => fixture.version === 4);
  const autoStarts = (events: Array<{ type: string }>) =>
    events.filter((event) => event.type === 'constructionAutoStarted');
  // Só até a versão 5: o que as filas mudaram, sem o que as versões seguintes acrescentaram.
  const queues: MigrationChain = { steps: [v1ToV2, v2ToV3, v3ToV4, v4ToV5], shape: stateV5 };

  it.each(version4)(
    '$name: só acrescenta a segunda fila, vazia, e marca as planejadas como manuais',
    (fixture) => {
      const before = read(fixture) as unknown as GameState;
      const after = migrateWith(
        read(fixture),
        { timeScale: fixture.timeScale },
        queues,
      ) as unknown as GameState;
      expect(after.schemaVersion).toBe(5);
      // A obra em curso continua onde estava, e a segunda fila nasce livre.
      expect(before.settlement.constructionQueues).toHaveLength(1);
      expect(after.settlement.constructionQueues).toStrictEqual([
        ...before.settlement.constructionQueues,
        null,
      ]);
      // As planejadas ficam na mesma ordem, com o mesmo nível, todas manuais (ADR 0013, decisão 4).
      expect(after.settlement.planned).toStrictEqual(
        before.settlement.planned.map((plan) => ({ ...plan, autoStart: false })),
      );
      // O resto é o estado antigo, campo por campo.
      expect(after.settlement).toStrictEqual({
        ...before.settlement,
        constructionQueues: after.settlement.constructionQueues,
        planned: after.settlement.planned,
      });
      expect({ ...after, schemaVersion: 4, settlement: before.settlement }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version4)(
    '$name: nenhuma obra começa sozinha por causa da migração, nem na fronteira nem depois',
    (fixture) => {
      const state = migrated(fixture);
      expect(autoStarts(advanceTo(state, state.lastProcessedAt + 1).events)).toEqual([]);
      const month = advanceTo(state, state.lastProcessedAt + 30 * DAY_REAL);
      expect(autoStarts(month.events)).toEqual([]);
      // As planejadas continuam na lista, esperando a ordem.
      expect(month.state.settlement.planned).toEqual(state.settlement.planned);
    },
  );

  it('quem já tinha o Salão no nível 4 ganha a segunda fila na fronteira, e a usa quando quiser', () => {
    // O feudo que veio da v0.1: Salão 4, a Serraria em obra, a Fazenda planejada e estoque de sobra.
    const state = migrated(named('state-v4-migrated-3x.json'));
    expect(state.settlement.buildings.townHall).toBe(4);
    expect(state.settlement.constructionQueues.map((slot) => slot?.building ?? null)).toEqual([
      'lumberMill',
      null,
    ]);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.constructions.queuesUnlocked).toBe(2);
    expect(view.constructions.queues.map((entry) => entry?.building ?? null)).toEqual([
      'lumberMill',
      null,
    ]);
    expect(view.constructions.queuesNote).toBeNull();
    // A planejada antiga é manual e já pode começar: não espera nada, só a ordem.
    expect(view.constructions.planned).toMatchObject([
      { building: 'farm', targetLevel: 5, autoStart: false, waiting: null },
    ]);

    // A ordem do jogador põe a Fazenda na segunda fila, com a Serraria ainda em obra.
    const started = applyCommand(
      state,
      command('startConstruction', { building: 'farm' }),
      state.lastProcessedAt,
    );
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(
        started.state.settlement.constructionQueues.map((slot) => slot?.building ?? null),
      ).toEqual(['lumberMill', 'farm']);
      expect(started.events.map((event) => event.type)).toEqual(['constructionStarted']);
    }
  });

  it('marcar a planejada antiga como automática é uma ordem do jogador, e vale na hora', () => {
    const state = migrated(named('state-v4-migrated-3x.json'));
    const marked = applyCommand(
      state,
      command('setAutoStart', { building: 'farm', autoStart: true }),
      state.lastProcessedAt,
    );
    expect(marked.ok).toBe(true);
    if (marked.ok) {
      // Havia recurso e fila: a obra começa no instante da ordem, e sai da lista.
      expect(marked.events.map((event) => event.type)).toEqual(['constructionAutoStarted']);
      expect(marked.state.settlement.planned).toEqual([]);
      expect(marked.state.settlement.constructionQueues[1]?.building).toBe('farm');
    }
  });

  it('com o Salão abaixo do nível 4 a segunda fila existe no estado, fechada', () => {
    const state = migrated(named('state-v4-construction.json'));
    expect(state.settlement.constructionQueues).toHaveLength(2);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.constructions.queuesUnlocked).toBe(1);
    expect(view.constructions.queues).toHaveLength(1);
    expect(view.constructions.queuesNote).toBe('A segunda fila abre com o Salão do Senhor Nv4.');
    const refused = applyCommand(
      state,
      command('startConstruction', { building: 'farm' }),
      state.lastProcessedAt,
    );
    expect(refused).toMatchObject({ ok: false, code: 'QUEUE_LOCKED' });
    // A obra em curso termina na hora marcada, como antes.
    const { events } = advanceTo(state, 4 * MINUTE);
    expect(
      events.filter((event) => event.type === 'constructionFinished').map((event) => event.atMs),
    ).toEqual([4 * MINUTE]);
  });
});

describe('versão 5 → 6', () => {
  const version5 = fixtures.filter((fixture) => fixture.version === 5);
  const NOBODY = { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 };

  it.each(version5)(
    '$name: só acrescenta a experiência em zero e a lista de adaptação vazia',
    (fixture) => {
      const before = read(fixture) as unknown as GameState;
      const after = migrated(fixture);
      expect(after.schemaVersion).toBe(6);
      expect(after.settlement.craftExperience).toStrictEqual(NOBODY);
      expect(after.settlement.craftMasteredYear).toStrictEqual(NOBODY);
      // Todo mundo que já trabalha é adaptado (ADR 0013, decisão 4).
      expect(after.settlement.adaptation).toStrictEqual([]);
      // O resto é o estado antigo, campo por campo: ninguém sai do lugar.
      expect(after.settlement).toStrictEqual({
        ...before.settlement,
        craftExperience: NOBODY,
        craftMasteredYear: NOBODY,
        adaptation: [],
      });
      expect({ ...after, schemaVersion: 5, settlement: before.settlement }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version5)(
    '$name: ninguém passa a render metade, e nada acontece na fronteira',
    (fixture) => {
      const state = migrated(fixture);
      const view = deriveViewState(state, state.lastProcessedAt);
      for (const row of view.workers) {
        expect(row).toMatchObject({ adapting: 0, adaptationEndsInSeconds: null, experience: 0 });
        // A taxa na fronteira é a de antes: trabalhadores inteiros, sem mestria.
        expect(row.grossPerHour).toBeCloseTo(row.assigned * row.perWorkerPerHour, 9);
        expect(row.breakdown).not.toContain('adaptação');
        expect(row.breakdown).not.toContain('mestria');
      }
      const { events } = advanceTo(state, state.lastProcessedAt + 1);
      expect(events.filter((event) => event.type === 'craftMastered')).toEqual([]);
    },
  );

  it('a experiência começa a contar na primeira virada de dia depois da fronteira', () => {
    // O feudo que veio da v0.1, com gente em todos os ofícios e parado no meio de um dia.
    const state = migrated(named('state-v5-migrated-3x.json'));
    const dayMs = 2 * HOUR;
    const nextDay = (Math.floor(state.lastProcessedAt / dayMs) + 1) * dayMs;
    const before = advanceTo(state, nextDay - 1).state;
    expect(before.settlement.craftExperience).toStrictEqual(NOBODY);
    const after = advanceTo(state, nextDay).state;
    // Ganha 4 quem tem ao menos um trabalhador por nível; os outros ficam onde estão.
    for (const building of ['farm', 'lumberMill', 'quarry', 'goldMine'] as const) {
      const occupied = state.settlement.workers[building] >= state.settlement.buildings[building];
      expect(after.settlement.craftExperience[building], building).toBe(occupied ? 4 : 0);
    }
    expect(Object.values(after.settlement.craftExperience).some((value) => value > 0)).toBe(true);
  });

  it('as trocas feitas depois da fronteira custam como em qualquer partida', () => {
    const state = migrated(named('state-v5-migrated-3x.json'));
    const { villagers } = state.settlement.population;
    const free =
      villagers - Object.values(state.settlement.workers).reduce((sum, count) => sum + count, 0);
    expect(free).toBeGreaterThan(0);
    const moved = applyCommand(
      state,
      command('setWorkers', { building: 'quarry', count: state.settlement.workers.quarry + 1 }),
      state.lastProcessedAt,
    );
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      expect(moved.state.settlement.adaptation).toEqual([
        { building: 'quarry', count: 1, untilMs: state.lastProcessedAt + 2 * HOUR },
      ]);
      // No ritmo 3, o dia de jogo da adaptação são 40 minutos reais.
      const view = deriveViewState(moved.state, state.lastProcessedAt);
      expect(view.workers.find((row) => row.building === 'quarry')).toMatchObject({
        adapting: 1,
        adaptationEndsInSeconds: 40 * 60,
      });
    }
  });
});

describe('a fronteira é de cada passo', () => {
  // A v0.2 chega à produção em mais de uma publicação, e cada uma migra as partidas em um
  // instante diferente. Este passo ainda não existe: é o próximo que alguém vai escrever, com a
  // conta que o roadmap pede para a primeira carta do Conselho (V2D-T1.2): o primeiro prazo de
  // uma mecânica nova conta a partir da fronteira **deste** passo.
  const NEXT = CURRENT_SCHEMA_VERSION + 1;
  const INTERVAL = 8 * HOUR;
  const nextShape: Shape = (value, path) => {
    const { syntheticDeadlineMs, schemaVersion, ...rest } = value as Draft;
    if (schemaVersion !== NEXT) {
      return 'schemaVersion: esperada a versão do passo sintético';
    }
    return (
      natural(syntheticDeadlineMs, 'syntheticDeadlineMs') ??
      currentShape({ ...rest, schemaVersion: CURRENT_SCHEMA_VERSION }, path)
    );
  };
  const seen: Array<{ boundaryMs: number; timeScale: number }> = [];
  const chain: MigrationChain = {
    steps: [
      ...migrationSteps,
      {
        from: CURRENT_SCHEMA_VERSION,
        summary: 'passo sintético de teste: uma mecânica com prazo',
        shape: currentShape,
        migrate: (state, context) => {
          seen.push({ ...context });
          return {
            ...state,
            schemaVersion: NEXT,
            syntheticDeadlineMs: context.boundaryMs + INTERVAL,
          };
        },
      },
    ],
    shape: nextShape,
  };
  const throughBank = (state: GameState) => JSON.parse(JSON.stringify(state)) as Draft;
  const YEAR_3 = 400 * HOUR;

  it('partida que nasceu na versão atual, sem fronteira: o prazo novo conta de onde ela está', () => {
    const born = throughBank(advanceTo(newGame(), YEAR_3).state);
    expect(born.clock.year).toBe(3);
    expect(born.migratedAtMs).toBeNull();

    const after = migrateWith(born, { timeScale: 1 }, chain);
    expect(after.schemaVersion).toBe(NEXT);
    expect(after.lastProcessedAt).toBe(YEAR_3);
    expect(after.migratedAtMs).toBe(YEAR_3);
    expect(after.syntheticDeadlineMs).toBe(YEAR_3 + INTERVAL);
    expect(born.migratedAtMs).toBeNull();
  });

  it('partida migrada há muito tempo: a fronteira antiga não vale para a mecânica nova', () => {
    const old = migrateState(read(named('state-v1-construction.json')), { timeScale: 3 });
    const played = throughBank(advanceTo(old, YEAR_3).state);
    expect(played.migratedAtMs).toBe(127_321);

    const after = migrateWith(played, { timeScale: 3 }, chain);
    // Com a fronteira antiga, o prazo cairia no passado e a ausência inteira seria recalculada
    // com uma regra que não existia.
    expect(after.migratedAtMs).toBe(YEAR_3);
    expect(after.syntheticDeadlineMs).toBe(YEAR_3 + INTERVAL);
    expect(after.syntheticDeadlineMs).toBeGreaterThan(after.lastProcessedAt as number);
  });

  it('partida que atravessa dois passos de uma vez: os dois veem o mesmo instante', () => {
    seen.length = 0;
    const before = read(named('state-v1-week-bot-3x.json'));
    const after = migrateWith(before, { timeScale: 3 }, chain);
    expect(after.migratedAtMs).toBe(before.lastProcessedAt);
    expect(after.syntheticDeadlineMs).toBe((before.lastProcessedAt as number) + INTERVAL);
    expect(seen).toEqual([{ boundaryMs: before.lastProcessedAt, timeScale: 3 }]);
  });

  it('um passo que esquece a fronteira não a deixa para trás', () => {
    const forgetful: MigrationChain = {
      steps: [
        ...migrationSteps,
        {
          from: CURRENT_SCHEMA_VERSION,
          summary: 'passo sintético de teste: só troca o número da versão',
          shape: currentShape,
          migrate: (state) => ({ ...state, schemaVersion: NEXT, syntheticDeadlineMs: 0 }),
        },
      ],
      shape: nextShape,
    };
    const born = throughBank(advanceTo(newGame(), YEAR_3).state);
    expect(migrateWith(born, { timeScale: 1 }, forgetful).migratedAtMs).toBe(YEAR_3);
  });

  it('a cadeia do jogo é a que `migrateState` usa', () => {
    const real: MigrationChain = { steps: migrationSteps, shape: currentShape };
    for (const fixture of fixtures) {
      expect(migrateWith(read(fixture), { timeScale: fixture.timeScale }, real)).toEqual(
        migrated(fixture),
      );
    }
  });
});

describe('estados que o motor não aceita', () => {
  const valid = () => read(named('state-v1-objectives.json'));
  const failure = (stored: unknown): StateMigrationError => {
    try {
      migrateState(stored, { timeScale: 1 });
    } catch (error) {
      if (error instanceof StateMigrationError) {
        return error;
      }
      throw error;
    }
    throw new Error('A migração aceitou um estado que devia recusar.');
  };

  it('versão mais nova que a do motor: recusa sem tocar no estado', () => {
    const future = { ...newGame(), schemaVersion: CURRENT_SCHEMA_VERSION + 1, novidade: true };
    const copy = JSON.parse(JSON.stringify(future)) as unknown;
    const error = failure(future);
    expect(error.reason).toBe('future');
    expect(error.message).toContain(`versão ${CURRENT_SCHEMA_VERSION + 1}`);
    expect(future).toEqual(copy);
  });

  it.each([
    ['null', null],
    ['uma lista', []],
    ['um texto', 'estado'],
    ['um objeto vazio', {}],
    ['versão em texto', { schemaVersion: '1' }],
    ['versão zero', { schemaVersion: 0 }],
    ['versão fracionária', { schemaVersion: 1.5 }],
  ])('%s: não dá para saber a versão', (_, stored) => {
    expect(failure(stored).reason).toBe('invalid');
  });

  it.each<[string, (state: Draft) => void, string]>([
    [
      'campo ausente',
      (state) => delete state.settlement.famine,
      'settlement.famine: campo ausente',
    ],
    [
      'campo a mais',
      (state) => {
        state.settlement.morale = 50;
      },
      'settlement.morale: campo desconhecido',
    ],
    [
      'estoque fracionário',
      (state) => {
        state.settlement.resources.food = 10.5;
      },
      'settlement.resources.food: esperado inteiro a partir de zero, veio número não inteiro',
    ],
    [
      'estoque negativo',
      (state) => {
        state.settlement.resources.wood = -1;
      },
      'settlement.resources.wood: esperado inteiro a partir de zero',
    ],
    [
      'edifício que a versão 1 não tinha',
      (state) => {
        state.settlement.buildings.granary = 1;
      },
      'settlement.buildings.granary: campo desconhecido',
    ],
    [
      'obra de um edifício desconhecido',
      (state) => {
        state.settlement.constructionQueues[0] = {
          building: 'castle',
          targetLevel: 2,
          startedAtMs: 0,
          finishesAtMs: 1,
        };
      },
      'settlement.constructionQueues.0.building: esperado um de',
    ],
    [
      'limite de estoque ligado, que a v0.1 nunca teve',
      (state) => {
        state.settings.capsEnabled = true;
      },
      'settings.capsEnabled: esperado o valor fixo false',
    ],
    [
      'estado da versão 2 com o número da versão 1',
      (state) => {
        state.migratedAtMs = 0;
      },
      'migratedAtMs: campo desconhecido',
    ],
    [
      'fila de recrutamento que não é lista',
      (state) => {
        state.settlement.recruitmentQueue = {};
      },
      'settlement.recruitmentQueue: esperado lista, veio objeto',
    ],
  ])('versão 1 com %s', (_, damage, expected) => {
    const state = valid();
    damage(state as Draft);
    const copy = JSON.parse(JSON.stringify(state)) as unknown;
    const error = failure(state);
    expect(error.reason).toBe('invalid');
    expect(error.message).toContain(expected);
    // A entrada fica como estava: quem chamou não tem nada novo para gravar.
    expect(state).toEqual(copy);
  });

  it('a mensagem cita o caminho, nunca o que o jogador escreveu', () => {
    const state = valid() as Draft;
    state.settlement.name = 12;
    state.settings.settlementName = 'Nome Que Não Vai Para o Log';
    state.seed = 'semente-secreta';
    const { message } = failure(state);
    expect(message).toContain('settlement.name: esperado texto, veio inteiro');
    expect(message).not.toContain('Nome Que Não Vai Para o Log');
    expect(message).not.toContain('semente-secreta');
  });
});
