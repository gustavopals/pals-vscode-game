import { createHash } from 'node:crypto';

import { deriveViewState } from '@lotg/engine';
import { canonicalJson, type ViewResponse } from '@lotg/protocol';

import type { AppContext } from '../context';
import { assertActive, withGameReading } from './service';

/**
 * ETag fraco do corpo completo de `/view`. Não é a `stateVersion`: produção e contagens
 * regressivas mudam a representação sem nenhuma escrita no banco (ADR 0004).
 */
export function weakEtag(body: unknown): string {
  return `W/"${createHash('sha256').update(canonicalJson(body)).digest('hex')}"`;
}

/** Comparação fraca de `If-None-Match`: ignora o prefixo `W/` e aceita lista e `*`. */
export function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (ifNoneMatch === undefined) {
    return false;
  }
  const opaque = (value: string) => value.trim().replace(/^W\//, '');
  return ifNoneMatch
    .split(',')
    .some((candidate) => candidate.trim() === '*' || opaque(candidate) === opaque(etag));
}

/** `GET /games/:id/view`: avança até agora e deriva o que a interface exibe. */
export async function readView(
  ctx: AppContext,
  accountId: string,
  gameId: string,
): Promise<{ body: ViewResponse; etag: string }> {
  const body = await withGameReading(ctx, accountId, gameId, (reading): ViewResponse => {
    assertActive(reading.game);
    return {
      view: deriveViewState(reading.state, reading.gameNowMs),
      stateVersion: String(reading.stateVersion),
    };
  });
  return { body, etag: weakEtag(body) };
}
