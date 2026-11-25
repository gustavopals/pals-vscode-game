import { describe, expect, it } from 'vitest';

import weekV44 from './__golden__/scenario-7-days.json';
import weekV45 from './__fixtures__/state-v45-week-scripted.json';

import { HOUR, MINUTE, NO_TAVERN, runWeekScenario as runScenario } from './test-helpers';
import { hexDistance } from './hexmap';
import { CURRENT_SCHEMA_VERSION } from './migrations';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;

describe('cenário golden de 7 dias', () => {
  it('estado a cada 24 h, ordens e eventos idênticos ao golden', () => {
    const { orders, days, events } = runScenario();
    expect(days.every(({ state }) => state.schemaVersion === CURRENT_SCHEMA_VERSION)).toBe(true);
    expect(days.every(({ state }) => Object.keys(state.map.expeditionUnlocks).length === 0)).toBe(
      true,
    );
    // O roteiro v44 congela inclusive os sorteios. A expectativa v45 acrescenta
    // a grade a cada dia e uma linha de Crônica a cada conclusão da Torre.
    const { radius, scenario, hexes } = weekV45.map;
    const revelations = [
      {
        atMs: 25 * HOUR + 12 * MINUTE,
        level: 1,
        count: 24,
        text: 'No 13º dia da Primavera, a Torre de Vigia avistou novas terras.',
      },
      {
        atMs: 96 * HOUR + 18 * MINUTE,
        level: 2,
        count: 30,
        text: 'No 1º dia do Outono, a Torre de Vigia avistou novas terras.',
      },
    ].map(({ atMs, level, count, text }) => ({
      type: 'mapRevealed',
      atMs,
      text,
      data: { source: 'watchtower', level, count },
    }));
    const eventsWithMap = weekV44.events.flatMap((event) => {
      const revealed = revelations.find(({ atMs }) => atMs === event.atMs);
      return revealed && event.data.building === 'watchtower' ? [event, revealed] : [event];
    });
    expect({ orders, days, events }).toEqual({
      ...weekV44,
      events: eventsWithMap,
      days: weekV44.days.map((day) => {
        const seen = revelations.filter(({ atMs }) => atMs <= day.state.lastProcessedAt);
        const sightedRadius = 3 + seen.length;
        const dayHexes = Object.fromEntries(
          Object.entries(hexes).map(([key, hex]) => {
            const [q, r] = key.split(',').map(Number);
            return [key, hexDistance(q!, r!) <= sightedRadius ? hex : { ...hex, fog: 'unknown' }];
          }),
        );
        return {
          ...day,
          eventsSoFar: day.eventsSoFar + seen.length,
          state: {
            ...day.state,
            schemaVersion: 46,
            ids: { ...day.state.ids, outpost: 0 },
            map: { ...day.state.map, outposts: [], radius, scenario, hexes: dayHexes },
          },
        };
      }),
    });
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
      'craftMastered',
      'seasonChanged',
      'yearStarted',
      'settlementRenamed',
      'cardDrawn',
      'cardAnswered',
      'cardExpired',
      'cardEffectApplied',
      'buildingFounded',
      'mapRevealed',
      'threatRose',
      'wolvesHowl',
      'raidAnnounced',
      'raidSuffered',
      'raidRepelled',
      'villagerInjured',
      'villagerRecovered',
      'heroJoined',
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
    // O Acampamento soma desde o verão (+2 por dia), além dos +3 do outono; a Fortaleza surge no
    // outono e não soma até o Cerco (resposta do autor de 2026-10-27). As marcas e suas frases
    // abaixo congelam o roteiro do estado 35 (balance-v0.4.md, seção 16).
    expect(
      events
        .filter((event) => event.type === 'threatRose')
        .map((event) => [event.atMs / HOUR, event.data.mark, event.text]),
    ).toEqual([
      [
        68.0,
        40,
        'No 11º dia do Verão, os vigias de Pedra Alta do Norte contam mais uivos a cada noite. A Ameaça chegou a 40.',
      ],
      [
        86.0,
        40,
        'No 20º dia do Verão, os vigias de Pedra Alta do Norte tornam a ouvir uivos: os lobos voltaram. A Ameaça chegou a 41.',
      ],
      [
        100.0,
        70,
        'No 3º dia do Outono, os vigias de Pedra Alta do Norte já não dormem: há olhos acesos na orla da mata. A Ameaça chegou a 75.',
      ],
      [
        110.0,
        70,
        'No 8º dia do Outono, os vigias de Pedra Alta do Norte tornam a ver olhos acesos na orla da mata. A Ameaça chegou a 72.',
      ],
      [
        124.0,
        70,
        'No 15º dia do Outono, os vigias de Pedra Alta do Norte tornam a ver olhos acesos na orla da mata. A Ameaça chegou a 72.',
      ],
      [
        134.0,
        70,
        'No 20º dia do Outono, os vigias de Pedra Alta do Norte tornam a ver olhos acesos na orla da mata. A Ameaça chegou a 72.',
      ],
      [
        144.0,
        70,
        'No 1º dia do Inverno, os vigias de Pedra Alta do Norte tornam a ver olhos acesos na orla da mata. A Ameaça chegou a 72.',
      ],
      [
        162.0,
        70,
        'No 10º dia do Inverno, os vigias de Pedra Alta do Norte tornam a ver olhos acesos na orla da mata. A Ameaça chegou a 73.',
      ],
      [
        164.0,
        40,
        'No 11º dia do Inverno, os vigias de Pedra Alta do Norte tornam a ouvir uivos: os lobos voltaram. A Ameaça chegou a 42.',
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
    expect(state.settlement.buildings.watchtower).toBe(2);
    // Os lobos (GDD §8.2). Os uivos às 18 h, sem vigia nenhum. A incursão do roteiro às 30 h,
    // leve, já com a Torre: os vigias avisam uma hora antes, e sem Paliçada ela custa 10% da
    // comida e da madeira e um ferido. Depois a Ameaça leva um verão inteiro para voltar aos 40,
    // e as que ela sorteia no outono recuam diante da Paliçada, já no nível 2 desde as 97 h 30
    // (na junção, seis repelidas; a primeira do outono é média e o ensaio chega na Vigília,
    // às 140 h; balance-v0.4.md, seção 16). A da Torre Nv2 recém-erguida (96 h 18) é avistada no mesmo instante,
    // com o tamanho; as outras, duas horas antes.
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
      [18.0, 'wolvesHowl', null, null, null],
      [30.0, 'raidSuffered', 'light', 0, 1],
      [48.0, 'raidSuffered', 'light', 0, 0],
      [72.0, 'raidSuffered', 'light', 0, 0],
      [108.0, 'raidRepelled', 'medium', 2, null],
      [122.0, 'raidRepelled', 'strong', 2, null],
      [130.0, 'raidRepelled', 'medium', 2, null],
      [140.0, 'raidRepelled', 'strong', 2, null],
      [152.0, 'raidRepelled', 'medium', 2, null],
      [162.0, 'raidRepelled', 'light', 2, null],
    ]);
    // Cada uma foi anunciada pelos vigias, com a antecedência do nível da Torre daquela hora.
    const announced = events.filter((event) => event.type === 'raidAnnounced');
    expect(announced.map((event) => [event.atMs / HOUR, event.data.warning])).toEqual([
      [29.0, 'warned'],
      [47.0, 'warned'],
      [71.0, 'warned'],
      [106.0, 'sized'],
      [120.0, 'sized'],
      [128.0, 'sized'],
      [138.0, 'sized'],
      [150.0, 'sized'],
      [160.0, 'sized'],
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
    // Na Vigília, a forte do 23º dia do Outono é segura pela Paliçada Nv2 (D-35; seção 16).
    expect(told(140)).toBe(
      'No 23º dia do Outono, tropas da Horda chegaram a Pedra Alta do Norte: uma hoste de guerra, como os vigias contaram. A defesa resistiu: nada se perdeu e ninguém se feriu.',
    );
    // O ferido do roteiro estava sem ofício: fica de cama um dia de jogo e sara.
    const hurt = events.filter((event) => event.type === 'villagerInjured');
    const healed = events.filter((event) => event.type === 'villagerRecovered');
    // As incursões-batalha do roteiro (25º e 37º dias) chegam antes da Paliçada e não ferem
    // ninguém (resposta do autor à D-39; antes, um ferido às 48 h e dois às 72 h).
    expect(hurt.map((event) => [event.atMs / HOUR, event.data.building ?? null])).toEqual([
      [30, null],
    ]);
    expect(healed.map((event) => [event.atMs / HOUR, event.data.building ?? null])).toEqual([
      [32, null],
    ]);
    expect(state.settlement.injured).toEqual([]);
    expect(state.stats).toMatchObject({ raids_suffered: 3, raids_repelled: 6 });
    expect(state.rng.horde).toHaveLength(4);
    // A última incursão do ano já passou, e a seguinte ainda não foi sorteada.
    expect(state.horde.scheduledRaids).toEqual([]);
    // Junção da Vigília e da Fortaleza sem Ameaça: balance-v0.4.md, seção 16.
    expect(state.map.threat).toBe(50);
    const lastView = deriveViewState(state, state.lastProcessedAt).threat;
    expect(lastView).toMatchObject({
      known: true,
      level: 50,
      risePerDay: 4,
      raidChancePercent: 14,
      incoming: null,
    });
    // A moral: a fome a derruba a "inquieto" e ela se refaz quando o senhor volta à Fazenda; no
    // inverno, o frio a derruba de novo e ela volta. Com o Armazém guardando 1.000 de madeira, a
    // lenha dura até o fim do 8º dia do inverno (159 h 48 min): a virada das 160 h ainda pega o
    // frio, que acaba às 163 h, com os lenhadores de volta. Os lobos não pesam: a única incursão
    // sofrida é a do roteiro, com o povo contente (até a V4E-T2.4: agora sofre também as do 25º e do 37º dia, e um aldeão deserta às 98 h). Fora isso ninguém deserta (o golden da fome longa, com
    // gente que parte, é o retrato `famine`, e a regra está em `morale.test.ts` e
    // `famine.test.ts`).
    const bands = events
      .filter((event) => event.type === 'moraleBandChanged')
      .map((event) => [event.atMs / HOUR, event.data.band]);
    // Desde a V4E-T2.4 as incursões-batalha do 25º e do 37º dia (antes da Paliçada) pesam: a
    // moral cai às 74 h e às 86 h (às 84 h até a D-39, quando elas ainda feriam), e a fome leva
    // um aldeão às 98 h (às 96 h até a D-39).
    // V4H-T2: novo sorteio do lote 3, conferido no golden.
    expect(bands).toEqual([
      [74, 'restless'],
      [78, 'content'],
      [86, 'restless'],
      [92, 'desperate'],
      [98, 'content'],
      [162, 'restless'],
      [164, 'content'],
    ]);
    const cold = events
      .filter((event) => event.type === 'coldStarted' || event.type === 'coldEnded')
      .map((event) => [event.type, Math.floor(event.atMs / HOUR)]);
    // Com as incursões-batalha e o lote 3 no sorteio, o frio abre às 160 h.
    expect(cold).toEqual([
      ['coldStarted', 160],
      ['coldEnded', 163],
    ]);
    expect(
      events.filter((event) => event.type === 'villagerDeserted').map((event) => event.atMs / HOUR),
    ).toEqual([98]);
    // V4H-T2: com o sorteio do lote 3, a semana acaba em 60 de moral.
    expect(state.settlement.morale).toBe(60);
    // O Conselho, de ponta a ponta, com as cartas do jogo. A primeira audiência é no 5º dia de
    // jogo (8 h). "A Ponte do Degelo" inteira: as vigas cedidas, a laje dois dias de jogo depois
    // da escolha, os pilares de pedra (o que eles escondiam aparece na 4ª virada: a carroça
    // carregada), e a passagem aberta com festa. A "Estrangeira ferida", a roteirizada do 13º
    // dia (24 h): naquela audiência e na seguinte a mesa está cheia (a vigília e o pedido da
    // ponte; a vigília e a laje), e ela espera, sem se perder, até a do 21º dia (40 h), em que
    // toma o lugar do sorteio; a continuação da ponte chega junto, no lugar que tinha reservado.
    // O senhor a acolhe na visita das 48 h, e Edda entra para o feudo. "A Promessa da Paliçada"
    // pelo caminho mais curto: quando os aldeões pedem a cerca (96 h) ela já está de pé desde
    // as 76 h, e o senhor a mostra (108 h). "O Celeiro Comum" inteira, com o Celeiro já erguido:
    // as tábuas, a vez de repartir e o desfecho. O poço fica para depois, e o que ele escondia
    // aparece duas viradas adiante. Quatro cartas ficam sem resposta e expiram 24 h reais depois
    // de chegar, sem custo nenhum. A vigília abre a semana, e os viajantes chegam no outono.
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
      [40, 'cardDrawn', 'woundedStranger', undefined],
      [40, 'cardDrawn', 'thawBridgeCrossing', undefined],
      [44, 'cardEffectApplied', 'thawBridgeSlab', 'piers'],
      [48, 'cardAnswered', 'woundedStranger', 'shelter'],
      [48, 'cardAnswered', 'thawBridgeCrossing', 'feast'],
      [56, 'cardDrawn', 'itinerantMerchant', undefined],
      [64, 'cardDrawn', 'fullGranary', undefined],
      [80, 'cardExpired', 'itinerantMerchant', 'wait'],
      [88, 'cardDrawn', 'moreMouths', undefined],
      [88, 'cardExpired', 'fullGranary', 'keep'],
      [96, 'cardDrawn', 'northernCrows', undefined],
      [108, 'cardAnswered', 'moreMouths', 'close'],
      [112, 'cardDrawn', 'harvestFeast', undefined],
      [120, 'cardExpired', 'northernCrows', 'ignore'],
      [128, 'cardDrawn', 'commonGranaryPlanks', undefined],
      [132, 'cardAnswered', 'commonGranaryPlanks', 'cede'],
      [136, 'cardExpired', 'harvestFeast', 'store'],
      [136, 'cardDrawn', 'commonGranaryShare', undefined],
      [144, 'cardDrawn', 'hordeDeserter', undefined],
      [144, 'cardAnswered', 'commonGranaryShare', 'reserve'],
      [148, 'cardDrawn', 'commonGranaryOutcome', undefined],
      [150, 'cardAnswered', 'commonGranaryOutcome', 'leave'],
      [152, 'cardDrawn', 'firstRecruit', undefined],
      [168, 'cardExpired', 'hordeDeserter', 'expel'],
    ]);
    // Cada continuação leva a escolha que a trouxe: é o que liga as linhas na Crônica.
    const continuations = cards.filter((event) => event.data.source === 'continuation');
    expect(
      continuations.map((event) => [event.data.previousInstanceId, event.data.previousOptionId]),
    ).toEqual([
      ['thawBridgePlea-2', 'timber'],
      ['thawBridgeSlab-3', 'piers'],
      ['commonGranaryPlanks-11', 'cede'],
      ['commonGranaryShare-12', 'reserve'],
    ]);
    // A estrangeira (GDD §9.1; ADR 0017, decisão 6): a carta chega pelo roteiro, uma vez, e a
    // resposta dá o primeiro herói no mesmo instante, sem custo. A linha da chegada dele vem
    // logo depois da linha da carta. O soldo conta dali em diante, e o ouro do feudo o cobre até
    // o fim do ano: nenhum atraso.
    const stranger = events.filter(
      (event) => event.data.cardId === 'woundedStranger' || event.type === 'heroJoined',
    );
    expect(stranger.map((event) => [event.atMs / HOUR, event.type, event.text])).toEqual([
      [
        40,
        'cardDrawn',
        'No 21º dia da Primavera, o conselho de Pedra Alta pediu audiência: Estrangeira ferida.',
      ],
      [
        48,
        'cardAnswered',
        'No 1º dia do Verão, o senhor de Pedra Alta deu teto à estrangeira ferida. Edda jurou a espada ao feudo que a acolheu.',
      ],
      [48, 'heroJoined', 'No 1º dia do Verão, Edda, guerreira, passou a servir a Pedra Alta.'],
    ]);
    expect(stranger[0]?.data.source).toBe('scripted');
    expect(stranger[1]?.data).toMatchObject({
      optionId: 'shelter',
      hero: 'edda',
      heroAfterDays: 0,
    });
    expect(Object.keys(stranger[1]?.data ?? {}).filter((key) => key.startsWith('spent'))).toEqual(
      [],
    );
    expect(state.guild).toEqual({
      heroes: [
        {
          id: 'hero-1',
          name: 'Edda',
          gender: 'f',
          classId: 'warrior',
          level: 1,
          xp: 0,
          traits: ['loyal'],
          status: 'idle',
          injury: null,
          captivity: null,
          equipment: { weapon: null, armor: null, accessory: null },
          joinedAtMs: 48 * HOUR,
          freedAtMs: null,
          discontent: false,
        },
      ],
      arriving: [],
      wageArrears: null,
      lastWageArrears: null,
      ...NO_TAVERN,
      // O objetivo 11 (acolher o primeiro herói) paga em peça: a lança de caça vai ao arsenal.
      inventory: [{ id: 'item-1', defId: 'huntingSpear', condition: 8 }],
    });
    // Seis incursões são resolvidas só pela Paliçada (R1); restam quatro batalhas.
    expect(state.ids).toEqual({ outpost: 0, hero: 1, item: 1, battle: 4 });
    expect(state.stats['cardsDrawn:woundedStranger']).toBe(1);
    expect(events.filter((event) => event.type === 'wageArrearsStarted')).toEqual([]);
    // A Paliçada: erguida às 76 h, antes de os aldeões perguntarem por ela, e é ela que abre a
    // opção de mostrar a obra. A palavra cumprida sem promessa rende +20 de moral por três dias
    // de jogo. Com o outono chegando, o senhor a leva ao nível 2 (97 h).
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
    ).toEqual([]);
    expect(state.settlement.buildings.palisade).toBe(2);
    expect(lastView.defense).toMatchObject({
      building: 'palisade',
      palisadeLevel: 2,
      text: 'Paliçada Nv2: segura ataques leves e médios, sem perda nem ferido.',
      next: 'Muralha de Pedra Nv3: cada ala da muralha passa a ter 200 de vida (em vez de 100).',
    });
    // Com a resolução do cerco da V4G, a muralha sofreu dano de batalha.
    expect(state.settlement.wall.hp).toEqual({ left: 0, center: 0, right: 0 });
    // A continuação da ponte chegou na mesma virada da roteirizada, com lugar para as duas; e,
    // mais adiante (V4H-T2: às 136 h), a continuação do celeiro chega sozinha.
    expect(
      cards
        .filter((event) => event.type === 'cardDrawn' && event.atMs === 40 * HOUR)
        .map((event) => event.data.source),
    ).toEqual(['scripted', 'continuation']);
    expect(
      cards
        .filter((event) => event.type === 'cardDrawn' && event.atMs === 136 * HOUR)
        .map((event) => event.data.source),
    ).toEqual(['continuation']);
    expect(
      orders.filter((order) => order.type === 'answerCard').map((order) => order.result),
    ).toEqual(Array.from({ length: 8 }, () => 'accepted'));
    // Quem não respondeu não perdeu nada: nenhuma expiração tirou recurso nem moral.
    for (const expired of cards.filter((event) => event.type === 'cardExpired')) {
      expect(
        Object.keys(expired.data).filter(
          (key) =>
            key.startsWith('spent') ||
            key.startsWith('lost') ||
            (key === 'morale' && Number(expired.data[key]) < 0),
        ),
      ).toEqual([]);
    }
    expect(state.rng.council).toHaveLength(4);
    // O que as cadeias deixaram: a ponte de pedra, a promessa cumprida, a colheita com as
    // famílias, e a vez da última recorrente que saiu da mesa.
    expect(state.council.flags).toEqual({
      'thawBridge.piers': true,
      'commonGranary.gifted': true,
      'routine.moreMouths': true,
      // V4H-T1: o mercador itinerante, que o conselho deixou seguir viagem sem o senhor.
      'itinerant.heardOfMarket': true,
    });
    // A virada do ano zerou a lista das cartas vistas, e a audiência dela já trouxe a primeira
    // carta do ano novo (V4H-T1: as tábuas para as reservas, que o ano anterior já tinha visto).
    // A estrangeira não volta: é uma vez por partida.
    expect(state.council.seenThisYear).toEqual([]);
    // E "O primeiro recruta" (às 152 h, com o Salão no nível 4) ainda espera na mesa.
    expect(state.council.pending.map((entry) => entry.cardId)).toEqual(['firstRecruit']);
    expect(state.stats).toMatchObject({ cardsDrawn: 15, cardsAnswered: 8, cardsExpired: 6 });
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
      // A estrangeira chega às 48 h, e o objetivo 11 se cumpre com ela.
      [48 * 60, 'welcomeFirstHero'],
      [76 * 60 + 20, 'buildPalisade'],
    ]);
    expect(state.objectives.active).toEqual([
      'surviveWinterWithoutCold',
      'buildGuild',
      'sendPatrol',
    ]);
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
