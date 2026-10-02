import { Icon } from '../components/shared';
import { splitIcons, type StatusBarInput, statusBar } from '../ui/format';

/** Um texto com ícones `$(nome)` desenhado com codicons. */
export function IconText(props: { text: string }) {
  return (
    <>
      {splitIcons(props.text).map((part, index) =>
        'icon' in part ? (
          <Icon key={index} name={part.icon} />
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * A barra de status: uma linha, uma prioridade (GDD §13.5), calculada por `statusBar`. O clique
 * leva à aba correspondente.
 */
export function StatusBar(props: {
  input: StatusBarInput;
  /** Os avisos estão silenciados ("Silenciar 2h"). */
  muted: boolean;
  onCommand: (id: string, arg?: unknown) => void;
}) {
  const { input } = props;
  const status = statusBar(input);
  const offline = input.signedIn && input.connection.kind === 'offline';
  // A fome e o frio pedem atenção com o mesmo destaque; o que os distingue é o ícone e o texto.
  const alarm =
    input.signedIn &&
    !input.discreetMode &&
    !offline &&
    (input.view?.famine != null || input.view?.winter?.cold != null);
  const tone = offline && !input.discreetMode ? ' status-offline' : alarm ? ' status-warning' : '';
  return (
    <footer class="statusbar" aria-label="Barra de status">
      <div class="statusbar-group">
        <button
          type="button"
          class={`status-main${tone}`}
          title={status.tooltip}
          onClick={() =>
            props.onCommand(input.signedIn ? 'lords.openPanel' : 'lords.playNow', undefined)
          }
        >
          <IconText text={status.text} />
        </button>
      </div>
      <div class="statusbar-group">
        {props.muted && !input.discreetMode ? (
          <span class="sr-only" role="status">
            Notificações silenciadas
          </span>
        ) : null}
        <button
          type="button"
          title="Paleta de comandos (F1 ou Ctrl+K)"
          aria-label="Abrir a paleta de comandos"
          onClick={() => props.onCommand('lords.showCommands')}
        >
          <Icon name="search" />
          <span class="status-optional">Comandos</span>
          <span>F1</span>
        </button>
      </div>
    </footer>
  );
}
