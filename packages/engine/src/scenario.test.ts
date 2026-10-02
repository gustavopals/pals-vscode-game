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
      'buildingFounded',
      'threatRose',
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
    // A Ameaça: sobe 5 a cada dia de jogo e chega ao máximo às 40 h. A Torre de Vigia fica
    // pronta às 25 h 12 min: os 40 passaram sem vigia nenhum (às 16 h) e não viram linha; os 70,
    // às 28 h, sim. A Torre sobe ao nível 2 às 96 h, e a ordem seguinte para ela é recusada.
    expect(
      events
        .filter((event) => event.type === 'threatRose')
        .map((event) => [event.atMs / HOUR, event.data.mark, event.text]),
    ).toEqual([
      [
        28,
        70,
        'No 15º dia da Primavera, os vigias de Pedra Alta já não dormem: há olhos acesos na orla da mata. A Ameaça chegou a 70.',
      ],
    ]);
    expect(
      events
        .filter((event) => event.data.building === 'watchtower')
        .map((event) => [event.type, event.data.level]),
    ).toEqual([
      ['constructionStarted', 1],
      ['buildingFounded', 1],
      ['constructionStarted', 2],
      ['constructionFinished', 2],
    ]);
    expect(refusals).toContain('MAX_LEVEL');
    expect(state.map.threat).toBe(100);
    expect(state.settlement.buildings.watchtower).toBe(2);
    expect(state.horde.scheduledRaids).toEqual([]);
    const lastView = deriveViewState(state, state.lastProcessedAt).threat;
    expect(lastView).toMatchObject({ known: true, level: 100, risePerDay: 0, incoming: null });
    // A moral: a fome a derruba em duas faixas, três aldeões desertam antes de o senhor voltar
    // à Fazenda, e ela se refaz; no inverno, o frio a derruba de novo e ela volta.
    const bands = events
      .filter((event) => event.type === 'moraleBandChanged')
      .map((event) => event.data.band);
    expect(bands).toEqual(['restless', 'desperate', 'content', 'restless', 'content']);
    expect(events.filter((event) => event.type === 'villagerDeserted')).toHaveLength(3);
    // Com a moral em 25 ou menos houve sorteio de partida a cada virada: o fluxo andou.
    expect(state.rng.morale).toHaveLength(4);
    expect(state.settlement.morale).toBe(60);
    // O Conselho, de ponta a ponta, com as cartas do jogo. A primeira audiência é no 5º dia de
    // jogo (8 h). "A Ponte do Degelo" inteira: as vigas cedidas, a laje dois dias de jogo depois
    // da escolha, os pilares de pedra (o que eles escondiam aparece na 4ª virada: a carroça
    // carregada), e a passagem aberta com festa. "A Promessa da Paliçada" inteira, pelo caminho
    // de quem cumpre: com o Salão no nível 3 os aldeões pedem a cerca (64 h), o senhor promete
    // (72 h), ergue a Paliçada (76 h), é cobrado quatro dias de jogo depois (80 h) e mostra a
    // obra (84 h). O poço, que o senhor deixa para depois, com o efeito escondido dele. "O
    // Celeiro Comum" inteira, com o Celeiro já erguido: as tábuas, a vez de repartir e o
    // desfecho. Seis cartas ficam sem resposta e expiram 24 h reais depois de chegar, sem custo
    // nenhum. As recorrentes voltam: a vigília sai duas vezes no ano.
    const cards = events.filter((event) => event.type.startsWith('card'));
    expect(
      cards.map((event) => [event.atMs / HOUR, event.type, event.data.cardId, event.data.optionId]),
    ).toEqual([
      [8, 'cardDrawn', 'neighborsWatch', undefined],
      [16, 'cardDrawn', 'thawBridgePlea', undefined],
      [24, 'cardAnswered', 'thawBridgePlea', 'timber'],
      [28, 'cardDrawn', 'thawBridgeSlab', undefined],
      [32, 'cardExpired', 'neighborsWatch', 'vigil'],
      [36, 'cardAnswered', 'thawBridgeSlab', 'piers'],
      [40, 'cardDrawn', 'springSeeds', undefined],
      [40, 'cardDrawn', 'thawBridgeCrossing', undefined],
      [44, 'cardEffectApplied', 'thawBridgeSlab', 'piers'],
      [48, 'cardAnswered', 'thawBridgeCrossing', 'feast'],
      [56, 'cardDrawn', 'moreMouths', undefined],
      [60, 'cardAnswered', 'moreMouths', 'close'],
      [64, 'cardDrawn', 'palisadePromisePlea', undefined],
      [64, 'cardExpired', 'springSeeds', 'fallow'],
      [72, 'cardDrawn', 'fullGranary', undefined],
      [72, 'cardAnswered', 'palisadePromisePlea', 'promise'],
      [80, 'cardDrawn', 'palisadePromiseDeadline', undefined],
      [84, 'cardAnswered', 'palisadePromiseDeadline', 'show'],
      [88, 'cardDrawn', 'commonGranaryPlanks', undefined],
      [96, 'cardExpired', 'fullGranary', 'keep'],
      [104, 'cardDrawn', 'collapsedWell', undefined],
      [108, 'cardAnswered', 'commonGranaryPlanks', 'cede'],
      [108, 'cardAnswered', 'collapsedWell', 'wait'],
      [112, 'cardDrawn', 'neighborsWatch', undefined],
      [112, 'cardEffectApplied', 'collapsedWell', 'wait'],
      [112, 'cardDrawn', 'commonGranaryShare', undefined],
      [120, 'cardAnswered', 'commonGranaryShare', 'reserve'],
      [124, 'cardDrawn', 'commonGranaryOutcome', undefined],
      [132, 'cardAnswered', 'commonGranaryOutcome', 'leave'],
      [136, 'cardDrawn', 'masonsMeal', undefined],
      [136, 'cardExpired', 'neighborsWatch', 'vigil'],
      [144, 'cardDrawn', 'sawmillRest', undefined],
      [160, 'cardExpired', 'masonsMeal', 'bread'],
      [168, 'cardDrawn', 'springNews', undefined],
      [168, 'cardExpired', 'sawmillRest', 'keep'],
    ]);
    // Cada continuação leva a escolha que a trouxe: é o que liga as linhas na Crônica.
    const continuations = cards.filter((event) => event.data.source === 'continuation');
    expect(
      continuations.map((event) => [event.data.previousInstanceId, event.data.previousOptionId]),
    ).toEqual([
      ['thawBridgePlea-2', 'timber'],
      ['thawBridgeSlab-3', 'piers'],
      ['palisadePromisePlea-7', 'promise'],
      ['commonGranaryPlanks-10', 'cede'],
      ['commonGranaryShare-13', 'reserve'],
    ]);
    // A Paliçada: erguida do zero entre a promessa e a cobrança, e é ela que abre a opção de
    // mostrar a obra. A promessa rendeu +10 de moral e a palavra cumprida, +15, cada um por
    // três dias de jogo. Nada marca incursões ainda: a visão só diz o que ela seguraria.
    expect(
      events
        .filter((event) => event.data.building === 'palisade')
        .map((event) => [event.atMs / HOUR, event.type, event.text]),
    ).toEqual([
      [
        76,
        'constructionStarted',
        'No 15º dia do Verão, os pedreiros começaram a levantar a Paliçada em Pedra Alta do Norte.',
      ],
      [
        76 + 20 / 60,
        'buildingFounded',
        'No 15º dia do Verão, ergueu-se a Paliçada em Pedra Alta do Norte.',
      ],
    ]);
    expect(
      cards
        .filter((event) => String(event.data.cardId).startsWith('palisadePromise'))
        .map((event) => [event.type, event.data.morale, event.text]),
    ).toEqual([
      [
        'cardDrawn',
        undefined,
        'No 9º dia do Verão, o conselho de Pedra Alta do Norte pediu audiência: Os aldeões pedem uma cerca.',
      ],
      [
        'cardAnswered',
        10,
        'No 13º dia do Verão, o senhor de Pedra Alta do Norte prometeu aos aldeões uma paliçada em volta do feudo. Dormiu-se melhor naquela noite.',
      ],
      [
        'cardDrawn',
        undefined,
        'No 17º dia do Verão, os aldeões de Pedra Alta do Norte vieram cobrar a paliçada prometida: O prazo da paliçada.',
      ],
      [
        'cardAnswered',
        15,
        'No 19º dia do Verão, o senhor de Pedra Alta do Norte mostrou aos aldeões a paliçada que prometera. Passaram a mão nas estacas, um por um.',
      ],
    ]);
    expect(state.settlement.buildings.palisade).toBe(1);
    expect(lastView.defense).toEqual({
      building: 'palisade',
      palisadeLevel: 1,
      text: 'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
      next: 'Paliçada Nv2: passa a segurar também os ataques médios, sem perda nem ferido.',
    });
    // A continuação da ponte chegou na mesma virada de um sorteio, com lugar para os dois.
    expect(
      cards.filter((event) => event.atMs === 40 * HOUR).map((event) => event.data.source),
    ).toEqual(['draw', 'continuation']);
    expect(
      orders.filter((order) => order.type === 'answerCard').map((order) => order.result),
    ).toEqual(Array.from({ length: 10 }, () => 'accepted'));
    // Quem não respondeu não perdeu nada: nenhuma expiração tirou recurso nem moral.
    for (const expired of cards.filter((event) => event.type === 'cardExpired')) {
      expect(Object.keys(expired.data).filter((key) => /^(spent|lost|morale)/.test(key))).toEqual(
        [],
      );
    }
    expect(state.rng.council).toHaveLength(4);
    // O que as cadeias deixaram: a ponte de pedra, a promessa cumprida, a colheita com as
    // famílias, e a vez da última recorrente que passou pela mesa.
    expect(state.council.flags).toEqual({
      'thawBridge.piers': true,
      'palisadePromise.kept': true,
      'commonGranary.gifted': true,
      'routine.sawmillRest': true,
    });
    // A virada do ano zerou a lista das cartas vistas, e a audiência dela já trouxe a primeira
    // carta do ano novo: a notícia da primavera.
    expect(state.council.seenThisYear).toEqual(['springNews']);
    expect(state.council.pending.map((entry) => entry.cardId)).toEqual(['springNews']);
    expect(state.stats).toMatchObject({ cardsDrawn: 17, cardsAnswered: 10, cardsExpired: 6 });
    expect(state.lastProcessedAt).toBe(7 * DAY_REAL);
    expect(state.clock.year).toBe(2);
    expect(state.objectives.active).toEqual([]);
    expect(deriveViewState(state, state.lastProcessedAt).settlement.name).toBe(
      'Pedra Alta do Norte',
    );
  });
});
