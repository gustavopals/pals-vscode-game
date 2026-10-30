import { describe, expect, it } from 'vitest';

import { browserStore, memoryStorage } from '../services/browserStore';
import { memoryStore, type KeyValueStore } from '../services/store';
import { NewsReadState, newsSeenKey } from './readState';

describe('leitura das notícias por conta', () => {
  it('guarda uma leitura por conta e a conserva ao reabrir', async () => {
    const store = memoryStore();
    const news = new NewsReadState(store);
    expect(news.hasUnread('alice', '0.3.0')).toBe(true);
    await news.markRead('alice', '0.3.0');
    expect(store.get(newsSeenKey('alice'))).toBe('0.3.0');
    expect(newsSeenKey('alice')).toBe('lords.newsSeen:alice');
    expect(new NewsReadState(store).hasUnread('alice', '0.3.0')).toBe(false);
    expect(news.hasUnread('berta', '0.3.0')).toBe(true);
    expect(news.hasUnread('alice', '0.4.0')).toBe(true);
  });

  it('não regrava uma versão anterior depois de uma reversão do servidor', async () => {
    const store = memoryStore();
    const news = new NewsReadState(store);
    await news.markRead('alice', '0.3.0');
    expect(await news.markRead('alice', '0.2.0')).toBe(false);
    expect(store.get(newsSeenKey('alice'))).toBe('0.3.0');
    expect(news.hasUnread('alice', '0.3.0')).toBe(false);
  });

  it.each([null, {}, 3, 'quebrado'])('ignora uma marca fora da forma (%s)', (value) => {
    const store = memoryStore({ [newsSeenKey('alice')]: value });
    expect(new NewsReadState(store).hasUnread('alice', '0.3.0')).toBe(true);
  });

  it('tolera falhas de leitura, escrita e limpeza, mantendo a leitura nesta aba', async () => {
    const fail = () => {
      throw new Error('Armazenamento negado');
    };
    const store: KeyValueStore = { keys: fail, get: fail, update: fail };
    const news = new NewsReadState(store);
    expect(news.hasUnread('alice', '0.3.0')).toBe(true);
    await news.markRead('alice', '0.3.0');
    expect(news.hasUnread('alice', '0.3.0')).toBe(false);
    await news.forget('alice');
    expect(news.hasUnread('alice', '0.3.0')).toBe(true);
  });

  it('passa pelo armazenamento real do app e encontra a leitura feita por outra aba', async () => {
    const storage = memoryStorage();
    const first = new NewsReadState(browserStore(storage));
    const second = new NewsReadState(browserStore(storage));
    await first.markRead('alice', '0.2.0');
    await second.markRead('alice', '0.3.0');
    expect(first.hasUnread('alice', '0.3.0')).toBe(false);
    expect(storage.getItem(newsSeenKey('alice'))).toBe('"0.3.0"');
  });

  it('limpa só a conta encerrada', async () => {
    const store = memoryStore();
    const news = new NewsReadState(store);
    await news.markRead('alice', '0.3.0');
    await news.markRead('berta', '0.3.0');
    await news.forget('alice');
    expect(store.get(newsSeenKey('alice'))).toBeUndefined();
    expect(news.hasUnread('alice', '0.3.0')).toBe(true);
    expect(news.hasUnread('berta', '0.3.0')).toBe(false);
  });
});
