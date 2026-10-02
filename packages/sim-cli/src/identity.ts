import { createHash } from 'node:crypto';

import { CURRENT_SCHEMA_VERSION, ENGINE_VERSION } from '@lotg/engine';
import { contentHash } from '@lotg/protocol';

/**
 * Com que jogo a medida foi feita. O `contentHash` é o mesmo de `GET /v1/version`: os dois saem
 * da mesma função de `@lotg/protocol`. Dois relatórios só se comparam número a número quando
 * esta identidade é igual; quando não é, a diferença é o que a mudança de regra fez.
 */
export const IDENTITY = {
  engine: ENGINE_VERSION,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  contentHash: contentHash((text) => createHash('sha256').update(text).digest('hex')),
} as const;

/** `Motor 0.1.0 · estado v2 · conteúdo dac513145ad9399e`. */
export function identityLine(): string {
  return `Motor ${IDENTITY.engine} · estado v${IDENTITY.schemaVersion} · conteúdo ${IDENTITY.contentHash}`;
}
