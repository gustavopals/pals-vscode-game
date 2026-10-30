import { describe, expect, it } from 'vitest';

import { IDENTITY } from './identity';
import {
  formatMatrix,
  matrixCsv,
  MILITARY_PROFILE,
  siegeTable,
  siegeTotalsOf,
  type MatrixResult,
} from './matrix';
import { formatSummary, summarize, toCsv } from './report';
import { noSieges, simulate } from './simulate';

// Uma partida avulsa de um ano; nenhuma matriz ou remedição é executada neste arquivo.
const year = await simulate({
  seed: 'pedra-alta-001',
  days: 3,
  hours: 56,
  timeScale: 3,
  strategy: 'militar',
  sessionsPerDay: 2,
});
const summary = summarize(year);

const emptyMatrix: MatrixResult = {
  identity: IDENTITY,
  difficulty: 'lord',
  difficultyLabel: 'Senhor',
  seeds: [],
  runs: [],
  cells: [],
};

describe('medição do Cerco (V4G-T2.10)', () => {
  it('atravessa um ano com cerco encerrado e mantém o bot vivo após a Queda', () => {
    expect(year.rows).toHaveLength(56);
    expect(year.events.filter(({ type }) => type === 'siegeScheduled')).toHaveLength(1);
    expect(year.events.filter(({ type }) => type === 'siegeFell')).toHaveLength(1);
    const waves = year.events.filter(({ type }) => type === 'siegeWaveFought');
    expect(waves).toHaveLength(1);
    expect(year.finalState.siege?.result).toBe('fall');
    expect(year.rows.at(-1)).toMatchObject({ year: 2, season: 'spring' });
    expect(year.finalState.settlement.population.villagers).toBeGreaterThanOrEqual(3);
    expect(year.commands.refused).toEqual({});
    expect(summary.siege).toEqual({
      result: 'fall',
      won: 0,
      glorious: 0,
      fallen: 1,
      wavesFought: 1,
      wavesWon: 0,
      militiaCalled: 0,
    });
  });

  it('acrescenta as três colunas no fim e distingue ausência de desfecho de zero', () => {
    const [header, ...rows] = toCsv(year.rows).trimEnd().split('\n');
    expect(header?.split(',').slice(-3)).toEqual(['siege_result', 'waves_won', 'militia_called']);
    expect(rows[0]?.split(',').slice(-3)).toEqual(['', '0', '0']);
    expect(rows.at(-1)?.split(',').slice(-3)).toEqual(['fall', '0', '0']);
    expect(year.rows[0]?.siege).toEqual(noSieges());
    expect(formatSummary(year)).toContain(
      'Cerco: 1 encerrados · 0 vitórias (0 gloriosas) · 1 quedas · 0 de 1 ondas vencidas · 0 aldeões convocados',
    );
  });

  it('usa os mesmos valores no CSV da matriz, sem jogar uma matriz', () => {
    const result: MatrixResult = {
      ...emptyMatrix,
      runs: [
        {
          window: 'year',
          timeScale: 3,
          profile: MILITARY_PROFILE,
          seed: year.options.seed,
          realHours: 56,
          summary,
        },
      ],
    };
    const [header, row] = matrixCsv(result).trimEnd().split('\n');
    expect(header?.split(',').slice(-3)).toEqual(['siege_result', 'waves_won', 'militia_called']);
    expect(row?.split(',').slice(-3)).toEqual(['fall', '0', '0']);
  });

  it('serializa vitórias e convocações positivas sem alterar as contagens de horas anteriores', () => {
    const row = year.rows.at(-1)!;
    const siege = {
      ...noSieges(),
      result: 'glorious' as const,
      won: 1,
      glorious: 1,
      wavesFought: 3,
      wavesWon: 3,
      militiaCalled: 12,
    };
    const rows = [{ ...row, siege }];
    const run = summarize({ ...year, rows });
    expect(toCsv(rows).trimEnd().split('\n').at(-1)?.split(',').slice(-3)).toEqual([
      'glorious',
      '3',
      '12',
    ]);
    expect(run.siege).toEqual(siege);
    expect(run.siege).not.toBe(siege);
    expect(year.rows[0]?.siege).toEqual(noSieges());
  });

  it('soma todos os anos por célula, incluindo Gloriosas nas vitórias', () => {
    const totals = siegeTotalsOf([
      {
        ...summary,
        siege: {
          ...noSieges(),
          result: 'glorious',
          won: 2,
          glorious: 1,
          fallen: 1,
          wavesFought: 7,
          wavesWon: 6,
          militiaCalled: 18,
        },
      },
      {
        ...summary,
        siege: {
          ...noSieges(),
          result: 'victory',
          won: 1,
          wavesFought: 3,
          wavesWon: 3,
          militiaCalled: 7,
        },
      },
    ]);
    expect(totals).toEqual({
      won: 3,
      glorious: 1,
      fallen: 1,
      wavesFought: 10,
      wavesWon: 9,
      militiaCalled: 25,
    });
    const table = siegeTable([
      { paceLabel: 'Rápido', profile: MILITARY_PROFILE, siege: totals },
      { paceLabel: 'Tranquilo', profile: MILITARY_PROFILE, siege: siegeTotalsOf([]) },
    ]);
    expect(table).toContain('| Rápido | Militar | 4 | 3 | 1 | 1 | 9 / 10 | 25 |');
    expect(table).toContain('| Tranquilo | Militar | 0 | 0 | 0 | 0 | 0 / 0 | 0 |');
  });

  it('o relatório inclui a tabela Cerco nas duas janelas', () => {
    const text = formatMatrix(emptyMatrix);
    expect(text).toContain('### Cerco: 7 dias reais');
    expect(text).toContain('### Cerco: um ano de jogo');
    expect(text.match(/Vitórias \(inclui Gloriosas\)/g)).toHaveLength(2);
  });
});
