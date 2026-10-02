import { createHash } from 'node:crypto';

import {
  balance,
  buildings,
  chronicleTemplates,
  foundingTemplates,
  objectives,
} from '@lotg/content';
import {
  applyCommand,
  type Command,
  createInitialState,
  CURRENT_SCHEMA_VERSION,
  deriveViewState,
  ENGINE_VERSION,
  type GameState,
} from '@lotg/engine';
import { canonicalJson } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { IDENTITY, identityLine } from './identity';
import {
  formatSummary,
  MECHANIC_COLUMN_NAMES,
  refusedByCode,
  RESERVED_COLUMNS,
  summarize,
  toCsv,
} from './report';
import { idleQueue, simulate } from './simulate';

const twoSessions = await simulate({
  seed: 'pedra-alta-golden',
  days: 7,
  strategy: 'economico',
  sessionsPerDay: 2,
});

const HEADER =
  'hour,real_day,year,season,day_of_season,food,wood,stone,gold,' +
  'food_per_hour,wood_per_hour,stone_per_hour,gold_per_hour,' +
  'villagers,capacity,free,in_training,' +
  'townHall,farm,lumberMill,quarry,goldMine,housing,granary,warehouse,famine,' +
  'queue_idle,planned_idle,commands_accepted,commands_refused,refused_by_code,' +
  'wasted_food,wasted_wood,wasted_stone,cold,morale,cards_seen,cards_answered,cards_expired,wolf_losses';

describe('simulação', () => {
  it('produz uma linha por hora: 168 em 7 dias, e o ano vira no fim', () => {
    expect(twoSessions.rows).toHaveLength(168);
    expect(twoSessions.rows.map((row) => row.hour)).toEqual(
      Array.from({ length: 168 }, (_, index) => index + 1),
    );
    expect(twoSessions.rows[0]).toMatchObject({ realDay: 1, season: 'spring', year: 1 });
    expect(twoSessions.rows[167]).toMatchObject({ realDay: 7, season: 'spring', year: 2 });
    expect(twoSessions.finalState.lastProcessedAt).toBe(168 * 3_600_000);
  });

  it('a mesma semente produz CSVs idênticos', async () => {
    const again = await simulate(twoSessions.options);
    expect(toCsv(again.rows)).toBe(toCsv(twoSessions.rows));
    expect(again.finalState).toStrictEqual(twoSessions.finalState);
  });

  it('com `hours`, dura horas reais que não fecham em dias: um ano de jogo no ritmo 3 são 56 h', async () => {
    const year = await simulate({ ...twoSessions.options, days: 3, hours: 56, timeScale: 3 });
    expect(year.rows).toHaveLength(56);
    expect(year.finalState.lastProcessedAt).toBe(168 * 3_600_000);
    expect(year.rows[54]).toMatchObject({ realDay: 3, year: 1, season: 'winter' });
    expect(year.rows[55]).toMatchObject({ realDay: 3, year: 2, season: 'spring', dayOfSeason: 1 });
    // Sessões a cada 12 h reais: 0, 12, 24, 36 e 48.
    expect(new Set(year.rows.map((row) => row.commandsAccepted)).size).toBe(5);
    expect(formatSummary(year)).toContain('· 56 horas reais · 2 sessões/dia · ritmo 3×\n');
  });

  it.each([0, -24, 1.5, NaN])('recusa uma duração de %d horas', async (hours) => {
    await expect(simulate({ ...twoSessions.options, hours })).rejects.toThrow(/Duração inválida/);
  });
});

