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
    // Na v0.2 sem Cerco, o feudo de 2 dias mantinha > 15 aldeões. Na v0.4, o Cerco do inverno
    // (V4G-T2) com Queda consome 20% da população na ausência de 3 dias reais (108 dias de jogo,
    // atravessando o inverno): 19 aldeões caem para 15 (medido: 15; docs/balance-v0.4.md §16).
    expect(villagers('meio', 3)).toBeGreaterThanOrEqual(15);
    // Na v0.2 sem Cerco, o feudo de 7 dias mantinha > 60 aldeões. Na v0.4, o Cerco do inverno
    // (V4G-T2) com Queda consome 20% da população na ausência de 3 dias reais: 66 aldeões caem
    // para 53 (medido: 53; docs/balance-v0.4.md §16). Na terceira junção (preparo militar e três
    // cercos nos 7 dias jogados), a partida entra na ausência com 37 aldeões e volta com 49 (§22).
    expect(villagers('fim', 3)).toBeGreaterThanOrEqual(49);
  });

  it('o estado é pequeno e a visão é várias vezes maior do que ele', () => {
    for (const measure of report.measures) {
      expect(measure.stateBytes).toBeGreaterThan(500);
      // O teto subiu com a Taverna (V3C-T2): os candidatos da rotação, o festival e os heróis
      // contratados. A linha de base por fase está em docs/balance-v0.3.md. Subiu de 5.500 para 5.600 com as formações salvas (V4C-T2).
      // De 5.600 para 6.100 com a muralha no estado (vida por ala e reparo, V4E-T1; medido: 5.971).
      // De 6.100 para 11.000 com as incursões-batalha (V4E-T2.7): `army.reports` guarda até três
      // relatórios de batalha, cada incursão marcada leva a composição e o bot econômico passou a
      // guardar a formação e a prévia do Conselho de Guerra (medido: 10.028 no feudo de 7 dias).
      expect(measure.stateBytes).toBeLessThan(11_000);
      expect(measure.viewBytes).toBeGreaterThan(measure.stateBytes * 3);
      // De 40.000 para 55.000 com os relatórios de batalha, a formação e a prévia na visão
      // (V4E-T2.7; medido: 50.882 no feudo de 7 dias).
      expect(measure.viewBytes).toBeLessThan(55_000);
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
