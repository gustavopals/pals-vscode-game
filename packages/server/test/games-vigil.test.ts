import { readFileSync } from 'node:fs';

import { CURRENT_SCHEMA_VERSION, type GameState } from '@lotg/engine';
import type { CommandAccepted } from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { call, createTestApp, newPlayer, order, send, type TestApp } from './helpers/app';
import { resetTestDb } from './helpers/db';

let server: TestApp;
beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});
afterAll(async () => {
  await server.app.close();
  await server.pool.end();
});

async function row(id: string) {
  const result = await server.pool.query<{
    state: GameState;
    created_at: Date;
    timezone: string;
    vigil_hour: number;
    state_version: string;
  }>('select state, created_at, timezone, vigil_hour, state_version from games where id = $1', [
    id,
  ]);
  return result.rows[0]!;
}

describe('Hora da Vigília nas partidas (V4G-T1)', () => {
  it('cria com origem real e offset do fuso; mudar a preferência é idempotente e atualiza a linha', async () => {
    const player = await newPlayer(server);
    const initial = await row(player.game.id);
    expect(initial.state.settings.realOriginMs).toBe(initial.created_at.getTime());
    expect(initial.state.settings.vigil).toMatchObject({
      hourLocal: initial.vigil_hour,
      utcOffsetMinutes: -180,
      timezoneResolved: true,
    });
    const change = order('setVigilHour', { hourLocal: 3, timezone: 'Asia/Tokyo' });
    const first = await send<CommandAccepted>(server, player.token, player.game.id, change);
    expect(first.status).toBe(200);
    const after = await row(player.game.id);
    expect(after).toMatchObject({ timezone: 'Asia/Tokyo', vigil_hour: 3 });
    expect(after.state.settings.vigil).toEqual({
      hourLocal: 3,
      utcOffsetMinutes: 540,
      timezoneResolved: true,
    });
    expect(after.state.horde.scheduledRaids).toEqual(initial.state.horde.scheduledRaids);
    const repeated = await send<CommandAccepted>(server, player.token, player.game.id, change);
    expect(repeated.body).toEqual(first.body);
    expect((await row(player.game.id)).state_version).toBe(after.state_version);
    const receipt = await server.pool.query<{ payload: { resolvedVigil: unknown } }>(
      'select payload from commands where game_id = $1 and id = $2',
      [player.game.id, change.commandId],
    );
    expect(receipt.rows[0]?.payload.resolvedVigil).toEqual({
      utcOffsetMinutes: 540,
      timezoneResolved: true,
    });
    const stranger = await newPlayer(server, 'Outro');
    expect(
      (
        await send(
          server,
          stranger.token,
          player.game.id,
          order('setVigilHour', { hourLocal: 6, timezone: 'UTC' }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await send(
          server,
          player.token,
          player.game.id,
          order('setVigilHour', { hourLocal: 24, timezone: 'UTC' }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await send(
          server,
          player.token,
          player.game.id,
          order('setVigilHour', { hourLocal: 20, timezone: 'Marte/Olimpo' }),
        )
      ).status,
    ).toBe(422);
  });

  it('migra 34 → 35 da linha, sem mover uma incursão marcada; fuso antigo desconhecido usa UTC com aviso', async () => {
    const player = await newPlayer(server);
    const old = JSON.parse(
      readFileSync(
        new URL('../../engine/src/__fixtures__/state-v34-fresh.json', import.meta.url),
        'utf8',
      ),
    ) as { settings: { timezone: string } };
    old.settings.timezone = 'Fuso/Antigo';
    await server.pool.query(
      'update games set state = $1, schema_version = 34, timezone = $2 where id = $3',
      [JSON.stringify(old), 'Fuso/Antigo', player.game.id],
    );
    const response = await call<CommandAccepted>(server, 'GET', `/games/${player.game.id}/view`, {
      token: player.token,
    });
    expect(response.status).toBe(200);
    expect(response.body.view.settlement.vigil.warning).toContain('UTC');
    const loaded = await row(player.game.id);
    expect(loaded.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.state.settings.realOriginMs).toBe(loaded.created_at.getTime());
    expect(loaded.state.settings.vigil.utcOffsetMinutes).toBe(0);
    expect(loaded.state.settings.vigil.timezoneResolved).toBe(false);
    expect(loaded.state.horde.scheduledRaids).toEqual((old as GameState).horde.scheduledRaids);
  });
});