describe('CSV de uma partida', () => {
  it('tem cabeçalho e 168 linhas de dados, todas com as mesmas colunas', () => {
    const lines = toCsv(twoSessions.rows).trimEnd().split('\n');
    expect(lines).toHaveLength(169);
    expect(lines[0]).toBe(HEADER);
    const columns = lines[0]?.split(',').length;
    expect(lines.every((line) => line.split(',').length === columns)).toBe(true);
  });

  it('as colunas das mecânicas fecham o cabeçalho; as que ninguém mede ainda saem vazias', () => {
    expect(HEADER.endsWith(MECHANIC_COLUMN_NAMES.join(','))).toBe(true);
    const reserved: string[] = RESERVED_COLUMNS.map((column) => column.name);
    expect(MECHANIC_COLUMN_NAMES.filter((name) => !reserved.includes(name))).toEqual([
      'wasted_food',
      'wasted_wood',
      'wasted_stone',
      'cold',
    ]);
    expect(new Set(RESERVED_COLUMNS.map((column) => column.task))).toEqual(
      new Set(['V2C-T4', 'V2D-T1', 'V2E-T3']),
    );
    const header = HEADER.split(',');
    const lines = toCsv(twoSessions.rows).trimEnd().split('\n').slice(1);
    for (const line of lines) {
      const cells = line.split(',');
      for (const name of reserved) {
        // Vazio, e não zero: zero seria uma medida.
        expect(cells[header.indexOf(name)], name).toBe('');
      }
      expect(cells[header.indexOf('cold')]).toMatch(/^[01]$/);
      for (const name of ['wasted_food', 'wasted_wood', 'wasted_stone']) {
        expect(cells[header.indexOf(name)], name).toMatch(/^\d+$/);
      }
    }
  });

  it('as colunas de desperdício são acumuladas e batem com o que o motor contou', () => {
    for (const id of ['food', 'wood', 'stone'] as const) {
      const column = twoSessions.rows.map((row) => row.wasted[id]);
      expect(column, id).toEqual([...column].sort((a, b) => a - b));
      // O que os eventos relataram mais o que a visão mostra como pendente é o total do motor,
      // em unidades inteiras.
      expect(column[167], id).toBe(
        Math.floor((twoSessions.finalState.stats[`wasted_${id}`] ?? 0) / 1000),
      );
    }
    // O ouro não tem limite: nada se perde.
    expect(twoSessions.rows.every((row) => row.wasted.gold === 0)).toBe(true);
    const summary = summarize(twoSessions);
    expect(summary.wasted).toEqual({
      food: twoSessions.rows[167]?.wasted.food,
      wood: twoSessions.rows[167]?.wasted.wood,
      stone: twoSessions.rows[167]?.wasted.stone,
    });
    // A madeira do bot enche o Pátio e vai ao chão: é o que os limites puseram no lugar do
    // excedente parado.
    expect(summary.wasted.wood).toBeGreaterThan(1000);
    expect(summary.wasteHours).toBe(twoSessions.rows.filter((row) => row.wasting).length);
    expect(summary.wasteHours).toBeGreaterThan(0);
    expect(formatSummary(twoSessions)).toContain(
      `Desperdício: food ${summary.wasted.food}, wood ${summary.wasted.wood}, stone ${summary.wasted.stone} (${summary.wasteHours} h com depósito cheio perdendo produção)\n`,
    );
  });

  it('a coluna `cold` marca as horas em que o feudo passa frio', async () => {
    const header = HEADER.split(',');
    const column = (rows: typeof twoSessions.rows) =>
      toCsv(rows)
        .trimEnd()
        .split('\n')
        .slice(1)
        .map((line) => line.split(',')[header.indexOf('cold')]);
    // Na partida do bot a madeira sobra: nenhuma hora de frio.
    expect(twoSessions.rows.some((row) => row.cold)).toBe(false);
    expect(new Set(column(twoSessions.rows))).toEqual(new Set(['0']));
    const frozen = twoSessions.rows.map((row) => ({ ...row, cold: row.season === 'winter' }));
    expect(column(frozen).filter((cell) => cell === '1')).toHaveLength(24);
    // No ritmo 1 o inverno vai da hora 144 à 167: a linha da hora 144 já é o primeiro instante dele.
    expect(summarize({ ...twoSessions, rows: frozen })).toMatchObject({
      coldHours: 24,
      firstColdHour: 144,
    });
    expect(formatSummary({ ...twoSessions, rows: frozen })).toContain(
      'Frio: 24 h, a primeira na hora 144\n',
    );
    expect(formatSummary(twoSessions)).toContain('Frio: nenhum\n');
  });

  it('as ordens são acumuladas: a última linha traz o total da partida', () => {
    const rows = twoSessions.rows;
    const accepted = rows.map((row) => row.commandsAccepted);
    expect(accepted).toEqual([...accepted].sort((a, b) => a - b));
    expect(accepted[167]).toBe(twoSessions.commands.accepted);
    const last = toCsv(rows).trimEnd().split('\n')[168]?.split(',') ?? [];
    const column = (name: string) => last[HEADER.split(',').indexOf(name)];
    expect(column('commands_accepted')).toBe(String(twoSessions.commands.accepted));
    expect(column('commands_refused')).toBe('0');
    expect(column('refused_by_code')).toBe('');
  });

  it('as recusas saem por código, em ordem alfabética, sem vírgula', () => {
    expect(refusedByCode({})).toBe('');
    expect(refusedByCode({ QUEUE_BUSY: 2, HOUSING_FULL: 1 })).toBe('HOUSING_FULL:1;QUEUE_BUSY:2');
    const rows = twoSessions.rows.map((row) => ({
      ...row,
      commandsRefused: { QUEUE_BUSY: 2, HOUSING_FULL: 1 },
    }));
    const last = toCsv(rows).trimEnd().split('\n')[168]?.split(',') ?? [];
    const names = HEADER.split(',');
    expect(last[names.indexOf('commands_refused')]).toBe('3');
    expect(last[names.indexOf('refused_by_code')]).toBe('HOUSING_FULL:1;QUEUE_BUSY:2');
    expect(last).toHaveLength(names.length);
  });
});

