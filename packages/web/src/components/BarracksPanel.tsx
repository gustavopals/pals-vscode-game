import type { ViewState } from '@lotg/protocol';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import {
  ARMY_ANCHOR,
  ARMY_ICON,
  batchAmount,
  disbandLine,
  lineLabel,
  offerOf,
  parseSoldiers,
  trainLine,
  trainingEndsLine,
  type UnitId,
  unitOf,
} from '../ui/army';
import { isNewBuilding } from '../ui/format';
import { workTerms } from '../ui/threat';
import type { Actions } from './actions';
import { formatDuration, formatNumber } from './format';
import { focusOnMount, Icon } from './shared';

type Army = ViewState['army'];

/** A obra do Quartel, com o custo, o prazo e o que a impede (a da lista de construções). */
function Raise(props: { view: ViewState; disabled: boolean; actions: Actions }) {
  const upgrade = props.view.constructions.available.find(
    (entry) => entry.building === props.view.army.building,
  );
  if (upgrade === undefined) {
    return null;
  }
  return (
    <div class="banner army-raise">
      <div id="army-raise-terms">
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
        aria-describedby="army-raise-terms"
        onClick={() => props.actions.run('lords.build', upgrade.building)}
      >
        {isNewBuilding(upgrade) ? 'Construir' : 'Melhorar'} {upgrade.label}
      </button>
    </div>
  );
}

