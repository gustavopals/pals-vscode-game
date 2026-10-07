import type { ViewState } from '@lotg/protocol';
import { useRef, useState } from 'preact/hooks';

import { formatDuration } from '../ui/format';
import {
  arrivalIn,
  CARAVAN_ICON,
  CARAVANS_ANCHOR,
  type CaravanOffer,
  caravanGold,
  caravanResource,
  escortHeroes,
  escortLine,
  goldText,
  hasMarket,
  parseAmount,
} from '../ui/market';
import type { Actions } from './actions';
import { formatNumber } from './format';
import { Explained, focusOnMount, Icon } from './shared';

/** A conferência de um envio: o que o jogador viu quando pediu para conferir. */
type Review = {
  resource: string;
  amount: number;
  escortHeroId: string | null;
  quoteDay: number;
  unit: number;
  gold: number;
};

/**
 * As caravanas na estrada, da visão: o destino, a carga, a chegada com o relógio da página e a
 * escolta. O desfecho nunca aparece aqui antes de a caravana chegar: o servidor não o diz.
 */
function OnTheRoad(props: { view: ViewState; elapsed: number }) {
  const { caravans } = props.view.market;
  if (caravans.length === 0) {
    return null;
  }
  return (
    <ul class="caravans" aria-label="Caravanas na estrada">
      {caravans.map((caravan) => (
        <li key={caravan.id} class="caravan" data-caravan={caravan.id}>
          <p class="hero-name">
            <Icon name={CARAVAN_ICON} />{' '}
            <strong>
              Caravana a {caravan.destination} · {caravan.cargoText}
            </strong>{' '}
            · <span class="num">{arrivalIn(caravan, props.elapsed)}</span>
          </p>
          <div class="hero-sheet">
            <p>
              {caravan.text} <span class="num">Rende {caravan.goldText} de ouro</span>
              {caravan.escortName === null ? ' se chegar inteira' : ''}.
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** O que a estrada diz, antes de a carga ser escolhida: o preço, a viagem e o risco. */
function RoadTerms(props: { offer: CaravanOffer }) {
  const { offer } = props;
  return (
    <div class="caravan-terms">
      <p>
        {offer.priceRatioText} Viagem a {offer.destination}:{' '}
        <span class="num">{formatDuration(offer.tripSeconds)}</span>.
      </p>
      <p>
        <Explained why={offer.riskBreakdown}>{offer.riskText}</Explained>
      </p>
      <p class="muted">{offer.lossText}</p>
    </div>
  );
}

/**
 * O envio de uma caravana (GDD §5.9 e §13.6): o recurso, a quantidade, a escolta (só quem a
 * visão diz que pode ir) e, **antes de confirmar**, o preço fixado, o que ela rende se chegar
 * inteira, a viagem e o risco com a conta. A ordem só nasce em "Confirmar" e leva o dia da
 * cotação que foi conferida: se o dia virar com a conferência aberta, o preço novo aparece e a
 * conferência é pedida de novo; nada é reenviado sozinho.
 */
function SendForm(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { view } = props;
  const { market } = view;
  const offer = market.caravanOffer;
  const heroes = escortHeroes(view);
  const firstWithRoom = offer.resources.find((row) => row.maxSendable > 0)?.resource;
  const [resource, setResource] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [escort, setEscort] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const chosen = caravanResource(
    offer,
    resource ?? firstWithRoom ?? offer.resources[0]?.resource ?? '',
  );
  // Quem saiu da lista (partiu, feriu-se) com a tela aberta já não vai de escolta.
  const escortId = escort !== null && heroes.some((hero) => hero.id === escort) ? escort : null;
  const amount = parseAmount(amountText);
  const gold = chosen === undefined || amount === null ? null : caravanGold(chosen, amount);
  const busy = chosen !== undefined && props.busy.has(`caravan:${chosen.resource}`);
  const escortName = heroes.find((hero) => hero.id === escortId)?.name ?? null;

  if (chosen === undefined) {
    return null;
  }

  const conferred = (): Review | null =>
    amount === null || gold === null
      ? null
      : {
          resource: chosen.resource,
          amount,
          escortHeroId: escortId,
          quoteDay: market.quoteDay,
          unit: chosen.unitPrice,
          gold,
        };
  const open =
    review !== null &&
    review.resource === chosen.resource &&
    review.escortHeroId === escortId &&
    review.amount === amount
      ? review
      : null;
  const stale = open !== null && open.quoteDay !== market.quoteDay;
  const now = stale ? conferred() : null;
  const label = chosen.label.toLowerCase();

  const confirm = () => {
    if (open === null || stale) {
      return;
    }
    props.actions.run('lords.sendCaravan', {
      resource: open.resource,
      amount: open.amount,
      escortHeroId: open.escortHeroId,
      quoteDay: open.quoteDay,
      confirmed: true,
    });
    setReview(null);
    // O botão que tinha o foco sai da tela com a conferência: o foco volta à quantidade.
    amountInput.current?.focus();
  };

  const summary = (current: Review) =>
    `Mandar ${formatNumber(current.amount)} de ${label} a ${offer.destination}, ` +
    `a ${goldText(current.unit)} de ouro a unidade: ${goldText(current.gold)} de ouro se chegar inteira. ` +
    (current.escortHeroId === null
      ? 'Nenhuma escolta.'
      : `Escolta: ${escortName ?? 'o herói marcado'}.`);

  return (
    <form
      class="trade-form caravan-form"
      aria-label="Mandar uma caravana"
      onSubmit={(event) => {
        event.preventDefault();
        if (open === null) {
          setReview(conferred());
        }
      }}
    >
      <fieldset disabled={props.disabled}>
        <legend>Mandar uma caravana</legend>
        <RoadTerms offer={offer} />
        <div class="choice-line" role="radiogroup" aria-label="Carga">
          {offer.resources.map((entry) => (
            <label key={entry.resource} class="choice-pill">
              <input
                type="radio"
                name="caravan-resource"
                data-resource={entry.resource}
                checked={entry.resource === chosen.resource}
                disabled={entry.maxSendable <= 0}
                onChange={() => {
                  setResource(entry.resource);
                  setReview(null);
                }}
              />
              <span>
                {entry.label} <span class="muted">a {entry.unitPriceText}</span>
              </span>
            </label>
          ))}
        </div>
        <p class="muted">
          <Explained why={chosen.breakdown}>
            Preço fixado no envio: {chosen.unitPriceText} de ouro por unidade de {label}
          </Explained>
        </p>
        <div class="trade-amount">
          <label for="caravan-amount-input">Quantidade</label>
          <input
            id="caravan-amount-input"
            ref={amountInput}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            data-testid="caravan-amount"
            value={amountText}
            aria-describedby="caravan-total"
            onInput={(event) => {
              setAmountText(event.currentTarget.value);
              setReview(null);
            }}
          />
          <button
            type="button"
            data-testid="caravan-max"
            disabled={chosen.maxSendable <= 0}
            onClick={() => {
              setAmountText(String(chosen.maxSendable));
              setReview(null);
              amountInput.current?.focus();
            }}
          >
            O máximo
            <span class="num"> ({formatNumber(chosen.maxSendable)})</span>
          </button>
        </div>
        <div class="choice-line" role="radiogroup" aria-label="Escolta">
          <label class="choice-pill">
            <input
              type="radio"
              name="caravan-escort"
              data-escort="none"
              checked={escortId === null}
              onChange={() => {
                setEscort(null);
                setReview(null);
              }}
            />
            <span>Sem escolta</span>
          </label>
          {heroes.map((hero) => (
            <label key={hero.id} class="choice-pill">
              <input
                type="radio"
                name="caravan-escort"
                data-escort={hero.id}
                checked={escortId === hero.id}
                onChange={() => {
                  setEscort(hero.id);
                  setReview(null);
                }}
              />
              <span>{escortLine(hero)}</span>
            </label>
          ))}
        </div>
        {heroes.length === 0 ? (
          <p class="muted hint">Nenhum herói livre para escoltar agora.</p>
        ) : null}
        <p
          class="trade-total num"
          id="caravan-total"
          aria-live="polite"
          data-testid="caravan-total"
        >
          {gold === null || amount === null ? (
            'Digite quantas unidades, de 1 em diante.'
          ) : (
            <>
              <strong>Rende {goldText(gold)} de ouro se chegar inteira</strong> ·{' '}
              {formatNumber(amount)} de {label},{' '}
              {escortName === null ? 'sem escolta' : `escolta: ${escortName}`}
            </>
          )}
        </p>
        {open === null ? (
          <button
            type="submit"
            data-testid="caravan-review"
            disabled={props.disabled || busy || amount === null}
            aria-busy={busy}
          >
            Revisar o envio
          </button>
        ) : (
          <div
            class="banner trade-review"
            role="group"
            aria-label="Confirme o envio"
            data-testid="caravan-confirm"
          >
            <div id="caravan-review-text">
              {stale ? (
                <p class="warning" role="alert">
                  <Icon name="warning" /> O preço mudou enquanto você conferia: era{' '}
                  <span class="num">{goldText(open.unit)}</span>
                  {now === null
                    ? ''
                    : `, agora é ${goldText(now.unit)} (rende ${goldText(now.gold)} de ouro)`}
                  . Confira de novo.
                </p>
              ) : (
                <>
                  <p>
                    <strong>{summary(open)}</strong>
                  </p>
                  <p class="muted">
                    Viagem: {formatDuration(offer.tripSeconds)}. {offer.riskText}
                  </p>
                </>
              )}
            </div>
            <div class="trade-review-actions">
              {stale ? (
                <button
                  type="button"
                  data-testid="caravan-reconfirm"
                  ref={focusOnMount}
                  disabled={props.disabled || now === null}
                  onClick={() => setReview(conferred())}
                >
                  Conferir o preço novo
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="caravan-confirm-button"
                  ref={focusOnMount}
                  aria-describedby="caravan-review-text"
                  disabled={props.disabled || busy}
                  aria-busy={busy}
                  onClick={confirm}
                >
                  Confirmar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setReview(null);
                  amountInput.current?.focus();
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
 * O painel "Caravanas" da aba Mercado (GDD §5.9): as que estão na estrada e, com lugar nela, o
 * envio de uma nova. Sem o Mercado no nível das caravanas, ou com a estrada cheia, a frase do
 * servidor diz por quê, com cadeado.
 */
export function CaravanPanel(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  /** As ordens a caminho do servidor (`controller.guildOrders`). */
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { view } = props;
  const { market } = view;
  const offer = market.caravanOffer;
  if (!hasMarket(market)) {
    return null;
  }
  return (
    <section aria-labelledby={CARAVANS_ANCHOR}>
      <h2 id={CARAVANS_ANCHOR} tabIndex={-1}>
        Caravanas
      </h2>
      <OnTheRoad view={view} elapsed={props.elapsed} />
      {offer.available ? (
        <SendForm
          view={view}
          elapsed={props.elapsed}
          disabled={props.disabled}
          busy={props.busy}
          actions={props.actions}
        />
      ) : (
        <p class="blocked caravan-blocked" data-testid="caravan-blocked">
          <Icon name="lock" /> {offer.blockedReason}
        </p>
      )}
    </section>
  );
}
