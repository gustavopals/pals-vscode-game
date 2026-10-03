import type { ViewState } from '@lotg/protocol';

import { isNewBuilding } from '../ui/format';
import {
  DEFENSE_ICON,
  type DefenseWork,
  palisadeRace,
  palisadeWork,
  RAID_ICON,
  THREAT_ANCHOR,
  THREAT_ICON,
  threatIcon,
  threatRising,
  tileLine,
  type WatchedThreat,
  watchtowerWork,
  workPlanLine,
  workTerms,
} from '../ui/threat';
import type { Actions } from './actions';
import { formatCountdown, formatNumber, remaining } from './format';
import { Icon } from './shared';

type Upgrade = Extract<DefenseWork, { kind: 'available' }>['upgrade'];

/**
 * A obra de um dos dois edifícios da Ameaça, como texto: em uma fila, a contagem regressiva; à
 * espera de uma ordem, o custo e o prazo, a espera da planejada e, travada, o motivo do servidor
 * em uma linha própria, com cadeado. Custo e benefício ficam lado a lado: o que a obra dá vem
 * logo acima, na frase do servidor.
 */
function WorkTerms(props: {
  work: DefenseWork;
  elapsed: number;
  /** O que dizer depois da contagem de uma obra em curso ("Até lá, ninguém vê."). */
  underwayNote?: string | null;
  /** O prazo da obra ao lado de outro prazo que importa (o do ataque que vem). */
  race?: string | null;
}) {
  const { work, elapsed } = props;
  if (work.kind === 'underway') {
    return (
      <p class="threat-work">
        <Icon name="tools" /> {work.queue.label} → Nv{work.queue.targetLevel} em obras: termina em{' '}
        <strong class="num">
          {formatCountdown(remaining(work.queue.secondsRemaining, elapsed))}
        </strong>
        .{props.underwayNote == null ? null : ` ${props.underwayNote}`}
      </p>
    );
  }
  if (work.kind === 'none') {
    return null;
  }
  return (
    <>
      <p class="muted threat-terms">{workTerms(work.upgrade)}</p>
      {work.plan !== null ? (
        <p class="muted threat-terms">{workPlanLine(work.plan, elapsed)}</p>
      ) : null}
      {props.race == null ? null : <p class="threat-terms">{props.race}</p>}
      {/* O que impede a obra, na frase do servidor: o botão desabilitado nunca fica mudo. */}
      {work.upgrade.blockedReason !== null ? (
        <p class="blocked">
          <Icon name="lock" /> {work.upgrade.blockedReason}
        </p>
      ) : null}
    </>
  );
}

/** O botão que ordena a obra: "Construir" o que ainda não existe, "Melhorar" o que já existe. */
function WorkButton(props: {
  upgrade: Upgrade;
  /** O que descreve o botão: o que a obra dá, o custo e, travada, o motivo. */
  describedBy: string;
  disabled: boolean;
  actions: Actions;
}) {
  const { upgrade } = props;
  return (
    <button
      type="button"
      disabled={props.disabled || upgrade.blockedReason !== null}
      aria-describedby={props.describedBy}
      // Construir e melhorar são a mesma ordem: `startConstruction`, com o edifício da visão.
      onClick={() => props.actions.run('lords.build', upgrade.building)}
    >
      {isNewBuilding(upgrade) ? 'Construir' : 'Melhorar'} {upgrade.label}
    </button>
  );
}

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
  const { view, elapsed } = props;
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
        <WorkTerms
          work={work}
          elapsed={elapsed}
          underwayNote={threat.known ? null : 'Até lá, ninguém vê.'}
        />
      </div>
      {work.kind === 'available' ? (
        <WorkButton
          upgrade={work.upgrade}
          describedBy="threat-tower-terms"
          disabled={props.disabled}
          actions={props.actions}
        />
      ) : null}
    </div>
  );
}

/**
 * A defesa, com a ação ao lado (GDD §8.2 e §12.3): o que protege o feudo hoje, o que a próxima
 * obra da Paliçada passa a segurar, quanto ela custa e leva, e o botão que a ordena. Quem tem a
 * Torre lê ali mesmo o que cada tamanho de ataque custa a um feudo sem defesa: o preço da obra
 * fica ao lado do preço de não fazê-la. Com um ataque à vista essa lista sai (o aviso, logo
 * acima, já diz o que este ataque custa), e o prazo da obra fica ao lado do prazo dele. A
 * Paliçada é conhecida com ou sem Torre: a caixa aparece nos dois casos. No teto desta versão
 * não há obra, e a frase do servidor diz por quê.
 */
