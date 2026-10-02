import {
  ChronicleQuerySchema,
  CommandRequestSchema,
  type CreateGameResponse,
  EventsQuerySchema,
  HEADERS,
  type ListGamesResponse,
  StateVersionSchema,
} from '@lotg/protocol';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError, notFound } from '../api-error';
import { OfferedGameRequestSchema } from '../catalog';
import type { AppContext } from '../context';
import { executeCommand } from '../games/commands';
import { listEvents, readChronicle, readChronicleMarkdown } from '../games/events';
import { createGame, listGames } from '../games/service';
import { etagMatches, readView } from '../games/view';
import { requireIdentity } from '../plugins/auth';

const GameIdSchema = z.uuid();

/** Um id que não é UUID não pode ser de partida nenhuma: 404, como qualquer partida alheia. */
function gameIdOf(request: FastifyRequest): string {
  const parsed = GameIdSchema.safeParse((request.params as { id?: unknown }).id);
  if (!parsed.success) {
    throw notFound('Partida');
  }
  return parsed.data;
}

function knownStateVersion(request: FastifyRequest): string | null {
  const header = request.headers[HEADERS.stateVersion];
  if (header === undefined) {
    return null;
  }
  const parsed = StateVersionSchema.safeParse(header);
  if (!parsed.success) {
    throw new ApiError('VALIDATION', 'X-Lords-State-Version deve ser um inteiro decimal positivo.');
  }
  return parsed.data;
}

export function registerGameRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/games', async (request) => {
    const identity = await requireIdentity(ctx, request);
    const body: ListGamesResponse = { games: await listGames(ctx, identity.accountId) };
    return body;
  });

  app.post('/games', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    const input = OfferedGameRequestSchema.parse(request.body);
    const body: CreateGameResponse = { game: await createGame(ctx, identity.accountId, input) };
    return reply.status(201).send(body);
  });

  app.get('/games/:id/view', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    // Autentica e avança antes de olhar o If-None-Match: o ETag é do que o jogador veria agora.
    const { body, etag } = await readView(ctx, identity.accountId, gameIdOf(request));
    void reply
      .header('etag', etag)
      .header('cache-control', 'private, no-cache')
      .header('vary', 'Authorization');
    if (etagMatches(request.headers['if-none-match'], etag)) {
      return reply.status(304).send();
    }
    return reply.send(body);
  });

  app.post('/games/:id/commands', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    const gameId = gameIdOf(request);
    const command = CommandRequestSchema.parse(request.body);
    const known = knownStateVersion(request);
    const outcome = await executeCommand(ctx, identity.accountId, gameId, command, known);
    void reply.header('cache-control', 'no-store');
    if (outcome.replayed) {
      void reply.header(HEADERS.replayed, 'true');
    }
    return reply.status(outcome.status).send(outcome.body);
  });

  app.get('/games/:id/events', async (request) => {
    const identity = await requireIdentity(ctx, request);
    const query = EventsQuerySchema.parse(request.query);
    return listEvents(ctx, identity.accountId, gameIdOf(request), query);
  });

  app.get('/games/:id/chronicle', async (request) => {
    const identity = await requireIdentity(ctx, request);
    const query = ChronicleQuerySchema.parse(request.query);
    return readChronicle(ctx, identity.accountId, gameIdOf(request), query);
  });

  app.get('/games/:id/chronicle.md', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    const markdown = await readChronicleMarkdown(ctx, identity.accountId, gameIdOf(request));
    return reply.header('content-type', 'text/markdown; charset=utf-8').send(markdown);
  });
}
