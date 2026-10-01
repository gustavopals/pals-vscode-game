import { z } from 'zod';

import { GameEventSchema, RejectionCodeSchema, ViewStateSchema } from './view';

export const API_ERROR_CODES = [
  'VALIDATION',
  'UNAUTHORIZED',
  'SESSION_REVOKED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'CONFLICT',
  'COMMAND_ID_CONFLICT',
  'ACCOUNT_CONFLICT',
  'ACTIVE_GAME_EXISTS',
  'GAME_RULE',
  'GITHUB_TOKEN_INVALID',
  'UPGRADE_REQUIRED',
  'INTERNAL',
] as const;
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

/** Status HTTP de cada código de erro. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  SESSION_REVOKED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  COMMAND_ID_CONFLICT: 409,
  ACCOUNT_CONFLICT: 409,
  ACTIVE_GAME_EXISTS: 409,
  GAME_RULE: 422,
  GITHUB_TOKEN_INVALID: 401,
  UPGRADE_REQUIRED: 426,
  INTERNAL: 500,
};

/** Formato de todo erro da API `/v1`. */
export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** `stateVersion`: o `bigint` do banco como string decimal positiva. Começa em "1". */
export const StateVersionSchema = z.string().regex(/^[1-9]\d*$/);

/**
 * Detalhes de uma recusa do motor (`422 GAME_RULE`). O mundo avançou mesmo com a ação recusada:
 * `view` e `events` trazem o estado já avançado, sem os efeitos da ação.
 */
export const GameRuleDetailsSchema = z.strictObject({
  code: RejectionCodeSchema,
  message: z.string(),
  view: ViewStateSchema,
  events: z.array(GameEventSchema),
  stateVersion: StateVersionSchema,
  staleView: z.boolean(),
});
export type GameRuleDetails = z.infer<typeof GameRuleDetailsSchema>;

export const GameRuleErrorSchema = z.strictObject({
  code: z.literal('GAME_RULE'),
  message: z.string(),
  details: GameRuleDetailsSchema,
});
export type GameRuleError = z.infer<typeof GameRuleErrorSchema>;

/** Detalhes do `409 ACCOUNT_CONFLICT` no vínculo com o GitHub. */
export const AccountConflictDetailsSchema = z.strictObject({
  existingDisplayName: z.string(),
  currentHasProgress: z.boolean(),
});
export type AccountConflictDetails = z.infer<typeof AccountConflictDetailsSchema>;
