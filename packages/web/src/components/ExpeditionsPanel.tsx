import type { ViewState } from '@lotg/protocol';
import { useState } from 'preact/hooks';

import {
  blockedReason,
  canSend,
  defaultPosture,
  defaultTeam,
  type Destination,
  domId,
  durationLine,
  eligibleHeroes,
  type Expedition,
  EXPEDITION_ICON,
  EXPEDITIONS_ANCHOR,
  expeditionsOwnText,
  type Guild,
  heroFitPower,
  type Posture,
  REPORTS_ANCHOR,
  sendArg,
  stretchEnds,
  teamFit,
  teamFits,
  teamLine,
  teamSize,
} from '../ui/expeditions';
import { isNewBuilding } from '../ui/format';
import { GUILD_ICON, sheetLine } from '../ui/guild';
import { workTerms } from '../ui/threat';
import type { Actions } from './actions';
import { CrossroadsCard } from './CrossroadsCard';
import { ExpeditionReport, Step } from './ExpeditionReport';
import { formatNumber } from './format';
import { Icon } from './shared';

/**
 * A Guilda dos Aventureiros ainda por erguer: a obra dela, com o custo, o prazo e o que a
 * impede, ao lado da frase do servidor que diz o que a abre. A obra é a da lista de construções.
 */
function Raise(props: { view: ViewState; disabled: boolean; actions: Actions }) {
  const { building } = props.view.guild;
  const upgrade = props.view.constructions.available.find((entry) => entry.building === building);
  if (upgrade === undefined) {
    return null;
  }
  return (
    <div class="banner tavern-raise">
      <div id="guild-raise-terms">
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
        aria-describedby="guild-raise-terms"
        onClick={() => props.actions.run('lords.build', upgrade.building)}
      >
        {isNewBuilding(upgrade) ? 'Construir' : 'Melhorar'} {upgrade.label}
      </button>
    </div>
  );
}

/**
 * Uma equipe fora do feudo (GDD §9.2): quem foi e com que Postura, onde está, na frase do
 * servidor, e em quanto tempo o trecho de agora termina. O que já aconteceu fica recolhido,
 * passo a passo, como no relatório. Parada na encruzilhada, a folha da escolha vem logo abaixo.
 */
