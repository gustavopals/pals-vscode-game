type DocumentLike = {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
};

type WindowLike = {
  addEventListener(type: 'online', listener: () => void): void;
  removeEventListener(type: 'online', listener: () => void): void;
};

/**
 * Liga o app ao que o navegador sabe: se a aba está à vista (o ciclo de atualização vai a
 * 30 s; fora dela, a 2 min) e se a rede voltou (sincroniza na hora). Chama `onVisibility` uma
 * vez de saída, com o estado atual. Devolve a função que desliga.
 */
export function watchPage(
  page: { document: DocumentLike; window: WindowLike },
  handlers: { onVisibility: (visible: boolean) => void; onOnline: () => void },
): () => void {
  const visibility = () => handlers.onVisibility(page.document.visibilityState === 'visible');
  page.document.addEventListener('visibilitychange', visibility);
  page.window.addEventListener('online', handlers.onOnline);
  visibility();
  return () => {
    page.document.removeEventListener('visibilitychange', visibility);
    page.window.removeEventListener('online', handlers.onOnline);
  };
}
