import type { ViewState } from '@lotg/protocol';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import { isNewBuilding } from '../ui/format';
import {
  batchOption,
  forgeEndsLine,
  forgeLine,
  parseBatch,
  SMITHY_ANCHOR,
  SMITHY_ICON,
} from '../ui/smithy';
import { workTerms } from '../ui/threat';
import type { Actions } from './actions';
import { formatDuration, formatNumber } from './format';
import { focusOnMount, Icon } from './shared';

/** A obra do Ferreiro, com o custo, o prazo e o que a impede (a da lista de construções). */
function Raise(props: { view: ViewState; disabled: boolean; actions: Actions }) {
  const upgrade = props.view.constructions.available.find(
    (entry) => entry.building === props.view.smithy.building,
  );
  if (upgrade === undefined) {
    return null;
  }
  return (
    <div class="banner smithy-raise">
      <div id="smithy-raise-terms">
        <p>{workTerms(upgrade)}</p>
        {upgrade.blockedReason === null ? null : (
          <p class="blocked">
            <Icon name="lock" /> {upgrade.blockedReason}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={props.disabled || upgrade.blockedReason !== null}
        aria-describedby="smithy-raise-terms"
        onClick={() => props.actions.run('lords.build', upgrade.building)}
      >
        {isNewBuilding(upgrade) ? 'Construir' : 'Melhorar'} {upgrade.label}
      </button>
    </div>
  );
}

/** O lote na forja: quando termina, o que o cancelamento devolve e o botão de cancelar. */
function Running(props: {
  smithy: ViewState['smithy'];
  elapsed: number;
  disabled: boolean;
  busy: boolean;
  actions: Actions;
}) {
  const { forge } = props.smithy;
  if (forge === null) {
    return null;
  }
  return (
    <div class="banner smithy-running" data-testid="smithy-running" aria-busy={props.busy}>
      <div id="smithy-running-terms">
        <p>
          <Icon name="flame" /> <strong>Forjando {formatNumber(forge.amount)}</strong> ·{' '}
          <span class="num" data-testid="smithy-ends">
            {forgeEndsLine(forge, props.elapsed)}
          </span>
        </p>
        <p class="muted">
          O lote leva {formatDuration(forge.totalSeconds)} ao todo. {forge.refundText}
        </p>
      </div>
      <button
        type="button"
        data-testid="smithy-cancel"
        disabled={props.disabled || props.busy}
        aria-describedby="smithy-running-terms"
        onClick={() => props.actions.run('lords.cancelForge', { confirmed: true })}
      >
        {forge.cancelLabel}
      </button>
    </div>
  );
}

/**
 * A forja em duas etapas, como a negociação: a quantidade, "Revisar a forja" (custo e prazo do
 * lote, os do servidor) e "Confirmar". A ordem só nasce em "Confirmar".
 */
function ForgeForm(props: {
  smithy: ViewState['smithy'];
  disabled: boolean;
  busy: boolean;
  actions: Actions;
}) {
  const { smithy } = props;
  const { offer } = smithy;
  const [amount, setAmount] = useState('');
  const [reviewed, setReviewed] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    // Um lote entrou na forja por outro lado: a conferência aberta já não vale.
    if (reviewed !== null && smithy.forge !== null) {
      setReviewed(null);
    }
  }, [reviewed, smithy.forge]);
  const parsed = parseBatch(amount);
  const option = batchOption(smithy, parsed);
  const open = reviewed === null ? undefined : batchOption(smithy, reviewed);
  return (
    <form
      class="forge-form"
      aria-label="Forjar armas"
      onSubmit={(event) => {
        event.preventDefault();
        if (open === undefined && option !== undefined && option.affordable) {
          setReviewed(option.amount);
        }
      }}
    >
      <fieldset disabled={props.disabled}>
        <legend>Forjar</legend>
        <p class="muted" id="forge-recipe">
          {offer.costText}, em lotes de até {offer.batchMax}. Uma arma leva{' '}
          <span class="num">{formatDuration(smithy.perWeaponSeconds)}</span>.
        </p>
        <div class="trade-amount">
          <label for="forge-amount-input">Quantas armas</label>
          <input
            id="forge-amount-input"
            ref={input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            data-testid="forge-amount"
            value={amount}
            aria-describedby="forge-recipe forge-total"
            onInput={(event) => {
              setAmount(event.currentTarget.value);
              setReviewed(null);
            }}
          />
          <button
            type="button"
            data-testid="forge-max"
            disabled={offer.maxAmount <= 0}
            onClick={() => {
              setAmount(String(offer.maxAmount));
              setReviewed(null);
              input.current?.focus();
            }}
          >
            O máximo que o estoque paga
            <span class="num"> ({formatNumber(offer.maxAmount)})</span>
          </button>
        </div>
        <p class="trade-total num" id="forge-total" aria-live="polite" data-testid="forge-total">
          {option === undefined ? (
            `Digite quantas armas, de 1 a ${offer.batchMax}.`
          ) : (
            <strong>{forgeLine(smithy, option)}.</strong>
          )}
        </p>
        {offer.blockedReason === null ? null : (
          <p class="blocked">
            <Icon name="lock" /> {offer.blockedReason}
          </p>
        )}
        {option !== undefined && !option.affordable ? (
          <p class="warning">
            <Icon name="warning" /> O estoque não paga este lote.
          </p>
        ) : null}
        {open === undefined ? (
          <button
            type="submit"
            data-testid="forge-review"
            disabled={props.disabled || props.busy || option === undefined || !option.affordable}
            aria-busy={props.busy}
          >
            Revisar a forja
          </button>
        ) : (
          <div
            class="banner trade-review"
            role="group"
            aria-label="Confirme a forja"
            data-testid="forge-confirm"
          >
            <div id="forge-review-text">
              <p>
                <strong>{forgeLine(smithy, open)}.</strong>{' '}
                <span class="muted">O custo é cobrado agora; é um lote por vez.</span>
              </p>
            </div>
            <div class="trade-review-actions">
              <button
                type="button"
                data-testid="forge-confirm-button"
                ref={focusOnMount}
                aria-describedby="forge-review-text"
                disabled={props.disabled || props.busy}
                aria-busy={props.busy}
                onClick={() => {
                  props.actions.run('lords.forgeWeapons', {
                    amount: open.amount,
                    confirmed: true,
                  });
                  setReviewed(null);
                  setAmount('');
                }}
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => {
                  setReviewed(null);
                  input.current?.focus();
                }}
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </fieldset>
    </form>
  );
}

/**
 * O painel "Ferreiro" da aba Feudo (GDD §6.1): o que ele é hoje, na frase do servidor, e as armas
 * forjadas; sem o edifício, a obra; com ele, o lote em curso ou a forja em duas etapas.
 */
export function SmithyPanel(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  /** As ordens a caminho do servidor (`controller.guildOrders`). */
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { smithy } = props.view;
  const busy = props.busy.has('forge');
  return (
    <section aria-labelledby={SMITHY_ANCHOR}>
      <h2 id={SMITHY_ANCHOR} tabIndex={-1}>
        Ferreiro
      </h2>
      <p class="smithy-now">
        <Icon name={SMITHY_ICON} /> {smithy.text}
      </p>
      {smithy.built ? (
        <>
          <p class="smithy-weapons num" data-testid="smithy-weapons">
            {smithy.weaponsLabel}: <strong>{formatNumber(smithy.weapons)}</strong>
          </p>
          {smithy.forge === null ? (
            <ForgeForm
              smithy={smithy}
              disabled={props.disabled}
              busy={busy}
              actions={props.actions}
            />
          ) : (
            <Running
              smithy={smithy}
              elapsed={props.elapsed}
              disabled={props.disabled}
              busy={busy}
              actions={props.actions}
            />
          )}
        </>
      ) : (
        <Raise view={props.view} disabled={props.disabled} actions={props.actions} />
      )}
    </section>
  );
}