function Ongoing(props: {
  expedition: Expedition;
  elapsed: number;
  disabled: boolean;
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { expedition, elapsed } = props;
  const ends = stretchEnds(expedition, elapsed);
  return (
    <li class="expedition" data-expedition={expedition.id}>
      <p class="hero-name">
        <Icon name={EXPEDITION_ICON} /> <strong>{expedition.label}</strong> ·{' '}
        {teamLine(expedition.teamNames)} · Postura {expedition.postureLabel}
      </p>
      <p class="hero-sheet muted">
        {expedition.statusText}
        {ends === null ? null : <span class="num"> {ends}</span>}
      </p>
      {expedition.log.length === 0 ? null : (
        <details class="expedition-log">
          <summary>O que já aconteceu ({expedition.log.length})</summary>
          <ol class="report-steps" aria-label={`O percurso de ${expedition.label} até agora`}>
            {expedition.log.map((step, index) => (
              <Step key={`${index}:${step.title}`} step={step} />
            ))}
          </ol>
        </details>
      )}
      <CrossroadsCard
        expedition={expedition}
        elapsed={elapsed}
        readOnly={props.disabled}
        choosing={props.busy.has(`path:${expedition.id}`)}
        actions={props.actions}
      />
    </li>
  );
}

/**
 * A montagem de um envio (GDD §9.2 e §13.6): quem vai, com o que cada um vale contra o primeiro
 * trecho, e a Postura, com o que cada uma faz na encruzilhada, na frase do servidor. A régua da
 * equipe marcada fica ao lado do botão: custo e benefício lado a lado, antes do clique. A
 * equipe mínima e a Postura do meio já vêm marcadas: enviar é abrir e confirmar.
 *
 * O que está marcado é estado desta tela, não do jogo: a ordem só nasce no botão, pelo comando
 * `lords.sendExpedition`, com o destino, a equipe e a Postura.
 */
function SendForm(props: {
  guild: Guild;
  destination: Destination;
  disabled: boolean;
  busy: boolean;
  actions: Actions;
}) {
  const { guild, destination } = props;
  const eligible = eligibleHeroes(guild, destination);
  // `null` enquanto o jogador não mexeu nas caixas: vale a equipe que a visão sugere **agora**
  // (a montagem atravessa as leituras, e a sugestão muda quando alguém parte ou volta).
  const [picked, setPicked] = useState<string[] | null>(null);
  const [posture, setPosture] = useState<Posture['id'] | undefined>(() =>
    defaultPosture(guild.postures),
  );
  // Depois que ele mexeu, vale o que marcou; quem deixou de poder partir (saiu, feriu-se) com
  // a tela aberta já não está na equipe.
  const team = (picked ?? defaultTeam(destination)).filter((heroId) =>
    eligible.some((hero) => hero.id === heroId),
  );
  const fits = teamFits(destination, team.length);
  const fit = teamFit(destination, team);
  const name = domId('send', destination.modelId);
  const toggle = (heroId: string, checked: boolean) =>
    setPicked(checked ? [...team, heroId] : team.filter((entry) => entry !== heroId));
  return (
    <details class="send-form">
      <summary>Montar a equipe</summary>
      <fieldset class="choice" disabled={props.disabled || props.busy}>
        <legend>Quem vai ({teamSize(destination)})</legend>
        {eligible.map((hero) => {
          const power = heroFitPower(destination, hero.id);
          const line = `${name}-${hero.id}-line`;
          const about = `${name}-${hero.id}-about`;
          return (
            <label key={hero.id} class="choice-option">
              <input
                type="checkbox"
                data-hero={hero.id}
                checked={team.includes(hero.id)}
                aria-labelledby={line}
                aria-describedby={about}
                onChange={(event) => toggle(hero.id, event.currentTarget.checked)}
              />
              <span id={line}>
                {hero.name} · {sheetLine(hero)}
              </span>
              <span id={about} class="choice-about muted">
                {power === null
                  ? `Poder ${formatNumber(hero.power)}`
                  : `Vale ${formatNumber(power)} contra o primeiro trecho`}
              </span>
            </label>
          );
        })}
      </fieldset>
      <fieldset
        class="choice"
        role="radiogroup"
        aria-labelledby={`${name}-posture`}
        disabled={props.disabled || props.busy}
      >
        <legend id={`${name}-posture`}>Postura</legend>
        {guild.postures.map((entry) => (
          <label key={entry.id} class="choice-option">
            <input
              type="radio"
              data-posture={entry.id}
              name={`${name}-posture`}
              value={entry.id}
              checked={entry.id === posture}
              aria-labelledby={`${name}-posture-${entry.id}-line`}
              aria-describedby={`${name}-posture-${entry.id}-about`}
              onChange={() => setPosture(entry.id)}
            />
            <span id={`${name}-posture-${entry.id}-line`}>{entry.label}</span>
            <span id={`${name}-posture-${entry.id}-about`} class="choice-about muted">
              {entry.text}
            </span>
          </label>
        ))}
      </fieldset>
      <div class="send-foot">
        <div id={`${name}-terms`}>
          {fit === null ? null : (
            <p class={fit.level === 'risk' ? 'team-fit warning' : 'team-fit'}>
              <Icon name={fit.icon} /> <strong>{fit.label}.</strong> {fit.worth}
            </p>
          )}
          {fits ? null : (
            <p class="blocked">
              <Icon name="lock" /> A equipe deste destino leva {teamSize(destination)}.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={props.disabled || props.busy || !fits || posture === undefined}
          aria-describedby={`${name}-terms ${name}-about`}
          onClick={() =>
            props.actions.run('lords.sendExpedition', sendArg(destination, team, posture))
          }
        >
          Enviar<span class="sr-only"> expedição: {destination.label}</span>
        </button>
      </div>
    </details>
  );
}

/**
 * Um destino que a Guilda conhece (ADR 0018, decisão 13): o risco em palavra, a duração real, o
 * que a equipe precisa ter, o que se vê do primeiro trecho e a régua dele, tudo nas frases e
 * nos números do servidor. Quando nenhuma equipe do feudo pode partir (o lugar na Guilda, a
 * gente que falta, a classe que falta), a linha diz o motivo do servidor, com cadeado, em vez de
 * oferecer o envio: quem sabe se há equipe é a visão (`canSend`), não uma contagem daqui. O que
 * vem depois da primeira encruzilhada não está aqui: não sai do servidor.
 */
function DestinationRow(props: {
  guild: Guild;
  destination: Destination;
  disabled: boolean;
  busy: boolean;
  actions: Actions;
}) {
  const { guild, destination } = props;
  const about = domId('send', destination.modelId, 'about');
  const open = canSend(destination);
  return (
    <li class="destination" data-destination={destination.modelId} aria-busy={props.busy}>
      <p class="hero-name">
        <Icon name={destination.rescue ? 'heart' : 'location'} />{' '}
        <strong>{destination.label}</strong> · Risco: {destination.riskText.toLowerCase()} ·{' '}
        <span class="num">{durationLine(destination)}</span>
      </p>
      <div id={about} class="hero-sheet">
        <p>
          {destination.requirementsText} {destination.firstStretchText}
        </p>
        {destination.fit === null ? null : <p class="muted">{destination.fit.text}</p>}
        {destination.durationNote === '' ? null : <p class="muted">{destination.durationNote}</p>}
      </div>
      {open ? (
        <SendForm
          guild={guild}
          destination={destination}
          disabled={props.disabled}
          busy={props.busy}
          actions={props.actions}
        />
      ) : (
        <p class="blocked">
          <Icon name="lock" /> {blockedReason(destination)}
        </p>
      )}
    </li>
  );
}

/**
 * O painel "Expedições" da aba Guilda (GDD §9.2 a §9.4): a situação em uma frase do servidor;
 * sem a Guilda dos Aventureiros, a obra dela; com ela, primeiro as equipes fora do feudo (a que
 * espera na encruzilhada traz a folha da escolha), depois os destinos, cada um com o envio
 * recolhido. O destino que ainda não foi descoberto não aparece: não vem na visão.
 */
export function ExpeditionsPanel(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  /** As ordens da Guilda a caminho do servidor (`controller.guildOrders`). */
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { view, elapsed } = props;
  const { guild } = view;
  return (
    <section aria-labelledby={EXPEDITIONS_ANCHOR}>
      <h2 id={EXPEDITIONS_ANCHOR} tabIndex={-1}>
        Expedições
      </h2>
      {/*
        A frase do servidor fala das expedições quando há equipe e a Guilda dos Aventureiros
        está de pé; antes disso ela fala da equipe, e quem a mostra é o painel dos heróis.
      */}
      {expeditionsOwnText(guild) ? (
        <p class="tavern-now">
          <Icon name={GUILD_ICON} /> {guild.text}
        </p>
      ) : null}
      {guild.built ? null : <Raise view={view} disabled={props.disabled} actions={props.actions} />}
      {guild.expeditions.length === 0 ? null : (
        <ul class="heroes" aria-label="Fora do feudo">
          {guild.expeditions.map((expedition) => (
            <Ongoing
              key={expedition.id}
              expedition={expedition}
              elapsed={elapsed}
              disabled={props.disabled}
              busy={props.busy}
              actions={props.actions}
            />
          ))}
        </ul>
      )}
      {guild.available.length === 0 ? null : (
        <>
          <h3 class="guild-sub">Destinos</h3>
          <ul class="heroes" aria-label="Destinos">
            {guild.available.map((destination) => (
              <DestinationRow
                // A chave é só o destino: a montagem aberta (quem está marcado, a Postura)
                // atravessa as leituras. Quem deixa de poder partir sai da equipe marcada
                // sozinho; quem passa a poder aparece, sem marca.
                key={destination.modelId}
                guild={guild}
                destination={destination}
                disabled={props.disabled}
                busy={props.busy.has(`send:${destination.modelId}`)}
                actions={props.actions}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * O painel "Relatórios" (GDD §9.4): as últimas jornadas que voltaram, da mais nova à mais
 * antiga, cada uma recolhida em uma linha. A mais nova, e a que o jogador pediu para ver (pela
 * Crônica ou pelo aviso da volta), vêm abertas. Sem nenhuma, o painel não aparece.
 */
export function ReportsPanel(props: { view: ViewState; focused: string | null }) {
  const { reports } = props.view.guild;
  if (reports.length === 0) {
    return null;
  }
  const focusedKept = reports.some((report) => report.expeditionId === props.focused);
  return (
    <section aria-labelledby={REPORTS_ANCHOR}>
      <h2 id={REPORTS_ANCHOR} tabIndex={-1}>
        Relatórios
      </h2>
      <ul class="expedition-reports" aria-label="Relatórios das expedições">
        {reports.map((report, index) => (
          <ExpeditionReport
            key={report.expeditionId}
            report={report}
            open={focusedKept ? report.expeditionId === props.focused : index === 0}
          />
        ))}
      </ul>
    </section>
  );
}
