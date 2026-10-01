import { describe, expect, it } from 'vitest';

import { ENGINE_VERSION } from './index';

describe('@lotg/engine', () => {
  it('exporta a versão do pacote', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
