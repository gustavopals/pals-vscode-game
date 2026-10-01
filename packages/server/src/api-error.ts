import { API_ERROR_STATUS, type ApiErrorCode } from '@lotg/protocol';

/** Erro que vira uma resposta `{ code, message, details? }` com o status do código. */
export class ApiError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = API_ERROR_STATUS[code];
  }
}

export const unauthorized = () =>
  new ApiError('UNAUTHORIZED', 'Credenciais ausentes ou inválidas.');
export const sessionRevoked = () =>
  new ApiError('SESSION_REVOKED', 'Esta sessão foi encerrada. Entre de novo para continuar.');
export const notFound = (what = 'Recurso') => new ApiError('NOT_FOUND', `${what} não encontrado.`);
