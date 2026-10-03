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
      '| Rápido 3× | Regular | 62 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 167.272 | ≤ 35 | 0 |',
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
      '| 7 dias reais | Rápido 3× | Regular | 3 a 15 | 15 a 30 | 0 a 3 | ≤ 8 | **acima** |',
      '| 7 dias reais | Normal 1× | Regular | 0 | 0 a 5 | 0 a 1 | ≤ 8 | dentro |',
      '| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 1,5 | 0 | ≤ 8 | dentro |',
      '| Um ano de jogo | Rápido 3× | Regular | 0 | 0 a 3 | 0 | ≤ 8 | dentro |',
      '| Um ano de jogo | Normal 1× | Regular | 0 | 0 a 5 | 0 a 1 | ≤ 8 | dentro |',
      '| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 0,5 | 0 a 1,5 | 0 a 0,5 | ≤ 8 | dentro |',
    ]);
    // A meta não é faixa: a rodada continua "dentro das faixas" com células acima dela.
    expect(text).toContain('Todas as partidas dentro das faixas.');
  });

  it('traz a linha de base no formato de bands.ts, uma linha por célula', () => {
    const lines = text.split('\n').filter((line) => line.includes('measured('));
    expect(lines).toHaveLength(matrix.cells.length);
    // Com as cartas do Conselho as sementes já não dão a mesma partida: a população é uma faixa.
    expect(lines[1]).toBe(
      "  'week/3/regular': measured([72, 73], 7, 0, 0, 4236, 4703, 154062, 30),",
    );
  });

  it('cada janela traz o progresso: a hora de cada marco, o fim das obras e a menor população', () => {
    const [week, year] = text.split('## Um ano de jogo');
    const header =
      '| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Paliçada (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima | Objetivos concluídos | Último objetivo (h) |';
    expect(week).toContain(`### Progresso: 7 dias reais\n\n${header}`);
    expect(year).toContain(`### Progresso: um ano de jogo\n\n${header}`);
    // No ritmo 3 o Regular, seguindo os objetivos, ergue o Celeiro na hora 15, a Torre de Vigia
    // na 20 e a Paliçada na 25, e esgota as obras entre as horas 121 e 151 da semana; conclui
    // os dez objetivos na hora 56, a virada do primeiro ano. No primeiro ano (56 h reais) ainda
    // há o que construir. O Preguiçoso chega à Torre na hora 50 e ergue a Paliçada nas horas 55
    // e 56, a tempo dos dez objetivos.
    expect(week).toContain(
      '| Rápido 3× | Regular | 11 | 24 | 34 | 15 | 37 | 20 | 25 | 121 a 151 | 47 a 48 | 7 | 10 | 56 |',
    );
    expect(year).toContain(
      '| Rápido 3× | Regular | 11 | 24 | 34 | 15 | 37 | 20 | 25 | — | 31 | 7 | 10 | 56 |',
    );
    expect(year).toContain(
      '| Rápido 3× | Preguiçoso | 29 | 53 a 54 | — | 31 | 32 a 33 | 50 | 55 a 56 | — | 16 | 7 | 10 | 56 |',
    );
    const cell = matrix.cells.find((entry) => entry.key === 'week/3/regular');
    expect(cell?.measure.milestones).toMatchObject({
      townHall4: { min: 34, max: 34 },
      granary: { min: 15, max: 15 },
      watchtower: { min: 20, max: 20 },
      palisade: { min: 25, max: 25 },
    });
    expect(cell?.measure.exhaustedAtHour).toEqual({ min: 121, max: 151 });
    expect(cell?.measure.villagersMin).toEqual({ min: 7, max: 7 });
    expect(cell?.measure.objectivesDone).toEqual({ min: 10, max: 10 });
    expect(cell?.measure.objectivesAllDoneAtHour).toEqual({ min: 56, max: 56 });
    const lazy = matrix.cells.find((entry) => entry.key === 'year/3/preguicoso');
    expect(lazy?.measure.milestones.townHall4).toEqual({ min: null, max: null });
    expect(lazy?.measure.milestones.watchtower).toEqual({ min: 50, max: 50 });
    expect(lazy?.measure.milestones.palisade).toEqual({ min: 55, max: 56 });
    expect(lazy?.measure.exhaustedAtHour).toEqual({ min: null, max: null });
    expect(lazy?.measure.objectivesDone).toEqual({ min: 10, max: 10 });
    expect(lazy?.measure.objectivesAllDoneAtHour).toEqual({ min: 56, max: 56 });
  });

  it('cada janela traz os lobos: as incursões, os feridos, o que levaram e a Ameaça no fim', () => {
    const [week, year] = text.split('## Um ano de jogo');
    const header =
      '| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |';
    expect(week).toContain(`### Lobos: 7 dias reais\n\n${header}`);
    expect(year).toContain(`### Lobos: um ano de jogo\n\n${header}`);
    // No ritmo 3 a semana são três anos de jogo: o Regular sofre a incursão do roteiro (e, em
    // uma semente, outra antes da Paliçada no nível 2) e repele as outras, umas seis por ano; a
    // Ameaça termina entre 39 e 60. Até a Ameaça ser reequilibrada (revisão das Fases D e E)
    // eram de 7 a 10 sofridas e de 39 a 44 repelidas, com a Ameaça entre 90 e 100.
    expect(week).toContain(
      '| Rápido 3× | Regular | 1 a 2 | 17 a 18 | 18 a 19 | 1 a 2 | 30 a 118 | 25 a 54 | 39 a 60 |',
    );
    const cell = matrix.cells.find((entry) => entry.key === 'week/3/regular');
    expect(cell?.measure.raids).toMatchObject({
      suffered: { min: 1, max: 2 },
      repelled: { min: 17, max: 18 },
      threatFinal: { min: 39, max: 60 },
    });
    // O Preguiçoso do primeiro ano no ritmo 3 chega à Torre na hora 50, perto do fim do ano:
    // os vigias anunciam no máximo uma incursão, e nenhuma é repelida (a Paliçada sai nas
    // últimas horas do ano).
    const lazy = matrix.cells.find((entry) => entry.key === 'year/3/preguicoso');
    expect(lazy?.measure.raids.announced).toEqual({ min: 0, max: 1 });
    expect(lazy?.measure.raids.repelled).toEqual({ min: 0, max: 0 });
    expect(lazy?.measure.raids.suffered.min).toBeGreaterThan(0);
  });

  it('cada janela traz o desperdício de cada recurso: a parte da produção e a sequência', () => {
    const [week] = text.split('## Um ano de jogo');
    expect(week).toContain(
      '### Desperdício por recurso: 7 dias reais\n\n| Ritmo | Perfil | Comida perdida (% da produção) | Madeira perdida (% da produção) | Pedra perdida (% da produção) | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) |',
    );
    // Cada recurso por si, nunca somados: o Preguiçoso do ritmo 3 perde mais da metade do que
    // corta, e o Regular, bem menos.
    expect(week).toContain(
      '| Rápido 3× | Preguiçoso | 35% a 37% | 52% a 59% | 0% a 17% | 54 | 63 | 3 a 30 |',
    );
    expect(week).toContain(
      '| Rápido 3× | Regular | 1% a 8% | 4% a 23% | 0% a 2% | 3 a 15 | 15 a 30 | 0 a 3 |',
    );
    expect(week).toContain('| Tranquilo 0,5× | Regular | 0% | 0% a 3% | 0% | 0 | 0 a 1,5 | 0 |');
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
      'week/3/regular: população 3, fora da faixa de 62 a 82 (1 de 3 sementes, a primeira pedra-alta-003)',
    ]);
    expect(violationsOf(cell.key, cell.band, [empty, empty, empty], seeds)).toEqual([
      'week/3/regular: população 3, fora da faixa de 62 a 82 (3 de 3 sementes, a primeira pedra-alta-001)',
    ]);
  });
});

