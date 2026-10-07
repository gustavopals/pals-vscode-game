import type { ViewState } from '@lotg/protocol';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import { isNewBuilding } from '../ui/format';
import {
  blockedFor,
  changeLine,
  directionVerb,
  goldText,
  hasMarket,
  MARKET_ANCHOR,
  MARKET_ICON,
  type Market,
  maxFor,
  parseAmount,
  type PriceRow,
  priceLabel,
  stockLeftLine,
  remainingLine,
  reviewStillOpen,
  type TradeDirection,
  tradeLine,
  tradeTotal,
  TRENDS,
  unitPrice,
} from '../ui/market';
import { workTerms } from '../ui/threat';
import type { Actions } from './actions';
import { formatNumber } from './format';
import { Explained, focusOnMount, Icon } from './shared';

/** A palavra de uma tendência com o ícone: a cor nunca diz sozinha para onde o preço foi. */
function Trend(props: { trend: PriceRow['trend'] }) {
  const { word, icon } = TRENDS[props.trend];
  return (
    <span class="price-trend">
      <Icon name={icon} /> {word}
    </span>
  );
}

/**
 * A ordem que o jogador conferiu: o recurso, o sentido, a quantidade e o preço de hoje, com o dia
 * da cotação em que foi conferida. A ordem sai com esse dia; se a visão passar a outro dia com a
 * conferência aberta, ela deixa de valer e a tela pede a conferência de novo.
 */
type Review = {
  resource: PriceRow['resource'];
  direction: TradeDirection;
  /** O clique da tabela em que foi aberta (`focusTick`): outro clique a fecha. */
  pick: number;
  amount: number;
  quoteDay: number;
  unit: number;
  total: number;
};

/**
 * A obra do Mercado, com o custo, o prazo e o que a impede, ao lado da frase do servidor que diz
 * para que ele serve. A obra é a da lista de construções.
 */
function Raise(props: { view: ViewState; disabled: boolean; actions: Actions }) {
  const upgrade = props.view.constructions.available.find(
    (entry) => entry.building === props.view.market.building,
  );
  if (upgrade === undefined) {
    return null;
  }
  return (
    <div class="banner market-raise">
      <div id="market-raise-terms">
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
        aria-describedby="market-raise-terms"
        onClick={() => props.actions.run('lords.build', upgrade.building)}
      >
        {isNewBuilding(upgrade) ? 'Construir' : 'Melhorar'} {upgrade.label}
      </button>
    </div>
  );
}

