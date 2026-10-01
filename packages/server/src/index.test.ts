import { describe, expect, it } from 'vitest';

import { SERVER_VERSION } from './index';

describe('@lotg/server', () => {
  it('exporta a versão do pacote', () => {
    expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
