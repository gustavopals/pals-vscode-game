import type {
  ApiError,
  ChronicleResponse,
  CommandAccepted,
  EventsResponse,
  GameRuleError,
  HealthResponse,
  VersionResponse,
  ViewResponse,
} from '@lotg/protocol';
import {
  CommandAcceptedSchema,
  EventsResponseSchema,
  GameRuleErrorSchema,
  ViewResponseSchema,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  createTestApp,
  HOUR,
  newPlayer,
  order,
  renew,
  send,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

describe('fluxo completo: conta → partida → comandos → view → eventos', () => {
  let server: TestApp;

  beforeAll(async () => {
    await resetTestDb();
    server = await createTestApp();
  });
  afterAll(async () => {
    await server.close();
  });

  it('responde saúde e versão sem autenticação', async () => {
    const health = await call<HealthResponse>(server, 'GET', '/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok', db: 'ok' });
    const version = await call<VersionResponse>(server, 'GET', '/version');
    expect(version.body).toMatchObject({ server: '0.1.0', protocol: 1 });
    expect(version.body.contentHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('um jogador novo governa Pedra Alta em poucos passos', async () => {
    const player = await newPlayer(server);
    const { game } = player;
    let { token } = player;
    expect(game).toMatchObject({
      status: 'active',
      settlementName: 'Pedra Alta',
      stateVersion: '1',
    });

    const first = await call<ViewResponse>(server, 'GET', `/games/${game.id}/view`, { token });
    expect(first.status).toBe(200);
    expect(ViewResponseSchema.safeParse(first.body).error).toBeUndefined();
    expect(first.body.view.population).toMatchObject({ villagers: 5, free: 5 });

    const allocated = await send<CommandAccepted>(
      server,
      token,
      game.id,
      order('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(allocated.status).toBe(200);
    expect(CommandAcceptedSchema.safeParse(allocated.body).error).toBeUndefined();
    expect(allocated.body.stateVersion).toBe('2');
    expect(allocated.body.events.map((event) => event.type)).toEqual(['objectiveCompleted']);

    const refused = await send<GameRuleError>(
      server,
      token,
      game.id,
      order('startConstruction', { building: 'townHall' }),
    );
    expect(refused.status).toBe(422);
    expect(GameRuleErrorSchema.safeParse(refused.body).error).toBeUndefined();
    expect(refused.body.details.code).toBe('INSUFFICIENT_RESOURCES');
    expect(refused.body.message).toBe('Faltam 30 madeira e 35 pedra.');

    server.clock.advance(2 * HOUR);
    // O access token vale 15 minutos: depois de duas horas, o jogador renova a sessão.
    const expired = await call(server, 'GET', `/games/${game.id}/view`, { token });
    expect(expired.status).toBe(401);
    token = await renew(server, player);
    const later = await call<ViewResponse>(server, 'GET', `/games/${game.id}/view`, { token });
    expect(later.body.view.calendar.dayOfSeason).toBe(2);
    expect(later.body.view.resources[0]).toMatchObject({ id: 'food', stock: 218, perHour: 19 });

    const events = await call<EventsResponse>(server, 'GET', `/games/${game.id}/events`, { token });
    expect(EventsResponseSchema.safeParse(events.body).error).toBeUndefined();
    expect(events.body.events.map((event) => [event.seq, event.type])).toEqual([
      [1, 'objectiveCompleted'],
      [2, 'dayStarted'],
    ]);

    const chronicle = await call<string>(server, 'GET', `/games/${game.id}/chronicle.md`, {
      token,
    });
    expect(chronicle.headers['content-type']).toContain('text/markdown');
    expect(chronicle.body).toContain('# Crônica de Pedra Alta');
    expect(chronicle.body).toContain('- No 1º dia da Primavera, cumpriu-se um objetivo');
  });

  it('a Crônica pode ser lida por ano de jogo', async () => {
    const player = await newPlayer(server, 'Cronista');
    const path = `/games/${player.game.id}/chronicle`;
    // Um ano de jogo dura 7 dias reais: no oitavo dia, o Ano 2 já começou.
    server.clock.advance(7 * 24 * HOUR + 3 * HOUR);
    const token = await renew(server, player);

    const first = await call<ChronicleResponse>(server, 'GET', `${path}?year=1&limit=500`, {
      token,
    });
    const second = await call<ChronicleResponse>(server, 'GET', `${path}?year=2&limit=500`, {
      token,
    });
    const third = await call<ChronicleResponse>(server, 'GET', `${path}?year=3`, { token });
    const all = await call<ChronicleResponse>(server, 'GET', `${path}?limit=500`, { token });
    const events = await call<EventsResponse>(
      server,
      'GET',
      `/games/${player.game.id}/events?limit=500`,
      { token },
    );

    // GET /events continua trazendo as viradas de dia: 83 no Ano 1 e duas no Ano 2.
    const days = events.body.events.filter((event) => event.type === 'dayStarted');
    expect(days).toHaveLength(85);
    // A Crônica não traz nenhuma (ADR 0007): ficam as viradas de estação e de ano.
    expect(all.body.entries).toEqual(
      events.body.events.filter((event) => event.type !== 'dayStarted'),
    );
    expect(all.body.entries.map((entry) => [entry.type, entry.text])).toEqual([
      // Ninguém foi para a Fazenda: a comida acaba na 36ª hora, ainda na Primavera.
      ['famineStarted', expect.stringContaining('A fome começou.')],
      ['seasonChanged', 'Chega o Verão a Pedra Alta.'],
      ['seasonChanged', 'Chega o Outono a Pedra Alta.'],
      ['seasonChanged', 'Chega o Inverno a Pedra Alta.'],
      ['yearStarted', 'Começa o ano 2 da Casa de Pedra Alta.'],
      ['seasonChanged', 'Chega a Primavera a Pedra Alta.'],
    ]);

    // O filtro por ano corta nos eventos yearStarted, mesmo sem as viradas de dia no meio.
    expect(first.body.entries).toEqual(all.body.entries.slice(0, 4));
    expect(second.body.entries).toEqual(all.body.entries.slice(4));
    expect(second.body.entries[0]).toMatchObject({ type: 'yearStarted', data: { year: 2 } });
    expect(third.body.entries).toEqual([]);

    const markdown = await call<string>(server, 'GET', `${path}.md`, { token });
    expect(markdown.body).toContain('## Ano 1');
    expect(markdown.body).toContain('## Ano 2\n\n- Começa o ano 2 da Casa de Pedra Alta.');
    expect(markdown.body).not.toContain('Amanhece');
    expect(markdown.body.split('\n').filter((line) => line.startsWith('- '))).toEqual(
      all.body.entries.map((entry) => `- ${entry.text}`),
    );
  });

  it('cliente de outra versão do protocolo recebe 426 com o aviso de recarregar a página', async () => {
    const reply = await call<ApiError>(server, 'GET', '/version', {
      headers: { 'x-lords-protocol': '2' },
    });
    expect(reply.status).toBe(426);
    expect(reply.body).toMatchObject({
      code: 'UPGRADE_REQUIRED',
      message: 'O jogo foi atualizado no servidor. Recarregue a página para continuar.',
      details: { protocol: 1 },
    });
    // O app é uma página: a mensagem não fala mais em extensão.
    expect(reply.body.message).not.toMatch(/extens/i);
  });
});
