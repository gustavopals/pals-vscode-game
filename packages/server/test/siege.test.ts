import { advanceTo, migrateState, type GameState } from '@lotg/engine';
import {
  CommandAcceptedSchema,
  GameRuleErrorSchema,
  type ApiError,
  type CommandAccepted,
  type GameRuleError,
  type ViewResponse,
  ViewResponseSchema,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readySiege } from '../../engine/src/siege.test-helpers';
import {
  call,
  createTestApp,
  HOUR,
  newPlayer,
  order,
  renew,
  send,
  type Player,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// V4G-T2.7: API real com PostgreSQL. Escritos, mas não executados em 2026-10-30:
// banco fora do ar por instrução do autor. Os testes HTTP sem banco ficam em src/app.test.ts.
let server: TestApp;
beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});
afterAll(async () => server.close());

const protocol = { 'x-lords-protocol': '4' };

async function betweenWaves(pace = 1): Promise<Player> {
  const player = await newPlayer(server);
  const ready = readySiege('lord', pace);
  const state = advanceTo(ready, ready.siege!.atMs).state;
  // A origem da linha faz a API encontrar exatamente o instante da primeira onda.
  const origin = new Date(server.clock.now().getTime() - state.lastProcessedAt / pace);
  state.settings.realOriginMs = origin.getTime();
  migrateState(state, { timeScale: pace });
  await server.pool.query(
    `update games set state = $1, schema_version = $2, time_scale = $3,
      created_at = $4, last_processed_at = $5, state_version = state_version + 1 where id = $6`,
    [JSON.stringify(state), state.schemaVersion, pace, origin, server.clock.now(), player.game.id],
  );
  return player;
}

async function row(gameId: string) {
  const result = await server.pool.query<{ state: GameState; state_version: string }>(
    'select state, state_version from games where id = $1',
    [gameId],
  );
  return result.rows[0]!;
}

