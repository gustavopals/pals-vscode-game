/** O que se usa da Notification API do navegador. */
export type NotificationApi = {
  readonly permission: string;
  requestPermission(): Promise<string>;
  new (title: string, options?: { body?: string; tag?: string }): unknown;
};

export type BrowserNotifier = {
  /** O navegador tem a API. */
  supported: boolean;
  granted(): boolean;
  /** Pede a permissão. Só é chamada quando o jogador liga a opção nas preferências. */
  request(): Promise<boolean>;
  show(title: string, body: string): void;
};

/**
 * Notificações do navegador, opcionais (ADR 0008, ponto 4): servem para a aba em segundo
 * plano. A permissão nunca é pedida por conta própria.
 */
export function browserNotifier(api: NotificationApi | undefined): BrowserNotifier {
  if (api === undefined) {
    return { supported: false, granted: () => false, request: async () => false, show: () => {} };
  }
  return {
    supported: true,
    granted: () => api.permission === 'granted',
    request: async () => {
      if (api.permission === 'granted') {
        return true;
      }
      if (api.permission === 'denied') {
        return false;
      }
      try {
        return (await api.requestPermission()) === 'granted';
      } catch {
        return false;
      }
    },
    show: (title, body) => {
      if (api.permission !== 'granted') {
        return;
      }
      try {
        new api(title, { body, tag: 'lords' });
      } catch {
        // Alguns navegadores só aceitam notificações por service worker: fica sem.
      }
    },
  };
}
