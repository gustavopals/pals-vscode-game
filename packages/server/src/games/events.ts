import type { ChronicleResponse, EventsResponse } from '@lotg/protocol';

import type { AppContext } from '../context';
import { chronicleMarkdown } from './chronicleMarkdown';
import { chronicleRows, eventsAfter, toApiEvent } from './repository';
import { withGameReading } from './service';

/** `GET /games/:id/events?after=`: eventos novos para as notificações, em ordem de sequência. */
export async function listEvents(
  ctx: AppContext,
  accountId: string,
  gameId: string,
  query: { after: number; limit: number },
): Promise<EventsResponse> {
  return withGameReading(ctx, accountId, gameId, async (reading, tx) => {
    const rows = await eventsAfter(tx, reading.game.id, query.after, query.limit + 1);
    const page = rows.slice(0, query.limit);
    return {
      events: page.map(toApiEvent),
      lastSeq: page[page.length - 1]?.seq ?? query.after,
      hasMore: rows.length > query.limit,
    };
  });
}

/** `GET /games/:id/chronicle`: as últimas linhas da Crônica, opcionalmente de um só ano. */
export async function readChronicle(
  ctx: AppContext,
  accountId: string,
  gameId: string,
  query: { limit: number; year?: number | undefined },
): Promise<ChronicleResponse> {
  return withGameReading(ctx, accountId, gameId, async (reading, tx) => ({
    entries: (await chronicleRows(tx, reading.game.id, query)).map(toApiEvent),
  }));
}

/**
 * `GET /games/:id/chronicle.md`: a Crônica inteira, pronta para abrir no editor. A carta que
 * continua outra leva a nota "Sua escolha voltou" (`chronicleMarkdown`).
 */
export async function readChronicleMarkdown(
  ctx: AppContext,
  accountId: string,
  gameId: string,
): Promise<string> {
  return withGameReading(ctx, accountId, gameId, async (reading, tx) =>
    chronicleMarkdown(reading.state.settlement.name, await chronicleRows(tx, reading.game.id)),
  );
}
