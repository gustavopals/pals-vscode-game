import { describe, expect, it } from 'vitest';

import { WEBVIEW_VERSION } from './index';

describe('@lotg/webview', () => {
  it('exporta a versão do pacote', () => {
    expect(WEBVIEW_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
