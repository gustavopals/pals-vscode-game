import type { ReturnReport, ViewState } from '@lotg/protocol';

import { beforeLeaving, type LeavingSeverity } from '../game/beforeLeaving';
import { joinList } from '../ui/format';
import { moraleBurdened, moraleIcon, moraleSince, peopleMoved } from '../ui/morale';
import type { Actions } from './actions';
import { formatAway, formatNumber, formatSigned } from './format';
import { Icon } from './shared';

const FAMINE_TEXT: Record<ReturnReport['famine'], string | null> = {
  none: null,
  started: 'A comida acabou enquanto você esteve fora: a fome começou.',
  ongoing: 'A fome continua. A produção segue reduzida até a comida voltar.',
  ended: 'Houve fome na sua ausência, mas ela já acabou.',
};

type ReportRow = ReturnReport['resources'][number];

/** Uma casa decimal: a soma de duas parcelas não mostra ruído de ponto flutuante. */
const tidy = (value: number) => Math.round(value * 10) / 10;

/** Uma parcela da conta: o número com sinal, ou um traço quando não houve nada. */
const part = (value: number, sign: 1 | -1) => (value === 0 ? '—' : formatSigned(sign * value));

/** "120 de comida (Despensa), 48 de madeira (Pátio) e 20 de pedra (Pátio)". */
function wasteList(rows: ReportRow[], view: ViewState): string {
  const items = rows.map((row) => {
    // Onde o recurso fica hoje, com o nome que o servidor dá: Despensa, Celeiro, Pátio, Armazém.
    const place = view.resources.find((entry) => entry.id === row.id)?.storageLabel ?? null;
    return (
      `${formatNumber(row.wasted ?? 0)} de ${row.label.toLowerCase()}` +
      (place === null ? '' : ` (${place})`)
    );
  });
  return joinList(items);
}

/**
 * O que foi ao chão na ausência, em uma linha só, com o total de cada recurso (os fechos diários
 * do servidor somados, nunca uma linha por dia) e o caminho para resolver: no feudo, o aviso do
 * depósito traz o botão que o ergue ou amplia.
 */
function WasteLine(props: { rows: ReportRow[]; view: ViewState; actions: Actions }) {
  const wasted = props.rows.filter((row) => (row.wasted ?? 0) > 0);
  if (wasted.length === 0) {
    return null;
  }
  return (
    <p class="waste" role="status">
      <span class="warning">
        <Icon name="warning" /> Foram ao chão, por falta de espaço: {wasteList(wasted, props.view)}.
      </span>{' '}
      Ampliar o depósito ou gastar o que sobra estanca a perda.{' '}
      <button
        type="button"
        class="link"
        onClick={() => props.actions.run('lords.openPanel', 'fief')}
      >
        Ver os depósitos
      </button>
    </p>
  );
}

/**
 * A moral e a gente no Relatório de Retorno (GDD §5.6 e §5.7): a faixa em que o feudo está e de
 * onde ela veio, quem chegou sozinho, quem partiu e quem desertou, cada perda com o seu porquê.
 * Quando houve perda, a moral caiu ou algo ainda pesa nela, o conselho do servidor (o que mais
 * pesa e o que fazer) vem junto, com o caminho para a conta inteira: nenhuma perda fica sem saída.
 */
