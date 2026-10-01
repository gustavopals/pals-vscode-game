import { PROTOCOL_VERSION, type VersionResponse } from '@lotg/protocol';

import type { Loadable } from '../app/controller';
import type { Actions } from '../components/actions';
import { APP_NAME, APP_VERSION } from '../version';

/** "Sobre": versão do app, do servidor e do conteúdo de jogo (`GET /v1/version`). */
export function AboutTab(props: { server: Loadable<VersionResponse>; actions: Actions }) {
  const { server } = props;
  return (
    <div class="document">
      <h1>{APP_NAME}</h1>
      <p class="lead">Um feudo medieval que você governa nas pausas do café.</p>
      <dl class="facts">
        <dt>App</dt>
        <dd>
          {APP_VERSION} <span class="muted">(protocolo {PROTOCOL_VERSION})</span>
        </dd>
        {server.status === 'ready' ? (
          <>
            <dt>Servidor</dt>
            <dd>
              {server.value.server} <span class="muted">(protocolo {server.value.protocol})</span>
            </dd>
            <dt>Conteúdo</dt>
            <dd class="mono">{server.value.contentHash}</dd>
            <dt>Vínculo GitHub</dt>
            <dd>{server.value.features?.githubDevice ? 'ligado' : 'desligado neste servidor'}</dd>
          </>
        ) : (
          <>
            <dt>Servidor</dt>
            <dd>
              <span role="status">
                {server.status === 'error' ? `indisponível: ${server.message}` : 'consultando…'}
              </span>
            </dd>
          </>
        )}
      </dl>
      <p>
        <button type="button" class="link" onClick={() => props.actions.run('lords.privacy')}>
          Privacidade
        </button>
      </p>
      <p class="muted hint">
        Os ícones são os Codicons (licença CC BY 4.0). Este jogo não é afiliado a nenhum editor de
        código.
      </p>
    </div>
  );
}
