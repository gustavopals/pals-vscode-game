import type { CommandAccepted, GameRuleError, ViewResponse, ViewState } from '@lotg/protocol';
import { ViewResponseSchema } from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  createTestApp,
  councilRecess,
  newPlayer,
  order,
  quietHorde,
  send,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// As formações salvas e a Defesa ativa vistas pela API (V4C-T2; GDD §10.8; ADR 0019, decisões 8 e
// 9): a formação é dado, sobrevive a recarregar a partida, a ordem repetida devolve o recibo e a
// recusa do motor chega com a frase em português.

const REPLAYED = 'x-lords-replayed';

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp({ config: { GAME_TIME_SCALE: '1' } });
});
afterAll(async () => {
  await server.close();
});

const posts = {
  left: { front: { unit: 'swordsman', count: 4 } as const, back: null },
  center: {
    front: { unit: 'spearman', count: 5 } as const,
    back: { unit: 'archer', count: 3 } as const,
  },
  right: { front: null, back: null },
};
const noCommanders = { left: null, center: null, right: null };

async function viewOf(who: { token: string; game: { id: string } }): Promise<ViewState> {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${who.game.id}/view`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
  return reply.body.view;
}

describe('formações salvas', () => {
  it('salva, sobrevive a recarregar, ativa e não deixa apagar a Defesa ativa', async () => {
    const who = await newPlayer(server);
    await quietHorde(server, who.game.id);
    await councilRecess(server, who.game.id);

    const save = order('saveFormation', {
      id: null,
      name: 'Defesa do portão',
      posts,
      commanders: noCommanders,
    });
    const saved = await send<CommandAccepted>(server, who.token, who.game.id, save);
    expect(saved.status).toBe(200);
    expect(saved.body.events.map((event) => event.type)).toEqual(['formationSaved']);

    // O reenvio da mesma ordem devolve o recibo e não cria outra formação.
    const again = await send<CommandAccepted>(server, who.token, who.game.id, save);
    expect(again.headers[REPLAYED]).toBe('true');
    expect(again.body).toEqual(saved.body);

    // "Recarregar": uma leitura nova traz a formação, com o que falta de cada unidade.
    const view = await viewOf(who);
    expect(view.army.formations).toHaveLength(1);
    const [formation] = view.army.formations;
    expect(formation).toMatchObject({
      id: 'formation-1',
      name: 'Defesa do portão',
      isActive: false,
      total: 12,
      canDelete: true,
    });
    expect(formation?.shortfall.map((entry) => entry.unit)).toEqual([
      'spearman',
      'swordsman',
      'archer',
    ]);
    const row = await server.pool.query<{ state: { army: { formations: unknown[] } } }>(
      'select state from games where id = $1',
      [who.game.id],
    );
    expect(row.rows[0]?.state.army.formations).toHaveLength(1);

    const activated = await send<CommandAccepted>(
      server,
      who.token,
      who.game.id,
      order('setActiveFormation', { id: 'formation-1' }),
    );
    expect(activated.status).toBe(200);
    expect((await viewOf(who)).army.formations[0]).toMatchObject({
      isActive: true,
      canDelete: false,
    });

    const refused = await send<GameRuleError>(
      server,
      who.token,
      who.game.id,
      order('deleteFormation', { id: 'formation-1' }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({
      code: 'GAME_RULE',
      details: { code: 'FORMATION_ACTIVE' },
    });
  });

  it('a recusa do motor chega com a frase, e a forma errada é barrada pelo protocolo', async () => {
    const who = await newPlayer(server);
    const archerInFront = {
      ...posts,
      right: { front: { unit: 'archer', count: 2 } as const, back: null },
    };
    const refused = await send<GameRuleError>(
      server,
      who.token,
      who.game.id,
      order('saveFormation', {
        id: null,
        name: 'Torta',
        posts: archerInFront,
        commanders: noCommanders,
      }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body.message).toMatch(/Arqueiro/);
    expect((await viewOf(who)).army.formations).toEqual([]);

    const malformed = await send<{ code: string }>(server, who.token, who.game.id, {
      commandId: crypto.randomUUID(),
      type: 'saveFormation',
      payload: { id: null, name: 'Sem postos', commanders: noCommanders },
    } as never);
    expect(malformed.status).toBe(400);
  });
});
