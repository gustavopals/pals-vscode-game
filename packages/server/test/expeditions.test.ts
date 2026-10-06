import {
  type ApiError,
  type CommandAccepted,
  type EventsResponse,
  PROTOCOL_VERSION,
  type ViewResponse,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  councilRecess,
  countRows,
  createTestApp,
  enlistHeroes,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  quietHorde,
  renew,
  send,
  tavernSite,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// As expedições pela API (roadmap da v0.3, V3D-T1.11; QA-06, QA-14 e QA-18): enviar e reenviar,
// escolher o caminho em duas abas, escolher depois do prazo, e o 426 a quem ainda fala o
// protocolo de antes da encruzilhada. O servidor de teste roda no ritmo 1: as 6 h reais do
// prazo são 6 h de jogo.

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});
afterAll(async () => {
  await server.close();
});

const PROTOCOL = 'x-lords-protocol';

const viewOf = async (token: string, gameId: string) => {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${gameId}/view`, { token });
  expect(reply.status).toBe(200);
  return reply.body.view;
};

const eventsOf = async (token: string, gameId: string) => {
  const reply = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events`, { token });
  expect(reply.status).toBe(200);
  return reply.body.events;
};

/**
 * Uma partida com a Guilda dos Aventureiros recém-inaugurada e dois heróis no feudo (Edda,
 * Guerreira; Rolf, Arqueiro): a obra é a do motor, pedida por ordem. O Conselho fica em recesso
 * e a Horda, calada, para os eventos serem só os das expedições.
 */
async function openGuild(name: string) {
  const player = await newPlayer(server, name);
  const gameId = player.game.id;
  await quietHorde(server, gameId);
  await councilRecess(server, gameId);
  await tavernSite(server, gameId, 2_000);
  await enlistHeroes(server, gameId, [
    { name: 'Edda', gender: 'f' },
    { name: 'Rolf', classId: 'archer' },
  ]);
  const built = await send<CommandAccepted>(
    server,
    player.token,
    gameId,
    order('startConstruction', { building: 'guild' }),
  );
  expect(built.status).toBe(200);
  expect(built.body.view.guild).toMatchObject({ built: false, slots: 0, available: [] });
  // A obra leva 20 minutos; vinte e cinco depois a Guilda está aberta.
  server.clock.advance(25 * MINUTE);
  await renew(server, player);
  return { player, gameId };
}

/** Envia a Floresta Antiga com Edda e espera a equipe chegar à encruzilhada. */
async function toCrossroads(name: string, posture: 'cautious' | 'balanced' | 'bold' = 'cautious') {
  const { player, gameId } = await openGuild(name);
  const sent = await send<CommandAccepted>(
    server,
    player.token,
    gameId,
    order('sendExpedition', { modelId: 'oldForest', heroIds: ['hero-1'], posture }),
  );
  expect(sent.status).toBe(200);
  // O primeiro trecho leva 15 minutos de jogo.
  server.clock.advance(16 * MINUTE);
  await renew(server, player);
  const view = await viewOf(player.token, gameId);
  const [expedition] = view.guild.expeditions;
  if (expedition === undefined || expedition.crossroads === null) {
    throw new Error('O teste esperava a equipe parada em uma encruzilhada.');
  }
  return { player, gameId, view, expedition, crossroads: expedition.crossroads };
}

