import { createHash } from 'node:crypto';

import { contentHash, PROTOCOL_VERSION, type VersionResponse } from '@lotg/protocol';

import type { Config } from './config';

export const SERVER_VERSION = '0.1.0';

declare const __BUILT_AT__: string | undefined;

/**
 * Hash do conteúdo de jogo: muda sempre que um número ou um texto de `@lotg/content` muda. A
 * conta é a de `contentHash`, em `@lotg/protocol`, a mesma que o simulador usa nos relatórios.
 */
export const CONTENT_HASH = contentHash((text) => createHash('sha256').update(text).digest('hex'));

// No bundle de produção o esbuild grava o instante do build; em desenvolvimento, vale o arranque.
const builtAt = typeof __BUILT_AT__ === 'string' ? __BUILT_AT__ : new Date().toISOString();

export function versionInfo(config: Pick<Config, 'githubClientId'>): VersionResponse {
  return {
    server: SERVER_VERSION,
    protocol: PROTOCOL_VERSION,
    contentHash: CONTENT_HASH,
    builtAt,
    features: { githubDevice: config.githubClientId !== null },
  };
}
