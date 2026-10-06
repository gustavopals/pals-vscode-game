import type { ViewState } from '@lotg/protocol';

import { isNewBuilding } from '../ui/format';
import {
  festivalCost,
  festivalRunning,
  HERO_ICON,
  offerTerms,
  rotationLine,
  TAVERN_ANCHOR,
  TAVERN_ICON,
  type TavernOffer,
} from '../ui/guild';
import { workTerms } from '../ui/threat';
import type { Actions } from './actions';
import { Traits } from './HeroesPanel';
import { Icon } from './shared';

/** Um id de elemento a partir do id da oferta, para ligar o botão ao que o descreve. */
const elementId = (offerId: string) => `offer-${offerId.replace(/[^A-Za-z0-9_-]/g, '-')}-about`;

/**
 * Um candidato (GDD §9.1): a ficha em uma linha e, logo abaixo, o preço de agora (na frase do
 * servidor, com o desconto por extenso quando há) e o soldo que ele passa a custar por hora
 * real. O botão aponta para tudo isso (`aria-describedby`): quem chega pelo teclado ouve o preço
 * antes do `Enter`. Bloqueada, a contratação diz o motivo do servidor, com cadeado.
 */
function Offer(props: { offer: TavernOffer; disabled: boolean; busy: boolean; actions: Actions }) {
  const { offer } = props;
  const about = elementId(offer.offerId);
  return (
    <li class="hero" aria-busy={props.busy}>
      <p class="hero-name">
        <Icon name={HERO_ICON} /> <strong>{offer.name}</strong> · {offer.classLabel} · Nv
        {offer.level}
        <Traits traits={offer.traits} />
      </p>
      <div id={about} class="hero-sheet">
        <p>{offerTerms(offer)}</p>
        {offer.blockedReason === null ? null : (
          <p class="blocked">
            <Icon name="lock" /> {offer.blockedReason}
          </p>
        )}
      </div>
      <div class="hero-actions">
        <button
          type="button"
          disabled={props.disabled || props.busy || offer.blockedReason !== null}
          aria-describedby={about}
          onClick={() => props.actions.run('lords.hireHero', { offerId: offer.offerId })}
        >
          Contratar<span class="sr-only"> {offer.name}</span>
        </button>
      </div>
    </li>
  );
}

/**
 * O festival (ADR 0017, decisão 10): o custo, o efeito e o limite, na frase do servidor, e o
 * botão. Bloqueado, o motivo vem escrito; em curso, por quanto tempo a moral ainda o conta. O
 * custo está ao lado do botão: a ordem segue sem outra pergunta.
 */
function Festival(props: {
  tavern: ViewState['tavern'];
  elapsed: number;
  disabled: boolean;
  busy: boolean;
  actions: Actions;
}) {
  const { festival } = props.tavern;
  const running = festivalRunning(props.tavern, props.elapsed);
  return (
    <div class="banner tavern-festival" aria-busy={props.busy}>
      <div id="festival-terms">
        <p>
          <Icon name="smiley" /> <strong>Festival</strong> ·{' '}
          <span class="num">{festivalCost(props.tavern)}</span>
        </p>
        <p>{festival.effectText}</p>
        {running === null ? null : <p>{running}</p>}
        {festival.blockedReason === null ? null : (
          <p class="blocked">
            <Icon name="lock" /> {festival.blockedReason}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={props.disabled || props.busy || !festival.available}
        aria-describedby="festival-terms"
        onClick={() => props.actions.run('lords.holdFestival', { confirmed: true })}
      >
        Dar um festival
      </button>
    </div>
  );
}

/**
 * A Taverna ainda por erguer: a obra dela, com o custo, o prazo e o que a impede, ao lado da
 * frase do servidor que diz para que ela serve. A obra é a da lista de construções.
 */
function Raise(props: { view: ViewState; disabled: boolean; actions: Actions }) {
  const upgrade = props.view.constructions.available.find((entry) => entry.building === 'tavern');
  if (upgrade === undefined) {
    return null;
  }
  return (
    <div class="banner tavern-raise">
      <div id="tavern-raise-terms">
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
        aria-describedby="tavern-raise-terms"
        onClick={() => props.actions.run('lords.build', upgrade.building)}
      >
        {isNewBuilding(upgrade) ? 'Construir' : 'Melhorar'} {upgrade.label}
      </button>
    </div>
  );
}

/**
 * O painel "Taverna" da aba Guilda (GDD §6.1 e §9.1): o que ela é hoje, na frase do servidor;
 * sem o edifício, a obra; com ele, os candidatos desta rotação, quando a lista troca e o
 * festival. Tudo o que é preço, prazo ou motivo vem da visão.
 */
export function TavernPanel(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  /** As ordens da Guilda a caminho do servidor (`controller.guildOrders`). */
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { view, elapsed } = props;
  const { tavern } = view;
  const rotation = rotationLine(tavern, elapsed);
  return (
    <section aria-labelledby={TAVERN_ANCHOR}>
      <h2 id={TAVERN_ANCHOR} tabIndex={-1}>
        Taverna
      </h2>
      <p class="tavern-now">
        <Icon name={TAVERN_ICON} /> {tavern.text}
      </p>
      {tavern.level === 0 ? (
        <Raise view={view} disabled={props.disabled} actions={props.actions} />
      ) : (
        <>
          {tavern.offers.length === 0 ? (
            <p class="muted">Nenhum candidato à mesa agora.</p>
          ) : (
            <ul class="heroes" aria-label="Candidatos">
              {tavern.offers.map((offer) => (
                <Offer
                  key={offer.offerId}
                  offer={offer}
                  disabled={props.disabled}
                  busy={props.busy.has(`hire:${offer.offerId}`)}
                  actions={props.actions}
                />
              ))}
            </ul>
          )}
          {/* Não é região viva: o prazo muda a cada minuto. */}
          {rotation === null ? null : (
            <p class="muted hint tavern-rotation">
              <Icon name="watch" /> A lista de candidatos <span class="num">{rotation}</span>.
            </p>
          )}
          <Festival
            tavern={tavern}
            elapsed={elapsed}
            disabled={props.disabled}
            busy={props.busy.has('festival')}
            actions={props.actions}
          />
        </>
      )}
    </section>
  );
}
