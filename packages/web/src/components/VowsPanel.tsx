import type { ViewState } from '@lotg/protocol';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import {
  hasVowOffer,
  VOW_ICON,
  vowBonusText,
  type VowId,
  VOWS_ANCHOR,
  vowsConfirmationText,
  vowsDeadlineText,
  vowsOf,
  vowsReviewSignature,
  vowsWindowOpen,
} from '../ui/vows';
import type { Actions } from './actions';
import { Icon } from './shared';

/**
 * Painel dos Votos do Ano (V5C-T4): enquanto a janela estiver aberta, mostra os Votos oferecidos
 * pelo servidor (nome, descrição e bônus de Legado), caixas para marcar os desejados, o prazo
 * ("fecha em …") e a conferência em duas etapas antes de enviar `lords.takeVows` (trava `vows`).
 * Com a janela fechada, lista os Votos firmados (ou avisa que o ano segue sem Votos) e não mostra
 * botões que já não se aplicam.
 */
export function VowsPanel(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  busy?: ReadonlySet<string> | boolean | undefined;
  initialSelected?: readonly VowId[] | undefined;
  initialReviewing?: boolean | undefined;
  actions: Actions;
}) {
  const { view, elapsed, actions } = props;
  const working = typeof props.busy === 'boolean' ? props.busy : (props.busy?.has('vows') ?? false);
  const vows = vowsOf(view);
  const hasOffer = hasVowOffer(view);
  const openWindow = vowsWindowOpen(view, elapsed);
  const aftermath =
    view.siege !== null && view.siege.year === view.calendar.year && view.siege.result !== null;

  const [selected, setSelected] = useState<VowId[]>(() => [...(props.initialSelected ?? [])]);
  const chosenVows = vows.offer.filter((vow) => selected.includes(vow.id));
  const chosenIds = chosenVows.map((vow) => vow.id);
  const currentSig = vowsReviewSignature(vows.offer, chosenIds);

  const [reviewed, setReviewed] = useState<string | null>(() =>
    props.initialReviewing ? currentSig : null,
  );
  const confirmRef = useRef<HTMLButtonElement>(null);
  const reviewOpenRef = useRef<HTMLButtonElement>(null);
  const returning = useRef(false);

  useLayoutEffect(() => {
    if (reviewed !== null && !openWindow) {
      setReviewed(null);
    }
  }, [reviewed, openWindow]);

  const reviewing = openWindow && reviewed !== null && reviewed === currentSig;
  const offerChanged = openWindow && reviewed !== null && !reviewing;

  useLayoutEffect(() => {
    if (reviewing) {
      confirmRef.current?.focus();
    } else if (returning.current) {
      returning.current = false;
      reviewOpenRef.current?.focus();
    }
  }, [reviewing]);

  const toggle = (id: VowId) => {
    setReviewed(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <section class="vows-panel" aria-labelledby={VOWS_ANCHOR} data-testid="vows-panel">
      <h2 id={VOWS_ANCHOR} tabIndex={-1}>
        <Icon name={VOW_ICON} /> Votos do Ano
      </h2>
      {hasOffer ? (
        <>
          {openWindow ? (
            <p class="muted" data-testid="vows-deadline">
              Janela de Votos aberta ({vowsDeadlineText(view, elapsed)}). Marque os desafios que
              deseja firmar ou siga sem nenhum; a escolha é única e irreversível no ano.
            </p>
          ) : (
            <p class="blocked" data-testid="vows-deadline">
              <Icon name="lock" /> O prazo da janela de Votos acabou (
              {vowsDeadlineText(view, elapsed)}).
            </p>
          )}
          {openWindow && props.disabled ? (
            <p class="muted" data-testid="vows-offline">
              Sem ligação com o reino: reconecte-se para firmar os Votos.
            </p>
          ) : null}
          {offerChanged ? (
            <p class="blocked" data-testid="vows-offer-changed">
              <Icon name="warning" /> A oferta de Votos mudou desde a conferência. Confira de novo.
            </p>
          ) : null}
          <ul class="vows-list" aria-label="Votos oferecidos" data-testid="vows-offer-list">
            {vows.offer.map((vow) => {
              const checked = chosenIds.includes(vow.id);
              const checkId = `vow-check-${vow.id}`;
              const descId = `vow-desc-${vow.id}`;
              return (
                <li
                  key={vow.id}
                  class={`vow-item${checked ? ' vow-selected' : ''}`}
                  data-testid={`vow-item-${vow.id}`}
                >
                  <label class="vow-label" for={checkId}>
                    <input
                      id={checkId}
                      type="checkbox"
                      data-testid={`vow-check-${vow.id}`}
                      aria-describedby={descId}
                      checked={checked}
                      disabled={props.disabled || working || !openWindow}
                      onChange={() => toggle(vow.id)}
                    />
                    <strong>{vow.label}</strong>{' '}
                    <span class="chip vow-bonus" data-testid={`vow-bonus-${vow.id}`}>
                      {vowBonusText(vow)}
                    </span>
                  </label>
                  <p id={descId} class="muted vow-description">
                    {vow.description}
                  </p>
                </li>
              );
            })}
          </ul>
          {openWindow ? (
            reviewing ? (
              <div
                class="vows-confirm"
                role="group"
                aria-labelledby="vows-confirm-text"
                data-testid="vows-confirm"
              >
                <p id="vows-confirm-text" data-testid="vows-confirm-text">
                  {vowsConfirmationText(chosenVows)}
                </p>
                <div class="trade-review-actions">
                  <button
                    type="button"
                    ref={confirmRef}
                    data-testid="vows-confirm-button"
                    aria-describedby="vows-confirm-text"
                    disabled={props.disabled || working}
                    aria-busy={working}
                    onClick={() => {
                      setReviewed(null);
                      actions.run('lords.takeVows', { vows: chosenIds, confirmed: true });
                    }}
                  >
                    Confirmar Votos
                  </button>
                  <button
                    type="button"
                    class="secondary"
                    data-testid="vows-back"
                    disabled={working}
                    onClick={() => {
                      returning.current = true;
                      setReviewed(null);
                    }}
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <div class="trade-review-actions">
                <button
                  type="button"
                  ref={reviewOpenRef}
                  data-testid="vows-review-open"
                  disabled={props.disabled || working}
                  aria-busy={working}
                  onClick={() => setReviewed(currentSig)}
                >
                  Firmar Votos…
                </button>
              </div>
            )
          ) : null}
        </>
      ) : vows.taken.length > 0 ? (
        <>
          <p class="muted" data-testid="vows-closed">
            Janela de Votos encerrada.{' '}
            {aftermath ? 'Votos firmados para o próximo ano' : 'Votos ativos neste ano'} (
            {vows.taken.length}):
          </p>
          <ul
            class="vows-list vows-taken-list"
            aria-label={aftermath ? 'Votos firmados para o próximo ano' : 'Votos ativos neste ano'}
            data-testid="vows-taken-list"
          >
            {vows.taken.map((vow) => (
              <li key={vow.id} class="vow-item vow-taken" data-testid={`vow-taken-${vow.id}`}>
                <div class="vow-label">
                  <strong>{vow.label}</strong>{' '}
                  <span class="chip vow-bonus" data-testid={`vow-bonus-${vow.id}`}>
                    {vowBonusText(vow)}
                  </span>
                </div>
                <p class="muted vow-description">{vow.description}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p class="muted" data-testid="vows-closed">
          Janela de Votos encerrada:{' '}
          {aftermath ? 'nenhum Voto firmado para o próximo ano.' : 'nenhum Voto ativo neste ano.'}
        </p>
      )}
    </section>
  );
}