describe('enviar uma expedição e reenviar a ordem', () => {
  it('um envio, um recibo: o duplo clique não manda duas equipes, e a outra aba encontra o lugar ocupado', async () => {
    const { player, gameId } = await openGuild('Aldonça');
    const before = await viewOf(player.token, gameId);
    expect(before.guild).toMatchObject({ built: true, level: 1, slots: 1, expeditions: [] });
    expect(before.guild.available.map((offer) => [offer.modelId, offer.locked])).toEqual([
      ['patrol', false],
      ['oldForest', false],
      // O Covil dos Lobos é conhecido desde sempre (V3D-T2); as Ruínas e o Resgate, não.
      ['wolfDen', false],
    ]);
    expect(before.guild.heroes.map((hero) => hero.atHome)).toEqual([true, true]);

    const patrol = order('sendExpedition', {
      modelId: 'patrol',
      heroIds: ['hero-1'],
      posture: 'balanced',
    });
    const original = await send<CommandAccepted>(server, player.token, gameId, patrol);
    expect(original.status).toBe(200);
    expect(original.headers['x-lords-replayed']).toBeUndefined();
    expect(original.body.events.map((event) => event.type)).toEqual(['expeditionSent']);
    expect(original.body.events[0]?.data).toMatchObject({
      expeditionId: 'expedition-1',
      modelId: 'patrol',
      heroes: 1,
    });
    expect(original.body.view.guild.expeditions).toHaveLength(1);
    expect(original.body.view.guild.expeditions[0]).toMatchObject({
      id: 'expedition-1',
      label: 'Patrulha dos Arredores',
      teamNames: ['Edda'],
      crossroads: null,
    });
    expect(original.body.view.guild.heroes.map((hero) => hero.atHome)).toEqual([false, true]);

    // O duplo clique: a mesma ordem, com o mesmo commandId, devolve o recibo sem reaplicar.
    server.clock.advance(2 * MINUTE);
    const replay = await send<CommandAccepted>(server, player.token, gameId, patrol);
    expect(replay.status).toBe(200);
    expect(replay.headers['x-lords-replayed']).toBe('true');
    expect(replay.body).toEqual(original.body);
    expect((await viewOf(player.token, gameId)).guild.expeditions).toHaveLength(1);

    // A outra aba, com a visão velha: outro commandId. A Guilda Nv1 sustenta uma expedição.
    const other = await send<ApiError>(
      server,
      player.token,
      gameId,
      order('sendExpedition', { modelId: 'patrol', heroIds: ['hero-2'], posture: 'bold' }),
    );
    expect(other.status).toBe(422);
    expect(other.body).toMatchObject({
      code: 'GAME_RULE',
      details: { code: 'EXPEDITION_LIMIT' },
    });
    expect(other.body.message).toContain('sustenta 1 expedição por vez');
    // E quem está fora não é dispensado.
    const dismissed = await send<ApiError>(
      server,
      player.token,
      gameId,
      order('dismissHero', { heroId: 'hero-1' }),
    );
    expect(dismissed.status).toBe(422);
    expect(dismissed.body.details).toMatchObject({ code: 'HERO_BUSY' });

    // Vinte minutos depois a Patrulha voltou: o relatório está na visão, e a equipe, no feudo.
    server.clock.advance(20 * MINUTE);
    await renew(server, player);
    const after = await viewOf(player.token, gameId);
    expect(after.guild.expeditions).toEqual([]);
    expect(after.guild.heroes.map((hero) => hero.atHome)).toEqual([true, true]);
    expect(after.guild.reports).toHaveLength(1);
    expect(after.guild.reports[0]).toMatchObject({
      expeditionId: 'expedition-1',
      label: 'Patrulha dos Arredores',
      teamNames: ['Edda'],
    });
    const events = await eventsOf(player.token, gameId);
    const mine = events.filter((event) => event.type.startsWith('expedition'));
    expect(mine.map((event) => event.type)).toEqual([
      'expeditionSent',
      'expeditionNodeResolved',
      'expeditionReturned',
    ]);
    // Uma ordem aceita, uma expedição: só um recibo de envio no banco.
    expect(
      await countRows(server.pool, 'commands', `game_id = '${gameId}' and type = 'sendExpedition'`),
    ).toBe(2);
    expect(
      await countRows(
        server.pool,
        'commands',
        `game_id = '${gameId}' and type = 'sendExpedition' and response_status = 200`,
      ),
    ).toBe(1);
  });

  it('nada do que é segredo sai pela API: nem a variante, nem a chave de nó, nem o gerador (QA-18)', async () => {
    const { player, gameId, view } = await toCrossroads('Briolanja', 'balanced');
    const events = await eventsOf(player.token, gameId);
    const chronicle = await call<unknown>(server, 'GET', `/games/${gameId}/chronicle`, {
      token: player.token,
    });
    for (const body of [view, events, chronicle.body]) {
      const text = JSON.stringify(body);
      expect(text).not.toMatch(
        /"(variant|nodeId|nodeEndsAtMs|decidesAtMs|durationFactor|rng|ids)"/,
      );
      expect(text).not.toContain('expedition:expedition-');
    }
    // A encruzilhada está entre as decisões à espera, com o prazo real de 6 h menos o minuto
    // que passou.
    expect(view.pendingDecisions).toEqual([
      {
        kind: 'crossroads',
        id: 'expedition-1',
        title: expect.stringContaining('Floresta Antiga: ') as string,
        expiresInSeconds: 6 * 3600 - 60,
      },
    ]);
    // A dificuldade só aparece do primeiro trecho, na lista de destinos.
    expect(JSON.stringify(view.guild.expeditions)).not.toMatch(/dificuldade/i);
  });
});

