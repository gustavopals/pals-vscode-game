import { type Client, NetworkError } from '@lotg/client-sdk';
import type { GithubDevicePollResponse, GithubDeviceStartResponse } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { awaitGithubAuthorization } from './githubDevice';

const start: GithubDeviceStartResponse = {
  deviceCode: 'dispositivo-1',
  userCode: 'LOTG-0001',
  verificationUri: 'https://github.com/login/device',
  expiresInSeconds: 900,
  intervalSeconds: 5,
};

const pending: GithubDevicePollResponse = { status: 'pending' };
const authorized: GithubDevicePollResponse = {
  status: 'authorized',
  githubAccessToken: 'gho_teste',
};

/**
 * O GitHub de mentira responde pelo roteiro; o relógio anda só quando a espera "dorme". O
 * registro guarda, em ordem, cada espera e cada consulta, com o instante em que aconteceram.
 */
function setup(script: Array<GithubDevicePollResponse | Error>) {
  let clock = 1_000_000;
  let cancelled = false;
  const sleeps: number[] = [];
  const polls: Array<{ deviceCode: string; at: number }> = [];
  const timeline: string[] = [];
  const client: Pick<Client, 'pollGithubDevice'> = {
    pollGithubDevice: async (deviceCode) => {
      polls.push({ deviceCode, at: clock });
      timeline.push('consulta');
      const next = script.shift() ?? pending;
      if (next instanceof Error) {
        throw next;
      }
      return next;
    },
  };
  const options = {
    sleep: async (ms: number) => {
      sleeps.push(ms);
      timeline.push(`espera ${ms}`);
      clock += ms;
    },
    now: () => clock,
    cancelled: () => cancelled,
  };
  return {
    client,
    options,
    sleeps,
    polls,
    timeline,
    startedAt: clock,
    cancel: () => {
      cancelled = true;
    },
  };
}

