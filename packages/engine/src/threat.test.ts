import { balance, buildings, chronicleTemplates, threatMarkTemplates } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  accept,
  AUTUMN,
  command,
  councilInSession,
  DAY,
  eventsOfType,
  gameAt,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  quietHorde,
  refuse,
  settings,
  SUMMER,
  WINTER,
  YEAR,
} from './test-helpers';
import { threatAfterTurn, threatSources, watchtowerPerks } from './threat';
import type { GameState, ScheduledRaid, ThreatView } from './types';
import { deriveViewState } from './view';

const { threat: rules } = balance;

/** Um feudo posto em um instante, com a Ameaça e a Torre que o teste pedir. */
function feud(
  atMs: number,
  threat: number,
  watchtower = 0,
  edit: (draft: GameState) => void = () => {},
): GameState {
  return gameAt(atMs, (draft) => {
    draft.map.threat = threat;
    draft.settlement.buildings.watchtower = watchtower;
    // A Torre pede o Salão no nível 2: o cenário fica coerente com o que o jogo permite.
    draft.settlement.buildings.townHall = 2;
    edit(draft);
  });
}

const threatAt = (state: GameState, atMs: number) => advanceTo(state, atMs).state.map.threat;
const rose = (state: GameState, atMs: number) =>
  eventsOfType(advanceTo(state, atMs).events, 'threatRose');
const view = (state: GameState, timeScale = 1): ThreatView =>
  deriveViewState(state, state.lastProcessedAt, { timeScale }).threat;

/** A visão de quem tem a Torre; o teste falha se ela vier fechada. */
function known(state: GameState, timeScale = 1): Extract<ThreatView, { known: true }> {
  const threat = view(state, timeScale);
  if (!threat.known) {
    throw new Error('A visão veio sem a Ameaça: o cenário devia ter a Torre de Vigia.');
  }
  return threat;
}

const raid = (atMs: number, size: ScheduledRaid['size'] = 'light'): ScheduledRaid => ({
  id: 'threat-1',
  atMs,
  kind: 'threat',
  enemy: 'wolves',
  size,
  announcedAtMs: null,
});