/** A tabela dos preços de hoje: compra, venda, base, tendência e o que ainda cabe. */
function PriceTable(props: {
  market: Market;
  selected: { resource: string; direction: TradeDirection };
  disabled: boolean;
  onPick: (resource: PriceRow['resource'], direction: TradeDirection) => void;
}) {
  return (
    <table class="market-prices" aria-label="Preços de hoje no Mercado">
      <thead>
        <tr>
          <th scope="col">Recurso</th>
          <th scope="col" class="num">
            Compra
          </th>
          <th scope="col" class="num">
            Venda
          </th>
          <th scope="col" class="num">
            Base
          </th>
          <th scope="col">Tendência</th>
          <th scope="col">Hoje</th>
          <th scope="col">
            <span class="sr-only">Negociar</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {props.market.prices.map((row) => (
          <tr key={row.resource} data-resource={row.resource} aria-label={priceLabel(row)}>
            <th scope="row">{row.label}</th>
            <td class="num">
              <Explained why={row.breakdown}>{row.buyText}</Explained>
            </td>
            <td class="num">
              <Explained why={row.breakdown}>{row.sellText}</Explained>
            </td>
            <td class="num">{row.baseText}</td>
            <td>
              <Trend trend={row.trend} />
            </td>
            <td>{remainingLine(row)}</td>
            <td class="market-row-actions">
              {(['buy', 'sell'] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  data-direction={direction}
                  disabled={props.disabled}
                  aria-pressed={
                    props.selected.resource === row.resource &&
                    props.selected.direction === direction
                  }
                  onClick={() => props.onPick(row.resource, direction)}
                >
                  {directionVerb(direction)}
                  <span class="sr-only"> {row.label.toLowerCase()}</span>
                </button>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * A negociação (GDD §5.9 e §13.6): o recurso, o sentido, a quantidade (pelo teclado, ou pelos
 * botões de 10, 50 e "o máximo de hoje", que vem da visão) e o **total em ouro antes de
 * confirmar**: `quantidade × preço de hoje`, a conta exata que o servidor cobra. "Revisar" abre a
 * conferência com o total; a ordem só nasce em "Confirmar", e carrega o dia da cotação que o
 * jogador viu. Se o dia virar com a conferência aberta, o preço novo é mostrado e a conferência
 * é pedida de novo: nada é reenviado sozinho.
 */
function TradeForm(props: {
  view: ViewState;
  market: Market;
  elapsed: number;
  disabled: boolean;
  busy: ReadonlySet<string>;
  selected: { resource: PriceRow['resource']; direction: TradeDirection };
  onSelect: (resource: PriceRow['resource'], direction: TradeDirection) => void;
  amount: string;
  onAmount: (amount: string) => void;
  /** Sobe a cada "Comprar" ou "Vender" da tabela: o foco vai para a quantidade. */
  focusTick: number;
  actions: Actions;
}) {
  const { market, selected } = props;
  const row = market.prices.find((entry) => entry.resource === selected.resource);
  const [review, setReview] = useState<Review | null>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (props.focusTick > 0) {
      amountInput.current?.focus();
    }
  }, [props.focusTick]);
  if (row === undefined) {
    return null;
  }
  const { direction } = selected;
  const amount = parseAmount(props.amount);
  const total = tradeTotal(row, direction, amount);
  const max = maxFor(row, direction);
  const blocked = blockedFor(row, direction);
  const busy = props.busy.has(`trade:${row.resource}`);
  const change = changeLine(market, props.elapsed);
  const price = (milli: number) => `${goldText(milli)} de ouro por unidade`;

  const conferred = (): Review | null =>
    amount === null || total === null
      ? null
      : {
          resource: row.resource,
          direction,
          pick: props.focusTick,
          amount,
          quoteDay: market.quoteDay,
          unit: unitPrice(row, direction),
          total,
        };

  // A conferência é do recurso e do sentido em que foi aberta: mudar um dos dois a fecha. Se o
  // dia da cotação passou, ela já não vale, e o preço novo vem ao lado do que foi conferido.
  const open =
    review !== null &&
    reviewStillOpen(review, { resource: row.resource, direction, pick: props.focusTick })
      ? review
      : null;
  const stale = open !== null && open.quoteDay !== market.quoteDay;
  const now = stale ? conferred() : null;

  const confirm = () => {
    if (open === null || stale) {
      return;
    }
    props.actions.run('lords.trade', {
      resource: open.resource,
      direction: open.direction,
      amount: open.amount,
      quoteDay: open.quoteDay,
      confirmed: true,
    });
    setReview(null);
    // O botão que tinha o foco sai da tela com a conferência: o foco volta à quantidade.
    amountInput.current?.focus();
  };

  const leftLine =
    open === null ? null : stockLeftLine(props.view, row, open.direction, open.amount);
  const nameOf = `${directionVerb(direction)} ${row.label.toLowerCase()}`;
  return (
    <form
      class="trade-form"
      aria-label="Negociar no Mercado"
      onSubmit={(event) => {
        event.preventDefault();
        if (open === null) {
          setReview(conferred());
        }
      }}
    >
      <fieldset disabled={props.disabled}>
        <legend>Negociar</legend>
        <div class="choice-line" role="radiogroup" aria-label="Recurso">
          {market.prices.map((entry) => (
            <label key={entry.resource} class="choice-pill">
              <input
                type="radio"
                name="trade-resource"
                data-resource={entry.resource}
                checked={entry.resource === row.resource}
                onChange={() => props.onSelect(entry.resource, direction)}
              />
              <span>{entry.label}</span>
            </label>
          ))}
        </div>
        <div class="choice-line" role="radiogroup" aria-label="Sentido">
          {(['buy', 'sell'] as const).map((entry) => (
            <label key={entry} class="choice-pill">
              <input
                type="radio"
                name="trade-direction"
                data-direction={entry}
                checked={entry === direction}
                onChange={() => props.onSelect(row.resource, entry)}
              />
              <span>{entry === 'buy' ? 'Comprar' : 'Vender'}</span>
            </label>
          ))}
        </div>
        <p class="trade-price" id="trade-price">
          <Icon name={MARKET_ICON} />{' '}
          <span class="num">
            {direction === 'buy' ? 'Compra' : 'Venda'} a {price(unitPrice(row, direction))}
          </span>
          {change === null ? null : <span class="muted"> · o preço muda {change}</span>}
        </p>
        <div class="trade-amount">
          <label for="trade-amount-input">Quantidade</label>
          <input
            id="trade-amount-input"
            ref={amountInput}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            data-testid="trade-amount"
            value={props.amount}
            aria-describedby="trade-price trade-total trade-note"
            onInput={(event) => {
              props.onAmount(event.currentTarget.value);
              setReview(null);
            }}
          />
          {[10, 50].map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => {
                props.onAmount(String(step));
                setReview(null);
                amountInput.current?.focus();
              }}
            >
              {step}
              <span class="sr-only"> unidades</span>
            </button>
          ))}
          <button
            type="button"
            data-testid="trade-max"
            disabled={max <= 0}
            onClick={() => {
              props.onAmount(String(max));
              setReview(null);
              amountInput.current?.focus();
            }}
          >
            O máximo de hoje
            <span class="num"> ({formatNumber(max)})</span>
          </button>
        </div>
        <p class="trade-total num" id="trade-total" aria-live="polite" data-testid="trade-total">
          {total === null || amount === null ? (
            'Digite quantas unidades, de 1 em diante.'
          ) : (
            <>
              <strong>Total: {goldText(total)} de ouro</strong>
              {' · '}
              {tradeLine(row, direction, amount, total)}
            </>
          )}
        </p>
        <div id="trade-note">
          {blocked === null ? null : (
            <p class="blocked">
              <Icon name="lock" /> {blocked}
            </p>
          )}
          {amount !== null && max > 0 && amount > max ? (
            <p class="warning">
              <Icon name="warning" /> Mais do que cabe agora ({formatNumber(max)}): o servidor deve
              recusar.
            </p>
          ) : null}
        </div>
        {open === null ? (
          <button
            type="submit"
            data-testid="trade-review"
            disabled={props.disabled || busy || amount === null}
            aria-busy={busy}
          >
            Revisar a ordem
            <span class="sr-only">: {nameOf}</span>
          </button>
        ) : (
          <div
            class="banner trade-review"
            role="group"
            aria-label="Confirme a ordem"
            data-testid="trade-confirm"
          >
            <div id="trade-review-text">
              {stale ? (
                <p class="warning" role="alert">
                  <Icon name="warning" /> O preço mudou enquanto você conferia: era{' '}
                  <span class="num">{price(open.unit)}</span>
                  {now === null
                    ? ''
                    : `, agora é ${price(now.unit)} (total ${goldText(now.total)} de ouro)`}
                  . Confira de novo.
                </p>
              ) : (
                <p>
                  <strong>{tradeLine(row, open.direction, open.amount, open.total)}.</strong>{' '}
                  {leftLine === null ? null : <span class="num">{leftLine} </span>}
                  <span class="muted">
                    Preço de hoje, {price(open.unit)}
                    {change === null ? '' : `; o preço muda ${change}`}.
                  </span>
                </p>
              )}
            </div>
            <div class="trade-review-actions">
              {stale ? (
                <button
                  type="button"
                  data-testid="trade-reconfirm"
                  ref={focusOnMount}
                  disabled={props.disabled || now === null}
                  onClick={() => setReview(conferred())}
                >
                  Conferir o preço novo
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="trade-confirm-button"
                  ref={focusOnMount}
                  aria-describedby="trade-review-text"
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
 * O painel "Mercado" da aba (GDD §5.9 e §13.1): o que ele é hoje, na frase do servidor; sem o
 * edifício, a obra; com ele, a tabela dos preços de hoje, a negociação e quando o preço muda.
 * Tudo o que é preço, volume, prazo ou motivo vem da visão.
 */
export function MarketPanel(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  /** As ordens a caminho do servidor (`controller.guildOrders`). */
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { view, elapsed } = props;
  const { market } = view;
  const [picked, setPicked] = useState<{
    resource: PriceRow['resource'];
    direction: TradeDirection;
  } | null>(null);
  // Sem escolha, o primeiro recurso da tabela, para vender; com o Mercado de pé a tabela nunca é vazia.
  const first = market.prices[0]?.resource;
  const selected =
    picked ?? (first === undefined ? null : { resource: first, direction: 'sell' as const });
  const setSelected = setPicked;
  const [amount, setAmount] = useState('');
  const [focusTick, setFocusTick] = useState(0);
  const change = changeLine(market, elapsed);
  return (
    <section aria-labelledby={MARKET_ANCHOR}>
      <h2 id={MARKET_ANCHOR} tabIndex={-1}>
        Mercado
      </h2>
      <p class="market-now">
        <Icon name={MARKET_ICON} /> {market.text}
      </p>
      {hasMarket(market) && selected !== null ? (
        <>
          {/* Não é região viva: o prazo muda a cada minuto. */}
          {change === null ? null : (
            <p class="muted hint market-change">
              <Icon name="watch" /> O preço e o volume do dia mudam{' '}
              <span class="num">{change}</span>.
            </p>
          )}
          <PriceTable
            market={market}
            selected={selected}
            disabled={props.disabled}
            onPick={(resource, direction) => {
              setSelected({ resource, direction });
              setAmount('');
              // A quantidade é o próximo passo: o foco vai para ela, como num formulário.
              setFocusTick((tick) => tick + 1);
            }}
          />
          <TradeForm
            view={view}
            market={market}
            elapsed={elapsed}
            disabled={props.disabled}
            busy={props.busy}
            selected={selected}
            onSelect={(resource, direction) => {
              setSelected({ resource, direction });
              setAmount('');
            }}
            amount={amount}
            onAmount={setAmount}
            focusTick={focusTick}
            actions={props.actions}
          />
        </>
      ) : (
        <Raise view={view} disabled={props.disabled} actions={props.actions} />
      )}
    </section>
  );
}
