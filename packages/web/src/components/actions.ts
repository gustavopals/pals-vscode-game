import type { Command, CommandType } from '@lotg/protocol';

/**
 * O que os componentes das abas podem pedir. Eles não falam com a rede nem abrem diálogos:
 * mandam uma ordem ao feudo ou executam um comando do app pelo id.
 */
export type Actions = {
  /** Uma ordem nova ao feudo. Cada clique é uma intenção nova, com `commandId` novo. */
  order<T extends CommandType>(type: T, payload: Extract<Command, { type: T }>['payload']): void;
  /** Executa um comando do app (`palette/commands.ts`). */
  run(commandId: string, arg?: unknown): void;
  /** "Jogar agora": cria a conta, se ainda não houver, e funda o feudo. */
  playNow(displayName: string, settlementName: string): void;
};
