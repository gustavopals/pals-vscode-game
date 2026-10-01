import type { ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import golden from '../../../engine/src/__golden__/view-seed-pedra-alta.json';
import type { AccountState } from '../account/accountService';
import { shouldRemindToLink } from '../account/linkReminder';
import { workersPreview } from '../commands/game';
import { describeError } from '../controller';
import { OfflineError } from '../game/gameSession';
import { Emitter, memorySecrets, memoryStore } from './store';
import { secretTokenStore } from './tokenStore';
import { ApiClientError, NetworkError } from '@lotg/client-sdk';

const view = golden.afterFirstAllocation as unknown as ViewState;

describe('tokens no SecretStorage', () => {
  it('guarda os dois tokens juntos, uma entrada por servidor', async () => {
    const secrets = memorySecrets();
    const local = secretTokenStore(secrets, 'http://localhost:3000');
    const hosted = secretTokenStore(secrets, 'https://lords.example');
    expect(await local.get()).toBeNull();

    await local.set({ accessToken: 'a', refreshToken: 'r' });
    expect(await local.get()).toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(await hosted.get()).toBeNull();
    expect([...secrets.data.keys()]).toEqual(['lords.tokens:http://localhost:3000']);

    await local.clear();
    expect(await local.get()).toBeNull();
    expect(secrets.data.size).toBe(0);
  });

  it('um valor corrompido é tratado como ausência de sessão', async () => {
    const secrets = memorySecrets();
    const store = secretTokenStore(secrets, 'http://s');
    await secrets.store('lords.tokens:http://s', '{ quebrado');
    expect(await store.get()).toBeNull();
    await secrets.store('lords.tokens:http://s', JSON.stringify({ accessToken: 'só um' }));
    expect(await store.get()).toBeNull();
  });
});

describe('armazenamento e eventos', () => {
  it('o armazenamento em memória guarda cópias e apaga com undefined', async () => {
    const store = memoryStore({ a: 1 });
    const value = { nested: [1, 2] };
    await store.update('b', value);
    value.nested.push(3);
    expect(store.get('b')).toEqual({ nested: [1, 2] });
    await store.update('a', undefined);
    expect(store.get('a')).toBeUndefined();
  });

  it('o emissor entrega a todos os ouvintes e permite cancelar', () => {
    const emitter = new Emitter<number>();
    const seen: number[] = [];
    const stop = emitter.on((value) => seen.push(value));
    emitter.on((value) => seen.push(value * 10));
    emitter.emit(1);
    stop();
    emitter.emit(2);
    expect(seen).toEqual([1, 10, 20]);
  });
});

describe('lembrete do dia 3', () => {
  const anonymous: AccountState = {
    kind: 'anonymous',
    accountId: 'c',
    displayName: 'Gustavo',
    hasRecoveryCode: false,
    gameId: 'p',
  };
  const onDay = (dayOfYear: number, year = 1): ViewState => ({
    ...view,
    calendar: { ...view.calendar, dayOfYear, year },
  });

  it('aparece a partir do terceiro dia real, só para conta anônima sem código', () => {
    expect(shouldRemindToLink(onDay(24), anonymous, false)).toBe(false);
    expect(shouldRemindToLink(onDay(25), anonymous, false)).toBe(true);
    expect(shouldRemindToLink(onDay(3, 2), anonymous, false)).toBe(true);
  });

  it('não aparece para quem já pode recuperar a conta, nem duas vezes', () => {
    expect(shouldRemindToLink(onDay(30), { ...anonymous, hasRecoveryCode: true }, false)).toBe(
      false,
    );
    expect(shouldRemindToLink(onDay(30), { ...anonymous, kind: 'linked' }, false)).toBe(false);
    expect(shouldRemindToLink(onDay(30), { kind: 'signedOut' }, false)).toBe(false);
    expect(shouldRemindToLink(onDay(30), anonymous, true)).toBe(false);
    expect(shouldRemindToLink(null, anonymous, false)).toBe(false);
  });
});

describe('alocação pela paleta', () => {
  const farm = view.workers[0]!;

  it('aceita de zero até os já alocados mais os livres', () => {
    expect(workersPreview(farm, 3, '0')).toBeNull();
    expect(workersPreview(farm, 3, '5')).toBeNull();
    expect(workersPreview(farm, 3, '6')).toBe(
      'Só há 5 disponíveis para Fazenda (2 já lá e 3 livres).',
    );
  });

  it('recusa o que não é um inteiro não negativo', () => {
    for (const input of ['', ' ', '-1', '1.5', 'dois']) {
      expect(workersPreview(farm, 3, input)).toBe('Digite um número inteiro de trabalhadores.');
    }
  });
});

describe('mensagens de erro para o jogador', () => {
  it('falta de rede, erro do servidor e erro inesperado', () => {
    expect(describeError(new OfflineError())).toMatchObject({ code: 'NETWORK' });
    expect(describeError(new NetworkError('x')).message).toContain('Sem ligação com o reino');
    expect(
      describeError(new ApiClientError(409, 'CONFLICT', 'Partida arquivada.', undefined)),
    ).toEqual({
      code: 'CONFLICT',
      message: 'Partida arquivada.',
    });
    expect(describeError(new Error('falha'))).toEqual({ code: 'INTERNAL', message: 'falha' });
    expect(describeError('texto')).toEqual({ code: 'INTERNAL', message: 'texto' });
  });
});
