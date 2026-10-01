import type { Command, ViewState } from '@lotg/engine';

/** Dá uma ordem e devolve a visão resultante; numa recusa, a visão volta igual. */
export type Act = <T extends Command['type']>(
  type: T,
  payload: Extract<Command, { type: T }>['payload'],
) => ViewState;

/** Um bot joga uma sessão: olha o painel, como um jogador, e dá ordens. */
export type Bot = (view: ViewState, act: Act) => void;