function MoraleReport(props: { report: ReturnReport; view: ViewState; actions: Actions }) {
  const { morale, counts } = props.report;
  if (morale === undefined) {
    return null;
  }
  const { gained, lost } = peopleMoved(counts);
  const fell = morale.before !== undefined && morale.value < morale.before.value;
  const { advice } = props.view.morale;
  const advise = advice !== null && (lost.length > 0 || fell || moraleBurdened(props.view.morale));
  return (
    <div class="morale-report">
      <p>
        <span class={fell ? 'warning' : undefined}>
          <Icon name={moraleIcon(morale.band)} />
        </span>{' '}
        {moraleSince(morale)}
      </p>
      {gained.map((line) => (
        <p key={line}>
          <Icon name="person-add" /> {line}
        </p>
      ))}
      {lost.length > 0 ? (
        <p class="warning" role="status">
          <Icon name="sign-out" /> {lost.join(' ')}
        </p>
      ) : null}
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
 * "Antes de partir" (GDD §2.3, passo 4): em até cinco linhas, o que vale resolver antes de
 * fechar a aba, cada uma com o botão que resolve. Quem escolhe os itens e escreve as frases é
 * `beforeLeaving`, só com o que o servidor mandou; aqui eles são desenhados. Sem ligação, os
 * botões que dão ordens ficam desabilitados, como no feudo; o que só navega continua valendo.
 */
function BeforeLeaving(props: { view: ViewState; online: boolean; actions: Actions }) {
  const items = beforeLeaving(props.view);
  return (
    <section aria-labelledby="leaving-title">
      <h2 id="leaving-title">Antes de partir</h2>
      {items.length === 0 ? (
        <p class="leaving-ready">
          <Icon name="pass" /> O feudo está preparado para a sua ausência.
        </p>
      ) : (
        <>
          <p class="muted hint">O que vale resolver antes de sair, do mais urgente ao menos.</p>
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
 * Aba "Hoje": o Relatório de Retorno, o que preparar antes de sair e as decisões pendentes
 * (GDD §2.3). Quem volta de uma ausência lê primeiro o que aconteceu; sem relatório, "Antes de
 * partir" abre a aba.
 */
export function Today(props: {
  report: ReturnReport | null;
  view: ViewState;
  actions: Actions;
  /** Há ligação com o servidor; sem ela, os botões que dão ordens ficam desabilitados. */
  online?: boolean;
}) {
  const { report } = props;
  const leaving = (
    <BeforeLeaving view={props.view} online={props.online ?? true} actions={props.actions} />
  );
  return (
    <div class="today">
      {report === null ? leaving : null}
      <section aria-labelledby="report-title">
        <h2 id="report-title">Relatório de Retorno</h2>
        {report === null ? (
          <p class="muted">
            Nada de novo desde a sua última visita. O relatório aparece quando você volta depois de
            quatro horas ou mais.
          </p>
        ) : (
          <>
            <p>
              Você esteve fora por <strong>{formatAway(report.awaySeconds)}</strong>. O mundo andou{' '}
              {report.counts.daysPassed}{' '}
              {report.counts.daysPassed === 1 ? 'dia de jogo' : 'dias de jogo'}.
            </p>
            {FAMINE_TEXT[report.famine] !== null ? (
              <p class="warning" role="status">
                {FAMINE_TEXT[report.famine]}
              </p>
            ) : null}
            {report.resources.length === 0 ? (
              <p class="muted">
                O jogo foi atualizado desde a sua última visita. Desta vez o relatório não compara
                os estoques: conta só o que aconteceu enquanto você esteve fora.
              </p>
            ) : (
              <>
                {/*
                 * A variação de estoque não é produção: a conta fica aberta, parcela por parcela.
                 * Antes + produção − gasto + recebido − perdido = agora.
                 */}
                <table class="resources report">
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
                    {report.resources.map((row) => {
                      const wasted = row.wasted ?? 0;
                      // O que o feudo rendeu, já descontado o consumo: o que entrou no estoque
                      // mais o que não coube. Assim a perda aparece como perda, e não como
                      // produção que não houve.
                      const yielded = tidy((row.produced ?? row.delta) + wasted);
                      return (
                        <tr key={row.id}>
                          <th scope="row">{row.label}</th>
                          <td class="num">{formatNumber(row.before)}</td>
                          <td class={`num ${yielded < 0 ? 'negative' : ''}`}>
                            {formatSigned(yielded)}
                          </td>
                          <td class="num">{part(row.spent ?? 0, -1)}</td>
                          <td class="num">{part(row.received ?? 0, 1)}</td>
                          <td class={`num ${wasted > 0 ? 'warning' : ''}`}>{part(wasted, -1)}</td>
                          <td class="num">{formatNumber(row.after)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p class="muted hint">
                  Produção já desconta o que o feudo consumiu. Gasto e recebido vêm das ordens e dos
                  acontecimentos da ausência. Perdido é o que não coube no depósito e foi ao chão.
                </p>
                <WasteLine rows={report.resources} view={props.view} actions={props.actions} />
              </>
            )}
            <MoraleReport report={report} view={props.view} actions={props.actions} />
            <p class="muted">
              Obras concluídas: {report.counts.constructionsFinished} · Recrutas que chegaram:{' '}
              {report.counts.villagersArrived} · Objetivos cumpridos:{' '}
              {report.counts.objectivesCompleted}
            </p>
            {report.highlights.length > 0 ? (
              <ul class="chronicle">
                {report.highlights.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            ) : null}
            <button type="button" class="link" onClick={() => props.actions.run('lords.markRead')}>
              Marcar como lido
            </button>
          </>
        )}
      </section>
      {report === null ? null : leaving}
      <section aria-labelledby="decisions-title">
        <h2 id="decisions-title">Decisões pendentes</h2>
        <p class="muted">
          Nenhuma por agora. Cartas do Conselho e encruzilhadas de expedições aparecerão aqui nas
          próximas versões.
        </p>
      </section>
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