describe('CSV da matriz', () => {
  const lines = matrixCsv(matrix).trimEnd().split('\n');

  it('tem uma linha por partida, com as colunas das mecânicas no fim', () => {
    expect(lines).toHaveLength(1 + matrix.runs.length);
    expect(lines[0]).toBe(
      'window,time_scale,profile,strategy,sessions_per_day,difficulty,seed,real_hours,game_years,' +
        'villagers,capacity,town_hall,famine_hours,queue_idle_hours,planned_idle_hours,' +
        'free_villager_hours,waste_streak_game_hours,' +
        'waste_streak_food,waste_streak_wood,waste_streak_stone,' +
        'wasted_food_percent,wasted_wood_percent,wasted_stone_percent,' +
        'villagers_min,town_hall_2_hour,town_hall_3_hour,town_hall_4_hour,granary_hour,' +
        'warehouse_hour,watchtower_hour,palisade_hour,exhausted_hour,auto_started,' +
        'objectives_done_hour,villagers_lost,' +
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
      'threat',
      'wolf_losses',
      'raids_suffered',
      'raids_repelled',
      'villagers_injured',
      'objectives_done',
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
      // Os lobos: o total da partida, em toda linha (em toda partida há ao menos a do roteiro).
      for (const name of ['wolf_losses', 'raids_suffered', 'raids_repelled', 'villagers_injured']) {
        expect(cells[header.indexOf(name)], name).toMatch(/^\d+$/);
      }
      expect(
        Number(cells[header.indexOf('raids_suffered')]) +
          Number(cells[header.indexOf('raids_repelled')]),
      ).toBeGreaterThan(0);
      // Um marco a que a partida não chegou sai vazio (não zero): hora nenhuma.
      for (const name of ['town_hall_4_hour', 'granary_hour', 'exhausted_hour']) {
        expect(cells[header.indexOf(name)], name).toMatch(/^\d*$/);
      }
    }
    const lazyYear = lines.find((line) => line.startsWith('year,3,preguicoso,'))?.split(',') ?? [];
    expect(lazyYear[header.indexOf('town_hall_3_hour')]).toBe('54');
    expect(lazyYear[header.indexOf('town_hall_4_hour')]).toBe('');
    expect(lazyYear[header.indexOf('exhausted_hour')]).toBe('');
    // Os objetivos: os concluídos na partida e a hora do último, vazia enquanto falta algum.
    expect(lazyYear[header.indexOf('objectives_done')]).toBe('10');
    expect(lazyYear[header.indexOf('objectives_done_hour')]).toBe('56');
    // Na semana do ritmo Tranquilo o inverno ainda não chegou: falta um, e a hora fica vazia.
    const short = lines.find((line) => line.startsWith('week,0.5,regular,'))?.split(',');
    expect(short?.[header.indexOf('objectives_done')]).toBe('9');
    expect(short?.[header.indexOf('objectives_done_hour')]).toBe('');
  });

  it('a semente muda o resultado: o Conselho sorteia, e as 50 sementes trabalham', () => {
    // Até a Fase C nada do que os bots alcançam sorteava (a moral só sorteia com 80 ou mais, ou
    // com 25 ou menos), e as partidas de uma célula eram todas iguais. Com o Conselho, a carta
    // que chega primeiro depende da semente, e a resposta do bot mexe um pouco no feudo: há
    // mais resultados diferentes do que células, e nenhuma célula tem tantos quanto sementes
    // (as cartas de hoje são poucas e pesam pouco).
    const withoutSeed = new Set(
      lines.slice(1).map((line) =>
        line
          .split(',')
          .filter((_, index) => index !== 6)
          .join(','),
      ),
    );
    expect(withoutSeed.size).toBeGreaterThan(matrix.cells.length);
    expect(withoutSeed.size).toBeLessThanOrEqual(lines.length - 1);
  });
});
