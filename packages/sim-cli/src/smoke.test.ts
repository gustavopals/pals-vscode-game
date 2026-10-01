import { randomUUID } from 'node:crypto';

import {
  applyCommand,
  type Command,
  createInitialState,
  deriveViewState,
  type GameState,
} from '@lotg/engine';
import { HEADERS } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { formatSmokeReport, runSmoke, type SmokeReport } from './smoke';

const BASE_URL = 'http://servidor.test';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const GAME_ID = '22222222-2222-4222-8222-222222222222';
const PURGE_AFTER = '2026-10-08T12:00:00.000Z';

/** Defeitos que o servidor de mentira sabe ter, um por garantia que a fumaça confere. */
type Fault =
  | 'signUpFails'
  | 'createGameFails'
  | 'commandsFail'
  | 'overAllocates'
  | 'lostWrite'
  | 'sameVersion'
  | 'replayReapplies'
  | 'replayUnmarked'
  | 'conflictAccepted'
  | 'conflictApplied'
  | 'refusalNotStored'
  | 'acceptsImpossible'
  | 'deleteFails';

type Receipt = { hash: string; status: number; body: unknown };

/**
 * Servidor de mentira sobre o motor de verdade: o mesmo caminho de um comando do GDD §14.5
 * (recibo por `commandId`, conflito por payload diferente, recusa guardada), em memória.
 */
function fakeServer(fault?: Fault) {
  let state: GameState = createInitialState('fumaca', {
    settlementName: 'Feudo de Fumaça',
    timezone: 'UTC',
    vigilHourLocal: 20,
    capsEnabled: false,
  });
  let version = 1;
  const receipts = new Map<string, Receipt>();
  const calls: string[] = [];
  let deleted = false;

  const view = (reading = false) => {
    const derived = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 });
    if (fault === 'lostWrite' && reading) {
      // A escrita da Fazenda se perdeu: cada resposta estava certa, mas a leitura não a enxerga.
      return {
        ...derived,
        population: {
          ...derived.population,
          free: derived.population.free + state.settlement.workers.farm,
        },
        workers: derived.workers.map((row) =>
          row.building === 'farm' ? { ...row, assigned: 0 } : row,
        ),
      };
    }
    return derived;
  };
  const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });
  const apiError = (status: number, code: string, message: string) =>
    respond(status, { code, message });

  function command(body: Command): Response {
    const hash = JSON.stringify([body.type, body.payload]);
    const receipt = receipts.get(body.commandId);
    if (receipt !== undefined && fault !== 'replayReapplies') {
      if (receipt.hash !== hash && fault !== 'conflictAccepted') {
        if (fault === 'conflictApplied') {
          const applied = applyCommand(state, body, state.lastProcessedAt);
          if (applied.ok) {
            state = applied.state;
          }
        }
        return apiError(409, 'COMMAND_ID_CONFLICT', 'Esse commandId já foi usado em outra ordem.');
      }
      if (receipt.hash === hash) {
        return respond(
          receipt.status,
          receipt.body,
          fault === 'replayUnmarked' ? {} : { [HEADERS.replayed]: 'true' },
        );
      }
    }
    if (fault === 'overAllocates' && body.type === 'setWorkers') {
      // Aplica sem validar: o defeito que a soma dos alocados denuncia.
      state = structuredClone(state);
      state.settlement.workers[body.payload.building] = body.payload.count;
      version += 1;
      return respond(200, {
        view: view(),
        events: [],
        stateVersion: String(version),
        staleView: false,
      });
    }
    const result =
      fault === 'acceptsImpossible' && body.type === 'setWorkers' && body.payload.count > 5
        ? { ok: true as const, state, events: [] }
        : applyCommand(state, body, state.lastProcessedAt);
    if (fault !== 'sameVersion') {
      version += 1;
    }
    let status: number;
    let responseBody: unknown;
    if (result.ok) {
      state = result.state;
      status = 200;
      responseBody = {
        view: view(),
        events: result.events,
        stateVersion: String(version),
        staleView: false,
      };
    } else {
      status = 422;
      responseBody = {
        code: 'GAME_RULE',
        message: result.message,
        details: {
          code: result.code,
          message: result.message,
          view: view(),
          events: [],
          stateVersion: String(version),
          staleView: false,
        },
      };
    }
    if (!(fault === 'refusalNotStored' && !result.ok)) {
      receipts.set(body.commandId, { hash, status, body: responseBody });
    }
    return respond(status, responseBody);
  }

  const fetch = (async (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const path = new URL(String(input)).pathname;
    calls.push(`${method} ${path}`);
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    if (method === 'POST' && path === '/v1/auth/anonymous') {
      return fault === 'signUpFails'
        ? apiError(429, 'RATE_LIMITED', 'Muitas contas criadas deste endereço.')
        : respond(201, {
            account: { id: ACCOUNT_ID, displayName: 'Bot de fumaça' },
            accessToken: 'acesso',
            refreshToken: 'renovacao',
          });
    }
    if (method === 'POST' && path === '/v1/games') {
      return fault === 'createGameFails'
        ? apiError(500, 'INTERNAL', 'Erro interno.')
        : respond(201, { game: { id: GAME_ID } });
    }
    if (method === 'POST' && path === `/v1/games/${GAME_ID}/commands`) {
      return fault === 'commandsFail'
        ? apiError(500, 'INTERNAL', 'Erro interno.')
        : command(body as Command);
    }
    if (method === 'GET' && path === `/v1/games/${GAME_ID}/view`) {
      return respond(200, { view: view(true), stateVersion: String(version) });
    }
    if (method === 'DELETE' && path === '/v1/me') {
      if (fault === 'deleteFails') {
        return apiError(500, 'INTERNAL', 'Erro interno.');
      }
      deleted = true;
      return respond(202, { deletedAt: '2026-10-01T12:00:00.000Z', purgeAfter: PURGE_AFTER });
    }
    return apiError(404, 'NOT_FOUND', `Rota desconhecida: ${method} ${path}`);
  }) as typeof globalThis.fetch;

  return { fetch, calls, isDeleted: () => deleted, state: () => state };
}