describe('a encruzilhada: duas abas, uma decisão (QA-06)', () => {
  it('a primeira ordem decide; a segunda aba, com outra opção, encontra a decisão tomada; o reenvio devolve o recibo', async () => {
    const { player, gameId, crossroads } = await toCrossroads('Catarina');
    expect(crossroads.options).toHaveLength(3);
    const open = crossroads.options.filter((option) => !option.locked);
    const [first, second] = [open[0], open.at(-1)];
    if (first === undefined || second === undefined || first.id === second.id) {
      throw new Error('O teste esperava duas opções abertas.');
    }
    const choice = order('chooseExpeditionPath', {
      expeditionId: 'expedition-1',
      optionId: first.id,
    });
    const chosen = await send<CommandAccepted>(server, player.token, gameId, choice);
    expect(chosen.status).toBe(200);
    expect(chosen.body.events.map((event) => event.type)).toContain('expeditionPathChosen');
    expect(chosen.body.events[0]?.data).toMatchObject({
      expeditionId: 'expedition-1',
      optionId: first.id,
      decidedBy: 'player',
    });
    expect(chosen.body.view.pendingDecisions).toEqual([]);

    // A outra aba ainda mostra a encruzilhada e escolhe outro caminho.
    const late = await send<ApiError>(
      server,
      player.token,
      gameId,
      order('chooseExpeditionPath', { expeditionId: 'expedition-1', optionId: second.id }),
    );
    expect(late.status).toBe(422);
    expect(late.body).toMatchObject({
      code: 'GAME_RULE',
      details: { code: 'CROSSROADS_DECIDED' },
    });

    // O reenvio da primeira: o mesmo recibo, sem decidir de novo.
    const replay = await send<CommandAccepted>(server, player.token, gameId, choice);
    expect(replay.status).toBe(200);
    expect(replay.headers['x-lords-replayed']).toBe('true');
    expect(replay.body).toEqual(chosen.body);

    const events = await eventsOf(player.token, gameId);
    expect(events.filter((event) => event.type === 'expeditionPathChosen')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'expeditionPostureDecided')).toHaveLength(0);
  });

  it('uma opção que não existe e uma que a equipe não pode tomar são recusadas com o motivo, e a equipe continua esperando', async () => {
    const { player, gameId, crossroads } = await toCrossroads('Dulce');
    const missing = await send<ApiError>(
      server,
      player.token,
      gameId,
      order('chooseExpeditionPath', { expeditionId: 'expedition-1', optionId: 'swim' }),
    );
    expect(missing.status).toBe(422);
    expect(missing.body.details).toMatchObject({ code: 'INVALID_OPTION' });
    for (const option of crossroads.options.filter((entry) => entry.locked)) {
      const locked = await send<ApiError>(
        server,
        player.token,
        gameId,
        order('chooseExpeditionPath', { expeditionId: 'expedition-1', optionId: option.id }),
      );
      expect(locked.status).toBe(422);
      expect(locked.body.details).toMatchObject({ code: 'OPTION_LOCKED' });
    }
    expect((await viewOf(player.token, gameId)).pendingDecisions).toHaveLength(1);
  });
});

