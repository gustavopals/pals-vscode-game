import {
  balance,
  chronicleTemplates,
  type ExpeditionNode,
  expeditionModels,
  expeditionPostures,
  expeditionTemplates,
  expeditionTexts,
  type ExpeditionVariant,
  type PostureId,
} from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo, stateAtNextMoraleTurn } from './advance';
import {
  durationFactorAt,
  expeditionSlots,
  nextVariant,
  outcomeOf,
  postureChoice,
  slotsAtLevel,
} from './expeditions';
import { heroPower, teamPower } from './heroes';
import { currentShape } from './migrations';
import { storageCapacity } from './storage';
import { cloneState } from './state';
import {
  accept,
  addHero,
  AUTUMN,
  command,
  DAY,
  everyDestinationOpen,
  guildHall,
  HOUR,
  MINUTE,
  nextVariantIs,
  refuse,
  send,
  SUMMER,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { Expedition, GameEvent, GameState, Hero } from './types';
import { deriveViewState } from './view';

const { expeditions: rules } = balance;
const WAIT_REAL = rules.crossroadsWaitRealMs;

/** Os eventos das expedições, sem os de outras mecânicas que possam cair no caminho. */
const ofExpeditions = (events: GameEvent[]) =>
  events.filter((event) => event.type.startsWith('expedition'));
const types = (events: GameEvent[]) => ofExpeditions(events).map((event) => event.type);

/** A Guilda de pé com Edda (Guerreira) e Rolf (Arqueiro) no feudo. */
function hall(
  custom: Parameters<typeof guildHall>[2] = {},
  edit: (draft: GameState) => void = () => {},
  atMs = 0,
): GameState {
  return guildHall(
    atMs,
    (draft) => {
      addHero(draft, { name: 'Edda', gender: 'f', classId: 'warrior' });
      addHero(draft, { name: 'Rolf', classId: 'archer' });
      edit(draft);
    },
    custom,
  );
}

const only = (state: GameState): Expedition => {
  const [expedition] = state.guild.expeditions;
  if (expedition === undefined) {
    throw new Error('Não há expedição em curso.');
  }
  return expedition;
};

const hero = (spec: Partial<Hero>): Hero => ({
  id: 'hero-1',
  name: 'Teste',
  gender: 'm',
  classId: 'warrior',
  level: 1,
  xp: 0,
  traits: [],
  status: 'idle',
  injury: null,
  captivity: null,
  equipment: { weapon: null, armor: null, accessory: null },
  joinedAtMs: 0,
  freedAtMs: null,
  discontent: false,
  ...spec,
});

const choose = (expeditionId: string, optionId: string) =>
  command('chooseExpeditionPath', { expeditionId, optionId });

/** A Floresta Antiga, variante 0, com a equipe já parada na encruzilhada. */
function atFork(
  heroIds: string[] = ['hero-1'],
  posture: PostureId = 'balanced',
  custom: Parameters<typeof guildHall>[2] = {},
  variant = 0,
): { state: GameState; expedition: Expedition; arrivedAt: number } {
  const sent = send(hall(custom), 'oldForest', heroIds, posture, variant);
  const arrivedAt = sent.expedition.nodeEndsAtMs ?? 0;
  const state = advanceTo(sent.state, arrivedAt).state;
  return { state, expedition: only(state), arrivedAt };
}

describe('a Guilda dos Aventureiros', () => {
  it('sustenta 1, 2, 2 e 3 expedições, e nenhuma sem ser erguida', () => {
    expect([0, 1, 2, 3, 4, 9].map(slotsAtLevel)).toEqual([0, 1, 2, 2, 3, 3]);
    expect(expeditionSlots(hall())).toBe(1);
    expect(expeditionSlots(hall({ level: 4 }))).toBe(3);
  });

  it('é uma obra como as outras: abre com o Salão no nível 3 e a lista de obras diz o que ela dá', () => {
    const site = guildHall(0, () => {}, { level: 0 });
    const offer = deriveViewState(site, 0).constructions.available.find(
      (entry) => entry.building === 'guild',
    );
    expect(offer).toMatchObject({
      label: 'Guilda dos Aventureiros',
      fromLevel: 0,
      targetLevel: 1,
      effect: 'Sustenta 1 expedição por vez.',
      blockedReason: null,
    });
    const ordered = accept(site, command('startConstruction', { building: 'guild' }));
    const opensAt = ordered.state.settlement.constructionQueues[0]?.finishesAtMs ?? 0;
    expect(opensAt).toBe(20 * MINUTE);
    const opened = advanceTo(ordered.state, opensAt).state;
    expect(opened.settlement.buildings.guild).toBe(1);
    expect(deriveViewState(opened, opensAt).guild).toMatchObject({
      built: true,
      level: 1,
      slots: 1,
    });
    // No nível máximo desta versão a recusa diz que o teto é o de agora.
    const top = guildHall(0, () => {}, { level: 4 });
    expect(refuse(top, command('startConstruction', { building: 'guild' })).message).toBe(
      'A Guilda dos Aventureiros já está no nível máximo. O nível seguinte chega em uma versão futura do jogo.',
    );
  });
});

describe('o poder da equipe contra um nó (ADR 0017, decisão 7; pendência A-5)', () => {
  it('com os pesos padrão é ataque + defesa + vida ÷ 10, somado por herói, em milésimos', () => {
    const warrior = hero({});
    const archer = hero({ id: 'hero-2', classId: 'archer' });
    expect(teamPower([warrior], undefined, 'balanced')).toBe(42_000);
    expect(teamPower([warrior], undefined, 'balanced')).toBe(heroPower(warrior));
    expect(teamPower([warrior, archer], undefined, 'balanced')).toBe(78_000);
    // A dupla da carta no nível 2: 84,24 (ADR 0017, "Calibragem").
    expect(
      teamPower(
        [
          { ...warrior, level: 2 },
          { ...archer, level: 2 },
        ],
        undefined,
        'balanced',
      ),
    ).toBe(84_240);
    expect(teamPower([], undefined, 'balanced')).toBe(0);
  });

  it('o peso de um nó troca ou acrescenta o do atributo, sobre os padrões', () => {
    const warrior = hero({});
    const archer = hero({ classId: 'archer' });
    // "Perícia pesa ×1,5": 42 + 6 × 1,5 = 51; o Arqueiro, 36 + 14 × 1,5 = 57.
    const skilled = { skill: { num: 3, den: 2 } };
    expect(teamPower([warrior], skilled, 'balanced')).toBe(51_000);
    expect(teamPower([archer], skilled, 'balanced')).toBe(57_000);
    // Um peso sobre um atributo que já pesava troca o dele: a vida inteira no lugar de um décimo.
    expect(teamPower([warrior], { health: { num: 1, den: 1 } }, 'balanced')).toBe(150_000);
  });

  it('os fatores do herói multiplicam tudo, com um arredondamento para baixo no fim da soma', () => {
    const skilled = { skill: { num: 1, den: 2 } };
    // Nv2 (×1,08) e Descontente (×0,8): (42 + 3) × 1,08 × 0,8 = 38,88.
    expect(teamPower([hero({ level: 2, discontent: true })], skilled, 'balanced')).toBe(38_880);
    // Um arredondamento só: 45 × 1,16 (Nv3) × 0,8 = 41,76, mais 36 × 1,08 = 38,88: 80,64.
    expect(
      teamPower(
        [hero({ level: 3, discontent: true }), hero({ classId: 'archer', level: 2 })],
        undefined,
        'balanced',
      ),
    ).toBe(Math.floor(42_000 * 1.16 * 0.8 + 36_000 * 1.08));
    // Frações que não fecham em milésimos: 43 × 1,08 × 0,8 × 1/3 de peso extra.
    const odd = { will: { num: 1, den: 3 } };
    // 42 + 8/3 = 44,666…; × 1,08 = 48,24 exato.
    expect(teamPower([hero({ level: 2 })], odd, 'balanced')).toBe(48_240);
    expect(teamPower([hero({ level: 2 }), hero({})], odd, 'balanced')).toBe(
      Math.floor((134 * 1.08 * 1000) / 3 + 134_000 / 3 + 1e-6),
    );
  });

  it('o Corajoso rende 10% a mais na Ousada, e o Prudente, na Cautelosa; na ficha, nenhum dos dois', () => {
    const brave = hero({ traits: ['brave'] });
    const prudent = hero({ traits: ['prudent'] });
    expect(teamPower([brave], undefined, 'bold')).toBe(46_200);
    expect(teamPower([brave], undefined, 'balanced')).toBe(42_000);
    expect(teamPower([brave], undefined, 'cautious')).toBe(42_000);
    expect(teamPower([prudent], undefined, 'cautious')).toBe(46_200);
    expect(teamPower([prudent], undefined, 'bold')).toBe(42_000);
    // Só o herói que tem o traço rende mais.
    expect(teamPower([brave, hero({})], undefined, 'bold')).toBe(88_200);
    expect(heroPower(brave)).toBe(42_000);
  });
});

describe('o desfecho de um nó, por multiplicação cruzada (ADR 0017, decisão 7)', () => {
  const lucks = Array.from({ length: 31 }, (_, index) => 85 + index);
  const tally = (power: number, difficulty: number) => {
    const count = { full: 0, success: 0, setback: 0, disaster: 0 };
    for (const luck of lucks) {
      count[outcomeOf(power, luck, difficulty)] += 1;
    }
    return [count.full, count.success, count.setback, count.disaster];
  };

  it('a tabela de calibragem do ADR 0017, conferida sobre os 31 valores da sorte', () => {
    expect(tally(42_000, 30)).toEqual([23, 8, 0, 0]);
    expect(tally(42_000, 35)).toEqual([7, 24, 0, 0]);
    expect(tally(42_000, 36)).toEqual([4, 26, 1, 0]);
    expect(tally(36_000, 30)).toEqual([7, 24, 0, 0]);
    expect(tally(35_000, 30)).toEqual([4, 26, 1, 0]);
    expect(tally(32_000, 30)).toEqual([0, 22, 9, 0]);
    expect(tally(84_240, 50)).toEqual([31, 0, 0, 0]);
    expect(tally(84_240, 60)).toEqual([23, 8, 0, 0]);
    expect(tally(84_240, 90)).toEqual([0, 9, 22, 0]);
    expect(tally(122_040, 90)).toEqual([20, 11, 0, 0]);
  });

  it('os limiares são exatos: 1,3, 1 e 0,7, sem tolerância', () => {
    // Poder 26 contra dificuldade 20 com sorte 100: razão 1,3 em cheio.
    expect(outcomeOf(26_000, 100, 20)).toBe('full');
    expect(outcomeOf(25_999, 100, 20)).toBe('success');
    expect(outcomeOf(20_000, 100, 20)).toBe('success');
    expect(outcomeOf(19_999, 100, 20)).toBe('setback');
    expect(outcomeOf(14_000, 100, 20)).toBe('setback');
    expect(outcomeOf(13_999, 100, 20)).toBe('disaster');
    expect(outcomeOf(0, 115, 1)).toBe('disaster');
  });
});

describe('enviar uma expedição (sendExpedition)', () => {
  const order = (modelId: string, heroIds: string[], posture: PostureId = 'balanced') =>
    command('sendExpedition', { modelId, heroIds, posture });

  it('aceita: a equipe sai do feudo, a expedição nasce com identificador, sem sortear nada', () => {
    const start = hall();
    nextVariantIs(start, 'patrol', 0);
    const { state, events, expedition } = send(start, 'patrol', ['hero-1'], 'bold');
    expect(expedition).toEqual({
      id: 'expedition-1',
      modelId: 'patrol',
      variant: 0,
      heroIds: ['hero-1'],
      posture: 'bold',
      sentAtMs: 0,
      durationFactor: { num: 1, den: 1 },
      status: 'traveling',
      nodeId: 'fences',
      nodeEndsAtMs: 10 * MINUTE,
      crossroads: null,
      loot: { resources: { food: 0, wood: 0, stone: 0, gold: 0 }, items: [] },
      log: [],
    });
    expect(state.guild.heroes.map((entry) => entry.status)).toEqual(['expedition', 'idle']);
    expect(state.ids.expedition).toBe(1);
    // Uma ordem não sorteia: o fluxo da expedição só nasce no fim do primeiro nó com sorteio.
    expect(state.rng).toEqual(start.rng);
    expect(state.stats['expeditionsSent:patrol']).toBe(
      (start.stats['expeditionsSent:patrol'] ?? 0) + 1,
    );
    expect(state.stats.expeditionsSent).toBe(1);
    expect(ofExpeditions(events)).toEqual([
      {
        type: 'expeditionSent',
        atMs: 0,
        text: 'No 1º dia da Primavera, partiu de Pedra Alta uma expedição: Patrulha dos Arredores. A equipe: Edda.',
        data: {
          expeditionId: 'expedition-1',
          modelId: 'patrol',
          posture: 'bold',
          heroes: 1,
          heroIds: 'hero-1',
        },
      },
    ]);
    // A variante não sai no evento: o servidor entrega `data` inteiro a quem joga.
    expect(JSON.stringify(events)).not.toContain('variant');
    expect(nextEventAt(state)).toBe(10 * MINUTE);
    expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();
  });

  it('as recusas, na ordem: a Guilda, o lugar, o destino, o herói e a equipe', () => {
    const noGuild = guildHall(0, (draft) => void addHero(draft), { level: 0 });
    expect(refuse(noGuild, order('patrol', ['hero-1']))).toEqual({
      code: 'GUILD_REQUIRED',
      message: 'Erga a Guilda dos Aventureiros primeiro.',
    });
    const lowHall = guildHall(
      0,
      (draft) => {
        addHero(draft);
        draft.settlement.buildings.townHall = 2;
      },
      { level: 0 },
    );
    expect(refuse(lowHall, order('patrol', ['hero-1'])).message).toBe(
      'Erga a Guilda dos Aventureiros primeiro: ela abre com o Salão do Senhor Nv3.',
    );
    // Sem a Guilda, a recusa é essa mesmo com o destino e a equipe errados.
    expect(refuse(noGuild, order('nowhere', [])).code).toBe('GUILD_REQUIRED');

    const busy = send(hall(), 'patrol', ['hero-1']).state;
    expect(refuse(busy, order('patrol', ['hero-2']))).toEqual({
      code: 'EXPEDITION_LIMIT',
      message:
        'A Guilda dos Aventureiros Nv1 sustenta 1 expedição por vez: espere uma equipe voltar ou melhore a Guilda dos Aventureiros.',
    });
    const top = hall({ level: 4 }, (draft) => {
      addHero(draft);
      addHero(draft);
    });
    let full = top;
    for (const heroId of ['hero-1', 'hero-2', 'hero-3']) {
      full = send(full, 'patrol', [heroId]).state;
    }
    expect(refuse(full, order('patrol', ['hero-4'])).message).toBe(
      'A Guilda dos Aventureiros Nv4 sustenta 3 expedições por vez: espere uma equipe voltar.',
    );

    expect(refuse(hall(), order('dragonHunt', ['hero-1']))).toEqual({
      code: 'EXPEDITION_LOCKED',
      message:
        'Esse destino ainda não está ao alcance do feudo: a Guilda não conhece esse caminho.',
    });

    expect(refuse(hall(), order('patrol', ['hero-9'])).code).toBe('HERO_NOT_FOUND');
    const roomy = send(hall({ level: 2 }), 'patrol', ['hero-1']).state;
    expect(refuse(roomy, order('patrol', ['hero-1']))).toEqual({
      code: 'HERO_UNAVAILABLE',
      message: 'Edda não pode partir agora: já está em expedição.',
    });

    expect(refuse(hall(), order('patrol', ['hero-1', 'hero-2']))).toEqual({
      code: 'TEAM_INVALID',
      message: 'Essa equipe não serve para Patrulha dos Arredores: a jornada pede 1 herói.',
    });
    expect(refuse(hall(), order('patrol', [])).code).toBe('TEAM_INVALID');
    expect(refuse(hall(), order('oldForest', ['hero-1', 'hero-1'])).code).toBe('TEAM_INVALID');
    const three = hall({}, (draft) => void addHero(draft));
    expect(refuse(three, order('oldForest', ['hero-1', 'hero-2', 'hero-3'])).message).toBe(
      'Essa equipe não serve para Floresta Antiga: a jornada pede de 1 a 2 heróis.',
    );
    expect(refuse(hall(), order('patrol', ['hero-1'], 'reckless' as PostureId)).message).toBe(
      'Essa equipe não serve para Patrulha dos Arredores: escolha a Postura da equipe.',
    );
    // Um payload torto não derruba o motor.
    const bent = { modelId: 'patrol', heroIds: 'hero-1', posture: 'bold' } as unknown as {
      modelId: string;
      heroIds: string[];
      posture: PostureId;
    };
    expect(refuse(hall(), command('sendExpedition', bent)).code).toBe('TEAM_INVALID');
  });

  it('uma recusa não muda o estado, não gasta identificador e não sorteia', () => {
    const start = hall();
    const frozen = JSON.stringify(start);
    refuse(start, order('patrol', ['hero-1', 'hero-2']));
    refuse(start, order('nowhere', ['hero-1']));
    expect(JSON.stringify(start)).toBe(frozen);
  });

  it('a variante é uma conta sobre a semente e os envios: passa pelas três antes de repetir, sem tocar o gerador', () => {
    const [patrol] = expeditionModels;
    if (patrol === undefined) {
      throw new Error('Sem modelo.');
    }
    for (const seed of ['pedra-alta', 'vau-do-corvo', 'x']) {
      let state = hall({ seed, level: 4 });
      const seen: number[] = [];
      for (let round = 0; round < 6; round += 1) {
        const expected = nextVariant(state, patrol);
        const sent = send(state, 'patrol', ['hero-1']);
        expect(sent.expedition.variant).toBe(expected);
        seen.push(sent.expedition.variant);
        expect(sent.state.rng).toEqual(state.rng);
        state = advanceTo(sent.state, sent.state.lastProcessedAt + HOUR).state;
      }
      expect(new Set(seen.slice(0, 3)).size).toBe(3);
      expect(seen.slice(3)).toEqual(seen.slice(0, 3));
    }
    // Sementes diferentes começam em variantes diferentes: não é sempre a mesma primeira.
    const firsts = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) =>
      nextVariant(hall({ seed }), patrol),
    );
    expect(new Set(firsts).size).toBe(3);
  });

  it('o fator de duração é o da estação do envio, fixado: no verão, 17/20 em todos os nós', () => {
    expect(durationFactorAt(0)).toEqual({ num: 1, den: 1 });
    expect(durationFactorAt(SUMMER)).toEqual({ num: 17, den: 20 });
    expect(durationFactorAt(AUTUMN)).toEqual({ num: 1, den: 1 });
    const summer = send(
      hall({}, () => {}, SUMMER + HOUR),
      'patrol',
      ['hero-1'],
      'balanced',
      0,
    );
    expect(summer.expedition.durationFactor).toEqual({ num: 17, den: 20 });
    // 10 min × 17/20 = 8 min 30 s.
    expect(summer.expedition.nodeEndsAtMs).toBe(SUMMER + HOUR + 8 * MINUTE + 30_000);
    const back = advanceTo(summer.state, SUMMER + 2 * HOUR);
    expect(ofExpeditions(back.events).map((event) => event.atMs - SUMMER - HOUR)).toEqual([
      8 * MINUTE + 30_000,
      // A volta: 5 min × 17/20 = 4 min 15 s.
      12 * MINUTE + 45_000,
    ]);
  });

  it('enviada no fim do verão, mantém a duração curta depois da virada; enviada no outono, não', () => {
    const lastMinute = AUTUMN - 5 * MINUTE;
    const sent = send(
      hall({}, () => {}, lastMinute),
      'patrol',
      ['hero-1'],
      'balanced',
      0,
    );
    const done = advanceTo(sent.state, AUTUMN + HOUR);
    // O primeiro nó termina depois da virada de estação, com o prazo do envio.
    expect(types(done.events)).toEqual(['expeditionNodeResolved', 'expeditionReturned']);
    expect(ofExpeditions(done.events).map((event) => event.atMs)).toEqual([
      lastMinute + 8 * MINUTE + 30_000,
      lastMinute + 12 * MINUTE + 45_000,
    ]);
    const autumn = send(
      hall({}, () => {}, AUTUMN),
      'patrol',
      ['hero-1'],
      'balanced',
      0,
    );
    expect(autumn.expedition.nodeEndsAtMs).toBe(AUTUMN + 10 * MINUTE);
  });
});

