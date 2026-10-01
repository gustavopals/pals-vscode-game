import {
  type ApiError as ApiErrorBody,
  type ApiErrorCode,
  HEADERS,
  PROTOCOL_VERSION,
} from '@lotg/protocol';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { ApiError } from '../api-error';
import { safeError } from '../safe-error';

function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'VALIDATION';
  }
}

/**
 * Todo erro sai no formato `{ code, message, details? }`:
 * `ZodError` → 400 `VALIDATION`; `ApiError` → o status do código; erros 4xx do próprio Fastify
 * (JSON malformado, corpo grande demais) → o código equivalente; o resto → 500 `INTERNAL`,
 * com o `requestId` para achar a causa no log sem expor detalhes ao cliente.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request, reply) => {
    let status: number;
    let body: ApiErrorBody;

    if (error instanceof ApiError) {
      status = error.statusCode;
      body = { code: error.code, message: error.message };
      if (error.details !== undefined) {
        body.details = error.details;
      }
    } else if (error instanceof ZodError) {
      status = 400;
      body = {
        code: 'VALIDATION',
        message: 'Os dados enviados não têm a forma esperada.',
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      };
    } else {
      const fastifyStatus = (error as { statusCode?: unknown }).statusCode;
      if (typeof fastifyStatus === 'number' && fastifyStatus >= 400 && fastifyStatus < 500) {
        status = fastifyStatus;
        body = {
          code: codeForStatus(fastifyStatus),
          message: 'A requisição não pôde ser entendida.',
        };
      } else {
        request.log.error({ failure: safeError(error) }, 'erro inesperado');
        status = 500;
        body = {
          code: 'INTERNAL',
          message: 'Algo deu errado no reino. Tente de novo em instantes.',
          details: { requestId: request.id },
        };
      }
    }
    void reply.status(status).header('cache-control', 'no-store').send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ApiErrorBody = { code: 'NOT_FOUND', message: 'Rota não encontrada.' };
    void reply.status(404).send(body);
  });

  // Um cliente de outra versão do protocolo recebe uma mensagem amigável em vez de erros estranhos.
  app.addHook('onRequest', async (request) => {
    const sent = request.headers[HEADERS.protocol];
    if (sent !== undefined && sent !== String(PROTOCOL_VERSION)) {
      throw new ApiError(
        'UPGRADE_REQUIRED',
        'Esta versão da extensão não conversa mais com o servidor. Atualize a extensão.',
        { protocol: PROTOCOL_VERSION },
      );
    }
  });

  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });
}
