import { z } from 'zod';

import { CommandSchema } from './commands';
import { ApiErrorCodeSchema } from './errors';
import { ViewStateSchema } from './view';

/** Rotas internas do painel. */
export const WEBVIEW_ROUTES = ['welcome', 'today', 'fief'] as const;
export const WebviewRouteSchema = z.enum(WEBVIEW_ROUTES);
export type WebviewRoute = z.infer<typeof WebviewRouteSchema>;

/** Webview → extensão. A Webview nunca fala com a rede (GDD §14.10). */
export const WebviewToExtensionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('command'), command: CommandSchema }),
  z.strictObject({ type: z.literal('navigate'), route: WebviewRouteSchema }),
]);
export type WebviewToExtension = z.infer<typeof WebviewToExtensionSchema>;

/** Extensão → Webview. */
export const ExtensionToWebviewSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('view'), view: ViewStateSchema }),
  z.strictObject({
    type: z.literal('error'),
    code: z.union([ApiErrorCodeSchema, z.literal('NETWORK')]),
    message: z.string(),
  }),
  z.strictObject({ type: z.literal('connection'), online: z.boolean() }),
  z.strictObject({ type: z.literal('navigate'), route: WebviewRouteSchema }),
]);
export type ExtensionToWebview = z.infer<typeof ExtensionToWebviewSchema>;
