import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { identityLine } from './identity';
import {
  formatMatrix,
  gameYearsIn,
  MATRIX_SEEDS,
  matrixCsv,
  PROFILES,
  runMatrix,
  violationsOf,
  windowRealHours,
  YEAR_GAME_HOURS,
} from './matrix';
import { MECHANIC_COLUMN_NAMES, RESERVED_COLUMNS } from './report';
import { strategies } from './simulate';

// Três sementes bastam para conferir a forma da matriz; as 50 são jogadas em balance.test.ts.
const seeds = MATRIX_SEEDS.slice(0, 3);
const matrix = await runMatrix({ seeds });

describe('matriz de balanceamento: o que é jogado', () => {
  it('a lista de sementes é fixa: pedra-alta-001 a pedra-alta-050', () => {
    expect(MATRIX_SEEDS).toHaveLength(50);
    expect(MATRIX_SEEDS[0]).toBe('pedra-alta-001');
    expect(MATRIX_SEEDS[9]).toBe('pedra-alta-010');
    expect(MATRIX_SEEDS[49]).toBe('pedra-alta-050');
    expect(new Set(MATRIX_SEEDS).size).toBe(50);
  });

  it('os perfis são 1, 2 e 4 sessões por dia real, cada um com um bot que existe', () => {
    expect(
      PROFILES.map((profile) => [profile.id, profile.sessionsPerDay, profile.strategy]),
    ).toEqual([
      ['preguicoso', 1, 'preguicoso'],
      ['regular', 2, 'economico'],
      ['dedicado', 4, 'economico'],
    ]);
    for (const profile of PROFILES) {
      expect(strategies).toHaveProperty(profile.strategy);
    }
  });

  it('a janela de 7 dias reais é a mesma em todo ritmo; a de um ano de jogo sai do calendário', () => {
    expect(YEAR_GAME_HOURS).toBe(168);
    expect([3, 1, 0.5].map((timeScale) => windowRealHours('week', timeScale))).toEqual([
      168, 168, 168,
    ]);
    expect([3, 1, 0.5].map((timeScale) => windowRealHours('year', timeScale))).toEqual([
      56, 168, 336,
    ]);
    expect([3, 1, 0.5].map((timeScale) => gameYearsIn(168, timeScale))).toEqual([3, 1, 0.5]);
    expect(() => windowRealHours('year', 5)).toThrow(/33,6 h reais/);
  });

  it('joga cada janela em cada ritmo que o conteúdo oferece, com cada perfil e cada semente', () => {
    const paces = balance.paces.map((pace) => pace.timeScale);
    expect(matrix.cells.map((cell) => cell.key)).toEqual(
      (['week', 'year'] as const).flatMap((window) =>
        paces.flatMap((timeScale) =>
          PROFILES.map((profile) => `${window}/${timeScale}/${profile.id}`),
        ),
      ),
    );
    expect(matrix.runs).toHaveLength(2 * paces.length * PROFILES.length * seeds.length);
    for (const run of matrix.runs) {
      expect(run.summary.hours).toBe(run.realHours);
      expect(run.realHours).toBe(windowRealHours(run.window, run.timeScale));
    }
    expect(matrix.cells.every((cell) => cell.seeds === 3)).toBe(true);
  });

  it('cada célula traz o menor e o maior valor entre as sementes', () => {
    for (const cell of matrix.cells) {
      const runs = matrix.runs.filter(
        (run) =>
          run.window === cell.window &&
          run.timeScale === cell.timeScale &&
          run.profile.id === cell.profile.id,
      );
      const villagers = runs.map((run) => run.summary.villagers);
      expect(cell.measure.villagers).toEqual({
        min: Math.min(...villagers),
        max: Math.max(...villagers),
      });
      const wood = runs.map((run) => run.summary.surplus.wood);
      expect(cell.measure.surplus.wood).toEqual({ min: Math.min(...wood), max: Math.max(...wood) });
    }
  });

  it('em outra dificuldade a rodada é jogada e medida, mas não há faixa a conferir', async () => {
    const hard = await runMatrix({ seeds: seeds.slice(0, 1), difficulty: 'ironKing' });
    expect(hard).toMatchObject({ difficulty: 'ironKing', difficultyLabel: 'Rei de Ferro' });
    expect(hard.cells.every((cell) => cell.band === null && cell.violations.length === 0)).toBe(
      true,
    );
    expect(formatMatrix(hard)).toContain('Nenhuma faixa definida para esta rodada.');
    expect(formatMatrix(hard)).toContain('| sem faixa |');
    expect(matrixCsv(hard).split('\n')[1]).toContain(',ironKing,pedra-alta-001,');
  });

  it('um ritmo fora do conteúdo pode ser medido, sem faixa', async () => {
    const odd = await runMatrix({ seeds: seeds.slice(0, 1), timeScales: [2] });
    expect(odd.cells.map((cell) => cell.paceLabel)).toEqual(
      Array.from({ length: 6 }, () => 'Ritmo 2×'),
    );
    expect(odd.cells.every((cell) => cell.band === null)).toBe(true);
    expect(odd.cells[3]).toMatchObject({ window: 'year', realHours: 84, gameYears: 1 });
  });
});

