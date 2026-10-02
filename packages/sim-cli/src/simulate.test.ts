import { createHash } from 'node:crypto';

import {
  balance,
  buildings,
  chronicleTemplates,
  coldReliefs,
  councilCards,
  craftGuilds,
  enemies,
  foundingTemplates,
  idleVillager,
  moraleBandTemplates,
  objectives,
  raidSizes,
  startingTiles,
  threatMarkTemplates,
  tileTypes,
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
  exhaustedSince,
  formatSummary,
  MECHANIC_COLUMN_NAMES,
  MILESTONES,
  refusedByCode,
  RESERVED_COLUMNS,
  summarize,
  toCsv,
} from './report';
import { idleQueue, simulate, withManualPlans } from './simulate';

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
  'townHall,farm,lumberMill,quarry,goldMine,housing,granary,warehouse,watchtower,palisade,' +
  'famine,' +
  'queue_idle,planned_idle,commands_accepted,commands_refused,refused_by_code,' +
  'wasted_food,wasted_wood,wasted_stone,cold,morale,cards_seen,cards_answered,cards_expired,' +
  'threat,wolf_losses';

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
      'morale',
      'cards_seen',
      'cards_answered',
      'cards_expired',
      'threat',
    ]);
    expect(new Set(RESERVED_COLUMNS.map((column) => column.task))).toEqual(new Set(['V2E-T3']));
    const header = HEADER.split(',');
    const lines = toCsv(twoSessions.rows).trimEnd().split('\n').slice(1);
    for (const line of lines) {
      const cells = line.split(',');
      for (const name of reserved) {
        // Vazio, e não zero: zero seria uma medida.
        expect(cells[header.indexOf(name)], name).toBe('');
      }
      expect(cells[header.indexOf('cold')]).toMatch(/^[01]$/);
      // A moral daquela hora, de 0 a 100.
      expect(Number(cells[header.indexOf('morale')])).toBeGreaterThanOrEqual(0);
      expect(Number(cells[header.indexOf('morale')])).toBeLessThanOrEqual(100);
      for (const name of ['wasted_food', 'wasted_wood', 'wasted_stone']) {
        expect(cells[header.indexOf(name)], name).toMatch(/^\d+$/);
      }
      for (const name of ['cards_seen', 'cards_answered', 'cards_expired']) {
        expect(cells[header.indexOf(name)], name).toMatch(/^\d+$/);
      }
    }
  });

  it('as colunas do Conselho são acumuladas e batem com os eventos da partida', () => {
    const header = HEADER.split(',');
    const lines = toCsv(twoSessions.rows).trimEnd().split('\n').slice(1);
    const column = (name: string) =>
      lines.map((line) => Number(line.split(',')[header.indexOf(name)]));
    const count = (type: string) =>
      twoSessions.events.filter((event) => event.type === type).length;
    for (const [name, type] of [
      ['cards_seen', 'cardDrawn'],
      ['cards_answered', 'cardAnswered'],
      ['cards_expired', 'cardExpired'],
    ] as const) {
      const values = column(name);
      // Nunca diminui, e a última linha é o total da partida.
      expect(values).toEqual([...values].sort((a, b) => a - b));
      expect(values[values.length - 1], name).toBe(count(type));
    }
    // A primeira audiência é no 5º dia de jogo: 8 h reais no ritmo Normal.
    expect(column('cards_seen').slice(0, 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    // O bot econômico responde a toda carta na visita seguinte: nenhuma expira. Só fica sem
    // resposta a que chegou depois da última visita (aqui, a da virada do ano, na última hora).
    const summary = summarize(twoSessions);
    expect(summary.cards.drawn).toBeGreaterThanOrEqual(2);
    expect(summary.cards.expired).toBe(0);
    expect(summary.cards.answered).toBe(
      summary.cards.drawn - twoSessions.finalState.council.pending.length,
    );
    // Com folga, o bot paga a primeira carta de uma cadeia, e as continuações chegam; algumas
    // das opções pagas escondem um efeito, que vira evento dias depois.
    expect(summary.cards.continuations).toBeGreaterThan(0);
    expect(summary.cards.hidden).toBeGreaterThan(0);
    expect(formatSummary(twoSessions)).toMatch(
      /\nConselho: \d+ cartas \(\d+ continuaç(?:ão|ões)\) · \d+ respondidas, 0 expiradas · \d+ efeitos? escondidos?\n/,
    );
  });

  it('as colunas de desperdício são acumuladas e batem com o que o motor contou', async () => {
    // O preguiçoso de uma visita por dia no ritmo 3: ele não tira ninguém do ofício que enche,
    // e a madeira vai ao chão. (O econômico de duas visitas, desde V2C-T7, quase não perde.)
    const careless = await simulate({
      seed: 'pedra-alta-golden',
      days: 3,
      strategy: 'preguicoso',
      sessionsPerDay: 1,
      timeScale: 3,
    });
    for (const result of [twoSessions, careless]) {
      const last = result.rows.length - 1;
      for (const id of ['food', 'wood', 'stone'] as const) {
        const column = result.rows.map((row) => row.wasted[id]);
        expect(column, id).toEqual([...column].sort((a, b) => a - b));
        // O que os eventos relataram mais o que a visão mostra como pendente é o total do
        // motor, em unidades inteiras.
        expect(column[last], id).toBe(
          Math.floor((result.finalState.stats[`wasted_${id}`] ?? 0) / 1000),
        );
      }
      // O ouro não tem limite: nada se perde.
      expect(result.rows.every((row) => row.wasted.gold === 0)).toBe(true);
      const summary = summarize(result);
      expect(summary.wasted).toEqual({
        food: result.rows[last]?.wasted.food,
        wood: result.rows[last]?.wasted.wood,
        stone: result.rows[last]?.wasted.stone,
      });
      expect(summary.wasteHours).toBe(result.rows.filter((row) => row.wasting).length);
      expect(formatSummary(result)).toContain(
        `Desperdício: food ${summary.wasted.food}, wood ${summary.wasted.wood}, stone ${summary.wasted.stone} (${summary.wasteHours} h com depósito cheio perdendo produção)\n`,
      );
    }
    // A madeira do preguiçoso enche o depósito e vai ao chão: é o que os limites puseram no
    // lugar do excedente parado.
    const lost = summarize(careless);
    expect(lost.wasted.wood).toBeGreaterThan(0);
    expect(lost.wasteHours).toBeGreaterThan(0);
  });

  it('diz quanto da produção de cada recurso foi ao chão, cada recurso por si', async () => {
    const careless = await simulate({
      seed: 'pedra-alta-golden',
      days: 3,
      strategy: 'preguicoso',
      sessionsPerDay: 1,
      timeScale: 3,
    });
    const summary = summarize(careless);
    const produced = careless.rows.reduce((sum, row) => sum + row.gross.wood, 0);
    expect(summary.wastedPercent.wood).toBe(Math.round((summary.wasted.wood * 100) / produced));
    expect(summary.wastedPercent.wood).toBeGreaterThan(0);
    expect(summary.wastedPercent.wood).toBeLessThanOrEqual(100);
    expect(formatSummary(careless)).toMatch(
      /Da produção de cada recurso, foi ao chão: food \d+%, wood \d+%, stone \d+%\n/,
    );
    // Sem produção não há percentual: um feudo sem ordens não rende madeira nenhuma.
    const idle = summarize(
      await simulate({
        seed: 'pedra-alta-golden',
        days: 1,
        strategy: 'economico',
        sessionsPerDay: 1,
        bot: async () => {},
      }),
    );
    expect(idle.wastedPercent).toEqual({ food: null, wood: null, stone: null });
  });

  it('acompanha o progresso: a hora de cada marco, a menor população e o fim das obras', () => {
    const summary = summarize(twoSessions);
    expect(MILESTONES.map(({ id, label }) => [id, label])).toEqual([
      ['townHall2', 'Salão Nv2'],
      ['townHall3', 'Salão Nv3'],
      ['townHall4', 'Salão Nv4'],
      ['granary', 'Celeiro'],
      ['warehouse', 'Armazém'],
      ['watchtower', 'Torre de Vigia'],
    ]);
    // A hora de um marco é a primeira linha em que o edifício aparece no nível.
    for (const { id, building, level } of MILESTONES) {
      const hour = summary.milestones[id];
      expect(hour, id).toBe(twoSessions.rows.find((row) => row.levels[building] >= level)?.hour);
    }
    const hours = ['townHall2', 'townHall3', 'townHall4'].map((id) => summary.milestones[id] ?? 0);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
    expect(hours[0]).toBeGreaterThan(0);
    // O feudo nasce com 5 aldeões e só cresce: a menor população é a das primeiras horas.
    expect(summary.villagersMin).toBe(Math.min(...twoSessions.rows.map((row) => row.villagers)));
    expect(summary.villagersMin).toBeLessThan(summary.villagers);
    expect(summary.autoStarted).toBe(
      twoSessions.events.filter((event) => event.type === 'constructionAutoStarted').length,
    );
    expect(summary.autoStarted).toBeGreaterThan(10);
    expect(formatSummary(twoSessions)).toMatch(
      /Progresso: Salão Nv2 na hora \d+, Salão Nv3 na hora \d+, Salão Nv4 na hora \d+, Celeiro na hora \d+, Armazém na hora \d+, Torre de Vigia na hora \d+ · \d+ obras começaram sozinhas · /,
    );
    // A Ameaça é medida no estado, com ou sem Torre; a linha diz se o jogador chegou a vê-la.
    expect(summary.threat).toEqual({ final: 100, max: 100, watchtower: 2 });
    expect(formatSummary(twoSessions)).toContain(
      `Ameaça: 100 no fim (máxima 100) · Torre de Vigia Nv2, erguida na hora ${summary.milestones.watchtower}\n`,
    );
    expect(twoSessions.rows.map((row) => row.threat).slice(0, 4)).toEqual([0, 5, 5, 10]);
    expect(formatSummary(twoSessions)).toContain(
      `População: ${summary.villagers} de ${summary.capacity} vagas (mínima ${summary.villagersMin})\n`,
    );
  });

  it('o fim das obras é a primeira hora da sequência final sem nada a construir', () => {
    const row = (hour: number, exhausted: boolean) => {
      const first = twoSessions.rows[0];
      if (first === undefined) {
        throw new Error('Partida sem linhas.');
      }
      return { ...first, hour, exhausted };
    };
    expect(exhaustedSince([])).toBeNull();
    expect(exhaustedSince([row(1, false), row(2, false)])).toBeNull();
    expect(exhaustedSince([row(1, false), row(2, true), row(3, true)])).toBe(2);
    // Uma pausa que acabou não conta: vale a sequência que chega ao fim da partida.
    expect(exhaustedSince([row(1, true), row(2, false), row(3, true)])).toBe(3);
    expect(exhaustedSince([row(1, true), row(2, false)])).toBeNull();
    // O resumo traz a mesma medida, tirada das linhas da partida.
    expect(summarize(twoSessions).exhaustedAtHour).toBe(exhaustedSince(twoSessions.rows));
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

  it('com a segunda fila aberta e vazia, uma obra em curso não desfaz a ociosidade', () => {
    const fresh = createInitialState('fila', settings);
    const hall4: GameState = {
      ...fresh,
      settlement: {
        ...fresh.settlement,
        buildings: { ...fresh.settlement.buildings, townHall: 4 },
        resources: { food: 500_000, wood: 500_000, stone: 500_000, gold: 500_000 },
      },
    };
    const one = order(hall4, 'startConstruction', { building: 'farm' });
    expect(signals(one)).toEqual({ queueIdle: true, plannedIdle: false });
    const both = order(one, 'startConstruction', { building: 'quarry' });
    expect(signals(both)).toEqual({ queueIdle: false, plannedIdle: false });
  });

  it('uma planejada automática que pode começar não fica na lista: a fila planejada nunca é ociosa', () => {
    const fresh = createInitialState('fila', settings);
    const started = order(fresh, 'planConstruction', { building: 'farm', autoStart: true });
    expect(started.settlement.planned).toEqual([]);
    expect(signals(started).plannedIdle).toBe(false);
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

describe('partida de controle: as mesmas planejadas, manuais', () => {
  const lazy = {
    seed: 'pedra-alta-001',
    days: 7,
    strategy: 'preguicoso',
    sessionsPerDay: 1,
  } as const;

  it('o bot dá as mesmas ordens de planejar, e nenhuma obra começa sozinha', async () => {
    const control = await simulate({ ...lazy, manualPlans: true });
    expect(control.events.filter((event) => event.type === 'constructionAutoStarted')).toEqual([]);
    expect(control.finalState.settlement.planned.length).toBeGreaterThan(0);
    expect(control.finalState.settlement.planned.every((plan) => !plan.autoStart)).toBe(true);
    expect(control.commands.refused).toEqual({});
  });

  it('com o início automático a fila planejada deixa de ficar ociosa, e a fila ociosa cai', async () => {
    const auto = summarize(await simulate(lazy));
    const control = summarize(await simulate({ ...lazy, manualPlans: true }));
    // O jogador de uma visita por dia: as planejadas que podiam começar esperavam a visita.
    expect(control.plannedIdleHours).toBeGreaterThan(100);
    expect(auto.plannedIdleHours).toBe(0);
    // Não chega à metade: desde que o Salão alcança o nível 3 a Paliçada é uma obra que podia
    // começar e que o bot ainda não ergue (a política dela entra com a incursão de lobos,
    // V2E-T3), e a fila conta como ociosa nessas horas, com ou sem o início automático.
    expect(auto.queueIdleHours).toBeLessThan((control.queueIdleHours * 2) / 3);
    // E o feudo anda mais: as obras não esperaram por ele.
    expect(auto.townHall).toBeGreaterThan(control.townHall);
  });

  it('o resumo põe as duas medidas lado a lado', async () => {
    const auto = await simulate(lazy);
    const control = await simulate({ ...lazy, manualPlans: true });
    const text = formatSummary(auto, control);
    const idle = (summary: ReturnType<typeof summarize>) =>
      `${summary.queueIdleHours} h com obra que podia começar (${summary.plannedIdleHours} h com obra planejada)`;
    expect(text).toContain(
      `Fila ociosa: ${idle(summarize(auto))}\nSem o início automático (as mesmas planejadas, manuais): ${idle(summarize(control))}\n`,
    );
    // Sem a partida de controle, a linha não aparece.
    expect(formatSummary(auto)).not.toContain('Sem o início automático');
  });

  it('withManualPlans tira a marca de `planConstruction` e não repassa `setAutoStart`', async () => {
    const seen: Array<[string, unknown]> = [];
    const view = deriveViewState(
      createInitialState('controle', {
        settlementName: 'Pedra Alta',
        timezone: 'UTC',
        vigilHourLocal: 20,
        difficulty: 'lord',
        timeScale: 1,
      }),
      0,
    );
    const act = withManualPlans(
      async (type, payload) => {
        seen.push([type, payload]);
        return view;
      },
      () => view,
    );
    await act('planConstruction', { building: 'farm', autoStart: true, targetLevel: 2 });
    await act('setAutoStart', { building: 'farm', autoStart: true, targetLevel: 2 });
    await act('startConstruction', { building: 'farm' });
    expect(seen).toEqual([
      // Só a marca sai: o nível que a visão mostrou segue com a ordem.
      ['planConstruction', { building: 'farm', targetLevel: 2 }],
      ['startConstruction', { building: 'farm' }],
    ]);
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
          canonicalJson({
            balance,
            buildings,
            objectives,
            chronicleTemplates,
            foundingTemplates,
            coldReliefs,
            craftGuilds,
            moraleBandTemplates,
            idleVillager,
            councilCards,
            tileTypes,
            startingTiles,
            enemies,
            raidSizes,
            threatMarkTemplates,
          }),
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
      'Políticas: erguer a Torre, obra mais barata, ampliar o estoque, planejar automáticas, recrutar, responder a carta, alocar por demanda, guardar lenha',
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
    expect(text).toContain('Sem medida até a Fase E: perdas por lobos');
    // O excedente parado dos materiais com limite nunca passa do limite.
    const view = deriveViewState(twoSessions.finalState, twoSessions.finalState.lastProcessedAt);
    for (const id of ['wood', 'stone'] as const) {
      const cap = view.resources.find((row) => row.id === id)?.cap ?? 0;
      expect(summary.surplus[id], id).toBeLessThanOrEqual(cap);
    }
  });

  it('diz a moral: a do fim, a menor e, quando há, as horas de moral baixa e quem foi embora', async () => {
    // O bot econômico cuida do feudo: a moral nasce em 50, chega a 60 quando a despensa
    // guarda a comida de 24 h de jogo, e o pior que ela conhece são as casas cheias (40). Acima
    // de 60 só com as cartas do Conselho que ele paga quando tem folga.
    const cared = summarize(twoSessions);
    const morales = twoSessions.rows.map((row) => row.morale);
    expect(morales[0]).toBe(50);
    expect(Math.max(...morales)).toBeGreaterThan(60);
    expect(cared.morale).toBe(morales[167]);
    expect(cared.moraleMin).toBe(Math.min(...morales));
    expect(cared.moraleMin).toBeGreaterThanOrEqual(40);
    expect(cared.lowMoraleHours).toBe(
      twoSessions.rows.filter((row) => row.moraleBand === 'restless').length,
    );
    expect(cared).toMatchObject({ villagersLeft: 0, villagersDeserted: 0 });
    expect(cared.settlersArrived).toBe(
      twoSessions.events.filter((event) => event.type === 'villagerArrived').length,
    );
    expect(formatSummary(twoSessions)).toMatch(/\nMoral: \d+ no fim, mínima \d+[^\n]*\n/);

    // Um feudo em que ninguém dá ordem nenhuma, no ritmo 3: a fome chega em 12 h reais, a
    // moral despenca, e os aldeões vão embora até o piso de três.
    const abandoned = await simulate({
      seed: 'pedra-alta-golden',
      days: 3,
      strategy: 'economico',
      sessionsPerDay: 1,
      timeScale: 3,
      bot: async () => {},
    });
    const summary = summarize(abandoned);
    expect(summary).toMatchObject({ villagers: 3, morale: 0, moraleMin: 0 });
    expect(summary.villagersLeft + summary.villagersDeserted).toBe(2);
    expect(summary.villagersDeserted).toBeGreaterThanOrEqual(1);
    expect(summary.lowMoraleHours).toBeGreaterThan(48);
    expect(abandoned.rows[71]).toMatchObject({ morale: 0, moraleBand: 'desperate', villagers: 3 });
    expect(formatSummary(abandoned)).toContain(
      `Moral: 0 no fim, mínima 0 (${summary.lowMoraleHours} h com o povo inquieto ou desesperado) · colonos 0, partidas ${summary.villagersLeft}, deserções ${summary.villagersDeserted}\n`,
    );
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
