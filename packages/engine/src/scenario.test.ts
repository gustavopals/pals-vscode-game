import { describe, expect, it } from 'vitest';

import { HOUR, runWeekScenario as runScenario } from './test-helpers';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;

describe('cenário golden de 7 dias', () => {
  it('estado a cada 24 h, ordens e eventos idênticos ao golden', async () => {
    const { orders, days, events } = runScenario();
    await expect(`${JSON.stringify({ orders, days, events }, null, 1)}\n`).toMatchFileSnapshot(
      './__golden__/scenario-7-days.json',
    );
  });

  it('rodar duas vezes dá exatamente o mesmo resultado', () => {
    expect(runScenario()).toStrictEqual(runScenario());
  });

  it('o roteiro passa pelos momentos que o golden quer congelar', () => {
    const { state, events, orders } = runScenario();
    const types = new Set(events.map((event) => event.type));
    for (const type of [
      'constructionFinished',
      'constructionAutoStarted',
      'constructionCancelled',
      'recruitmentFinished',
      'objectiveCompleted',
      'famineStarted',
      'famineEnded',
      'coldStarted',
      'coldEnded',
      'moraleBandChanged',
      'villagerDeserted',
      'craftMastered',
      'seasonChanged',
      'yearStarted',
      'settlementRenamed',
      'cardDrawn',
      'cardAnswered',
      'cardExpired',
      'cardEffectApplied',
    ]) {
      expect(types).toContain(type);
    }
    expect(orders.some((order) => order.result !== 'accepted')).toBe(true);
    // As duas recusas de fila: a segunda ainda fechada e, depois de aberta, as duas ocupadas.
    const refusals = orders.map((order) => order.result);
    expect(refusals).toContain('QUEUE_LOCKED');
    expect(refusals).toContain('QUEUE_BUSY');
    // Três obras começaram sozinhas: duas quando a fila ficou livre e uma quando a madeira
    // completou o custo, sem ninguém no feudo.
    const autoStarted = events.filter((event) => event.type === 'constructionAutoStarted');
    expect(autoStarted.map((event) => event.data.building)).toEqual([
      'quarry',
      'lumberMill',
      'goldMine',
    ]);
    const ordered = new Set(orders.map((order) => (order.hour as number) * HOUR));
    expect(autoStarted.filter((event) => !ordered.has(event.atMs))).toHaveLength(3);
    // Duas obras andaram ao mesmo tempo na segunda fila.
    const starts = events.filter((event) => event.type === 'constructionStarted');
    expect(
      starts.some((event, index) => starts[index + 1]?.atMs === event.atMs && event.atMs > 0),
    ).toBe(true);
    expect(orders.filter((order) => order.result === 'accepted').length).toBeGreaterThan(30);
    // A moral: a fome a derruba em duas faixas, três aldeões desertam antes de o senhor voltar
    // à Fazenda, e ela se refaz; no inverno, o frio a derruba de novo e ela volta.
    const bands = events
      .filter((event) => event.type === 'moraleBandChanged')
      .map((event) => event.data.band);
    // (As duas primeiras mudanças são do poço que o senhor deixou para depois: ver adiante.)
    expect(bands).toEqual([
      'restless',
      'content',
      'restless',
      'desperate',
      'content',
      'restless',
      'content',
    ]);
    expect(events.filter((event) => event.type === 'villagerDeserted')).toHaveLength(3);
    // Com a moral em 25 ou menos houve sorteio de partida a cada virada: o fluxo andou.
    expect(state.rng.morale).toHaveLength(4);
    expect(state.settlement.morale).toBe(60);
    // O Conselho, de ponta a ponta. A primeira audiência é no 5º dia de jogo (8 h): o poço
    // entulhado, que o senhor deixa para depois; o que a opção escondia acontece na 2ª virada
    // de dia seguinte e derruba a moral por dois dias. A refeição dos pedreiros fica sem
    // resposta e expira 24 h reais depois de chegar. Com o Celeiro erguido vem a cadeia: as
    // tábuas, a vez de repartir e o desfecho, cada continuação três dias de jogo depois da
    // escolha e ligada a ela. Na virada do ano a lista das cartas vistas zera, e as tábuas
    // voltam.
    const cards = events.filter((event) => event.type.startsWith('card'));
    expect(
      cards.map((event) => [event.atMs / HOUR, event.type, event.data.cardId, event.data.optionId]),
    ).toEqual([
      [8, 'cardDrawn', 'collapsedWell', undefined],
      [13, 'cardAnswered', 'collapsedWell', 'wait'],
      [16, 'cardDrawn', 'masonsMeal', undefined],
      [16, 'cardEffectApplied', 'collapsedWell', 'wait'],
      [40, 'cardExpired', 'masonsMeal', 'bread'],
      [56, 'cardDrawn', 'commonGranaryPlanks', undefined],
      [60, 'cardAnswered', 'commonGranaryPlanks', 'cede'],
      [66, 'cardDrawn', 'commonGranaryShare', undefined],
      [72, 'cardAnswered', 'commonGranaryShare', 'reserve'],
      [78, 'cardDrawn', 'commonGranaryOutcome', undefined],
      [84, 'cardAnswered', 'commonGranaryOutcome', 'leave'],
      [168, 'cardDrawn', 'commonGranaryPlanks', undefined],
    ]);
    const continuations = cards.filter((event) => event.data.source === 'continuation');
    expect(continuations.map((event) => event.data.previousInstanceId)).toEqual([
      'commonGranaryPlanks-3',
      'commonGranaryShare-4',
    ]);
    expect(
      orders.filter((order) => order.type === 'answerCard').map((order) => order.result),
    ).toEqual(['accepted', 'accepted', 'accepted', 'accepted']);
    expect(state.rng.council).toHaveLength(4);
    expect(state.council.flags).toEqual({ 'commonGranary.gifted': true });
    expect(state.council.seenThisYear).toEqual(['commonGranaryPlanks']);
    expect(state.stats).toMatchObject({ cardsDrawn: 6, cardsAnswered: 4, cardsExpired: 1 });
    expect(state.lastProcessedAt).toBe(7 * DAY_REAL);
    expect(state.clock.year).toBe(2);
    expect(state.objectives.active).toEqual([]);
    expect(deriveViewState(state, state.lastProcessedAt).settlement.name).toBe(
      'Pedra Alta do Norte',
    );
  });
});
