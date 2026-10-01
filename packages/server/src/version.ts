import { createHash } from 'node:crypto';

import { balance, buildings, chronicleTemplates, objectives } from '@lotg/content';
import { canonicalJson, PROTOCOL_VERSION, type VersionResponse } from '@lotg/protocol';

export const SERVER_VERSION = '0.1.0';

declare const __BUILT_AT__: string | undefined;

/** Hash do conteúdo de jogo: muda sempre que um número ou um texto de `@lotg/content` muda. */
export const CONTENT_HASH = createHash('sha256')
  .update(canonicalJson({ balance, buildings, objectives, chronicleTemplates }))
  .digest('hex')
  .slice(0, 16);

// No bundle de produção o esbuild grava o instante do build; em desenvolvimento, vale o arranque.
const builtAt = typeof __BUILT_AT__ === 'string' ? __BUILT_AT__ : new Date().toISOString();

export function versionInfo(): VersionResponse {
  return {
    server: SERVER_VERSION,
    protocol: PROTOCOL_VERSION,
    contentHash: CONTENT_HASH,
    builtAt,
  };
}
