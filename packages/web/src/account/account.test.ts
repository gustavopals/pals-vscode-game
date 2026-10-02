import { ApiClientError, type Client } from '@lotg/client-sdk';
import { type Account, CreateGameRequestSchema } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { memoryStore } from '../services/store';
import { type AccountState, AccountService, gameRequest } from './accountService';
import { conflictOptions } from './githubLink';
import { normalizeRecoveryCode, validateRecoveryCode } from './recoveryCode';

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'conta-1',
  displayName: 'Gustavo',
  linked: { github: false },
  hasRecoveryCode: false,
  createdAt: '2026-10-01T12:00:00.000Z',
  ...overrides,
});

const tokens = { accessToken: 'a', refreshToken: 'r', expiresIn: 900 };
const game = { id: 'partida-1', status: 'active' as const };

function setup(overrides: Partial<Record<keyof Client, unknown>> = {}, stored?: AccountState) {
  const calls: Array<[string, unknown]> = [];
  const record =
    (name: string, result: unknown) =>
    async (...args: unknown[]) => {
      calls.push([name, args[0]]);
      if (result instanceof Error) {
        throw result;
      }
      return typeof result === 'function'
        ? (result as (...a: unknown[]) => unknown)(...args)
        : result;
    };
  const defaults: Record<string, unknown> = {
    signUpAnonymous: { account: account(), ...tokens },
    createGame: game,
    listGames: [game],
    recover: { account: account({ hasRecoveryCode: true }), ...tokens },
    github: { account: account({ linked: { github: true } }) },
    createRecoveryCode: 'PEDR-7F3A-K9QD-M2XW-4HTB',
    getMe: account(),
    renameMe: account({ displayName: 'Dom Gustavo' }),
    logout: undefined,
    deleteMe: { deletedAt: '2026-10-01T12:00:00.000Z', purgeAfter: '2026-10-08T12:00:00.000Z' },
  };
  const client = Object.fromEntries(
    Object.entries({ ...defaults, ...overrides }).map(([name, result]) => [
      name,
      record(name, result),
    ]),
  ) as unknown as Client;
  const store = memoryStore(stored ? { 'lords.account:http://servidor': stored } : {});
  const service = new AccountService({
    client,
    store,
    serverKey: 'http://servidor',
    deviceLabel: 'VS Code em teste',
  });
  const changes: AccountState[] = [];
  service.onDidChange((state) => changes.push(state));
  return { service, calls, store, changes };
}

const welcome = {
  displayName: ' Gustavo ',
  settlementName: ' Pedra Alta ',
  timezone: 'America/Sao_Paulo',
  vigilHourLocal: 20,
};