describe('a Ameaça sobe na virada do dia de jogo (GDD §8.2)', () => {
  it('uma partida nova nasce com o Covil de Lobos ativo, a Ameaça em zero e só a incursão do roteiro marcada', () => {
    const state = newGame();
    expect(state.map).toEqual({
      tiles: { wolfDen: { type: 'wolfDen', threatActive: true } },
      threat: 0,
    });
    // Os lobos do ano 1 (`threat.raids.test.ts`); as outras incursões a Ameaça sorteia depois.
    expect(state.horde.scheduledRaids.map((entry) => entry.id)).toEqual(['wolvesYear1']);
    expect(state.settlement.injured).toEqual([]);
    expect(state.settlement.buildings.watchtower).toBe(0);
  });

  it('+5 por dia de jogo, no instante exato da virada, com o covil ativo', () => {
    // Sem incursão nenhuma no caminho (a Horda calada): cada incursão derrubaria a Ameaça.
    const state = gameWith(quietHorde);
    expect(threatAt(state, DAY - 1)).toBe(0);
    expect(threatAt(state, DAY)).toBe(5);
    expect(threatAt(state, 2 * DAY - 1)).toBe(5);
    expect(threatAt(state, 2 * DAY)).toBe(10);
    // No 8º dia de jogo chega a 40; no 20º, sem incursão nenhuma, ao máximo.
    expect(threatAt(state, 8 * DAY)).toBe(40);
    expect(threatAt(state, 20 * DAY)).toBe(100);
  });

  it('sobe com ou sem Torre de Vigia: a Torre só deixa ver', () => {
    for (const watchtower of [0, 1, 2]) {
      expect(threatAt(feud(3 * DAY, 15, watchtower), 9 * DAY)).toBe(45);
    }
  });

  it('+3 a mais por cada dia de outono que passa, do primeiro ao último', () => {
    // A virada que abre o outono fecha um dia de verão: soma só o covil.
    const lastOfSummer = feud(AUTUMN - DAY, 0);
    expect(threatAt(lastOfSummer, AUTUMN)).toBe(5);
    // O primeiro dia de outono inteiro soma 5 + 3.
    expect(threatAt(lastOfSummer, AUTUMN + DAY)).toBe(13);
    expect(threatAt(lastOfSummer, AUTUMN + 2 * DAY)).toBe(21);
    // A virada que abre o inverno fecha o último dia de outono: ainda soma 8.
    const lastOfAutumn = feud(WINTER - DAY, 0);
    expect(threatAt(lastOfAutumn, WINTER)).toBe(8);
    // No inverno, só o covil.
    expect(threatAt(lastOfAutumn, WINTER + DAY)).toBe(13);
    // E no verão e na primavera também.
    expect(threatAt(feud(SUMMER, 0), SUMMER + DAY)).toBe(5);
  });

  it('é limitada a 100, e fica lá', () => {
    expect(threatAt(feud(3 * DAY, 98), 4 * DAY)).toBe(100);
    expect(threatAt(feud(3 * DAY, 100), 9 * DAY)).toBe(100);
    // No outono a subida de 8 também para no limite.
    expect(threatAt(feud(AUTUMN + DAY, 95), AUTUMN + 2 * DAY)).toBe(100);
    expect(rules.max).toBe(100);
  });

  it('um tile sem ameaça ativa não soma; dois ativos somam cada um o seu', () => {
    const cleared = feud(3 * DAY, 10, 0, (draft) => {
      draft.map.tiles = { wolfDen: { type: 'wolfDen', threatActive: false } };
    });
    expect(threatAt(cleared, 6 * DAY)).toBe(10);
    // Sem tile ativo, o outono ainda soma a parte dele.
    const autumn = feud(AUTUMN, 10, 0, (draft) => {
      draft.map.tiles = { wolfDen: { type: 'wolfDen', threatActive: false } };
    });
    expect(threatAt(autumn, AUTUMN + 2 * DAY)).toBe(16);
    const two = feud(3 * DAY, 10, 0, (draft) => {
      draft.map.tiles = {
        wolfDen: { type: 'wolfDen', threatActive: true },
        northDen: { type: 'wolfDen', threatActive: true },
      };
    });
    expect(threatAt(two, 4 * DAY)).toBe(20);
  });

  it('os termos saem na mesma ordem qualquer que seja a ordem das chaves no estado', () => {
    // O estado passa pelo banco, que não guarda a ordem das chaves de um objeto.
    const tiles = {
      wolfDen: { type: 'wolfDen', threatActive: true },
      northDen: { type: 'wolfDen', threatActive: true },
    } as const;
    const one = feud(AUTUMN + DAY, 0, 1, (draft) => {
      draft.map.tiles = { wolfDen: tiles.wolfDen, northDen: tiles.northDen };
    });
    const other = feud(AUTUMN + DAY, 0, 1, (draft) => {
      draft.map.tiles = { northDen: tiles.northDen, wolfDen: tiles.wolfDen };
    });
    const turn = AUTUMN + 2 * DAY;
    expect(threatSources(one, turn)).toEqual(threatSources(other, turn));
    expect(threatSources(one, turn).map((source) => source.kind)).toEqual([
      'tile',
      'tile',
      'season',
    ]);
    expect(view(one)).toEqual(view(other));
  });

  it('a virada do ano não zera nada: a Ameaça e o covil continuam', () => {
    const state = feud(YEAR - DAY, 30);
    const { state: after, events } = advanceTo(state, YEAR + DAY);
    expect(eventsOfType(events, 'yearStarted')).toHaveLength(1);
    // A virada do ano fecha um dia de inverno (+5); a seguinte, um de primavera (+5).
    expect(threatAt(state, YEAR)).toBe(35);
    expect(after.map.threat).toBe(40);
    expect(after.map.tiles).toEqual(state.map.tiles);
    expect(after.horde).toEqual(state.horde);
    expect(after.clock.year).toBe(2);
  });

  it('`threatAfterTurn` é a conta que a virada faz', () => {
    for (const [atMs, threat] of [
      [5 * DAY, 20],
      [AUTUMN - DAY, 20],
      [AUTUMN + 3 * DAY, 20],
      [WINTER - DAY, 96],
      [YEAR - DAY, 100],
    ] as const) {
      const state = feud(atMs + 17 * MINUTE, threat);
      const turn = atMs + DAY;
      expect(threatAfterTurn(state, turn)).toBe(threatAt(state, turn));
    }
  });

  it('na virada do dia a Ameaça vem depois do Conselho (ADR 0013, ordem do mesmo instante)', () => {
    // A audiência do 8º dia cai na virada em que a Ameaça cruza os 40.
    const state = feud(8 * DAY - HOUR, 35, 1, councilInSession);
    const { events } = advanceTo(state, 8 * DAY);
    const types = events.map((event) => event.type);
    expect(types).toContain('cardDrawn');
    expect(types.indexOf('dayStarted')).toBeLessThan(types.indexOf('cardDrawn'));
    expect(types.indexOf('cardDrawn')).toBeLessThan(types.indexOf('threatRose'));
    expect(types[types.length - 1]).toBe('threatRose');
  });
});

