import { describe, expect, it } from 'vitest';

import { browserNotifier, type NotificationApi } from './browserNotifications';

type Shown = { title: string; options: { body?: string; tag?: string } | undefined };

/** Uma Notification API de mentira: registra os pedidos de permissão e o que foi exibido. */
function fakeNotificationApi(
  initial: string,
  behaviour: { answer?: string; requestFails?: boolean; constructorFails?: boolean } = {},
) {
  const log = { requests: 0, shown: [] as Shown[] };
  class FakeNotification {
    static permission = initial;

    static async requestPermission(): Promise<string> {
      log.requests += 1;
      if (behaviour.requestFails) {
        throw new Error('pedido de permissão não suportado aqui');
      }
      FakeNotification.permission = behaviour.answer ?? 'default';
      return FakeNotification.permission;
    }

    constructor(title: string, options?: { body?: string; tag?: string }) {
      if (behaviour.constructorFails) {
        throw new TypeError('Illegal constructor');
      }
      log.shown.push({ title, options });
    }
  }
  const api: NotificationApi = FakeNotification;
  return {
    api,
    log,
    setPermission: (permission: string) => {
      FakeNotification.permission = permission;
    },
  };
}

describe('navegador sem a API de notificações', () => {
  it('não tem suporte, nunca tem permissão e não quebra ao ser usado', async () => {
    const notifier = browserNotifier(undefined);
    expect(notifier.supported).toBe(false);
    expect(notifier.granted()).toBe(false);
    expect(await notifier.request()).toBe(false);
    expect(() => notifier.show('Pedra Alta', 'A fome chegou.')).not.toThrow();
    expect(notifier.granted()).toBe(false);
  });
});

describe('permissão', () => {
  it('criar o notificador e consultar a permissão nunca a pedem', () => {
    const { api, log } = fakeNotificationApi('default');
    const notifier = browserNotifier(api);
    expect(notifier.supported).toBe(true);
    expect(notifier.granted()).toBe(false);
    notifier.show('Pedra Alta', 'A fome chegou.');
    expect(log.requests).toBe(0);
  });

  it('pedida e concedida: passa a ter permissão', async () => {
    const { api, log } = fakeNotificationApi('default', { answer: 'granted' });
    const notifier = browserNotifier(api);
    expect(await notifier.request()).toBe(true);
    expect(log.requests).toBe(1);
    expect(notifier.granted()).toBe(true);
  });

  it('pedida e negada: continua sem permissão', async () => {
    const { api, log } = fakeNotificationApi('default', { answer: 'denied' });
    const notifier = browserNotifier(api);
    expect(await notifier.request()).toBe(false);
    expect(log.requests).toBe(1);
    expect(notifier.granted()).toBe(false);
  });

  it('o jogador fechou o pedido sem responder: conta como não', async () => {
    const { api } = fakeNotificationApi('default', { answer: 'default' });
    const notifier = browserNotifier(api);
    expect(await notifier.request()).toBe(false);
    expect(notifier.granted()).toBe(false);
  });

  it('já concedida: não pergunta de novo', async () => {
    const { api, log } = fakeNotificationApi('granted');
    const notifier = browserNotifier(api);
    expect(notifier.granted()).toBe(true);
    expect(await notifier.request()).toBe(true);
    expect(log.requests).toBe(0);
  });

  it('já negada: não insiste', async () => {
    const { api, log } = fakeNotificationApi('denied', { answer: 'granted' });
    const notifier = browserNotifier(api);
    expect(await notifier.request()).toBe(false);
    expect(log.requests).toBe(0);
    expect(notifier.granted()).toBe(false);
  });

  it('um navegador que falha ao pedir a permissão conta como não', async () => {
    const { api, log } = fakeNotificationApi('default', { requestFails: true });
    const notifier = browserNotifier(api);
    expect(await notifier.request()).toBe(false);
    expect(log.requests).toBe(1);
  });

  it('acompanha a permissão do navegador, que o jogador pode mudar por fora', () => {
    const { api, setPermission } = fakeNotificationApi('granted');
    const notifier = browserNotifier(api);
    expect(notifier.granted()).toBe(true);
    setPermission('denied');
    expect(notifier.granted()).toBe(false);
  });
});

describe('exibição', () => {
  it('com permissão, mostra o título e o texto do evento', () => {
    const { api, log } = fakeNotificationApi('granted');
    browserNotifier(api).show('Pedra Alta', 'A fome chegou a Pedra Alta.');
    expect(log.shown).toHaveLength(1);
    expect(log.shown[0]?.title).toBe('Pedra Alta');
    expect(log.shown[0]?.options?.body).toBe('A fome chegou a Pedra Alta.');
  });

  it('usa sempre a mesma etiqueta: um aviso novo substitui o anterior em vez de empilhar', () => {
    const { api, log } = fakeNotificationApi('granted');
    const notifier = browserNotifier(api);
    notifier.show('Pedra Alta', 'Primeiro.');
    notifier.show('Pedra Alta', 'Segundo.');
    const tags = log.shown.map((entry) => entry.options?.tag);
    expect(tags).toHaveLength(2);
    expect(tags[0]).toBeTruthy();
    expect(tags[1]).toBe(tags[0]);
  });

  it('sem permissão (não pedida ou negada), não mostra nada', () => {
    for (const permission of ['default', 'denied']) {
      const { api, log } = fakeNotificationApi(permission);
      browserNotifier(api).show('Pedra Alta', 'A fome chegou.');
      expect(log.shown).toEqual([]);
    }
  });

  it('permissão retirada depois: para de mostrar', () => {
    const { api, log, setPermission } = fakeNotificationApi('granted');
    const notifier = browserNotifier(api);
    notifier.show('Pedra Alta', 'Um.');
    setPermission('denied');
    notifier.show('Pedra Alta', 'Dois.');
    expect(log.shown).toHaveLength(1);
  });

  it('um navegador que só aceita notificações por service worker não derruba o app', () => {
    const { api, log } = fakeNotificationApi('granted', { constructorFails: true });
    const notifier = browserNotifier(api);
    expect(() => notifier.show('Pedra Alta', 'A fome chegou.')).not.toThrow();
    expect(log.shown).toEqual([]);
  });
});