describe('relatório da matriz', () => {
  const text = formatMatrix(matrix);

  it('identifica a rodada: motor, estado, conteúdo, dificuldade e sementes', () => {
    expect(text.split('\n')[2]).toBe(
      `${identityLine()} · dificuldade Senhor (lord) · 3 sementes (pedra-alta-001 a pedra-alta-003)`,
    );
  });

  it('tem duas tabelas separadas, cada uma com o seu denominador', () => {
    const [week, year] = text.split('## Um ano de jogo');
    expect(week).toContain('## 7 dias reais');
    expect(week).toContain('| Ritmo | Perfil | Anos de jogo | População |');
    expect(week).not.toContain('Horas reais');
    expect(year).toContain('| Ritmo | Perfil | Horas reais | População |');
    expect(year).not.toContain('Anos de jogo');
    expect(week).toContain('| Rápido 3× | Regular (2/dia, economico) | 3 |');
    expect(week).toContain('| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 |');
    expect(year).toContain('| Rápido 3× | Dedicado (4/dia, economico) | 56 |');
    expect(year).toContain('| Tranquilo 0,5× | Regular (2/dia, economico) | 336 |');
  });

  it('cada recurso tem a sua coluna de excedente, e as faixas cobradas vêm ao lado', () => {
    expect(text).toContain('| Excedente de madeira | Excedente de pedra | Excedente de ouro |');
    expect(text.match(/Faixas cobradas:/g)).toHaveLength(2);
    expect(text).toContain(
      '| Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) |',
    );
    expect(text).toContain('| Rápido 3× | Regular | 57 a 71 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 |');
    expect(text).toContain('Todas as partidas dentro das faixas.');
    expect(text).not.toContain('**fora**');
  });

  it('traz a linha de base no formato de bands.ts, uma linha por célula', () => {
    const lines = text.split('\n').filter((line) => line.includes('measured('));
    expect(lines).toHaveLength(matrix.cells.length);
    expect(lines[1]).toBe("  'week/3/regular': measured([64, 64], 7, 0, 0, 5100, 5100, 9409),");
  });

  it('diz o que saiu da faixa, marca a célula e aponta o que fazer', () => {
    const [first, ...rest] = matrix.cells;
    if (first === undefined) {
      throw new Error('Matriz vazia.');
    }
    const problem = 'week/3/preguicoso: população 2, fora da faixa de 18 a 22 (3 de 3 sementes)';
    const report = formatMatrix({
      ...matrix,
      cells: [{ ...first, violations: [problem] }, ...rest],
    });
    expect(report).toContain(`**Fora da faixa:**\n\n- ${problem}\n`);
    expect(report).toContain('| **fora** |');
    expect(report).toContain('é uma regressão: o ajuste é nos números de `@lotg/content`');
    expect(report).toContain('copie a linha de base abaixo para `MEASURED`');
    expect(report).not.toContain('Todas as partidas dentro das faixas.');
  });
});

