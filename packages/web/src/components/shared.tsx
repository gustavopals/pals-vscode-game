import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/** Segundos decorridos desde `since`, atualizados a cada segundo para as contagens regressivas. */
export function useElapsedSeconds(since: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Com a aba em segundo plano, não há por que redesenhar a cada segundo.
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

/** Um codicon. É decoração: o texto ao lado, ou o `aria-label` de quem o contém, é que fala. */
export function Icon(props: { name: string }) {
  return <span class={`codicon codicon-${props.name}`} aria-hidden="true" />;
}

/**
 * Ref de um botão que acabou de aparecer e deve receber o foco: a conferência de uma ordem troca
 * o botão "Revisar" (que tinha o foco) por "Confirmar", e sem isto o foco cairia no corpo da
 * página. A função tem identidade fixa de propósito: o Preact só a chama quando o elemento
 * entra, e não a cada atualização da tela (o relógio redesenha o painel todo segundo).
 */
export function focusOnMount(element: { focus: () => void } | null): void {
  element?.focus();
}
