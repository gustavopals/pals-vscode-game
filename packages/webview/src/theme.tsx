import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/** Segundos decorridos desde `since`, atualizados a cada segundo para as contagens regressivas. */
export function useElapsedSeconds(since: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Com o painel oculto, não há por que redesenhar a cada segundo.
    const timer = setInterval(() => {
      if (!document.hidden) {
        setNow(Date.now());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return since === 0 ? 0 : Math.max(0, (now - since) / 1000);
}

/**
 * Um número com o seu "por quê". A explicação aparece ao passar o mouse e ao focar pelo
 * teclado, e é lida por leitores de tela: nada fica escondido atrás do mouse.
 */
export function Explained(props: { why: string; children: ComponentChildren }) {
  return (
    <span class="explained" tabIndex={0} data-tip={props.why}>
      {props.children}
      {/* Para leitores de tela, a explicação vem logo depois do número, sem substituí-lo. */}
      <span class="sr-only"> ({props.why})</span>
    </span>
  );
}