describe('depois do prazo de 6 h reais, a Postura já decidiu', () => {
  it('a escolha tardia é recusada com CROSSROADS_DECIDED, e a Crônica diz que a Postura decidiu', async () => {
    const { player, gameId, crossroads } = await toCrossroads('Elvira', 'cautious');
    expect(crossroads.decidesInSeconds).toBe(6 * 3600 - 60);
    expect(crossroads.postureLabel).toBe('Cautelosa');
    const safe = crossroads.postureOptionId;
    // Cinco minutos antes do prazo a equipe ainda espera.
    server.clock.advance(6 * HOUR - 6 * MINUTE);
    await renew(server, player);
    const waiting = await viewOf(player.token, gameId);
    expect(waiting.pendingDecisions).toHaveLength(1);
    expect(waiting.pendingDecisions[0]?.expiresInSeconds).toBe(5 * 60);
    // Seis minutos depois o prazo passou: a ordem chega tarde.
    server.clock.advance(6 * MINUTE);
    const late = await send<ApiError>(
      server,
      player.token,
      gameId,
      order('chooseExpeditionPath', { expeditionId: 'expedition-1', optionId: safe }),
    );
    expect(late.status).toBe(422);
    expect(late.body).toMatchObject({
      code: 'GAME_RULE',
      message:
        'Essa encruzilhada já foi decidida, e a equipe seguiu caminho. A Crônica conta por onde.',
      details: { code: 'CROSSROADS_DECIDED' },
    });
    const events = await eventsOf(player.token, gameId);
    const decided = events.filter((event) => event.type === 'expeditionPostureDecided');
    expect(decided).toHaveLength(1);
    expect(decided[0]?.data).toMatchObject({
      expeditionId: 'expedition-1',
      optionId: safe,
      decidedBy: 'posture',
      posture: 'cautious',
    });
    expect(events.filter((event) => event.type === 'expeditionPathChosen')).toHaveLength(0);
    // A recusa preservou o avanço: a visão já não tem decisão à espera.
    expect((await viewOf(player.token, gameId)).pendingDecisions).toEqual([]);
  });
});

describe('protocolo 3: o app antigo não sabe ler a encruzilhada (QA-14)', () => {
  it('o cliente do protocolo 2 recebe 426 com o aviso de recarregar, em leitura e em ordem; o do 3 é atendido', async () => {
    expect(PROTOCOL_VERSION).toBe(3);
    const { player, gameId, crossroads } = await toCrossroads('Filipa');
    const old = { [PROTOCOL]: '2' };
    const expected = {
      code: 'UPGRADE_REQUIRED',
      message: 'Há uma versão nova do jogo. Recarregue a página.',
      details: { protocol: 3 },
    };
    const read = await call<ApiError>(server, 'GET', `/games/${gameId}/view`, {
      token: player.token,
      headers: old,
    });
    expect(read.status).toBe(426);
    expect(read.body).toEqual(expected);
    // A visão com a encruzilhada nunca chega a quem não a entenderia.
    expect(JSON.stringify(read.body)).not.toContain('crossroads');

    const before = await countRows(server.pool, 'commands', `game_id = '${gameId}'`);
    const choice = order('chooseExpeditionPath', {
      expeditionId: 'expedition-1',
      optionId: crossroads.postureOptionId,
    });
    const refused = await send<ApiError>(server, player.token, gameId, choice, old);
    expect(refused.status).toBe(426);
    expect(refused.body).toEqual(expected);
    // Nenhum recibo foi gravado, e os antigos ficaram como estavam.
    expect(await countRows(server.pool, 'commands', `game_id = '${gameId}'`)).toBe(before);

    // O app novo (e quem não diz o protocolo, como o monitor de saúde) é atendido.
    const current = await send<CommandAccepted>(server, player.token, gameId, choice, {
      [PROTOCOL]: String(PROTOCOL_VERSION),
    });
    expect(current.status).toBe(200);
    expect((await call<{ protocol: number }>(server, 'GET', '/version')).body.protocol).toBe(3);
  });
});
