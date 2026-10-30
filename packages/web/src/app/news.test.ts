import { afterEach, describe, expect, it } from 'vitest';

import { newsSeenKey } from '../news/readState';
import { classifyStorageEvent } from '../services/tabSync';
import { ACCOUNT_ID, makeController, settle } from '../test-helpers';
import type { Controller } from './controller';

const controllers: Controller[] = [];
async function opened(signedIn = true) {
  const made = makeController({ signedIn });
  controllers.push(made.controller);
  await made.controller.start();
  await settle(made.controller);
  if (made.controller.server.status !== 'ready') throw new Error('Versão não chegou.');
  made.controller.server.value.server = '0.3.0';
  return made;
}

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
});

describe('notícias na bancada', () => {
  it('navegar não marca; desenhar à vista marca só a última versão publicada', async () => {
    const { controller, store } = await opened();
    expect(controller.hasUnreadNews).toBe(true);
    await controller.markNewsRead();
    expect(store.get(newsSeenKey(ACCOUNT_ID))).toBeUndefined();
    controller.navigate('news');
    expect(controller.hasUnreadNews).toBe(true);
    expect(controller.tabs).toContain('news');
    await controller.markNewsRead();
    expect(store.get(newsSeenKey(ACCOUNT_ID))).toBe('0.3.0');
    expect(controller.hasUnreadNews).toBe(false);
    controller.closeTab('news');
    expect(controller.route).toBe('fief');
  });

  it('espera a aba voltar à vista e não marca o rascunho de guerra', async () => {
    const { controller, store } = await opened();
    if (controller.server.status === 'ready') controller.server.value.server = '0.4.0';
    controller.setVisible(false);
    controller.navigate('news');
    await controller.markNewsRead();
    expect(store.get(newsSeenKey(ACCOUNT_ID))).toBeUndefined();
    controller.setVisible(true);
    await controller.markNewsRead();
    expect(store.get(newsSeenKey(ACCOUNT_ID))).toBe('0.3.0');
  });

  it('sem conta ou confirmação do servidor, permite ler sem acender nem gravar selo', async () => {
    const { controller, store } = await opened(false);
    controller.navigate('news');
    expect(controller.route).toBe('news');
    expect(controller.hasUnreadNews).toBe(false);
    await controller.markNewsRead();
    expect(store.keys().filter((key) => key.startsWith('lords.newsSeen:'))).toEqual([]);
    const signed = await opened();
    signed.controller.navigate('news');
    // Uma consulta sem resposta não usa a versão compilada do app como substituta.
    signed.controller.server = { status: 'error', message: 'Sem ligação' };
    expect(signed.controller.hasUnreadNews).toBe(false);
    await signed.controller.markNewsRead();
    expect(signed.store.get(newsSeenKey(ACCOUNT_ID))).toBeUndefined();
  });

  it('redesenha o selo quando outra aba registra a leitura da mesma conta', async () => {
    const { controller, store } = await opened();
    let updates = 0;
    const stop = controller.onChange(() => {
      updates += 1;
    });
    const change = classifyStorageEvent({ key: newsSeenKey(ACCOUNT_ID), newValue: '"0.3.0"' });
    expect(change).toEqual({ kind: 'newsRead', accountId: ACCOUNT_ID });
    await store.update(newsSeenKey(ACCOUNT_ID), '0.3.0');
    if (change !== null) controller.handleTabChange(change);
    expect(updates).toBe(1);
    expect(controller.hasUnreadNews).toBe(false);
    stop();
  });

  it('limpa a marca da conta ao encerrar a sessão', async () => {
    const { controller, store } = await opened();
    controller.navigate('news');
    await controller.markNewsRead();
    await controller.account.handleUnauthenticated();
    await controller.settled();
    expect(store.get(newsSeenKey(ACCOUNT_ID))).toBeUndefined();
    expect(controller.hasUnreadNews).toBe(false);
  });
});
