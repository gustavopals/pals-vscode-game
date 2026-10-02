import { DIFFICULTY_IDS } from '@lotg/content';
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
import { command, HOUR, newGame, runWeekScenario } from './test-helpers';
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
    // O ritmo da versão 1 não estava no estado: vinha da linha da partida. O bot jogou no 3.
    return { name, version, timeScale: name.includes('-3x') ? 3 : 1, text };
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

  it.each([
    ['um campo que o motor não escreve', (state: Draft) => (state.settlement.morale = 50)],
    ['a chave de limite da versão 1', (state: Draft) => (state.settings.capsEnabled = false)],
    ['uma dificuldade desconhecida', (state: Draft) => (state.settings.difficulty = 'normal')],
    ['um ritmo zero', (state: Draft) => (state.settings.timeScale = 0)],
    ['a fronteira ausente', (state: Draft) => delete state.migratedAtMs],
    ['o número da versão anterior', (state: Draft) => (state.schemaVersion = 1)],
  ])('recusa %s', (_, damage) => {
    const state = JSON.parse(JSON.stringify(newGame())) as Draft;
    damage(state);
    expect(currentShape(state, '')).not.toBeNull();
  });

  it('conhece as mesmas dificuldades que o conteúdo', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      const state = { ...newGame(), settings: { ...newGame().settings, difficulty } };
      expect(currentShape(state, '')).toBeNull();
    }
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

  it.each(fixtures.filter((fixture) => fixture.version === 1))(
    '$name: muda só o que a fundação exige',
    (fixture) => {
      const before = read(fixture) as unknown as GameState & {
        settings: { capsEnabled: boolean };
      };
      const after = migrateState(read(fixture), { timeScale: fixture.timeScale });
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
