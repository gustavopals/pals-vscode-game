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

/**
 * Uma decisão que o bot toma em toda sessão ("recrutar", "obra mais barata"). Olha a visão, dá
 * as ordens que achar e devolve a visão depois delas (a mesma que recebeu, se não deu nenhuma).
 *
 * Uma política só conhece o `ViewState` e o `act`: nunca o `GameState`, flags nem o gerador de
 * sorteios. É o mesmo que o jogador vê na tela (roadmap da v0.2, §0.7, "Bot honesto").
 */
export type Policy = {
  /** Nome curto, em português: sai no resumo do simulador e no README. */
  readonly name: string;
  readonly run: (view: ViewState, act: Act) => Promise<ViewState>;
};

/**
 * Um bot é uma lista de políticas, aplicadas em ordem a cada sessão; cada uma recebe a visão
 * que a anterior deixou. Uma mecânica nova entra como uma política a mais na lista.
 */
export function botOf(policies: readonly Policy[]): Bot {
  return async (view, act) => {
    let current = view;
    for (const policy of policies) {
      current = await policy.run(current, act);
    }
  };
}
