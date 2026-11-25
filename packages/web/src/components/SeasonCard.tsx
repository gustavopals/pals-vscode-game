import type { CurrentSeasonResponse, LeaderboardResponse, SeasonSummary } from '@lotg/protocol';

import type { Controller, Loadable } from '../app/controller';
import type { NewGameOptions } from '../game/newGame';
import { ChronicleDocument } from '../tabs/Chronicle';
import { ordinal, whole } from '../ui/kingdom';
import type { Actions } from './actions';
import { formatCountdown, formatNumber } from './format';
import { Icon } from './shared';

export type SeasonCardProps = {
  current: Loadable<CurrentSeasonResponse>;
  ranking: Loadable<LeaderboardResponse>;
  chronicle: Controller['seasonChronicle'];
  options: NewGameOptions | null;
  now: number;
  online: boolean;
  joining: boolean;
  joinError: string | null;
  viewingSeason: boolean;
  hasSeasonFief: boolean;
  actions: Actions;
};

const SECONDS_PER_DAY = 86_400;

function Ranking(props: { value: LeaderboardResponse; previous: boolean; actions: Actions }) {
  const { season, entries, me } = props.value;
  return (
    <div class="season-ranking">
      <h3>
        <Icon name="star-full" /> Ranking {props.previous ? `· ${season.code}` : 'da semana'}
      </h3>
      <p class="season-position">
        {!me.listed
          ? `Seu feudo está fora do ranking${me.position === null ? '' : ` (ficaria em ${ordinal(me.position)})`}.`
          : me.position === null
            ? 'Você ainda não tem posição neste ranking.'
            : `Sua posição: ${ordinal(me.position)}.`}
      </p>
      {entries.length === 0 ? (
        <p class="muted">Nenhum feudo listado nesta semana.</p>
      ) : (
        <div
          class="season-ranking-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tabela do ranking"
        >
          <table class="ranking" aria-label={`Ranking da Temporada ${season.code}`}>
            <thead>
              <tr>
                <th scope="col">Posição</th>
                <th scope="col">Feudo</th>
                <th scope="col" class="num">
                  Pontuação
                </th>
                <th scope="col">Cerco</th>
                <th scope="col" class="num">
                  Feitos
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.position}
                  class={entry.mine ? 'ranking-mine' : undefined}
                  aria-current={entry.mine ? 'true' : undefined}
                >
                  <td>{ordinal(entry.position)}</td>
                  <th scope="row" class="ranking-name">
                    {entry.settlementName}
                    {entry.mine ? <span class="ranking-you"> (seu feudo)</span> : null}
                    {entry.chronicleAvailable ? (
                      <button
                        type="button"
                        class="link season-chronicle-link"
                        id={`season-position-${entry.position}`}
                        aria-label={`Ler Crônica de ${entry.settlementName}`}
                        onClick={() =>
                          props.actions.run('lords.openSeasonChronicle', entry.position)
                        }
                      >
                        <Icon name="book" /> Ler Crônica
                      </button>
                    ) : null}
                  </th>
                  <td class="num">{whole(entry.score)}</td>
                  <td>{entry.siegeOutcomeText ?? '—'}</td>
                  <td class="num">{whole(entry.feats)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Deadline(props: {
  title: string;
  at: string;
  timezone: SeasonSummary['timezone'];
  now: number;
  ended: string;
}) {
  const date = new Date(props.at);
  const stamp = new Intl.DateTimeFormat('pt-BR', {
    timeZone: props.timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  const seconds = Math.max(0, Math.ceil((date.getTime() - props.now) / 1000));
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  return (
    <div class="season-deadline">
      <dt>{props.title}</dt>
      <dd class="season-countdown">
        {seconds === 0 ? (
          props.ended
        ) : (
          <span role="timer">
            {days > 0 ? `${days}d ` : ''}
            {formatCountdown(seconds % SECONDS_PER_DAY)}
          </span>
        )}
      </dd>
      <dd class="muted">
        <time dateTime={props.at}>{stamp}</time>
      </dd>
    </div>
  );
}

export function SeasonCard(props: SeasonCardProps) {
  const { current, ranking, chronicle, actions } = props;
  const season = current.status === 'ready' ? current.value.season : null;
  const difficulty = props.options?.difficulties.find(
    (option) => option.id === season?.difficulty,
  )?.label;
  const pace = props.options?.paces.find((option) => option.timeScale === season?.timeScale)?.label;
  return (
    <section class="season-card" aria-labelledby="season-title">
      <header class="season-header">
        <h2 id="season-title" tabIndex={-1}>
          <Icon name="flag" /> Temporada
        </h2>
        {season === null ? null : <span class="season-code">{season.code}</span>}
      </header>
      {current.status === 'error' ? (
        <p class="muted" role="status">
          {current.message}{' '}
          <button type="button" class="link" onClick={() => actions.run('lords.refreshSeason')}>
            Atualizar
          </button>
        </p>
      ) : current.status !== 'ready' ? (
        <p class="muted" role="status">
          Consultando a Temporada…
        </p>
      ) : (
        <>
          <p class="season-intro">Uma prova compartilhada entre os feudos do reino.</p>
          <dl class="season-terms">
            <div>
              <dt>Dificuldade</dt>
              <dd>{difficulty ?? 'A consultar'}</dd>
            </div>
            <div>
              <dt>Ritmo</dt>
              <dd>
                {pace ? `${pace} · ` : ''}
                {formatNumber(current.value.season.timeScale)}×
              </dd>
            </div>
          </dl>
          <dl class="season-deadlines" aria-label="Prazos em horário de Brasília">
            <Deadline
              title="Fim da entrada"
              at={current.value.season.joinEndsAt}
              timezone={current.value.season.timezone}
              now={props.now}
              ended="Entrada encerrada"
            />
            <Deadline
              title="Fecho da semana"
              at={current.value.season.endsAt}
              timezone={current.value.season.timezone}
              now={props.now}
              ended="Prazo encerrado"
            />
          </dl>
          <p class="season-timezone muted">
            <Icon name="clock" /> Horário de Brasília
          </p>
          {current.value.joined ? (
            <p class="season-action">
              <span>
                <Icon name="check" />{' '}
                {current.value.season.status === 'closed'
                  ? 'Seu feudo disputou esta semana.'
                  : 'Seu feudo está inscrito.'}
              </span>
              {props.hasSeasonFief && !props.viewingSeason ? (
                <button
                  type="button"
                  class="secondary"
                  onClick={() => actions.run('lords.switchFief', 'season')}
                >
                  Abrir feudo da Temporada
                </button>
              ) : null}
            </p>
          ) : current.value.season.joinOpen &&
            Date.parse(current.value.season.joinEndsAt) > props.now ? (
            <p class="season-action">
              <button
                type="button"
                disabled={props.joining || !props.online}
                aria-busy={props.joining}
                onClick={() => actions.run('lords.joinSeason')}
              >
                <Icon name="flag" />{' '}
                {props.joining ? 'Firmando a inscrição…' : 'Entrar na Temporada'}
              </button>
            </p>
          ) : null}
          {props.joinError === null ? null : (
            <p class="warning" role="alert">
              {props.joinError}
            </p>
          )}
          {current.value.season.status !== 'closed' ? (
            <p class="season-ranking-note muted">
              <Icon name="star-full" /> O ranking sai no fim da semana.
            </p>
          ) : null}
          {ranking.status === 'ready' && ranking.value.published ? (
            <Ranking
              value={ranking.value}
              previous={ranking.value.season.id !== current.value.season.id}
              actions={actions}
            />
          ) : ranking.status === 'error' ? (
            <p class="warning" role="alert">
              {ranking.message}{' '}
              <button type="button" class="link" onClick={() => actions.run('lords.refreshSeason')}>
                Atualizar ranking
              </button>
            </p>
          ) : ranking.status === 'loading' || current.value.season.status === 'closed' ? (
            <p class="muted" role="status">
              Consultando o ranking…
            </p>
          ) : null}
          {chronicle === null ? null : (
            <div class="season-chronicle" role="region" aria-labelledby="season-chronicle-title">
              <div class="season-header">
                <h3 id="season-chronicle-title" tabIndex={-1}>
                  <Icon name="book" /> Crônica · {chronicle.name}
                </h3>
                <button
                  type="button"
                  class="secondary"
                  onClick={() => actions.run('lords.closeSeasonChronicle')}
                >
                  Fechar Crônica
                </button>
              </div>
              <ChronicleDocument
                annual
                embedded
                actions={actions}
                document={
                  chronicle.document.status === 'ready'
                    ? { status: 'ready', value: chronicle.document.value.markdown }
                    : chronicle.document
                }
                retry={() => actions.run('lords.openSeasonChronicle', chronicle.position)}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
