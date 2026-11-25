import { createHash } from 'node:crypto';

import { canonicalJson, type ViewResponse } from '@lotg/protocol';

import type { AppContext } from '../context';
import { deriveGameView, loadGameSeason, lockGame } from './repository';
import { assertPlayable, readLockedGame } from './service';

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
  const body = await ctx.db.transaction(async (tx): Promise<ViewResponse> => {
    const game = await lockGame(tx, accountId, gameId);
    const now = ctx.clock();
    const season = await loadGameSeason(tx, game);
    assertPlayable(game, season, now);
    const reading = await readLockedGame(ctx, tx, game, now, season);
    return {
      view: deriveGameView(reading.game, reading.state, reading.gameNowMs),
      stateVersion: String(reading.stateVersion),
    };
  });
  return { body, etag: weakEtag(body) };
}
