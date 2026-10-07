import type {
  ApiError,
  CommandAccepted,
  CreateGameRequest,
  EventsResponse,
  ViewResponse,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  councilRecess,
  createTestApp,
  HOUR,
  MINUTE,
  type Player,
  quietHorde,
  renew,
  rewriteState,
  send,
  signUp,
  startGame,
  order,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// Os desfechos das expedições pela API (roadmap da v0.3, V3D-T2; QA-08): equipar e reenviar a
// ordem, e o cenário roteirizado do "Pronto quando" nas três dificuldades (o Desastre com
// captura, o Resgate onde há quem resgatar, e o Covil limpo que muda a Ameaça). O servidor de
// teste roda no ritmo 1. Os desfechos são garantidos pela conta: o estado é posto direto no
// banco com a equipe fraca ou forte o bastante para toda a faixa da sorte.

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});
afterAll(async () => {
  await server.close();
});

type Difficulty = NonNullable<CreateGameRequest['difficulty']>;

const viewOf = async (player: Player) => {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${player.game.id}/view`, {
    token: player.token,
  });
  expect(reply.status).toBe(200);
  return reply.body.view;
};

const eventTypes = async (player: Player) => {
  const reply = await call<EventsResponse>(server, 'GET', `/games/${player.game.id}/events`, {
    token: player.token,
  });
  expect(reply.status).toBe(200);
  return reply.body.events;
};

const hero = (id: string, name: string, gender: 'f' | 'm') => ({
  id,
  name,
  gender,
  classId: 'warrior' as const,
  level: 10,
  xp: 0,
  traits: [],
  status: 'idle' as const,
  injury: null,
  captivity: null,
  equipment: { weapon: null, armor: null, accessory: null },
  joinedAtMs: 0,
  freedAtMs: null,
  discontent: false,
});

/**
 * Uma partida com a Guilda e a Torre de pé, três Guerreiros de nível 10, as Ruínas reveladas, um
 * arco no arsenal e a Ameaça em 60. O Conselho fica em recesso e a Horda, calada.
 */
async function campaign(name: string, difficulty: Difficulty): Promise<Player> {
  const auth = await signUp(server, name);
  const game = await startGame(server, auth.accessToken, { difficulty });
  const player: Player = {
    auth,
    accountId: auth.account.id,
    token: auth.accessToken,
    refreshToken: auth.refreshToken,
    game,
  };
  await quietHorde(server, game.id);
  await councilRecess(server, game.id);
  await rewriteState(server, game.id, (state) => {
    Object.assign(state.settlement.buildings, { townHall: 3, guild: 1, watchtower: 1 });
    Object.assign(state.settlement.resources, {
      food: 400_000,
      wood: 400_000,
      stone: 400_000,
      gold: 2_000_000,
    });
    state.guild.heroes = [
      hero('hero-1', 'Edda', 'f'),
      hero('hero-2', 'Rolf', 'm'),
      hero('hero-3', 'Brann', 'm'),
    ];
    state.guild.inventory = [{ id: 'item-1', defId: 'ashBow' }];
    state.ids = { ...state.ids, hero: 3, item: 1 };
    state.map.discovered = ['ruins'];
    state.map.threat = 60;
  });
  return player;
}

const pass = async (player: Player, ms: number) => {
  server.clock.advance(ms);
  await renew(server, player);
};

/**
 * Leva a expedição em curso até a encruzilhada (o primeiro nó dura 45 minutos, no máximo) e
 * responde por ela com a opção da posição dada na lista que a tela mostra (-1: a última).
 */
async function throughCrossroads(player: Player, position: number): Promise<void> {
  await pass(player, 46 * MINUTE);
  const [expedition] = (await viewOf(player)).guild.expeditions;
  const option = expedition?.crossroads?.options.at(position);
  if (expedition === undefined || option === undefined) {
    throw new Error('O teste esperava a equipe parada em uma encruzilhada.');
  }
  const chosen = await send<CommandAccepted>(
    server,
    player.token,
    player.game.id,
    order('chooseExpeditionPath', { expeditionId: expedition.id, optionId: option.id }),
  );
  expect(chosen.status).toBe(200);
}

describe('equipar um herói e reenviar a ordem', () => {
  it('um item, um dono: o duplo clique devolve o recibo, e a outra aba já não encontra o item', async () => {
    const player = await campaign('Aldara', 'lord');
    const gameId = player.game.id;
    const before = await viewOf(player);
    expect(before.guild.inventory).toMatchObject([
      { id: 'item-1', label: 'Arco de freixo', slotLabel: 'Arma', rarityLabel: 'Incomum' },
    ]);
    expect(before.guild.heroes[2]?.power).toBe(72.24);

    const equip = order('equipItem', { heroId: 'hero-3', itemId: 'item-1' });
    const original = await send<CommandAccepted>(server, player.token, gameId, equip);
    expect(original.status).toBe(200);
    expect(original.headers['x-lords-replayed']).toBeUndefined();
    expect(original.body.events.map((event) => event.type)).toEqual(['itemEquipped']);
    expect(original.body.view.guild.inventory).toEqual([]);
    expect(original.body.view.guild.heroes[2]?.equipment[0]?.item?.label).toBe('Arco de freixo');
    expect(original.body.view.guild.heroes[2]?.power).toBe(78.019);

    // O duplo clique: a mesma ordem, com o mesmo commandId, devolve o recibo sem reaplicar.
    server.clock.advance(MINUTE);
    const replay = await send<CommandAccepted>(server, player.token, gameId, equip);
    expect(replay.status).toBe(200);
    expect(replay.headers['x-lords-replayed']).toBe('true');
    expect(replay.body).toEqual(original.body);

    // A outra aba, com a visão velha: outro commandId, o mesmo item, outro herói.
    const other = await send<ApiError>(
      server,
      player.token,
      gameId,
      order('equipItem', { heroId: 'hero-1', itemId: 'item-1' }),
    );
    expect(other.status).toBe(422);
    expect(other.body).toMatchObject({ code: 'GAME_RULE', details: { code: 'ITEM_NOT_FOUND' } });
    const after = await viewOf(player);
    expect(after.guild.heroes.map((entry) => entry.equipment[0]?.item?.id ?? null)).toEqual([
      null,
      null,
      'item-1',
    ]);

    // Quem está em expedição não mexe no equipamento.
    const sent = await send<CommandAccepted>(
      server,
      player.token,
      gameId,
      order('sendExpedition', { modelId: 'patrol', heroIds: ['hero-3'], posture: 'bold' }),
    );
    expect(sent.status).toBe(200);
    const busy = await send<ApiError>(
      server,
      player.token,
      gameId,
      order('unequipItem', { heroId: 'hero-3', slot: 'weapon' }),
    );
    expect(busy.status).toBe(422);
    expect(busy.body).toMatchObject({
      code: 'GAME_RULE',
      message: 'Brann está fora do feudo: o arsenal espera a volta da expedição.',
      details: { code: 'HERO_BUSY' },
    });
    // De volta, devolve o arco; o espaço vazio é recusado com o motivo.
    await pass(player, 20 * MINUTE);
    const back = await send<CommandAccepted>(
      server,
      player.token,
      gameId,
      order('unequipItem', { heroId: 'hero-3', slot: 'weapon' }),
    );
    expect(back.status).toBe(200);
    expect(back.body.view.guild.inventory.map((item) => item.id)).toEqual(['item-1']);
    const empty = await send<ApiError>(
      server,
      player.token,
      gameId,
      order('unequipItem', { heroId: 'hero-3', slot: 'weapon' }),
    );
    expect(empty.body).toMatchObject({ details: { code: 'WRONG_SLOT' } });
    // O estado gravado está na versão dos desfechos.
    const row = await server.pool.query<{ schema_version: number }>(
      'select schema_version from games where id = $1',
      [gameId],
    );
    expect(row.rows[0]?.schema_version).toBe(22);
  });

  it('nada do que é segredo sai pela API: nem a chave do item no conteúdo, nem o cativeiro, nem o prazo cru', async () => {
    const player = await campaign('Brites', 'lord');
    const reply = await call<ViewResponse>(server, 'GET', `/games/${player.game.id}/view`, {
      token: player.token,
    });
    const text = JSON.stringify(reply.body);
    expect(text).not.toMatch(/"(defId|captivity|untilMs|discovered|rng|ids)"/);
    // O Resgate não aparece sem cativo.
    expect(reply.body.view.guild.available.map((offer) => offer.modelId)).toEqual([
      'patrol',
      'oldForest',
      'wolfDen',
      'ruins',
    ]);
  });
});

describe('o cenário roteirizado dos desfechos pela API (V3D-T2, "Pronto quando")', () => {
  it.each<[Difficulty, string]>([
    ['peasant', 'heroInjured'],
    ['lord', 'heroCaptured'],
    ['ironKing', 'heroDied'],
  ])(
    'em %s: o Desastre na cripta dá %s, o Resgate só existe com cativo, e limpar o Covil muda a Ameaça',
    async (difficulty, fate) => {
      const player = await campaign(`Senhor ${difficulty}`, difficulty);
      const gameId = player.game.id;

      // 1. Edda e Rolf partem para as Ruínas, e o estado os põe, fracos, diante do guardião.
      const sent = await send<CommandAccepted>(
        server,
        player.token,
        gameId,
        order('sendExpedition', {
          modelId: 'ruins',
          heroIds: ['hero-1', 'hero-2'],
          posture: 'balanced',
        }),
      );
      expect(sent.status).toBe(200);
      await rewriteState(server, gameId, (state) => {
        const [expedition] = state.guild.expeditions;
        if (expedition === undefined) {
          throw new Error('O teste esperava a expedição em curso.');
        }
        // A primeira variante das Ruínas, diante do Guardião de Pedra: a equipe já passou pela
        // encruzilhada (o caminho não importa aqui).
        Object.assign(expedition, {
          variant: 0,
          status: 'traveling',
          nodeId: 'stoneGuardian',
          nodeEndsAtMs: state.lastProcessedAt + 10 * MINUTE,
          crossroads: null,
        });
        // Dois Clérigos de nível 1, Descontentes: 51,2 contra 92 é Desastre em toda a sorte.
        for (const entry of state.guild.heroes.slice(0, 2)) {
          Object.assign(entry, { classId: 'cleric', level: 1, discontent: true });
        }
        state.guild.wageArrears = { sinceMs: state.lastProcessedAt, carriedMs: 0, departed: 0 };
        state.settlement.resources.gold = 0;
      });
      await pass(player, 11 * MINUTE);
      const afterCrypt = await viewOf(player);
      const cryptEvents = (await eventTypes(player)).filter((event) =>
        ['heroInjured', 'heroCaptured', 'heroDied'].includes(event.type),
      );
      expect(cryptEvents.map((event) => event.type)).toEqual([fate]);
      const expected = {
        peasant: { heroes: 3, captives: 0, spared: 1 },
        lord: { heroes: 3, captives: 1, spared: undefined },
        ironKing: { heroes: 2, captives: 0, spared: undefined },
      }[difficulty];
      expect(afterCrypt.guild.heroes).toHaveLength(expected.heroes);
      expect(afterCrypt.guild.heroes.filter((entry) => entry.captive)).toHaveLength(
        expected.captives,
      );
      expect(cryptEvents[0]?.data.spared).toBe(expected.spared);
      expect(afterCrypt.guild.captiveText === null).toBe(difficulty !== 'lord');

      // 2. A equipe volta; o soldo é pago de novo e quem ficou volta a ser forte.
      await pass(player, 50 * MINUTE);
      await rewriteState(server, gameId, (state) => {
        state.guild.wageArrears = null;
        state.guild.lastWageArrears = null;
        state.settlement.resources.gold = 2_000_000;
        for (const entry of state.guild.heroes) {
          entry.discontent = false;
          if (entry.status !== 'captured') {
            Object.assign(entry, { classId: 'warrior', level: 10 });
          }
        }
      });
      const home = await viewOf(player);
      const ready = home.guild.heroes.filter((entry) => entry.canDepart).map((entry) => entry.id);

      // 3. O Resgate: só em Senhor há quem resgatar.
      const rescue = await send<CommandAccepted | ApiError>(
        server,
        player.token,
        gameId,
        order('sendExpedition', { modelId: 'rescue', heroIds: ready.slice(0, 2), posture: 'bold' }),
      );
      if (difficulty === 'lord') {
        expect(rescue.status).toBe(200);
        // Diante do cativeiro, o caminho seguro (o último da lista): com dois de nível 10,
        // Sucesso Pleno em toda a sorte, nas três variantes.
        await throughCrossroads(player, -1);
        await pass(player, 80 * MINUTE);
        const rescued = await viewOf(player);
        expect(rescued.guild.heroes.filter((entry) => entry.captive)).toEqual([]);
        expect(rescued.guild.captiveText).toBeNull();
        expect((await eventTypes(player)).map((event) => event.type)).toContain('heroRescued');
      } else {
        expect(rescue.status).toBe(422);
        expect(rescue.body).toMatchObject({
          code: 'GAME_RULE',
          message: 'Esse destino ainda não está ao alcance do feudo: não há ninguém em cativeiro.',
          details: { code: 'EXPEDITION_LOCKED' },
        });
      }

      // 4. Quem se feriu sara, e dois de nível 10 vão ao Covil: a Ameaça cai e o tile para.
      await pass(player, 13 * HOUR);
      const before = await viewOf(player);
      const team = before.guild.heroes.filter((entry) => entry.canDepart).map((entry) => entry.id);
      expect(team.length).toBeGreaterThanOrEqual(2);
      if (!before.threat.known) {
        throw new Error('O teste esperava a Torre de Vigia de pé.');
      }
      expect(before.threat.tiles).toEqual([
        { id: 'wolfDen', label: 'Covil de Lobos', active: true },
      ]);
      const den = await send<CommandAccepted>(
        server,
        player.token,
        gameId,
        order('sendExpedition', { modelId: 'wolfDen', heroIds: team.slice(0, 2), posture: 'bold' }),
      );
      expect(den.status).toBe(200);
      // Na boca da toca, o caminho do meio, que limpa o Covil nas três variantes.
      await throughCrossroads(player, 1);
      await pass(player, 85 * MINUTE);
      const after = await viewOf(player);
      if (!after.threat.known) {
        throw new Error('O teste esperava a Torre de Vigia de pé.');
      }
      expect(after.threat.tiles).toEqual([
        { id: 'wolfDen', label: 'Covil de Lobos', active: false },
      ]);
      // Menos 30 do Covil limpo, mais no máximo 2 da virada de dia que caiu antes da toca.
      expect(after.threat.level).toBeLessThanOrEqual(before.threat.level - 28);
      expect(after.threat.level).toBeGreaterThanOrEqual(before.threat.level - 30);
      expect(after.threat).toMatchObject({ risePerDay: 0, raidChancePercent: 0, sources: [] });
      expect(after.threat.clearedText).toContain('O Covil de Lobos está limpo');
      const cleared = (await eventTypes(player)).filter(
        (event) => event.type === 'threatTileCleared',
      );
      expect(cleared).toHaveLength(1);
      expect(Object.keys(cleared[0]?.data ?? {}).sort()).toEqual([
        'expeditionId',
        'modelId',
        'tileId',
      ]);
      // E o destino fecha até a virada do ano.
      const offer = after.guild.available.find((entry) => entry.modelId === 'wolfDen');
      expect(offer?.locked).toBe(true);
      // O último passo do relatório é o caminho de volta; o da toca é o anterior.
      expect(after.guild.reports[0]?.log.at(-2)?.notes).toContain('Limpo: o Covil de Lobos.');
      expect(after.guild.reports[0]?.deedsText).toContain('Limpo: o Covil de Lobos.');
      expect(after.guild.reports[0]?.lossesText).toBe('Sem perdas: todos voltaram inteiros.');
    },
  );
});