async function smoke(fault?: Fault, keep = false) {
  const server = fakeServer(fault);
  const report = await runSmoke({ baseUrl: BASE_URL, keep, fetch: server.fetch });
  return { server, report };
}

const checkOf = (report: SmokeReport, id: SmokeReport['checks'][number]['id']) => {
  const found = report.checks.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`O relatório não trouxe a verificação ${id}.`);
  }
  return found;
};

describe('fumaça contra um servidor correto', () => {
  it('passa nas quatro verificações e exclui a conta que criou', async () => {
    const { server, report } = await smoke();
    expect(report.checks.map((entry) => [entry.id, entry.ok])).toEqual([
      ['parallel', true],
      ['replay', true],
      ['conflict', true],
      ['refusalReplay', true],
    ]);
    expect(report).toMatchObject({
      ok: true,
      accountId: ACCOUNT_ID,
      gameId: GAME_ID,
      setupError: null,
      cleanup: { status: 'deleted', purgeAfter: PURGE_AFTER },
    });
    expect(server.isDeleted()).toBe(true);
  });

  it('cria uma conta e uma partida só, e manda as 10 ordens antes de qualquer resposta', async () => {
    const { server } = await smoke();
    const count = (call: string) => server.calls.filter((entry) => entry === call).length;
    expect(count('POST /v1/auth/anonymous')).toBe(1);
    expect(count('POST /v1/games')).toBe(1);
    expect(count('DELETE /v1/me')).toBe(1);
    // 10 em paralelo, 2 do reenvio, 1 do conflito e 2 da recusa.
    expect(count(`POST /v1/games/${GAME_ID}/commands`)).toBe(15);
    expect(server.calls.slice(2, 12)).toEqual(
      Array.from({ length: 10 }, () => `POST /v1/games/${GAME_ID}/commands`),
    );
    expect(server.calls.at(-1)).toBe('DELETE /v1/me');
  });

  it('o relatório diz o que foi visto em cada verificação', async () => {
    const { report } = await smoke();
    // O servidor de mentira atende na ordem de chegada: farm 1, 2, 3, serraria 1, 2 e o resto
    // não cabe em 5 aldeões.
    expect(formatSmokeReport(report)).toBe(
      [
        `Fumaça de concorrência em ${BASE_URL}`,
        `Conta ${ACCOUNT_ID} · partida ${GAME_ID}`,
        '[ok]     10 ordens setWorkers diferentes em paralelo: 5 aceitas e 5 recusadas pelo motor; 5 de 5 aldeões alocados, como na última ordem aceita de cada edifício',
        '[ok]     a mesma ordem reenviada devolve o mesmo recibo: mesmo corpo (stateVersion 12) e marca de reenvio',
        '[ok]     o mesmo commandId com outro payload recebe 409: 409 COMMAND_ID_CONFLICT, sem efeito no estado',
        '[ok]     uma recusa do motor reenviada devolve a mesma recusa: 422 NOT_ENOUGH_VILLAGERS nas duas vezes, com o mesmo corpo',
        `Conta excluída; o servidor remove os dados depois de ${PURGE_AFTER}.`,
        'Resultado: 4 de 4 verificações passaram.',
        '',
      ].join('\n'),
    );
  });

  it('com --keep a conta fica, e o relatório diz qual', async () => {
    const { server, report } = await smoke(undefined, true);
    expect(report).toMatchObject({ ok: true, cleanup: { status: 'kept' } });
    expect(server.isDeleted()).toBe(false);
    expect(server.calls).not.toContain('DELETE /v1/me');
    expect(formatSmokeReport(report)).toContain(
      `Conta mantida (--keep): ${ACCOUNT_ID}. Ela continua no servidor.`,
    );
  });

  it('usa o gerador de commandId informado, um por ordem nova', async () => {
    const ids: string[] = [];
    const server = fakeServer();
    const report = await runSmoke({
      baseUrl: BASE_URL,
      keep: false,
      fetch: server.fetch,
      newId: () => {
        const id = randomUUID();
        ids.push(id);
        return id;
      },
    });
    expect(report.ok).toBe(true);
    // 10 em paralelo, a ordem reenviada (o conflito reusa o id dela) e a ordem recusada.
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });
});