describe('fila ociosa', () => {
  const settings = {
    settlementName: 'Pedra Alta',
    timezone: 'UTC',
    vigilHourLocal: 20,
    difficulty: 'lord',
    timeScale: 1,
  } as const;
  const order = (state: GameState, type: Command['type'], payload: unknown): GameState => {
    const result = applyCommand(state, { commandId: `${type}-1`, type, payload } as Command, 0);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.state;
  };
  const signals = (state: GameState) => idleQueue(deriveViewState(state, 0, { timeScale: 1 }));

  it('fila livre com obra que cabe no estoque é fila ociosa; planejada só conta se foi planejada', () => {
    const fresh = createInitialState('fila', settings);
    expect(signals(fresh)).toEqual({ queueIdle: true, plannedIdle: false });
    const planned = order(fresh, 'planConstruction', { building: 'farm' });
    expect(signals(planned)).toEqual({ queueIdle: true, plannedIdle: true });
  });

  it('com a fila ocupada não há fila ociosa', () => {
    const building = order(createInitialState('fila', settings), 'startConstruction', {
      building: 'farm',
    });
    expect(signals(building)).toEqual({ queueIdle: false, plannedIdle: false });
  });

  it('sem estoque para obra nenhuma, a fila livre não é ociosa: não havia o que iniciar', () => {
    const fresh = createInitialState('fila', settings);
    const broke: GameState = {
      ...fresh,
      settlement: { ...fresh.settlement, resources: { food: 0, wood: 0, stone: 0, gold: 0 } },
    };
    // Planejar não exige estoque: a planejada existe, mas ainda não podia começar.
    const planned = order(broke, 'planConstruction', { building: 'farm' });
    expect(signals(planned)).toEqual({ queueIdle: false, plannedIdle: false });
  });

  it('o resumo conta as horas de fila ociosa e os aldeões sem ofício, hora a hora', () => {
    const summary = summarize(twoSessions);
    expect(summary.queueIdleHours).toBe(twoSessions.rows.filter((row) => row.queueIdle).length);
    expect(summary.queueIdleHours).toBeGreaterThan(0);
    expect(summary.plannedIdleHours).toBe(0);
    expect(summary.freeVillagerHours).toBe(
      twoSessions.rows.reduce((sum, row) => sum + row.free, 0),
    );
    expect(summary.freePerHour).toBe(Math.round((summary.freeVillagerHours * 10) / 168) / 10);
  });
});

