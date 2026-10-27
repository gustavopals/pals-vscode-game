import type { ViewState } from '@lotg/protocol';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import { DEFENSE_ICON } from '../ui/threat';
import type { Actions } from './actions';
import { formatCountdown, remaining } from './format';
import { Icon } from './shared';

type Defense = ViewState['threat']['defense'];
type Offer = Defense['wall']['repairOffer'];

/** O que a conferência viu: se qualquer um muda, a conferência deixa de valer. */
export const wallSignature = (offer: Offer): string =>
  `${offer.stone}:${offer.gold}:${offer.seconds}`;

/**
 * A muralha (GDD §6.3; V4E-T4): o nível, a vida de cada ala na frase do servidor, o reparo em
 * duas etapas ("Reparar a muralha…" mostra o custo e o prazo da visão; "Confirmar o reparo" manda
 * a ordem) e o que a Torre de Vigia dispara na batalha. Sem muralha (sem Paliçada) não há o que
 * mostrar: quem fala é a frase da defesa, logo acima. O app não calcula nada: tudo vem pronto.
 */
export function WallPanel(props: {
  defense: Defense;
  elapsed: number;
  disabled: boolean;
  reviewed?: string | null;
  actions: Actions;
}) {
  const { defense, elapsed, actions } = props;
  const { wall, tower } = defense;
  const offer = wall.repairOffer;
  const [reviewed, setReviewed] = useState<string | null>(props.reviewed ?? null);
  const confirm = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    // O reparo começou ou deixou de caber (aqui ou em outro navegador): a conferência aberta já não vale.
    if (reviewed !== null && (offer.repairingInSeconds !== null || !offer.canRepair)) {
      setReviewed(null);
    }
  }, [reviewed, offer.repairingInSeconds, offer.canRepair]);
  const repairing = offer.repairingInSeconds;
  const valid = repairing === null && offer.canRepair;
  const open = valid && reviewed !== null && reviewed === wallSignature(offer);
  useLayoutEffect(() => {
    if (open) {
      confirm.current?.focus();
    }
  }, [open]);
  if (defense.palisadeLevel === 0) {
    return null;
  }
  const changed = valid && reviewed !== null && !open;
  return (
    <div class="banner threat-wall" data-testid="wall-panel">
      <div id="threat-wall-terms">
        <p>
          <Icon name={DEFENSE_ICON} /> <strong>{wall.levelLabel}</strong>
        </p>
        <ul class="threat-wall-hp" aria-label="A vida da muralha, por ala" data-testid="wall-hp">
          {(['left', 'center', 'right'] as const).map((wing) => (
            <li key={wing}>{wall.hpText[wing]}</li>
          ))}
        </ul>
        {repairing === null ? (
          <p class="muted" data-testid="wall-offer">
            {offer.text}
          </p>
        ) : (
          <p data-testid="wall-repairing">
            <Icon name="tools" /> Os pedreiros estão na muralha: o reparo termina em{' '}
            <strong class="num">{formatCountdown(remaining(repairing, elapsed))}</strong>.
          </p>
        )}
        {offer.blockedText !== null && repairing === null ? (
          <p class="blocked" data-testid="wall-blocked">
            <Icon name="lock" /> {offer.blockedText}
          </p>
        ) : null}
        {open ? (
          <p data-testid="wall-review">
            Conferir: {offer.text} A ordem só vai quando você confirmar.
          </p>
        ) : null}
        {changed ? (
          <p class="blocked" data-testid="wall-changed">
            <Icon name="warning" /> O custo do reparo mudou desde a conferência. Confira de novo.
          </p>
        ) : null}
        {tower.damageText === null ? null : (
          <p class="muted" data-testid="wall-tower">
            {tower.damageText}
          </p>
        )}
      </div>
      {valid ? (
        <div class="trade-review-actions">
          {open ? (
            <>
              <button
                type="button"
                ref={confirm}
                data-testid="wall-confirm"
                disabled={props.disabled || !offer.canRepair}
                onClick={() => {
                  setReviewed(null);
                  actions.run('lords.repairWall', { confirmed: true });
                }}
              >
                Confirmar o reparo
              </button>
              <button type="button" data-testid="wall-back" onClick={() => setReviewed(null)}>
                Voltar
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="wall-review-open"
              disabled={props.disabled || !offer.canRepair}
              aria-describedby="threat-wall-terms"
              onClick={() => setReviewed(wallSignature(offer))}
            >
              Reparar a muralha…
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