describe('a Crônica só fala da Ameaça a quem tem a Torre de Vigia', () => {
  it('sem Torre, nenhuma linha, por mais que a Ameaça suba', () => {
    const { state, events } = advanceTo(gameWith(quietHorde), YEAR + 30 * DAY);
    expect(state.map.threat).toBe(100);
    expect(eventsOfType(events, 'threatRose')).toEqual([]);
    // Nenhum outro evento carrega o número: a Crônica não conta o que a névoa esconde.
    for (const event of events) {
      expect(Object.keys(event.data).filter((key) => /threat/i.test(key))).toEqual([]);
      expect(event.text).not.toMatch(/Ameaça|vigias|uivos/);
    }
  });

  it('sem Torre, com os lobos atacando o ano inteiro, nenhum evento leva o número nem fala de vigias', () => {
    // Uma partida de verdade: os uivos, a incursão do roteiro e as da Ameaça. Quem não tem
    // Torre lê o que aconteceu, e nunca a Ameaça.
    const { events } = advanceTo(newGame(), YEAR + 30 * DAY);
    expect(eventsOfType(events, 'raidSuffered').length).toBeGreaterThan(5);
    expect(eventsOfType(events, 'threatRose')).toEqual([]);
    expect(eventsOfType(events, 'raidAnnounced')).toEqual([]);
    for (const event of events) {
      expect(Object.keys(event.data).filter((key) => /threat/i.test(key))).toEqual([]);
      expect(event.text).not.toMatch(/Ameaça|vigias/);
    }
  });

  it('com a Torre, uma linha ao cruzar 40 e outra ao cruzar 70, e mais nenhuma', () => {
    // Com a Horda calada: uma incursão derruba a Ameaça, e a marca cruzada de novo repete a
    // linha (o último teste deste grupo, e `threat.raids.test.ts`).
    const state = gameWith((draft) => {
      quietHorde(draft);
      draft.settlement.buildings.townHall = 2;
      draft.settlement.buildings.watchtower = 1;
    });
    const events = rose(state, 40 * DAY);
    expect(events.map((event) => [event.atMs / DAY, event.data])).toEqual([
      [8, { threat: 40, previousThreat: 35, mark: 40 }],
      [14, { threat: 70, previousThreat: 65, mark: 70 }],
    ]);
    expect(events.map((event) => event.text)).toEqual([
      'No 9º dia da Primavera, os vigias de Pedra Alta contam mais uivos a cada noite. A Ameaça chegou a 40.',
      'No 15º dia da Primavera, os vigias de Pedra Alta já não dormem: há olhos acesos na orla da mata. A Ameaça chegou a 70.',
    ]);
    expect(rules.chronicleMarks).toEqual([40, 70]);
  });

  it('no outono a subida de 8 passa da marca, e a frase diz a quanto a Ameaça chegou', () => {
    const [event] = rose(feud(AUTUMN + DAY, 35, 1), AUTUMN + 2 * DAY);
    expect(event?.data).toEqual({ threat: 43, previousThreat: 35, mark: 40 });
    expect(event?.text).toBe(
      'No 3º dia do Outono, os vigias de Pedra Alta contam mais uivos a cada noite. A Ameaça chegou a 43.',
    );
  });

  it('chegar exatamente à marca conta; ficar acima dela não repete a linha', () => {
    expect(rose(feud(3 * DAY, 35, 1), 4 * DAY)).toHaveLength(1);
    expect(rose(feud(3 * DAY, 40, 1), 5 * DAY)).toEqual([]);
    expect(rose(feud(3 * DAY, 30, 1), 4 * DAY)).toEqual([]);
    // No máximo, nada mais sobe e nada mais se diz.
    expect(rose(feud(3 * DAY, 100, 1), 30 * DAY)).toEqual([]);
  });

  it('uma subida que pulasse as duas marcas daria uma linha só, a da mais alta', () => {
    const many = feud(3 * DAY, 38, 1, (draft) => {
      draft.map.tiles = Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => [
          `den${index}`,
          { type: 'wolfDen' as const, threatActive: true },
        ]),
      );
    });
    const events = rose(many, 4 * DAY);
    expect(events.map((event) => event.data)).toEqual([
      { threat: 73, previousThreat: 38, mark: 70 },
    ]);
  });

  it('quem ergue a Torre depois de a marca passar não recebe a linha atrasada', () => {
    // A Ameaça já passou dos 40 quando a Torre ficou pronta: a linha dos 40 não volta, e a dos
    // 70 chega na hora dela.
    const late = feud(9 * DAY + HOUR, 45, 0, (draft) => {
      draft.settlement.constructionQueues[0] = {
        building: 'watchtower',
        targetLevel: 1,
        startedAtMs: 9 * DAY + HOUR - 12 * MINUTE,
        finishesAtMs: 9 * DAY + HOUR,
      };
    });
    const { events } = advanceTo(late, 20 * DAY);
    expect(eventsOfType(events, 'threatRose').map((event) => event.data.mark)).toEqual([70]);
  });

  it('a Torre que fica pronta na própria virada já conta os uivos dela', () => {
    // As obras concluídas vêm antes da virada do dia, no mesmo instante.
    const state = feud(8 * DAY - 12 * MINUTE, 35, 0, (draft) => {
      draft.settlement.constructionQueues[0] = {
        building: 'watchtower',
        targetLevel: 1,
        startedAtMs: 8 * DAY - 12 * MINUTE,
        finishesAtMs: 8 * DAY,
      };
    });
    const { events } = advanceTo(state, 8 * DAY);
    const types = events.map((event) => event.type);
    expect(types.indexOf('buildingFounded')).toBeLessThan(types.indexOf('threatRose'));
    expect(eventsOfType(events, 'threatRose')).toHaveLength(1);
    // Um milissegundo depois, a marca já passou: nenhuma linha.
    const tooLate = feud(8 * DAY - 12 * MINUTE, 35, 0, (draft) => {
      draft.settlement.constructionQueues[0] = {
        building: 'watchtower',
        targetLevel: 1,
        startedAtMs: 8 * DAY - 12 * MINUTE,
        finishesAtMs: 8 * DAY + 1,
      };
    });
    expect(rose(tooLate, 9 * DAY)).toEqual([]);
  });

  it('se a Ameaça cair e cruzar a marca de novo, a linha sai de novo', () => {
    // Quem a faz cair é a incursão (`threat.raids.test.ts`); aqui, a regra do cruzamento.
    const first = advanceTo(feud(3 * DAY, 35, 1), 4 * DAY);
    expect(eventsOfType(first.events, 'threatRose')).toHaveLength(1);
    const dropped = { ...first.state, map: { ...first.state.map, threat: 30 } };
    expect(rose(dropped, 5 * DAY)).toEqual([]);
    expect(rose(dropped, 6 * DAY).map((event) => event.data.mark)).toEqual([40]);
  });

  it('cada marca do conteúdo tem a frase dela; a geral fica para uma marca nova', () => {
    for (const mark of rules.chronicleMarks) {
      expect(threatMarkTemplates[mark]).toBeDefined();
    }
    expect(chronicleTemplates.threatRose).toContain('{ameaca}');
  });
});