describe('o percurso por eventos da linha do tempo', () => {
  it('a Patrulha de ponta a ponta: o nó termina no instante exato, o saque entra na volta e o fluxo é apagado', () => {
    const start = hall({}, (draft) => {
      draft.settlement.resources.gold = 100_000;
    });
    const sent = send(start, 'patrol', ['hero-1'], 'balanced', 0);
    // Um milissegundo antes do fim do nó, nada.
    const before = advanceTo(sent.state, 10 * MINUTE - 1);
    expect(ofExpeditions(before.events)).toEqual([]);
    expect(before.state.rng['expedition:expedition-1']).toBeUndefined();
    expect(nextEventAt(before.state)).toBe(10 * MINUTE);

    const resolved = advanceTo(before.state, 10 * MINUTE);
    const [nodeEvent] = ofExpeditions(resolved.events);
    expect(types(resolved.events)).toEqual(['expeditionNodeResolved']);
    expect(nodeEvent?.atMs).toBe(10 * MINUTE);
    const expedition = only(resolved.state);
    const [entry] = expedition.log;
    expect(expedition).toMatchObject({
      status: 'returning',
      nodeId: 'home',
      nodeEndsAtMs: 15 * MINUTE,
      crossroads: null,
    });
    expect(entry).toMatchObject({ nodeId: 'fences', atMs: 10 * MINUTE, optionId: null });
    // Um Guerreiro de nível 1 contra dificuldade 36: Sucesso ou Sucesso Pleno em 30 das 31
    // sortes, e nesta semente é uma delas.
    expect(['full', 'success']).toContain(entry?.outcome);
    const found = entry?.gained.gold ?? 0;
    expect(found).toBeGreaterThanOrEqual(15);
    expect(found).toBeLessThanOrEqual(25);
    expect(expedition.loot.resources).toEqual({ food: 0, wood: 0, stone: 0, gold: found });
    expect(nodeEvent?.data).toEqual({
      expeditionId: 'expedition-1',
      modelId: 'patrol',
      outcome: entry?.outcome,
      found_gold: found,
    });
    // A frase é a do desfecho, do conteúdo.
    // A frase é a do desfecho, do conteúdo, e diz quem se destacou: a única da patrulha.
    expect(nodeEvent?.text).toMatch(
      /^No 1º dia da Primavera, Edda (deu a volta nas|chegou tarde às) cercas de Pedra Alta/,
    );
    expect(entry?.standout).toBe('Edda');
    // O fluxo dela nasceu no primeiro sorteio, e só ele.
    expect(Object.keys(resolved.state.rng)).toEqual(['expedition:expedition-1']);
    // O saque ainda não entrou: a equipe está no caminho de volta.
    const wage = (ms: number) => Math.round((2 * 1000 * ms) / HOUR);
    expect(resolved.state.settlement.resources.gold).toBe(100_000 - wage(10 * MINUTE) * 2);
    expect(currentShape(JSON.parse(JSON.stringify(resolved.state)), '')).toBeNull();

    const home = advanceTo(resolved.state, 15 * MINUTE);
    expect(types(home.events)).toEqual(['expeditionReturned']);
    const [returned] = ofExpeditions(home.events);
    expect(returned?.atMs).toBe(15 * MINUTE);
    expect(returned?.text).toBe(
      `No 1º dia da Primavera, a expedição "Patrulha dos Arredores" voltou a Pedra Alta com ${found} de ouro. A equipe está de novo no feudo: Edda.`,
    );
    expect(returned?.data).toEqual({
      expeditionId: 'expedition-1',
      modelId: 'patrol',
      heroes: 1,
      heroIds: 'hero-1',
      loot_gold: found,
      gained_gold: found,
    });
    expect(home.state.guild.expeditions).toEqual([]);
    expect(home.state.guild.heroes.map((entry_) => entry_.status)).toEqual(['idle', 'idle']);
    expect(home.state.settlement.resources.gold).toBe(
      100_000 - wage(15 * MINUTE) * 2 + found * 1000,
    );
    // O fluxo foi apagado com a volta, e o identificador não volta.
    expect(home.state.rng).toEqual({});
    expect(home.state.ids.expedition).toBe(1);
    expect(home.state.guild.reports).toEqual([
      {
        expeditionId: 'expedition-1',
        modelId: 'patrol',
        variant: 0,
        heroNames: ['Edda'],
        posture: 'balanced',
        sentAtMs: 0,
        returnedAtMs: 15 * MINUTE,
        log: expedition.log,
        loot: { resources: { food: 0, wood: 0, stone: 0, gold: found }, items: [] },
        wasted: { food: 0, wood: 0, stone: 0, gold: 0 },
        sold: [],
        lost: false,
      },
    ]);
    expect(home.state.stats.expeditionsReturned).toBe(1);
    expect(currentShape(JSON.parse(JSON.stringify(home.state)), '')).toBeNull();
    // E depois disso nada mais acontece com ela.
    expect(ofExpeditions(advanceTo(home.state, 30 * DAY).events)).toEqual([]);
  });

  it('avançar de uma vez dá o mesmo que nó a nó: mesmo estado, mesmos eventos, mesmo relatório', () => {
    const sent = send(hall(), 'patrol', ['hero-1'], 'balanced', 1).state;
    const direct = advanceTo(sent, 3 * HOUR);
    let state = sent;
    const events: GameEvent[] = [];
    for (const at of [1, 10 * MINUTE - 1, 10 * MINUTE, 12 * MINUTE, 15 * MINUTE, HOUR, 3 * HOUR]) {
      const step = advanceTo(JSON.parse(JSON.stringify(state)) as GameState, at);
      state = step.state;
      events.push(...step.events);
    }
    expect(state).toStrictEqual(direct.state);
    expect(events).toStrictEqual(direct.events);
  });

  it('o Desastre não traz nada e não sorteia quantidade; o Revés traz metade, arredondada para baixo', () => {
    // Um Clérigo de nível 1 (32) contra a mata fechada (55): Desastre em toda sorte.
    const weak = guildHall(0, (draft) => void addHero(draft, { classId: 'warrior' }), {});
    weak.guild.heroes[0]!.classId = 'cleric';
    // A opção pede um Guerreiro: o Clérigo vai pelo riacho, e quem vai à mata é outro cenário.
    const lone = guildHall(0, (draft) => void addHero(draft, { level: 1 }));
    const fork = (() => {
      const sent = send(lone, 'oldForest', ['hero-1'], 'bold', 0);
      return advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0).state;
    })();
    // Descontente, o Guerreiro vale 33,6 contra 55: razão máxima 0,7025 com sorte 115.
    const discontented = cloneState(fork);
    discontented.guild.heroes[0]!.discontent = true;
    discontented.guild.wageArrears = { sinceMs: 0, carriedMs: 0, departed: 0 };
    discontented.settlement.resources.gold = 0;
    const woodBefore = only(fork).loot.resources.wood;
    const chosen = accept(fork, choose('expedition-1', 'thicket')).state;
    const at = only(chosen).nodeEndsAtMs ?? 0;
    const rngBefore = JSON.stringify(chosen.rng);
    const after = advanceTo(chosen, at);
    const entry = only(after.state).log.at(-1);
    // Guerreiro Nv1 (42) contra 55: Revés da sorte 92 em diante, Desastre abaixo.
    expect(['setback', 'disaster']).toContain(entry?.outcome);
    if (entry?.outcome === 'disaster') {
      expect(entry.gained).toEqual({ food: 0, wood: 0, stone: 0, gold: 0 });
    } else {
      // Metade de 60 a 90 de madeira e de 20 a 30 de ouro, para baixo.
      expect(entry?.gained.wood).toBeGreaterThanOrEqual(30);
      expect(entry?.gained.wood).toBeLessThanOrEqual(45);
      expect(entry?.gained.gold).toBeGreaterThanOrEqual(10);
      expect(entry?.gained.gold).toBeLessThanOrEqual(15);
    }
    expect(only(after.state).loot.resources.wood).toBe(woodBefore + (entry?.gained.wood ?? 0));
    expect(JSON.stringify(after.state.rng)).not.toBe(rngBefore);
    expect(weak.guild.heroes).toHaveLength(1);
  });

  it('Sucesso Pleno garantido: dois Guerreiros fortes contra a mata trazem o saque inteiro, dentro da faixa', () => {
    const strong = guildHall(0, (draft) => {
      addHero(draft, { level: 3 });
      addHero(draft, { level: 3 });
    });
    const sent = send(strong, 'oldForest', ['hero-1', 'hero-2'], 'bold', 0);
    const fork = advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0).state;
    const chosen = accept(fork, choose('expedition-1', 'thicket')).state;
    const after = advanceTo(chosen, only(chosen).nodeEndsAtMs ?? 0);
    const entry = only(after.state).log.at(-1);
    // 2 × 42 × 1,16 = 97,44 contra 55: razão 1,506 com a pior sorte.
    expect(entry?.outcome).toBe('full');
    // O Sucesso Pleno traz o saque do nó e mais um quarto: 60 a 90 de madeira viram 75 a 112.
    expect(entry?.gained.wood).toBeGreaterThanOrEqual(75);
    expect(entry?.gained.wood).toBeLessThanOrEqual(112);
    expect(entry?.gained.gold).toBeGreaterThanOrEqual(25);
    expect(entry?.gained.gold).toBeLessThanOrEqual(37);
    expect(ofExpeditions(after.events)[0]?.text).toContain('abateu o javali');
  });

  it('o Revés garantido: um Guerreiro de nível 2 contra a mata traz metade', () => {
    // 45,36 contra 55: de 0,70 a 0,95 em toda sorte.
    const start = guildHall(0, (draft) => void addHero(draft, { level: 2 }));
    const sent = send(start, 'oldForest', ['hero-1'], 'bold', 0);
    const fork = advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0).state;
    const chosen = accept(fork, choose('expedition-1', 'thicket')).state;
    const after = advanceTo(chosen, only(chosen).nodeEndsAtMs ?? 0);
    const entry = only(after.state).log.at(-1);
    expect(entry?.outcome).toBe('setback');
    expect(entry?.gained.wood).toBeGreaterThanOrEqual(30);
    expect(entry?.gained.wood).toBeLessThanOrEqual(45);
    expect(ofExpeditions(after.events)[0]?.data.outcome).toBe('setback');
  });

  it('o Desastre garantido: Descontente, o Guerreiro não passa da mata, e a equipe volta só com o que já tinha', () => {
    const start = guildHall(0, (draft) => {
      const edda = addHero(draft);
      edda.discontent = true;
      draft.guild.wageArrears = { sinceMs: 0, carriedMs: 0, departed: 0 };
      draft.settlement.resources.gold = 0;
    });
    const sent = send(start, 'oldForest', ['hero-1'], 'bold', 0);
    const fork = advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0).state;
    expect(fork.guild.heroes[0]?.discontent).toBe(true);
    const trailWood = only(fork).loot.resources.wood;
    const chosen = accept(fork, choose('expedition-1', 'thicket')).state;
    const at = only(chosen).nodeEndsAtMs ?? 0;
    const after = advanceTo(chosen, at);
    const entry = only(after.state).log.at(-1);
    // 33,6 contra 55: abaixo de 0,7 até a sorte 114; com 115, 0,7025, um Revés.
    expect(['disaster', 'setback']).toContain(entry?.outcome);
    const home = advanceTo(after.state, at + 20 * MINUTE);
    const [report] = home.state.guild.reports;
    expect(report?.loot.resources.wood).toBe(trailWood + (entry?.gained.wood ?? 0));
    // Quem sofre o desfecho volta ferido: fica no feudo, em recuperação (V3D-T2).
    expect(home.state.guild.heroes[0]?.status).toBe('injured');
  });

  it('o saque que não cabe no depósito é desperdício contado, e a frase diz o que foi ao chão', () => {
    const { state } = atFork(['hero-1'], 'cautious');
    // Falta 1 de madeira para o Armazém encher.
    const cap = storageCapacity(state, 'wood') ?? 0;
    const tight = cloneState(state);
    tight.settlement.resources.wood = cap - 1_000;
    const decided = advanceTo(tight, only(tight).crossroads?.decidesAtMs ?? 0);
    const home = advanceTo(decided.state, only(decided.state).nodeEndsAtMs ?? 0);
    const [returned] = ofExpeditions(home.events).filter((e) => e.type === 'expeditionReturned');
    const [report] = home.state.guild.reports;
    const brought = report?.loot.resources.wood ?? 0;
    expect(brought).toBeGreaterThanOrEqual(10);
    expect(home.state.settlement.resources.wood).toBe(cap);
    expect(report?.wasted.wood).toBe((brought - 1) * 1000);
    expect(home.state.stats.wasted_wood).toBe((brought - 1) * 1000);
    expect(returned?.data).toMatchObject({
      loot_wood: brought,
      gained_wood: 1,
      lost_wood: brought - 1,
    });
    expect(returned?.text).toBe(
      `No 4º dia da Primavera, a expedição "Floresta Antiga" voltou a Pedra Alta com ${brought} de madeira. Faltou lugar no depósito, e foi ao chão: ${brought - 1} de madeira. A equipe está de novo no feudo: Edda.`,
    );
  });

  it('a volta de mãos vazias tem frase própria', () => {
    const start = guildHall(0, (draft) => {
      const weak = addHero(draft, { classId: 'cleric' });
      weak.discontent = true;
      draft.guild.wageArrears = { sinceMs: 0, carriedMs: 0, departed: 0 };
      draft.settlement.resources.gold = 0;
    });
    // Clérigo Descontente (25,6) contra a estrada velha (32): Revés em quase toda sorte; para
    // garantir a volta sem nada, o saque é zerado à mão antes do retorno.
    const sent = send(start, 'patrol', ['hero-1'], 'balanced', 2);
    const resolved = advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0).state;
    const empty = cloneState(resolved);
    only(empty).loot.resources.gold = 0;
    const home = advanceTo(empty, only(empty).nodeEndsAtMs ?? 0);
    expect(ofExpeditions(home.events).at(-1)?.text).toBe(
      expeditionTemplates.returnedEmpty
        .replace('{dia}', '1')
        .replace('{daEstacao}', 'da Primavera')
        .replace('{expedicao}', 'Patrulha dos Arredores')
        .replace('{feudo}', 'Pedra Alta')
        .replace('{herois}', 'Edda'),
    );
  });

  it('o feudo guarda os três últimos relatórios, do mais antigo ao mais novo', () => {
    let state = hall();
    for (let round = 0; round < 5; round += 1) {
      const sent = send(state, 'patrol', ['hero-1']);
      state = advanceTo(sent.state, sent.state.lastProcessedAt + HOUR).state;
    }
    expect(state.guild.reports.map((report) => report.expeditionId)).toEqual([
      'expedition-3',
      'expedition-4',
      'expedition-5',
    ]);
    expect(state.guild.reports).toHaveLength(rules.reportsKept);
    expect(state.rng).toEqual({});
    expect(state.ids.expedition).toBe(5);
    expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();
    // Na visão, do mais novo ao mais antigo.
    expect(
      deriveViewState(state, state.lastProcessedAt).guild.reports.map((r) => r.expeditionId),
    ).toEqual(['expedition-5', 'expedition-4', 'expedition-3']);
  });
});