describe('resumo de uma partida', () => {
  it('diz população, níveis, fome e comandos', () => {
    const text = formatSummary(twoSessions);
    expect(text).toContain(
      'Semente pedra-alta-golden · estratégia economico · 7 dias · 2 sessões/dia',
    );
    expect(text).toMatch(/População: \d+ de \d+ vagas/);
    expect(text).toContain('Fome: nenhuma');
    expect(text).toMatch(/Comandos: \d+ aceitos, 0 recusados\n/);
  });

  it('identifica o jogo medido: versão do motor, versão do estado e hash do conteúdo', () => {
    expect(IDENTITY).toMatchObject({
      engine: ENGINE_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });
    expect(IDENTITY.contentHash).toMatch(/^[0-9a-f]{16}$/);
    // A conta do `contentHash` de `GET /v1/version`: SHA-256 do JSON canônico, 16 caracteres.
    expect(IDENTITY.contentHash).toBe(
      createHash('sha256')
        .update(
          canonicalJson({ balance, buildings, objectives, chronicleTemplates, foundingTemplates }),
        )
        .digest('hex')
        .slice(0, 16),
    );
    expect(identityLine()).toBe(
      `Motor ${IDENTITY.engine} · estado v${IDENTITY.schemaVersion} · conteúdo ${IDENTITY.contentHash}`,
    );
    const lines = formatSummary(twoSessions).split('\n');
    expect(lines[1]).toBe('Partida: Senhor · Normal: um ano em 7 dias');
    expect(lines[2]).toBe(identityLine());
    expect(lines[3]).toBe(
      'Políticas: recrutar, obra mais barata, ampliar o estoque, alocar por demanda, guardar lenha',
    );
  });

  it('traz os sinais de tédio: fila ociosa, aldeões sem ofício e excedente parado', () => {
    const summary = summarize(twoSessions);
    const text = formatSummary(twoSessions);
    expect(text).toContain(
      `Fila ociosa: ${summary.queueIdleHours} h com obra que podia começar (0 h com obra planejada)\n`,
    );
    expect(text).toMatch(/Aldeões sem ofício: \d+ aldeão-horas \(\d+(,\d)? por hora\)\n/);
    expect(text).toContain(
      `Excedente parado: wood ${summary.surplus.wood}, stone ${summary.surplus.stone}, gold ${summary.surplus.gold}\n`,
    );
    expect(summary.surplus).toEqual({
      wood: summary.stock.wood,
      stone: summary.stock.stone,
      gold: summary.stock.gold,
    });
    expect(text).toContain('Sem medida até as Fases C a E: moral, cartas do Conselho');
    // O excedente parado dos materiais com limite nunca passa do limite.
    const view = deriveViewState(twoSessions.finalState, twoSessions.finalState.lastProcessedAt);
    for (const id of ['wood', 'stone'] as const) {
      const cap = view.resources.find((row) => row.id === id)?.cap ?? 0;
      expect(summary.surplus[id], id).toBeLessThanOrEqual(cap);
    }
  });

  it('conta as horas de fome quando o bot não joga o bastante', async () => {
    const abandoned = await simulate({
      seed: 's',
      days: 3,
      strategy: 'economico',
      sessionsPerDay: 1,
    });
    const starved = { ...abandoned, rows: abandoned.rows.map((row) => ({ ...row, famine: true })) };
    expect(summarize(starved)).toMatchObject({ famineHours: 72, firstFamineHour: 1 });
    expect(formatSummary(starved)).toContain('Fome: 72 h, a primeira na hora 1');
  });

  it('diz as recusas por código', () => {
    const refused = { ...twoSessions, commands: { accepted: 3, refused: { QUEUE_BUSY: 2 } } };
    expect(summarize(refused)).toMatchObject({
      commandsAccepted: 3,
      commandsRefused: 2,
      refusedByCode: { QUEUE_BUSY: 2 },
    });
    expect(formatSummary(refused)).toContain('Comandos: 3 aceitos, 2 recusados (QUEUE_BUSY 2)\n');
  });
});
