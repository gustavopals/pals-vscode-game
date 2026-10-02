import { councilCards } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { formatCoverage, measureCoverage } from './coverage';
import { MATRIX_SEEDS, windowRealHours } from './matrix';
import { simulate } from './simulate';

// A cobertura do catálogo do Conselho em 50 sementes (roadmap da v0.2, V2D-T2.5): um ano de
// jogo do perfil Regular (o bot econômico, 2 visitas por dia), no ritmo Normal e no Rápido.
// `SHOW_COVERAGE=1 pnpm --filter @lotg/sim-cli test -- coverage` imprime as tabelas que estão
// em docs/content-v0.2.md.
const year = (timeScale: number) =>
  Promise.all(
    MATRIX_SEEDS.map((seed) =>
      simulate({
        seed,
        days: 0,
        hours: windowRealHours('year', timeScale),
        strategy: 'economico',
        sessionsPerDay: 2,
        timeScale,
      }),
    ),
  );
const normal = measureCoverage(await year(1));
const fast = measureCoverage(await year(3));

if (process.env.SHOW_COVERAGE !== undefined) {
  console.log(formatCoverage('Ritmo Normal (um ano em 7 dias), 2 visitas por dia', normal));
  console.log(formatCoverage('Ritmo Rápido (um ano em 56 horas), 2 visitas por dia', fast));
}

const drawable = councilCards.filter((card) => card.weight > 0).map((card) => card.id);

/**
 * As duas continuações de "A Promessa da Paliçada" só chegam a quem promete, e o bot nunca
 * promete: a carta não tem opção paga para ele pesar, e sem ela o bot fica com a primeira opção
 * sem custo, que é explicar que não é hora (ou mostrar a obra, se a Paliçada já existir). Ele
 * não lê a pista nem a consequência (docs/content-v0.2.md, seção 6). A cadeia inteira é
 * percorrida em `packages/engine/src/council.chains.test.ts`.
 */
const neverOpened = ['palisadePromiseDeadline', 'palisadePromiseReckoning'];

describe('cobertura do Conselho em 50 sementes, um ano de jogo', () => {
  it('são 21 audiências por ano, nos dois ritmos', () => {
    expect(normal.runs).toBe(50);
    expect(fast.runs).toBe(50);
    expect(normal.audiences).toBe(21);
    expect(fast.audiences).toBe(21);
  });

  it('nenhuma audiência com lugar na mesa fica sem carta: o catálogo tem assunto o ano inteiro', () => {
    expect(normal.blanks).toEqual([]);
    expect(fast.blanks).toEqual([]);
    expect(normal.perRun.blank).toEqual({ min: 0, max: 0 });
    expect(fast.perRun.blank).toEqual({ min: 0, max: 0 });
  });

  it('no ritmo Normal quem passa duas vezes por dia vê quase todas as audiências', () => {
    // As visitas são a cada 6 dias de jogo e as audiências, a cada 4: a mesa quase nunca enche.
    expect(normal.perRun.cards.min).toBeGreaterThanOrEqual(18);
    expect(normal.perRun.blocked.max).toBeLessThanOrEqual(4);
    expect(normal.perRun.models.min).toBeGreaterThanOrEqual(12);
    // O bot responde a tudo o que encontra: só expira o que ficou na mesa entre duas visitas
    // por mais de 24 h reais, e isso não acontece com duas visitas por dia.
    expect(normal.perRun.expired).toEqual({ min: 0, max: 0 });
  });

  it('no ritmo Rápido a mesa enche entre as visitas, e o ano traz menos cartas', () => {
    // As visitas são a cada 18 dias de jogo: quatro audiências e meia para dois lugares.
    expect(fast.perRun.cards.max).toBeLessThan(normal.perRun.cards.min);
    expect(fast.perRun.cards.min).toBeGreaterThanOrEqual(8);
    expect(fast.perRun.blocked.min).toBeGreaterThanOrEqual(8);
    expect(fast.perRun.expired).toEqual({ min: 0, max: 0 });
  });

  it('toda estação tira cartas, e de modelos diferentes entre as sementes', () => {
    for (const coverage of [normal, fast]) {
      for (const [season, row] of Object.entries(coverage.bySeason)) {
        expect(row.audiences, season).toBeGreaterThanOrEqual(3);
        expect(row.models.length, season).toBeGreaterThanOrEqual(4);
      }
    }
    // No ritmo Normal nenhuma estação passa em branco em nenhuma semente.
    for (const [season, row] of Object.entries(normal.bySeason)) {
      expect(row.drawn.min, season).toBeGreaterThanOrEqual(2);
    }
  });

  it('todas as cartas do catálogo aparecem em alguma partida, as continuações também', () => {
    for (const coverage of [normal, fast]) {
      for (const row of coverage.byCard) {
        if (neverOpened.includes(row.cardId)) {
          // No dia em que um bot aprender a prometer, estas duas passam a aparecer.
          expect(row.runs, row.cardId).toBe(0);
        } else {
          expect(row.runs, row.cardId).toBeGreaterThan(0);
        }
      }
    }
    // As que o sorteio tira saem em boa parte das sementes do ritmo Normal.
    for (const row of normal.byCard.filter((entry) => drawable.includes(entry.cardId))) {
      expect(row.runs, row.cardId).toBeGreaterThanOrEqual(15);
    }
  });

  it('as cadeias são percorridas: o bot paga a primeira carta quando tem folga, e as continuações chegam', () => {
    const runsOf = (coverage: typeof normal, cardId: string) =>
      coverage.byCard.find((row) => row.cardId === cardId)?.runs ?? 0;
    for (const [opening, middle, ending] of [
      ['commonGranaryPlanks', 'commonGranaryShare', 'commonGranaryOutcome'],
      ['thawBridgePlea', 'thawBridgeSlab', 'thawBridgeCrossing'],
    ] as const) {
      // A primeira carta sai em quase toda partida do ritmo Normal; o bot só a paga com folga
      // (sem tirar o material da próxima obra), e ainda assim abre a cadeia em mais da metade.
      expect(runsOf(normal, opening), opening).toBeGreaterThanOrEqual(45);
      expect(runsOf(normal, middle), middle).toBeGreaterThanOrEqual(25);
      // Quem abre a cadeia chega ao desfecho dentro do ano: as continuações vêm em 2 dias.
      expect(runsOf(normal, ending), ending).toBe(runsOf(normal, middle));
    }
    expect(normal.perRun.continuations.max).toBeGreaterThanOrEqual(4);
    // No ritmo Rápido a ponte sai cedo, com o feudo ainda sem folga: poucas partidas a pagam.
    // Desde os objetivos da v0.2 (V2E-T4) a folga do começo vai para a Torre de Vigia e para o
    // primeiro depósito, que o objetivo pede: a cadeia do Celeiro Comum é aberta em 19 das 50
    // sementes (eram 20 ou mais).
    expect(runsOf(fast, 'thawBridgeSlab')).toBeGreaterThan(0);
    expect(runsOf(fast, 'commonGranaryShare')).toBeGreaterThanOrEqual(15);
  });

  it('o relatório sai em tabelas, com uma linha por carta', () => {
    const text = formatCoverage('Ritmo Normal', normal);
    expect(text).toContain('| Audiências sem carta por falta de assunto | 0 |');
    expect(text.split('\n').filter((line) => line.startsWith('| ')).length).toBeGreaterThan(
      councilCards.length + 10,
    );
    for (const card of councilCards) {
      expect(text).toContain(`| ${card.title} |`);
    }
  });
});
