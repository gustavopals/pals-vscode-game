import { createHash } from 'node:crypto';

import { advanceTo, applyCommand, deriveViewState } from '@lotg/engine';
import {
  canonicalJson,
  type Command,
  type CommandAccepted,
  type GameRuleError,
} from '@lotg/protocol';
import { and, eq } from 'drizzle-orm';

import { ApiError } from '../api-error';
import type { AppContext } from '../context';
import { commands } from '../db/schema';
import { gameTimeAt, lockGame, nextCommandSeq, persistState } from './repository';
import { assertActive } from './service';

export type CommandOutcome = {
  status: number;
  body: CommandAccepted | GameRuleError;
  /** A resposta é o recibo de um comando já registrado, e não uma execução nova. */
  replayed: boolean;
};

/** SHA-256 do JSON canônico de `{ type, payload }`: a identidade da intenção do jogador. */
export function requestHash(command: Command): string {
  const intent = canonicalJson({ type: command.type, payload: command.payload });
  return createHash('sha256').update(intent).digest('hex');
}

/**
 * `POST /games/:id/commands`, em uma transação (GDD §14.8, ADR 0004):
 *
 * 1. trava a partida, o que também confere a propriedade e migra o estado em memória, se ele
 *    estava gravado em uma versão anterior;
 * 2. procura o recibo de `(game_id, commandId)`. Mesmo hash: devolve status e corpo originais,
 *    sem avançar nem aplicar de novo. Outro hash: `409 COMMAND_ID_CONFLICT`, sem efeitos;
 * 3. comando novo: avança o mundo até agora e aplica;
 * 4. grava estado, eventos e recibo completo. Uma recusa do motor também é um resultado
 *    persistido: o mundo avançou, só a ação não teve efeito. Recibos antigos nunca são
 *    reescritos: o reenvio devolve o corpo da época, mesmo que o estado já tenha mudado de versão.
 *
 * A resposta só sai depois do commit. Uma falha inesperada desfaz tudo e o mesmo UUID pode
 * ser tentado de novo.
 */
export async function executeCommand(
  ctx: AppContext,
  accountId: string,
  gameId: string,
  command: Command,
  knownStateVersion: string | null,
): Promise<CommandOutcome> {
  const hash = requestHash(command);

  return ctx.db.transaction(async (tx): Promise<CommandOutcome> => {
    const game = await lockGame(tx, accountId, gameId);

    const [receipt] = await tx
      .select()
      .from(commands)
      .where(and(eq(commands.gameId, game.id), eq(commands.id, command.commandId)));
    if (receipt !== undefined) {
      if (receipt.requestHash !== hash) {
        throw new ApiError(
          'COMMAND_ID_CONFLICT',
          'Este identificador de comando já foi usado nesta partida com outra ordem.',
        );
      }
      return {
        status: receipt.responseStatus,
        body: receipt.responseBody as CommandOutcome['body'],
        replayed: true,
      };
    }
    assertActive(game);

    // A versão persistida e o instante são capturados sob o lock, antes do avanço.
    const staleView = knownStateVersion !== null && knownStateVersion !== String(game.stateVersion);
    const now = ctx.clock();
    const gameNowMs = gameTimeAt(game, now);

    const advanced = advanceTo(game.state, gameNowMs);
    const result = applyCommand(advanced.state, command, gameNowMs);
    const state = result.ok ? result.state : advanced.state;
    const engineEvents = result.ok ? [...advanced.events, ...result.events] : advanced.events;

    const persisted = await persistState(tx, game, state, engineEvents, now);
    const accepted: CommandAccepted = {
      view: deriveViewState(state, gameNowMs, { timeScale: Number(game.timeScale) }),
      events: persisted.events,
      stateVersion: String(persisted.stateVersion),
      staleView,
    };
    const outcome: CommandOutcome = result.ok
      ? { status: 200, body: accepted, replayed: false }
      : {
          status: 422,
          body: {
            code: 'GAME_RULE',
            message: result.message,
            details: { code: result.code, message: result.message, ...accepted },
          },
          replayed: false,
        };

    await ctx.hooks.beforeCommandReceipt?.();
    await tx.insert(commands).values({
      gameId: game.id,
      id: command.commandId,
      accountId,
      seq: await nextCommandSeq(tx, game.id),
      type: command.type,
      payload: command.payload,
      requestHash: hash,
      serverTime: now,
      result: result.ok ? 'accepted' : 'rejected',
      errorCode: result.ok ? null : result.code,
      responseStatus: outcome.status,
      responseBody: outcome.body,
    });
    return outcome;
  });
}
