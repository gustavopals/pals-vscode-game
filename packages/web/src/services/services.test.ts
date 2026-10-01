import type { ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import golden from '../../../engine/src/__golden__/view-seed-pedra-alta.json';
import type { AccountState } from '../account/accountService';
import {
  type LinkReminderRecord,
  readReminderRecord,
  REMIND_AFTER_MS,
  shouldRemindToLink,
} from '../account/linkReminder';
import { describeError } from '../app/controller';
import { OfflineError } from '../game/gameSession';
import { workersPreview } from '../palette/commands';
import {
  browserStore,
  browserTokenStore,
  memoryStorage,
  openStorage,
  type StorageLike,
  TOKENS_KEY,
} from './browserStore';
import { deviceLabel } from './device';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from './preferences';
import { REFRESH_LOCK, refreshLock, STORAGE_SETTLE_MS, storageSettle } from './sessionLock';
import { Emitter, memoryStore } from './store';
import { classifyStorageEvent, PREFERENCES_KEY, watchOtherTabs } from './tabSync';
import { watchPage } from './visibility';
import { ApiClientError, NetworkError } from '@lotg/client-sdk';

const view = golden.afterFirstAllocation as unknown as ViewState;

describe('armazenamento do navegador', () => {
  it('guarda como JSON, com o prefixo lords., e apaga com undefined', async () => {
    const storage = memoryStorage();
    storage.setItem('outro.site', 'x');
    const store = browserStore(storage);
    await store.update('lords.account:self', { displayName: 'Gustavo' });
    await store.update('semPrefixo', 1);
    expect(storage.getItem('lords.account:self')).toBe('{"displayName":"Gustavo"}');
    expect(store.get('lords.account:self')).toEqual({ displayName: 'Gustavo' });
    expect(store.get('semPrefixo')).toBe(1);
    // Só o que é do app aparece: o resto do armazenamento não é dele.
    expect([...store.keys()].sort()).toEqual(['lords.account:self', 'lords.semPrefixo']);
    await store.update('lords.account:self', undefined);
    expect(store.get('lords.account:self')).toBeUndefined();
    expect(storage.getItem('outro.site')).toBe('x');
  });

  it('um valor corrompido é tratado como ausente', () => {
    const storage = memoryStorage();
    storage.setItem('lords.cache', '{ quebrado');
    expect(browserStore(storage).get('lords.cache')).toBeUndefined();
  });

  it('cota cheia não derruba o app: o valor fica em memória até a aba fechar', async () => {
    const storage = memoryStorage();
    const full: StorageLike = {
      ...storage,
      get length() {
        return storage.length;
      },
      setItem: () => {
        throw new DOMException('cheio', 'QuotaExceededError');
      },
    };
    const store = browserStore(full);
    await store.update('lords.cache', { a: 1 });
    expect(store.get('lords.cache')).toEqual({ a: 1 });
    expect(store.keys()).toEqual(['lords.cache']);
    await store.update('lords.cache', undefined);
    expect(store.get('lords.cache')).toBeUndefined();
    expect(store.keys()).toEqual([]);
  });

  it('sem localStorage (modo privado, armazenamento negado), usa a memória', () => {
    const denied = openStorage(() => {
      throw new DOMException('negado', 'SecurityError');
    });
    expect(denied.persistent).toBe(false);
    denied.storage.setItem('lords.x', '1');
    expect(denied.storage.getItem('lords.x')).toBe('1');
    expect(openStorage(() => undefined).persistent).toBe(false);
    expect(openStorage(() => memoryStorage()).persistent).toBe(true);
  });

  it('guarda os dois tokens juntos e relê o armazenamento a cada chamada', async () => {
    const storage = memoryStorage();
    const tokens = browserTokenStore(storage);
    expect(await tokens.get()).toBeNull();
    await tokens.set({ accessToken: 'a', refreshToken: 'r' });
    expect(storage.getItem(TOKENS_KEY)).toBe('{"accessToken":"a","refreshToken":"r"}');
    // Outra aba renovou a sessão: esta encontra os tokens novos.
    storage.setItem(TOKENS_KEY, JSON.stringify({ accessToken: 'a2', refreshToken: 'r2' }));
    expect(await tokens.get()).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    await tokens.clear();
    expect(await tokens.get()).toBeNull();
    expect(storage.getItem(TOKENS_KEY)).toBeNull();
  });

  it('tokens corrompidos ou pela metade são ausência de sessão', async () => {
    const storage = memoryStorage();
    const tokens = browserTokenStore(storage);
    storage.setItem(TOKENS_KEY, '{ quebrado');
    expect(await tokens.get()).toBeNull();
    storage.setItem(TOKENS_KEY, JSON.stringify({ accessToken: 'só um' }));
    expect(await tokens.get()).toBeNull();
  });
});

describe('sessão dividida entre abas', () => {
  it('a renovação roda dentro do lock lords.refresh', async () => {
    const names: string[] = [];
    const lock = refreshLock({
      request: async (name, callback) => {
        names.push(name);
        return callback();
      },
    });
    expect(await lock(async () => 'novo')).toBe('novo');
    expect(names).toEqual([REFRESH_LOCK]);
    expect(REFRESH_LOCK).toBe('lords.refresh');
  });

  it('sem a Web Locks API, a tarefa roda direto', async () => {
    expect(await refreshLock(undefined)(async () => 7)).toBe(7);
  });

  it('o sumiço dos tokens ou da conta em outra aba é o fim da sessão; a renovação, não', () => {
    expect(classifyStorageEvent({ key: TOKENS_KEY, newValue: null })).toEqual({
      kind: 'signedOut',
    });
    expect(classifyStorageEvent({ key: TOKENS_KEY, newValue: '{"accessToken":"n"}' })).toBeNull();
    expect(classifyStorageEvent({ key: 'lords.account:self', newValue: null })).toEqual({
      kind: 'signedOut',
    });
    expect(classifyStorageEvent({ key: 'lords.account:self', newValue: '{}' })).toEqual({
      kind: 'account',
    });
    // `localStorage.clear()` chega com a chave nula.
    expect(classifyStorageEvent({ key: null, newValue: null })).toEqual({ kind: 'signedOut' });
    expect(classifyStorageEvent({ key: PREFERENCES_KEY, newValue: '{}' })).toEqual({
      kind: 'preferences',
    });
    expect(classifyStorageEvent({ key: 'lords.cache:self:c:p', newValue: '{}' })).toBeNull();
    expect(classifyStorageEvent({ key: 'outro.site', newValue: null })).toBeNull();
  });

  it('ouve o evento storage e deixa de ouvir ao cancelar', () => {
    const listeners = new Set<(event: StorageEvent) => void>();
    const seen: string[] = [];
    const stop = watchOtherTabs(
      {
        addEventListener: (_type, listener) => listeners.add(listener),
        removeEventListener: (_type, listener) => listeners.delete(listener),
      },
      (change) => seen.push(change.kind),
    );
    const fire = (key: string | null, newValue: string | null) =>
      listeners.forEach((listener) => listener({ key, newValue } as StorageEvent));
    fire(TOKENS_KEY, null);
    fire('lords.cache:x', '{}');
    expect(seen).toEqual(['signedOut']);
    stop();
    expect(listeners.size).toBe(0);
  });
});

describe('visibilidade da aba e rede', () => {
  it('informa o estado de saída, as trocas de visibilidade e a volta da rede', () => {
    const handlers: Record<string, () => void> = {};
    const page = {
      document: {
        visibilityState: 'hidden',
        addEventListener: (type: string, listener: () => void) => {
          handlers[type] = listener;
        },
        removeEventListener: (type: string) => {
          delete handlers[type];
        },
      },
      window: {
        addEventListener: (type: string, listener: () => void) => {
          handlers[type] = listener;
        },
        removeEventListener: (type: string) => {
          delete handlers[type];
        },
      },
    };
    const seen: string[] = [];
    const stop = watchPage(page, {
      onVisibility: (visible) => seen.push(visible ? 'visível' : 'oculta'),
      onOnline: () => seen.push('rede'),
    });
    page.document.visibilityState = 'visible';
    handlers.visibilitychange?.();
    handlers.online?.();
    expect(seen).toEqual(['oculta', 'visível', 'rede']);
    stop();
    expect(Object.keys(handlers)).toEqual([]);
  });
});

describe('preferências', () => {
  it('sem nada guardado, valem os padrões', () => {
    expect(loadPreferences(memoryStore())).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES).toMatchObject({
      notifications: 'essential',
      discreetMode: false,
      vigilHour: 20,
      theme: null,
      browserNotifications: false,
    });
  });

  it('grava e relê; o que não tem a forma esperada volta ao padrão', async () => {
    const store = memoryStore();
    const chosen = {
      ...DEFAULT_PREFERENCES,
      notifications: 'all' as const,
      theme: 'light' as const,
      vigilHour: 7,
      mutedUntil: 123,
    };
    await savePreferences(store, chosen);
    expect(loadPreferences(store)).toEqual(chosen);
    await store.update(PREFERENCES_KEY, {
      notifications: 'barulhento',
      vigilHour: 24,
      theme: 'rosa',
      discreetMode: 'sim',
      mutedUntil: 'amanhã',
    });
    expect(loadPreferences(store)).toEqual(DEFAULT_PREFERENCES);
    await store.update(PREFERENCES_KEY, 'texto');
    expect(loadPreferences(store)).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('rótulo da sessão', () => {
  it('diz o navegador e o sistema, sem identificar a máquina', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome em Linux');
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
      ),
    ).toBe('Firefox em Windows');
    expect(
      deviceLabel(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
      ),
    ).toBe('Safari em macOS');
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      ),
    ).toBe('Edge em Windows');
    expect(deviceLabel('curl/8')).toBe('Navegador');
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
  const SINCE = Date.parse('2026-10-01T12:00:00.000Z');
  const pending: LinkReminderRecord = { since: SINCE, shown: false };

  it('o prazo é de 48 horas reais', () => {
    expect(REMIND_AFTER_MS).toBe(48 * 60 * 60 * 1000);
  });

  it('não aparece antes de 48 horas da primeira vez; aparece a partir daí', () => {
    expect(shouldRemindToLink(pending, anonymous, SINCE)).toBe(false);
    expect(shouldRemindToLink(pending, anonymous, SINCE + REMIND_AFTER_MS - 1)).toBe(false);
    expect(shouldRemindToLink(pending, anonymous, SINCE + REMIND_AFTER_MS)).toBe(true);
    expect(shouldRemindToLink(pending, anonymous, SINCE + 30 * REMIND_AFTER_MS)).toBe(true);
  });

  it('um relógio que andou para trás não adianta o lembrete', () => {
    expect(shouldRemindToLink(pending, anonymous, SINCE - REMIND_AFTER_MS)).toBe(false);
  });

  it('não aparece para quem já pode recuperar a conta, nem duas vezes, nem sem registro', () => {
    const late = SINCE + 2 * REMIND_AFTER_MS;
    expect(shouldRemindToLink(pending, { ...anonymous, hasRecoveryCode: true }, late)).toBe(false);
    expect(shouldRemindToLink(pending, { ...anonymous, kind: 'linked' }, late)).toBe(false);
    expect(shouldRemindToLink(pending, { kind: 'signedOut' }, late)).toBe(false);
    expect(shouldRemindToLink({ ...pending, shown: true }, anonymous, late)).toBe(false);
    expect(shouldRemindToLink(null, anonymous, late)).toBe(false);
  });

  it('lê o registro guardado, sem levar adiante campos estranhos', () => {
    expect(readReminderRecord({ since: SINCE, shown: false })).toEqual(pending);
    expect(readReminderRecord({ since: SINCE, shown: true, extra: 1 })).toEqual({
      since: SINCE,
      shown: true,
    });
  });

  it('o formato antigo (`true`) é um lembrete que já apareceu', () => {
    const record = readReminderRecord(true);
    expect(record?.shown).toBe(true);
    expect(shouldRemindToLink(record, anonymous, SINCE + 30 * REMIND_AFTER_MS)).toBe(false);
  });

  it('sem nada guardado, ou com lixo, não há registro', () => {
    for (const stored of [
      undefined,
      null,
      false,
      'true',
      42,
      {},
      [],
      { since: SINCE },
      { shown: false },
      { since: '1', shown: false },
      { since: SINCE, shown: 'não' },
    ]) {
      expect(readReminderRecord(stored), JSON.stringify(stored)).toBeNull();
    }
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

describe('espera pela gravação de outra aba', () => {
  function setup() {
    const listeners = new Set<(event: StorageEvent) => void>();
    const timers: Array<{ callback: () => void; ms: number; cleared: boolean }> = [];
    const settle = storageSettle(
      {
        addEventListener: (_type, listener) => listeners.add(listener),
        removeEventListener: (_type, listener) => listeners.delete(listener),
      },
      {
        setTimeout: (callback, ms) => {
          const timer = { callback, ms, cleared: false };
          timers.push(timer);
          return timer;
        },
        clearTimeout: (timer: (typeof timers)[number]) => {
          timer.cleared = true;
        },
      },
    );
    const fire = (key: string | null) =>
      [...listeners].forEach((listener) => listener({ key } as StorageEvent));
    return { settle, listeners, timers, fire };
  }

  it('termina assim que chega o evento dos tokens, sem esperar o prazo', async () => {
    const { settle, listeners, timers, fire } = setup();
    let done = false;
    const waiting = settle().then(() => {
      done = true;
    });
    fire('lords.preferences');
    await Promise.resolve();
    expect(done).toBe(false);
    fire(TOKENS_KEY);
    await waiting;
    expect(done).toBe(true);
    expect(listeners.size).toBe(0);
    expect(timers[0]?.cleared).toBe(true);
  });

  it('sem evento, espera no máximo o prazo e deixa de ouvir', async () => {
    const { settle, listeners, timers } = setup();
    const waiting = settle();
    expect(timers).toMatchObject([{ ms: STORAGE_SETTLE_MS }]);
    expect(STORAGE_SETTLE_MS).toBeLessThanOrEqual(500);
    timers[0]?.callback();
    await waiting;
    expect(listeners.size).toBe(0);
  });

  it('roda dentro do lock, antes da tarefa que relê os tokens', async () => {
    const order: string[] = [];
    const lock = refreshLock(
      {
        request: async (_name, callback) => {
          order.push('lock');
          const result = await callback();
          order.push('solto');
          return result;
        },
      },
      async () => {
        order.push('espera');
      },
    );
    await lock(async () => {
      order.push('tarefa');
    });
    expect(order).toEqual(['lock', 'espera', 'tarefa', 'solto']);
  });
});