describe('protocolo 4 e a decisão entre ondas (V4G-T2.7)', () => {
  it('recusa o app do protocolo 3 em leitura e ordem, sem avançar nem gravar recibo', async () => {
    const player = await betweenWaves();
    const before = await row(player.game.id);
    const old = { 'x-lords-protocol': '3' };
    const read = await call<ApiError>(server, 'GET', `/games/${player.game.id}/view`, {
      token: player.token,
      headers: old,
    });
    const command = order('swapWaveFormation', { wave: 2, formationId: 'formation-1' });
    const refused = await send<ApiError>(server, player.token, player.game.id, command, old);
    for (const reply of [read, refused]) {
      expect(reply.status).toBe(426);
      expect(reply.body).toEqual({
        code: 'UPGRADE_REQUIRED',
        message: 'Há uma versão nova do jogo. Recarregue a página.',
        details: { protocol: 4 },
      });
    }
    expect(await row(player.game.id)).toEqual(before);
    const receipts = await server.pool.query('select id from commands where game_id = $1', [
      player.game.id,
    ]);
    expect(receipts.rows).toEqual([]);
  });

  it.each([0.5, 1, 3])(
    'lê a onda e troca em duas abas com um só recibo no ritmo %s',
    async (pace) => {
      const player = await betweenWaves(pace);
      const read = await call<ViewResponse>(server, 'GET', `/games/${player.game.id}/view`, {
        token: player.token,
        headers: protocol,
      });
      expect(read.status).toBe(200);
      expect(ViewResponseSchema.parse(read.body)).toEqual(read.body);
      expect(read.body.view.pendingDecisions).toContainEqual(
        expect.objectContaining({
          kind: 'siegeWave',
          wave: 2,
          expiresInSeconds: 3600,
        }),
      );
      expect(JSON.stringify(read.body.view.siege)).not.toMatch(/composition|reductionPercent|rng/);

      const before = await row(player.game.id);
      const command = order('swapWaveFormation', { wave: 2, formationId: 'formation-1' });
      const responses = await Promise.all([
        send<CommandAccepted>(server, player.token, player.game.id, command, protocol),
        send<CommandAccepted>(server, player.token, player.game.id, command, protocol),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(CommandAcceptedSchema.parse(response.body)).toEqual(response.body);
        expect(response.body.view.siege?.plan[2]).toBe('formation-1');
        expect(
          response.body.events.filter((event) => event.type === 'waveFormationSwapped'),
        ).toHaveLength(1);
      }
      expect(responses[0]!.body).toEqual(responses[1]!.body);
      expect(
        responses.filter((response) => response.headers['x-lords-replayed'] === 'true'),
      ).toHaveLength(1);
      expect(BigInt((await row(player.game.id)).state_version)).toBe(
        BigInt(before.state_version) + 1n,
      );

      const repair = order('emergencyRepair', { wave: 2 });
      const fixed = await send<CommandAccepted>(
        server,
        player.token,
        player.game.id,
        repair,
        protocol,
      );
      expect(fixed.status).toBe(200);
      expect(CommandAcceptedSchema.parse(fixed.body)).toEqual(fixed.body);
      expect(fixed.body.events).toContainEqual(
        expect.objectContaining({
          type: 'wallRepaired',
          data: expect.objectContaining({ emergency: 1 }),
        }),
      );
      const again = await send<CommandAccepted>(
        server,
        player.token,
        player.game.id,
        repair,
        protocol,
      );
      expect(again.headers['x-lords-replayed']).toBe('true');
      expect(again.body).toEqual(fixed.body);
    },
  );

  it('encaminha as quatro ordens ao motor, preservando as recusas no contrato 422', async () => {
    const player = await newPlayer(server);
    const cases = [
      [order('setBattlePlan', { wave: 1, formationId: null }), 'SIEGE_NOT_SCHEDULED'],
      [order('swapWaveFormation', { wave: 2, formationId: null }), 'NO_WAVE_DECISION'],
      [order('emergencyRepair', { wave: 2 }), 'NO_WAVE_DECISION'],
      [order('callMilitia', { count: 1 }), 'MILITIA_NOT_ALLOWED'],
    ] as const;
    for (const [command, code] of cases) {
      const refused = await send<GameRuleError>(
        server,
        player.token,
        player.game.id,
        command,
        protocol,
      );
      expect(refused.status).toBe(422);
      expect(GameRuleErrorSchema.parse(refused.body)).toEqual(refused.body);
      expect(refused.body.details.code).toBe(code);
      expect(refused.body.message).toMatch(/\S.*\.$/);
    }
  });

  it('uma troca que chega no instante da última onda encontra o Cerco resolvido', async () => {
    const player = await betweenWaves();
    server.clock.advance(2 * HOUR);
    const token = await renew(server, player);
    const refused = await send<GameRuleError>(
      server,
      token,
      player.game.id,
      order('swapWaveFormation', { wave: 3, formationId: null }),
      protocol,
    );
    expect(refused.status).toBe(422);
    expect(GameRuleErrorSchema.parse(refused.body)).toEqual(refused.body);
    expect(refused.body.details.code).toBe('NO_WAVE_DECISION');
    expect(refused.body.details.view.pendingDecisions).toEqual([]);
    expect(refused.body.details.view.siege?.result).not.toBeNull();
  });

  it.each(['swapWaveFormation', 'emergencyRepair'] as const)(
    '%s da onda 2 no instante dela preserva o avanço e recusa atingir a onda 3',
    async (type) => {
      const player = await betweenWaves();
      const before = await row(player.game.id);
      const advanced = advanceTo(before.state, before.state.siege!.nextWaveAtMs!);
      server.clock.advance(HOUR);
      const token = await renew(server, player);
      const command =
        type === 'swapWaveFormation'
          ? order(type, { wave: 2, formationId: 'formation-1' })
          : order(type, { wave: 2 });
      const refused = await send<GameRuleError>(server, token, player.game.id, command, protocol);
      expect(refused.status).toBe(422);
      expect(GameRuleErrorSchema.parse(refused.body)).toEqual(refused.body);
      expect(refused.body.details.code).toBe('NO_WAVE_DECISION');
      expect(refused.body.details.view.siege?.current).toBe(2);
      expect(refused.body.details.view.siege?.plan[3]).toBeNull();
      expect(refused.body.details.view.pendingDecisions).toContainEqual(
        expect.objectContaining({ kind: 'siegeWave', wave: 3 }),
      );
      expect(
        refused.body.details.events.filter((event) => event.type === 'siegeWaveFought'),
      ).toHaveLength(1);
      expect(refused.body.details.events.map((event) => event.type)).not.toContain(
        'waveFormationSwapped',
      );
      expect(refused.body.details.events.map((event) => event.type)).not.toContain('wallRepaired');
      const persisted = await row(player.game.id);
      expect(persisted.state).toEqual(advanced.state);
      expect(BigInt(persisted.state_version)).toBe(BigInt(before.state_version) + 1n);

      const replay = await send<GameRuleError>(server, token, player.game.id, command, protocol);
      expect(replay.status).toBe(422);
      expect(replay.headers['x-lords-replayed']).toBe('true');
      expect(replay.body).toEqual(refused.body);
      expect((await row(player.game.id)).state_version).toBe(persisted.state_version);
    },
  );
});
