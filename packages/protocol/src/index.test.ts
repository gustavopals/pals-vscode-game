import { describe, expect, it } from 'vitest';

import { PROTOCOL_PACKAGE_VERSION } from './index';

describe('@lotg/protocol', () => {
  it('exporta a versão do pacote', () => {
    expect(PROTOCOL_PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
