import type { ApiErrorCode, GameRuleDetails } from '@lotg/protocol';

/** O servidor respondeu com um erro `{ code, message, details? }`. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details: unknown,
    /** A resposta é o recibo de um comando já registrado, e não uma execução nova. */
    readonly replayed = false,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Recusa do motor (`422 GAME_RULE`). O mundo avançou mesmo assim: `details.view` e
 * `details.events` trazem o estado já avançado, sem os efeitos da ação recusada.
 * Em um recibo repetido (`replayed`), esse estado é o de quando a ordem foi dada pela
 * primeira vez: busque a visão atual em vez de exibi-lo.
 */
export class GameRuleClientError extends ApiClientError {
  declare readonly details: GameRuleDetails;

  constructor(message: string, details: GameRuleDetails, replayed: boolean) {
    super(422, 'GAME_RULE', message, details, replayed);
    this.name = 'GameRuleClientError';
  }
}

/** A requisição não chegou a ter resposta: sem rede, servidor fora do ar, resposta ilegível. */
export class NetworkError extends Error {
  /**
   * Se a operação pode ser repetida. A rotação do refresh token não pode: o token talvez já
   * tenha sido consumido, e reapresentá-lo revogaria a sessão inteira (ADR 0005).
   */
  readonly retryable: boolean;

  constructor(message: string, options?: { cause?: unknown; retryable?: boolean }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'NetworkError';
    this.retryable = options?.retryable ?? true;
  }
}

export function isGameRuleError(error: unknown): error is GameRuleClientError {
  return error instanceof GameRuleClientError;
}
