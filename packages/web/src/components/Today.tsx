import type { ReturnReport, ReturnReportItem, ViewState } from '@lotg/protocol';
import type { ComponentChildren } from 'preact';

import { beforeLeaving, leavingItems, type LeavingSeverity } from '../game/beforeLeaving';
import { coveredTopics, currentBlocks } from '../game/returnReport';
import { cardDeadline, expiresSoon, nextAudience } from '../ui/council';
import { moraleBurdened, moraleIcon, moraleSince } from '../ui/morale';
import type { Actions } from './actions';
import { formatAway, formatNumber, formatSigned } from './format';
import { Icon } from './shared';

/** Uma casa decimal: a soma de duas parcelas não mostra ruído de ponto flutuante. */
const tidy = (value: number) => Math.round(value * 10) / 10;

/** Uma parcela da conta: o número com sinal, ou um traço quando não houve nada. */
const part = (value: number, sign: 1 | -1) => (value === 0 ? '—' : formatSigned(sign * value));

/**
 * A moral no Relatório de Retorno (GDD §5.7): a faixa em que o feudo está e de onde ela veio.
 * Quem chegou e quem se foi está nos blocos, logo abaixo. Quando houve perda, a moral caiu ou
 * algo ainda pesa nela, o conselho do servidor (o que mais pesa e o que fazer) vem junto, com o
 * caminho para a conta inteira: nenhuma perda fica sem saída.
 */
function MoraleReport(props: { report: ReturnReport; view: ViewState; actions: Actions }) {
  const { morale, counts } = props.report;
  if (morale === undefined) {
    return null;
  }
  const lost = (counts.villagersLeft ?? 0) + (counts.villagersDeserted ?? 0) > 0;
  const fell = morale.before !== undefined && morale.value < morale.before.value;
  const { advice } = props.view.morale;
  const advise = advice !== null && (lost || fell || moraleBurdened(props.view.morale));
  return (
    <div class="morale-report">
      <p>
        <span class={fell ? 'warning' : undefined}>
          <Icon name={moraleIcon(morale.band)} />
        </span>{' '}
        {moraleSince(morale)}
      </p>
      {advise ? (
        <p>
          {advice}{' '}
          <button
            type="button"
            class="link"
            onClick={() => props.actions.run('lords.openPanel', 'fief')}
          >
            Ver a moral
          </button>
        </p>
      ) : null}
    </div>
  );
}

/**
 * A urgência de um item de "Antes de partir" nunca é dita só pela cor: cada grau tem o seu
 * ícone e, para quem não vê o ícone, uma palavra antes da frase.
 */
const SEVERITY: Record<LeavingSeverity, { icon: string; word: string }> = {
  danger: { icon: 'error', word: 'Urgente' },
  warning: { icon: 'warning', word: 'Atenção' },
  info: { icon: 'info', word: 'Sugestão' },
};

/**
 * Um bloco do Relatório de Retorno (roadmap da v0.2, V2D-T4): o título com o ícone e a contagem,
 * e uma linha por item. O item que pede ação tem o desenho dos de "Antes de partir": o ícone e a
 * palavra da urgência, a frase e o botão ao lado, descrito pela frase para quem usa leitor de
 * tela (há mais de um "Decidir" na mesma lista). O que só conta uma boa notícia é uma linha de
 * texto. Sem ligação, os botões que dão ordens ficam desabilitados; o que navega continua.
 */