describe('máquina de estados da conta', () => {
  it('começa fora e retoma a conta guardada sem tocar a rede', () => {
    const fresh = setup();
    expect(fresh.service.restore()).toEqual({ kind: 'signedOut' });

    const stored: AccountState = {
      kind: 'linked',
      accountId: 'conta-1',
      displayName: 'Gustavo',
      hasRecoveryCode: true,
      gameId: 'partida-1',
    };
    const returning = setup({}, stored);
    expect(returning.service.restore()).toEqual(stored);
    expect(returning.calls).toEqual([]);
  });

  it('"Jogar agora" cria a conta anônima e funda o feudo em duas chamadas', async () => {
    const { service, calls, store, changes } = setup();
    const state = await service.playNow(welcome);
    expect(state).toEqual({
      kind: 'anonymous',
      accountId: 'conta-1',
      displayName: 'Gustavo',
      hasRecoveryCode: false,
      gameId: 'partida-1',
    });
    expect(calls).toEqual([
      ['signUpAnonymous', { displayName: 'Gustavo', deviceLabel: 'VS Code em teste' }],
      [
        'createGame',
        { settlementName: 'Pedra Alta', timezone: 'America/Sao_Paulo', vigilHourLocal: 20 },
      ],
    ]);
    expect(store.get('lords.account:http://servidor')).toEqual(state);
    expect(changes.at(-1)).toEqual(state);
  });

  it('se a fundação do feudo falhar, a conta já criada fica guardada e não é criada de novo', async () => {
    const failing = setup({ createGame: new ApiClientError(500, 'INTERNAL', 'falhou', undefined) });
    await expect(failing.service.playNow(welcome)).rejects.toThrow('falhou');
    expect(failing.service.state).toMatchObject({ kind: 'anonymous', gameId: null });

    // Nova tentativa com a conta já existente: só funda o feudo.
    const retry = setup({}, failing.service.state);
    retry.service.restore();
    await retry.service.playNow(welcome);
    expect(retry.calls.map(([name]) => name)).toEqual(['createGame']);
  });

  it('entrar com o Código do Reino normaliza o código e acha a partida ativa', async () => {
    const { service, calls } = setup();
    const state = await service.signInWithRecoveryCode(' pedr-7f3a-k9qd-m2xw-4htb ');
    expect(calls[0]).toEqual([
      'recover',
      { code: 'PEDR7F3AK9QDM2XW4HTB', deviceLabel: 'VS Code em teste' },
    ]);
    expect(state).toMatchObject({ kind: 'anonymous', hasRecoveryCode: true, gameId: 'partida-1' });
  });

  it('conta sem partida ativa fica com gameId nulo', async () => {
    const { service } = setup({ listGames: [{ id: 'velha', status: 'archived' }] });
    expect(await service.signInWithRecoveryCode('PEDR7F3AK9QDM2XW4HTB')).toMatchObject({
      gameId: null,
    });
  });

  it('vincular ao GitHub passa a conta para "linked"', async () => {
    const { service } = setup();
    await service.playNow(welcome);
    const state = await service.signInOrLinkGithub('gho_x', async () => undefined);
    expect(state).toMatchObject({ kind: 'linked', gameId: 'partida-1' });
  });

  it('num conflito, pergunta qual feudo manter e repete com a escolha', async () => {
    const details = { existingDisplayName: 'Edda', currentHasProgress: true };
    let attempts = 0;
    const { service, calls } = setup({
      github: (input: { resolve?: string }) => {
        attempts += 1;
        if (input.resolve === undefined) {
          throw new ApiClientError(409, 'ACCOUNT_CONFLICT', 'conflito', details);
        }
        return {
          account: account({ id: 'conta-edda', displayName: 'Edda', linked: { github: true } }),
          ...tokens,
        };
      },
    });
    await service.playNow(welcome);
    const asked: unknown[] = [];
    const state = await service.signInOrLinkGithub('gho_x', async (conflict) => {
      asked.push(conflict);
      return 'useExisting';
    });
    expect(asked).toEqual([details]);
    expect(attempts).toBe(2);
    expect(calls.filter(([name]) => name === 'github').map(([, input]) => input)).toEqual([
      { githubAccessToken: 'gho_x', deviceLabel: 'VS Code em teste' },
      { githubAccessToken: 'gho_x', deviceLabel: 'VS Code em teste', resolve: 'useExisting' },
    ]);
    expect(state).toMatchObject({ kind: 'linked', accountId: 'conta-edda', displayName: 'Edda' });
  });

  it('se o jogador desiste do conflito, nada muda', async () => {
    const { service } = setup({
      github: new ApiClientError(409, 'ACCOUNT_CONFLICT', 'conflito', {
        existingDisplayName: 'Edda',
        currentHasProgress: false,
      }),
    });
    await service.playNow(welcome);
    const before = service.state;
    expect(await service.signInOrLinkGithub('gho_x', async () => undefined)).toBeNull();
    expect(service.state).toEqual(before);
  });

  it('gerar o Código do Reino marca a conta e devolve o código', async () => {
    const { service } = setup();
    await service.playNow(welcome);
    expect(await service.generateRecoveryCode()).toBe('PEDR-7F3A-K9QD-M2XW-4HTB');
    expect(service.state).toMatchObject({ hasRecoveryCode: true });
  });

  it('nova partida pede replaceActive e troca a partida da conta', async () => {
    const { service, calls } = setup();
    await service.playNow(welcome);
    await service.startNewGame({ settlementName: 'Vau Alto', timezone: 'UTC', vigilHourLocal: 21 });
    expect(calls.at(-1)).toEqual([
      'createGame',
      { settlementName: 'Vau Alto', timezone: 'UTC', vigilHourLocal: 21, replaceActive: true },
    ]);
  });

  it('sair limpa a conta local mesmo se o servidor não responder', async () => {
    const { service, store } = setup({ logout: new Error('sem rede') });
    await service.playNow(welcome);
    await expect(service.signOut()).rejects.toThrow('sem rede');
    expect(service.state).toEqual({ kind: 'signedOut' });
    expect(store.get('lords.account:http://servidor')).toBeUndefined();
  });

  it('excluir a conta e perder a sessão levam ao estado "fora"', async () => {
    const deleted = setup();
    await deleted.service.playNow(welcome);
    expect(await deleted.service.deleteAccount()).toMatchObject({
      purgeAfter: '2026-10-08T12:00:00.000Z',
    });
    expect(deleted.service.state).toEqual({ kind: 'signedOut' });

    const revoked = setup();
    await revoked.service.playNow(welcome);
    await revoked.service.handleUnauthenticated();
    expect(revoked.service.state).toEqual({ kind: 'signedOut' });
    expect(revoked.changes.at(-1)).toEqual({ kind: 'signedOut' });
  });

  it('sincronizar confere nome, vínculo e partida com o servidor', async () => {
    const { service } = setup({
      getMe: account({ displayName: 'Dom Gustavo', linked: { github: true } }),
    });
    await service.playNow(welcome);
    expect(await service.sync()).toMatchObject({ kind: 'linked', displayName: 'Dom Gustavo' });
    await service.rename('Dom Gustavo');
    expect(service.state).toMatchObject({ displayName: 'Dom Gustavo' });
  });
});