describe('fumaça contra um servidor com defeito', () => {
  const failing: Array<[Fault, SmokeReport['checks'][number]['id'], RegExp]> = [
    ['overAllocates', 'parallel', /alocados para 5 aldeões/],
    ['lostWrite', 'parallel', /visão final: farm tem 0, mas a última ordem aceita pedia 3/],
    ['sameVersion', 'parallel', /mesma stateVersion/],
    ['commandsFail', 'parallel', /10 ordens sem aceite nem recusa do motor: farm=1 → 500 INTERNAL/],
    ['replayReapplies', 'replay', /o reenvio não veio marcado/],
    ['replayUnmarked', 'replay', /o reenvio não veio marcado com X-Lords-Replayed/],
    ['conflictAccepted', 'conflict', /a ordem com outro payload foi aceita/],
    ['conflictApplied', 'conflict', /o conflito mudou o estado: a Fazenda ficou com 1/],
    ['refusalNotStored', 'refusalReplay', /o reenvio da recusa não veio marcado/],
    ['acceptsImpossible', 'refusalReplay', /o motor aceitou 6 na Fazenda com 5 aldeões/],
  ];

  it.each(failing)('%s: a verificação %s falha com o motivo', async (fault, id, reason) => {
    const { server, report } = await smoke(fault);
    expect(report.ok).toBe(false);
    expect(checkOf(report, id)).toMatchObject({ ok: false, detail: expect.stringMatching(reason) });
    // Uma verificação que falha não impede as outras nem a limpeza.
    expect(report.checks).toHaveLength(4);
    expect(server.isDeleted()).toBe(true);
    const text = formatSmokeReport(report);
    expect(text).toMatch(/\[FALHOU\] /);
    expect(text).toMatch(/Resultado: FALHOU \(\d de 4 verificações passaram\)\.\n$/);
  });

  it('conta que não pôde ser criada: nada a conferir e nada a excluir', async () => {
    const { server, report } = await smoke('signUpFails');
    expect(report).toMatchObject({
      ok: false,
      accountId: null,
      gameId: null,
      setupError: '429 RATE_LIMITED: Muitas contas criadas deste endereço.',
      checks: [],
      cleanup: { status: 'nothing' },
    });
    expect(server.calls).toEqual(['POST /v1/auth/anonymous']);
    expect(formatSmokeReport(report)).toBe(
      [
        `Fumaça de concorrência em ${BASE_URL}`,
        '[FALHOU] preparação (conta e partida): 429 RATE_LIMITED: Muitas contas criadas deste endereço.',
        'Nenhuma conta foi criada.',
        'Resultado: FALHOU (0 de 4 verificações passaram).',
        '',
      ].join('\n'),
    );
  });

  it('partida que não pôde ser criada: a conta criada é excluída mesmo assim', async () => {
    const { server, report } = await smoke('createGameFails');
    expect(report).toMatchObject({
      ok: false,
      accountId: ACCOUNT_ID,
      gameId: null,
      setupError: '500 INTERNAL: Erro interno.',
      cleanup: { status: 'deleted' },
    });
    expect(server.isDeleted()).toBe(true);
    expect(formatSmokeReport(report)).toContain(`Conta ${ACCOUNT_ID} · partida não criada`);
  });

  it('exclusão que falha: o resultado é falha e o relatório diz que a conta ficou', async () => {
    const { server, report } = await smoke('deleteFails');
    expect(report.checks.every((entry) => entry.ok)).toBe(true);
    expect(report).toMatchObject({
      ok: false,
      cleanup: { status: 'failed', reason: '500 INTERNAL: Erro interno.' },
    });
    expect(server.isDeleted()).toBe(false);
    const text = formatSmokeReport(report);
    expect(text).toContain(
      `A conta ${ACCOUNT_ID} NÃO foi excluída: 500 INTERNAL: Erro interno.. Ela continua no servidor.`,
    );
    expect(text).toContain('Resultado: FALHOU (4 de 4 verificações passaram).');
  });

  it('servidor fora do ar: falha na preparação, sem lançar', async () => {
    const report = await runSmoke({
      baseUrl: BASE_URL,
      keep: false,
      fetch: () => Promise.reject(new TypeError('fetch failed')),
    });
    expect(report).toMatchObject({
      ok: false,
      setupError: 'Sem ligação com o servidor.',
      cleanup: { status: 'nothing' },
    });
  });
});

describe('o relatório não traz credenciais', () => {
  it('nem o access token nem o refresh token aparecem', async () => {
    const { report } = await smoke();
    const text = formatSmokeReport(report) + JSON.stringify(report);
    expect(text).not.toContain('acesso');
    expect(text).not.toContain('renovacao');
  });
});
