import {
  balance,
  buildings,
  chronicleTemplates,
  coldReliefs,
  councilCards,
  craftGuilds,
  DIFFICULTY_IDS,
  enemies,
  foundingTemplates,
  idleVillager,
  injuredLoss,
  injuryTemplates,
  moraleBandTemplates,
  objectives,
  raidSizes,
  raidTemplates,
  startingTiles,
  threatMarkTemplates,
  tileTypes,
} from '@lotg/content';
import type {
  Command as EngineCommand,
  GameEvent as EngineEvent,
  RejectionCode as EngineRejectionCode,
  ViewState as EngineViewState,
} from '@lotg/engine';
import { advanceTo, applyCommand, createInitialState, deriveViewState } from '@lotg/engine';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  API_ERROR_CODES,
  API_ERROR_STATUS,
  ApiErrorSchema,
  canonicalJson,
  CatalogResponseSchema,
  CHRONICLE_HIDDEN_EVENT_TYPES,
  contentHash,
  type Command,
  CommandAcceptedSchema,
  CommandSchema,
  CreateGameRequestSchema,
  DeleteMeResponseSchema,
  EventsQuerySchema,
  GithubDevicePollRequestSchema,
  GithubDevicePollResponseSchema,
  GithubDeviceStartResponseSchema,
  ReturnReportSchema,
  type GameEvent,
  GameEventSchema,
  GameRuleErrorSchema,
  GithubAuthResponseSchema,
  PROTOCOL_VERSION,
  type RejectionCode,
  StateVersionSchema,
  type ViewState,
  ViewResponseSchema,
  ViewStateSchema,
} from './index';

const uuid = '0b2f7d0e-6f0a-4c35-9f43-6f5a0c1d2e3f';

describe('equivalência de tipos com o motor', () => {
  // Estes testes falham na checagem de tipos (`pnpm typecheck`) se um contrato divergir.
  it('Command é idêntico ao do motor', () => {
    expectTypeOf<Command>().toEqualTypeOf<EngineCommand>();
  });

  it('ViewState é idêntico ao do motor', () => {
    expectTypeOf<ViewState>().toEqualTypeOf<EngineViewState>();
  });

  it('os códigos de recusa são os do motor', () => {
    expectTypeOf<RejectionCode>().toEqualTypeOf<EngineRejectionCode>();
  });

  it('o evento da API é o do motor mais a sequência e o instante real', () => {
    expectTypeOf<Omit<GameEvent, 'seq' | 'at'>>().toEqualTypeOf<EngineEvent>();
  });
});

describe('CommandSchema', () => {
  const valid: Command[] = [
    { commandId: uuid, type: 'setWorkers', payload: { building: 'farm', count: 2 } },
    { commandId: uuid, type: 'startConstruction', payload: { building: 'townHall' } },
    { commandId: uuid, type: 'cancelConstruction', payload: { building: 'housing' } },
    { commandId: uuid, type: 'planConstruction', payload: { building: 'quarry' } },
    { commandId: uuid, type: 'planConstruction', payload: { building: 'quarry', autoStart: true } },
    {
      commandId: uuid,
      type: 'planConstruction',
      payload: { building: 'quarry', autoStart: true, targetLevel: 2 },
    },
    { commandId: uuid, type: 'unplanConstruction', payload: { building: 'quarry' } },
    { commandId: uuid, type: 'setAutoStart', payload: { building: 'quarry', autoStart: false } },
    {
      commandId: uuid,
      type: 'setAutoStart',
      payload: { building: 'quarry', autoStart: true, targetLevel: 3 },
    },
    { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 3 } },
    { commandId: uuid, type: 'renameSettlement', payload: { name: 'Vau Alto' } },
    {
      commandId: uuid,
      type: 'answerCard',
      payload: { instanceId: 'collapsedWell-3', optionId: 'repair' },
    },
  ];

  it.each(valid)('aceita $type', (command) => {
    expect(CommandSchema.parse(command)).toEqual(command);
  });

  it('deixa as faixas de regra para o motor', () => {
    // 9 aldeões é forma válida; quem recusa, com frase em português, é o motor.
    const order = { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 9 } };
    expect(CommandSchema.safeParse(order).success).toBe(true);
  });

  it.each([
    [
      'commandId que não é UUID',
      { commandId: 'abc', type: 'recruitVillagers', payload: { quantity: 1 } },
    ],
    ['tipo desconhecido', { commandId: uuid, type: 'declareWar', payload: {} }],
    [
      'edifício inexistente',
      { commandId: uuid, type: 'startConstruction', payload: { building: 'keep' } },
    ],
    [
      'trabalhadores em edifício não produtivo',
      { commandId: uuid, type: 'setWorkers', payload: { building: 'housing', count: 1 } },
    ],
    [
      'quantidade fracionária',
      { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 1.5 } },
    ],
    [
      'campo a mais no payload',
      { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 1, free: true } },
    ],
    [
      'campo a mais no comando',
      { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 1 }, at: 5 },
    ],
    ['sem payload', { commandId: uuid, type: 'recruitVillagers' }],
    [
      'marca de automática que não é booleana',
      { commandId: uuid, type: 'planConstruction', payload: { building: 'farm', autoStart: 1 } },
    ],
    [
      'nível-alvo que não é inteiro',
      {
        commandId: uuid,
        type: 'planConstruction',
        payload: { building: 'farm', targetLevel: 2.5 },
      },
    ],
    [
      'nível-alvo zero',
      {
        commandId: uuid,
        type: 'setAutoStart',
        payload: { building: 'farm', autoStart: true, targetLevel: 0 },
      },
    ],
    [
      'nível-alvo em uma ordem que não o conhece',
      { commandId: uuid, type: 'startConstruction', payload: { building: 'farm', targetLevel: 2 } },
    ],
    [
      'setAutoStart sem dizer se marca ou desmarca',
      { commandId: uuid, type: 'setAutoStart', payload: { building: 'farm' } },
    ],
    [
      'setAutoStart de um edifício inexistente',
      { commandId: uuid, type: 'setAutoStart', payload: { building: 'keep', autoStart: true } },
    ],
    [
      'resposta a uma carta sem dizer a opção',
      { commandId: uuid, type: 'answerCard', payload: { instanceId: 'collapsedWell-3' } },
    ],
    [
      'resposta a uma carta sem dizer qual',
      { commandId: uuid, type: 'answerCard', payload: { instanceId: '', optionId: 'repair' } },
    ],
    [
      'resposta com a carta que não é texto',
      { commandId: uuid, type: 'answerCard', payload: { instanceId: 3, optionId: 'repair' } },
    ],
    [
      'resposta com uma opção grande demais',
      {
        commandId: uuid,
        type: 'answerCard',
        payload: { instanceId: 'collapsedWell-3', optionId: 'x'.repeat(61) },
      },
    ],
    [
      'resposta com caractere de controle',
      {
        commandId: uuid,
        type: 'answerCard',
        payload: { instanceId: 'collapsedWell-3\u0000', optionId: 'repair' },
      },
    ],
    [
      'resposta com um campo a mais',
      {
        commandId: uuid,
        type: 'answerCard',
        payload: { instanceId: 'collapsedWell-3', optionId: 'repair', gold: 100 },
      },
    ],
  ])('recusa %s', (_, command) => {
    expect(CommandSchema.safeParse(command).success).toBe(false);
  });
});