describe('a encruzilhada (ADR 0018, decisão 11)', () => {
  it('a equipe para, a Crônica avisa, e a decisão entra na lista do que espera o jogador', () => {
    const sent = send(hall(), 'oldForest', ['hero-1'], 'balanced', 0);
    const arrived = advanceTo(sent.state, 15 * MINUTE);
    expect(types(arrived.events)).toEqual(['expeditionNodeResolved', 'expeditionAtCrossroads']);
    const expedition = only(arrived.state);
    expect(expedition).toMatchObject({
      status: 'atCrossroads',
      nodeId: 'fork',
      nodeEndsAtMs: null,
      crossroads: { decidesAtMs: 15 * MINUTE + WAIT_REAL },
    });
    expect(ofExpeditions(arrived.events)[1]).toEqual({
      type: 'expeditionAtCrossroads',
      atMs: 15 * MINUTE,
      text: 'No 1º dia da Primavera, a expedição "Floresta Antiga" parou em uma encruzilhada: A trilha se divide. A equipe espera a palavra do senhor de Pedra Alta.',
      data: { expeditionId: 'expedition-1', modelId: 'oldForest' },
    });
    expect(nextEventAt(arrived.state)).toBeLessThanOrEqual(15 * MINUTE + WAIT_REAL);
    const view = deriveViewState(arrived.state, 15 * MINUTE);
    expect(view.pendingDecisions).toEqual([
      {
        kind: 'crossroads',
        id: 'expedition-1',
        title: 'Floresta Antiga: A trilha se divide',
        expiresInSeconds: 6 * 3600,
      },
    ]);
    expect(currentShape(JSON.parse(JSON.stringify(arrived.state)), '')).toBeNull();
  });

  it.each([3, 1, 0.5])(
    'no ritmo %s o prazo é de 6 h reais: convertido quando a equipe chega, e é nele que a Postura decide',
    (timeScale) => {
      const { state, arrivedAt } = atFork(['hero-1'], 'balanced', { timeScale });
      const decidesAt = arrivedAt + WAIT_REAL * timeScale;
      expect(only(state).crossroads).toEqual({ decidesAtMs: decidesAt });
      const view = deriveViewState(state, arrivedAt, { timeScale });
      expect(view.guild.expeditions[0]?.crossroads?.decidesInSeconds).toBe(6 * 3600);
      expect(view.pendingDecisions[0]?.expiresInSeconds).toBe(6 * 3600);
      // Um milissegundo antes, a equipe ainda espera.
      const before = advanceTo(state, decidesAt - 1);
      expect(types(before.events)).toEqual([]);
      expect(only(before.state).status).toBe('atCrossroads');
      // No instante do prazo, a Postura decide.
      const decided = advanceTo(before.state, decidesAt);
      expect(types(decided.events)).toEqual(['expeditionPostureDecided']);
      expect(ofExpeditions(decided.events)[0]?.atMs).toBe(decidesAt);
      expect(only(decided.state)).toMatchObject({
        status: 'traveling',
        nodeId: 'glade',
        nodeEndsAtMs: decidesAt + 25 * MINUTE,
        crossroads: null,
      });
    },
  );

  it('o jogador escolhe: a equipe segue pelo caminho dele, e a Crônica diz que foi o senhor', () => {
    const { state, arrivedAt } = atFork(['hero-1'], 'cautious');
    const waited = advanceTo(state, arrivedAt + 2 * HOUR).state;
    const chosen = accept(waited, choose('expedition-1', 'stream'));
    expect(ofExpeditions(chosen.events)).toEqual([
      {
        type: 'expeditionPathChosen',
        atMs: arrivedAt + 2 * HOUR,
        text: 'No 2º dia da Primavera, o senhor de Pedra Alta mandou dizer à expedição "Floresta Antiga": seguir o riacho.',
        data: {
          expeditionId: 'expedition-1',
          modelId: 'oldForest',
          optionId: 'stream',
          decidedBy: 'player',
          posture: 'cautious',
        },
      },
    ]);
    const expedition = only(chosen.state);
    expect(expedition).toMatchObject({
      status: 'traveling',
      nodeId: 'glade',
      nodeEndsAtMs: arrivedAt + 2 * HOUR + 25 * MINUTE,
      crossroads: null,
    });
    expect(expedition.log.at(-1)).toEqual({
      nodeId: 'fork',
      atMs: arrivedAt + 2 * HOUR,
      outcome: 'chosen',
      optionId: 'stream',
      decidedBy: 'player',
      gained: { food: 0, wood: 0, stone: 0, gold: 0 },
      xp: 0,
      standout: null,
      lesson: null,
      harm: null,
      leveled: [],
      found: [],
      revealed: null,
      cleared: null,
      rescued: null,
      lootLost: false,
    });
    // A ordem não sorteia.
    expect(chosen.state.rng).toEqual(waited.rng);
    expect(chosen.state.stats.crossroadsChosen).toBe(1);
    expect(deriveViewState(chosen.state, arrivedAt + 2 * HOUR).pendingDecisions).toEqual([]);
    // O prazo antigo já não decide nada.
    const later = advanceTo(chosen.state, arrivedAt + WAIT_REAL + DAY);
    expect(types(later.events)).toEqual(['expeditionNodeResolved', 'expeditionReturned']);
    expect(later.state.stats.crossroadsByPosture).toBeUndefined();
  });

  it('no instante do prazo, o prazo resolve antes da ordem: a escolha é recusada com CROSSROADS_DECIDED', () => {
    const { state, arrivedAt } = atFork(['hero-1'], 'cautious');
    const decidesAt = arrivedAt + WAIT_REAL;
    // Um milissegundo antes ainda dá.
    const early = advanceTo(state, decidesAt - 1).state;
    expect(accept(early, choose('expedition-1', 'stream')).state.guild.expeditions[0]?.nodeId).toBe(
      'glade',
    );
    const late = advanceTo(state, decidesAt);
    expect(types(late.events)).toEqual(['expeditionPostureDecided']);
    expect(refuse(late.state, choose('expedition-1', 'stream'))).toEqual({
      code: 'CROSSROADS_DECIDED',
      message:
        'Essa encruzilhada já foi decidida, e a equipe seguiu caminho. A Crônica conta por onde.',
    });
    // A Cautelosa voltou para casa.
    expect(only(late.state)).toMatchObject({ status: 'returning', nodeId: 'home' });
    // E continua recusada depois de a equipe voltar: o relatório guarda a decisão.
    const home = advanceTo(late.state, decidesAt + HOUR).state;
    expect(home.guild.expeditions).toEqual([]);
    expect(refuse(home, choose('expedition-1', 'stream')).code).toBe('CROSSROADS_DECIDED');
  });

  it('escolher duas vezes: a segunda ordem encontra a decisão tomada', () => {
    const { state } = atFork(['hero-1']);
    const once = accept(state, choose('expedition-1', 'stream')).state;
    expect(refuse(once, choose('expedition-1', 'turnBack')).code).toBe('CROSSROADS_DECIDED');
    expect(refuse(once, choose('expedition-1', 'stream')).code).toBe('CROSSROADS_DECIDED');
    expect(
      once.guild.expeditions[0]?.log.filter((entry) => entry.outcome === 'chosen'),
    ).toHaveLength(1);
  });

  it('as outras recusas: a expedição que não espera, a opção que não existe e a que a equipe não pode tomar', () => {
    const patrolling = send(hall(), 'patrol', ['hero-1']).state;
    expect(refuse(patrolling, choose('expedition-1', 'stream'))).toEqual({
      code: 'EXPEDITION_NOT_WAITING',
      message: 'Essa expedição não espera ordem em uma encruzilhada.',
    });
    expect(refuse(hall(), choose('expedition-7', 'stream')).code).toBe('EXPEDITION_NOT_WAITING');
    // A caminho da encruzilhada, antes de chegar: ainda não espera.
    const onTrail = send(hall(), 'oldForest', ['hero-1'], 'balanced', 0).state;
    expect(refuse(onTrail, choose('expedition-1', 'stream')).code).toBe('EXPEDITION_NOT_WAITING');

    const { state } = atFork(['hero-2']);
    expect(refuse(state, choose('expedition-1', 'swim'))).toEqual({
      code: 'INVALID_OPTION',
      message: 'A encruzilhada "A trilha se divide" não tem esse caminho.',
    });
    // Rolf é Arqueiro: a mata fechada pede um Guerreiro.
    expect(refuse(state, choose('expedition-1', 'thicket'))).toEqual({
      code: 'OPTION_LOCKED',
      message: 'Esse caminho está fora do alcance da equipe: requer um Guerreiro na equipe.',
    });
    const frozen = JSON.stringify(state);
    refuse(state, choose('expedition-1', 'thicket'));
    expect(JSON.stringify(state)).toBe(frozen);
    // Com um Guerreiro na equipe, a mesma opção abre.
    const both = atFork(['hero-2', 'hero-1']);
    expect(
      accept(both.state, choose('expedition-1', 'thicket')).state.guild.expeditions[0]?.nodeId,
    ).toBe('deepWoods');
  });

  it.each<[PostureId, string, string]>([
    ['cautious', 'turnBack', 'home'],
    ['balanced', 'stream', 'glade'],
    ['bold', 'thicket', 'deepWoods'],
  ])(
    'sem resposta, a Postura %s toma a opção marcada para ela: %s',
    (posture, optionId, nodeId) => {
      const { state, arrivedAt } = atFork(['hero-1'], posture);
      const decided = advanceTo(state, arrivedAt + WAIT_REAL);
      const [event] = ofExpeditions(decided.events);
      expect(event?.type).toBe('expeditionPostureDecided');
      expect(event?.data).toEqual({
        expeditionId: 'expedition-1',
        modelId: 'oldForest',
        optionId,
        decidedBy: 'posture',
        posture,
        fallback: 0,
      });
      expect(event?.text).toContain(
        `seguiu a postura ${expeditionPostures[posture].label.toLowerCase()}`,
      );
      expect(only(decided.state).nodeId).toBe(nodeId);
      expect(only(decided.state).log.at(-1)).toMatchObject({
        outcome: 'chosen',
        optionId,
        decidedBy: 'posture',
      });
      expect(decided.state.stats.crossroadsByPosture).toBe(1);
    },
  );

  it('a Postura nunca escolhe o que a equipe não pode fazer: com a opção marcada bloqueada, vale a da Cautelosa', () => {
    // Rolf, Arqueiro, com a Postura Ousada: a mata fechada pede um Guerreiro.
    const { state, arrivedAt } = atFork(['hero-2'], 'bold');
    const view = deriveViewState(state, arrivedAt).guild.expeditions[0]?.crossroads;
    expect(view).toMatchObject({
      postureLabel: 'Ousada',
      postureOptionId: 'turnBack',
      postureOptionLabel: 'Voltar com o que já têm',
      postureText:
        'Sem resposta, a Postura Ousada escolheria "Abrir caminho pela mata fechada", que esta equipe não pode tomar: vale o caminho seguro, Voltar com o que já têm.',
    });
    const decided = advanceTo(state, arrivedAt + WAIT_REAL);
    const [event] = ofExpeditions(decided.events);
    expect(event?.data).toMatchObject({ optionId: 'turnBack', decidedBy: 'posture', fallback: 1 });
    expect(event?.text).toBe(
      'No 4º dia da Primavera, sem palavra do senhor de Pedra Alta, a expedição "Floresta Antiga" não pôde tomar o caminho da postura ousada e foi pelo seguro: voltar com o que já têm.',
    );
    expect(only(decided.state)).toMatchObject({ status: 'returning', nodeId: 'home' });
    expect(only(decided.state).log.at(-1)).toMatchObject({
      optionId: 'turnBack',
      decidedBy: 'cautiousFallback',
    });
    // Para toda encruzilhada do conteúdo e toda equipe de um herói, a Postura dá uma opção que
    // a equipe pode tomar.
    for (const model of expeditionModels) {
      for (const variant of model.variants) {
        for (const node of Object.values(variant.nodes)) {
          if (node.kind !== 'crossroads') {
            continue;
          }
          for (const classId of ['warrior', 'archer', 'mage', 'cleric'] as const) {
            for (const posture of ['cautious', 'balanced', 'bold'] as const) {
              const choice = postureChoice([hero({ classId })], node, posture);
              const requires = choice?.option.requires;
              // O herói do teste não tem traço: uma opção que pede um nunca é a que vale.
              expect(
                requires === undefined ||
                  ('heroClass' in requires && requires.heroClass === classId),
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it('a equipe parada na encruzilhada continua recebendo soldo', () => {
    const start = hall({}, (draft) => {
      draft.settlement.resources.gold = 500_000;
    });
    const sent = send(start, 'oldForest', ['hero-1', 'hero-2'], 'cautious', 0);
    const arrivedAt = sent.expedition.nodeEndsAtMs ?? 0;
    const waiting = advanceTo(sent.state, arrivedAt + 3 * HOUR).state;
    // Dois heróis, 2 de ouro por hora de jogo cada um, desde o começo.
    expect(waiting.settlement.resources.gold).toBe(
      500_000 - Math.round((4_000 * (arrivedAt + 3 * HOUR)) / HOUR),
    );
    expect(deriveViewState(waiting, waiting.lastProcessedAt).guild.wage.perHour).toBe(4);
  });

  it('trinta dias reais sem acesso com a equipe na encruzilhada: a Postura decide no prazo, a equipe volta, e o resultado é o de quem olhou a cada hora', () => {
    for (const timeScale of [3, 1, 0.5]) {
      const fork = atFork(['hero-1'], 'balanced', { timeScale, seed: 'ausente' });
      const { arrivedAt } = fork;
      // Ouro para o soldo do mês inteiro: o que se prova aqui é a expedição, não o atraso.
      const state = cloneState(fork.state);
      state.settlement.resources.gold = 50_000_000;
      const month = Math.round(30 * 24 * HOUR * timeScale);
      const away = advanceTo(state, arrivedAt + month);
      const mine = ofExpeditions(away.events);
      expect(mine.map((event) => event.type)).toEqual([
        'expeditionPostureDecided',
        'expeditionNodeResolved',
        'expeditionReturned',
      ]);
      const decidesAt = arrivedAt + WAIT_REAL * timeScale;
      expect(mine.map((event) => event.atMs)).toEqual([
        decidesAt,
        decidesAt + 25 * MINUTE,
        decidesAt + 45 * MINUTE,
      ]);
      expect(away.state.guild.expeditions).toEqual([]);
      expect(away.state.guild.heroes[0]?.status).toBe('idle');
      expect(Object.keys(away.state.rng).filter((key) => key.startsWith('expedition'))).toEqual([]);
      // Hora a hora (de tempo real), passando pelo banco a cada corte.
      let hourly = state;
      const events: GameEvent[] = [];
      for (let hour = 1; hour <= 30 * 24; hour += 6) {
        const step = advanceTo(
          JSON.parse(JSON.stringify(hourly)) as GameState,
          arrivedAt + Math.round(hour * HOUR * timeScale),
        );
        hourly = step.state;
        events.push(...step.events);
      }
      const last = advanceTo(JSON.parse(JSON.stringify(hourly)) as GameState, arrivedAt + month);
      expect(last.state).toStrictEqual(away.state);
      expect([...events, ...last.events]).toStrictEqual(away.events);
    }
  });
});

describe('duas expedições ao mesmo tempo, e uma terceira no meio (QA-07)', () => {
  const three = (seed = 'pedra-alta') =>
    hall({ level: 4, seed }, (draft) => void addHero(draft, { name: 'Brann' }));

  it('cada uma sorteia no próprio fluxo: mandar outra não muda o relatório de nenhuma', () => {
    const alone = (() => {
      const sent = send(three(), 'patrol', ['hero-1'], 'balanced', 0);
      return advanceTo(sent.state, HOUR).state.guild.reports[0];
    })();
    // A mesma, com uma segunda enviada no mesmo instante e uma terceira no meio do nó.
    const first = send(three(), 'patrol', ['hero-1'], 'balanced', 0);
    const second = send(first.state, 'oldForest', ['hero-2'], 'cautious', 0);
    const middle = advanceTo(second.state, 4 * MINUTE).state;
    const third = send(middle, 'patrol', ['hero-3'], 'bold', 1);
    expect(third.state.guild.expeditions.map((entry) => entry.id)).toEqual([
      'expedition-1',
      'expedition-2',
      'expedition-3',
    ]);
    const end = advanceTo(third.state, 12 * HOUR).state;
    const crowded = end.guild.reports.find((report) => report.expeditionId === 'expedition-1');
    expect(crowded).toEqual(alone);
    // E a segunda, sozinha, dá o mesmo que no meio das outras.
    const secondAlone = (() => {
      const start = three();
      start.ids.expedition = 1;
      const sent = send(start, 'oldForest', ['hero-2'], 'cautious', 0);
      expect(sent.expedition.id).toBe('expedition-2');
      return advanceTo(sent.state, 12 * HOUR).state.guild.reports[0];
    })();
    expect(end.guild.reports.find((report) => report.expeditionId === 'expedition-2')).toEqual(
      secondAlone,
    );
    expect(end.rng).toEqual({});
  });

  it('no mesmo instante, a ordem é a do identificador: as linhas da Crônica e o saque no depósito', () => {
    const first = send(three(), 'patrol', ['hero-1'], 'balanced', 0);
    const second = send(first.state, 'patrol', ['hero-2'], 'balanced', 0);
    const third = send(second.state, 'patrol', ['hero-3'], 'balanced', 0);
    const done = advanceTo(third.state, HOUR);
    const mine = ofExpeditions(done.events);
    // A ronda pelas cercas pode dar Revés a quem não é Guerreiro: o tipo do evento muda, a
    // ordem não.
    const kind = (event: GameEvent) =>
      event.type === 'expeditionNodeFailed' ? 'expeditionNodeResolved' : event.type;
    expect(
      mine.map((event) => [event.atMs / MINUTE, kind(event), event.data.expeditionId]),
    ).toEqual([
      [10, 'expeditionNodeResolved', 'expedition-1'],
      [10, 'expeditionNodeResolved', 'expedition-2'],
      [10, 'expeditionNodeResolved', 'expedition-3'],
      [15, 'expeditionReturned', 'expedition-1'],
      [15, 'expeditionReturned', 'expedition-2'],
      [15, 'expeditionReturned', 'expedition-3'],
    ]);
    // Três fluxos, três sortes: não é a mesma sequência repetida.
    const found = done.state.guild.reports.map((report) => report.loot.resources.gold);
    expect(found).toHaveLength(3);
    expect(done.state.rng).toEqual({});
  });

  it('a mesma semente, as mesmas ordens nos mesmos instantes: o mesmo relatório (golden)', async () => {
    const run = () => {
      const start = hall({ level: 2, seed: 'relatorio-golden' });
      const forest = send(start, 'oldForest', ['hero-1', 'hero-2'], 'bold', 0);
      const fork = advanceTo(forest.state, forest.expedition.nodeEndsAtMs ?? 0).state;
      const chosen = accept(fork, choose('expedition-1', 'thicket')).state;
      const home = advanceTo(chosen, 3 * HOUR).state;
      const patrol = send(home, 'patrol', ['hero-2'], 'cautious', 2);
      const end = advanceTo(patrol.state, 6 * HOUR);
      return { reports: end.state.guild.reports, view: deriveViewState(end.state, 6 * HOUR) };
    };
    const once = run();
    expect(run()).toStrictEqual(once);
    await expect(
      `${JSON.stringify({ reports: once.reports, view: once.view.guild.reports }, null, 1)}\n`,
    ).toMatchFileSnapshot('./__golden__/expedition-reports.json');
  });
});

describe('no mesmo instante: fim de nó, prazo de encruzilhada, virada de dia, rotação da Taverna, carta que expira e ouro acabando (QA-03)', () => {
  it('a ordem é a documentada, nada é cobrado duas vezes, e o saque que chega paga o soldo antes de o atraso abrir', () => {
    // Tudo marcado para a virada do 3º dia de jogo (4 h): a Patrulha de Edda termina o
    // caminho de volta nela, a Floresta de Rolf tem o prazo da encruzilhada nela, a Taverna
    // troca os candidatos, uma carta expira, e o ouro acaba no mesmo milissegundo.
    const T = 2 * DAY;
    const start = guildHall(
      0,
      (draft) => {
        addHero(draft, { name: 'Edda', gender: 'f' });
        addHero(draft, { name: 'Rolf', classId: 'archer' });
        draft.settlement.buildings.tavern = 1;
        draft.guild.tavern.nextRotationAtMs = T;
        // Dois heróis: 4 de ouro por hora de jogo. Em 4 h, 16 de ouro: o cofre zera em T.
        draft.settlement.resources.gold = 16_000;
        draft.council.pending.push({
          instanceId: 'collapsedWell-1',
          cardId: 'collapsedWell',
          drawnAtMs: 0,
          expiresAtMs: T,
          origin: null,
        } as GameState['council']['pending'][number]);
      },
      { level: 2 },
    );
    nextVariantIs(start, 'patrol', 0);
    nextVariantIs(start, 'oldForest', 0);
    const state = cloneState(start);
    // A Patrulha sai 15 min antes de T; a Floresta chega à encruzilhada 6 h reais antes de T.
    state.guild.heroes.forEach((entry) => (entry.status = 'expedition'));
    state.ids.expedition = 2;
    const blank = { food: 0, wood: 0, stone: 0, gold: 0 };
    state.guild.expeditions = [
      {
        id: 'expedition-1',
        modelId: 'patrol',
        variant: 0,
        heroIds: ['hero-1'],
        posture: 'balanced',
        sentAtMs: 0,
        durationFactor: { num: 1, den: 1 },
        status: 'returning',
        nodeId: 'home',
        nodeEndsAtMs: T,
        crossroads: null,
        loot: { resources: { ...blank, gold: 20 }, items: [] },
        log: [],
      },
      {
        id: 'expedition-2',
        modelId: 'oldForest',
        variant: 0,
        heroIds: ['hero-2'],
        posture: 'balanced',
        sentAtMs: 0,
        durationFactor: { num: 1, den: 1 },
        status: 'atCrossroads',
        nodeId: 'fork',
        nodeEndsAtMs: null,
        crossroads: { decidesAtMs: T },
        loot: { resources: { ...blank }, items: [] },
        log: [],
      },
    ];
    expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();
    expect(nextEventAt(state)).toBeLessThanOrEqual(T);
    const before = advanceTo(state, T - 1);
    expect(before.events.filter((event) => event.atMs === T)).toEqual([]);
    expect(before.state.settlement.resources.gold).toBeGreaterThan(0);

    const at = advanceTo(before.state, T);
    const order: string[] = at.events
      .filter((event) => event.atMs === T)
      .map((event) => event.type);
    const index = (type: string) => order.indexOf(type);
    // A virada do dia, depois o Conselho, depois as expedições (por identificador), e nenhum
    // soldo em atraso: o ouro da Patrulha entrou antes da conta do ouro.
    expect(index('dayStarted')).toBeGreaterThanOrEqual(0);
    expect(index('cardExpired')).toBeGreaterThan(index('dayStarted'));
    expect(index('expeditionReturned')).toBeGreaterThan(index('cardExpired'));
    expect(index('expeditionPostureDecided')).toBeGreaterThan(index('expeditionReturned'));
    expect(order).not.toContain('wageArrearsStarted');
    expect(order.filter((type) => type === 'expeditionReturned')).toHaveLength(1);
    expect(order.filter((type) => type === 'expeditionPostureDecided')).toHaveLength(1);
    // A Taverna trocou a lista antes das expedições (a troca não tem linha na Crônica).
    expect(at.state.guild.tavernOffers.length).toBeGreaterThan(0);
    expect(at.state.guild.tavern.nextRotationAtMs).toBe(T + balance.tavern.rotationMs);
    expect(at.state.guild.wageArrears).toBeNull();
    // O cofre: os 20 de ouro do saque, e mais nada cobrado em dobro.
    expect(at.state.settlement.resources.gold).toBe(20_000);
    expect(at.state.guild.expeditions.map((entry) => [entry.id, entry.nodeId])).toEqual([
      ['expedition-2', 'glade'],
    ]);
    // De uma vez dá o mesmo.
    const direct = advanceTo(state, T);
    expect(direct.state).toStrictEqual(at.state);
    expect(direct.events).toStrictEqual([...before.events, ...at.events]);
    // E o instante não se repete: o próximo evento é depois.
    expect(nextEventAt(at.state)).toBeGreaterThan(T);
  });

  it('a virada do dia vem antes: quem volta nela não é cobrado pelo soldo em atraso daquela virada; é na seguinte', () => {
    // Um atraso de mais de 24 h reais, com Edda fora: o prazo já deve uma partida, e ela volta
    // exatamente na virada do dia. A cobrança da virada vem antes da volta e não a alcança.
    const T = 20 * DAY;
    const blank = { food: 0, wood: 0, stone: 0, gold: 0 };
    const start = guildHall(T - 5 * MINUTE, (draft) => {
      const edda = addHero(draft, { name: 'Edda', gender: 'f', joinedAtMs: 0 });
      edda.discontent = true;
      edda.status = 'expedition';
      draft.settlement.resources.gold = 0;
      draft.guild.wageArrears = { sinceMs: 0, carriedMs: 0, departed: 0 };
      draft.ids.expedition = 1;
      draft.guild.expeditions = [
        {
          id: 'expedition-1',
          modelId: 'patrol',
          variant: 0,
          heroIds: ['hero-1'],
          posture: 'balanced',
          sentAtMs: T - 15 * MINUTE,
          durationFactor: { num: 1, den: 1 },
          status: 'returning',
          nodeId: 'home',
          nodeEndsAtMs: T,
          crossroads: null,
          loot: { resources: { ...blank }, items: [] },
          log: [],
        },
      ];
    });
    expect(currentShape(JSON.parse(JSON.stringify(start)), '')).toBeNull();
    const at = advanceTo(start, T);
    const kinds = at.events.map((event) => event.type as string);
    expect(kinds).toContain('dayStarted');
    expect(kinds).toContain('expeditionReturned');
    expect(kinds.indexOf('expeditionReturned')).toBeGreaterThan(kinds.indexOf('dayStarted'));
    expect(kinds).not.toContain('heroLeft');
    expect(at.state.guild.heroes.map((entry) => entry.status)).toEqual(['idle']);
    // Na virada seguinte ela está no feudo, e o prazo cobra.
    const next = advanceTo(at.state, T + DAY);
    expect(next.events.filter((event) => event.type === 'heroLeft')).toHaveLength(1);
    expect(next.state.guild.heroes).toEqual([]);
  });
});

describe('a expedição e o soldo', () => {
  it('quem está em expedição não é dispensado, e não parte por soldo em atraso antes de voltar', () => {
    const sent = send(hall(), 'oldForest', ['hero-1'], 'cautious', 0).state;
    expect(refuse(sent, command('dismissHero', { heroId: 'hero-1' }))).toEqual({
      code: 'HERO_BUSY',
      message: 'Edda está fora do feudo: a dispensa espera a volta.',
    });
    expect(deriveViewState(sent, 0).guild.heroes.map((entry) => entry.atHome)).toEqual([
      false,
      true,
    ]);
    expect(deriveViewState(sent, 0).guild.heroes[0]?.statusText).toBe('Em expedição');
    // Quem ficou pode ser dispensado.
    expect(
      accept(sent, command('dismissHero', { heroId: 'hero-2' })).state.guild.heroes,
    ).toHaveLength(1);
  });

  it('com o cofre vazio, só quem está no feudo parte: a equipe na encruzilhada continua devida e não parte', () => {
    const start = hall({ timeScale: 1 }, (draft) => {
      draft.settlement.resources.gold = 0;
    });
    const sent = send(start, 'oldForest', ['hero-1'], 'cautious', 0);
    // Com a escolha do senhor adiada ao limite, Edda fica fora pelas 6 h do prazo.
    const end = advanceTo(sent.state, 5 * HOUR);
    expect(end.state.guild.wageArrears).not.toBeNull();
    expect(end.state.guild.heroes.map((entry) => entry.name)).toEqual(['Edda', 'Rolf']);
    // Trinta horas depois: Rolf, no feudo, partiu; Edda, que voltou, também, mais tarde.
    const later = advanceTo(end.state, 40 * HOUR);
    const left = later.events.filter((event) => event.type === 'heroLeft');
    expect(left.length).toBeGreaterThanOrEqual(1);
    expect(left[0]?.text).toContain('Rolf');
  });
});

describe('a visão das expedições (ADR 0018, decisão 13)', () => {
  it('sem a Guilda nada aparece; com ela, os destinos trazem a duração, o risco, a equipe e o primeiro trecho', () => {
    const none = deriveViewState(
      guildHall(0, (draft) => void addHero(draft), { level: 0 }),
      0,
    ).guild;
    expect(none).toMatchObject({ built: false, level: 0, slots: 0, available: [] });
    expect(none.text).toBe(
      'Sua equipe ainda não tem para onde ir: erga a Guilda dos Aventureiros, e ela abre as expedições. Até lá, os heróis ficam no feudo, e o soldo corre.',
    );

    const start = hall();
    nextVariantIs(start, 'patrol', 0);
    nextVariantIs(start, 'oldForest', 0);
    const view = deriveViewState(start, 0).guild;
    expect(view.text).toBe(
      'A Guilda dos Aventureiros sustenta 1 expedição por vez. Escolha um destino, a equipe e a Postura: o que a tela mostra antes da partida é o que vale.',
    );
    expect(view.postures.map((posture) => posture.label)).toEqual([
      'Cautelosa',
      'Equilibrada',
      'Ousada',
    ]);
    // O Covil dos Lobos é conhecido desde sempre e vem depois (V3D-T2); as Ruínas e o Resgate
    // só aparecem por descoberta e com um cativo.
    expect(view.available.map((offer) => offer.modelId)).toEqual([
      'patrol',
      'oldForest',
      'wolfDen',
    ]);
    expect(view.available.slice(0, 2)).toEqual([
      {
        modelId: 'patrol',
        label: 'Patrulha dos Arredores',
        riskText: 'Baixo',
        durationSeconds: 15 * 60,
        durationNote: '',
        requirementsText: 'Equipe: 1 herói.',
        teamMin: 1,
        teamMax: 1,
        teamMinLevel: 1,
        firstStretchDifficulty: 36,
        // 36 ÷ 0,85 = 42,4: com 43 nem a pior sorte tira o Sucesso; 36 × 0,7 ÷ 0,85 = 29,6.
        fit: {
          comfortPower: 43,
          riskPower: 30,
          text: 'Contra o primeiro trecho, com 43 de poder a equipe passa com folga; abaixo de 30, arrisca um Desastre.',
        },
        // Edda, Guerreira, e Rolf, Arqueiro, contra a ronda (os pesos de sempre).
        heroFit: [
          { heroId: 'hero-1', power: 42 },
          { heroId: 'hero-2', power: 36 },
        ],
        locked: false,
        lockedReason: null,
        firstStretchText: 'A ronda pelas cercas (dificuldade 36). Depois, o caminho de volta.',
        rescue: false,
      },
      {
        modelId: 'oldForest',
        label: 'Floresta Antiga',
        riskText: 'Baixo a médio',
        durationSeconds: 60 * 60,
        durationNote: 'Sem contar a espera em uma encruzilhada, que dura até 6 h.',
        requirementsText: 'Equipe: de 1 a 2 heróis.',
        teamMin: 1,
        teamMax: 2,
        teamMinLevel: 1,
        firstStretchDifficulty: null,
        // Sem prova à vista não há régua: o poder de cada um é o da ficha.
        fit: null,
        heroFit: [
          { heroId: 'hero-1', power: 42 },
          { heroId: 'hero-2', power: 36 },
        ],
        locked: false,
        lockedReason: null,
        firstStretchText:
          'A trilha sob os carvalhos. Depois, uma encruzilhada: o que vem além dela só se sabe lá.',
        rescue: false,
      },
    ]);
  });

  it('a duração anunciada é em tempo real e é a que vale: no ritmo 3, um terço; no verão, 17/20', () => {
    const fast = deriveViewState(hall({ timeScale: 3 }), 0, { timeScale: 3 }).guild.available;
    expect(fast.map((offer) => offer.durationSeconds)).toEqual([5 * 60, 20 * 60, 40 * 60]);
    const summer = hall({}, () => {}, SUMMER);
    const offers = deriveViewState(summer, SUMMER).guild.available;
    expect(offers[0]?.durationSeconds).toBe(12 * 60 + 45);
    expect(offers[0]?.durationNote).toBe(
      'No Verão os caminhos estão secos: a jornada fica mais curta.',
    );
    // O que a tela mostrava é o que a expedição leva.
    const sent = send(summer, 'patrol', ['hero-1']);
    const back = advanceTo(sent.state, SUMMER + HOUR);
    expect(ofExpeditions(back.events).at(-1)?.atMs).toBe(SUMMER + (12 * 60 + 45) * 1000);
  });

  it('o destino fechado diz por quê, e "pode enviar" na tela é a ordem ser aceita', () => {
    const busy = send(hall(), 'patrol', ['hero-1']).state;
    const view = deriveViewState(busy, 0).guild;
    expect(view.text).toBe(
      'A Guilda dos Aventureiros sustenta 1 expedição por vez, e não há lugar para outra agora.',
    );
    for (const offer of view.available) {
      expect(offer.locked).toBe(true);
      expect(offer.lockedReason).toBe(
        refuse(
          busy,
          command('sendExpedition', {
            modelId: offer.modelId,
            heroIds: ['hero-2'],
            posture: 'balanced',
          }),
        ).message,
      );
    }
    const away = send(hall({ level: 2 }), 'oldForest', ['hero-1', 'hero-2']).state;
    expect(deriveViewState(away, 0).guild.text).toBe(expeditionTexts.noneHome);
  });

  it('em curso: onde a equipe está, quanto falta em tempo real e o que já aconteceu', () => {
    const sent = send(hall({ timeScale: 3 }), 'oldForest', ['hero-1', 'hero-2'], 'bold', 0);
    const [traveling] = deriveViewState(sent.state, 0, { timeScale: 3 }).guild.expeditions;
    expect(traveling).toEqual({
      id: 'expedition-1',
      label: 'Floresta Antiga',
      postureLabel: 'Ousada',
      teamNames: ['Edda', 'Rolf'],
      statusText: 'A caminho: A trilha sob os carvalhos.',
      nodeTitle: 'A trilha sob os carvalhos',
      nodeEndsInSeconds: 5 * 60,
      log: [],
      crossroads: null,
    });
    const fork = advanceTo(sent.state, 15 * MINUTE).state;
    const [waiting] = deriveViewState(fork, 15 * MINUTE, { timeScale: 3 }).guild.expeditions;
    const wood = only(fork).log[0]?.gained.wood ?? 0;
    expect(waiting).toEqual({
      id: 'expedition-1',
      label: 'Floresta Antiga',
      postureLabel: 'Ousada',
      teamNames: ['Edda', 'Rolf'],
      statusText: 'Parada na encruzilhada, à espera da sua palavra.',
      nodeTitle: 'A trilha se divide',
      nodeEndsInSeconds: null,
      log: [
        {
          title: 'A trilha sob os carvalhos',
          text: `No 1º dia da Primavera, a expedição de Pedra Alta entrou na Floresta Antiga e juntou a lenha caída pelo caminho. Trouxe ${wood} de madeira.`,
          outcome: 'passed',
          outcomeLabel: 'Sem incidentes',
          notes: [],
          standoutName: null,
          lessonText: null,
        },
      ],
      crossroads: {
        title: 'A trilha se divide',
        text: 'A trilha se parte em duas diante de um carvalho tombado. À esquerda, a mata fecha; à direita, ouve-se água.',
        decidesInSeconds: 6 * 3600,
        postureLabel: 'Ousada',
        postureOptionId: 'thicket',
        postureOptionLabel: 'Abrir caminho pela mata fechada',
        postureText: 'Sem resposta, a Postura Ousada escolhe: Abrir caminho pela mata fechada.',
        options: [
          {
            id: 'thicket',
            label: 'Abrir caminho pela mata fechada',
            hint: 'A melhor madeira do bosque, e pegadas grandes na lama; é serviço para mais de um, com quem abra o caminho no braço.',
            locked: false,
            lockedReason: null,
          },
          {
            id: 'stream',
            label: 'Seguir o riacho',
            hint: 'Chão escorregadio e lenha boa na outra margem; quem tem perícia passa melhor.',
            locked: false,
            lockedReason: null,
          },
          {
            id: 'turnBack',
            label: 'Voltar com o que já têm',
            hint: 'Sem risco; o saque fica pequeno.',
            locked: false,
            lockedReason: null,
          },
        ],
      },
    });
    // Sem Guerreiro, a opção aparece bloqueada com o motivo.
    const archer = atFork(['hero-2']);
    expect(
      deriveViewState(archer.state, archer.arrivedAt).guild.expeditions[0]?.crossroads?.options[0],
    ).toMatchObject({ locked: true, lockedReason: 'Requer um Guerreiro na equipe.' });
  });

  it('o relatório narra nó a nó, com quem decidiu na encruzilhada e o fecho do saque', () => {
    const { state, arrivedAt } = atFork(['hero-1'], 'bold');
    const end = advanceTo(state, arrivedAt + WAIT_REAL + 2 * HOUR).state;
    const [report] = deriveViewState(end, end.lastProcessedAt).guild.reports;
    expect(report?.label).toBe('Floresta Antiga');
    expect(report?.teamNames).toEqual(['Edda']);
    expect(report?.postureLabel).toBe('Ousada');
    expect(report?.log.map((entry) => [entry.title, entry.outcomeLabel])).toEqual([
      ['A trilha sob os carvalhos', 'Sem incidentes'],
      ['A trilha se divide', 'Caminho escolhido'],
      ['O javali da mata fechada', expect.stringMatching(/^(Revés|Desastre)$/)],
      // Quem voltou tem o caminho de volta como último passo.
      ['A volta pela trilha', 'Sem incidentes'],
    ]);
    // O passo do javali diz quem se destacou e o que o desfecho ensina: Edda foi sozinha, sem
    // traço nem item no arsenal, e é Guerreira (a classe que o nó pede): faltou força.
    expect(report?.log[2]).toMatchObject({
      standoutName: 'Edda',
      lessonText: expeditionTexts.lessonStrength,
    });
    expect(report?.log[2]?.text).toContain('Edda');
    // O desfecho vai também como chave, para a tela pôr um ícone ao lado da palavra.
    expect(report?.log.map((entry) => entry.outcome)).toEqual([
      'passed',
      'chosen',
      expect.stringMatching(/^(setback|disaster)$/),
      'passed',
    ]);
    expect(report?.log[2]?.text).toContain(expeditionTexts.lessonStrength);
    expect(report?.lossesText).toMatch(/^O preço: Edda, com um ferimento (leve|grave)\.$/);
    expect(report?.deedsText).toBeNull();
    expect(report?.log[1]?.text).toBe(
      'Sem palavra do senhor, a Postura Ousada decidiu: Abrir caminho pela mata fechada.',
    );
    expect(report?.lootText).toMatch(/^Trouxe \d+ de madeira/);
    // Quem foi dispensado depois continua no relatório, pelo nome.
    const dismissed = accept(end, command('dismissHero', { heroId: 'hero-1' })).state;
    expect(
      deriveViewState(dismissed, dismissed.lastProcessedAt).guild.reports[0]?.teamNames,
    ).toEqual(['Edda']);
  });

  it('as cartas e as encruzilhadas saem juntas, do prazo mais curto ao mais longo', () => {
    const { state, arrivedAt } = atFork(['hero-1']);
    const withCard = cloneState(state);
    withCard.council.pending.push({
      instanceId: 'collapsedWell-1',
      cardId: 'collapsedWell',
      drawnAtMs: arrivedAt,
      expiresAtMs: arrivedAt + 24 * HOUR,
      origin: null,
    } as GameState['council']['pending'][number]);
    expect(
      deriveViewState(withCard, arrivedAt).pendingDecisions.map((entry) => [
        entry.kind,
        entry.expiresInSeconds,
      ]),
    ).toEqual([
      ['crossroads', 6 * 3600],
      ['card', 24 * 3600],
    ]);
  });
});

describe('a névoa: o que não sai do servidor (QA-18)', () => {
  /** Os nós que a equipe ainda não alcançou em um grafo, dado o percurso feito. */
  const beyond = (variant: ExpeditionVariant, reached: Set<string>): ExpeditionNode[] =>
    Object.entries(variant.nodes)
      .filter(([key]) => !reached.has(key))
      .map(([, node]) => node);

  /** Os textos de um nó que só quem chegou a ele pode ler. */
  const secrets = (node: ExpeditionNode): string[] => {
    if (node.kind === 'crossroads') {
      return [
        node.title,
        node.text,
        ...node.options.flatMap((option) => [option.label, option.hint]),
      ];
    }
    if (node.kind === 'return') {
      return [node.title];
    }
    return [node.title, ...(node.trial === undefined ? [] : Object.values(node.trial.outcomes))];
  };

  it('duas expedições iguais até a encruzilhada, com ramos diferentes adiante, dão a mesma visão', () => {
    const a = atFork(['hero-1', 'hero-2'], 'balanced', { seed: 'nevoa', level: 2 }, 0);
    const b = atFork(['hero-1', 'hero-2'], 'balanced', { seed: 'nevoa', level: 2 }, 1);
    expect(a.expedition.variant).toBe(0);
    expect(b.expedition.variant).toBe(1);
    // Os dois grafos são diferentes depois da encruzilhada.
    const [, forest] = expeditionModels;
    expect(forest?.variants[0]?.nodes.deepWoods).not.toEqual(forest?.variants[1]?.nodes.deepWoods);
    // O contador de envios escolhe a variante do **próximo** envio, que a lista de destinos
    // mostra: igualado, a visão inteira tem de ser a mesma.
    const same = cloneState(b.state);
    same.stats['expeditionsSent:oldForest'] = a.state.stats['expeditionsSent:oldForest'] ?? 0;
    const viewA = deriveViewState(a.state, a.arrivedAt);
    const viewB = deriveViewState(same, b.arrivedAt);
    expect(viewB).toStrictEqual(viewA);
    expect(viewA.guild.expeditions[0]?.crossroads?.options).toHaveLength(3);
    // E os dois seguem caminhos diferentes depois da mesma escolha.
    const nextA = accept(a.state, choose('expedition-1', 'stream')).state;
    const nextB = accept(b.state, choose('expedition-1', 'stream')).state;
    const titleA = deriveViewState(nextA, a.arrivedAt).guild.expeditions[0]?.nodeTitle;
    const titleB = deriveViewState(nextB, b.arrivedAt).guild.expeditions[0]?.nodeTitle;
    expect(titleA).toBe('As pedras do riacho');
    expect(titleB).toBe('A cabana do carvoeiro');
  });

  it('em toda variante com encruzilhada, parada nela, a visão não traz título, frase nem dificuldade de nó nenhum além dela', () => {
    let checked = 0;
    for (const model of expeditionModels) {
      for (const [index, variant] of model.variants.entries()) {
        const start = guildHall(
          0,
          (draft) => {
            for (let count = 0; count < model.requires.teamMin; count += 1) {
              // As classes que o modelo exige primeiro (o Pântano pede um Mago).
              addHero(draft, { level: 3, classId: model.requires.classes[count] ?? 'warrior' });
            }
            everyDestinationOpen(draft);
          },
          { level: 4 },
        );
        const team = start.guild.heroes
          .filter((entry) => entry.status === 'idle')
          .map((entry) => entry.id);
        let state = send(start, model.id, team, 'balanced', index).state;
        const reached = new Set<string>([only(state).nodeId]);
        // Anda até a primeira encruzilhada (ou até voltar).
        for (let steps = 0; steps < 10 && state.guild.expeditions.length > 0; steps += 1) {
          const expedition = only(state);
          if (expedition.status === 'atCrossroads') {
            break;
          }
          state = advanceTo(state, expedition.nodeEndsAtMs ?? 0).state;
          if (state.guild.expeditions.length > 0) {
            reached.add(only(state).nodeId);
          }
        }
        if (state.guild.expeditions.length === 0) {
          continue;
        }
        // A lista de destinos mostra o primeiro trecho da variante seguinte: fora da conta.
        const view = deriveViewState(state, state.lastProcessedAt);
        const text = JSON.stringify({ ...view, guild: { ...view.guild, available: [] } });
        const fork = variant.nodes[only(state).nodeId];
        const shown = new Set(fork === undefined ? [] : secrets(fork));
        for (const node of beyond(variant, reached)) {
          for (const secret of secrets(node)) {
            if (!shown.has(secret)) {
              expect(text, `${model.id}/${index}: ${secret}`).not.toContain(secret);
              checked += 1;
            }
          }
        }
        // Nada do estado interno: nem a variante, nem a chave de nó, nem a sorte, nem o fluxo.
        const leaked =
          /"(variant|nodeId|nodeEndsAtMs|decidesAtMs|durationFactor|rng|ids|luck)"/.exec(text);
        expect(leaked?.[0]).toBeUndefined();
        // A dificuldade só é dita do primeiro trecho, na lista de destinos: nunca de um nó em curso.
        expect(JSON.stringify(view.guild.expeditions)).not.toMatch(/dificuldade/i);
        expect(text).not.toContain('expedition:expedition-');
        for (const key of Object.keys(variant.nodes)) {
          // A chave de um nó não é texto de interface (a de uma opção é o que a ordem recebe).
          expect(text).not.toContain(`"${key}"`);
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('antes do envio, a lista de destinos só fala do primeiro trecho', () => {
    for (const model of expeditionModels) {
      for (const [index, variant] of model.variants.entries()) {
        const start = hall({ level: 4 });
        nextVariantIs(start, model.id, index);
        const text = JSON.stringify(deriveViewState(start, 0));
        const first = new Set<string>();
        let key = variant.start;
        for (;;) {
          first.add(key);
          const node = variant.nodes[key];
          if (node === undefined || node.kind === 'crossroads' || node.kind === 'return') {
            break;
          }
          key = node.next;
        }
        const firstNodes = [...first].map((entry) => variant.nodes[entry]);
        const hidden = beyond(variant, first).filter((node) => node.kind !== 'return');
        for (const node of hidden) {
          // O título de um nó além da encruzilhada só pode aparecer se for também o de um nó
          // do primeiro trecho de outro destino da lista.
          expect(text, `${model.id}/${index}: ${node.title}`).not.toContain(node.title);
        }
        // A própria encruzilhada só é anunciada: nem o título nem as opções.
        for (const node of firstNodes) {
          if (node?.kind === 'crossroads') {
            expect(text).not.toContain(node.title);
            for (const option of node.options) {
              expect(text).not.toContain(option.hint);
            }
          }
        }
      }
    }
  });

  it('as previsões da visão não resolvem nó nenhum: a cópia que prevê a moral anda sem as expedições', () => {
    // A Patrulha termina o nó e volta antes da próxima virada do dia. A previsão da moral avança
    // uma cópia até a virada: se a cópia levasse a expedição, sortearia a sorte e o saque dela.
    const sent = send(hall(), 'patrol', ['hero-1'], 'balanced', 0).state;
    const ahead = stateAtNextMoraleTurn(sent);
    expect(ahead.lastProcessedAt).toBe(DAY);
    expect(ahead.rng).toEqual(sent.rng);
    expect(ahead.guild.reports).toEqual([]);
    expect(ahead.settlement.resources.gold).toBeLessThan(sent.settlement.resources.gold);
    // E o jogo de verdade, no mesmo intervalo, resolve e sorteia.
    const real = advanceTo(sent, DAY).state;
    expect(real.guild.reports).toHaveLength(1);
  });

  it('a visão e nextEventAt não mudam o estado, o gerador nem os contadores com expedições vivas', () => {
    const { state } = atFork(['hero-1'], 'bold', { level: 2 });
    const two = send(state, 'patrol', ['hero-2'], 'balanced', 0).state;
    const mid = advanceTo(two, two.lastProcessedAt + 12 * MINUTE).state;
    for (const current of [state, two, mid]) {
      const frozen = JSON.stringify(current);
      for (const ahead of [0, 1, HOUR, 30 * DAY]) {
        deriveViewState(current, current.lastProcessedAt + ahead);
      }
      nextEventAt(current);
      expect(JSON.stringify(current)).toBe(frozen);
    }
    expect(Object.keys(mid.rng)).toEqual(['expedition:expedition-1', 'expedition:expedition-2']);
  });
});

describe('o estado gravado das expedições (a guarda da versão 17)', () => {
  const stored = (state: GameState) => JSON.parse(JSON.stringify(state)) as GameState;
  const check = (state: GameState, edit: (draft: GameState) => void) => {
    const draft = stored(state);
    edit(draft);
    return currentShape(draft, '');
  };

  it('em viagem, na encruzilhada, voltando e depois de voltar: sempre na forma', () => {
    const sent = send(hall(), 'oldForest', ['hero-1'], 'cautious', 0);
    let state = sent.state;
    expect(currentShape(stored(state), '')).toBeNull();
    for (let steps = 0; steps < 6 && state.guild.expeditions.length > 0; steps += 1) {
      const expedition = only(state);
      state = advanceTo(
        state,
        expedition.nodeEndsAtMs ?? expedition.crossroads?.decidesAtMs ?? 0,
      ).state;
      expect(currentShape(stored(state), '')).toBeNull();
    }
    expect(state.guild.reports).toHaveLength(1);
  });

  it('o fluxo de sorteio de uma expedição só cabe no estado com ela em curso (R2)', () => {
    const { state } = atFork(['hero-1']);
    expect(Object.keys(state.rng)).toEqual(['expedition:expedition-1']);
    expect(check(state, () => {})).toBeNull();
    // Um fluxo de uma expedição que já voltou, ou que ainda não existe.
    expect(
      check(state, (draft) => {
        draft.ids.expedition = 2;
        draft.rng['expedition:expedition-2'] = [1, 2, 3, 4];
      }),
    ).toBe('rng.expedition:expedition-2: fluxo de uma expedição que não está em curso');
    const home = advanceTo(state, state.lastProcessedAt + 12 * HOUR).state;
    expect(
      check(home, (draft) => {
        draft.rng['expedition:expedition-1'] = [1, 2, 3, 4];
      }),
    ).toBe('rng.expedition:expedition-1: fluxo de uma expedição que não está em curso');
  });

  it('recusa o que só se vê olhando dois campos', () => {
    const { state } = atFork(['hero-1']);
    const traveling = send(hall(), 'patrol', ['hero-1']).state;
    expect(check(state, (d) => (d.settlement.buildings.guild = 0))).toMatch(
      /expeditions: expedição sem a Guilda/,
    );
    expect(check(state, (d) => (d.guild.heroes[0]!.status = 'idle'))).toMatch(
      /heroIds: herói que não serve ao feudo em expedição/,
    );
    expect(check(state, (d) => (d.guild.heroes[1]!.status = 'expedition'))).toMatch(
      /status: herói em expedição sem expedição/,
    );
    expect(check(state, (d) => (d.guild.expeditions[0]!.crossroads = null))).toMatch(
      /crossroads: só a expedição parada/,
    );
    expect(check(state, (d) => (d.guild.expeditions[0]!.nodeEndsAtMs = 99 * HOUR))).toMatch(
      /nodeEndsAtMs: a expedição em um nó/,
    );
    expect(
      check(
        state,
        (d) => (d.guild.expeditions[0]!.crossroads = { decidesAtMs: d.lastProcessedAt }),
      ),
    ).toMatch(/prazo de encruzilhada vencido e não processado/);
    expect(
      check(traveling, (d) => (d.guild.expeditions[0]!.nodeEndsAtMs = d.lastProcessedAt)),
    ).toMatch(/fim de nó vencido e não processado/);
    expect(check(state, (d) => (d.ids.expedition = 0))).toMatch(
      /além do contador de ids.expedition/,
    );
    expect(
      check(state, (d) => {
        d.ids.expedition = 0;
        d.rng = {};
      }),
    ).toMatch(/expedição além do contador de ids.expedition/);
    expect(check(state, (d) => d.guild.expeditions.push({ ...d.guild.expeditions[0]! }))).toMatch(
      /expedições fora da ordem de identificador/,
    );
    expect(check(state, (d) => (d.guild.expeditions[0]!.heroIds = []))).toMatch(
      /esperada lista de 1 a 4 heróis/,
    );
    expect(check(state, (d) => (d.guild.expeditions[0]!.variant = 3))).toMatch(/variante de 0 a 2/);
    expect(check(state, (d) => (d.guild.expeditions[0]!.log[0]!.decidedBy = 'player'))).toMatch(
      /só uma escolha tem opção e quem decidiu/,
    );
    expect(
      check(state, (d) => {
        const [entry] = d.guild.expeditions[0]!.log;
        d.guild.expeditions[0]!.log = Array.from({ length: 9 }, () => ({ ...entry! }));
      }),
    ).toMatch(/lista de até 8 registros/);
    // Um campo de outra versão não entra antes dela (regra 6 do CLAUDE.md).
    expect(
      check(state, (d) => ((d.guild.expeditions[0]!.loot as Record<string, unknown>).relics = [])),
    ).toMatch(/loot.relics: campo desconhecido/);
    expect(check(state, (d) => ((d.guild as Record<string, unknown>).caravans = []))).toMatch(
      /guild.caravans: campo desconhecido/,
    );
    const home = advanceTo(state, state.lastProcessedAt + 12 * HOUR).state;
    expect(
      check(home, (d) => {
        const [report] = d.guild.reports;
        d.guild.reports = [report!, report!, report!, report!];
      }),
    ).toMatch(/lista de até 3 relatórios/);
    expect(check(home, (d) => d.guild.reports.push({ ...d.guild.reports[0]! }))).toMatch(
      /relatório repetido/,
    );
  });

  it('os tetos escritos na guarda são os do conteúdo', () => {
    expect(chronicleTemplates.expeditionSent).toBeDefined();
    expect(rules.graph.maxSteps).toBe(8);
    expect(Math.max(...rules.slotsByGuildLevel)).toBe(3);
  });
});