describe('a divisão de intervalo continua exata com a Ameaça', () => {
  it('estado e eventos iguais, com ou sem Torre, em qualquer estação e através da virada do ano', () => {
    fc.assert(
      fc.property(
        fc.record({
          startMs: fc.integer({ min: 0, max: YEAR + 10 * DAY }),
          threat: fc.integer({ min: 0, max: 100 }),
          watchtower: fc.integer({ min: 0, max: 2 }),
          active: fc.boolean(),
          cuts: fc.array(fc.integer({ min: 1, max: 30 * DAY }), { minLength: 2, maxLength: 4 }),
        }),
        ({ startMs, threat, watchtower, active, cuts }) => {
          const start = feud(startMs, threat, watchtower, (draft) => {
            draft.map.tiles = { wolfDen: { type: 'wolfDen', threatActive: active } };
          });
          const stops = [...new Set(cuts)].sort((a, b) => a - b).map((cut) => startMs + cut);
          const end = stops[stops.length - 1] as number;
          const direct = advanceTo(start, end);
          let state = start;
          const events = [];
          for (const stop of stops) {
            const step = advanceTo(state, stop);
            state = step.state;
            events.push(...step.events);
          }
          expect(state).toStrictEqual(direct.state);
          expect(events).toStrictEqual(direct.events);
          // A Ameaça é a conta fechada: tantas viradas, tanto de cada uma, até o limite.
          expect(direct.state.map.threat).toBeGreaterThanOrEqual(threat);
          expect(direct.state.map.threat).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('a Ameaça depois de N viradas é a soma dos termos de cada uma, limitada', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 * YEAR }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 40 }),
        (startMs, threat, days) => {
          const start = feud(startMs, threat);
          const firstTurn = (Math.floor(startMs / DAY) + 1) * DAY;
          let expected = threat;
          for (let turn = firstTurn; turn < firstTurn + days * DAY; turn += DAY) {
            // O dia que a virada fecha: de outono, +8; de qualquer outra estação, +5.
            const dayOfYear = Math.floor(((turn - 1) % YEAR) / DAY);
            expected = Math.min(100, expected + (dayOfYear >= 48 && dayOfYear < 72 ? 8 : 5));
          }
          expect(threatAt(start, firstTurn + (days - 1) * DAY)).toBe(expected);
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('névoa de informação: a visão sem a Torre de Vigia', () => {
  it('diz que ninguém sabe o que ronda o feudo, o que a Torre daria e o que protege o feudo: mais nada', () => {
    expect(view(newGame())).toEqual({
      known: false,
      text: 'Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.',
      incoming: null,
      watchtower: {
        building: 'watchtower',
        level: 0,
        text: 'Sem Torre de Vigia, ninguém vê a Ameaça crescer nem avisa de um ataque.',
        next: 'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
      },
      defense: {
        building: 'palisade',
        palisadeLevel: 0,
        text: 'Sem Paliçada, nada segura um ataque.',
        next: 'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
      },
    });
  });

  it('nada do que a névoa esconde sai do servidor: a visão inteira é a mesma com a Ameaça em 0 ou em 73', () => {
    // Dois feudos iguais em tudo, menos na Ameaça, nos tiles e em uma incursão marcada para
    // daqui a meia hora de jogo. Sem Torre, o jogador não pode distinguir um do outro.
    const at = 30 * DAY + 20 * MINUTE;
    const calm = feud(at, 0);
    const hunted = feud(at, 73, 0, (draft) => {
      draft.map.tiles = {
        wolfDen: { type: 'wolfDen', threatActive: true },
        northDen: { type: 'wolfDen', threatActive: true },
      };
      draft.horde.scheduledRaids = [raid(at + 30 * MINUTE, 'medium')];
    });
    for (const timeScale of [1, 3, 0.5]) {
      expect(deriveViewState(hunted, at, { timeScale })).toEqual(
        deriveViewState(calm, at, { timeScale }),
      );
    }
    expect(Object.keys(view(hunted)).sort()).toEqual([
      'defense',
      'incoming',
      'known',
      'text',
      'watchtower',
    ]);
  });

  it('a Torre em obras ainda não vê nada; pronta, vê no mesmo instante', () => {
    const state = accept(
      feud(10 * DAY, 50, 0, (draft) => {
        draft.settlement.resources = {
          food: 300_000,
          wood: 300_000,
          stone: 300_000,
          gold: 300_000,
        };
      }),
      command('startConstruction', { building: 'watchtower' }),
    ).state;
    const done = 10 * DAY + 12 * MINUTE;
    expect(deriveViewState(state, done - 1).threat.known).toBe(false);
    const after = deriveViewState(state, done).threat;
    expect(after.known).toBe(true);
    expect(after).toMatchObject({ level: 50, text: 'Ameaça 50 de 100.' });
  });
});

describe('a visão com a Torre de Vigia', () => {
  it('nível 1: o número, a tendência, de onde vem e os tiles conhecidos', () => {
    const state = feud(8 * DAY + 30 * MINUTE, 40, 1);
    expect(known(state)).toEqual({
      known: true,
      text: 'Ameaça 40 de 100.',
      level: 40,
      max: 100,
      risePerDay: 5,
      nextLevel: 45,
      nextRiseInSeconds: 90 * 60,
      trend: 'Sobe 5 a cada dia de jogo (2 h): na próxima virada, vai de 40 para 45.',
      sources: ['+5/dia: Covil de Lobos'],
      tiles: [{ id: 'wolfDen', label: 'Covil de Lobos', active: true }],
      // 45 depois da virada: 5% de chance. A regra e o custo estão em `threat.raids.test.ts`.
      raidChancePercent: 5,
      raidRisk:
        'Se não houver outra a caminho, a próxima virada do dia tem 5% de chance de marcar uma incursão (a chance é o que a Ameaça passa de 40, em %); ela chega 6 h depois. Com a Ameaça abaixo de 60, o ataque é dos leves; a partir daí, dos médios. Toda incursão, repelida ou sofrida, baixa a Ameaça em 10.',
      raidCosts: [
        'Ataques leves: levam 10% do estoque de comida e madeira e ferem 1 aldeão.',
        'Ataques médios: levam 15% do estoque de comida e madeira e ferem 2 aldeões.',
        'Quem se fere fica 2 h sem trabalhar e volta ao ofício sozinho. Um ataque com perdas tira 10 da moral por 2 dias de jogo (4 h).',
      ],
      incoming: null,
      watchtower: {
        building: 'watchtower',
        level: 1,
        text: 'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
        next: 'Torre de Vigia Nv2: avisa com 2 h de antecedência (em vez de 1 h) e passa a dizer o tamanho da incursão.',
      },
      defense: {
        building: 'palisade',
        palisadeLevel: 0,
        text: 'Sem Paliçada, nada segura um ataque.',
        next: 'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
      },
    });
  });

  it('no outono a explicação traz os dois termos: o covil e a estação', () => {
    const state = feud(AUTUMN + 4 * DAY + HOUR, 22, 1);
    expect(known(state)).toMatchObject({
      risePerDay: 8,
      nextLevel: 30,
      trend: 'Sobe 8 a cada dia de jogo (2 h): na próxima virada, vai de 22 para 30.',
      sources: ['+5/dia: Covil de Lobos', '+3/dia: outono'],
    });
    // No último dia de verão a próxima virada ainda não soma o outono.
    expect(known(feud(AUTUMN - HOUR, 22, 1)).sources).toEqual(['+5/dia: Covil de Lobos']);
    // No último dia de outono, ainda soma.
    expect(known(feud(WINTER - HOUR, 22, 1)).sources).toEqual([
      '+5/dia: Covil de Lobos',
      '+3/dia: outono',
    ]);
    expect(known(feud(WINTER + HOUR, 22, 1)).sources).toEqual(['+5/dia: Covil de Lobos']);
  });

  it('o que a visão promete para a próxima virada, a virada cumpre', () => {
    for (const atMs of [
      3 * DAY + 7 * MINUTE,
      AUTUMN - 3 * MINUTE,
      AUTUMN + 5 * DAY + HOUR,
      WINTER - MINUTE,
      WINTER + 2 * DAY,
      YEAR - 20 * MINUTE,
    ]) {
      for (const threat of [0, 37, 94, 100]) {
        const state = feud(atMs, threat, 1);
        const promised = known(state);
        const turn = (Math.floor(atMs / DAY) + 1) * DAY;
        expect(threatAt(state, turn), `${atMs}/${threat}`).toBe(promised.nextLevel);
        expect(promised.risePerDay).toBe(promised.nextLevel - promised.level);
      }
    }
  });

  it('perto do limite a frase diz que a subida para nele; no limite, que não sobe mais', () => {
    expect(known(feud(3 * DAY, 98, 1))).toMatchObject({
      risePerDay: 2,
      nextLevel: 100,
      trend:
        'Sobe 5 a cada dia de jogo (2 h), até o máximo: na próxima virada, vai de 98 para 100.',
    });
    expect(known(feud(3 * DAY, 100, 1))).toMatchObject({
      text: 'Ameaça 100 de 100.',
      risePerDay: 0,
      nextLevel: 100,
      trend: 'Está no máximo: não sobe mais.',
      sources: ['+5/dia: Covil de Lobos'],
    });
  });

  it('sem tile ativo e fora do outono, nada a faz subir, e a lista mostra o tile parado', () => {
    const state = feud(3 * DAY, 20, 1, (draft) => {
      draft.map.tiles = { wolfDen: { type: 'wolfDen', threatActive: false } };
    });
    expect(known(state)).toMatchObject({
      risePerDay: 0,
      trend: 'Nada a faz subir hoje.',
      sources: [],
      tiles: [{ id: 'wolfDen', label: 'Covil de Lobos', active: false }],
    });
  });

  it('prazos e antecedências saem em tempo real, no ritmo da partida', () => {
    const state = feud(8 * DAY + 30 * MINUTE, 40, 1);
    // Rápido: o dia de jogo dura 40 min, e 1 h de jogo são 20 min.
    expect(known(state, 3)).toMatchObject({
      nextRiseInSeconds: 30 * 60,
      trend: 'Sobe 5 a cada dia de jogo (40 min): na próxima virada, vai de 40 para 45.',
      watchtower: {
        text: 'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 20 min de antecedência.',
        next: 'Torre de Vigia Nv2: avisa com 40 min de antecedência (em vez de 20 min) e passa a dizer o tamanho da incursão.',
      },
    });
    // Tranquilo: o dia de jogo dura 4 h, e 1 h de jogo são 2 h.
    expect(known(state, 0.5)).toMatchObject({
      nextRiseInSeconds: 180 * 60,
      trend: 'Sobe 5 a cada dia de jogo (4 h): na próxima virada, vai de 40 para 45.',
      watchtower: {
        text: 'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 2 h de antecedência.',
      },
    });
    // O que a visão usa por padrão é o ritmo gravado na partida.
    const fast = { ...state, settings: { ...settings, timeScale: 3 } };
    expect(deriveViewState(fast, fast.lastProcessedAt).threat).toEqual(view(state, 3));
    // Sem Torre, a frase do que ela daria também é no ritmo da partida.
    expect(view(feud(8 * DAY, 40), 3).watchtower.next).toBe(
      'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 20 min de antecedência.',
    );
  });

  it('nível 2: diz o que faz e que os níveis seguintes ficam para depois, sem prometer data', () => {
    const { watchtower } = known(feud(8 * DAY, 40, 2));
    expect(watchtower).toEqual({
      building: 'watchtower',
      level: 2,
      text: 'Torre de Vigia Nv2: mostra a Ameaça com a explicação, avisa de uma incursão com 2 h de antecedência e diz o tamanho dela. Os níveis seguintes chegam em versões futuras do jogo.',
      next: null,
    });
  });
});

describe('a incursão marcada, vista da Torre', () => {
  // O estado é montado à mão, com a incursão onde o teste a quer. A visão só a mostra dentro
  // da antecedência que o nível da Torre dá. Quem a marca e a resolve: `threat.raids.test.ts`.
  const arrival = 20 * DAY + 3 * HOUR;
  const hunted = (atMs: number, watchtower: number, size: ScheduledRaid['size'] = 'light') =>
    feud(atMs, 55, watchtower, (draft) => {
      draft.horde.scheduledRaids = [raid(arrival, size)];
    });

  it('nível 1: avisa 1 h de jogo antes, sem dizer o tamanho', () => {
    expect(known(hunted(arrival - HOUR - 1, 1)).incoming).toBeNull();
    expect(known(hunted(arrival - HOUR, 1)).incoming).toEqual({
      enemy: 'wolves',
      enemyLabel: 'Lobos',
      inSeconds: 3600,
      sizeText: null,
      text: 'Lobos a caminho. Daqui os vigias ainda não distinguem quantos são.',
      // Sem o tamanho à vista, o custo diz o de cada um.
      costText:
        'Sem defesa, um ataque dos leves leva 10% do estoque de comida e madeira e fere 1 aldeão; um ataque dos médios leva 15% do estoque de comida e madeira e fere 2 aldeões. Quem se fere fica 2 h sem trabalhar.',
      // O que a Paliçada faz a ela está em `palisade.test.ts`.
      defenseText: 'Sem Paliçada, nada segura este ataque.',
    });
    expect(known(hunted(arrival - 10 * MINUTE, 1, 'medium')).incoming).toMatchObject({
      inSeconds: 600,
      sizeText: null,
    });
  });

  it('nível 2: avisa 2 h de jogo antes e diz o tamanho', () => {
    expect(known(hunted(arrival - 2 * HOUR - 1, 2)).incoming).toBeNull();
    expect(known(hunted(arrival - 2 * HOUR, 2)).incoming).toEqual({
      enemy: 'wolves',
      enemyLabel: 'Lobos',
      inSeconds: 7200,
      sizeText: 'uma matilha pequena',
      text: 'Lobos a caminho. Os vigias contam uma matilha pequena.',
      // O estoque inicial: 180 de comida e 120 de madeira.
      costText:
        'Sem defesa, uma matilha pequena leva 10% do estoque de comida e madeira (hoje, 18 de comida e 12 de madeira) e fere 1 aldeão, que fica 2 h sem trabalhar.',
      defenseText: 'Sem Paliçada, nada segura este ataque.',
    });
    expect(known(hunted(arrival - HOUR, 2, 'medium')).incoming).toMatchObject({
      sizeText: 'uma matilha grande',
      text: 'Lobos a caminho. Os vigias contam uma matilha grande.',
    });
  });

  it('o prazo sai em tempo real: no ritmo Rápido, 1 h de jogo são 20 min', () => {
    expect(known(hunted(arrival - HOUR, 1), 3).incoming?.inSeconds).toBe(1200);
    expect(known(hunted(arrival - 2 * HOUR, 2), 0.5).incoming?.inSeconds).toBe(4 * 3600);
  });

  it('sem Torre não há aviso, nem com a incursão a um minuto', () => {
    const blind = view(hunted(arrival - MINUTE, 0));
    expect(blind.known).toBe(false);
    expect(blind.incoming).toBeNull();
    expect(JSON.stringify(blind)).not.toMatch(/matilha|Lobos|caminho/);
  });

  it('com duas marcadas, a visão mostra a que chega primeiro', () => {
    const state = feud(arrival - 30 * MINUTE, 55, 2, (draft) => {
      draft.horde.scheduledRaids = [
        { ...raid(arrival + HOUR, 'medium'), id: 'threat-2' },
        raid(arrival, 'light'),
      ];
    });
    expect(known(state).incoming).toMatchObject({
      inSeconds: 1800,
      sizeText: 'uma matilha pequena',
    });
  });

  it('os avisos de cada nível são os do conteúdo', () => {
    expect(watchtowerPerks(0)).toBeNull();
    expect(watchtowerPerks(1)).toEqual({ warningMs: HOUR, revealsRaidSize: false });
    expect(watchtowerPerks(2)).toEqual({ warningMs: 2 * HOUR, revealsRaidSize: true });
    expect(watchtowerPerks(3)).toBeNull();
  });
});

describe('a Torre de Vigia como obra (GDD §6.1 e §6.2)', () => {
  const rich = (draft: GameState) => {
    draft.settlement.resources = { food: 400_000, wood: 400_000, stone: 400_000, gold: 400_000 };
  };
  const tower = (state: GameState) =>
    deriveViewState(state, state.lastProcessedAt).constructions.available.find(
      (upgrade) => upgrade.building === 'watchtower',
    );

  it('aparece na lista desde o começo, presa ao Salão no nível 2, com o que ela dá ao lado do custo', () => {
    expect(tower(newGame())).toMatchObject({
      label: 'Torre de Vigia',
      fromLevel: 0,
      targetLevel: 1,
      blockedCode: 'GATE_LOCKED',
      blockedReason: 'Melhore antes o Salão do Senhor para o nível 2.',
      durationSeconds: 12 * 60,
      effect: 'Mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
    });
    expect(tower(newGame())?.cost.map((cost) => [cost.resource, cost.amount])).toEqual([
      ['wood', 120],
      ['stone', 120],
      ['gold', 50],
    ]);
    expect(
      refuse(newGame(), command('startConstruction', { building: 'watchtower' })),
    ).toMatchObject({ code: 'GATE_LOCKED' });
  });

  it('com o Salão no nível 2 é erguida pelo custo base, em 12 min, com as frases de quem nasce do zero', () => {
    const start = feud(10 * DAY, 50, 0, rich);
    const started = accept(start, command('startConstruction', { building: 'watchtower' }));
    expect(started.state.settlement.resources).toEqual({
      food: 400_000,
      wood: 280_000,
      stone: 280_000,
      gold: 350_000,
    });
    expect(started.events.map((event) => event.text)).toEqual([
      'No 11º dia da Primavera, os pedreiros começaram a levantar a Torre de Vigia em Pedra Alta.',
    ]);
    const done = advanceTo(started.state, 10 * DAY + 12 * MINUTE);
    expect(done.state.settlement.buildings.watchtower).toBe(1);
    expect(eventsOfType(done.events, 'buildingFounded').map((event) => event.text)).toEqual([
      'No 11º dia da Primavera, ergueu-se a Torre de Vigia em Pedra Alta.',
    ]);
  });

  it('o nível 2 custa o base × 1,6 e leva 18 min; a frase diz só o que muda', () => {
    const state = feud(10 * DAY, 50, 1, rich);
    expect(tower(state)).toMatchObject({
      fromLevel: 1,
      targetLevel: 2,
      blockedCode: null,
      durationSeconds: 18 * 60,
      effect:
        'Aviso de incursão: de 1 h para 2 h de antecedência. Os vigias passam a dizer o tamanho dela.',
    });
    expect(tower(state)?.cost.map((cost) => cost.amount)).toEqual([192, 192, 80]);
    const { state: after, events } = advanceTo(
      accept(state, command('startConstruction', { building: 'watchtower' })).state,
      10 * DAY + 18 * MINUTE,
    );
    expect(after.settlement.buildings.watchtower).toBe(2);
    expect(eventsOfType(events, 'constructionFinished').map((event) => event.text)).toEqual([
      'No 11º dia da Primavera, os pedreiros ergueram a Torre de Vigia ao 2º nível.',
    ]);
  });

  it('no nível 2 sai da lista, e a recusa diz que os níveis seguintes ficam para outra versão', () => {
    const state = feud(10 * DAY, 50, 2, rich);
    expect(buildings.watchtower.maxLevel).toBe(2);
    expect(tower(state)).toBeUndefined();
    const message =
      'A Torre de Vigia já está no nível máximo. Os níveis seguintes chegam em versões futuras do jogo.';
    expect(refuse(state, command('startConstruction', { building: 'watchtower' }))).toEqual({
      code: 'MAX_LEVEL',
      message,
    });
    expect(refuse(state, command('planConstruction', { building: 'watchtower' }))).toEqual({
      code: 'MAX_LEVEL',
      message,
    });
    // Os outros edifícios continuam com a recusa de sempre.
    const top = feud(10 * DAY, 50, 2, (draft) => {
      draft.settlement.buildings.farm = buildings.farm.maxLevel;
    });
    expect(refuse(top, command('planConstruction', { building: 'farm' })).message).toBe(
      'A Fazenda já está no nível máximo.',
    );
  });

  it('no inverno a obra leva uma vez e meia o prazo, como as outras', () => {
    const state = feud(WINTER + HOUR, 50, 0, rich);
    expect(tower(state)).toMatchObject({ durationSeconds: 18 * 60 });
    expect(tower(state)?.durationNote).toContain('Inverno');
  });

  it('quem corre para a Torre a tem antes dos primeiros lobos (dia 16 de jogo), sem passar fome', () => {
    // Um feudo novo, com um lavrador, dois lenhadores e dois canteiros, e as duas obras
    // planejadas como automáticas: o Salão no nível 2 e, liberada por ele, a Torre. Ninguém
    // volta ao feudo. É a conta de "dá tempo?": os uivos são do início do 10º dia e a incursão
    // roteirizada, do início do 16º (ADR 0014, decisão 10).
    let state = newGame();
    for (const order of [
      command('setWorkers', { building: 'farm', count: 1 }),
      command('setWorkers', { building: 'lumberMill', count: 2 }),
      command('setWorkers', { building: 'quarry', count: 2 }),
      command('planConstruction', { building: 'townHall', autoStart: true }),
      command('planConstruction', { building: 'watchtower', autoStart: true }),
    ]) {
      state = accept(state, order).state;
    }
    const { state: after, events } = advanceTo(state, 15 * DAY);
    const founded = events.find(
      (event) => event.type === 'buildingFounded' && event.data.building === 'watchtower',
    );
    expect(after.settlement.buildings).toMatchObject({ townHall: 2, watchtower: 1 });
    expect(after.settlement.famine).toBeNull();
    expect(eventsOfType(events, 'famineStarted')).toEqual([]);
    // Pronta no 8º dia de jogo: antes dos uivos, e a tempo de ver a Ameaça chegar aos 40.
    expect(founded?.atMs).toBeLessThan(9 * DAY);
    expect(Math.floor((founded?.atMs ?? 0) / DAY) + 1).toBe(8);
    expect(eventsOfType(events, 'threatRose').map((event) => event.data.mark)).toEqual([40, 70]);
  });

  it('pode ser planejada como automática e começa sozinha quando o Salão chega ao nível 2', () => {
    const start = gameAt(3 * DAY, (draft) => {
      rich(draft);
      draft.settlement.constructionQueues[0] = {
        building: 'townHall',
        targetLevel: 2,
        startedAtMs: 3 * DAY - 5 * MINUTE,
        finishesAtMs: 3 * DAY + 5 * MINUTE,
      };
    });
    const planned = accept(
      start,
      command('planConstruction', { building: 'watchtower', autoStart: true }),
    ).state;
    const { state, events } = advanceTo(planned, 3 * DAY + 20 * MINUTE);
    expect(
      eventsOfType(events, 'constructionAutoStarted').map((event) => [event.atMs, event.text]),
    ).toEqual([
      [
        3 * DAY + 5 * MINUTE,
        'No 4º dia da Primavera, com as reservas cheias, os pedreiros começaram sozinhos a levantar a Torre de Vigia em Pedra Alta.',
      ],
    ]);
    expect(state.settlement.buildings.watchtower).toBe(1);
    expect(view(state).known).toBe(true);
  });
});
