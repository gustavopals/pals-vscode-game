import { describe, expect, it } from 'vitest';

import { HOUR, MINUTE, runWeekScenario as runScenario } from './test-helpers';
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
      'wolvesHowl',
      'raidAnnounced',
      'raidSuffered',
      'raidRepelled',
      'villagerInjured',
      'villagerRecovered',
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
    // A Ameaça: sobe 5 a cada dia de jogo. A Torre de Vigia fica pronta às 25 h 12 min: os 40
    // passaram sem vigia nenhum (às 16 h) e não viram linha; os 70, às 28 h, sim. Os lobos do
    // roteiro a derrubam a 65 às 30 h, e às 32 h ela cruza os 70 de novo: a linha sai de novo,
    // com a frase da volta, e não a mesma de antes.
    // Daí em diante fica entre 90 e 100, caindo 10 a cada incursão. A Torre sobe ao nível 2 às
    // 96 h, e a ordem seguinte para ela é recusada.
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
      [
        32,
        70,
        'No 17º dia da Primavera, os vigias de Pedra Alta tornam a ver olhos acesos na orla da mata. A Ameaça chegou a 70.',
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
    expect(state.settlement.buildings.watchtower).toBe(2);
    // Os lobos (GDD §8.2). Os uivos às 18 h, sem vigia nenhum. A incursão do roteiro às 30 h,
    // leve, já com a Torre: os vigias avisam uma hora antes, e sem Paliçada ela custa 10% da
    // comida e da madeira e um ferido. Depois, as da Ameaça, todas médias (ela passa dos 60):
    // cinco sem defesa (15% e dois feridos cada), duas contra a Paliçada no nível 1 (metade, um
    // ferido) e, com a Paliçada no nível 2 desde as 97 h 30, nove repelidas até o fim do ano. Do
    // nível 2 da Torre em diante o alarme soa duas horas antes e diz o tamanho.
    const raidStory = events
      .filter((event) => /^(wolvesHowl|raidSuffered|raidRepelled)$/.test(event.type))
      .map((event) => [
        event.atMs / HOUR,
        event.type,
        event.data.size ?? null,
        event.data.palisadeLevel ?? null,
        event.data.injured ?? null,
      ]);
    expect(raidStory).toEqual([
      [18, 'wolvesHowl', null, null, null],
      [30, 'raidSuffered', 'light', 0, 1],
      [38, 'raidSuffered', 'medium', 0, 2],
      [46, 'raidSuffered', 'medium', 0, 2],
      [56, 'raidSuffered', 'medium', 0, 2],
      [64, 'raidSuffered', 'medium', 0, 2],
      [72, 'raidSuffered', 'medium', 0, 2],
      [84, 'raidSuffered', 'medium', 1, 1],
      [94, 'raidSuffered', 'medium', 1, 1],
      [102, 'raidRepelled', 'medium', 2, null],
      [110, 'raidRepelled', 'medium', 2, null],
      [118, 'raidRepelled', 'medium', 2, null],
      [126, 'raidRepelled', 'medium', 2, null],
      [134, 'raidRepelled', 'medium', 2, null],
      [142, 'raidRepelled', 'medium', 2, null],
      [150, 'raidRepelled', 'medium', 2, null],
      [160, 'raidRepelled', 'medium', 2, null],
      [168, 'raidRepelled', 'medium', 2, null],
    ]);
    // Cada uma foi anunciada pelos vigias, com a antecedência do nível da Torre daquela hora.
    const announced = events.filter((event) => event.type === 'raidAnnounced');
    expect(announced.map((event) => [event.atMs / HOUR, event.data.warning])).toEqual([
      [29, 'warned'],
      [37, 'warned'],
      [45, 'warned'],
      [55, 'warned'],
      [63, 'warned'],
      [71, 'warned'],
      [83, 'warned'],
      [93, 'warned'],
      [100, 'sized'],
      [108, 'sized'],
      [116, 'sized'],
      [124, 'sized'],
      [132, 'sized'],
      [140, 'sized'],
      [148, 'sized'],
      [158, 'sized'],
      [166, 'sized'],
    ]);
    // Entre uma incursão e a seguinte passam ao menos quatro dias de jogo (8 h).
    const resolvedAt = raidStory.slice(1).map(([hour]) => hour as number);
    resolvedAt.slice(1).forEach((hour, index) => {
      expect(hour - (resolvedAt[index] ?? 0)).toBeGreaterThanOrEqual(8);
    });
    // As três frases de uma incursão: como chegou, o que a defesa fez e o que a teria evitado.
    const told = (hour: number) =>
      events.find(
        (event) => event.atMs === hour * HOUR && /^raid(Suffered|Repelled)$/.test(event.type),
      )?.text;
    expect(told(30)).toBe(
      'No 16º dia da Primavera, os lobos que os vigias tinham avistado chegaram a Pedra Alta. Nada os deteve: o ataque custou 30,2 de comida, 35,3 de madeira e um aldeão ferido. Uma paliçada os teria detido.',
    );
    expect(told(84)).toBe(
      'No 19º dia do Verão, os lobos que os vigias tinham avistado chegaram a Pedra Alta do Norte. A paliçada lhes quebrou o ímpeto, mas não os deteve: o ataque custou 67,5 de madeira e um aldeão ferido. Uma paliçada no nível 2 os teria detido.',
    );
    expect(told(102)).toBe(
      'No 4º dia do Outono, os lobos chegaram a Pedra Alta do Norte: uma matilha grande, como os vigias tinham contado. Recuaram diante da paliçada: nada se perdeu e ninguém se feriu.',
    );
    // Os feridos: quem estava sem ofício fica de cama; às 38 h e às 46 h, com todos no ofício,
    // um lenhador e um canteiro largam o trabalho por um dia de jogo e voltam a ele sozinhos.
    const hurt = events.filter((event) => event.type === 'villagerInjured');
    const healed = events.filter((event) => event.type === 'villagerRecovered');
    expect(hurt).toHaveLength(13);
    expect(healed).toHaveLength(13);
    expect(
      hurt
        .filter((event) => event.data.building !== undefined)
        .map((event) => [event.atMs / HOUR, event.data.building]),
    ).toEqual([
      [38, 'lumberMill'],
      [38, 'quarry'],
      [46, 'lumberMill'],
      [46, 'quarry'],
    ]);
    expect(
      healed
        .filter((event) => event.data.building !== undefined)
        .map((event) => [event.atMs / HOUR, event.data.building]),
    ).toEqual([
      [40, 'lumberMill'],
      [40, 'quarry'],
      [48, 'lumberMill'],
      [48, 'quarry'],
    ]);
    expect(state.settlement.injured).toEqual([]);
    expect(state.stats).toMatchObject({ raids_suffered: 8, raids_repelled: 9 });
    expect(state.rng.horde).toHaveLength(4);
    // A última incursão do ano chega na própria virada, e a seguinte ainda não foi sorteada.
    expect(state.horde.scheduledRaids).toEqual([]);
    expect(state.map.threat).toBe(90);
    const lastView = deriveViewState(state, state.lastProcessedAt).threat;
    expect(lastView).toMatchObject({
      known: true,
      level: 90,
      risePerDay: 5,
      raidChancePercent: 55,
      incoming: null,
    });
    // A moral: três das incursões sofridas a levam a "inquieto" por um dia ou dois (o termo de
    // −10 em cima de casas cheias ou de despensa curta); a fome a derruba em duas faixas, três
    // aldeões desertam antes de o senhor voltar à Fazenda, e ela se refaz; no inverno, o frio
    // a derruba de novo e ela volta.
    const bands = events
      .filter((event) => event.type === 'moraleBandChanged')
      .map((event) => [event.atMs / HOUR, event.data.band]);
    expect(bands).toEqual([
      [58, 'restless'],
      [62, 'content'],
      [66, 'restless'],
      [68, 'content'],
      [80, 'restless'],
      [92, 'desperate'],
      [98, 'restless'],
      [100, 'content'],
      [154, 'restless'],
      [164, 'content'],
    ]);
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
    // obra (84 h). "O Celeiro Comum" inteira, com o Celeiro já erguido: as tábuas, a vez de
    // repartir e o desfecho. Seis cartas ficam sem resposta e expiram 24 h reais depois de
    // chegar, sem custo nenhum. As recorrentes voltam: a vigília sai duas vezes no ano. O poço
    // só chega na virada do ano, e fica na mesa.
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
      [104, 'cardDrawn', 'apprenticesTable', undefined],
      [108, 'cardAnswered', 'commonGranaryPlanks', 'cede'],
      [112, 'cardDrawn', 'commonGranaryShare', undefined],
      [120, 'cardAnswered', 'commonGranaryShare', 'reserve'],
      [124, 'cardDrawn', 'commonGranaryOutcome', undefined],
      [128, 'cardExpired', 'apprenticesTable', 'watch'],
      [132, 'cardAnswered', 'commonGranaryOutcome', 'leave'],
      [136, 'cardDrawn', 'neighborsWatch', undefined],
      [144, 'cardDrawn', 'sawmillRest', undefined],
      [160, 'cardExpired', 'neighborsWatch', 'vigil'],
      [168, 'cardDrawn', 'collapsedWell', undefined],
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
      ['commonGranaryShare-12', 'reserve'],
    ]);
    // A Paliçada: erguida do zero entre a promessa e a cobrança, e é ela que abre a opção de
    // mostrar a obra. A promessa rendeu +10 de moral e a palavra cumprida, +15, cada um por
    // três dias de jogo. Depois de os lobos passarem duas vezes por ela, o senhor a leva ao
    // nível 2 (97 h): é o que a Crônica dizia que os teria detido.
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
      [
        97,
        'constructionStarted',
        'No 1º dia do Outono, os pedreiros começaram a erguer a Paliçada ao 2º nível.',
      ],
      [
        97.5,
        'constructionFinished',
        'No 1º dia do Outono, os pedreiros ergueram a Paliçada ao 2º nível.',
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
    expect(state.settlement.buildings.palisade).toBe(2);
    expect(lastView.defense).toEqual({
      building: 'palisade',
      palisadeLevel: 2,
      text: 'Paliçada Nv2: segura ataques leves e médios, sem perda nem ferido. A Muralha de Pedra chega em uma versão futura.',
      next: null,
    });
    // A continuação da ponte chegou na mesma virada de um sorteio, com lugar para os dois.
    expect(
      cards.filter((event) => event.atMs === 40 * HOUR).map((event) => event.data.source),
    ).toEqual(['draw', 'continuation']);
    expect(
      orders.filter((order) => order.type === 'answerCard').map((order) => order.result),
    ).toEqual(Array.from({ length: 9 }, () => 'accepted'));
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
    // carta do ano novo: o poço que cedeu.
    expect(state.council.seenThisYear).toEqual(['collapsedWell']);
    expect(state.council.pending.map((entry) => entry.cardId)).toEqual(['collapsedWell']);
    expect(state.stats).toMatchObject({ cardsDrawn: 16, cardsAnswered: 9, cardsExpired: 6 });
    expect(state.lastProcessedAt).toBe(7 * DAY_REAL);
    expect(state.clock.year).toBe(2);
    // Os Objetivos do Senhor: nove dos dez, cada um quando o roteiro faz o que ele pede. Com o
    // Salão no nível 2 (8 h 10 min) aparecem a Torre, a carta e o depósito. A primeira resposta
    // ao Conselho e a Pedreira marcada para começar sozinha são da visita das 24 h; a Torre
    // fica pronta às 25 h 12 min, o Armazém às 30 h 10 min e a Paliçada às 76 h 20 min. O do
    // inverno fica por cumprir: este inverno teve frio.
    expect(
      events
        .filter((event) => event.type === 'objectiveCompleted')
        .map((event) => [event.atMs / MINUTE, event.data.objective]),
    ).toEqual([
      [0, 'allocateFarmers'],
      [0, 'upgradeHousing'],
      [48, 'recruitVillagers'],
      [8 * 60 + 10, 'townHallLevel2'],
      [24 * 60, 'answerFirstCard'],
      [24 * 60, 'planAutoStart'],
      [25 * 60 + 12, 'buildWatchtower'],
      [30 * 60 + 10, 'buildGranaryOrWarehouse'],
      [76 * 60 + 20, 'buildPalisade'],
    ]);
    expect(state.objectives.active).toEqual(['surviveWinterWithoutCold']);
    expect(state.stats['seasonsSurvived:winter']).toBeUndefined();
    expect(state.stats).toMatchObject({
      'seasonsSurvived:summer': 1,
      'seasonsSurvived:autumn': 1,
      coldSpellsThisSeason: 0,
    });
    expect(deriveViewState(state, state.lastProcessedAt).settlement.name).toBe(
      'Pedra Alta do Norte',
    );
  });
});
