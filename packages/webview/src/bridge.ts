import type { Command, CommandType, WebviewToExtension } from '@lotg/protocol';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

export type Send = (message: WebviewToExtension) => void;

/** A ponte com a extensão. O painel não fala com a rede: só manda e recebe mensagens. */
export function connect(): Send {
  const api = acquireVsCodeApi();
  return (message) => api.postMessage(message);
}

/** Monta uma ordem nova. Cada clique é uma intenção nova, com `commandId` novo. */
export function order<T extends CommandType>(
  type: T,
  payload: Extract<Command, { type: T }>['payload'],
): WebviewToExtension {
  return { type: 'command', command: { commandId: crypto.randomUUID(), type, payload } as Command };
}
