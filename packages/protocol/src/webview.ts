import { RESOURCE_IDS } from '@lotg/content';
import { z } from 'zod';

import { DisplayNameSchema } from './api';
import { CommandSchema } from './commands';
import { ApiErrorCodeSchema } from './errors';
import { GameEventSchema, ViewStateSchema } from './view';

/** Rotas internas do painel. */
export const WEBVIEW_ROUTES = ['welcome', 'today', 'fief'] as const;
export const WebviewRouteSchema = z.enum(WEBVIEW_ROUTES);
export type WebviewRoute = z.infer<typeof WebviewRouteSchema>;

/**
 * Ações do painel que a extensão executa por ele: a Webview nunca fala com a rede nem abre
 * diálogos do editor (GDD §14.10).
 */
export const WEBVIEW_ACTIONS = [
  'signInGithub',
  'signInRecoveryCode',
  'retryConnection',
  'exportChronicle',
  'dismissReport',
] as const;
export const WebviewActionSchema = z.enum(WEBVIEW_ACTIONS);
export type WebviewAction = z.infer<typeof WebviewActionSchema>;

/** Webview → extensão. */
export const WebviewToExtensionSchema = z.discriminatedUnion('type', [
  /** O painel carregou e quer o estado atual. */
  z.strictObject({ type: z.literal('ready') }),
  z.strictObject({ type: z.literal('command'), command: CommandSchema }),
  z.strictObject({ type: z.literal('navigate'), route: WebviewRouteSchema }),
  /** "Jogar agora": cria a conta, se ainda não houver, e funda o feudo. */
  z.strictObject({
    type: z.literal('playNow'),
    displayName: DisplayNameSchema,
    settlementName: DisplayNameSchema,
  }),
  z.strictObject({ type: z.literal('action'), action: WebviewActionSchema }),
]);
export type WebviewToExtension = z.infer<typeof WebviewToExtensionSchema>;

/** Quem está governando nesta máquina, para o painel saber o que oferecer. */
export const WebviewSessionSchema = z.strictObject({
  account: z
    .strictObject({ displayName: z.string(), kind: z.enum(['anonymous', 'linked']) })
    .nullable(),
  /** Há uma partida ativa. Sem ela, o painel mostra as boas-vindas. */
  hasGame: z.boolean(),
  /** Sugestões para o formulário de boas-vindas. */
  defaults: z.strictObject({ displayName: z.string(), settlementName: z.string() }),
  /** Uma operação de conta está em andamento: os botões de entrada ficam desabilitados. */
  busy: z.boolean(),
});
export type WebviewSession = z.infer<typeof WebviewSessionSchema>;

/** Relatório de Retorno: o que aconteceu enquanto o jogador esteve fora (GDD §2.3). */
export const ReturnReportSchema = z.strictObject({
  awaySeconds: z.number().int().nonnegative(),
  /** Diferença de estoque entre a última visita e agora, em unidades. */
  resources: z.array(
    z.strictObject({
      id: z.enum(RESOURCE_IDS),
      label: z.string(),
      before: z.number(),
      after: z.number(),
      delta: z.number(),
    }),
  ),
  counts: z.strictObject({
    daysPassed: z.number().int().nonnegative(),
    constructionsFinished: z.number().int().nonnegative(),
    villagersArrived: z.number().int().nonnegative(),
    objectivesCompleted: z.number().int().nonnegative(),
  }),
  famine: z.enum(['none', 'started', 'ended', 'ongoing']),
  /** Frases da Crônica dos fatos notáveis, da mais antiga para a mais nova. */
  highlights: z.array(z.string()),
});
export type ReturnReport = z.infer<typeof ReturnReportSchema>;

/** Extensão → Webview. */
export const ExtensionToWebviewSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('view'), view: ViewStateSchema }),
  z.strictObject({
    type: z.literal('error'),
    code: z.union([ApiErrorCodeSchema, z.literal('NETWORK')]),
    message: z.string(),
  }),
  z.strictObject({
    type: z.literal('connection'),
    online: z.boolean(),
    /** Segundos até a próxima tentativa de reconexão, quando sem ligação. */
    retryInSeconds: z.number().int().nonnegative().optional(),
  }),
  z.strictObject({ type: z.literal('navigate'), route: WebviewRouteSchema }),
  z.strictObject({ type: z.literal('session'), session: WebviewSessionSchema }),
  /** Últimas linhas da Crônica, da mais antiga para a mais nova. */
  z.strictObject({ type: z.literal('chronicle'), entries: z.array(GameEventSchema) }),
  z.strictObject({ type: z.literal('report'), report: ReturnReportSchema.nullable() }),
]);
export type ExtensionToWebview = z.infer<typeof ExtensionToWebviewSchema>;
