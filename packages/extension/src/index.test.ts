import { describe, expect, it } from 'vitest';

import { EXTENSION_VERSION } from './index';

describe('lords-of-the-guild', () => {
  it('exporta a versão do pacote', () => {
    expect(EXTENSION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
