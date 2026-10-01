import type {
  ExtensionToWebview,
  GameEvent,
  ReturnReport,
  ViewState,
  WebviewRoute,
  WebviewSession,
} from '@lotg/protocol';

/** Tudo que o painel sabe. Vem inteiro da extensão; aqui nada é calculado sobre o jogo. */
export type AppState = {
  route: WebviewRoute;
  view: ViewState | null;
  /** Quando a visão chegou (ms): base das contagens regressivas locais. */
  viewReceivedAt: number;
  online: boolean;
  retryInSeconds: number | null;
  session: WebviewSession | null;
  chronicle: GameEvent[];
  report: ReturnReport | null;
  /** Último erro a mostrar ao jogador (recusa do motor ou falha de rede). */
  error: { code: string; message: string } | null;
};

export const initialState: AppState = {
  route: 'welcome',
  view: null,
  viewReceivedAt: 0,
  online: true,
  retryInSeconds: null,
  session: null,
  chronicle: [],
  report: null,
  error: null,
};

export type Action =
  | { type: 'message'; message: ExtensionToWebview; now: number }
  | { type: 'route'; route: WebviewRoute }
  | { type: 'dismissError' };

export function reduce(state: AppState, action: Action): AppState {
  if (action.type === 'route') {
    return { ...state, route: action.route };
  }
  if (action.type === 'dismissError') {
    return { ...state, error: null };
  }
  const { message } = action;
  switch (message.type) {
    case 'view':
      return { ...state, view: message.view, viewReceivedAt: action.now };
    case 'connection':
      return {
        ...state,
        online: message.online,
        retryInSeconds: message.online ? null : (message.retryInSeconds ?? null),
        // Um aviso de falta de rede perde o sentido quando a ligação volta.
        error: message.online && state.error?.code === 'NETWORK' ? null : state.error,
      };
    case 'error':
      return { ...state, error: { code: message.code, message: message.message } };
    case 'navigate':
      return { ...state, route: message.route };
    case 'session':
      if (!message.session.hasGame) {
        // Sem feudo não há o que mostrar além das boas-vindas.
        return { ...state, session: message.session, route: 'welcome', view: null };
      }
      return {
        ...state,
        session: message.session,
        // Com feudo, as boas-vindas não fazem mais sentido (login feito pela outra máquina).
        route: state.route === 'welcome' ? 'fief' : state.route,
      };
    case 'chronicle':
      return { ...state, chronicle: message.entries };
    case 'report':
      return { ...state, report: message.report };
  }
}
