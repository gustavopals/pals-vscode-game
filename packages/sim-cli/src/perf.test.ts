import { describe, expect, it } from 'vitest';

import { identityLine } from './identity';
import { formatPerf, PERF_SCENARIOS, runPerf } from './perf';

// Uma rodada curta, só para conferir a forma: os tempos de verdade saem de `pnpm -s sim --
// --perf` e ficam em docs/balance-v0.2.md. Nenhum tempo é cobrado aqui: máquina ocupada não
// derruba a suíte.
const report = await runPerf({ absencesInDays: [1, 3], runs: 1 });

describe('medida de desempenho das ausências longas (roadmap da v0.2, V2C-T7.4)', () => {
  it('mede cada feudo em cada ausência, no ritmo recomendado', () => {
    expect(report.timeScale).toBe(3);
    expect(PERF_SCENARIOS.map((scenario) => scenario.id)).toEqual(['novo', 'meio', 'fim']);
    expect(report.measures.map((measure) => [measure.scenario, measure.absenceDays])).toEqual([
      ['novo', 1],
      ['novo', 3],
      ['meio', 1],
      ['meio', 3],
      ['fim', 1],
      ['fim', 3],
    ]);
  });

  it('no ritmo 3 um dia real atravessa 36 viradas de dia de jogo, e cada uma deixa eventos', () => {
    for (const measure of report.measures) {
      expect(measure.gameDays).toBe(36 * measure.absenceDays);
      // Ao menos a virada de cada dia é um evento.
      expect(measure.events).toBeGreaterThanOrEqual(measure.gameDays);
      expect(measure.advanceMs.median).toBeGreaterThan(0);
      expect(measure.advanceMs.max).toBeGreaterThanOrEqual(measure.advanceMs.median);
    }
  });

  it('o feudo sem ordens passa fome e chega ao piso; os dos bots não perdem ninguém', () => {
    const villagers = (scenario: string, days: number) =>
      report.measures.find(
        (measure) => measure.scenario === scenario && measure.absenceDays === days,
      )?.villagers;
    expect(villagers('novo', 3)).toBe(3);
    expect(villagers('meio', 3)).toBeGreaterThan(15);
    expect(villagers('fim', 3)).toBeGreaterThan(60);
  });

  it('o estado é pequeno e a visão é várias vezes maior do que ele', () => {
    for (const measure of report.measures) {
      expect(measure.stateBytes).toBeGreaterThan(500);
      expect(measure.stateBytes).toBeLessThan(4_000);
      expect(measure.viewBytes).toBeGreaterThan(measure.stateBytes * 3);
      expect(measure.viewBytes).toBeLessThan(40_000);
    }
  });

  it('o relatório sai em Markdown, com a identificação do jogo medido e uma linha por medida', () => {
    const text = formatPerf(report);
    expect(text.split('\n')[2]).toContain(`${identityLine()} · ritmo 3× · Node `);
    expect(text).toContain('| Feudo | Ausência (dias reais) | Viradas de dia de jogo |');
    expect(text.split('\n').filter((line) => line.startsWith('| Feudo ')).length).toBe(
      1 + report.measures.length,
    );
    expect(text).toContain('| Feudo novo, sem nenhuma ordem | 3 | 108 |');
  });
});
