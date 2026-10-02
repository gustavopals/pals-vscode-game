import type { ViewState } from '@lotg/protocol';

import { isNewBuilding } from '../ui/format';
import {
  DEFENSE_ICON,
  RAID_ICON,
  THREAT_ICON,
  threatIcon,
  threatRising,
  tileLine,
  type WatchedThreat,
  watchtowerPlanLine,
  watchtowerTerms,
  watchtowerWork,
} from '../ui/threat';
import type { Actions } from './actions';
import { formatCountdown, formatNumber, remaining } from './format';
import { Icon } from './shared';

/**
 * A Torre de Vigia, com a ação ao lado: o que ela faz hoje, o que o próximo nível passa a fazer,
 * quanto a obra custa e leva, e o botão que a ordena. Bloqueada, o botão fica desabilitado e o
 * motivo do servidor vem escrito; em obras, a contagem regressiva toma o lugar do botão; no teto
 * desta versão, a frase do servidor diz que parou ali. Uma informação que falta sem a saída à
 * vista seria só punição (GDD §15.1).
 */
function Watchtower(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  actions: Actions;
}) {
  const { view, elapsed, disabled, actions } = props;
  const { threat } = view;
  const { watchtower } = threat;
  const work = watchtowerWork(view);
  if (!threat.known && watchtower.next === null && work.kind === 'none') {
    // Nada a dizer da Torre além da névoa, que já está acima: a caixa não fica vazia na tela.
    return null;
  }
  return (
    <div class="banner threat-tower">
      <div id="threat-tower-terms">
        {/* Sem a Torre, quem fala dela é a frase da névoa, logo acima: não se repete aqui. */}
        {threat.known ? (
          <p>
            <Icon name={THREAT_ICON} /> {watchtower.text}
          </p>
        ) : null}
        {watchtower.next !== null ? <p>{watchtower.next}</p> : null}
        {work.kind === 'underway' ? (
          <p class="threat-work">
            <Icon name="tools" /> {work.queue.label} → Nv{work.queue.targetLevel} em obras: termina
            em{' '}
            <strong class="num">
              {formatCountdown(remaining(work.queue.secondsRemaining, elapsed))}
            </strong>
            .{threat.known ? null : ' Até lá, ninguém vê.'}
          </p>
        ) : null}
        {work.kind === 'available' ? (
          <>
            {/* Custo e benefício lado a lado: o que a obra dá vem logo acima. */}
            <p class="muted threat-terms">{watchtowerTerms(work.upgrade)}</p>
            {work.plan !== null ? (
              <p class="muted threat-terms">{watchtowerPlanLine(work.plan, elapsed)}</p>
            ) : null}
            {/* O que impede a obra, na frase do servidor: o botão desabilitado nunca fica mudo. */}
            {work.upgrade.blockedReason !== null ? (
              <p class="blocked">
                <Icon name="lock" /> {work.upgrade.blockedReason}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      {work.kind === 'available' ? (
        <button
          type="button"
          disabled={disabled || work.upgrade.blockedReason !== null}
          // O botão é descrito pelo que a obra dá, pelo custo e, travada, pelo motivo.
          aria-describedby="threat-tower-terms"
          onClick={() => actions.run('lords.build', watchtower.building)}
        >
          {isNewBuilding(work.upgrade) ? 'Construir' : 'Melhorar'} {work.upgrade.label}
        </button>
      ) : null}
    </div>
  );
}

/**
 * O que os vigias veem (GDD §8.2): o número de 0 ao máximo, com a barra; para onde ele vai na
 * próxima virada do dia, com o prazo; de onde vem a subida, termo a termo; os tiles conhecidos; e
 * a incursão à vista, quando há uma. A subida leva seta e verbo; a incursão, ícone e texto: nada é
 * dito só pela cor.
 */
function Watched(props: { threat: WatchedThreat; elapsed: number }) {
  const { threat, elapsed } = props;
  const { incoming } = threat;
  const rising = threatRising(threat);
  return (
    <>
      <p class="threat-now">
        <Icon name={THREAT_ICON} /> <strong>{threat.text}</strong>
      </p>
      <progress
        max={threat.max}
        value={threat.level}
        aria-label={`Ameaça: ${formatNumber(threat.level)} de ${formatNumber(threat.max)}`}
      />
      <p class="threat-trend">
        <span class={rising ? 'warning' : 'muted'}>
          <Icon name={rising ? 'arrow-up' : 'dash'} />
        </span>{' '}
        {threat.trend}
        {rising ? (
          <span class="muted">
            {' '}
            Faltam{' '}
            <span class="num">{formatCountdown(remaining(threat.nextRiseInSeconds, elapsed))}</span>
            .
          </span>
        ) : null}
      </p>
      {threat.sources.length > 0 ? (
        <ul class="threat-sources" aria-label="De onde vem a subida da Ameaça">
          {threat.sources.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
      ) : null}
      {/* Sem a Torre, "ninguém sabe o que ronda o feudo"; com ela, a mesma frase tem resposta. */}
      {threat.tiles.length > 0 ? (
        <p class="threat-tiles">O que ronda o feudo: {threat.tiles.map(tileLine).join('; ')}.</p>
      ) : null}
      {incoming === null ? (
        <p class="muted hint">Os vigias não avistam nenhuma incursão agora.</p>
      ) : (
        <div class="banner banner-warning threat-incoming">
          <div>
            {/* Só a frase é região viva: a contagem muda a cada segundo e fica fora dela. */}
            <span role="status">
              <Icon name={RAID_ICON} /> <strong>{incoming.text}</strong>
            </span>{' '}
            Chegada em{' '}
            <strong class="num">{formatCountdown(remaining(incoming.inSeconds, elapsed))}</strong>.
          </div>
        </div>
      )}
    </>
  );
}

/**
 * O painel "Ameaça" da aba Feudo (GDD §8.2 e §13.3). A Torre de Vigia compra informação: sem
 * ela, o painel diz que ninguém sabe o que ronda o feudo e põe a obra da Torre ao lado, com o
 * custo; com ela, mostra o número, a tendência, as origens e o que os vigias avistam. Nos dois
 * casos fecha com o que protege o feudo de um ataque. O app não escreve número nem regra: confere
 * `threat.known` e dispõe o que veio. Sem a Torre o número nem chega do servidor.
 */
export function ThreatPanel(props: {
  view: ViewState;
  /** Segundos desde que a visão chegou, para as contagens regressivas locais. */
  elapsed: number;
  disabled: boolean;
  actions: Actions;
}) {
  const { view, elapsed } = props;
  const { threat } = view;
  return (
    <section aria-labelledby="threat-title">
      <h2 id="threat-title">Ameaça</h2>
      {threat.known ? (
        <Watched threat={threat} elapsed={elapsed} />
      ) : (
        <p class="threat-now">
          <Icon name={threatIcon(threat)} /> {threat.text}
        </p>
      )}
      <Watchtower view={view} elapsed={elapsed} disabled={props.disabled} actions={props.actions} />
      <p class="threat-defense">
        <Icon name={DEFENSE_ICON} /> {threat.defense.text}
      </p>
    </section>
  );
}
