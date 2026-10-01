import './styles.css';

import type { ExtensionToWebview, WebviewRoute } from '@lotg/protocol';
import { render } from 'preact';
import { useEffect, useReducer } from 'preact/hooks';

import { App } from './app';
import { connect } from './bridge';
import { initialState, reduce } from './state';

const send = connect();

function Root() {
  const [state, dispatch] = useReducer(reduce, initialState);

  useEffect(() => {
    const onMessage = (event: MessageEvent<ExtensionToWebview>) => {
      dispatch({ type: 'message', message: event.data, now: Date.now() });
    };
    window.addEventListener('message', onMessage);
    // Só depois de ouvir é que o painel pede o estado atual.
    send({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const onRoute = (route: WebviewRoute) => {
    dispatch({ type: 'route', route });
    send({ type: 'navigate', route });
  };

  return (
    <App
      state={state}
      send={send}
      onRoute={onRoute}
      onDismissError={() => dispatch({ type: 'dismissError' })}
    />
  );
}

const root = document.getElementById('root');
if (root !== null) {
  render(<Root />, root);
}
