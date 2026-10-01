import { describe, expect, it } from 'vitest';

import { etagMatches, weakEtag } from './view';

describe('ETag de /view', () => {
  it('é fraco, em SHA-256, e não depende da ordem das chaves', () => {
    const etag = weakEtag({ view: { a: 1, b: [1, 2] }, stateVersion: '3' });
    expect(etag).toMatch(/^W\/"[0-9a-f]{64}"$/);
    expect(weakEtag({ stateVersion: '3', view: { b: [1, 2], a: 1 } })).toBe(etag);
  });

  it('muda quando a representação muda, mesmo com a mesma stateVersion', () => {
    const before = weakEtag({ view: { stock: 180 }, stateVersion: '3' });
    expect(weakEtag({ view: { stock: 181 }, stateVersion: '3' })).not.toBe(before);
    expect(weakEtag({ view: { stock: 180 }, stateVersion: '4' })).not.toBe(before);
  });

  it('compara If-None-Match de forma fraca, com lista e curinga', () => {
    const etag = weakEtag({ view: 1 });
    const strong = etag.replace(/^W\//, '');
    expect(etagMatches(etag, etag)).toBe(true);
    expect(etagMatches(strong, etag)).toBe(true);
    expect(etagMatches(`"outra", ${etag}`, etag)).toBe(true);
    expect(etagMatches('*', etag)).toBe(true);
    expect(etagMatches('"outra"', etag)).toBe(false);
    expect(etagMatches(undefined, etag)).toBe(false);
  });
});