describe('corpo de criação de partida', () => {
  it('apara o nome e só manda replaceActive quando pedido', () => {
    const input = { settlementName: '  Pedra Alta ', timezone: 'UTC', vigilHourLocal: 20 };
    expect(gameRequest(input)).toEqual({
      settlementName: 'Pedra Alta',
      timezone: 'UTC',
      vigilHourLocal: 20,
    });
    expect(gameRequest(input, true)).toMatchObject({ replaceActive: true });
  });

  it('sem escolha, o corpo é o da v0.1: o servidor aplica os padrões dele', () => {
    const body = gameRequest({ settlementName: 'Pedra Alta', timezone: 'UTC', vigilHourLocal: 20 });
    expect(Object.keys(body).sort()).toEqual(['settlementName', 'timezone', 'vigilHourLocal']);
    expect(CreateGameRequestSchema.safeParse(body).success).toBe(true);
  });

  it('com a dificuldade e o ritmo escolhidos, os dois vão como vieram do catálogo', () => {
    const input = { settlementName: 'Pedra Alta', timezone: 'UTC', vigilHourLocal: 20 };
    for (const timeScale of [3, 1, 0.5]) {
      const body = gameRequest({ ...input, difficulty: 'ironKing', timeScale }, true);
      expect(body).toEqual({ ...input, difficulty: 'ironKing', timeScale, replaceActive: true });
      // O número segue como número: o servidor recusa '3' e qualquer ritmo fora da lista.
      expect(typeof body.timeScale).toBe('number');
      expect(CreateGameRequestSchema.safeParse(body).success).toBe(true);
    }
  });

  it('nova partida leva a escolha junto com o replaceActive', async () => {
    const { service, calls } = setup();
    await service.playNow({ ...welcome, difficulty: 'peasant', timeScale: 0.5 });
    expect(calls.at(-1)).toEqual([
      'createGame',
      expect.objectContaining({ difficulty: 'peasant', timeScale: 0.5 }),
    ]);
    await service.startNewGame({
      settlementName: 'Vau Alto',
      timezone: 'UTC',
      vigilHourLocal: 21,
      difficulty: 'ironKing',
      timeScale: 3,
    });
    expect(calls.at(-1)).toEqual([
      'createGame',
      {
        settlementName: 'Vau Alto',
        timezone: 'UTC',
        vigilHourLocal: 21,
        difficulty: 'ironKing',
        timeScale: 3,
        replaceActive: true,
      },
    ]);
  });
});

describe('validação do Código do Reino', () => {
  it('aceita o código com ou sem hífens, em qualquer caixa', () => {
    expect(validateRecoveryCode('PEDR-7F3A-K9QD-M2XW-4HTB')).toBeNull();
    expect(validateRecoveryCode(' pedr7f3ak9qdm2xw4htb ')).toBeNull();
    expect(normalizeRecoveryCode(' pedr-7f3a-k9qd-m2xw-4htb ')).toBe('PEDR7F3AK9QDM2XW4HTB');
  });

  it('explica o que está errado antes de gastar uma tentativa no servidor', () => {
    expect(validateRecoveryCode('')).toContain('20 caracteres');
    expect(validateRecoveryCode('PEDR-7F3A')).toBe('O código tem 20 caracteres; você digitou 8.');
    expect(validateRecoveryCode('PEDR-7F3A-K9QD-M2XW-4HT0')).toContain('"0" não aparece');
    expect(validateRecoveryCode('PEDR-7F3A-K9QD-M2XW-4HTI')).toContain('"I" não aparece');
  });
});

describe('opções de conflito do GitHub', () => {
  it('descreve as duas saídas e avisa do progresso que será perdido', () => {
    const options = conflictOptions({ existingDisplayName: 'Edda', currentHasProgress: true });
    expect(options.map((option) => option.choice)).toEqual(['useExisting', 'keepCurrent']);
    expect(options[0]?.description).toContain('com o progresso que tem, será excluído');
    expect(options[1]?.label).toBe('Manter este feudo e mover o vínculo para ele');
    const fresh = conflictOptions({ existingDisplayName: 'Edda', currentHasProgress: false });
    expect(fresh[0]?.description).not.toContain('progresso');
  });
});
