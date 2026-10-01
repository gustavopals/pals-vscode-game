import { z } from 'zod';

import { CommandSchema } from './commands';
import { isStorableText, UNSTORABLE } from './text';
import { StateVersionSchema } from './errors';
import { GameEventSchema, ViewStateSchema } from './view';

const isoDate = z.iso.datetime();

/** Nome de quem governa e nome do feudo: 2 a 24 caracteres, sem espaços nas pontas. */
export const DisplayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .refine(isStorableText, UNSTORABLE);
export const DeviceLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isStorableText, UNSTORABLE);

const timezone = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'fuso horário IANA desconhecido');

// --- Conta e sessão ---------------------------------------------------------

export const AccountSchema = z.strictObject({
  id: z.uuid(),
  displayName: z.string(),
  linked: z.strictObject({ github: z.boolean() }),
  hasRecoveryCode: z.boolean(),
  createdAt: isoDate,
});
export type Account = z.infer<typeof AccountSchema>;

export const TokenPairSchema = z.strictObject({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Validade do access token, em segundos. */
  expiresIn: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const AuthResponseSchema = z.strictObject({
  account: AccountSchema,
  ...TokenPairSchema.shape,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const AnonymousRequestSchema = z.strictObject({
  displayName: DisplayNameSchema,
  deviceLabel: DeviceLabelSchema.optional(),
});
export type AnonymousRequest = z.infer<typeof AnonymousRequestSchema>;

export const RefreshRequestSchema = z.strictObject({ refreshToken: z.string().min(1).max(200) });
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export const RefreshResponseSchema = TokenPairSchema;
export type RefreshResponse = TokenPair;

export const RecoveryCodeResponseSchema = z.strictObject({
  /** O Código do Reino em claro, no formato XXXX-XXXX-XXXX-XXXX-XXXX. Só aparece aqui. */
  code: z.string(),
});
export type RecoveryCodeResponse = z.infer<typeof RecoveryCodeResponseSchema>;

export const RecoverRequestSchema = z.strictObject({
  code: z.string().max(200),
  deviceLabel: DeviceLabelSchema.optional(),
});
export type RecoverRequest = z.infer<typeof RecoverRequestSchema>;

export const GithubAuthRequestSchema = z.strictObject({
  githubAccessToken: z.string().min(1).max(4096),
  deviceLabel: DeviceLabelSchema.optional(),
  /** Resposta ao `409 ACCOUNT_CONFLICT`: qual feudo manter. Os estados nunca são mesclados. */
  resolve: z.enum(['useExisting', 'keepCurrent']).optional(),
});
export type GithubAuthRequest = z.infer<typeof GithubAuthRequestSchema>;

/**
 * Vincular a conta atual devolve só `account`. Entrar em uma conta já vinculada (sem sessão,
 * ou com `resolve: 'useExisting'`) cria uma sessão nova e devolve também os tokens.
 */
export const GithubAuthResponseSchema = z.strictObject({
  account: AccountSchema,
  ...TokenPairSchema.partial().shape,
});
export type GithubAuthResponse = z.infer<typeof GithubAuthResponseSchema>;

/**
 * *Device flow* do GitHub (GDD §14.7). O navegador não pode chamar o GitHub direto; o servidor
 * só repassa as duas chamadas, com o `GITHUB_CLIENT_ID`, e não guarda nada.
 */
export const GithubDeviceStartResponseSchema = z.strictObject({
  /** Segredo desta tentativa: volta em cada consulta e nunca é mostrado ao jogador. */
  deviceCode: z.string().min(1).max(256),
  /** O código que o jogador digita no GitHub. */
  userCode: z.string().min(1).max(64),
  verificationUri: z.url(),
  expiresInSeconds: z.number().int().positive(),
  /** Intervalo mínimo entre consultas. */
  intervalSeconds: z.number().int().positive(),
});
export type GithubDeviceStartResponse = z.infer<typeof GithubDeviceStartResponseSchema>;

export const GithubDevicePollRequestSchema = z.strictObject({
  deviceCode: z.string().min(1).max(256),
});
export type GithubDevicePollRequest = z.infer<typeof GithubDevicePollRequestSchema>;

export const GithubDevicePollResponseSchema = z.discriminatedUnion('status', [
  /** O jogador confirmou: o token segue para `POST /auth/github`. */
  z.strictObject({ status: z.literal('authorized'), githubAccessToken: z.string().min(1) }),
  z.strictObject({ status: z.literal('pending') }),
  /** Consultas rápidas demais: passar a esperar `intervalSeconds` entre elas. */
  z.strictObject({ status: z.literal('slowDown'), intervalSeconds: z.number().int().positive() }),
  z.strictObject({ status: z.literal('expired') }),
  z.strictObject({ status: z.literal('denied') }),
]);
export type GithubDevicePollResponse = z.infer<typeof GithubDevicePollResponseSchema>;

export const UpdateMeRequestSchema = z.strictObject({ displayName: DisplayNameSchema });
export type UpdateMeRequest = z.infer<typeof UpdateMeRequestSchema>;

/** `202` de `DELETE /v1/me`: a conta já está bloqueada; o expurgo vem depois de `purgeAfter`. */
export const DeleteMeResponseSchema = z.strictObject({ deletedAt: isoDate, purgeAfter: isoDate });
export type DeleteMeResponse = z.infer<typeof DeleteMeResponseSchema>;

// --- Partidas ---------------------------------------------------------------

export const GameSummarySchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(['active', 'archived']),
  settlementName: z.string(),
  difficulty: z.string(),
  timeScale: z.number(),
  timezone: z.string(),
  vigilHourLocal: z.number().int(),
  stateVersion: StateVersionSchema,
  createdAt: isoDate,
});
export type GameSummary = z.infer<typeof GameSummarySchema>;

export const CreateGameRequestSchema = z.strictObject({
  settlementName: DisplayNameSchema,
  timezone,
  vigilHourLocal: z.number().int().min(0).max(23),
  /** Na v0.1 a dificuldade é sempre Senhor; o ritmo é o do servidor (ADR 0011). */
  difficulty: z.literal('lord').optional(),
  /** Aceito por compatibilidade e ignorado: o ritmo é o do servidor (ADR 0011). */
  timeScale: z.literal(1).optional(),
  /** Arquiva a partida ativa, se houver, em vez de recusar com `ACTIVE_GAME_EXISTS`. */
  replaceActive: z.boolean().optional(),
  /** Semente fixa. Só é aceita por servidores em ambiente de teste. */
  seed: z.string().min(1).max(64).refine(isStorableText, UNSTORABLE).optional(),
});
export type CreateGameRequest = z.infer<typeof CreateGameRequestSchema>;

export const CreateGameResponseSchema = z.strictObject({ game: GameSummarySchema });
export type CreateGameResponse = z.infer<typeof CreateGameResponseSchema>;

export const ListGamesResponseSchema = z.strictObject({ games: z.array(GameSummarySchema) });
export type ListGamesResponse = z.infer<typeof ListGamesResponseSchema>;

/** Corpo de `GET /v1/games/:id/view`. O ETag é calculado sobre este corpo inteiro. */
export const ViewResponseSchema = z.strictObject({
  view: ViewStateSchema,
  stateVersion: StateVersionSchema,
});
export type ViewResponse = z.infer<typeof ViewResponseSchema>;

export const CommandRequestSchema = CommandSchema;
export type CommandRequest = z.infer<typeof CommandRequestSchema>;

/** `200` de um comando aceito: eventos do avanço do mundo e do próprio comando. */
export const CommandAcceptedSchema = z.strictObject({
  view: ViewStateSchema,
  events: z.array(GameEventSchema),
  stateVersion: StateVersionSchema,
  /** O cliente decidiu olhando uma versão que já não era a persistida. Aviso, não bloqueio. */
  staleView: z.boolean(),
});
export type CommandAccepted = z.infer<typeof CommandAcceptedSchema>;

export const EventsQuerySchema = z.strictObject({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type EventsQuery = z.infer<typeof EventsQuerySchema>;

export const EventsResponseSchema = z.strictObject({
  events: z.array(GameEventSchema),
  /** Cursor para a próxima chamada: a maior sequência entregue, ou o `after` recebido. */
  lastSeq: z.number().int().min(0),
  /** Há mais eventos além do limite pedido. */
  hasMore: z.boolean(),
});
export type EventsResponse = z.infer<typeof EventsResponseSchema>;

export const ChronicleQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  /** Só as linhas de um ano de jogo. */
  year: z.coerce.number().int().min(1).optional(),
});
export type ChronicleQuery = z.infer<typeof ChronicleQuerySchema>;

/** As últimas linhas da Crônica, da mais antiga para a mais recente. */
export const ChronicleResponseSchema = z.strictObject({ entries: z.array(GameEventSchema) });
export type ChronicleResponse = z.infer<typeof ChronicleResponseSchema>;

// --- Serviço ----------------------------------------------------------------

export const HealthResponseSchema = z.strictObject({
  /** O processo está de pé. O estado do banco vem em `db`; com ele fora, o status HTTP é 503. */
  status: z.literal('ok'),
  db: z.enum(['ok', 'down']),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const VersionResponseSchema = z.strictObject({
  server: z.string(),
  protocol: z.number().int(),
  contentHash: z.string(),
  builtAt: z.string(),
  /** O que este servidor tem ligado, para o cliente não oferecer o que não funciona. */
  features: z.strictObject({
    /** Há `GITHUB_CLIENT_ID`: as rotas `/auth/github/device` respondem. */
    githubDevice: z.boolean(),
  }),
});
export type VersionResponse = z.infer<typeof VersionResponseSchema>;
