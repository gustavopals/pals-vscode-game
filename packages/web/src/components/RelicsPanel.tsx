import type { ViewState } from '@lotg/protocol';

import { formatNumber } from '../ui/format';
import {
  activeRelicsCount,
  chapelInWorks,
  chapelMissingLine,
  placedRelicsCount,
  RELIC_ICON,
  relicEffectiveLine,
  RELICS_ANCHOR,
  relicsOf,
  relicStateBadge,
} from '../ui/relics';
import type { Actions } from './actions';
import { Icon } from './shared';

/**
 * Painel da Capela e das relíquias na aba da Guilda (v0.5, Fase B; ADR 0022). Mostra os espaços
 * ocupados e totais da Capela, a linha do que falta quando ela ainda não foi erguida e cada
 * relíquia do feudo com o efeito, o estado (guardada, colocada ou ativa), o prazo de vigência
 * ("Vale a partir de…" / "Já está em vigor."), o motivo de bloqueio e os botões Colocar e Retirar.
 */
export function RelicsPanel(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  busy?: ReadonlySet<string> | ((key: string) => boolean);
  actions: Actions;
}) {
  const { view, elapsed, actions } = props;
  const isBusy = (key: string): boolean =>
    props.busy === undefined
      ? false
      : typeof props.busy === 'function'
        ? props.busy(key)
        : props.busy.has(key);
  const relics = relicsOf(view);
  const used = placedRelicsCount(relics);
  const active = activeRelicsCount(relics);
  const missing = chapelMissingLine(view, elapsed);
  const buildingChapel = chapelInWorks(view.constructions) !== undefined;

  return (
    <section aria-labelledby={RELICS_ANCHOR}>
      <h2 id={RELICS_ANCHOR} tabIndex={-1}>
        Capela e relíquias
      </h2>
      <p class="muted hint">
        <Icon name={RELIC_ICON} /> Espaços na Capela:{' '}
        <strong class="num">
          {formatNumber(used)}/{formatNumber(relics.slots)}
        </strong>
        {active > 0 ? (
          <>
            {' · '}
            <strong class="num">{formatNumber(active)}</strong> {active === 1 ? 'ativa' : 'ativas'}
          </>
        ) : null}
        .
      </p>
      {missing === null ? null : (
        <p class="blocked" data-chapel-missing="true">
          <Icon name={buildingChapel ? 'tools' : 'lock'} /> {missing}
        </p>
      )}
      {relics.items.length === 0 ? (
        <p class="muted">Nenhuma relíquia guardada no feudo ainda.</p>
      ) : (
        <ul class="heroes" aria-label="Relíquias do feudo">
          {relics.items.map((item) => {
            const busy = isBusy(`relic:${item.relicId}`);
            const effective = relicEffectiveLine(item, elapsed);
            const showBlocked = !item.placed && item.blockedReason !== null;
            const whyId = `relic-${item.relicId}-why`;
            return (
              <li key={item.relicId} class="hero" data-relic={item.relicId} aria-busy={busy}>
                <p class="hero-name">
                  <Icon name={item.active ? 'star-full' : item.placed ? 'watch' : RELIC_ICON} />{' '}
                  <strong>{item.label}</strong> <span class="muted">· {relicStateBadge(item)}</span>
                </p>
                <p class="hero-sheet muted">{item.effectText}</p>
                {effective === null ? null : (
                  <p class="hero-sheet muted">
                    <Icon name={item.active ? 'check' : 'watch'} /> {effective}
                  </p>
                )}
                {showBlocked ? (
                  <p id={whyId} class="blocked">
                    <Icon name="lock" /> {item.blockedReason}
                  </p>
                ) : null}
                <div class="hero-actions">
                  {item.placed ? (
                    <button
                      type="button"
                      class="secondary"
                      disabled={props.disabled || busy || !item.canRemove}
                      onClick={() => actions.run('lords.removeRelic', { relicId: item.relicId })}
                    >
                      Retirar<span class="sr-only"> {item.label}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={props.disabled || busy || !item.canPlace}
                      aria-describedby={showBlocked ? whyId : undefined}
                      onClick={() => actions.run('lords.placeRelic', { relicId: item.relicId })}
                    >
                      Colocar<span class="sr-only"> {item.label}</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