function Defense(props: { view: ViewState; elapsed: number; disabled: boolean; actions: Actions }) {
  const { view, elapsed } = props;
  const { threat } = view;
  const { defense } = threat;
  const work = palisadeWork(view);
  const costs = threat.known && threat.incoming === null ? threat.raidCosts : [];
  return (
    <div class="banner threat-defense">
      <div id="threat-defense-terms">
        <p>
          <Icon name={DEFENSE_ICON} /> {defense.text}
        </p>
        {defense.next !== null ? <p>{defense.next}</p> : null}
        {costs.length > 0 ? (
          <ul class="threat-costs" aria-label="O que um ataque custa a um feudo sem defesa">
            {costs.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <WorkTerms
          work={work}
          elapsed={elapsed}
          // Só para a obra que pode começar agora: travada, o que importa é o motivo.
          race={
            work.kind === 'available' && work.upgrade.blockedReason === null
              ? palisadeRace(view, work.upgrade, elapsed, formatCountdown)
              : null
          }
        />
      </div>
      {work.kind === 'available' ? (
        <WorkButton
          upgrade={work.upgrade}
          describedBy="threat-defense-terms"
          disabled={props.disabled}
          actions={props.actions}
        />
      ) : null}
    </div>
  );
}

/**
 * O que os vigias veem (GDD §8.2): o número de 0 ao máximo, com a barra; para onde ele vai na
 * próxima virada do dia, com o prazo; de onde vem a subida, termo a termo; os tiles conhecidos;
 * a chance de a próxima virada marcar uma incursão; e a incursão à vista, quando há uma, com o
 * que ela custa a um feudo sem defesa e o que a Paliçada faz a ela. A subida leva seta e verbo;
 * a incursão, ícone e texto: nada é dito só pela cor.
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
      {/* Com a incursão à vista, o aviso já diz o que vem: a linha dos tiles sai para o aviso e a
          obra da defesa caberem juntos na tela em janela baixa. */}
      {threat.tiles.length > 0 && incoming === null ? (
        <p class="threat-tiles">O que ronda o feudo: {threat.tiles.map(tileLine).join('; ')}.</p>
      ) : null}
      {incoming === null ? (
        <>
          <p class="muted hint">Os vigias não avistam nenhuma incursão agora.</p>
          {/* A regra das incursões, na frase do servidor: a chance, o prazo, o tamanho, a queda. */}
          <p class="threat-risk">{threat.raidRisk}</p>
        </>
      ) : (
        <div class="banner banner-warning threat-incoming">
          <div>
            <p>
              {/* Só a frase é região viva: a contagem muda a cada segundo e fica fora dela. */}
              <span role="status">
                <Icon name={RAID_ICON} /> <strong>{incoming.text}</strong>
              </span>{' '}
              Chegada em{' '}
              <strong class="num">{formatCountdown(remaining(incoming.inSeconds, elapsed))}</strong>
              .
            </p>
            {/* O que o ataque custa ao lado do que a defesa faz a ele; a obra vem logo abaixo. */}
            <p>{incoming.costText}</p>
            <p class="threat-holds">
              <Icon name={DEFENSE_ICON} /> {incoming.defenseText}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * O painel "Ameaça" da aba Feudo (GDD §8.2 e §13.3). A Torre de Vigia compra informação: sem
 * ela, o painel diz que ninguém sabe o que ronda o feudo e põe a obra da Torre ao lado, com o
 * custo, e depois a defesa, que todo senhor conhece. Com a Torre, mostra o número, a tendência,
 * as origens e o que os vigias avistam; logo abaixo do aviso vem a defesa, com a obra da
 * Paliçada, que é o que se pode fazer a respeito, e por fim a Torre. O app não escreve número
 * nem regra: confere `threat.known` e dispõe o que veio. Sem a Torre o número nem chega do
 * servidor.
 */
export function ThreatPanel(props: {
  view: ViewState;
  /** Segundos desde que a visão chegou, para as contagens regressivas locais. */
  elapsed: number;
  disabled: boolean;
  actions: Actions;
}) {
  const { view, elapsed, disabled, actions } = props;
  const { threat } = view;
  const tower = <Watchtower view={view} elapsed={elapsed} disabled={disabled} actions={actions} />;
  const defense = <Defense view={view} elapsed={elapsed} disabled={disabled} actions={actions} />;
  return (
    <section aria-labelledby={THREAT_ANCHOR}>
      {/* O título recebe o foco quando um botão "Ver a defesa" traz o jogador até aqui. */}
      <h2 id={THREAT_ANCHOR} tabIndex={-1}>
        Ameaça
      </h2>
      {threat.known ? (
        <>
          <Watched threat={threat} elapsed={elapsed} />
          {defense}
          {/* Com a incursão à vista, a regra das incursões desce para depois da obra: o aviso e a
              Paliçada cabem juntos na tela, mesmo em janela baixa. */}
          {threat.incoming !== null ? <p class="muted threat-risk">{threat.raidRisk}</p> : null}
          {tower}
        </>
      ) : (
        <>
          <p class="threat-now">
            <Icon name={threatIcon(threat)} /> {threat.text}
          </p>
          {tower}
          {defense}
        </>
      )}
    </section>
  );
}
