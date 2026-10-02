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

  it('em outra dificuldade a rodada é jogada, medida e conferida contra as faixas dela', async () => {
    const hard = await runMatrix({ seeds: seeds.slice(0, 1), difficulty: 'ironKing' });
    expect(hard).toMatchObject({ difficulty: 'ironKing', difficultyLabel: 'Rei de Ferro' });
    expect(hard.cells.every((cell) => cell.band !== null && cell.violations.length === 0)).toBe(
      true,
    );
    // As faixas são as de Rei de Ferro, não as de Senhor: o Armazém guarda 20% a menos.
    const stone = (result: typeof hard) =>
      result.cells.find((cell) => cell.key === 'week/3/regular')?.band?.surplusMax.stone;
    expect(stone(hard)).toBeLessThan(stone(matrix) ?? 0);
    expect(formatMatrix(hard)).toContain('· dificuldade Rei de Ferro (ironKing) · 1 semente');
    expect(formatMatrix(hard)).toContain('Todas as partidas dentro das faixas.');
    expect(matrixCsv(hard).split('\n')[1]).toContain(',ironKing,pedra-alta-001,');
  });

  it('um ritmo fora do conteúdo pode ser medido, sem faixa', async () => {
    const odd = await runMatrix({ seeds: seeds.slice(0, 1), timeScales: [2] });
    expect(odd.cells.map((cell) => cell.paceLabel)).toEqual(
      Array.from({ length: 6 }, () => 'Ritmo 2×'),
    );
    expect(odd.cells.every((cell) => cell.band === null)).toBe(true);
    expect(odd.cells[3]).toMatchObject({ window: 'year', realHours: 84, gameYears: 1 });
    expect(formatMatrix(odd)).toContain('Nenhuma faixa definida para esta rodada.');
    expect(formatMatrix(odd)).toContain('| sem faixa |');
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
    expect(text).toContain(
      '| Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |',
    );
    expect(text).toContain(
      '| Rápido 3× | Regular | 64 a 80 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.448 | ≤ 5.355 | ≤ 164.525 | ≤ 19 | 0 |',
    );
    expect(text).toContain('Todas as partidas dentro das faixas.');
    expect(text).not.toContain('**fora**');
  });

  it('traz a meta de desperdício do perfil Regular, célula a célula, com o veredito', () => {
    const [, section] = text.split('## Meta de desperdício');
    const goal = (section ?? '').split('## Linha de base')[0] ?? '';
    expect(goal).toContain('com 2 sessões por dia, nenhum recurso passa de 8 h de jogo seguidas');
    expect(goal).toContain(
      '| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |',
    );
    const rows = goal.split('\n').filter((line) => line.includes('| Regular |'));
    expect(rows).toEqual([
      '| 7 dias reais | Rápido 3× | Regular | 18 | 9 | 12 | ≤ 8 | **acima** |',
      '| 7 dias reais | Normal 1× | Regular | 0 | 1 | 0 | ≤ 8 | dentro |',
      '| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0,5 | 0 | ≤ 8 | dentro |',
      '| Um ano de jogo | Rápido 3× | Regular | 18 | 0 | 0 | ≤ 8 | **acima** |',
      '| Um ano de jogo | Normal 1× | Regular | 0 | 1 | 0 | ≤ 8 | dentro |',
      '| Um ano de jogo | Tranquilo 0,5× | Regular | 2 | 0,5 | 0 | ≤ 8 | dentro |',
    ]);
    // A meta não é faixa: a rodada continua "dentro das faixas" com células acima dela.
    expect(text).toContain('Todas as partidas dentro das faixas.');
  });

  it('traz a linha de base no formato de bands.ts, uma linha por célula', () => {
    const lines = text.split('\n').filter((line) => line.includes('measured('));
    expect(lines).toHaveLength(matrix.cells.length);
    expect(lines[1]).toBe(
      "  'week/3/regular': measured([72, 72], 7, 0, 0, 4236, 5100, 156690, 18),",
    );
  });

  it('cada janela traz o progresso: a hora de cada marco, o fim das obras e a menor população', () => {
    const [week, year] = text.split('## Um ano de jogo');
    const header =
      '| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |';
    expect(week).toContain(`### Progresso: 7 dias reais\n\n${header}`);
    expect(year).toContain(`### Progresso: um ano de jogo\n\n${header}`);
    // No ritmo 3 o Regular esgota as obras na hora 113 da semana; no primeiro ano (56 h reais)
    // ainda há o que construir, e o Preguiçoso não chega ao Salão no nível 4.
    expect(week).toContain('| Rápido 3× | Regular | 11 | 22 | 36 | 25 | 26 | 113 | 46 | 7 |');
    expect(year).toContain('| Rápido 3× | Regular | 11 | 22 | 36 | 25 | 26 | — | 29 | 7 |');
    expect(year).toContain('| Rápido 3× | Preguiçoso | 29 | 54 | — | 33 | 31 | — | 14 | 7 |');
    const cell = matrix.cells.find((entry) => entry.key === 'week/3/regular');
    expect(cell?.measure.milestones).toMatchObject({
      townHall4: { min: 36, max: 36 },
      granary: { min: 25, max: 25 },
    });
    expect(cell?.measure.exhaustedAtHour).toEqual({ min: 113, max: 113 });
    expect(cell?.measure.villagersMin).toEqual({ min: 7, max: 7 });
    const lazy = matrix.cells.find((entry) => entry.key === 'year/3/preguicoso');
    expect(lazy?.measure.milestones.townHall4).toEqual({ min: null, max: null });
    expect(lazy?.measure.exhaustedAtHour).toEqual({ min: null, max: null });
  });

  it('cada janela traz o desperdício de cada recurso: a parte da produção e a sequência', () => {
    const [week] = text.split('## Um ano de jogo');
    expect(week).toContain(
      '### Desperdício por recurso: 7 dias reais\n\n| Ritmo | Perfil | Comida perdida (% da produção) | Madeira perdida (% da produção) | Pedra perdida (% da produção) | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) |',
    );
    // Cada recurso por si, nunca somados: o Preguiçoso do ritmo 3 perde quase metade do que
    // corta, e o Regular, 2%.
    expect(week).toContain('| Rápido 3× | Preguiçoso | 51% | 46% | 44% | 63 | 75 | 48 |');
    expect(week).toContain('| Rápido 3× | Regular | 5% | 2% | 2% | 18 | 9 | 12 |');
    expect(week).toContain('| Tranquilo 0,5× | Regular | 0% | 0% | 0% | 0 | 0,5 | 0 |');
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
      'week/3/regular: excedente parado de madeira: 50000, acima do limite de 4448 (2 de 3 sementes, a primeira pedra-alta-002)',
      'week/3/regular: população 3, fora da faixa de 64 a 80 (1 de 3 sementes, a primeira pedra-alta-003)',
    ]);
    expect(violationsOf(cell.key, cell.band, [empty, empty, empty], seeds)).toEqual([
      'week/3/regular: população 3, fora da faixa de 64 a 80 (3 de 3 sementes, a primeira pedra-alta-001)',
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
        'free_villager_hours,waste_streak_game_hours,' +
        'waste_streak_food,waste_streak_wood,waste_streak_stone,' +
        'wasted_food_percent,wasted_wood_percent,wasted_stone_percent,' +
        'villagers_min,town_hall_2_hour,town_hall_3_hour,town_hall_4_hour,granary_hour,' +
        'warehouse_hour,exhausted_hour,auto_started,villagers_lost,' +
        'food,wood,stone,gold,commands_accepted,commands_refused,' +
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
    // As colunas das mecânicas: o desperdício por recurso, o frio e a moral são medidos (o
    // total, as horas e a menor moral da partida); as outras saem vazias até a tarefa de cada
    // uma.
    const header = (lines[0] ?? '').split(',');
    for (const line of lines.slice(1)) {
      const cells = line.split(',');
      for (const { name } of RESERVED_COLUMNS) {
        expect(cells[header.indexOf(name)], name).toBe('');
      }
      for (const name of ['wasted_food', 'wasted_wood', 'wasted_stone', 'cold', 'morale']) {
        expect(cells[header.indexOf(name)], name).toMatch(/^\d+$/);
      }
      // Um marco a que a partida não chegou sai vazio (não zero): hora nenhuma.
      for (const name of ['town_hall_4_hour', 'granary_hour', 'exhausted_hour']) {
        expect(cells[header.indexOf(name)], name).toMatch(/^\d*$/);
      }
    }
    const lazyYear = lines.find((line) => line.startsWith('year,3,preguicoso,'))?.split(',') ?? [];
    expect(lazyYear[header.indexOf('town_hall_3_hour')]).toBe('54');
    expect(lazyYear[header.indexOf('town_hall_4_hour')]).toBe('');
    expect(lazyYear[header.indexOf('exhausted_hour')]).toBe('');
  });

  it('a semente ainda não muda o resultado: os bots não chegam à moral que sorteia', () => {
    // A moral já sorteia, mas só com 80 ou mais (o colono) ou com 25 ou menos (a partida), e
    // os feudos dos bots vivem entre 40 e 60. Quando o Conselho passar a sortear (ou um bot
    // deixar a moral cair), este teste cai e a lista de 50 sementes começa a trabalhar:
    // troque-o por um que confira que as sementes divergem.
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
