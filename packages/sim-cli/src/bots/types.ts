import type { Command, ViewState } from '@lotg/engine';

/**
 * Dá uma ordem e devolve a visão resultante; numa recusa, a visão volta igual.
 * É assíncrona porque o mesmo bot joga em processo (motor) e contra um servidor (API).
 */
export type Act = <T extends Command['type']>(
  type: T,
  payload: Extract<Command, { type: T }>['payload'],
) => Promise<ViewState>;

/** Um bot joga uma sessão: olha o painel, como um jogador, e dá ordens. */
export type Bot = (view: ViewState, act: Act) => Promise<void>;
