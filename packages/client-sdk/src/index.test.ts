import { describe, expect, it } from 'vitest';

import { CLIENT_SDK_VERSION } from './index';

describe('@lotg/client-sdk', () => {
  it('exporta a versão do pacote', () => {
    expect(CLIENT_SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