describe('ViewStateSchema', () => {
  const settings = {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: 'lord' as const,
    timeScale: 1,
  };

  it('aceita o que o motor produz, do estado inicial a uma semana de jogo', () => {
    let state = createInitialState('pedra-alta', settings);
    expect(ViewStateSchema.safeParse(deriveViewState(state, 0)).error).toBeUndefined();
    const started = applyCommand(
      state,
      { commandId: uuid, type: 'startConstruction', payload: { building: 'farm' } },
      0,
    );
    if (started.ok) {
      state = started.state;
    }
    for (const hour of [1, 40, 168]) {
      state = advanceTo(state, hour * 3_600_000).state;
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(ViewStateSchema.safeParse(view).error).toBeUndefined();
    }
  });

  it('aceita as quatro estações, a conta da lenha e o frio, em mais de um ritmo', () => {
    // Todos na Fazenda e a madeira inteira em uma obra: o inverno chega sem lenha nenhuma.
    let state = createInitialState('pedra-alta', settings);
    for (const [type, payload] of [
      ['setWorkers', { building: 'farm', count: 5 }],
      ['startConstruction', { building: 'quarry' }],
    ] as const) {
      const result = applyCommand(state, { commandId: uuid, type, payload } as Command, 0);
      if (!result.ok) {
        throw new Error(result.message);
      }
      state = result.state;
    }
    const seen = new Set<string>();
    const events: EngineEvent[] = [];
    // Primavera, verão, outono (com a previsão da lenha), inverno (com frio) e a primavera
    // seguinte, em horas de jogo.
    for (const hour of [10, 60, 140, 150, 170]) {
      const advanced = advanceTo(state, hour * 3_600_000);
      state = advanced.state;
      events.push(...advanced.events);
      for (const timeScale of [1, 3, 0.5]) {
        const view = deriveViewState(state, state.lastProcessedAt, { timeScale });
        expect(
          ViewStateSchema.safeParse(view).error,
          `${hour} h, ritmo ${timeScale}`,
        ).toBeUndefined();
        seen.add(view.calendar.season);
        if (hour === 140) {
          expect(view.calendar.nextSeason.firewood).not.toBeNull();
        }
        if (hour === 150) {
          expect(view.winter?.cold).not.toBeNull();
        }
      }
    }
    expect([...seen].sort()).toEqual(['autumn', 'spring', 'summer', 'winter']);

    // Os eventos do frio passam pelo contrato de evento da API como os outros.
    const cold = events.filter((event) => event.type.startsWith('cold'));
    expect(cold.map((event) => event.type)).toEqual(['coldStarted', 'coldEnded']);
    for (const [index, event] of cold.entries()) {
      const sent = { ...event, seq: index + 1, at: '2026-10-01T12:00:00.000Z' };
      expect(GameEventSchema.safeParse(sent).error).toBeUndefined();
    }
  });

  it('aceita o Conselho: cartas na mesa, a resposta, a expiração e os eventos delas', () => {
    // Uma partida nova no ritmo Rápido: a primeira carta chega com 8 h de jogo, a segunda com
    // 16 h, e a mesa fica cheia. Sem resposta, expiram 72 h de jogo depois de chegar.
    let state = createInitialState('pedra-alta', { ...settings, timeScale: 3 });
    const events: EngineEvent[] = [];
    const advance = (hour: number) => {
      const advanced = advanceTo(state, hour * 3_600_000);
      state = advanced.state;
      events.push(...advanced.events);
      return deriveViewState(state, state.lastProcessedAt);
    };
    expect(advance(1)).toMatchObject({ council: { pending: [] }, pendingDecisions: [] });

    const full = advance(17);
    expect(ViewStateSchema.safeParse(full).error).toBeUndefined();
    expect(full.council.pending).toHaveLength(2);
    expect(full.council).toMatchObject({ blockedByPending: true, nextCardInSeconds: null });
    expect(full.pendingDecisions.map((entry) => entry.kind)).toEqual(['card', 'card']);
    const [first] = full.council.pending;
    expect(first?.options.length).toBeGreaterThanOrEqual(2);

    // A resposta é uma ordem como as outras, com a ocorrência e a opção que a visão mostrou.
    const order = {
      commandId: uuid,
      type: 'answerCard',
      payload: { instanceId: first?.instanceId ?? '', optionId: first?.defaultOptionId ?? '' },
    } as const;
    expect(CommandSchema.safeParse(order).error).toBeUndefined();
    const answered = applyCommand(state, order, state.lastProcessedAt);
    if (!answered.ok) {
      throw new Error(answered.message);
    }
    state = answered.state;
    events.push(...answered.events);
    // A outra fica sem resposta e expira.
    expect(ViewStateSchema.safeParse(advance(100)).error).toBeUndefined();

    const cards = events.filter((event) => event.type.startsWith('card'));
    expect(new Set(cards.map((event) => event.type))).toEqual(
      new Set(['cardDrawn', 'cardAnswered', 'cardExpired']),
    );
    for (const [index, event] of cards.entries()) {
      const sent = { ...event, seq: index + 1, at: '2026-10-01T12:00:00.000Z' };
      expect(GameEventSchema.safeParse(sent).error).toBeUndefined();
    }
  });

  it('recusa um campo a mais no Conselho e uma decisão pendente de um tipo que não existe', () => {
    const state = advanceTo(createInitialState('pedra-alta', settings), 9 * 3_600_000).state;
    const view = deriveViewState(state, state.lastProcessedAt);
    const [card] = view.council.pending;
    if (card === undefined) {
      throw new Error('O teste esperava uma carta na mesa.');
    }
    expect(ViewStateSchema.safeParse(view).error).toBeUndefined();
    const parses = (changed: object) => ViewStateSchema.safeParse({ ...view, ...changed }).success;
    // O que o servidor nunca manda: flags, o efeito escondido de uma opção, o gerador.
    expect(parses({ council: { ...view.council, flags: {} } })).toBe(false);
    const leaking = { ...card, options: card.options.map((option) => ({ ...option, hidden: {} })) };
    expect(parses({ council: { ...view.council, pending: [leaking] } })).toBe(false);
    expect(parses({ council: { ...view.council, pending: [{ ...card, cardId: 'x' }] } })).toBe(
      false,
    );
    expect(parses({ council: { ...view.council, nextAudienceInSeconds: null } })).toBe(false);
    // De onde a carta vem é um objeto fechado ou nada: nunca o id de uma flag.
    const from = { title: 'x', optionLabel: 'y', text: 'z' };
    const following = (followsFrom: unknown) =>
      parses({ council: { ...view.council, pending: [{ ...card, followsFrom }] } });
    expect(following(from)).toBe(true);
    expect(following({ ...from, flag: 'commonGranary.open' })).toBe(false);
    expect(
      parses({
        pendingDecisions: [{ kind: 'crossroads', id: 'x', title: 'y', expiresInSeconds: 1 }],
      }),
    ).toBe(false);
    expect(parses({ pendingDecisions: [] })).toBe(true);
    const without: Partial<typeof view> = { ...view };
    delete without.council;
    expect(ViewStateSchema.safeParse(without).success).toBe(false);
  });

  it('a Ameaça sem a Torre de Vigia: a forma fechada recusa qualquer coisa que a névoa esconde', () => {
    // 30 h de jogo: a Ameaça chegou a 75 na virada, e os lobos do roteiro a derrubaram a 65.
    const state = advanceTo(createInitialState('pedra-alta', settings), 30 * 3_600_000).state;
    expect(state.map.threat).toBe(65);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(ViewStateSchema.safeParse(view).error).toBeUndefined();
    expect(view.threat).toEqual({
      known: false,
      text: 'Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.',
      incoming: null,
      watchtower: view.threat.watchtower,
      defense: {
        building: 'palisade',
        palisadeLevel: 0,
        text: 'Sem Paliçada, nada segura um ataque.',
        next: 'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
      },
    });
    const parses = (threat: object) => ViewStateSchema.safeParse({ ...view, threat }).success;
    expect(parses(view.threat)).toBe(true);
    // Um servidor que mandasse o número, a tendência, as origens, os tiles ou uma incursão a
    // quem não tem Torre é recusado pelo próprio contrato.
    expect(parses({ ...view.threat, level: 75 })).toBe(false);
    expect(parses({ ...view.threat, trend: 'Sobe 5 a cada dia de jogo.' })).toBe(false);
    expect(parses({ ...view.threat, sources: [] })).toBe(false);
    expect(parses({ ...view.threat, tiles: [] })).toBe(false);
    expect(parses({ ...view.threat, nextLevel: 80 })).toBe(false);
    // Nem a chance de uma incursão, nem a regra, nem o que ela custa.
    expect(parses({ ...view.threat, raidChancePercent: 25 })).toBe(false);
    expect(parses({ ...view.threat, raidRisk: 'x' })).toBe(false);
    expect(parses({ ...view.threat, raidCosts: [] })).toBe(false);
    const incoming = {
      enemy: 'wolves',
      enemyLabel: 'Lobos',
      inSeconds: 60,
      sizeText: null,
      text: 'x',
      costText: 'x',
      defenseText: 'Sem Paliçada, nada segura este ataque.',
    };
    expect(parses({ ...view.threat, incoming })).toBe(false);
    // Nem o estado do mapa, nem as incursões marcadas, em forma nenhuma.
    expect(parses({ ...view.threat, map: state.map })).toBe(false);
    expect(parses({ ...view.threat, scheduledRaids: [] })).toBe(false);
    const without: Partial<typeof view> = { ...view };
    delete without.threat;
    expect(ViewStateSchema.safeParse(without).success).toBe(false);
    // Os eventos também não contam: nenhum fala da Ameaça a quem não tem vigias. Os uivos e a
    // incursão sofrida chegam, sem o número e sem aviso.
    const { events } = advanceTo(createInitialState('pedra-alta', settings), 30 * 3_600_000);
    expect(events.filter((event) => event.type === 'threatRose')).toEqual([]);
    expect(events.filter((event) => event.type === 'raidAnnounced')).toEqual([]);
    const wolves = events.filter((event) => /^(wolvesHowl|raid|villagerInjured)/.test(event.type));
    expect(wolves.map((event) => event.type)).toEqual([
      'wolvesHowl',
      'raidSuffered',
      'villagerInjured',
    ]);
    for (const [index, event] of wolves.entries()) {
      const sent = { ...event, seq: index + 1, at: '2026-10-02T12:00:00.000Z' };
      expect(GameEventSchema.safeParse(sent).error).toBeUndefined();
      expect(Object.keys(event.data).filter((key) => /threat/i.test(key))).toEqual([]);
    }
    // O ferido aparece na visão de quem não tem Torre: é gente do feudo, não é a Ameaça.
    expect(view.population).toMatchObject({ injured: 1, secondsToNextRecovery: 7200 });
    expect(view.population.injuredNote).toContain('1 aldeão ferido na incursão');
  });

  it('a Ameaça com a Torre de Vigia: o número, a tendência, as origens, os tiles e a incursão à vista', () => {
    // A Torre erguida à mão em um feudo no 14º dia: a virada das 28 h cruza os 70, e é também
    // o instante em que os vigias do nível 2 avistam os lobos do roteiro, que chegam às 30 h.
    const start = createInitialState('pedra-alta', settings);
    start.settlement.buildings.townHall = 2;
    start.settlement.buildings.watchtower = 2;
    const { state, events } = advanceTo(start, 28 * 3_600_000);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(ViewStateSchema.safeParse(view).error).toBeUndefined();
    expect(view.threat).toMatchObject({
      known: true,
      text: 'Ameaça 70 de 100.',
      level: 70,
      max: 100,
      risePerDay: 5,
      // A virada das 30 h sobe 5 e traz os lobos à vista, que a derrubam em 10.
      nextLevel: 65,
      nextRiseInSeconds: 7200,
      trend:
        'Sobe 5 a cada dia de jogo (2 h), e a incursão à vista a faz cair 10: na próxima virada, vai de 70 para 65.',
      sources: ['+5/dia: Covil de Lobos'],
      tiles: [{ id: 'wolfDen', label: 'Covil de Lobos', active: true }],
      raidChancePercent: 0,
      raidRisk:
        'Há uma incursão a caminho, e só há uma por vez: nenhuma outra é marcada até ela chegar. Toda incursão, repelida ou sofrida, baixa a Ameaça em 10.',
      raidCosts: [
        'Ataques leves: levam 10% do estoque de comida e madeira e ferem 1 aldeão.',
        'Ataques médios: levam 15% do estoque de comida e madeira e ferem 2 aldeões.',
        'Quem se fere fica 2 h sem trabalhar e volta ao ofício sozinho. Um ataque com perdas tira 10 da moral por 2 dias de jogo (4 h).',
      ],
      incoming: {
        enemy: 'wolves',
        enemyLabel: 'Lobos',
        inSeconds: 7200,
        sizeText: 'uma matilha pequena',
        text: 'Lobos a caminho. Os vigias contam uma matilha pequena.',
        defenseText: 'Sem Paliçada, nada segura este ataque.',
      },
    });
    const announced = events.filter((event) => event.type === 'raidAnnounced');
    expect(announced.map((event) => event.data)).toEqual([
      { raidId: 'wolvesYear1', enemy: 'wolves', warning: 'sized', size: 'light' },
    ]);
    expect(
      GameEventSchema.safeParse({ ...announced[0], seq: 9, at: '2026-10-01T12:00:00.000Z' }).error,
    ).toBeUndefined();
    const rose = events.filter((event) => event.type === 'threatRose');
    expect(rose.map((event) => event.data)).toEqual([
      { threat: 40, previousThreat: 35, mark: 40 },
      { threat: 70, previousThreat: 65, mark: 70 },
    ]);
    for (const [index, event] of rose.entries()) {
      const sent = { ...event, seq: index + 1, at: '2026-10-01T12:00:00.000Z' };
      expect(GameEventSchema.safeParse(sent).error).toBeUndefined();
    }

    const parses = (threat: object) => ViewStateSchema.safeParse({ ...view, threat }).success;
    const incoming = {
      enemy: 'wolves',
      enemyLabel: 'Lobos',
      inSeconds: 1200,
      sizeText: 'uma matilha pequena',
      text: 'Lobos a caminho. Os vigias contam uma matilha pequena.',
      costText:
        'Sem defesa, uma matilha pequena leva 10% do estoque de comida e madeira (hoje, 18 de comida e 12 de madeira) e fere 1 aldeão, que fica 40 min sem trabalhar.',
      defenseText: 'Sem Paliçada, nada segura este ataque.',
    };
    expect(parses({ ...view.threat, incoming })).toBe(true);
    expect(parses({ ...view.threat, incoming: null })).toBe(true);
    // O que a Paliçada faz à incursão e o que ela custa vêm sempre: sem uma das frases, a forma
    // é recusada.
    expect(parses({ ...view.threat, incoming: { ...incoming, defenseText: undefined } })).toBe(
      false,
    );
    expect(parses({ ...view.threat, incoming: { ...incoming, costText: undefined } })).toBe(false);
    // A regra das incursões também: a chance, a frase e o custo de cada tamanho.
    for (const field of ['raidChancePercent', 'raidRisk', 'raidCosts']) {
      const missing: Record<string, unknown> = { ...view.threat };
      delete missing[field];
      expect(parses(missing), field).toBe(false);
    }
    expect(parses({ ...view.threat, incoming: { ...incoming, sizeText: null } })).toBe(true);
    // O tamanho só sai em texto, e só quando a Torre o distingue: nunca o id.
    expect(parses({ ...view.threat, incoming: { ...incoming, size: 'light' } })).toBe(false);
    expect(parses({ ...view.threat, incoming: { ...incoming, enemy: 'raiders' } })).toBe(false);
    expect(parses({ ...view.threat, incoming: { ...incoming, atMs: 1 } })).toBe(false);
    // Com a Torre, a forma é a completa: faltar o número é erro.
    const noLevel: Record<string, unknown> = { ...view.threat };
    delete noLevel.level;
    expect(parses(noLevel)).toBe(false);
    expect(parses({ ...view.threat, known: false })).toBe(false);
    expect(
      parses({ ...view.threat, watchtower: { building: 'watchtower', level: 2, text: 'x' } }),
    ).toBe(false);
    expect(
      parses({ ...view.threat, watchtower: { ...view.threat.watchtower, building: 'tower' } }),
    ).toBe(false);
    expect(parses({ ...view.threat, defense: { palisadeLevel: 0 } })).toBe(false);
    // A defesa diz qual é o edifício e o que a próxima obra muda (`null` no teto), e mais nada:
    // a Paliçada não tem vida, dano nem reparo nesta versão.
    const { defense } = view.threat;
    expect(parses({ ...view.threat, defense: { ...defense, next: null } })).toBe(true);
    expect(parses({ ...view.threat, defense: { ...defense, building: 'stoneWall' } })).toBe(false);
    expect(parses({ ...view.threat, defense: { ...defense, next: undefined } })).toBe(false);
    expect(parses({ ...view.threat, defense: { ...defense, hp: 600 } })).toBe(false);
    expect(parses({ ...view.threat, raidChance: 30 })).toBe(false);

    // Duas horas depois os lobos chegam. Com a Paliçada, recuam; sem ela, levam uma parte do
    // estoque e ferem um aldeão, que sara um dia de jogo depois. Tudo passa pelo contrato.
    const walled = createInitialState('pedra-alta', settings);
    walled.settlement.buildings = {
      ...walled.settlement.buildings,
      townHall: 3,
      watchtower: 2,
      palisade: 1,
    };
    const stories = [advanceTo(walled, 32 * 3_600_000), advanceTo(state, 32 * 3_600_000)];
    const told = stories.flatMap((story) =>
      story.events.filter((event) => /^(raid|villager(Injured|Recovered))/.test(event.type)),
    );
    expect(told.map((event) => event.type)).toEqual([
      'raidAnnounced',
      'raidRepelled',
      'raidSuffered',
      'villagerInjured',
      'villagerRecovered',
    ]);
    for (const [index, event] of told.entries()) {
      const sent = { ...event, seq: index + 1, at: '2026-10-02T12:00:00.000Z' };
      expect(GameEventSchema.safeParse(sent).error).toBeUndefined();
      expect(CHRONICLE_HIDDEN_EVENT_TYPES).not.toContain(event.type);
    }
    // Quem tem vigias lê nos eventos a Ameaça antes e depois da incursão.
    expect(told[1]?.data).toMatchObject({ warning: 'sized', previousThreat: 75, threat: 65 });
    expect(told[2]?.data).toMatchObject({ injured: 1, palisadeLevelNeeded: 1 });
    for (const story of stories) {
      const after = deriveViewState(story.state, story.state.lastProcessedAt);
      expect(ViewStateSchema.safeParse(after).error).toBeUndefined();
    }
    // Com um ferido de cama, a visão diz quantos são, quando sara e de que edifício saiu.
    const hurt = deriveViewState(state, 30 * 3_600_000 + 600_000);
    expect(ViewStateSchema.safeParse(hurt).error).toBeUndefined();
    expect(hurt.population).toMatchObject({ injured: 1, secondsToNextRecovery: 6600 });
    const people = (population: object) =>
      ViewStateSchema.safeParse({ ...hurt, population }).success;
    expect(people({ ...hurt.population, injuredNote: null })).toBe(true);
    expect(people({ ...hurt.population, injured: undefined })).toBe(false);
    expect(people({ ...hurt.population, injuredUntilMs: 1 })).toBe(false);
    const workers = hurt.workers.map((row) => ({ ...row, injured: undefined }));
    expect(ViewStateSchema.safeParse({ ...hurt, workers }).success).toBe(false);
  });

  it('a Paliçada é um edifício como os outros nas ordens, e a visão dela passa pelo contrato em todo nível', () => {
    for (const type of ['startConstruction', 'planConstruction', 'cancelConstruction'] as const) {
      const command = { commandId: uuid, type, payload: { building: 'palisade' } };
      expect(CommandSchema.safeParse(command).success, type).toBe(true);
    }
    const fresh = deriveViewState(createInitialState('pedra-alta', settings), 0);
    expect(
      fresh.constructions.available.find((entry) => entry.building === 'palisade'),
    ).toMatchObject({
      blockedCode: 'GATE_LOCKED',
      effect:
        'Segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
    });
    for (const palisade of [0, 1, 2]) {
      for (const watchtower of [0, 1, 2]) {
        const state = createInitialState('pedra-alta', settings);
        state.settlement.buildings.townHall = 3;
        state.settlement.buildings.palisade = palisade;
        state.settlement.buildings.watchtower = watchtower;
        state.horde.scheduledRaids = [
          {
            id: 'threat-1',
            atMs: 30 * 60_000,
            kind: 'threat',
            enemy: 'wolves',
            size: 'medium',
            announcedAtMs: null,
          },
        ];
        const view = deriveViewState(state, 0);
        expect(ViewStateSchema.safeParse(view).error, `${palisade}/${watchtower}`).toBeUndefined();
        expect(view.threat.defense.palisadeLevel).toBe(palisade);
        expect(view.threat.defense.next === null).toBe(palisade === 2);
        // A frase sobre a incursão só existe com vigias; a da defesa, sempre.
        expect(view.threat.incoming === null).toBe(watchtower === 0);
        if (view.threat.incoming !== null) {
          expect(view.threat.incoming.defenseText).toMatch(/Paliçada/);
        }
      }
    }
  });

  it('a recusa do teto da Paliçada chega pelo motor, com a frase do conteúdo', () => {
    const state = createInitialState('pedra-alta', settings);
    state.settlement.buildings.townHall = 3;
    state.settlement.buildings.palisade = 2;
    const refused = applyCommand(
      state,
      { commandId: uuid, type: 'startConstruction', payload: { building: 'palisade' } },
      0,
    );
    expect(refused).toMatchObject({
      ok: false,
      code: 'MAX_LEVEL',
      message: 'A Paliçada já está no nível máximo. A Muralha de Pedra chega em uma versão futura.',
    });
  });

  it('a Torre de Vigia é um edifício como os outros nas ordens e na lista de obras', () => {
    for (const type of ['startConstruction', 'planConstruction', 'cancelConstruction'] as const) {
      const command = { commandId: uuid, type, payload: { building: 'watchtower' } };
      expect(CommandSchema.safeParse(command).success, type).toBe(true);
    }
    const view = deriveViewState(createInitialState('pedra-alta', settings), 0);
    const tower = view.constructions.available.find((entry) => entry.building === 'watchtower');
    expect(tower?.effect).toBe(
      'Mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
    );
    expect(ViewStateSchema.safeParse(view).error).toBeUndefined();
  });

  it('recusa um campo a mais na conta da lenha e no frio', () => {
    let state = createInitialState('pedra-alta', settings);
    state = advanceTo(state, 145 * 3_600_000).state;
    const view = deriveViewState(state, state.lastProcessedAt);
    if (view.winter === null) {
      throw new Error('O teste esperava o inverno.');
    }
    expect(ViewStateSchema.safeParse(view).error).toBeUndefined();
    const extra = {
      ...view,
      winter: { ...view.winter, firewood: { ...view.winter.firewood, hint: 'x' } },
    };
    expect(ViewStateSchema.safeParse(extra).success).toBe(false);
    const noText = { ...view, winter: { ...view.winter, cold: { secondsElapsed: 1 } } };
    expect(ViewStateSchema.safeParse(noText).success).toBe(false);
  });

  it('aceita o armazenamento: limite, "cheio em", desperdício, obra do depósito e devolução cortada', () => {
    // Dois lenhadores e dois fazendeiros: a madeira enche o Pátio no segundo dia real.
    let state = createInitialState('pedra-alta', { ...settings, difficulty: 'ironKing' });
    const order = (type: Command['type'], payload: unknown) => {
      const result = applyCommand(
        state,
        { commandId: uuid, type, payload } as Command,
        state.lastProcessedAt,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      state = result.state;
      return result.events;
    };
    order('setWorkers', { building: 'farm', count: 2 });
    order('setWorkers', { building: 'lumberMill', count: 2 });
    order('setWorkers', { building: 'quarry', count: 1 });
    const rising = deriveViewState(state, 0, { timeScale: 3 });
    expect(ViewStateSchema.safeParse(rising).error).toBeUndefined();
    const wood = rising.resources.find((row) => row.id === 'wood');
    // Rei de Ferro: 400. Faltam 280: os dois lenhadores, recém-chegados, rendem 8 por hora de
    // jogo no primeiro dia e 16 depois, com a experiência que sobe a cada virada e a moral que
    // a primeira virada leva a 60. A previsão conta tudo isso: 61.024.810 ms de jogo, vistos
    // no ritmo 3.
    expect(wood).toMatchObject({
      cap: 400,
      capBreakdown: '500 iniciais × 0,8 (Rei de Ferro) = 400',
      storageBuilding: 'warehouse',
      storageLabel: 'Pátio',
      full: false,
      fullInSeconds: 20_342,
      fullNote: null,
      wastingPerHour: 0,
      wastedToday: 0,
    });

    const events: EngineEvent[] = [];
    const advanced = advanceTo(state, 28 * 3_600_000);
    state = advanced.state;
    events.push(...advanced.events);
    const full = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 });
    expect(ViewStateSchema.safeParse(full).error).toBeUndefined();
    // 28 horas de jogo são 14 viradas de dia (duas horas antes de os lobos do roteiro levarem
    // parte da madeira): a Serraria tem 56 de experiência (× 1,168), a moral está em 60
    // (× 1,05), e os dois lenhadores perdem 16 × 1,168 × 1,05 por hora de jogo, 58,9 por hora
    // real.
    expect(full.resources.find((row) => row.id === 'wood')).toMatchObject({
      full: true,
      fullInSeconds: null,
      wastingPerHour: 58.9,
    });
    expect(full.resources.find((row) => row.id === 'gold')).toMatchObject({
      cap: null,
      storageBuilding: null,
      full: false,
    });

    // O Salão no nível 2 e o Armazém em obra: a devolução do cancelamento sai com o corte.
    events.push(...order('startConstruction', { building: 'townHall' }));
    const hall = advanceTo(state, 31 * 3_600_000);
    state = hall.state;
    events.push(...hall.events, ...order('startConstruction', { building: 'warehouse' }));
    const building = deriveViewState(state, state.lastProcessedAt);
    expect(ViewStateSchema.safeParse(building).error).toBeUndefined();
    expect(building.constructions.active?.refund).toEqual([
      { resource: 'wood', label: 'Madeira', amount: 128, lost: 0 },
      { resource: 'stone', label: 'Pedra', amount: 64, lost: 0 },
    ]);
    // A devolução sem o campo do que se perde não é do contrato.
    const withoutLost = { resource: 'wood', label: 'Madeira', amount: 128 };
    expect(
      ViewStateSchema.safeParse({
        ...building,
        constructions: {
          ...building.constructions,
          active: { ...building.constructions.active, refund: [withoutLost] },
        },
      }).success,
    ).toBe(false);
    const done = advanceTo(state, 40 * 3_600_000);
    events.push(...done.events);

    // Os eventos novos passam pelo contrato de evento da API, com os totais em `data`.
    const seen = new Set(events.map((event) => event.type));
    for (const type of ['storageFilled', 'storageWasted', 'buildingFounded'] as const) {
      expect(seen, type).toContain(type);
    }
    for (const [index, event] of events.entries()) {
      const sent = { ...event, seq: index + 1, at: '2026-10-01T12:00:00.000Z' };
      expect(GameEventSchema.safeParse(sent).error, event.type).toBeUndefined();
    }
    const wasted = events.find((event) => event.type === 'storageWasted');
    expect(Object.keys(wasted?.data ?? {}).every((key) => key.startsWith('wasted_'))).toBe(true);
    const started = events.find(
      (event) => event.type === 'constructionStarted' && event.data.building === 'warehouse',
    );
    expect(started?.data).toEqual({
      building: 'warehouse',
      level: 1,
      spent_wood: 160,
      spent_stone: 80,
    });
  });

  it('aceita as filas de obras e as planejadas: a fila fechada, a espera de cada uma e o início sozinho', () => {
    let state = createInitialState('pedra-alta', { ...settings, timeScale: 3 });
    const events: EngineEvent[] = [];
    const order = (type: Command['type'], payload: unknown) => {
      const result = applyCommand(
        state,
        { commandId: uuid, type, payload } as Command,
        state.lastProcessedAt,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      state = result.state;
      events.push(...result.events);
    };
    order('setWorkers', { building: 'lumberMill', count: 3 });
    order('setWorkers', { building: 'farm', count: 2 });
    order('startConstruction', { building: 'housing' });
    order('planConstruction', { building: 'quarry', autoStart: true });
    order('planConstruction', { building: 'farm' });
    const waiting = deriveViewState(state, 0);
    expect(ViewStateSchema.safeParse(waiting).error).toBeUndefined();
    expect(waiting.constructions).toMatchObject({
      queuesUnlocked: 1,
      queuesNote: 'A segunda fila abre com o Salão do Senhor Nv4.',
      queues: [{ building: 'housing' }],
    });
    expect(waiting.constructions.active).toEqual(waiting.constructions.queues[0]);
    expect(
      waiting.constructions.planned.map((entry) => [
        entry.building,
        entry.autoStart,
        entry.waiting,
      ]),
    ).toEqual([
      // 50 de madeira: os três lenhadores, recém-chegados, rendem 12 por hora de jogo no
      // primeiro dia (24 de madeira) e 25,502 depois (com 4 de experiência e a moral em 60).
      // São 10.870.301 ms de jogo, vistos no ritmo 3: 3.624 segundos reais.
      ['quarry', true, { reason: 'resources', text: 'espera 50 de madeira', etaSeconds: 3624 }],
      // A Fazenda é manual e também espera madeira: 10 a 12 por hora de jogo, 1.000 segundos reais.
      ['farm', false, { reason: 'resources', text: 'espera 10 de madeira', etaSeconds: 1000 }],
    ]);

    // A espera sem a frase, com um motivo desconhecido ou com um campo a mais não é do contrato.
    const [quarry] = waiting.constructions.planned;
    const withWaiting = (changed: unknown) => ({
      ...waiting,
      constructions: {
        ...waiting.constructions,
        planned: [{ ...quarry, waiting: changed }],
      },
    });
    expect(ViewStateSchema.safeParse(withWaiting(null)).success).toBe(true);
    for (const bad of [
      { reason: 'resources', etaSeconds: 1 },
      { reason: 'weather', text: 'espera o sol', etaSeconds: null },
      { reason: 'queue', text: 'espera', etaSeconds: null, since: 0 },
    ]) {
      expect(ViewStateSchema.safeParse(withWaiting(bad)).success).toBe(false);
    }
    const withoutMark = Object.fromEntries(
      Object.entries(quarry ?? {}).filter(([key]) => key !== 'autoStart'),
    );
    expect(
      ViewStateSchema.safeParse({
        ...waiting,
        constructions: { ...waiting.constructions, planned: [withoutMark] },
      }).success,
    ).toBe(false);

    // A obra começa sozinha, e o evento passa pelo contrato de evento da API.
    const advanced = advanceTo(state, 6 * 3_600_000);
    state = advanced.state;
    events.push(...advanced.events);
    const started = events.find((event) => event.type === 'constructionAutoStarted');
    // No instante que a visão anunciou.
    expect(started).toMatchObject({
      atMs: 10_870_301,
      data: { building: 'quarry', level: 2, spent_wood: 120, spent_gold: 30 },
    });
    for (const [index, event] of events.entries()) {
      const sent = { ...event, seq: index + 1, at: '2026-10-01T12:00:00.000Z' };
      expect(GameEventSchema.safeParse(sent).error, event.type).toBeUndefined();
    }
    expect(CHRONICLE_HIDDEN_EVENT_TYPES).not.toContain('constructionAutoStarted');
    const after = deriveViewState(state, state.lastProcessedAt);
    expect(ViewStateSchema.safeParse(after).error).toBeUndefined();
    expect(after.constructions.queues).toEqual([null]);
  });

  it('aceita os ofícios: as regras, a adaptação, a experiência e o ofício dominado', () => {
    let state = createInitialState('pedra-alta', { ...settings, timeScale: 3 });
    const order = (building: 'farm' | 'lumberMill' | 'quarry', count: number) => {
      const result = applyCommand(
        state,
        { commandId: uuid, type: 'setWorkers', payload: { building, count } },
        state.lastProcessedAt,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      state = result.state;
    };
    order('farm', 2);
    order('lumberMill', 2);
    const view = deriveViewState(state, 0);
    expect(ViewStateSchema.safeParse(view).error).toBeUndefined();
    // As regras chegam prontas, no ritmo da partida: o app não escreve número nenhum.
    expect(view.workersRules).toMatchObject({
      adaptationSeconds: 2400,
      adaptationText: 'Quem troca de ofício produz metade por 40 min.',
      experienceMax: 100,
      masteryMaxBonusPercent: 30,
    });
    expect(view.workers[1]).toMatchObject({
      building: 'lumberMill',
      assigned: 2,
      adapting: 2,
      adaptationEndsInSeconds: 2400,
      adaptingCohorts: [{ count: 2, endsInSeconds: 2400 }],
      // Por hora real, no ritmo 3: 24 de um lenhador adaptado, 12 de quem chega agora.
      perWorkerPerHour: 24,
      perNewWorkerPerHour: 12,
      grossPerHour: 24,
      experience: 0,
      masteryBonusPercent: 0,
      occupiedFrom: 1,
      experienceTrend: 'rising',
    });

    // Sem as regras, com uma tendência desconhecida ou com uma leva sem prazo, não é do contrato.
    const withoutRules = Object.fromEntries(
      Object.entries(view).filter(([key]) => key !== 'workersRules'),
    );
    expect(ViewStateSchema.safeParse(withoutRules).success).toBe(false);
    const withRow = (changed: object) => ({
      ...view,
      workers: [{ ...view.workers[0], ...changed }, ...view.workers.slice(1)],
    });
    expect(ViewStateSchema.safeParse(withRow({})).success).toBe(true);
    expect(ViewStateSchema.safeParse(withRow({ experienceTrend: 'booming' })).success).toBe(false);
    expect(ViewStateSchema.safeParse(withRow({ adaptingCohorts: [{ count: 1 }] })).success).toBe(
      false,
    );
    expect(ViewStateSchema.safeParse(withRow({ adaptationEndsInSeconds: null })).success).toBe(
      true,
    );
    expect(ViewStateSchema.safeParse(withRow({ posts: 4 })).success).toBe(false);

    // 25 dias de jogo depois, os dois ofícios ocupados chegam ao máximo: o evento passa pelo
    // contrato da API e é linha da Crônica.
    const advanced = advanceTo(state, 25 * 2 * 3_600_000);
    const mastered = advanced.events.filter((event) => event.type === 'craftMastered');
    expect(mastered.map((event) => event.data)).toEqual([
      { building: 'farm', experience: 100 },
      { building: 'lumberMill', experience: 100 },
    ]);
    for (const [index, event] of mastered.entries()) {
      const sent = { ...event, seq: index + 1, at: '2026-10-01T12:00:00.000Z' };
      expect(GameEventSchema.safeParse(sent).error).toBeUndefined();
    }
    expect(CHRONICLE_HIDDEN_EVENT_TYPES).not.toContain('craftMastered');
    const after = deriveViewState(advanced.state, advanced.state.lastProcessedAt);
    expect(ViewStateSchema.safeParse(after).error).toBeUndefined();
    expect(after.workers[1]).toMatchObject({
      experience: 100,
      masteryBonusPercent: 30,
      adapting: 0,
      adaptationEndsInSeconds: null,
      experienceTrend: 'steady',
    });
  });

  it('aceita a moral: a conta termo a termo, a próxima virada, a dica e quem chega e parte', () => {
    const start = createInitialState('pedra-alta', { ...settings, timeScale: 3 });
    const view = deriveViewState(start, 0);
    expect(ViewStateSchema.safeParse(view).error).toBeUndefined();
    // No ritmo 3 a virada do dia é em 40 min reais e a reserva de 24 h de jogo são 8 h.
    expect(view.morale).toMatchObject({
      value: 50,
      band: 'content',
      bandLabel: 'Contente',
      multiplierPercent: 100,
      nextUpdateInSeconds: 2400,
      terms: [
        { id: 'base', label: 'Base', amount: 50 },
        { id: 'foodReserve', label: 'Comida guardada para 8 h', amount: 10 },
      ],
      next: { value: 60, band: 'content', bandLabel: 'Contente', multiplierPercent: 105 },
      advice: null,
      notes: [],
      effects: [],
    });
    // O que recrutar custa à moral vem ao lado do custo em recursos, pronto.
    expect(view.recruitment.moraleNote).toBe(
      'Chamar aldeões agora gasta a comida guardada, que vale 10 de moral. Com as casas cheias a moral perde 10: para evitar, chame até 4.',
    );
    const withRecruitment = (changed: object) => ({
      ...view,
      recruitment: { ...view.recruitment, ...changed },
    });
    expect(ViewStateSchema.safeParse(withRecruitment({ moraleNote: null })).success).toBe(true);
    expect(ViewStateSchema.safeParse(withRecruitment({ moraleNote: 10 })).success).toBe(false);

    // Sem a moral, com uma faixa ou um termo desconhecido, ou com um campo a mais: fora do
    // contrato. A dica pode faltar (`null`); o resto, não.
    const withoutMorale = Object.fromEntries(
      Object.entries(view).filter(([key]) => key !== 'morale'),
    );
    expect(ViewStateSchema.safeParse(withoutMorale).success).toBe(false);
    const withMorale = (changed: object) => ({ ...view, morale: { ...view.morale, ...changed } });
    expect(ViewStateSchema.safeParse(withMorale({})).success).toBe(true);
    expect(
      ViewStateSchema.safeParse(withMorale({ advice: 'Ponha gente na Fazenda.' })).success,
    ).toBe(true);
    expect(ViewStateSchema.safeParse(withMorale({ band: 'furious' })).success).toBe(false);
    expect(
      ViewStateSchema.safeParse(
        withMorale({ terms: [{ id: 'tavern', label: 'Taverna', amount: 5 }] }),
      ).success,
    ).toBe(false);
    expect(
      ViewStateSchema.safeParse(withMorale({ next: { ...view.morale.next, band: undefined } }))
        .success,
    ).toBe(false);
    expect(
      ViewStateSchema.safeParse(
        withMorale({ effects: [{ label: 'festa', amount: 5, endsInSeconds: 600, id: 'x' }] }),
      ).success,
    ).toBe(false);
    // O estado do gerador nunca faz parte da visão.
    expect(ViewStateSchema.safeParse(withMorale({ rng: [1, 2, 3, 4] })).success).toBe(false);

    // O feudo abandonado: a fome, a moral que despenca e quem vai embora. Tudo o que o motor
    // emite passa pelo contrato do evento, e a visão de cada momento, pelo da visão.
    const abandoned = advanceTo(start, 40 * 2 * 3_600_000);
    const moraleTypes = ['moraleBandChanged', 'villagerLeft', 'villagerDeserted'];
    const emitted = abandoned.events.filter((event) => moraleTypes.includes(event.type));
    expect(new Set(emitted.map((event) => event.type))).toEqual(new Set(moraleTypes));
    for (const [index, event] of emitted.entries()) {
      const sent = { ...event, seq: index + 1, at: '2026-10-02T12:00:00.000Z' };
      expect(GameEventSchema.safeParse(sent).error).toBeUndefined();
      // São notícia: linhas da Crônica.
      expect(CHRONICLE_HIDDEN_EVENT_TYPES).not.toContain(event.type);
    }
    expect(
      GameEventSchema.safeParse({
        seq: 1,
        type: 'villagerArrived',
        at: '2026-10-02T12:00:00.000Z',
        atMs: 7_200_000,
        text: 'No 2º dia da Primavera, um colono bateu ao portão, atraído pela fama de Pedra Alta. Agora são 6.',
        data: { villagers: 6, morale: 80 },
      }).error,
    ).toBeUndefined();
    const after = deriveViewState(abandoned.state, abandoned.state.lastProcessedAt);
    expect(ViewStateSchema.safeParse(after).error).toBeUndefined();
    expect(after.morale).toMatchObject({ value: 0, band: 'desperate', multiplierPercent: 75 });
    // A base, a fome e os dias dela; e, quando os lobos acabaram de passar, o termo da incursão.
    expect(after.morale.terms.map((term) => term.id).slice(0, 3)).toEqual([
      'base',
      'famine',
      'famineDays',
    ]);
    expect(after.morale.advice).toContain('Fazenda');
    expect(after.population.villagers).toBe(3);
    // Os lobos passaram várias vezes pelo feudo abandonado: tudo o que eles deixaram nos
    // eventos passa pelo contrato, e nenhum desses eventos fica fora da Crônica.
    const raidTypes = ['wolvesHowl', 'raidSuffered', 'villagerInjured', 'villagerRecovered'];
    const raided = abandoned.events.filter((event) => raidTypes.includes(event.type));
    expect(new Set(raided.map((event) => event.type))).toEqual(new Set(raidTypes));
    for (const [index, event] of raided.entries()) {
      const sent = { ...event, seq: index + 1, at: '2026-10-02T12:00:00.000Z' };
      expect(GameEventSchema.safeParse(sent).error).toBeUndefined();
      expect(CHRONICLE_HIDDEN_EVENT_TYPES).not.toContain(event.type);
    }
  });

  it('os eventos que ficam fora da Crônica são a virada de dia e o fecho do desperdício', () => {
    expect(CHRONICLE_HIDDEN_EVENT_TYPES).toEqual(['dayStarted', 'storageWasted']);
    // O estoque que encheu é notícia: continua na Crônica.
    expect(CHRONICLE_HIDDEN_EVENT_TYPES).not.toContain('storageFilled');
  });

  it('recusa campos a mais: o cliente nunca recebe o que não está no contrato', () => {
    const view = deriveViewState(createInitialState('s', settings), 0);
    expect(ViewStateSchema.safeParse({ ...view, enemyComposition: [] }).success).toBe(false);
  });
});

describe('contratos da API', () => {
  const view = deriveViewState(
    createInitialState('s', {
      settlementName: 'Pedra Alta',
      timezone: 'UTC',
      vigilHourLocal: 20,
      difficulty: 'lord',
      timeScale: 1,
    }),
    0,
  );
  const event = {
    seq: 1,
    type: 'dayStarted',
    at: '2026-10-01T12:00:00.000Z',
    atMs: 7_200_000,
    text: 'Amanhece o 2º dia da Primavera em Pedra Alta.',
    data: { dayOfYear: 2 },
  };

  it('stateVersion é uma string decimal positiva', () => {
    expect(StateVersionSchema.safeParse('1').success).toBe(true);
    expect(StateVersionSchema.safeParse('9007199254740993').success).toBe(true);
    for (const bad of ['0', '01', '-1', '1.5', '', 1]) {
      expect(StateVersionSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('/view responde { view, stateVersion }', () => {
    expect(ViewResponseSchema.safeParse({ view, stateVersion: '3' }).success).toBe(true);
    expect(ViewResponseSchema.safeParse({ view, stateVersion: 3 }).success).toBe(false);
  });

  it('comando aceito responde { view, events, stateVersion, staleView }', () => {
    const body = { view, events: [event], stateVersion: '2', staleView: false };
    expect(CommandAcceptedSchema.safeParse(body).error).toBeUndefined();
  });

  it('recusa do motor é GAME_RULE com o estado avançado nos detalhes', () => {
    const body = {
      code: 'GAME_RULE',
      message: 'Faltam 30 madeira e 35 pedra.',
      details: {
        code: 'INSUFFICIENT_RESOURCES',
        message: 'Faltam 30 madeira e 35 pedra.',
        view,
        events: [event],
        stateVersion: '2',
        staleView: true,
      },
    };
    expect(GameRuleErrorSchema.safeParse(body).error).toBeUndefined();
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
  });

  it('exclusão responde deletedAt e purgeAfter em UTC ISO 8601', () => {
    const ok = { deletedAt: '2026-10-01T12:00:00.000Z', purgeAfter: '2026-10-08T12:00:00.000Z' };
    expect(DeleteMeResponseSchema.safeParse(ok).success).toBe(true);
    const local = { ...ok, deletedAt: '2026-10-01T09:00:00-03:00' };
    expect(DeleteMeResponseSchema.safeParse(local).success).toBe(false);
  });

  it('criação de partida valida nome, fuso e Hora da Vigília', () => {
    const body = {
      settlementName: 'Pedra Alta',
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 20,
    };
    expect(CreateGameRequestSchema.safeParse(body).success).toBe(true);
    expect(CreateGameRequestSchema.safeParse({ ...body, timezone: 'Marte/Olimpo' }).success).toBe(
      false,
    );
    expect(CreateGameRequestSchema.safeParse({ ...body, vigilHourLocal: 24 }).success).toBe(false);
    expect(CreateGameRequestSchema.safeParse({ ...body, settlementName: 'A' }).success).toBe(false);
  });

  it('criação de partida: a dificuldade é uma das três do conteúdo, ou nenhuma', () => {
    const body = { settlementName: 'Pedra Alta', timezone: 'UTC', vigilHourLocal: 20 };
    for (const difficulty of DIFFICULTY_IDS) {
      expect(CreateGameRequestSchema.safeParse({ ...body, difficulty }).data?.difficulty).toBe(
        difficulty,
      );
    }
    expect(CreateGameRequestSchema.safeParse(body).data).not.toHaveProperty('difficulty');
    for (const difficulty of ['normal', 'Lord', 'LORD', '', null, 1, ['lord']]) {
      expect(CreateGameRequestSchema.safeParse({ ...body, difficulty }).success).toBe(false);
    }
  });

  it('criação de partida: o ritmo é um número positivo, ou nenhum', () => {
    const body = { settlementName: 'Pedra Alta', timezone: 'UTC', vigilHourLocal: 20 };
    for (const { timeScale } of balance.paces) {
      expect(CreateGameRequestSchema.safeParse({ ...body, timeScale }).data?.timeScale).toBe(
        timeScale,
      );
    }
    expect(CreateGameRequestSchema.safeParse(body).data).not.toHaveProperty('timeScale');
    for (const timeScale of [0, -1, '3', null, Number.NaN, Number.POSITIVE_INFINITY, [3]]) {
      expect(CreateGameRequestSchema.safeParse({ ...body, timeScale }).success).toBe(false);
    }
    // Quais ritmos o jogo oferece é conteúdo, e quem confere é o servidor: este pacote vai para
    // o navegador junto com o app e não pode levar `balance` com ele.
    expect(CreateGameRequestSchema.safeParse({ ...body, timeScale: 2 }).success).toBe(true);
  });

  it('nenhum módulo do protocolo que o app carrega lê números do conteúdo', () => {
    // `contentHash.ts` lê o conteúdo inteiro de propósito e só é chamado pelo servidor e pelo
    // simulador; o build do app o descarta (packages/web/src/bundle.test.ts confere o pacote).
    const files = import.meta.glob<string>('./*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const sources = Object.entries(files).filter(
      ([file]) => !file.endsWith('.test.ts') && file !== './contentHash.ts',
    );
    expect(sources.map(([file]) => file)).toEqual(
      expect.arrayContaining(['./api.ts', './commands.ts', './view.ts']),
    );
    for (const [file, source] of sources) {
      const imported = [...source.matchAll(/import\s+\{([^}]*)\}\s+from\s+'@lotg\/content'/g)]
        .flatMap((match) => (match[1] ?? '').split(','))
        .map((name) => name.trim())
        .filter((name) => name !== '' && !name.startsWith('type '));
      expect(
        imported.filter((name) => !/^[A-Z_]+_IDS$/.test(name) && name !== 'EVENT_TYPES'),
        file,
      ).toEqual([]);
      expect(source, file).not.toMatch(/import\s+\*\s+as\s+\w+\s+from\s+'@lotg\/content'/);
    }
  });

  it('/catalog responde as opções de nova partida, com os padrões entre elas', () => {
    const catalog = {
      contentHash: '0123456789abcdef',
      newGame: {
        difficulties: DIFFICULTY_IDS.map((id) => ({
          id,
          label: balance.difficulties[id].label,
          description: balance.difficulties[id].description,
          recommended: balance.difficulties[id].recommended,
        })),
        paces: balance.paces.map(({ timeScale, label, description, hint, recommended }) => ({
          timeScale,
          label,
          description,
          hint,
          recommended,
        })),
        defaults: { difficulty: 'lord', timeScale: 3 },
      },
    };
    expect(CatalogResponseSchema.safeParse(catalog).error).toBeUndefined();

    const { newGame } = catalog;
    const withNewGame = (change: object) => ({ ...catalog, newGame: { ...newGame, ...change } });
    // Um padrão que não está entre as opções deixaria as boas-vindas sem nada marcado.
    for (const defaults of [
      { difficulty: 'lord', timeScale: 2 },
      { difficulty: 'normal', timeScale: 3 },
      { difficulty: 'lord' },
    ]) {
      expect(CatalogResponseSchema.safeParse(withNewGame({ defaults })).success).toBe(false);
    }
    expect(CatalogResponseSchema.safeParse(withNewGame({ paces: [] })).success).toBe(false);
    expect(CatalogResponseSchema.safeParse(withNewGame({ difficulties: [] })).success).toBe(false);
    // Nenhum fator de regra sai no catálogo: só o que as boas-vindas mostram.
    const leaking = newGame.difficulties.map((entry) => ({ ...entry, storageCapacity: 1 }));
    expect(CatalogResponseSchema.safeParse(withNewGame({ difficulties: leaking })).success).toBe(
      false,
    );
  });

  it('a resposta do GitHub traz os tokens só quando nasce uma sessão', () => {
    const account = {
      id: uuid,
      displayName: 'Gustavo',
      linked: { github: true },
      hasRecoveryCode: false,
      createdAt: '2026-10-01T12:00:00.000Z',
    };
    expect(GithubAuthResponseSchema.safeParse({ account }).success).toBe(true);
    const tokens = { accessToken: 'a', refreshToken: 'r', expiresIn: 900 };
    expect(GithubAuthResponseSchema.safeParse({ account, ...tokens }).success).toBe(true);
  });

  it('a consulta de eventos tem padrões e converte texto em número', () => {
    expect(EventsQuerySchema.parse({})).toEqual({ after: 0, limit: 100 });
    expect(EventsQuerySchema.parse({ after: '12', limit: '5' })).toEqual({ after: 12, limit: 5 });
    expect(EventsQuerySchema.safeParse({ after: '-1' }).success).toBe(false);
  });

  it('todo código de erro tem status HTTP', () => {
    expect(Object.keys(API_ERROR_STATUS).sort()).toEqual([...API_ERROR_CODES].sort());
    expect(API_ERROR_STATUS.GAME_RULE).toBe(422);
    expect(API_ERROR_STATUS.COMMAND_ID_CONFLICT).toBe(409);
    expect(API_ERROR_STATUS.SESSION_REVOKED).toBe(401);
    expect(API_ERROR_STATUS.UPGRADE_REQUIRED).toBe(426);
    expect(PROTOCOL_VERSION).toBe(2);
  });
});

describe('Relatório de Retorno e device flow', () => {
  it('o relatório tem estoques, contagens, fome e destaques', () => {
    const report = {
      awaySeconds: 18_000,
      resources: [{ id: 'food', label: 'Comida', before: 180, after: 240, delta: 60 }],
      counts: {
        daysPassed: 2,
        constructionsFinished: 1,
        villagersArrived: 3,
        objectivesCompleted: 1,
      },
      famine: 'none',
      highlights: ['No 1º dia da Primavera, os pedreiros ergueram as Habitações ao 2º nível.'],
    };
    expect(ReturnReportSchema.safeParse(report).error).toBeUndefined();
    // A variação de estoque pode vir separada em gasto, recebido, perdido e produzido.
    const split = {
      ...report,
      resources: [
        {
          id: 'wood',
          label: 'Madeira',
          before: 120,
          after: 500,
          delta: 380,
          spent: 160,
          received: 30,
          wasted: 96,
          produced: 510,
        },
      ],
    };
    expect(ReturnReportSchema.safeParse(split).error).toBeUndefined();
    expect(
      ReturnReportSchema.safeParse({
        ...report,
        resources: [{ ...split.resources[0], wasted: 'muito' }],
      }).success,
    ).toBe(false);
    expect(ReturnReportSchema.safeParse({ ...report, famine: 'talvez' }).success).toBe(false);
    expect(ReturnReportSchema.safeParse({ ...report, extra: 1 }).success).toBe(false);
    // As incursões são opcionais, como a moral: o que os lobos levaram de cada recurso (dos
    // eventos `raidSuffered`) e quantas houve, repelidas e sofridas, com os feridos.
    const raided = {
      ...split,
      resources: [{ ...split.resources[0], raided: 45.5, produced: 555.5 }],
      counts: {
        ...report.counts,
        raidsSuffered: 2,
        raidsRepelled: 1,
        villagersInjured: 3,
        villagersRecovered: 2,
      },
    };
    expect(ReturnReportSchema.safeParse(raided).error).toBeUndefined();
    expect(
      ReturnReportSchema.safeParse({
        ...raided,
        counts: { ...raided.counts, raidsSuffered: 1.5 },
      }).success,
    ).toBe(false);
    expect(
      ReturnReportSchema.safeParse({
        ...raided,
        resources: [{ ...raided.resources[0], raided: 'muito' }],
      }).success,
    ).toBe(false);
    // A moral e quem ela moveu são opcionais: o relatório de antes continua valendo, e o novo
    // diz a faixa de agora, a de antes e quantos chegaram, partiram e desertaram.
    const withMorale = {
      ...report,
      counts: { ...report.counts, settlersArrived: 1, villagersLeft: 2, villagersDeserted: 3 },
      morale: {
        value: 24,
        band: 'desperate',
        bandLabel: 'Desesperado',
        before: { value: 60, band: 'content', bandLabel: 'Contente' },
      },
    };
    expect(ReturnReportSchema.safeParse(withMorale).error).toBeUndefined();
    expect(
      ReturnReportSchema.safeParse({
        ...report,
        morale: { value: 60, band: 'content', bandLabel: 'Contente' },
      }).error,
    ).toBeUndefined();
    expect(
      ReturnReportSchema.safeParse({ ...withMorale, morale: { ...withMorale.morale, band: 'x' } })
        .success,
    ).toBe(false);
    expect(
      ReturnReportSchema.safeParse({
        ...withMorale,
        counts: { ...withMorale.counts, villagersLeft: -1 },
      }).success,
    ).toBe(false);
    // Os três blocos (V2D-T4) também são opcionais. Um item é uma frase; a ação, o assunto e a
    // urgência só vêm quando há o que fazer.
    const blocks = {
      prospered: [{ text: 'No 1º dia da Primavera, os pedreiros ergueram as Habitações.' }],
      cost: [
        {
          text: 'Despensa sem espaço: 120 de comida foram ao chão.',
          topic: 'storage:granary',
          severity: 'warning',
          action: { command: 'lords.build', arg: 'granary', label: 'Construir Celeiro' },
        },
      ],
      pending: [
        {
          text: 'Conselho: “A vez de repartir” · expira em 22 h.',
          topic: 'card:commonGranaryShare-3',
          severity: 'info',
          action: { command: 'lords.openPanel', arg: 'council', label: 'Decidir' },
        },
        { text: '2 aldeões livres, sem ofício.', action: { command: 'x', label: 'Alocar' } },
      ],
    };
    expect(ReturnReportSchema.safeParse({ ...report, blocks }).error).toBeUndefined();
    expect(ReturnReportSchema.safeParse({ ...report, blocks: { prospered: [] } }).success).toBe(
      false,
    );
    for (const item of [
      { topic: 'food' },
      { text: 'x', severity: 'grave' },
      { text: 'x', action: { command: 'lords.build' } },
      { text: 'x', extra: 1 },
    ]) {
      expect(
        ReturnReportSchema.safeParse({ ...report, blocks: { ...blocks, cost: [item] } }).success,
      ).toBe(false);
    }
  });

  it('a consulta do device flow tem cinco desfechos e nada além deles', () => {
    const accepted = [
      { status: 'authorized', githubAccessToken: 'gho_x' },
      { status: 'pending' },
      { status: 'slowDown', intervalSeconds: 10 },
      { status: 'expired' },
      { status: 'denied' },
    ];
    for (const body of accepted) {
      expect(GithubDevicePollResponseSchema.safeParse(body).error).toBeUndefined();
    }
    for (const body of [
      { status: 'authorized' },
      { status: 'pending', githubAccessToken: 'gho_x' },
      { status: 'slowDown' },
      { status: 'error' },
    ]) {
      expect(GithubDevicePollResponseSchema.safeParse(body).success).toBe(false);
    }
    expect(
      GithubDeviceStartResponseSchema.safeParse({
        deviceCode: 'd',
        userCode: 'WDJB-MJHT',
        verificationUri: 'https://github.com/login/device',
        expiresInSeconds: 900,
        intervalSeconds: 5,
      }).error,
    ).toBeUndefined();
    expect(GithubDevicePollRequestSchema.safeParse({ deviceCode: '' }).success).toBe(false);
  });
});

describe('canonicalJson', () => {
  it('ordena as chaves recursivamente e preserva a ordem dos arrays', () => {
    const a = {
      type: 'setWorkers',
      payload: { count: 2, building: 'farm' },
      list: [3, 1, { b: 1, a: 2 }],
    };
    const b = {
      list: [3, 1, { a: 2, b: 1 }],
      payload: { building: 'farm', count: 2 },
      type: 'setWorkers',
    };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe(
      '{"list":[3,1,{"a":2,"b":1}],"payload":{"building":"farm","count":2},"type":"setWorkers"}',
    );
    expect(canonicalJson({ list: [1, 3] })).not.toBe(canonicalJson({ list: [3, 1] }));
    expect(canonicalJson(null)).toBe('null');
  });
});

describe('contentHash', () => {
  it('entrega ao SHA-256 o JSON canônico do conteúdo inteiro e fica com 16 caracteres', () => {
    const hashed: string[] = [];
    const hash = contentHash((text) => {
      hashed.push(text);
      return '0123456789abcdef'.repeat(4);
    });
    expect(hash).toBe('0123456789abcdef');
    expect(hashed).toEqual([
      canonicalJson({
        balance,
        buildings,
        objectives,
        chronicleTemplates,
        foundingTemplates,
        coldReliefs,
        craftGuilds,
        moraleBandTemplates,
        idleVillager,
        councilCards,
        tileTypes,
        startingTiles,
        enemies,
        raidSizes,
        threatMarkTemplates,
        raidTemplates,
        injuryTemplates,
        injuredLoss,
      }),
    ]);
  });

  it('o que é resumido traz os números e os textos do conteúdo', () => {
    let hashed = '';
    contentHash((text) => {
      hashed = text;
      return '';
    });
    const parsed = JSON.parse(hashed) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual([
      'balance',
      'buildings',
      'chronicleTemplates',
      'coldReliefs',
      'councilCards',
      'craftGuilds',
      'enemies',
      'foundingTemplates',
      'idleVillager',
      'injuredLoss',
      'injuryTemplates',
      'moraleBandTemplates',
      'objectives',
      'raidSizes',
      'raidTemplates',
      'startingTiles',
      'threatMarkTemplates',
      'tileTypes',
    ]);
    // As frases que entram dentro de outras também são conteúdo: o ofício e o alívio do frio.
    expect(hashed).toContain(craftGuilds.lumberMill.feat);
    expect(hashed).toContain(coldReliefs.thaw);
    expect(hashed).toContain(`"adaptationMs":${balance.craft.adaptationMs}`);
    // A moral também: os números dela, a frase de cada faixa e quem parte sem ofício.
    expect(hashed).toContain(`"populationFloor":${balance.morale.populationFloor}`);
    expect(hashed).toContain(moraleBandTemplates.restless.fell ?? '');
    expect(hashed).toContain(idleVillager);
    // O armazenamento é conteúdo: mexer em um limite muda o hash.
    expect(hashed).toContain(`"baseCapacity":${balance.storage.baseCapacity}`);
    expect(hashed).toContain(balance.difficulties.lord.description);
    expect(hashed).toContain(`"dayMs":${balance.calendar.dayMs}`);
    // As cartas do Conselho também: o texto, a pista de uma opção e a cadência.
    expect(hashed).toContain(councilCards[0]?.text ?? 'falta a carta');
    expect(hashed).toContain(councilCards[0]?.options[0]?.hint ?? 'falta a opção');
    expect(hashed).toContain(`"drawIntervalDays":${balance.council.drawIntervalDays}`);
    // E a Ameaça: os números, o tile, o inimigo e a frase de cada marca.
    expect(hashed).toContain(`"perActiveTilePerDay":${balance.threat.perActiveTilePerDay}`);
    expect(hashed).toContain(tileTypes.wolfDen.label);
    expect(hashed).toContain(enemies.wolves.sizes.medium);
    expect(hashed).toContain(threatMarkTemplates[70]?.first ?? 'falta a frase');
    expect(hashed).toContain(threatMarkTemplates[70]?.again ?? 'falta a frase da volta');
    expect(hashed).toContain(buildings.watchtower.maxLevelNote ?? 'falta a frase');
    // E a Paliçada: o que cada nível segura, o que passa, os nomes dos tamanhos e a frase do
    // teto. As três cartas da promessa entram com o resto do catálogo.
    expect(hashed).toContain(`"palisadeBreach":${canonicalJson(balance.threat.palisadeBreach)}`);
    expect(hashed).toContain('"palisadeLevels":[{"absorbs":"light"},{"absorbs":"medium"}]');
    expect(hashed).toContain(`"plural":"${raidSizes.medium.plural}"`);
    expect(hashed).toContain(buildings.palisade.maxLevelNote ?? 'falta a frase');
    expect(hashed).toContain('"autoResolveIfUnlocked":"show"');
    // E as incursões: o roteiro, o estrago, o ferimento, e as frases do aviso, do desfecho, do
    // conselho e de quem se fere.
    expect(hashed).toContain(`"scripted":${canonicalJson(balance.raids.scripted)}`);
    expect(hashed).toContain(`"injuryMs":${balance.raids.injuryMs}`);
    expect(hashed).toContain(`"moraleLabel":"${balance.raids.moraleLabel}"`);
    expect(hashed).toContain(raidTemplates.wolves.advice.build);
    expect(hashed).toContain(raidTemplates.wolves.howl.unwatched);
    expect(hashed).toContain(injuryTemplates.villagerRecovered.worker);
    expect(hashed).toContain(injuredLoss.one);
  });
});
