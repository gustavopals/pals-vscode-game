import { describe, expect, it } from 'vitest';

import { CONTENT_VERSION } from './index';

describe('@lotg/content', () => {
  it('exporta a versão do pacote', () => {
    expect(CONTENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