function ReportBlock(props: {
  id: string;
  icon: string;
  title: string;
  items: ReturnReportItem[];
  /** O que dizer quando o bloco está vazio: um bloco vazio também é notícia. */
  empty: ComponentChildren;
  online: boolean;
  actions: Actions;
}) {
  const { id, items } = props;
  return (
    <section class={`report-block report-${id}`} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>
        <Icon name={props.icon} /> {props.title}
        {items.length === 0 ? '' : ` (${items.length})`}
      </h3>
      {items.length === 0 ? (
        <p class="muted">{props.empty}</p>
      ) : (
        <ul class="report-items">
          {items.map((item, index) => {
            const { action } = item;
            if (action === undefined) {
              return (
                <li key={index} class="report-line">
                  {item.text}
                </li>
              );
            }
            // Sem urgência a dizer (a carta com prazo folgado), o ícone é o do assunto, sem a
            // palavra: "Sugestão" não é o que uma carta do conselho é.
            const severity = item.severity === undefined ? null : SEVERITY[item.severity];
            const line = `${id}-item-${index}`;
            return (
              <li key={index} class={`leaving-item leaving-${item.severity ?? 'info'}`}>
                <p id={line}>
                  <Icon name={severity?.icon ?? 'law'} />{' '}
                  {severity === null ? null : <span class="sr-only">{severity.word}: </span>}
                  {item.text}
                </p>
                <button
                  type="button"
                  class="secondary"
                  aria-describedby={line}
                  disabled={!props.online && action.command !== 'lords.openPanel'}
                  onClick={() => props.actions.run(action.command, action.arg)}
                >
                  {action.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * "Antes de partir" (GDD §2.3, passo 4): em até cinco linhas, o que vale resolver antes de
 * fechar a aba, cada uma com o botão que resolve. Quem escolhe os itens e escreve as frases é
 * `beforeLeaving`, só com o que o servidor mandou; aqui eles são desenhados. Sem ligação, os
 * botões que dão ordens ficam desabilitados, como no feudo; o que só navega continua valendo.
 *
 * Sem ligação a visão é a guardada, que pode ter horas: a seção diz que fala do último estado
 * conhecido, e a lista vazia não vira a garantia de que o feudo está preparado. Vazio e sem
 * ligação são estados diferentes, com frases e ícones diferentes.
 */
function BeforeLeaving(props: {
  view: ViewState;
  online: boolean;
  actions: Actions;
  /** Os assuntos que o Relatório de Retorno, logo acima, já trouxe com o botão que resolve. */
  skip?: readonly string[];
}) {
  const skip = props.skip ?? [];
  const items = beforeLeaving(props.view, skip);
  // Tudo o que havia a preparar já está no relatório: a seção não diz "preparado" à toa.
  const reported = items.length === 0 && leavingItems(props.view).length > 0;
  return (
    <section aria-labelledby="leaving-title">
      <h2 id="leaving-title">Antes de partir</h2>
      {items.length > 0 ? null : reported ? (
        <p class="muted">
          <Icon name="arrow-up" /> O que há a preparar já está no relatório, com o botão que
          resolve.
        </p>
      ) : props.online ? (
        <p class="leaving-ready">
          <Icon name="pass" /> O feudo está preparado para a sua ausência.
        </p>
      ) : (
        <p class="leaving-stale">
          <Icon name="debug-disconnect" /> Sem ligação com o reino: este é o último estado conhecido
          do feudo. Nele não havia nada a preparar; confira de novo quando a ligação voltar.
        </p>
      )}
      {items.length === 0 ? null : (
        <>
          <p class="muted hint">
            {props.online
              ? 'O que vale resolver antes de sair, do mais urgente ao menos.'
              : 'Sem ligação com o reino: a lista e os prazos são os do último estado conhecido do feudo.'}
          </p>
          <ul class="leaving">
            {items.map((item) => (
              <li key={item.id} class={`leaving-item leaving-${item.severity}`}>
                <p>
                  <Icon name={SEVERITY[item.severity].icon} />{' '}
                  <span class="sr-only">{SEVERITY[item.severity].word}: </span>
                  {item.text}
                </p>
                <button
                  type="button"
                  class="secondary"
                  disabled={!props.online && item.command.id !== 'lords.openPanel'}
                  onClick={() => props.actions.run(item.command.id, item.command.arg)}
                >
                  {item.command.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * "Decisões pendentes" (GDD §2.3, passo 2, e §13.3): uma linha por carta do Conselho à espera,
 * da que vence primeiro à que vence por último (é a ordem em que a visão as traz), com o prazo
 * em tempo real e o botão "Decidir", que leva à aba do Conselho, onde a carta se lê inteira. O
 * prazo que acaba antes de uma ausência comum ganha o sinal de aviso, com ícone e palavra.
 *
 * Sem nenhuma, a seção diz quando o conselho volta a se reunir, na frase do servidor. Sem
 * ligação, avisa que as cartas e os prazos são os do último estado conhecido.
 */
function PendingDecisions(props: {
  view: ViewState;
  elapsed: number;
  online: boolean;
  actions: Actions;
}) {
  const { view, elapsed } = props;
  const decisions = view.pendingDecisions;
  return (
    <section aria-labelledby="decisions-title">
      <h2 id="decisions-title">
        Decisões pendentes{decisions.length === 0 ? '' : ` (${decisions.length})`}
      </h2>
      {decisions.length === 0 ? (
        <p class="muted">
          Nenhuma por agora. {nextAudience(view.council, elapsed)}{' '}
          <button
            type="button"
            class="link"
            onClick={() => props.actions.run('lords.openPanel', 'council')}
          >
            Ver o Conselho
          </button>
        </p>
      ) : (
        <>
          {props.online ? null : (
            <p class="muted hint">
              Sem ligação com o reino: as cartas e os prazos são os do último estado conhecido do
              feudo.
            </p>
          )}
          <ul class="decisions">
            {decisions.map((decision) => {
              const soon = expiresSoon(decision, elapsed);
              return (
                <li
                  key={decision.id}
                  class={soon ? 'leaving-item leaving-warning' : 'leaving-item leaving-info'}
                >
                  <p>
                    <Icon name={soon ? 'warning' : 'law'} />{' '}
                    {soon ? <span class="sr-only">Atenção: </span> : null}
                    Conselho: “{decision.title}” ·{' '}
                    <span class="decision-deadline">{cardDeadline(decision, elapsed)}</span>
                  </p>
                  <button
                    type="button"
                    aria-label={`Decidir: ${decision.title}`}
                    onClick={() => props.actions.run('lords.openPanel', 'council')}
                  >
                    Decidir
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** A variação de estoque da ausência, parcela por parcela: antes + produção − gasto + recebido − perdido = agora. */
function StockTable(props: { rows: ReturnReport['resources'] }) {
  return (
    <>
      <h3 id="stock-title">
        <Icon name="package" /> O saldo dos estoques
      </h3>
      {/*
       * A variação de estoque não é produção: a conta fica aberta, parcela por parcela.
       * Antes + produção − gasto + recebido − perdido = agora.
       */}
      <table class="resources report" aria-labelledby="stock-title">
        <thead>
          <tr>
            <th scope="col">Recurso</th>
            <th scope="col" class="num">
              Antes
            </th>
            <th scope="col" class="num">
              Produção
            </th>
            <th scope="col" class="num">
              Gasto
            </th>
            <th scope="col" class="num">
              Recebido
            </th>
            <th scope="col" class="num">
              Perdido
            </th>
            <th scope="col" class="num">
              Agora
            </th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => {
            const wasted = row.wasted ?? 0;
            // O que uma recompensa ou uma devolução perdeu por não caber: entra em
            // Recebido, que mostra o ganho inteiro, e já está no Perdido.
            const cut = row.cut ?? 0;
            // O que o feudo rendeu, já descontado o consumo: o que entrou no estoque
            // mais a produção que não coube. Assim a perda aparece como perda, e não
            // como produção que não houve; e o corte de uma recompensa, que nunca foi
            // produção, não entra aqui.
            const yielded = tidy((row.produced ?? row.delta) + Math.max(0, wasted - cut));
            return (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td class="num">{formatNumber(row.before)}</td>
                <td class={`num ${yielded < 0 ? 'negative' : ''}`}>{formatSigned(yielded)}</td>
                <td class="num">{part(row.spent ?? 0, -1)}</td>
                <td class="num">{part(tidy((row.received ?? 0) + cut), 1)}</td>
                <td class={`num ${wasted > 0 ? 'warning' : ''}`}>{part(wasted, -1)}</td>
                <td class="num">{formatNumber(row.after)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="muted hint">
        Produção já desconta o que o feudo consumiu. Gasto e recebido vêm das ordens e dos
        acontecimentos da ausência. Perdido é o que não coube no depósito e foi ao chão, da produção
        ou de uma recompensa.
      </p>
    </>
  );
}

/**
 * O Relatório de Retorno (GDD §2.3, passo 1; roadmap da v0.2, V2D-T4): a ausência em uma leitura.
 * Primeiro o tempo fora e a moral; depois os três blocos, "O feudo prosperou", "O que exigiu um
 * preço" (cada perda com a próxima ação) e "Você ainda pode decidir"; por fim a conta dos
 * estoques e, para quem quer tudo, as linhas da Crônica da ausência, recolhidas.
 *
 * O que prosperou e o que custou são da ausência. O que ainda espera decisão e os botões das
 * perdas acompanham a visão de agora (`currentBlocks`): a carta respondida sai da lista.
 */
function Report(props: {
  report: ReturnReport;
  blocks: ReturnType<typeof currentBlocks>;
  view: ViewState;
  elapsed: number;
  online: boolean;
  actions: Actions;
}) {
  const { report, blocks, view, online, actions } = props;
  const lines = report.highlights.length;
  return (
    <>
      <p>
        Você esteve fora por <strong>{formatAway(report.awaySeconds)}</strong>. O mundo andou{' '}
        {report.counts.daysPassed} {report.counts.daysPassed === 1 ? 'dia de jogo' : 'dias de jogo'}
        .
      </p>
      <MoraleReport report={report} view={view} actions={actions} />
      <ReportBlock
        id="prospered"
        icon="pass"
        title="O feudo prosperou"
        items={blocks.prospered}
        empty="Nenhuma obra terminou e ninguém chegou desta vez."
        online={online}
        actions={actions}
      />
      <ReportBlock
        id="cost"
        icon="warning"
        title="O que exigiu um preço"
        items={blocks.cost}
        empty="Nada: a sua ausência não custou nada ao feudo."
        online={online}
        actions={actions}
      />
      <ReportBlock
        id="pending"
        icon="law"
        title="Você ainda pode decidir"
        items={blocks.pending}
        empty={
          <>
            Nada espera a sua decisão agora. {nextAudience(view.council, props.elapsed)}{' '}
            <button
              type="button"
              class="link"
              onClick={() => actions.run('lords.openPanel', 'council')}
            >
              Ver o Conselho
            </button>
          </>
        }
        online={online}
        actions={actions}
      />
      {online || blocks.pending.length + blocks.cost.length === 0 ? null : (
        <p class="muted hint">
          Sem ligação com o reino: as cartas, os prazos e os botões são os do último estado
          conhecido do feudo.
        </p>
      )}
      {report.resources.length === 0 ? (
        <p class="muted report-note">
          O jogo foi atualizado desde a sua última visita. Desta vez o relatório não compara os
          estoques: conta só o que aconteceu enquanto você esteve fora.
        </p>
      ) : (
        <StockTable rows={report.resources} />
      )}
      {lines === 0 ? null : (
        <details class="report-chronicle">
          <summary>
            A Crônica da ausência ({lines} {lines === 1 ? 'linha' : 'linhas'})
          </summary>
          <ul class="chronicle">
            {report.highlights.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </details>
      )}
      <p class="report-end">
        <button type="button" class="link" onClick={() => actions.run('lords.markRead')}>
          Marcar como lido
        </button>
      </p>
    </>
  );
}

/**
 * Aba "Hoje": o Relatório de Retorno, as decisões pendentes e o que preparar antes de sair
 * (GDD §2.3). Quem volta de uma ausência lê primeiro o que aconteceu e o que ainda pode decidir:
 * com o relatório à vista, as cartas à espera estão no terceiro bloco dele, e "Antes de partir"
 * fica só com o que o relatório não trouxe. Sem relatório, as decisões pendentes abrem a aba;
 * sem nenhuma, "Antes de partir".
 */
export function Today(props: {
  report: ReturnReport | null;
  view: ViewState;
  actions: Actions;
  /** Há ligação com o servidor; sem ela, os botões que dão ordens ficam desabilitados. */
  online?: boolean;
  /** Segundos desde que a visão chegou: os prazos das cartas descem com o relógio da página. */
  elapsed?: number;
}) {
  const { report } = props;
  const online = props.online ?? true;
  const elapsed = props.elapsed ?? 0;
  const blocks = report === null ? null : currentBlocks(report, props.view, elapsed);
  const leaving = (
    <BeforeLeaving
      view={props.view}
      online={online}
      actions={props.actions}
      skip={blocks === null ? [] : coveredTopics(blocks)}
    />
  );
  const decisions = (
    <PendingDecisions view={props.view} elapsed={elapsed} online={online} actions={props.actions} />
  );
  // Uma decisão com prazo passa na frente do que preparar; a seção vazia fica no fim.
  const waiting = props.view.pendingDecisions.length > 0;
  return (
    <div class="today">
      {report === null && waiting ? decisions : null}
      {report === null ? leaving : null}
      <section aria-labelledby="report-title">
        <h2 id="report-title">Relatório de Retorno</h2>
        {report === null || blocks === null ? (
          <p class="muted">
            Nada de novo desde a sua última visita. O relatório aparece quando você volta depois de
            quatro horas ou mais.
          </p>
        ) : (
          <Report
            report={report}
            blocks={blocks}
            view={props.view}
            elapsed={elapsed}
            online={online}
            actions={props.actions}
          />
        )}
      </section>
      {report === null ? null : leaving}
      {report === null && !waiting ? decisions : null}
      <button
        type="button"
        class="primary"
        onClick={() => props.actions.run('lords.openPanel', 'fief')}
      >
        Ir para o feudo
      </button>
    </div>
  );
}
