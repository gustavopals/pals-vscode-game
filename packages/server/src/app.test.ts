import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type App, buildApp } from './app';
import { loadConfig } from './config';

// Um "banco" de mentira: estes testes cobrem só o esqueleto HTTP, sem PostgreSQL.
function fakePool(query: () => Promise<unknown>): Pool {
  return { query } as unknown as Pool;
}

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://nada',
  JWT_SECRET: Buffer.alloc(48, 1).toString('base64'),
  RECOVERY_CODE_SECRET: Buffer.alloc(48, 2).toString('base64'),
  LOG_LEVEL: 'silent',
  RATE_LIMIT_PER_MINUTE: '5',
});

describe('esqueleto do servidor', () => {
  let app: App;
  let dbUp = true;

  beforeAll(async () => {
    const pool = fakePool(() =>
      dbUp ? Promise.resolve({ rows: [] }) : Promise.reject(new Error('fora')),
    );
    ({ app } = await buildApp({ config, pool, logger: false }));
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health responde ok com o banco de pé e 503 com o banco fora', async () => {
    const up = await app.inject({ url: '/v1/health' });
    expect(up.statusCode).toBe(200);
    expect(up.json()).toEqual({ status: 'ok', db: 'ok' });

    dbUp = false;
    const down = await app.inject({ url: '/v1/health' });
    dbUp = true;
    expect(down.statusCode).toBe(503);
    expect(down.json()).toEqual({ status: 'ok', db: 'down' });
  });

  it('GET /v1/version informa servidor, protocolo e hash do conteúdo', async () => {
    const response = await app.inject({ url: '/v1/version' });
    expect(response.json()).toMatchObject({ server: '0.2.0', protocol: 2 });
    expect(response.json().contentHash).toMatch(/^[0-9a-f]{16}$/);
    expect(Number.isNaN(Date.parse(response.json().builtAt))).toBe(false);
  });

  it('rota desconhecida responde 404 no formato de erro da API', async () => {
    const response = await app.inject({ url: '/v1/nada' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'NOT_FOUND', message: 'Rota não encontrada.' });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('corpo fora da forma responde 400 VALIDATION com os campos problemáticos', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anonymous',
      payload: { displayName: 'A' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION' });
    expect(response.json().details.issues[0]).toMatchObject({ path: 'displayName' });
  });

  it('JSON malformado também é VALIDATION', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anonymous',
      headers: { 'content-type': 'application/json' },
      payload: '{ não é json',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION');
  });

  it('corpo acima de 64 KB é recusado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/anonymous',
      payload: { displayName: 'x'.repeat(70_000) },
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().code).toBe('VALIDATION');
  });

  it('rota autenticada sem credencial responde 401 UNAUTHORIZED', async () => {
    const response = await app.inject({ url: '/v1/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('UNAUTHORIZED');
  });

  it('cliente de outra versão do protocolo recebe 426 com mensagem amigável', async () => {
    // O app do protocolo 1 (a aba aberta desde antes do Conselho) não sabe ler as cartas.
    const response = await app.inject({ url: '/v1/version', headers: { 'x-lords-protocol': '1' } });
    expect(response.statusCode).toBe(426);
    expect(response.json()).toMatchObject({
      code: 'UPGRADE_REQUIRED',
      message: 'Há uma versão nova do jogo. Recarregue a página.',
      details: { protocol: 2 },
    });
    const same = await app.inject({ url: '/v1/version', headers: { 'x-lords-protocol': '2' } });
    expect(same.statusCode).toBe(200);
  });

  it('erro inesperado vira 500 INTERNAL com o requestId, sem vazar a causa', async () => {
    // Token bem formado leva a uma consulta ao banco, que aqui falha.
    const { signAccessToken } = await import('./auth/tokens');
    const { accessToken } = await signAccessToken(
      config,
      { accountId: 'a', sessionId: 's' },
      new Date(),
      new Date(Date.now() + 60_000),
    );
    dbUp = false;
    const response = await app.inject({
      url: '/v1/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    dbUp = true;
    expect(response.statusCode).toBe(500);
    expect(response.json().code).toBe('INTERNAL');
    expect(response.json().details.requestId).toBe(response.headers['x-request-id']);
    expect(response.body).not.toContain('fora');
    expect(response.body).not.toContain('select');
  });

  it('passa do limite de requisições por minuto e responde 429 RATE_LIMITED', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await app.inject({ url: '/v1/version', remoteAddress: '10.9.9.9' });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[7]).toBe(429);
    const blocked = await app.inject({ url: '/v1/version', remoteAddress: '10.9.9.9' });
    expect(blocked.json().code).toBe('RATE_LIMITED');
    // A saúde não entra no limite: o monitor externo consulta a cada minuto.
    const health = await app.inject({ url: '/v1/health', remoteAddress: '10.9.9.9' });
    expect(health.statusCode).toBe(200);
  });
});
