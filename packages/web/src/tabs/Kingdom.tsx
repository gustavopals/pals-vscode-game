import type { StatsResponse } from '@lotg/protocol';

import type { Loadable } from '../app/controller';
import type { Actions } from '../components/actions';
import { Icon } from '../components/shared';
import {
  fiefFacts,
  gapBefore,
  kingdomTiles,
  medal,
  ordinal,
  positionText,
  updatedText,
  whole,
} from '../ui/kingdom';

/** O ranking de ouro: posição, nome do feudo e ouro; a linha do jogador vem destacada e dita. */
function Ranking(props: { stats: StatsResponse }) {
  const { stats } = props;
  if (stats.ranking.length === 0) {
    return <p class="muted">Nenhum feudo no ranking ainda.</p>;
  }
  return (
    <table class="ranking" aria-label="Ranking de ouro">
      <thead>
        <tr>
          <th scope="col" class="num ranking-position">
            #
          </th>
          <th scope="col">Feudo</th>
          <th scope="col" class="num">
            Ouro
          </th>
        </tr>
      </thead>
      <tbody>
        {stats.ranking.map((entry, index) => {
          const icon = medal(entry.position);
          return [
            gapBefore(stats, index) ? (
              <tr key={`gap-${entry.position}`} class="ranking-gap" aria-hidden="true">
                <td colSpan={3}>⋯</td>
              </tr>
            ) : null,
            <tr
              key={entry.position}
              class={entry.mine ? 'ranking-mine' : undefined}
              aria-current={entry.mine ? 'true' : undefined}
            >
              <td class="num ranking-position">
                {icon === null ? null : (
                  <span class={`ranking-medal ranking-medal-${entry.position}`}>
                    <Icon name={icon} />
                  </span>
                )}
                {ordinal(entry.position)}
              </td>
              <th scope="row" class="ranking-name">
                {entry.settlementName}
                {entry.mine ? <span class="ranking-you"> (seu feudo)</span> : null}
              </th>
              <td class="num">{whole(entry.gold)}</td>
            </tr>,
          ];
        })}
      </tbody>
    </table>
  );
}

function Totals(props: { stats: StatsResponse }) {
  return (
    <ul class="kingdom-tiles" aria-label="Totais do reino">
      {kingdomTiles(props.stats.kingdom).map((tile) => (
        <li key={tile.id} class="kingdom-tile">
          <span class="kingdom-tile-label">
            <Icon name={tile.icon} /> {tile.label}
          </span>
          <span class="kingdom-tile-value">{tile.value}</span>
          <span class="kingdom-tile-hint">{tile.hint}</span>
        </li>
      ))}
    </ul>
  );
}

function Mine(props: { stats: StatsResponse; actions: Actions }) {
  const { stats, actions } = props;
  const fief = stats.me.fief;
  return (
    <section aria-labelledby="kingdom-mine">
      <h2 id="kingdom-mine">
        <Icon name="person" /> Minhas estatísticas
      </h2>
      <p>
        <Icon name="book" /> Legado da conta · <strong>{whole(stats.me.legacy)} pontos</strong>
      </p>
      <p class="kingdom-position">
        {stats.me.position === null || !stats.me.listed ? null : (
          <span class="kingdom-position-badge">{ordinal(stats.me.position)}</span>
        )}
        <span>{positionText(stats)}</span>
      </p>
      {fief === null ? null : (
        <>
          <p class="kingdom-fief-name">{fief.settlementName}</p>
          <dl class="kingdom-facts">
            {fiefFacts(fief).map((fact) => (
              <div key={fact.id} class="kingdom-fact">
                <dt>
                  <Icon name={fact.icon} /> {fact.label}
                </dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <p class="muted hint">
        {stats.me.listed
          ? 'Seu feudo aparece no ranking pelo nome dele, com o ouro. '
          : 'Seu feudo não aparece no ranking; os totais do reino continuam contando com ele, sem nome. '}
        <button type="button" class="link" onClick={() => actions.run('lords.openSettings')}>
          {stats.me.listed
            ? 'Sair do ranking nas Preferências'
            : 'Voltar ao ranking nas Preferências'}
        </button>
      </p>
    </section>
  );
}

/**
 * A aba Reino (ADR 0021): os totais de todo o reino, o ranking de ouro pelo nome do feudo e as
 * estatísticas do próprio jogador, com a posição dele. Só mostra o que `GET /v1/stats` trouxe.
 */
export function KingdomTab(props: {
  stats: Loadable<StatsResponse>;
  signedIn: boolean;
  actions: Actions;
}) {
  const { stats, actions } = props;
  return (
    <div class="document kingdom">
      <h1>
        <Icon name="graph" /> Reino
      </h1>
      <p class="lead">Os feudos de todo o reino, lado a lado.</p>
      {!props.signedIn ? (
        <p>Entre no jogo para ver o reino e o ranking de ouro.</p>
      ) : stats.status === 'ready' ? (
        <>
          <section aria-labelledby="kingdom-totals">
            <h2 id="kingdom-totals">
              <Icon name="globe" /> O reino
            </h2>
            <Totals stats={stats.value} />
          </section>
          <section aria-labelledby="kingdom-ranking">
            <h2 id="kingdom-ranking">
              <Icon name="star-full" /> Ranking de ouro
            </h2>
            <Ranking stats={stats.value} />
          </section>
          <Mine stats={stats.value} actions={actions} />
          <p class="muted hint kingdom-note">
            <Icon name="info" /> O ouro de cada feudo é o da última vez que ele foi atualizado, até
            1 hora atrás. {updatedText(stats.value.generatedAt)}{' '}
            <button type="button" class="link" onClick={() => actions.run('lords.refreshKingdom')}>
              Atualizar
            </button>
          </p>
        </>
      ) : stats.status === 'error' ? (
        <div class="banner banner-error" role="alert">
          <p>Não deu para consultar o reino: {stats.message}</p>
          <button
            type="button"
            class="secondary"
            onClick={() => actions.run('lords.refreshKingdom')}
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <p role="status">Consultando o reino…</p>
      )}
    </div>
  );
}