describe('espera da confirmação no GitHub', () => {
  it('pendente, pendente, confirmado: devolve o token do GitHub', async () => {
    const { client, options, polls } = setup([pending, pending, authorized]);
    const outcome = await awaitGithubAuthorization(client, start, options);
    expect(outcome).toEqual({ kind: 'authorized', githubAccessToken: 'gho_teste' });
    expect(polls).toHaveLength(3);
    expect(polls.every((poll) => poll.deviceCode === 'dispositivo-1')).toBe(true);
  });

  it('espera o intervalo pedido antes de cada consulta, inclusive da primeira', async () => {
    const { client, options, sleeps, polls, timeline, startedAt } = setup([
      pending,
      pending,
      authorized,
    ]);
    await awaitGithubAuthorization(client, start, options);
    expect(timeline).toEqual([
      'espera 5000',
      'consulta',
      'espera 5000',
      'consulta',
      'espera 5000',
      'consulta',
    ]);
    expect(sleeps).toEqual([5_000, 5_000, 5_000]);
    expect(polls.map((poll) => poll.at - startedAt)).toEqual([5_000, 10_000, 15_000]);
  });

  it('usa o intervalo que o servidor informou, não um fixo', async () => {
    const { client, options, sleeps } = setup([pending, authorized]);
    await awaitGithubAuthorization(client, { ...start, intervalSeconds: 8 }, options);
    expect(sleeps).toEqual([8_000, 8_000]);
  });

  it('slowDown aumenta o intervalo das consultas seguintes', async () => {
    const { client, options, sleeps } = setup([
      pending,
      { status: 'slowDown', intervalSeconds: 10 },
      pending,
      authorized,
    ]);
    const outcome = await awaitGithubAuthorization(client, start, options);
    expect(outcome.kind).toBe('authorized');
    expect(sleeps).toEqual([5_000, 5_000, 10_000, 10_000]);
  });

  it('o intervalo nunca diminui, nem com um slowDown menor que o atual', async () => {
    const { client, options, sleeps } = setup([
      { status: 'slowDown', intervalSeconds: 12 },
      { status: 'slowDown', intervalSeconds: 7 },
      { status: 'slowDown', intervalSeconds: 3 },
      pending,
      { status: 'slowDown', intervalSeconds: 20 },
      authorized,
    ]);
    await awaitGithubAuthorization(client, start, options);
    expect(sleeps).toEqual([5_000, 12_000, 12_000, 12_000, 12_000, 20_000]);
    for (let index = 1; index < sleeps.length; index += 1) {
      expect(sleeps[index]).toBeGreaterThanOrEqual(sleeps[index - 1] ?? 0);
    }
  });

  it('o código vencido no servidor encerra a espera', async () => {
    const { client, options, polls } = setup([pending, { status: 'expired' }, authorized]);
    expect(await awaitGithubAuthorization(client, start, options)).toEqual({ kind: 'expired' });
    expect(polls).toHaveLength(2);
  });

  it('passado o prazo do código, encerra sem consultar de novo', async () => {
    const { client, options, polls, sleeps } = setup([]);
    const outcome = await awaitGithubAuthorization(
      client,
      { ...start, expiresInSeconds: 12 },
      options,
    );
    expect(outcome).toEqual({ kind: 'expired' });
    // Consultas aos 5 s e aos 10 s; aos 15 s o prazo de 12 s já passou.
    expect(polls).toHaveLength(2);
    expect(sleeps).toEqual([5_000, 5_000, 5_000]);
  });

  it('no instante exato do prazo o código já não vale', async () => {
    const { client, options, polls } = setup([]);
    const outcome = await awaitGithubAuthorization(
      client,
      { ...start, expiresInSeconds: 10 },
      options,
    );
    expect(outcome).toEqual({ kind: 'expired' });
    expect(polls).toHaveLength(1);
  });

  it('a espera sem resposta termina sozinha quando o prazo vence', async () => {
    const { client, options, polls } = setup([]);
    const outcome = await awaitGithubAuthorization(client, start, options);
    expect(outcome).toEqual({ kind: 'expired' });
    // 900 s de prazo a cada 5 s: a consulta dos 900 s não acontece.
    expect(polls).toHaveLength(179);
  });

  it('a recusa do jogador no GitHub encerra a espera', async () => {
    const { client, options, polls } = setup([pending, { status: 'denied' }]);
    expect(await awaitGithubAuthorization(client, start, options)).toEqual({ kind: 'denied' });
    expect(polls).toHaveLength(2);
  });

  it('fechar o diálogo cancela sem consultar o servidor de novo', async () => {
    const { client, options, polls, cancel } = setup([pending, authorized]);
    const originalSleep = options.sleep;
    let waits = 0;
    options.sleep = async (ms) => {
      await originalSleep(ms);
      waits += 1;
      if (waits === 2) {
        // O jogador fechou o diálogo durante a segunda espera.
        cancel();
      }
    };
    const outcome = await awaitGithubAuthorization(client, start, options);
    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(polls).toHaveLength(1);
  });

  it('cancelado antes da primeira consulta, nenhuma é feita', async () => {
    const { client, options, polls, cancel } = setup([authorized]);
    cancel();
    expect(await awaitGithubAuthorization(client, start, options)).toEqual({ kind: 'cancelled' });
    expect(polls).toEqual([]);
  });

  it('cancelar vale mais que o prazo vencido', async () => {
    const { client, options, cancel } = setup([]);
    cancel();
    const outcome = await awaitGithubAuthorization(
      client,
      { ...start, expiresInSeconds: 1 },
      options,
    );
    expect(outcome).toEqual({ kind: 'cancelled' });
  });

  it('uma falha de rede na consulta sobe para quem chamou', async () => {
    const failure = new NetworkError('Sem ligação com o servidor.');
    const { client, options, polls } = setup([pending, failure, authorized]);
    await expect(awaitGithubAuthorization(client, start, options)).rejects.toBe(failure);
    // A espera parou ali: a tentativa inteira é refeita por quem chamou, com outro código.
    expect(polls).toHaveLength(2);
  });
});

describe('servidor ocupado durante a espera', () => {
  it('um 429 ou 5xx em uma consulta só adia a próxima: o código já confirmado não se perde', async () => {
    const { ApiClientError } = await import('@lotg/client-sdk');
    const { client, options, sleeps } = setup([
      new ApiClientError(429, 'RATE_LIMITED', 'Muitas requisições.', undefined),
      new ApiClientError(500, 'INTERNAL', 'O GitHub não respondeu.', undefined),
      authorized,
    ]);
    await expect(awaitGithubAuthorization(client, start, options)).resolves.toEqual({
      kind: 'authorized',
      githubAccessToken: 'gho_teste',
    });
    // Depois do aperto, o intervalo sobe para 10 s e não volta a cair.
    expect(sleeps).toEqual([5_000, 10_000, 10_000]);
  });

  it('um erro que não é de servidor ocupado sobe para quem chamou', async () => {
    const { ApiClientError } = await import('@lotg/client-sdk');
    const { client, options } = setup([
      new ApiClientError(404, 'NOT_FOUND', 'Vínculo desligado.', undefined),
    ]);
    await expect(awaitGithubAuthorization(client, start, options)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
