import '@vscode/codicons/dist/codicon.css';
import './theme/themes.css';
import './styles.css';
import './workbench/workbench.css';

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import { controllerActions } from './app/actions';
import { Controller } from './app/controller';
import { DialogHost } from './app/DialogHost';
import { DialogService } from './app/dialogs';
import { formatHash, parseHash } from './app/router';
import { browserNotifier, type NotificationApi } from './notifications/browserNotifications';
import { Toasts } from './notifications/Toasts';
import { isPaletteShortcut, openPalette } from './palette/CommandPalette';
import { bindCommands, createCommands } from './palette/commands';
import { browserStore, browserTokenStore, openStorage } from './services/browserStore';
import { deviceLabel } from './services/device';
import { type LockManagerLike, refreshLock, storageSettle } from './services/sessionLock';
import { watchOtherTabs } from './services/tabSync';
import { watchPage } from './services/visibility';
import { applyTheme, resolveTheme, systemTheme } from './theme/theme';
import { useController, Workbench } from './workbench/Workbench';

const NARROW = '(max-width: 720px)';

const { storage, persistent } = openStorage(() => window.localStorage);
const locks = (navigator as { locks?: LockManagerLike }).locks;
const store = browserStore(storage);
const notificationApi = (window as { Notification?: NotificationApi }).Notification;
const notifier = browserNotifier(notificationApi);
const dialogs = new DialogService();

const controller = new Controller({
  // O app é servido pela mesma origem da API (ADR 0008): `/v1` é um caminho relativo.
  baseUrl: '',
  store,
  tokenStore: browserTokenStore(storage),
  fetch: (input, init) => window.fetch(input, init),
  refreshLock: refreshLock(
    locks,
    storageSettle(window, {
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: (handle: number) => window.clearTimeout(handle),
    }),
  ),
  persistentStorage: persistent,
  validateResponses: import.meta.env.DEV,
  // Sem a Web Locks API, um atraso aleatório reduz a chance de duas abas renovarem juntas.
  ...(locks === undefined ? { refreshJitterMs: 250 } : {}),
  deviceLabel: deviceLabel(navigator.userAgent),
  notifier,
  log: (message) => console.warn(message),
});

const currentTheme = () =>
  resolveTheme(
    controller.preferences.theme,
    systemTheme((query) => window.matchMedia(query)),
  );

const commands = createCommands(controller, dialogs, {
  download: (filename, content) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  reload: () => window.location.reload(),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  currentTheme,
  openPalette: () => void showPalette(),
  reveal: (elementId) => {
    // A aba pedida só é desenhada depois deste comando: a seção existe no quadro seguinte.
    requestAnimationFrame(() => {
      const section = document.getElementById(elementId);
      // No meio da tela: o cabeçalho preso do feudo não fica por cima do título.
      section?.scrollIntoView({ block: 'center' });
      section?.focus({ preventScroll: true });
    });
  },
});
bindCommands(controller, commands);

async function showPalette(): Promise<void> {
  if (dialogs.current !== null) {
    // Já há um diálogo à vista: a paleta não se empilha sobre ele.
    return;
  }
  try {
    await openPalette(dialogs, commands);
  } catch (error) {
    controller.toast({
      kind: 'error',
      text: error instanceof Error ? error.message : String(error),
    });
  }
}

const actions = controllerActions(controller);

function App() {
  useController(controller);
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  const theme = currentTheme();

  useEffect(() => {
    const media = window.matchMedia(NARROW);
    const onChange = () => setNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      {/* `key`: ao cruzar os 720 px a bancada recomeça com a barra lateral no estado certo. */}
      <Workbench
        key={narrow ? 'narrow' : 'wide'}
        controller={controller}
        actions={actions}
        theme={theme}
        narrow={narrow}
        browserNotificationsSupported={notifier.supported}
      />
      <Toasts
        // No modo discreto o controlador não gera avisos do jogo; o que resta aqui é resposta a
        // uma ação do próprio jogador (recusa, erro), e isso ele precisa ver.
        toasts={controller.toasts}
        onDismiss={(id) => controller.dismissToast(id)}
      />
      <DialogHost
        dialogs={dialogs}
        // Sem contexto seguro não há `navigator.clipboard`: o botão só não muda para "Copiado".
        copy={(text) =>
          navigator.clipboard?.writeText(text) ??
          Promise.reject(new Error('sem área de transferência'))
        }
      />
    </>
  );
}

// --- O que liga o controlador ao navegador ----------------------------------------

const syncTheme = () => applyTheme(document.documentElement, currentTheme());
/**
 * Põe a aba atual no endereço. Uma navegação do jogador cria uma entrada no histórico; uma
 * correção (endereço sem aba, aba que não existe, "voltar" para uma aba que redireciona)
 * substitui a entrada, ou o botão "voltar" ficaria preso refazendo o mesmo redirecionamento.
 */
let correcting = true;
const syncHash = () => {
  const hash = formatHash(controller.route);
  if (window.location.hash === hash) {
    return;
  }
  if (correcting) {
    window.history.replaceState(null, '', hash);
  } else {
    window.location.hash = hash;
  }
};

syncTheme();
controller.onChange(syncTheme);
for (const query of ['(prefers-color-scheme: light)', '(prefers-contrast: more)']) {
  window.matchMedia(query).addEventListener('change', syncTheme);
}

window.addEventListener('hashchange', () => {
  // O endereço mudou por fora (voltar, avançar, digitado): o que o app ajustar a partir daqui
  // é correção, não navegação nova.
  correcting = true;
  const route = parseHash(window.location.hash);
  if (route !== null && route !== controller.route) {
    controller.navigate(route);
  }
  syncHash();
  correcting = false;
});

window.addEventListener('keydown', (event) => {
  if (isPaletteShortcut(event)) {
    // F1 abriria a ajuda do navegador; Ctrl+K, a barra de busca.
    event.preventDefault();
    void showPalette();
  }
});

watchPage(
  { document, window },
  {
    onVisibility: (visible) => controller.setVisible(visible),
    onOnline: () => controller.handleOnline(),
  },
);
watchOtherTabs(window, (change) => controller.handleTabChange(change));

// A conta e o estado guardados são lidos antes do primeiro desenho: quem recarrega a página
// vê o feudo de imediato, sem passar pelas boas-vindas (cujo campo roubaria o foco).
const started = controller.start(parseHash(window.location.hash));

const root = document.getElementById('root');
if (root !== null) {
  render(<App />, root);
}

void started.then(() => {
  syncHash();
  correcting = false;
  // Só depois da primeira abertura as mudanças de aba passam a mexer no endereço.
  controller.onChange(syncHash);
});
