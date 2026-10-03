import { balance, DIFFICULTY_IDS, type DifficultyId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { bandFor, cellKey } from './bands';
import {
  MATRIX_SEEDS,
  type MatrixRun,
  PROFILES,
  runMatrix,
  wasteGoalCells,
  WINDOWS,
  YEAR_GAME_HOURS,
} from './matrix';
import { MILESTONES, WASTE_STREAK_GOAL } from './report';
import { simulate } from './simulate';

// A matriz inteira: 2 janelas × 3 ritmos × 3 perfis × 50 sementes, na dificuldade Senhor. São
// 750 partidas distintas (no ritmo 1 as duas janelas são a mesma partida) e uns 20 s.
const matrix = await runMatrix();
const paces = balance.paces.map((pace) => pace.timeScale);

// As outras duas dificuldades têm faixa desde a rodada de balanceamento da Fase C (V2C-T7). Aqui
// elas jogam as 3 primeiras sementes: enquanto nenhum bot chega a sortear, todas as sementes dão
// a mesma partida, e as 50 pesariam três vezes na suíte. As 50 rodam pelo comando
// (`pnpm -s sim -- --matrix --difficulty peasant`), e é delas a linha de base de `bands.ts`.
const OTHER_SEEDS = MATRIX_SEEDS.slice(0, 3);
const others = {
  peasant: await runMatrix({ difficulty: 'peasant', seeds: OTHER_SEEDS }),
  ironKing: await runMatrix({ difficulty: 'ironKing', seeds: OTHER_SEEDS }),
};
const byDifficulty: Record<DifficultyId, typeof matrix> = { ...others, lord: matrix };

describe('faixas de balanceamento por ritmo (roadmap da v0.2, V2B-T4)', () => {
  // Se uma faixa falhar, leia o cabeçalho de `MEASURED` em bands.ts antes de mexer em número.
  it('há uma faixa para cada janela, cada ritmo que o jogo oferece e cada perfil, em cada dificuldade', () => {
    expect(Object.keys(byDifficulty).sort()).toEqual([...DIFFICULTY_IDS].sort());
    for (const difficulty of DIFFICULTY_IDS) {
      const { cells } = byDifficulty[difficulty];
      expect(cells, difficulty).toHaveLength(WINDOWS.length * paces.length * PROFILES.length);
      for (const window of WINDOWS) {
        for (const timeScale of paces) {
          for (const profile of PROFILES) {
            const key = cellKey(window.id, timeScale, profile.id);
            expect(bandFor(key, difficulty), `${difficulty} ${key}`).not.toBeNull();
          }
        }
      }
      expect(cells.every((cell) => cell.band !== null)).toBe(true);
    }
    expect(matrix.cells.every((cell) => cell.seeds === 50)).toBe(true);
  });

  it('as 50 sementes de cada célula ficam dentro da faixa: população, Salão, fome e excedente parado', () => {
    expect(matrix.seeds).toBe(MATRIX_SEEDS);
    expect(matrix.runs).toHaveLength(matrix.cells.length * MATRIX_SEEDS.length);
    expect(matrix.cells.flatMap((cell) => cell.violations)).toEqual([]);
  });

  it.each(['peasant', 'ironKing'] as const)(
    'em %s as partidas também ficam dentro das faixas da dificuldade',
    (difficulty) => {
      const result = others[difficulty];
      expect(result.difficulty).toBe(difficulty);
      expect(result.runs).toHaveLength(result.cells.length * OTHER_SEEDS.length);
      expect(result.cells.flatMap((cell) => cell.violations)).toEqual([]);
    },
  );

  it('em toda dificuldade e em todo perfil: nenhuma hora de fome, nenhuma de frio e ninguém vai embora', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      for (const cell of byDifficulty[difficulty].cells) {
        const where = `${difficulty} ${cell.key}`;
        expect(cell.measure.famineHours, where).toEqual({ min: 0, max: 0 });
        expect(cell.measure.coldHours, where).toEqual({ min: 0, max: 0 });
        expect(cell.measure.villagersLost, where).toEqual({ min: 0, max: 0 });
        // A menor população é a das primeiras horas: o feudo de bot nenhum encolhe.
        expect(cell.measure.villagersMin.min, where).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('em cada dificuldade há caminho de compras até os desbloqueios da fase (V2C-T7.3)', () => {
    // O Celeiro e o Armazém (Salão no nível 2) e a segunda fila de obras (Salão no nível 4): o
    // perfil Regular chega a todos, em todo ritmo, dentro de um ano de jogo, só com ordens que o
    // motor aceita. O que o catálogo anuncia e nenhum caminho alcança está no teste do motor
    // (`storage.test.ts`, "alcançabilidade") e em docs/balance-v0.2.md, seção 9.5. A Torre de
    // Vigia e a Paliçada têm os testes delas, logo abaixo.
    //
    // Desde os objetivos da v0.2 (V2E-T4) o bot ergue o primeiro depósito porque o objetivo o
    // pede, e o segundo, quando o estoque aperta. Com a Ameaça reequilibrada (revisão das Fases
    // D e E) os lobos levam menos, e em Senhor, no ritmo Rápido, as 50 sementes têm o Armazém
    // na hora 37 (eram três sem ele no fim do ano; docs/balance-v0.2.md, seção 16).
    expect(MILESTONES.map(({ id }) => id)).toEqual([
      'townHall2',
      'townHall3',
      'townHall4',
      'granary',
      'warehouse',
      'watchtower',
      'palisade',
    ]);
    const phaseC = MILESTONES.filter(({ id }) => id !== 'watchtower' && id !== 'palisade');
    for (const difficulty of DIFFICULTY_IDS) {
      const regular = byDifficulty[difficulty].cells.filter(
        (cell) => cell.window === 'year' && cell.profile.id === 'regular',
      );
      expect(regular).toHaveLength(paces.length);
      for (const cell of regular) {
        for (const { id } of phaseC) {
          const hours = cell.measure.milestones[id];
          const where = `${difficulty} ${cell.key} ${id}`;
          expect(hours?.max, where).not.toBeNull();
          expect(hours?.max ?? Infinity, where).toBeLessThan(cell.realHours);
        }
        expect(cell.measure.commandsRefused, `${difficulty} ${cell.key}`).toEqual({
          min: 0,
          max: 0,
        });
      }
    }
    // Toda partida do perfil Regular tem ao menos um depósito no fim de um ano de jogo, e em
    // Senhor, no ritmo Rápido, as 50 sementes têm o Armazém na mesma hora.
    for (const run of matrix.runs.filter((entry) => entry.profile.id === 'regular')) {
      const { granary, warehouse } = run.summary.milestones;
      expect(granary ?? warehouse ?? null, `${run.window}/${run.timeScale}/${run.seed}`).not.toBe(
        null,
      );
    }
    const week = matrix.cells.find((cell) => cell.key === 'week/3/regular');
    expect(week?.measure.milestones.warehouse).toEqual({ min: 37, max: 37 });
    const year = matrix.cells.find((cell) => cell.key === 'year/3/regular');
    expect(year?.measure.milestones.warehouse).toEqual({ min: 37, max: 37 });
    expect(
      matrix.runs.filter(
        (run) =>
          run.window === 'year' &&
          run.timeScale === 3 &&
          run.profile.id === 'regular' &&
          run.summary.milestones.warehouse === null,
      ),
    ).toHaveLength(0);
  });

  it('os bots percorrem a sequência dos objetivos: os dez em um ano de jogo, em toda semente do Regular e do Dedicado (V2E-T4)', () => {
    // O bot segue o que cada objetivo ativo aponta na visão (`seguir os objetivos`). O último a
    // cair é o do inverno sem frio, na virada para a primavera: a hora do último objetivo é o
    // fim do ano de jogo (56 h reais no ritmo Rápido, 168 no Normal, 336 no Tranquilo).
    for (const difficulty of DIFFICULTY_IDS) {
      const year = byDifficulty[difficulty].cells.filter((cell) => cell.window === 'year');
      for (const cell of year.filter((entry) => entry.profile.id !== 'preguicoso')) {
        const where = `${difficulty} ${cell.key}`;
        expect(cell.measure.objectivesDone, where).toEqual({ min: 10, max: 10 });
        expect(cell.measure.objectivesAllDoneAtHour, where).toEqual({
          min: cell.realHours,
          max: cell.realHours,
        });
      }
    }
    // Na semana do ritmo Tranquilo o inverno ainda não chegou: ficam nove.
    const half = matrix.cells.filter((cell) => cell.window === 'week' && cell.timeScale === 0.5);
    for (const cell of half) {
      expect(cell.measure.objectivesDone, cell.key).toEqual({ min: 9, max: 9 });
    }
    // O Preguiçoso, com uma visita por dia, também chega aos dez nos ritmos Tranquilo e Normal.
    // No Rápido parte das sementes fecha o ano sem a Paliçada (o Salão não chega ao nível 3 a
    // tempo), e ficam nove. Com a Ameaça reequilibrada os lobos levam menos e o Salão sobe antes
    // (eram nove ou dez no Normal e oito a dez no Rápido; docs/balance-v0.2.md, seção 16).
    const lazy = (key: string) =>
      matrix.cells.find((cell) => cell.key === key)?.measure.objectivesDone;
    expect(lazy('year/0.5/preguicoso')).toEqual({ min: 10, max: 10 });
    expect(lazy('year/1/preguicoso')).toEqual({ min: 10, max: 10 });
    expect(lazy('year/3/preguicoso')).toEqual({ min: 9, max: 10 });
    expect(lazy('week/3/preguicoso')).toEqual({ min: 10, max: 10 });
  });

  it('a Torre de Vigia chega cedo para quem segue os objetivos (V2E-T1, V2E-T4)', () => {
    // Até os objetivos da v0.2 o bot só erguia a Torre com o dobro do custo em estoque, e ela
    // chegava tarde: no ritmo Normal, entre as horas 61 e 109; no Tranquilo, entre a 97 e a
    // 157; no Rápido, na hora 37. Com o objetivo "Construa a Torre de Vigia" na lista, o bot a
    // deixa planejada antes de o Salão a liberar, e ela começa sozinha: em Senhor, com 2
    // sessões por dia, fica pronta entre as horas 32 e 43 no Normal, 55 e 61 no Tranquilo e na
    // hora 20 no Rápido (docs/balance-v0.2.md, seção 15). O nível 2 continua sendo o da folga.
    const tower = (key: string) =>
      matrix.cells.find((cell) => cell.key === key)?.measure.milestones.watchtower;
    expect(tower('year/1/regular')).toEqual({ min: 32, max: 43 });
    expect(tower('year/0.5/regular')).toEqual({ min: 55, max: 61 });
    expect(tower('year/3/regular')).toEqual({ min: 20, max: 20 });
    expect(tower('week/3/regular')).toEqual({ min: 20, max: 20 });
    // O Preguiçoso, com uma visita por dia, agora chega lá dentro da semana em todo ritmo e em
    // toda semente. No Normal a demora é do ouro: a Torre custa 50, e o Preguiçoso não mexe em
    // quem já trabalha para pôr gente na Mina. Com os lobos levando menos (seção 16), a hora é
    // a mesma em toda semente.
    expect(tower('week/3/preguicoso')).toEqual({ min: 50, max: 50 });
    expect(tower('week/1/preguicoso')).toEqual({ min: 82, max: 82 });
    expect(tower('week/0.5/preguicoso')).toEqual({ min: 110, max: 110 });
    // A Ameaça não satura: com +2 por dia, −35 por incursão e as médias a partir de 70, ela
    // oscila, e nenhuma partida de um ano de jogo ou mais termina perto do máximo. Até a revisão
    // das Fases D e E (+5 e −10) ela chegava a 100 em toda partida e ficava entre 90 e 100
    // (docs/balance-v0.2.md, seções 14 e 16).
    const gameYears = (run: MatrixRun) => (run.realHours * run.timeScale) / YEAR_GAME_HOURS;
    const fullYears = matrix.runs.filter((run) => gameYears(run) >= 1);
    expect(fullYears.length).toBeGreaterThan(0);
    const finals = fullYears.map((run) => run.summary.threat.final);
    expect(Math.max(...finals)).toBeLessThan(80);
    expect(Math.min(...finals)).toBeLessThan(balance.threat.raidChanceAbove);
  });

  it('a Paliçada sai logo depois da Torre: o bot a ergue quando a Ameaça conhecida passa do limiar ou o objetivo a pede (V2E-T3, V2E-T4)', () => {
    // A Paliçada pede o Salão no nível 3. Antes dos objetivos da v0.2 o bot só a erguia com a
    // Torre mostrando o risco, e ela ficava pronta entre as horas 73 e 121 no ritmo Normal, na
    // 49 ou 50 no Rápido e entre a 109 e a 169 no Tranquilo. Com a Torre cedo e o objetivo
    // "Construa a Paliçada", em Senhor, com 2 sessões por dia: entre as horas 48 e 55 no
    // Normal, na 25 no Rápido e entre a 83 e a 86 no Tranquilo (seção 16).
    const palisade = (key: string) =>
      matrix.cells.find((cell) => cell.key === key)?.measure.milestones.palisade;
    expect(palisade('year/1/regular')).toEqual({ min: 48, max: 55 });
    expect(palisade('year/3/regular')).toEqual({ min: 25, max: 25 });
    expect(palisade('year/0.5/regular')).toEqual({ min: 83, max: 86 });
    for (const cell of matrix.cells.filter((entry) => entry.profile.id !== 'preguicoso')) {
      const tower = cell.measure.milestones.watchtower;
      const wall = cell.measure.milestones.palisade;
      if (tower?.min != null && wall?.min != null) {
        expect(wall.min, cell.key).toBeGreaterThan(tower.min);
      }
    }
    // Em toda partida os lobos atacam (a incursão do roteiro, no mínimo), e em nenhuma o feudo
    // perde gente por isso: o teste de cima já cobra fome, frio e partidas em zero.
    for (const run of matrix.runs) {
      const { raids } = run.summary;
      const where = `${run.window}/${run.timeScale}/${run.profile.id}/${run.seed}`;
      expect(raids.suffered + raids.repelled, where).toBeGreaterThan(0);
      // Quem tem a Paliçada no nível 2 repele; quem não tem, sofre: nunca os dois ao contrário.
      if (raids.palisade === 0) {
        expect(raids.repelled, where).toBe(0);
      }
    }
    // O perfil Regular no ritmo Normal, em um ano: a incursão do roteiro sofrida e de 4 a 5
    // repelidas, com a Ameaça no fim entre 19 e 70. Antes da Ameaça reequilibrada (seção 16)
    // eram de 3 a 5 sofridas e de 9 a 13 repelidas, com a Ameaça entre 90 e 100.
    const year = matrix.cells.find((cell) => cell.key === 'year/1/regular')?.measure.raids;
    expect(year?.suffered).toEqual({ min: 1, max: 1 });
    expect(year?.repelled).toEqual({ min: 4, max: 5 });
    expect(year?.threatFinal).toEqual({ min: 19, max: 70 });
  });

  it('nenhum bot dá ordens que o motor recusa, em nenhum ritmo e em nenhuma dificuldade', () => {
    for (const run of [...matrix.runs, ...others.peasant.runs, ...others.ironKing.runs]) {
      expect(run.summary.refusedByCode, `${run.window}/${run.timeScale}/${run.profile.id}`).toEqual(
        {},
      );
    }
    expect(matrix.runs.every((run) => run.summary.commandsAccepted > 5)).toBe(true);
  });

  it('com 2 sessões por dia não há fome, em nenhum ritmo e em nenhuma janela', () => {
    const regular = matrix.cells.filter((cell) => cell.profile.id === 'regular');
    expect(regular).toHaveLength(WINDOWS.length * paces.length);
    for (const cell of regular) {
      expect(cell.measure.famineHours, cell.key).toEqual({ min: 0, max: 0 });
      expect(cell.band?.famineHoursMax, cell.key).toBe(0);
    }
  });

  it('no ritmo 1 o perfil Regular passa do que a v0.1 cobrava: de 63 a 73 aldeões no dia 7, acima dos 40 da meta', () => {
    // A v0.1 cobrava 20 a 40 aldeões e o Salão no nível 3 (GDD §15.2: "população 30–40 no dia 7").
    // Com a segunda fila e as planejadas automáticas (V2C-T5) as obras não esperam mais a visita,
    // e o mesmo perfil chegou a 45 aldeões e ao Salão no nível 6. Com a experiência do ofício
    // (V2C-T3) e o bot plantando para crescer (um lavrador a mais enquanto há vaga), chegou a 68
    // e ao Salão no nível 7; com a moral (V2C-T4), a 66. Na rodada da Fase C (V2C-T7) o bot
    // deixou de produzir para o chão, e os braços que sobram rendem em outro ofício: 69. Com o
    // primeiro lote de cartas (V2D-T2) cada semente conta outra história, e o mesmo perfil
    // termina entre 64 e 72; com a Torre de Vigia (V2E-T1), entre 65 e 72. Com as incursões de
    // lobos (V2E-T3), entre 60 e 71, e em parte das sementes o Salão fica no nível 6: o que os
    // lobos levam e a Paliçada custam uma obra ou duas. Nenhum número do conteúdo foi mexido
    // por causa disso: o teto da meta é decisão do autor (docs/balance-v0.2.md, seções 9.8, 11,
    // 12 e 14), e este teste guarda o que foi medido para o desvio não passar despercebido.
    // Com os objetivos da v0.2 (V2E-T4) a população continua entre 60 e 71, e o Salão volta ao
    // nível 7 em toda semente: a defesa chega cedo, e os lobos levam menos (seção 15). Com a
    // Ameaça reequilibrada, entre 63 e 71 (seção 16). Com as cartas corrigidas (os pilares de
    // pedra da Ponte e a Paliçada mostrada aos aldeões por +20, seção 17), entre 63 e 73: os
    // dias em 80 trazem colonos.
    const band = bandFor(cellKey('week', 1, 'regular'));
    expect(band?.villagers).toEqual({ min: 56, max: 81 });
    expect(band?.townHallMin).toBe(7);
    expect(band?.famineHoursMax).toBe(0);
  });

  it('a meta de desperdício (ADR 0013, decisão 17) é cumprida nos ritmos Normal e Tranquilo; no Rápido, não', () => {
    // GDD §15.2 (ritmo Normal, dificuldade Senhor): com 2 sessões por dia, nenhum recurso passa
    // de 8 h de jogo seguidas indo ao chão. Até a rodada da Fase C só uma das seis células do
    // Regular a cumpria; o que faltava era o bot parar de produzir para o depósito cheio
    // (docs/balance-v0.2.md, seção 9.3), e nenhum número do conteúdo mudou. No ritmo Rápido as 8
    // h de jogo são 2 h 40 reais, e quem volta a cada 12 h não as cumpre. Este teste guarda as
    // duas coisas: o que entrou não pode sair calado, e o que ficou fora não pode piorar calado.
    //
    // Com o primeiro lote de cartas (V2D-T2) cada semente segue um caminho de obras diferente.
    // No ritmo Normal, 49 das 50 sementes continuavam dentro da meta; em uma o Armazém saía
    // tarde e, no outono, o bot mandava os lenhadores juntarem a lenha do inverno com o
    // depósito cheio: 10 h de jogo seguidas de madeira indo ao chão. Com a Torre de Vigia
    // (V2E-T1) o caminho de obras mudou de novo: são três as sementes (017, 034 e 046), com 9 a
    // 10 h de madeira, todas com o Armazém pronto só da hora 61 em diante. Com as três cartas
    // da Paliçada no sorteio (V2E-T2) o caminho mudou outra vez: são cinco (016, 017, 029, 033
    // e 047), ainda com 9 a 10 h de madeira. Com as incursões de lobos e a Paliçada que o bot
    // passou a erguer (V2E-T3), são quatro (007, 027, 037 e 046), com 9 h, e o teto da célula
    // caiu para 9 h; no ritmo Rápido o pior caso da semana subiu de 27 para 33 h, e o do ano
    // caiu de 24 para 18. Não é uma carta, a Torre nem a Paliçada que desperdiça; é o caminho
    // do bot (docs/balance-v0.2.md, seções 11 a 14).
    //
    // Com os objetivos da v0.2 (V2E-T4) o primeiro depósito sai cedo, porque o objetivo o pede,
    // e no ritmo Normal as 50 sementes ficam dentro da meta: o pior caso é de 8 h de madeira.
    // No Rápido a semana continua em 33 h, e o ano caiu de 18 para 15 (seção 15); com a Ameaça
    // reequilibrada, para 9 (seção 16).
    expect(WASTE_STREAK_GOAL).toEqual({ sessionsPerDay: 2, gameHours: 8 });
    const goal = wasteGoalCells(matrix.cells);
    expect(goal).toHaveLength(WINDOWS.length * paces.length);
    expect(goal.every(({ cell }) => cell.profile.id === 'regular')).toBe(true);
    const over = Object.fromEntries(
      goal.filter(({ met }) => !met).map(({ cell, gameHours }) => [cell.key, gameHours]),
    );
    expect(over).toEqual({
      'week/3/regular': 33,
      'year/3/regular': 9,
    });
    expect(goal.filter(({ met }) => met).map(({ cell }) => cell.key)).toEqual([
      'week/1/regular',
      'week/0.5/regular',
      'year/1/regular',
      'year/0.5/regular',
    ]);
    const beyond = matrix.runs.filter(
      (run) =>
        run.window === 'week' &&
        run.timeScale === 1 &&
        run.profile.id === 'regular' &&
        Math.max(...Object.values(run.summary.wasteStreakGameHours)) > WASTE_STREAK_GOAL.gameHours,
    );
    expect(beyond.map((run) => run.seed)).toEqual([]);
    // Nas outras dificuldades, com as 3 sementes que a suíte joga: dentro nos ritmos Normal e
    // Tranquilo, acima no Rápido (em Rei de Ferro, só na semana).
    const overIn = (difficulty: 'peasant' | 'ironKing') =>
      wasteGoalCells(others[difficulty].cells)
        .filter(({ met }) => !met)
        .map(({ cell }) => cell.key);
    expect(overIn('peasant')).toEqual(['week/3/regular']);
    expect(overIn('ironKing')).toEqual(['week/3/regular']);
  });

  it('o excedente parado de madeira caiu em relação à v0.1, em todo ritmo', () => {
    // A linha de base da v0.1, antes de qualquer mecânica (docs/balance-v0.2.md, seção 2): o
    // perfil Regular terminava 7 dias reais com 40.872 de madeira parada no ritmo 3, 10.017 no
    // ritmo 1 e 1.609 no 0,5. Com os limites de estoque ela não passa do que o Armazém guarda;
    // com o início automático ela vira obra; e com o bot sem produzir para o chão, o que
    // sobraria vira ouro. Contando também o que foi ao chão, a madeira sem uso continua menor
    // na partida típica (a mediana das sementes): com as cartas do Conselho cada semente tem o
    // seu caminho, e uma em 50 desperdiça mais do que isso (seção 11).
    const before: Record<number, number> = { 3: 40_872, 1: 10_017, 0.5: 1_609 };
    for (const timeScale of paces) {
      const cell = matrix.cells.find(
        (entry) => entry.key === cellKey('week', timeScale, 'regular'),
      );
      // No ritmo Tranquilo a semana é meio ano de jogo: o Armazém ainda está enchendo, e o
      // limite dele (2.700 no nível 4) já passa do que a v0.1 juntava sem limite nenhum.
      const parked = cell?.measure.surplus.wood.max ?? Infinity;
      if (timeScale >= 1) {
        expect(parked, `ritmo ${timeScale}`).toBeLessThan(before[timeScale] ?? 0);
      }
      const unused = matrix.runs
        .filter(
          (run) =>
            run.window === 'week' && run.timeScale === timeScale && run.profile.id === 'regular',
        )
        .map((run) => run.summary.surplus.wood + run.summary.wasted.wood)
        .sort((a, b) => a - b);
      const median = unused[Math.floor(unused.length / 2)] ?? Infinity;
      expect(median, `ritmo ${timeScale}`).toBeLessThan(before[timeScale] ?? 0);
    }
  });

  it('a sequência desperdiçando tem limite em toda célula: o medido com 5% de folga', () => {
    for (const cell of matrix.cells) {
      const limit = cell.band?.wasteStreakMax ?? -1;
      const worst = cell.measure.wasteStreakWorst.max;
      expect(limit, cell.key).toBeGreaterThanOrEqual(worst);
      expect(limit, cell.key).toBeLessThanOrEqual(Math.ceil(worst * 1.05));
    }
  });

  it('todo ritmo tem limite de excedente parado para cada material, e o limite é o medido com 5% de folga', () => {
    for (const cell of matrix.cells) {
      for (const [resource, range] of Object.entries(cell.measure.surplus)) {
        const limit = cell.band?.surplusMax[resource as keyof typeof cell.measure.surplus] ?? 0;
        expect(limit, `${cell.key} ${resource}`).toBeGreaterThanOrEqual(range.max);
        expect(limit, `${cell.key} ${resource}`).toBeLessThanOrEqual(Math.ceil(range.max * 1.05));
      }
    }
  });

  it('com 1 sessão por dia do bot econômico, nenhuma fome nas primeiras 24 h, em nenhum ritmo', async () => {
    for (const timeScale of paces) {
      const lazy = await simulate({
        seed: 'pedra-alta-golden',
        days: 7,
        strategy: 'economico',
        sessionsPerDay: 1,
        timeScale,
      });
      expect(lazy.rows.slice(0, 24).some((row) => row.famine)).toBe(false);
      const firstFamine = lazy.events.find((event) => event.type === 'famineStarted');
      // O instante do evento é de jogo: 24 h reais são 24 × ritmo horas de jogo.
      expect(
        firstFamine === undefined || firstFamine.atMs > 24 * 3_600_000 * timeScale,
        `ritmo ${timeScale}`,
      ).toBe(true);
    }
  });
});

describe('as duas janelas da matriz', () => {
  const cell = (window: 'week' | 'year', timeScale: number) => {
    const found = matrix.cells.find((entry) => entry.key === cellKey(window, timeScale, 'regular'));
    if (found === undefined) {
      throw new Error(`Célula ausente: ${window}/${timeScale}/regular.`);
    }
    return found;
  };

  it('não se misturam: no ritmo 1 são a mesma partida, nos outros medem durações diferentes', () => {
    expect(cell('year', 1).measure).toEqual(cell('week', 1).measure);
    expect(cell('week', 3)).toMatchObject({ realHours: 168, gameYears: 3 });
    expect(cell('year', 3)).toMatchObject({ realHours: 56, gameYears: 1 });
    expect(cell('week', 0.5)).toMatchObject({ realHours: 168, gameYears: 0.5 });
    expect(cell('year', 0.5)).toMatchObject({ realHours: 336, gameYears: 1 });
    expect(cell('year', 3).measure).not.toEqual(cell('week', 3).measure);
  });
});
