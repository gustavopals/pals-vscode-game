import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { bandFor, cellKey } from './bands';
import { MATRIX_SEEDS, PROFILES, runMatrix, WINDOWS } from './matrix';
import { simulate } from './simulate';

// A matriz inteira: 2 janelas × 3 ritmos × 3 perfis × 50 sementes, na dificuldade Senhor. São
// 750 partidas distintas (no ritmo 1 as duas janelas são a mesma partida) e cerca de 2 s.
const matrix = await runMatrix();
const paces = balance.paces.map((pace) => pace.timeScale);

describe('faixas de balanceamento por ritmo (roadmap da v0.2, V2B-T4)', () => {
  // Se uma faixa falhar, leia o cabeçalho de `MEASURED` em bands.ts antes de mexer em número.
  it('há uma faixa para cada janela, cada ritmo que o jogo oferece e cada perfil', () => {
    expect(matrix.cells).toHaveLength(WINDOWS.length * paces.length * PROFILES.length);
    for (const window of WINDOWS) {
      for (const timeScale of paces) {
        for (const profile of PROFILES) {
          const key = cellKey(window.id, timeScale, profile.id);
          expect(bandFor(key), key).not.toBeNull();
        }
      }
    }
    expect(matrix.cells.every((cell) => cell.band !== null && cell.seeds === 50)).toBe(true);
  });

  it('as 50 sementes de cada célula ficam dentro da faixa: população, Salão, fome e excedente parado', () => {
    expect(matrix.seeds).toBe(MATRIX_SEEDS);
    expect(matrix.runs).toHaveLength(matrix.cells.length * MATRIX_SEEDS.length);
    expect(matrix.cells.flatMap((cell) => cell.violations)).toEqual([]);
  });

  it('nenhum bot dá ordens que o motor recusa, em nenhum ritmo', () => {
    for (const run of matrix.runs) {
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

  it('no ritmo 1 o perfil Regular passa do que a v0.1 cobrava: 68 aldeões no dia 7, acima dos 40 da meta', () => {
    // A v0.1 cobrava 20 a 40 aldeões e o Salão no nível 3 (GDD §15.2: "população 30–40 no dia 7").
    // Com a segunda fila e as planejadas automáticas (V2C-T5) as obras não esperam mais a visita,
    // e o mesmo perfil chegou a 45 aldeões e ao Salão no nível 6. Com a experiência do ofício
    // (V2C-T3) e o bot plantando para crescer (um lavrador a mais enquanto há vaga), chega a 68
    // e ao Salão no nível 7. Nenhum número do conteúdo foi mexido por causa disso: o teto da
    // meta fica para a rodada de balanceamento (V2C-T7), e este teste guarda o que foi medido
    // para o desvio não passar despercebido.
    const band = bandFor(cellKey('week', 1, 'regular'));
    expect(band?.villagers).toEqual({ min: 61, max: 75 });
    expect(band?.townHallMin).toBe(7);
    expect(band?.famineHoursMax).toBe(0);
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
