import { describe, expect, it } from 'vitest';

import { SIM_CLI_VERSION } from './index';

describe('@lotg/sim-cli', () => {
  it('exporta a versão do pacote', () => {
    expect(SIM_CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