/** As cinco unidades: quantos há, onde lutam, os números da visão e contra quem são fortes. */
function Units(props: { army: Army }) {
  return (
    <table class="army-units" data-testid="army-units">
      <caption class="sr-only">As unidades do exército</caption>
      <thead>
        <tr>
          <th scope="col">Unidade</th>
          <th scope="col" class="num">
            Há
          </th>
          <th scope="col">Onde luta</th>
          <th scope="col">Ataque · defesa · vida · iniciativa</th>
          <th scope="col">Contra quem</th>
          <th scope="col">Custo de cada um</th>
          <th scope="col">Come</th>
        </tr>
      </thead>
      <tbody>
        {props.army.units.map((unit) => (
          <tr key={unit.id} data-testid={`army-unit-${unit.id}`}>
            <th scope="row">{unit.label}</th>
            <td class="num" data-testid={`army-count-${unit.id}`}>
              {formatNumber(unit.count)}
            </td>
            <td>{lineLabel(unit)}</td>
            <td class="num">
              {unit.attack} · {unit.defense} · {unit.health} · {unit.initiative}
            </td>
            <td>{unit.counters}</td>
            <td>
              {unit.costText}
              {props.army.built ? (
                <span class="muted">, em {formatDuration(unit.secondsEach)}</span>
              ) : null}
            </td>
            <td class="num">{unit.foodPerHour}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** O lote em treino: quando termina, o que o cancelamento devolve e o botão de cancelar. */
function Running(props: {
  army: Army;
  elapsed: number;
  disabled: boolean;
  busy: boolean;
  actions: Actions;
}) {
  const { training } = props.army;
  if (training === null) {
    return null;
  }
  return (
    <div class="banner army-running" data-testid="army-running" aria-busy={props.busy}>
      <div id="army-running-terms">
        <p>
          <Icon name={ARMY_ICON} /> <strong>Treinando {training.label}</strong> ·{' '}
          <span class="num" data-testid="army-ends">
            {trainingEndsLine(training, props.elapsed)}
          </span>
        </p>
        <p class="muted" data-testid="army-refund">
          O lote leva {formatDuration(training.totalSeconds)} ao todo. {training.cancelRefundText}
        </p>
      </div>
      <button
        type="button"
        data-testid="army-cancel"
        disabled={props.disabled || props.busy}
        aria-describedby="army-running-terms"
        onClick={() => props.actions.run('lords.cancelTraining', { confirmed: true })}
      >
        Cancelar o treino
      </button>
    </div>
  );
}

/**
 * O treino em duas etapas, como a forja: a unidade e a quantidade, "Revisar o treino" (o custo de
 * cada um e o prazo, da visão) e "Confirmar". A ordem só nasce em "Confirmar".
 */
function TrainForm(props: { army: Army; disabled: boolean; busy: boolean; actions: Actions }) {
  const { army } = props;
  const [unitId, setUnitId] = useState<UnitId>('spearman');
  const [amount, setAmount] = useState('');
  const [reviewed, setReviewed] = useState<{ unit: UnitId; amount: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    // Um lote entrou no pátio por outro lado: a conferência aberta já não vale.
    if (reviewed !== null && army.training !== null) {
      setReviewed(null);
    }
  }, [reviewed, army.training]);
  const unit = unitOf(army, unitId);
  const offer = offerOf(army, unitId);
  const parsed = batchAmount(army, unitId, parseSoldiers(amount));
  const open = reviewed === null ? undefined : unitOf(army, reviewed.unit);
  const openAmount = reviewed === null ? null : batchAmount(army, reviewed.unit, reviewed.amount);
  if (unit === undefined || offer === undefined) {
    return null;
  }
  return (
    <form
      class="train-form"
      aria-label="Treinar soldados"
      onSubmit={(event) => {
        event.preventDefault();
        if (open === undefined && parsed !== null) {
          setReviewed({ unit: unitId, amount: parsed });
        }
      }}
    >
      <fieldset disabled={props.disabled}>
        <legend>Treinar</legend>
        <div class="trade-amount">
          <label for="train-unit-input">Qual soldado</label>
          <select
            id="train-unit-input"
            data-testid="train-unit"
            value={unitId}
            onChange={(event) => {
              setUnitId(event.currentTarget.value as UnitId);
              setReviewed(null);
            }}
          >
            {army.units.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <p class="muted" id="train-recipe">
          Cada {unit.label}: {unit.costText}, em {formatDuration(unit.secondsEach)}. Lote de até{' '}
          {offer.batchMax}.
        </p>
        <div class="trade-amount">
          <label for="train-amount-input">Quantos soldados</label>
          <input
            id="train-amount-input"
            ref={input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            data-testid="train-amount"
            value={amount}
            aria-describedby="train-recipe train-total"
            onInput={(event) => {
              setAmount(event.currentTarget.value);
              setReviewed(null);
            }}
          />
          <button
            type="button"
            data-testid="train-max"
            disabled={offer.maxAmount <= 0}
            onClick={() => {
              setAmount(String(offer.maxAmount));
              setReviewed(null);
              input.current?.focus();
            }}
          >
            O máximo que se paga agora
            <span class="num"> ({formatNumber(offer.maxAmount)})</span>
          </button>
        </div>
        <p class="trade-total num" id="train-total" aria-live="polite" data-testid="train-total">
          {parsed === null ? (
            offer.maxAmount > 0 ? (
              `Digite quantos, de 1 a ${offer.maxAmount}.`
            ) : (
              'Não dá para treinar este soldado agora.'
            )
          ) : (
            <strong>{trainLine(props.army, unit, parsed)}.</strong>
          )}
        </p>
        {offer.blockedReason === null ? null : (
          <p class="blocked">
            <Icon name="lock" /> {offer.blockedReason}
          </p>
        )}
        {open === undefined || openAmount === null ? (
          <button
            type="submit"
            data-testid="train-review"
            disabled={props.disabled || props.busy || parsed === null}
            aria-busy={props.busy}
          >
            Revisar o treino
          </button>
        ) : (
          <div
            class="banner trade-review"
            role="group"
            aria-label="Confirme o treino"
            data-testid="train-confirm"
          >
            <div id="train-review-text">
              <p>
                <strong>{trainLine(props.army, open, openAmount)}.</strong>{' '}
                <span class="muted">O custo é cobrado agora; é um lote por vez.</span>
              </p>
            </div>
            <div class="trade-review-actions">
              <button
                type="button"
                data-testid="train-confirm-button"
                ref={focusOnMount}
                aria-describedby="train-review-text"
                disabled={props.disabled || props.busy}
                aria-busy={props.busy}
                onClick={() => {
                  props.actions.run('lords.trainSoldiers', {
                    unit: open.id,
                    amount: openAmount,
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
 * Dispensar, também em duas etapas: dispensar não devolve nada, e o soldado vira aldeão de novo.
 * O servidor recusa o que passa do que há; a tela só confere a forma e o que a visão mostra.
 */
function DisbandForm(props: { army: Army; disabled: boolean; busy: boolean; actions: Actions }) {
  const { army } = props;
  const [unitId, setUnitId] = useState<UnitId>('spearman');
  const [amount, setAmount] = useState('');
  const [reviewed, setReviewed] = useState<{ unit: UnitId; amount: number } | null>(null);
  const unit = unitOf(army, unitId);
  const parsed = parseSoldiers(amount);
  const valid = unit !== undefined && parsed !== null && parsed <= unit.count;
  const open = reviewed === null ? undefined : unitOf(army, reviewed.unit);
  if (unit === undefined) {
    return null;
  }
  return (
    <form
      class="disband-form"
      aria-label="Dispensar soldados"
      onSubmit={(event) => {
        event.preventDefault();
        if (open === undefined && valid) {
          setReviewed({ unit: unitId, amount: parsed });
        }
      }}
    >
      <fieldset disabled={props.disabled || army.total === 0}>
        <legend>Dispensar</legend>
        <div class="trade-amount">
          <label for="disband-unit-input">Qual soldado</label>
          <select
            id="disband-unit-input"
            data-testid="disband-unit"
            value={unitId}
            onChange={(event) => {
              setUnitId(event.currentTarget.value as UnitId);
              setReviewed(null);
            }}
          >
            {army.units.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label} ({formatNumber(entry.count)})
              </option>
            ))}
          </select>
          <label for="disband-amount-input">Quantos</label>
          <input
            id="disband-amount-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            data-testid="disband-amount"
            value={amount}
            onInput={(event) => {
              setAmount(event.currentTarget.value);
              setReviewed(null);
            }}
          />
        </div>
        {parsed !== null && unit !== undefined && parsed > unit.count ? (
          <p class="warning">
            <Icon name="warning" /> Há só {formatNumber(unit.count)} de {unit.label}.
          </p>
        ) : null}
        {open === undefined || reviewed === null ? (
          <button
            type="submit"
            data-testid="disband-review"
            disabled={props.disabled || props.busy || !valid}
          >
            Revisar a dispensa
          </button>
        ) : (
          <div
            class="banner trade-review"
            role="group"
            aria-label="Confirme a dispensa"
            data-testid="disband-confirm"
          >
            <div id="disband-review-text">
              <p>
                <strong>{disbandLine(open, reviewed.amount)}.</strong>{' '}
                <span class="muted">
                  Eles voltam à lavoura como aldeões; o que custaram não volta.
                </span>
              </p>
            </div>
            <div class="trade-review-actions">
              <button
                type="button"
                data-testid="disband-confirm-button"
                ref={focusOnMount}
                aria-describedby="disband-review-text"
                disabled={props.disabled || props.busy}
                onClick={() => {
                  props.actions.run('lords.disbandSoldiers', {
                    unit: open.id,
                    amount: reviewed.amount,
                    confirmed: true,
                  });
                  setReviewed(null);
                  setAmount('');
                }}
              >
                Dispensar
              </button>
              <button type="button" onClick={() => setReviewed(null)}>
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
 * O painel "Quartel" da aba Exército (GDD §6.1 e §10.2): o que ele é hoje, na frase do servidor,
 * e os soldados; sem o edifício, a obra; com ele, o lote em curso ou o treino em duas etapas, e a
 * dispensa. As unidades aparecem sempre, com os números e os contra-ataques que a visão traz.
 */
export function BarracksPanel(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  /** As ordens a caminho do servidor (`controller.guildOrders`). */
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { army } = props.view;
  const training = props.busy.has('train');
  return (
    <section aria-labelledby={ARMY_ANCHOR}>
      <h2 id={ARMY_ANCHOR} tabIndex={-1}>
        Quartel
      </h2>
      <p class="army-now">
        <Icon name={ARMY_ICON} /> {army.text}
      </p>
      {army.built ? (
        <p class="army-total num" data-testid="army-total">
          Soldados: <strong>{formatNumber(army.total)}</strong> de {formatNumber(army.cap)} · comem{' '}
          {army.foodText}
        </p>
      ) : (
        <Raise view={props.view} disabled={props.disabled} actions={props.actions} />
      )}
      <Units army={army} />
      {army.built ? (
        <>
          {army.training === null ? (
            <TrainForm
              army={army}
              disabled={props.disabled}
              busy={training}
              actions={props.actions}
            />
          ) : (
            <Running
              army={army}
              elapsed={props.elapsed}
              disabled={props.disabled}
              busy={training}
              actions={props.actions}
            />
          )}
          <DisbandForm
            army={army}
            disabled={props.disabled}
            busy={[...props.busy].some((key) => key.startsWith('disband:'))}
            actions={props.actions}
          />
        </>
      ) : null}
    </section>
  );
}