describe('problemas de uma célula', () => {
  it('o mesmo problema em várias sementes sai uma vez, com a contagem e a primeira semente', () => {
    const cell = matrix.cells.find((entry) => entry.key === 'week/3/regular');
    const run = matrix.runs.find(
      (entry) => entry.window === 'week' && entry.timeScale === 3 && entry.profile.id === 'regular',
    );
    if (cell?.band === null || cell === undefined || run === undefined) {
      throw new Error('Célula week/3/regular sem faixa.');
    }
    const fine = run.summary;
    const piled = { ...fine, surplus: { ...fine.surplus, wood: 50_000 } };
    const empty = { ...fine, villagers: 3 };
    expect(violationsOf(cell.key, cell.band, [fine, fine, fine], seeds)).toEqual([]);
    expect(
      violationsOf(cell.key, cell.band, [fine, piled, { ...piled, villagers: 3 }], seeds),
    ).toEqual([
      'week/3/regular: excedente parado de madeira: 50000, acima do limite de 5355 (2 de 3 sementes, a primeira pedra-alta-002)',
      'week/3/regular: população 3, fora da faixa de 57 a 71 (1 de 3 sementes, a primeira pedra-alta-003)',
    ]);
    expect(violationsOf(cell.key, cell.band, [empty, empty, empty], seeds)).toEqual([
      'week/3/regular: população 3, fora da faixa de 57 a 71 (3 de 3 sementes, a primeira pedra-alta-001)',
    ]);
  });
});

describe('CSV da matriz', () => {
  const lines = matrixCsv(matrix).trimEnd().split('\n');

  it('tem uma linha por partida, com as colunas reservadas vazias no fim', () => {
    expect(lines).toHaveLength(1 + matrix.runs.length);
    expect(lines[0]).toBe(
      'window,time_scale,profile,strategy,sessions_per_day,difficulty,seed,real_hours,game_years,' +
        'villagers,capacity,town_hall,famine_hours,queue_idle_hours,planned_idle_hours,' +
        'free_villager_hours,food,wood,stone,gold,commands_accepted,commands_refused,' +
        `refused_by_code,${MECHANIC_COLUMN_NAMES.join(',')}`,
    );
    expect(MECHANIC_COLUMN_NAMES).toEqual([
      'wasted_food',
      'wasted_wood',
      'wasted_stone',
      'cold',
      'morale',
      'cards_seen',
      'cards_answered',
      'cards_expired',
      'wolf_losses',
    ]);
    const columns = lines[0]?.split(',').length;
    expect(lines.every((line) => line.split(',').length === columns)).toBe(true);
    expect(lines[1]?.startsWith('week,3,preguicoso,preguicoso,1,lord,pedra-alta-001,168,3,')).toBe(
      true,
    );
    // As colunas das mecânicas: o desperdício por recurso e o frio são medidos (o total e as
    // horas da partida); as outras saem vazias até a tarefa de cada uma.
    const header = (lines[0] ?? '').split(',');
    for (const line of lines.slice(1)) {
      const cells = line.split(',');
      for (const { name } of RESERVED_COLUMNS) {
        expect(cells[header.indexOf(name)], name).toBe('');
      }
      for (const name of ['wasted_food', 'wasted_wood', 'wasted_stone', 'cold']) {
        expect(cells[header.indexOf(name)], name).toMatch(/^\d+$/);
      }
    }
  });

  it('a semente não muda o resultado enquanto nenhuma regra sorteia', () => {
    // Quando o Conselho e a moral passarem a sortear, este teste cai e a lista de 50 sementes
    // começa a trabalhar: troque-o por um que confira que as sementes divergem.
    const withoutSeed = new Set(
      lines.slice(1).map((line) =>
        line
          .split(',')
          .filter((_, index) => index !== 6)
          .join(','),
      ),
    );
    expect(withoutSeed.size).toBe(matrix.cells.length);
  });
});
